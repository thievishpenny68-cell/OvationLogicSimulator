(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./trace.js'):root.LogicTrace,node?require('./signal-chart.js'):root.LogicSignalChart);if(node)module.exports=api;else root.LogicScopes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(T,Chart){
 'use strict';
 const MAX_CHANNELS=4;
 const windows=[0,1,5,10,30],colors=['#168c78','#458dbb','#bd8a4d','#9c77b5','#ce6972','#4fa5a7'].map((color,i)=>'var(--trace-'+i+','+color+')');let clipSerial=0;
 const validKey=key=>{try{const c=JSON.parse(key);return typeof key==='string'&&Array.isArray(c)&&c.length===3&&c.every(v=>typeof v==='string'&&v)&&['values','states'].includes(c[1]);}catch{return false;}};
 const validRange=r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>['min','max'].includes(k))&&typeof r.min==='number'&&Number.isFinite(r.min)&&typeof r.max==='number'&&Number.isFinite(r.max)&&r.max>r.min&&Number.isFinite(r.max-r.min);
 // Clip fixed-range segments in signal coordinates before scaling. This preserves
 // crossings and avoids infinite SVG coordinates for very narrow display ranges.
 function fixedPlot(points,minimum,maximum,digital){
  let path='',previous=null,count=0,single=null;const markers=[],y=value=>62-(value-minimum)/(maximum-minimum)*47;
  const end=()=>{if(count===1&&single.value>=minimum&&single.value<=maximum)markers.push({x:single.x,y:y(single.value)});count=0;previous=null;};
  function line(a,b){
   let start=0,end=1,firstValue=a.value,lastValue=b.value;const delta=b.value-a.value;
   if(delta===0){if(a.value<minimum||a.value>maximum)return;}
   else{const fraction=v=>{const numerator=v-a.value;return Number.isFinite(delta)&&Number.isFinite(numerator)?numerator/delta:(v*.5-a.value*.5)/(b.value*.5-a.value*.5);},entry=b.value>a.value?minimum:maximum,exit=b.value>a.value?maximum:minimum,entryTime=fraction(entry),exitTime=fraction(exit);start=Math.max(0,entryTime);end=Math.min(1,exitTime);if(start>end)return;if(a.value<minimum||a.value>maximum)firstValue=entry;if(b.value<minimum||b.value>maximum)lastValue=exit;}
   // Retain the actual clipped boundary: both fractions can round to the same
   // value when a large signal crosses a tiny range. Reinterpolation loses it.
   path+=` M${a.x+(b.x-a.x)*start} ${y(firstValue)} L${a.x+(b.x-a.x)*end} ${y(lastValue)}`;
  }
  for(const point of points){if(!point){end();continue;}if(previous){if(digital){const corner={x:point.x,value:previous.value};line(previous,corner);line(corner,point);}else line(previous,point);}previous=point;single=point;count++;}end();return{path,markers};
 }
 function create(project,x,y){let serial=1;while((project.scopes||[]).some(s=>s.id==='scope-'+serial))serial++;return{id:'scope-'+serial,name:'示波器 '+serial,x,y,width:540,height:360,windowSeconds:10,channels:[]};}
 function validate(scopes){
  if(scopes===undefined)return null;if(!Array.isArray(scopes))return '示波器配置必须为数组';const ids=new Set();
  for(const s of scopes){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.name!=='string'||!['x','y','width','height'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))||s.width<320||s.height<220||!windows.includes(s.windowSeconds)||!Array.isArray(s.channels)||new Set(s.channels).size!==s.channels.length)return '示波器身份、坐标、大小、时间窗或通道配置无效';ids.add(s.id);
   for(const key of s.channels){try{const c=JSON.parse(key);if(typeof key!=='string'||!Array.isArray(c)||c.length!==3||!c.every(v=>typeof v==='string'&&v)||!['values','states'].includes(c[1]))return '示波器通道标识无效';}catch{return '示波器通道标识无效';}}
   if(s.ranges!==undefined&&(!s.ranges||typeof s.ranges!=='object'||Array.isArray(s.ranges)||Object.entries(s.ranges).some(([key,r])=>!validKey(key)||!validRange(r))))return '示波器量程无效：上下限须为有限数、下限小于上限且跨度可显示';
  }return null;
 }
 function cursorSample(samples,time,startTime=0,end=samples.length-1){
  if(!Number.isFinite(time)||!samples.length)return null;const stop=Math.min(samples.length,Math.max(0,end+1));let lo=0,hi=stop;while(lo<hi){const mid=(lo+hi)>>1;if(samples[mid].time<startTime)lo=mid+1;else hi=mid;}const first=lo;if(first>=stop)return null;lo=first;hi=stop;while(lo<hi){const mid=(lo+hi)>>1;if(samples[mid].time<time)lo=mid+1;else hi=mid;}if(lo===first)return samples[first];if(lo===stop)return samples[stop-1];const a=samples[lo-1],b=samples[lo];return time<=a.time+(b.time-a.time)/2?a:b;
 }
 function model(scope,project,trace,cursor,channelMap,capacity){
  const channels=channelMap||new Map(T.channels(project,{includeInactive:true}).map(c=>[c.key,c])),end=cursor??trace.length-1,snapshot=trace[end],endTime=snapshot?.time??0,duration=scope.windowSeconds||Math.max(project.dtUs/1e6||.1,(capacity||T.recordingPlan(project)).seconds),startTime=Math.max(0,endTime-duration);
  const stop=Math.min(trace.length,Math.max(0,end+1));let lowIndex=0,highIndex=stop;while(lowIndex<highIndex){const mid=Math.floor((lowIndex+highIndex)/2);if(trace[mid].time<startTime)lowIndex=mid+1;else highIndex=mid;}const first=lowIndex,samples=first>=stop?[]:trace.slice(Math.max(0,first-(first>0&&trace[first].time>startTime?1:0)),stop);
  let sharedLow=Infinity,sharedHigh=-Infinity;if(scope.sharedAnalogAuto)for(const key of scope.channels){const channel=channels.get(key);if(channel?.kind!=='analog'||channel.inactive||validRange(scope.ranges?.[key]))continue;for(const sample of samples){const value=T.read(sample,channel);if(typeof value==='number'&&Number.isFinite(value)){sharedLow=Math.min(sharedLow,value);sharedHigh=Math.max(sharedHigh,value);}}}if(sharedLow!==Infinity&&sharedLow===sharedHigh){const pad=Math.abs(sharedLow)*.05||1;sharedLow-=pad;sharedHigh+=pad;}
  const lanes=scope.channels.map(key=>{const channel=channels.get(key),lane={key,channel,missing:!channel,value:channel?T.read(snapshot,channel):undefined,path:'',min:0,max:1,missingSamples:0,markers:[]};if(!channel||channel.inactive)return lane;
   const valid=v=>channel.kind==='boolean'?typeof v==='boolean':typeof v==='number'&&Number.isFinite(v)&&(channel.kind!=='packed16'||Number.isInteger(v)&&v>=0&&v<=65535);
   let low=Infinity,high=-Infinity;for(const sample of samples){const value=T.read(sample,channel);if(valid(value)){low=Math.min(low,Number(value));high=Math.max(high,Number(value));}}
   if(channel.kind!=='boolean'&&low!==Infinity){lane.min=low;lane.max=high;if(low===high){const pad=Math.abs(low)*.05||1;lane.min=low-pad;lane.max=high+pad;}}
   if(scope.sharedAnalogAuto&&channel.kind==='analog'&&sharedLow!==Infinity){lane.min=sharedLow;lane.max=sharedHigh;}
   const range=scope.ranges?.[key];if(range&&validRange(range)){lane.min=range.min;lane.max=range.max;lane.fixedRange=true;}
   let segmentLength=0,lastPoint;const fixedPoints=[],endSegment=()=>{if(segmentLength===1)lane.markers.push(lastPoint);segmentLength=0;};
   for(const sample of samples){const value=T.read(sample,channel);if(!valid(value)){endSegment();lane.missingSamples++;if(lane.fixedRange)fixedPoints.push(null);continue;}const x=70+(sample.time-startTime)/duration*520;if(lane.fixedRange){fixedPoints.push({x,value:Number(value)});continue;}const y=62-(Number(value)-lane.min)/(lane.max-lane.min)*47;lastPoint={x,y};if(!segmentLength)lane.path+=` M${x} ${y}`;else lane.path+=channel.kind!=='analog'?` H${x} V${y}`:` L${x} ${y}`;segmentLength++;}endSegment();
   if(lane.fixedRange)Object.assign(lane,fixedPlot(fixedPoints,lane.min,lane.max,channel.kind!=='analog'));
   return lane;
  });return{lanes,samples,snapshot,firstFrame:trace[0],startTime,endTime,axisMin:0,axisMax:duration,tick:snapshot?.tick??null};
 }
 function render(layer,project,trace,cursor,actions,catalog){
  const NS='http://www.w3.org/2000/svg',XHTML='http://www.w3.org/1999/xhtml';
  const h=(tag,attributes={},text)=>{const e=document.createElementNS(XHTML,tag);for(const[k,v]of Object.entries(attributes))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
  const svg=(tag,attributes={},text)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attributes))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
  const full=v=>typeof v==='boolean'?(v?'TRUE':'FALSE'):typeof v==='number'?String(v):'—',short=v=>Number(v.toPrecision(4)).toString();
  const all=catalog?.all||T.channels(project,{includeInactive:true}),signature=catalog?.signature||JSON.stringify(all),channelMap=catalog?.byKey||new Map(all.map(c=>[c.key,c])),configs=project.scopes||[];
  for(const child of Array.from(layer.children))if(!configs.some(s=>s.id===child.dataset.scopeId)){const plot=child.querySelector('.scope-plot');if(plot)Chart.release(plot);child.remove();}
  for(const scope of configs){
   let outer=Array.from(layer.children).find(e=>e.dataset.scopeId===scope.id);
   if(!outer){
    outer=svg('foreignObject',{'data-scope-id':scope.id,class:'scope-object'});const panel=h('section',{class:'scope-panel','aria-label':'示波器'}),head=h('div',{class:'scope-head'}),handle=h('span',{'data-scope-drag':'true',title:'拖动示波器'},'⠿ 示波器'),name=h('input',{'data-scope-name':'true','aria-label':'示波器名称',type:'text'}),remove=h('button',{'data-scope-delete':'true',title:'删除示波器','aria-label':'删除示波器'},'×');
    head.append(handle,name,remove);panel.append(head);const tools=h('div',{class:'scope-tools'}),settings=h('details',{'data-scope-settings':'true'}),summary=h('summary'),picker=h('div',{class:'scope-picker'}),clear=h('button',{'data-scope-clear':'true'},'清空'),selected=h('button',{'data-scope-selected':'true'},'当前块'),options=h('div',{'data-scope-options':'true'});picker.append(clear,selected,options);settings.append(summary,picker);
    const connect=h('button',{'data-scope-connect':'true',title:'将输出端拖到此按钮或左侧圆形入口；也可先选输出 / 状态探针再点击'},'⊕ 接入探针');connect.onclick=()=>actions.connect?.(scope.id);
    const ranges=h('details',{'data-scope-ranges':'true'});ranges.addEventListener('toggle',()=>{if(ranges.open)settings.open=false;});settings.addEventListener('toggle',()=>{if(settings.open)ranges.open=false;});ranges.append(h('summary',{},'量程'),h('div',{class:'scope-picker scope-range-options','data-scope-range-options':'true'}));
    const label=h('label',{},'时间窗 '),window=h('select',{'data-scope-window':'true','aria-label':'示波器时间窗'});for(const seconds of windows)window.append(h('option',{value:seconds},seconds?seconds+' 秒':'全程上限'));label.append(window);const cursorButton=h('button',{'data-scope-cursor':'true','aria-pressed':'false',title:'开启后点击或拖动图表查看历史采样值'},'游标');tools.append(settings,connect,ranges,cursorButton,label);panel.append(tools,h('div',{'data-scope-time':'true',class:'scope-time'}),h('div',{'data-scope-values':'true',class:'scope-values'}),h('span',{'data-scope-resize':'true',class:'scope-resize',title:'拖动调整示波器大小','aria-label':'调整示波器大小'}));outer.append(panel);layer.append(outer);
    name.onchange=()=>actions.change(scope.id,s=>{s.name=name.value;});remove.onclick=()=>actions.remove(scope.id);clear.onclick=()=>actions.change(scope.id,s=>{s.channels=[];});selected.onclick=()=>{const keys=actions.selectedChannels();actions.change(scope.id,s=>{s.channels=keys.slice(0,MAX_CHANNELS);});if(keys.length>MAX_CHANNELS)actions.notify?.('每台示波器最多4路，已接入当前块前4路信号。');};window.onchange=()=>actions.change(scope.id,s=>{s.windowSeconds=Number(window.value);});
    handle.onpointerdown=e=>actions.gesture(e,scope.id,'move');panel.querySelector('[data-scope-resize]').onpointerdown=e=>actions.gesture(e,scope.id,'resize');
    panel.addEventListener('keydown',e=>e.stopPropagation());
    panel.addEventListener('click',()=>{if(outer.parentNode===layer&&layer.lastElementChild!==outer)layer.append(outer);});
   }
   for(const key of ['x','y','width','height'])outer.setAttribute(key,scope[key]);outer.setAttribute('data-scope-compact',String(scope.width<440||scope.height<300));
   const q=selector=>outer.querySelector(selector),name=q('[data-scope-name]');if(document.activeElement!==name)name.value=scope.name;q('[data-scope-window]').value=String(scope.windowSeconds);q('summary').textContent='信号 '+Math.min(MAX_CHANNELS,scope.channels.length)+'/4';
   if(outer._channelSignature!==signature){const options=q('[data-scope-options]');options.replaceChildren();for(const c of all){const label=h('label'),input=h('input',{type:'checkbox','data-scope-channel':c.key,'data-scope-section':c.section});input.onchange=()=>actions.change(scope.id,s=>{if(input.checked&&s.channels.length>=MAX_CHANNELS){input.checked=false;actions.notify?.('每台示波器最多4路，请先移除一路信号。');return;}s.channels=input.checked?[...s.channels,c.key]:s.channels.filter(k=>k!==c.key);});label.append(input,document.createTextNode(c.label));options.append(label);}outer._channelSignature=signature;}
   const selectedSignature=JSON.stringify(scope.channels);if(outer._checkedCatalog!==signature||outer._checkedSelection!==selectedSignature){const selected=new Set(scope.channels);for(const input of outer.querySelectorAll('[data-scope-channel]'))input.checked=selected.has(input.dataset.scopeChannel);outer._checkedCatalog=signature;outer._checkedSelection=selectedSignature;}
   const m=model({...scope,channels:scope.channels.slice(0,MAX_CHANNELS),sharedAnalogAuto:true},project,trace,cursor,channelMap,catalog?.capacity),rangeSignature=JSON.stringify([scope.channels,scope.ranges]);
   if(outer._rangeSignature!==rangeSignature||outer._rangeCatalog!==signature){const options=q('[data-scope-range-options]');options.replaceChildren();if(!m.lanes.length)options.append(h('div',{class:'scope-empty'},'先接入信号，再设置各路量程。'));for(const lane of m.lanes){const row=h('div',{'data-scope-range-row':lane.key,class:'scope-range-row'}),title=h('div',{},lane.channel?.label||'缺失信号'),mode=h('select',{'data-scope-range-mode':lane.key,'aria-label':'量程模式'}),low=h('input',{'data-scope-range-min':lane.key,type:'number',step:'any','aria-label':'显示下限'}),high=h('input',{'data-scope-range-max':lane.key,type:'number',step:'any','aria-label':'显示上限'}),apply=h('button',{'data-scope-range-apply':lane.key},'应用'),note=h('div',{class:'scope-warning',role:'status'}),fields=h('div',{class:'scope-range-fields'});mode.append(h('option',{value:'auto'},'自动'),h('option',{value:'fixed'},'固定'));mode.value=scope.ranges?.[lane.key]?'fixed':'auto';low.value=String(lane.min);high.value=String(lane.max);const enabled=()=>{low.disabled=high.disabled=mode.value==='auto';};enabled();mode.onchange=enabled;const lowLabel=h('label',{},'下限'),highLabel=h('label',{},'上限');lowLabel.append(low);highLabel.append(high);fields.append(mode,lowLabel,highLabel,apply);row.append(title,fields,note);options.append(row);apply.onclick=()=>{const range={min:Number(low.value),max:Number(high.value)};if(mode.value==='fixed'&&(!low.value.trim()||!high.value.trim()||!validRange(range))){note.textContent='量程未采用：请填写有限下限和上限，下限须小于上限。';return;}actions.change(scope.id,s=>{if(mode.value==='auto'){if(s.ranges){delete s.ranges[lane.key];if(!Object.keys(s.ranges).length)delete s.ranges;}}else{if(!s.ranges)s.ranges={};s.ranges[lane.key]=range;}});};}outer._rangeSignature=rangeSignature;outer._rangeCatalog=signature;}
   const values=q('[data-scope-values]');let plot=q('.scope-plot');
   if(!plot){const cards=h('div',{class:'scope-readouts'}),chart=svg('svg',{class:'scope-plot signal-chart','aria-label':scope.name+' 多通道波形'}),notes=h('div',{class:'scope-notes'});values.replaceChildren(cards,chart,notes);plot=chart;Chart.bind(q('[data-scope-cursor]'),plot);}
   const cards=q('.scope-readouts'),notes=q('.scope-notes'),cardSignature=JSON.stringify(m.lanes.map(l=>[l.key,l.channel?.label,l.missing]));
   if(outer._cardSignature!==cardSignature){cards.replaceChildren();m.lanes.forEach((lane,i)=>{const row=h('div',{class:'scope-lane','data-scope-card':lane.key}),caption=h('div',{class:'scope-caption',title:lane.channel?.label||lane.key}),name=h('span',{},'CH'+(i+1)+' · '+(lane.channel?.label||'缺失信号')),value=h('strong',{},'—'),range=h('small',{class:'scope-range-caption'});row.style.color=colors[i%colors.length];caption.append(name,value);row.append(caption,range);row.onclick=()=>Chart.activate(plot,lane.key);if(lane.missing){const remove=h('button',{'data-scope-unbind':lane.key},'移除此引用');remove.onclick=e=>{e.stopPropagation();actions.change(scope.id,s=>{s.channels=s.channels.filter(key=>key!==lane.key);});};row.append(remove);}cards.append(row);});outer._cardSignature=cardSignature;}
   notes.replaceChildren();if(scope.channels.length>MAX_CHANNELS)notes.append(h('div',{class:'scope-warning'},'原配置'+scope.channels.length+'路，当前显示前4路；在信号列表取消旧路后可切换，其余引用仍保留。'));
   if(!m.lanes.length)notes.append(h('div',{class:'scope-empty'},'选择输出端口，再点“接入探针”；每台最多4路。'));
   for(const lane of m.lanes){if(lane.missing)notes.append(h('div',{class:'scope-warning'},'缺失信号：原信号不存在，未自动改绑。'));else if(lane.missingSamples)notes.append(h('div',{class:'scope-warning'},lane.missingSamples+' 个采样值缺失或类型不符，已断线。'));}
   Chart.paint(plot,m,{colors,pick:time=>cursorSample(m.samples,time,m.startTime),onReadout:({sample,enabled,activeKey,values:readouts,rawValues})=>{
    q('[data-scope-time]').textContent=m.tick===null?'等待运行':`扫描 ${m.tick} · ${short(m.startTime)}–${short(m.endTime)} s`+(enabled&&sample?` · 游标 ${short(sample.time)} s / 扫描 ${sample.tick}`:' · 实时');
    const rows=cards.children;m.lanes.forEach((lane,i)=>{const row=rows[i];row.querySelector('strong').textContent=readouts[i];row.querySelector('strong').title=rawValues[i]===undefined?'没有有效采样':String(rawValues[i]);row.classList.toggle('active',lane.key===activeKey);row.querySelector('small').textContent=lane.channel?.inactive||((lane.fixedRange?'固定 ':'自动 ')+short(lane.min)+' ～ '+short(lane.max));});
   }});

  }
 }
 return{create,validate,model,render,cursorSample,MAX_CHANNELS,windows};
});
