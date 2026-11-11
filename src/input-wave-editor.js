(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core'):root.LogicCore,typeof module==='object'&&module.exports?require('./input-wave-excel'):root.LogicInputWaveExcel,typeof module==='object'&&module.exports?require('./input-wave-template'):root.LogicInputWaveTemplate);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicInputWaveEditor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,Excel,Template){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),str=x=>x===undefined?'':String(x),number=x=>Number(x.toPrecision(6)).toString();
 function preview(wave,kind,{end,dtUs,maxSamples=201}){
  C.checkWave(wave,kind);
  if(!Number.isFinite(end)||end<=0)throw Error('预览终点必须为正的有限秒数');
  if(!Number.isSafeInteger(dtUs)||dtUs<=0)throw Error('请先设置有效的扫描周期');
  if(!Number.isInteger(maxSamples)||maxSamples<2||maxSamples>1001)throw Error('预览采样点数无效');
  let last=Math.floor(end*1e6/dtUs);if(!Number.isSafeInteger(last)||!Number.isSafeInteger(last*dtUs))throw Error('预览扫描索引过大，请缩短时间范围');
  while(last>0&&last*dtUs/1e6>end)last--;
  const samples=[],stride=Math.max(1,Math.ceil(last/(maxSamples-1))),sample=t=>C.sample(wave,t,kind),line=[[0,sample(0)]];
  const push=(t,v)=>{const old=line.at(-1);if(old[0]!==t||old[1]!==v)line.push([t,v]);};
  if(wave.mode==='step'&&wave.at>0&&wave.at<=end){push(wave.at,sample(wave.at/2));push(wave.at,sample(wave.at));}
  if(wave.mode==='ramp'&&wave.start>0&&wave.start<end)push(wave.start,sample(wave.start));
  if(wave.mode==='table')for(let i=1;i<wave.points.length;i++){const[t]=wave.points[i];if(t>end)break;push(t,C.sample(wave,(wave.points[i-1][0]+t)/2,kind));push(t,sample(t));}
  if(wave.mode==='linear')for(const[t]of wave.points)if(t>0&&t<end)push(t,sample(t));
  push(end,sample(end));
  for(let tick=0;tick<=last;tick+=stride){const time=tick*dtUs/1e6;samples.push({tick,time,value:sample(time)});}
  if(samples.at(-1).tick!==last){const time=last*dtUs/1e6;samples.push({tick:last,time,value:sample(time)});}
  return{line,samples,totalSamples:last+1,stride};
 }
 const modes={constant:'常量',step:'阶跃',ramp:'斜坡',table:'分段保持',linear:'分段线性'};
 const descriptions={constant:'整个仿真期间保持同一个值。',step:'变化时刻之前取“变化前”，从该时刻起取“变化后”。',ramp:'开始前保持起始值，开始后按每秒斜率变化。',table:'到达节点时切换到该行的值，两节点之间保持前值。',linear:'相邻节点之间线性变化。'};
 function example(mode,kind){const a=kind==='boolean'?false:0,b=kind==='boolean'?true:1;return mode==='constant'?{mode,value:a}:mode==='step'?{mode,at:1,before:a,after:b}:mode==='ramp'?{mode,start:0,value:0,slope:1}:{mode,points:[[0,a],[1,b]]};}
 function fields(w){return{mode:w?.mode||'',value:str(w?.value),at:str(w?.at),before:str(w?.before),after:str(w?.after),start:str(w?.start),slope:str(w?.slope),points:(w?.points||[]).map(p=>p.map(str))};}
 function mount(parent,{kind,wave,dtUs,draft,onChange=()=>{}}){
  const original=wave==null?null:copy(wave),initial=fields(original);let state=draft?copy(draft.state):copy(initial),lastWave=null,lastPreview=null,excelRequest=0,excelDraft=null,editRevision=0;
  const doc=parent.ownerDocument,html=(tag,attrs={},text)=>{const e=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;},svg=(tag,attrs={},text)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
  const root=html('section',{class:'wave-editor'}),toolbar=html('div',{class:'wave-mode-toolbar'}),modeLabel=html('label',{},'输入规律 '),mode=html('select',{id:'wave-mode','aria-label':'输入规律'}),buttons=html('div',{class:'wave-mode-buttons'}),workspace=html('div',{class:'wave-editor-workspace'}),editor=html('div',{class:'wave-form-panel'}),form=html('div',{class:'wave-fields'}),description=html('p',{class:'source-note'}),presets=html('div',{class:'wave-presets'}),panel=html('section',{class:'wave-preview-panel','aria-label':'输入波形预览'}),previewHeader=html('div',{class:'wave-preview-toolbar'}),endLabel=html('label',{},'预览至 '),end=html('input',{id:'wave-preview-end',type:'number',min:'0',step:'any','aria-label':'预览终点（秒）'}),chart=svg('svg',{id:'wave-preview',viewBox:'0 0 660 250',preserveAspectRatio:'none',role:'img','aria-label':'手工输入波形及扫描采样点'}),error=html('p',{id:'wave-preview-error',class:'wave-preview-error',role:'status'}),readout=html('p',{id:'wave-preview-readout',class:'wave-preview-readout'}),note=html('p',{id:'wave-preview-note',class:'source-note'}),status=html('p',{id:'wave-draft-status',role:'status'}),discard=html('button',{id:'wave-discard',type:'button'},'恢复已应用设置');
  mode.append(html('option',{value:''},'选择输入规律'));
  for(const[key,name]of Object.entries(modes)){if(kind!=='analog'&&['ramp','linear'].includes(key))continue;mode.append(html('option',{value:key},name));const b=html('button',{type:'button','data-wave-mode':key},name);b.onclick=()=>selectMode(key);buttons.append(b);}
  modeLabel.append(mode);toolbar.append(modeLabel,buttons);root.append(toolbar);presets.append(html('span',{},'填入示例：'));
  const preset=(id,name,w)=>{const b=html('button',{type:'button','data-wave-preset':id},name);b.onclick=()=>setWave(w);presets.append(b);};
  if(kind==='boolean'){preset('off','保持FALSE',{mode:'constant',value:false});preset('on','保持TRUE',{mode:'constant',value:true});preset('set','1秒后置位',{mode:'step',at:1,before:false,after:true});preset('reset','1秒后复位',{mode:'step',at:1,before:true,after:false});preset('pulse','1～2秒脉冲',{mode:'table',points:[[0,false],[1,true],[2,false]]});}
  else{preset('zero','保持0',{mode:'constant',value:0});preset('step','1秒后0→1',{mode:'step',at:1,before:0,after:1});if(kind==='analog')preset('ramp','每秒增加1',{mode:'ramp',start:0,value:0,slope:1});preset('segments','分段示例',example('table',kind));}
  const excelTools=html('div',{class:'wave-excel-tools'}),excelImport=html('button',{id:'wave-excel-import',type:'button'},'导入 Excel'),excelTemplate=html('button',{id:'wave-excel-template',type:'button'},'下载模板'),excelFile=html('input',{id:'wave-excel-file',type:'file',accept:'.xlsx',hidden:''}),excelStatus=html('p',{id:'wave-excel-status',class:'source-note',role:'status'},'.xlsx两列：时间（秒）、值。导入后先预览，再应用参数。'),excelSheetLabel=html('label',{class:'wave-excel-sheet',hidden:''},'选择工作表 '),excelSheet=html('select',{id:'wave-excel-sheet','aria-label':'选择Excel工作表'});
  excelTools.append(excelImport,excelTemplate,excelFile);excelSheetLabel.append(excelSheet);
  editor.append(excelTools,excelStatus,excelSheetLabel,presets,description,form);end.value=str(draft?.end??Math.max(5,(original?.at||original?.start||original?.points?.at(-1)?.[0]||0)*1.25));endLabel.append(end,doc.createTextNode(' 秒'));previewHeader.append(html('strong',{},'输入波形预览'),endLabel);panel.append(previewHeader,chart,error,readout,note);workspace.append(editor,panel);const statusBar=html('div',{class:'wave-editor-status'});statusBar.append(status,discard);root.append(statusBar,workspace);parent.append(root);
  function value(text){if(!text.trim())throw Error('请填写信号值');if(kind==='boolean'){if(text==='false')return false;if(text==='true')return true;throw Error('数字输入只能选择TRUE / FALSE');}const n=Number(text);if(!Number.isFinite(n))throw Error('信号值必须为有限数值');return n;}
  function time(text){if(!text.trim()||!Number.isFinite(Number(text)))throw Error('请填写有限的时间或斜率');return Number(text);}
  function read(){const m=state.mode,w=m==='constant'?{mode:m,value:value(state.value)}:m==='step'?{mode:m,at:time(state.at),before:value(state.before),after:value(state.after)}:m==='ramp'?{mode:m,start:time(state.start),value:value(state.value),slope:time(state.slope)}:['table','linear'].includes(m)?{mode:m,points:state.points.map(p=>[time(p[0]),value(p[1])])}:null;if(!w)throw Error('请选择输入规律');C.checkWave(w,kind);return w;}
  function dirty(){try{return JSON.stringify(fields(read()))!==JSON.stringify(initial);}catch{return JSON.stringify(state)!==JSON.stringify(initial);}}
  function snapshot(){return{state:copy(state),end:end.value};}
  function notify(edited=false){if(edited)editRevision++;const changed=dirty();status.textContent=changed?'草稿预览 · 尚未应用。点击“应用参数”后用于仿真。':'已应用输入规律的预览 · 不推进仿真时间。';status.className=changed?'wave-dirty':'source-note';discard.disabled=!changed;onChange(snapshot(),changed);}
  const format=v=>kind==='boolean'?(v?'TRUE':'FALSE'):kind==='packed16'?'0x'+v.toString(16).toUpperCase().padStart(4,'0')+' ('+v+')':str(v);
  function draw(){chart.replaceChildren();lastPreview=null;lastWave=null;readout.textContent='移动指针查看时刻与数值；圆点表示扫描采样。';note.textContent='';try{const w=read(),p=preview(w,kind,{end:Number(end.value),dtUs}),x=t=>64+t/Number(end.value)*580,values=p.line.map(p=>Number(p[1])).concat(p.samples.map(p=>Number(p.value)));let min=kind==='boolean'?0:Math.min(...values),max=kind==='boolean'?1:Math.max(...values);if(min===max){const pad=Math.max(1,Math.abs(min)*.1);min-=pad;max+=pad;}const y=v=>204-(Number(v)-min)/(max-min)*178;
    for(let i=0;i<=4;i++){const t=Number(end.value)*i/4;chart.append(svg('line',{x1:x(t),y1:20,x2:x(t),y2:204,class:'wave-grid'}),svg('text',{x:x(t),y:228,'text-anchor':i===0?'start':i===4?'end':'middle'},number(t)+'s'));}
    for(const v of [min,max])chart.append(svg('line',{x1:64,y1:y(v),x2:644,y2:y(v),class:'wave-grid'}),svg('text',{x:58,y:y(v)+4,'text-anchor':'end'},kind==='boolean'?(v?'TRUE':'FALSE'):number(v)));
    chart.append(svg('path',{'data-wave-line':'',d:p.line.map(([t,v],i)=>(i?'L':'M')+x(t)+' '+y(v)).join(' '),class:'wave-preview-line',fill:'none'}));
    for(const s of p.samples){const dot=svg('circle',{cx:x(s.time),cy:y(s.value),r:3.2,class:'wave-preview-sample','data-wave-sample-tick':s.tick,'data-value':str(s.value)});dot.append(svg('title',{},'扫描 '+s.tick+' · '+s.time+' s · '+format(s.value)));chart.append(dot);}
    error.textContent='';lastWave=w;lastPreview=p;note.textContent='线：输入规律示意；圆点：每 '+number(dtUs/1e6)+' 秒采样。'+(p.stride>1?'窗口共 '+p.totalSamples+' 个样本，图中每 '+p.stride+' 拍抽取并保留末拍，共 '+p.samples.length+' 点。':'共 '+p.samples.length+' 个采样点。')+((w.mode==='table'||w.mode==='linear')?' 首节点前取首值，末节点后保持末值。':'');
   }catch(e){error.textContent='预览不可用：'+e.message;}}
  chart.onpointermove=e=>{if(!lastPreview)return;const b=chart.getBoundingClientRect(),t=Math.max(0,Math.min(Number(end.value),(e.clientX-b.left)/b.width*660/580*Number(end.value)-64/580*Number(end.value))),tick=Math.round(t*1e6/dtUs),sampleTime=tick*dtUs/1e6;try{readout.textContent='t = '+number(t)+' s，输入 = '+format(C.sample(lastWave,t,kind))+'；最近扫描 '+tick+'（'+number(sampleTime)+' s）= '+format(C.sample(lastWave,sampleTime,kind));}catch(e){readout.textContent=e.message;}};
  function input(parent,label,id,text,isValue=false){const box=html('label',{class:'field'},label),control=isValue&&kind==='boolean'?html('select',{id}):html('input',{id,type:isValue&&kind==='packed16'?'text':'number',step:'any'});if(control.tagName==='SELECT')for(const[v,name]of [['','请选择'],['false','FALSE'],['true','TRUE']])control.append(html('option',{value:v},name));control.value=text;box.append(control);parent.append(box);return control;}
  function render(){form.replaceChildren();mode.value=state.mode;for(const b of buttons.children)b.setAttribute('aria-pressed',str(b.dataset.waveMode===state.mode));description.textContent=(descriptions[state.mode]||'选择一种规律开始设置。')+' 其他模式会填入示例，保持/线性互换保留节点；点击“应用参数”后生效。';
   const field=(label,key,isValue=false)=>{const e=input(form,label,'wave-'+key,state[key],isValue);e.oninput=()=>{state[key]=e.value;draw();notify(true);};};
   if(state.mode==='constant')field('信号值','value',true);
   if(state.mode==='step'){field('变化时刻（秒）','at');field('变化前','before',true);field('变化后','after',true);}
   if(state.mode==='ramp'){field('开始时刻（秒）','start');field('起始值','value',true);field('斜率（每秒）','slope');}
   if(['table','linear'].includes(state.mode)){
    const rows=html('div',{id:'wave-switches',class:'wave-point-rows'});form.append(rows);
    state.points.forEach((point,i)=>{const row=html('div',{class:'wave-switch'}),t=input(row,'时刻（秒）','wave-time-'+i,point[0]),v=input(row,kind==='boolean'?'开关值':kind==='packed16'?'LP字（0～65535）':'信号值','wave-switch-'+i,point[1],true),del=html('button',{type:'button','aria-label':kind==='boolean'?'删除切换时刻':'删除分段节点'},'删除');t.min='0';t.setAttribute('data-wave-time','');v.setAttribute('data-wave-value','');t.oninput=()=>{state.points[i][0]=t.value;draw();notify(true);};v.oninput=()=>{state.points[i][1]=v.value;draw();notify(true);};del.onclick=()=>{state.points.splice(i,1);render();notify(true);};row.append(del);rows.append(row);});
    const add=html('button',{type:'button',id:'wave-add-point'},kind==='boolean'?'添加切换时刻':'添加分段节点');add.onclick=()=>{const p=state.points.at(-1),t=p&&Number.isFinite(Number(p[0]))&&p[0].trim()?Number(p[0])+1:0;state.points.push([str(t),p?p[1]:kind==='boolean'?'false':'0']);render();notify(true);};form.append(add);
   }draw();
  }
  function setWave(w){state=fields(w);render();notify(true);}
  function selectMode(key){if(['table','linear'].includes(key)&&['table','linear'].includes(state.mode)){state.mode=key;render();notify(true);}else setWave(example(key,kind));}
  function excelError(message){excelStatus.textContent=message;excelStatus.className='wave-excel-error';}
  function adoptExcel(draft,sheetName){
   if(!root.isConnected)return;if(editRevision!==draft.revision)throw Error('当前输入草稿已修改，请重新导入文件');
   const result=Excel.toWave(draft.workbook,{kind,mode:draft.mode,sheetName}),last=result.wave.points.at(-1)[0];end.value=str(Math.max(1,Number(end.value)||0,last*1.1));
   setWave(result.wave);excelDraft=null;excelSheetLabel.hidden=true;excelStatus.className='source-note';excelStatus.textContent=draft.name+' · '+result.sheetName+'：已导入'+result.dataRows+'个节点（'+modes[result.wave.mode]+'），待应用。'+(result.ignoredBlankRows?' 已忽略'+result.ignoredBlankRows+'个空行。':'');
  }
  excelImport.onclick=()=>excelFile.click();
  excelTemplate.onclick=()=>{const bytes=Uint8Array.from(atob(Template.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=html('a',{href:url,download:'INPUT波形导入模板.xlsx'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  excelFile.onchange=async()=>{const file=excelFile.files[0];if(!file)return;const request=++excelRequest,revision=editRevision,importMode=state.mode==='linear'&&kind==='analog'?'linear':'table';excelDraft=null;excelSheetLabel.hidden=true;excelImport.disabled=true;excelStatus.className='source-note';excelStatus.textContent='正在读取 '+file.name+'…';
   try{if(!/\.xlsx$/i.test(file.name))throw Error('请选择.xlsx文件');if(file.size>Excel.MAX_BYTES)throw Error('Excel文件不能超过5 MiB');const bytes=await file.arrayBuffer();if(request!==excelRequest||!root.isConnected)return;if(editRevision!==revision)throw Error('当前输入草稿已修改，请重新导入文件');const workbook=Excel.readWorkbook(bytes),draft={name:file.name,workbook,revision,mode:importMode};
    if(workbook.SheetNames.length>1){excelDraft=draft;excelSheet.replaceChildren(html('option',{value:''},'请选择工作表'));for(const name of workbook.SheetNames)excelSheet.append(html('option',{value:name},name));excelSheetLabel.hidden=false;excelStatus.textContent=file.name+'包含多个工作表，请选择工作表后导入。';}else adoptExcel(draft,workbook.SheetNames[0]);
   }catch(e){if(request===excelRequest&&root.isConnected)excelError('导入失败：'+file.name+'：'+e.message);}finally{if(request===excelRequest&&root.isConnected){excelFile.value='';excelImport.disabled=false;}}
  };
  excelSheet.onchange=()=>{if(!excelSheet.value||!excelDraft)return;try{adoptExcel(excelDraft,excelSheet.value);}catch(e){excelError('导入失败：'+e.message);}};

  mode.onchange=()=>{if(mode.value)selectMode(mode.value);else{state=fields(null);render();notify(true);}};end.oninput=()=>{draw();notify();};discard.onclick=()=>{state=copy(initial);render();notify(true);};render();notify();
  return{read,snapshot};
 }
 return{preview,mount};
});
