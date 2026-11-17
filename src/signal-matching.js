(function(root){
 'use strict';
 const E=root.LogicEngineering,NS='http://www.w3.org/2000/svg';
 const kinds={boolean:'数字量',analog:'模拟量',packed16:'整字'};
 function mount(options){
  const doc=document,el=(tag,attrs={},text)=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const svgEl=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const button=(id,text,action,attrs={})=>{const b=el('button',{type:'button',...(id?{id}:{}),...attrs},text);b.onclick=action;return b;};
  const key=e=>E.nodeKey(e.canvasId,e.nodeId),valueText=v=>typeof v==='boolean'?(v?'开':'关'):typeof v==='number'?String(Number(v.toPrecision(7))):'尚未运行';
  const dialog=el('dialog',{id:'signal-matching-dialog',class:'signal-matching-visual',tabindex:'-1','aria-labelledby':'signal-matching-title'});
  const head=el('div',{class:'sm-heading'}),heading=el('div');heading.append(el('h2',{id:'signal-matching-title'},'连接画布信号'),el('p',{},'先选左边的输出，再点右边的输入；也可以从输出圆点拖一条线过去。'));
  head.append(heading,button('match-close','关闭',close,{'aria-label':'关闭信号匹配'}));dialog.append(head);
  const steps=el('ol',{class:'sm-steps','aria-label':'连接信号的三个步骤'}),stepItems=[];
  for(const[i,text]of ['选择输出','选择接收输入','核对并应用'].entries()){const li=el('li'),number=el('span',{class:'sm-step-number'},i+1);li.append(number,doc.createTextNode(text));steps.append(li);stepItems.push(li);}dialog.append(steps);
  const tools=el('div',{class:'sm-tools'}),filters=el('div',{class:'sm-filters',role:'group','aria-label':'筛选连接状态'}),filterButtons=new Map();let filter='all';
  for(const[value,label]of [['all','全部信号'],['pending','待连接'],['connected','已有连接'],['issues','有问题']]){const b=button('',label,()=>{filter=value;renderLists();},{'data-match-filter':value,'aria-pressed':String(value==='all')});filters.append(b);filterButtons.set(value,{button:b,label});}
  const instruction=el('p',{id:'match-instruction',class:'sm-instruction',role:'status'});tools.append(filters,instruction);dialog.append(tools);
  const columnHeads=el('div',{class:'sm-column-heads'}),leftHead=el('label'),rightHead=el('label'),sourceSearch=el('input',{id:'match-source-search',type:'search',placeholder:'搜索输出名称或画布','aria-label':'搜索输出名称或画布'}),inputSearch=el('input',{id:'match-search',type:'search',placeholder:'搜索输入名称或画布','aria-label':'搜索输入名称或画布'});
  leftHead.append(el('strong',{},'从这里输出'),el('span',{class:'sm-column-hint'},'OUTPUT · 选择一个来源'),sourceSearch);rightHead.append(el('strong',{},'让这些输入接收'),el('span',{class:'sm-column-hint'},'INPUT · 可以选择多个'),inputSearch);columnHeads.append(leftHead,el('span',{class:'sm-direction','aria-hidden':'true'},'→'),rightHead);dialog.append(columnHeads);
  const scroll=el('div',{class:'sm-map-scroll'}),map=el('div',{id:'match-map',class:'sm-map'}),left=el('div',{class:'sm-column sm-sources'}),right=el('div',{class:'sm-column sm-inputs'}),wires=svgEl('svg',{class:'sm-wires',role:'img','aria-label':'输出来源到输入接收端的连接图'});
  map.append(wires,left,el('div',{class:'sm-gutter','aria-hidden':'true'}),right);scroll.append(map);dialog.append(scroll);
  const footer=el('div',{class:'sm-footer'}),feedback=el('div',{class:'sm-feedback'}),status=el('div',{id:'match-status',role:'status','aria-live':'polite'}),note=el('p',{class:'sm-footnote'}),actions=el('div',{class:'sm-actions'}),clear=button('match-clear','重新选择',()=>resetSelection()),apply=button('match-apply','应用连接',applyConnections,{class:'primary'});
  feedback.append(status,note);actions.append(clear,apply);footer.append(feedback,actions);dialog.append(footer);doc.body.append(dialog);
  let model=null,modelStamp='',selectedSource=null,targets=new Set(),focused=null,message='',messageTone='',baseFingerprint=null,applying=false,drag=null,frameRequest=0;
  const sourceCards=new Map(),inputCards=new Map(),observer=new ResizeObserver(()=>scheduleWires());
  sourceSearch.oninput=inputSearch.oninput=renderLists;
  dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',cleanup);
  function data(){
   const p=options.getProject(),index=E.signals(p),scope=E.scope(p),paused=new Map([...scope.disabled.map(k=>[k,'已禁用']),...scope.suspended.map(k=>[k,'上游暂停'])]);
   const sources=new Map(),inputs=new Map(),bindings=new Map(index.bindings.map(b=>[key(b.input),b]));
   for(const row of index.rows){for(const e of row.outputs)sources.set(key(e),{...e,key:key(e),row,problem:!row.name?'输出名称不能为空':row.outputs.length>1?'同名输出来源重复':!kinds[e.kind]?'信号类型尚未明确':''});for(const e of row.inputs){const bound=bindings.get(key(e)),problem=!row.name?'输入名称不能为空':row.status==='conflict'?'同名输出来源重复':row.status==='type-conflict'&&!bound&&row.source?.canvasId!==e.canvasId?'同名信号类型不同':'';inputs.set(key(e),{...e,key:key(e),row,binding:bound,problem});}}
   return{p,index,scope,paused,sources,inputs,bindings,ranks:new Map(p.canvases.map((c,i)=>[c.id,i]))};
  }
  function stamp(m){return JSON.stringify([m.p.canvases.map(c=>[c.id,c.name]),[...m.sources.values(),...m.inputs.values()].map(e=>[e.key,e.name,e.kind,e.problem]),m.index.bindings,m.scope]);}
  function open(){
   options.pause?.();selectedSource=null;targets.clear();focused=null;message='';messageTone='';baseFingerprint=null;sourceSearch.value=inputSearch.value='';filter='all';model=data();modelStamp=stamp(model);renderLists();dialog.showModal();observer.observe(map);scheduleWires();
  }
  function close(){if(dialog.open)dialog.close();else cleanup();}
  function cleanup(){observer.disconnect();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;endDrag();}
  function refresh(){
   if(!dialog.open)return;const next=data(),nextStamp=stamp(next);if(nextStamp!==modelStamp){const hadDraft=targets.size>0;model=next;modelStamp=nextStamp;targets.clear();baseFingerprint=null;focused=null;if(!model.sources.has(selectedSource))selectedSource=null;if(hadDraft&&!applying){message='工程已更新，请重新选择要连接的输入。';messageTone='warning';}renderLists();}else{model=next;paint();}
  }
  function resetSelection(){selectedSource=null;targets.clear();focused=null;baseFingerprint=null;message='';messageTone='';endDrag();paint();dialog.focus({preventScroll:true});}
  function selectSource(k){
   const s=model.sources.get(k);if(!s)return;if(s.problem){message=s.problem+'。请点“定位”到来源画布修正。';messageTone='error';paint();return;}
   if(selectedSource!==k){targets.clear();baseFingerprint=null;}selectedSource=k;focused=null;message='';messageTone='';paint();
  }
  function incompatibility(s,t){if(s.problem)return s.problem;if(s.canvasId===t.canvasId)return'同一画布：请使用画布内连线';if(s.kind!==t.kind)return'类型不同：'+(kinds[s.kind]||'未定类型')+'不能接入'+(kinds[t.kind]||'未定类型');return'';}
  function selectTarget(k){
   const t=model.inputs.get(k),s=model.sources.get(selectedSource);if(!t)return;if(!s){message='先在左侧选择一个输出信号，再点这里。';messageTone='warning';paint();return;}
   const reason=incompatibility(s,t);if(reason){message=reason;messageTone='error';paint();return;}
   if(t.binding&&key(t.binding.source)===selectedSource){focused=t.binding;message='';messageTone='';paint();return;}
   if(targets.has(k))targets.delete(k);else targets.add(k);baseFingerprint=targets.size?E.fingerprints(options.getProject()).simulation:null;focused=null;message='';messageTone='';paint();
  }
  function locate(e){close();options.selectNode(e.canvasId,e.nodeId);}
  function matches(e,q){return!q||(e.name+' '+e.canvasName).toLowerCase().includes(q);}
  function visible(e,input){if(filter==='all')return true;if(filter==='issues')return!!e.problem||!input&&e.row.status==='type-conflict';if(input)return filter==='connected'?!!e.binding:!e.binding&&!e.problem;const used=model.index.bindings.some(b=>key(b.source)===e.key);return filter==='connected'?used:!e.problem;}
  function renderLists(){
   if(!model)return;sourceCards.clear();inputCards.clear();left.replaceChildren();right.replaceChildren();
   for(const[input,host,entries,q]of [[false,left,model.sources,sourceSearch.value.trim().toLowerCase()],[true,right,model.inputs,inputSearch.value.trim().toLowerCase()]]){
    let count=0;for(const canvas of model.p.canvases){const points=[...entries.values()].filter(e=>e.canvasId===canvas.id&&matches(e,q)&&visible(e,input));if(!points.length)continue;const section=el('section',{class:'sm-canvas-group'}),heading=el('h3');heading.append(el('span',{class:'sm-canvas-number'},model.ranks.get(canvas.id)+1),doc.createTextNode(canvas.name),el('small',{},points.length+' 个'));section.append(heading);for(const point of points){section.append(card(point,input));count++;}host.append(section);}
    if(!count)host.append(el('div',{class:'sm-empty'},entries.size?'没有符合筛选的信号；换个关键词或选择“全部”。':input?'还没有输入信号。请在接收画布添加 INPUT。':'还没有输出信号。请在来源画布添加 OUTPUT。'));
   }paint();
  }
  function card(e,input){
   const wrap=el('div',{class:'sm-card'}),choose=button('',e.name,()=>input?selectTarget(e.key):selectSource(e.key),{class:'sm-card-main',[input?'data-match-target':'data-match-source']:e.key,'aria-label':(input?'选择接收输入 ':'选择输出来源 ')+e.canvasName+' / '+e.name,'aria-pressed':'false'});
   choose.replaceChildren();const top=el('span',{class:'sm-card-top'}),name=el('strong',{class:'sm-name'},e.name||(input?'未命名输入':'未命名输出')),value=el('span',{class:'sm-value'}),type=el('span',{class:'sm-kind'},kinds[e.kind]||'未定类型'),state=el('span',{class:'sm-card-state'}),reason=el('span',{class:'sm-card-reason'}),meta=el('span',{class:'sm-card-meta'});top.append(name,value);meta.append(type,state);choose.append(top,meta,reason);
   const jump=button('','定位',()=>locate(e),{class:'sm-locate','data-match-locate':e.canvasId+':'+e.nodeId,'aria-label':'定位 '+e.canvasName+' 的 '+e.name,title:e.canvasName+' · '+e.name+' ['+e.nodeId+']'});
   const port=input?el('span',{class:'sm-port sm-port-input','aria-hidden':'true'}):button('','',()=>selectSource(e.key),{class:'sm-port sm-port-output','data-match-drag-source':e.key,'aria-label':'从 '+e.name+' 拖线连接输入',title:'拖到右侧输入，或先点信号卡片'});
   if(input)choose.prepend(port);else port.addEventListener('pointerdown',event=>startDrag(event,e.key));wrap.append(choose,jump);if(!input)wrap.append(port);
   (input?inputCards:sourceCards).set(e.key,{wrap,choose,port,value,state,reason});return wrap;
  }
  function actualValue(e){return options.getFrame()?.canvases?.[e.canvasId]?.values?.[e.nodeId]?.OUT;}
  function paint(){
   const s=model.sources.get(selectedSource),counts={all:model.inputs.size,pending:[...model.inputs.values()].filter(e=>!e.binding&&!e.problem).length,connected:model.bindings.size,issues:model.index.issues.length};
   for(const[value,item]of filterButtons){item.button.textContent=item.label+(value==='all'?'':' '+counts[value]);item.button.setAttribute('aria-pressed',String(filter===value));}
   for(const[input,cards,entries]of [[false,sourceCards,model.sources],[true,inputCards,model.inputs]])for(const[k,view]of cards){const e=entries.get(k),paused=model.paused.get(k),incompatible=input&&s?incompatibility(s,e):'',already=input&&s&&e.binding&&key(e.binding.source)===s.key,staged=input&&targets.has(k),chosen=!input&&k===selectedSource,value=actualValue(e);
    view.wrap.className='sm-card'+(chosen||staged?' is-selected':'')+(input&&s&&!incompatible&&!already?' is-compatible':'')+(incompatible?' is-incompatible':'')+(e.problem?' has-problem':'')+(already?' is-connected':'');view.choose.setAttribute('aria-pressed',String(chosen||staged));view.choose.dataset.blocked=String(!!(input?incompatible:e.problem));view.choose.setAttribute('aria-description',input?incompatible:e.problem);
    view.value.textContent=paused||valueText(value);view.value.dataset.value=paused?'paused':typeof value==='boolean'?(value?'on':'off'):'number';view.state.textContent=input?(staged?'待应用':e.binding?'已连接 · '+e.binding.source.canvasName:paused?'依赖暂停（上游暂停）':'本地独立输入'):(e.problem?'来源冲突':model.index.bindings.some(b=>key(b.source)===k)?'已有接收端':'可作为来源');view.reason.textContent=e.problem||incompatible||(already?'已经接到这个输出，无需重复连接':staged?'将改名为“'+s.name+'”':input&&s?'点击接收此输出':'');
   }
   const stage=targets.size?2:s?1:0;stepItems.forEach((li,i)=>{li.classList.toggle('is-active',i===stage);li.classList.toggle('is-done',i<stage);if(i===stage)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
   instruction.textContent=targets.size?'已选择 '+targets.size+' 个接收输入，请核对后应用。':s?'现在点右侧要接收“'+s.name+'”的输入。':'第一步：选择左侧一个输出信号。';
   status.dataset.tone=messageTone;status.replaceChildren();
   if(message)status.textContent=message;else if(targets.size){status.append(el('strong',{},'将建立 '+targets.size+' 条连接'));for(const k of targets){const t=model.inputs.get(k);status.append(el('p',{},t.canvasName+' / '+t.name+' → 改名为“'+s.name+'”'));}}
   else if(focused){status.append(el('strong',{},'已连接：'+focused.source.canvasName+' / '+focused.name+' → '+focused.input.canvasName+' / '+focused.input.name),el('p',{},model.ranks.get(focused.source.canvasId)<model.ranks.get(focused.input.canvasId)?'按当前画布顺序，接收端读取来源本拍更新的值。':'按当前画布顺序，接收端读取来源上一拍的值。'));}
   else status.textContent=s?'来源已选：'+s.canvasName+' / '+s.name+'。点击右侧输入，可一次连接多个。':'选一个输出后，能接收它的输入会亮起。';
   note.textContent=targets.size?'应用时同步 INPUT 名称，建立同名关联；原输入波形保留。可用工程“撤销”恢复。':'实线是已有连接，虚线是待应用预览。点击连线查看两端，点击“定位”回到画布。';
   apply.disabled=!targets.size||options.isRunning();apply.textContent=options.isRunning()?'暂停模拟后可应用':targets.size===1?'应用这条连接':targets.size?'应用这 '+targets.size+' 条连接':'应用连接';clear.disabled=!s&&!targets.size&&!focused&&!message;scheduleWires();
  }
  function applyConnections(){
   try{if(options.isRunning())throw Error('请先暂停模拟，再应用连接');if(!targets.size||!selectedSource)throw Error('请先选择来源和接收输入');if(baseFingerprint!==E.fingerprints(options.getProject()).simulation)throw Error('工程已改变，请重新选择接收输入');const current=data(),s=current.sources.get(selectedSource);if(!s||s.problem)throw Error(s?.problem||'输出来源已改变');const inputs=[...targets].map(k=>{const t=current.inputs.get(k);if(!t)throw Error('接收输入已不存在');const reason=incompatibility(s,t);if(reason)throw Error(reason);return{canvasId:t.canvasId,nodeId:t.nodeId,oldName:t.name};});
    applying=true;options.renameInputs(inputs,{canvasId:s.canvasId,nodeId:s.nodeId});targets.clear();baseFingerprint=null;focused=null;model=data();modelStamp=stamp(model);message='已连接：'+s.canvasName+' / '+s.name+' → '+inputs.map(t=>model.p.canvases.find(c=>c.id===t.canvasId).name).join('、')+'。名称已同步，可以撤销。';messageTone='success';renderLists();dialog.querySelector('#match-close').focus({preventScroll:true});
   }catch(e){message=e.message;messageTone='error';paint();}finally{applying=false;}
  }
  function scheduleWires(){if(!dialog.open||frameRequest)return;frameRequest=requestAnimationFrame(()=>{frameRequest=0;drawWires();});}
  function point(view,output){if(!view)return null;const b=view.port.getBoundingClientRect(),m=map.getBoundingClientRect();return{x:b.left+b.width/2-m.left,y:b.top+b.height/2-m.top};}
  function drawWires(){
   if(!dialog.open)return;const previousFocus=wires.contains(doc.activeElement)?doc.activeElement.getAttribute('data-match-wire-input'):null,focusable=new Map();wires.setAttribute('width',map.clientWidth);wires.setAttribute('height',map.offsetHeight);wires.setAttribute('viewBox','0 0 '+map.clientWidth+' '+map.offsetHeight);wires.replaceChildren();
   const draw=(sourceKey,targetKey,mode,binding)=>{const a=point(sourceCards.get(sourceKey),true),b=targetKey?point(inputCards.get(targetKey),false):drag?.point;if(!a||!b)return;const bend=Math.max(24,(b.x-a.x)*.46),d='M'+a.x+','+a.y+' C'+(a.x+bend)+','+a.y+' '+(b.x-bend)+','+b.y+' '+b.x+','+b.y,g=svgEl('g',{'data-match-wire':mode,class:'sm-wire '+mode+(focused&&binding&&key(focused.input)===targetKey?' is-focused':'')+(mode==='connected'&&targets.has(targetKey)?' is-replaced':'')});
    if(binding){const label=binding.source.canvasName+' / '+binding.name+' → '+binding.input.canvasName+' / '+binding.input.name;g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('data-match-wire-input',targetKey);focusable.set(targetKey,g);g.setAttribute('aria-label','查看连接 '+label);const title=svgEl('title');title.textContent=label;g.append(title);const select=()=>{focused=binding;message='';messageTone='';paint();};g.addEventListener('click',select);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});g.append(svgEl('path',{d,class:'sm-wire-hit',fill:'none'}));}
    g.append(svgEl('path',{d,class:'sm-wire-line',fill:'none'}));wires.append(g);
   };
   for(const b of model.index.bindings)draw(key(b.source),key(b.input),'connected',b);if(selectedSource)for(const k of targets)draw(selectedSource,k,'draft');if(drag)draw(drag.source,null,'drag');if(previousFocus)(focusable.get(previousFocus)||dialog).focus({preventScroll:true});
  }
  function startDrag(event,k){
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();selectSource(k);const s=model.sources.get(k);if(s?.problem)return;const origin=event.currentTarget,m=map.getBoundingClientRect();origin.focus({preventScroll:true});drag={source:k,pointerId:event.pointerId,origin,point:{x:event.clientX-m.left,y:event.clientY-m.top}};origin.setPointerCapture(event.pointerId);origin.addEventListener('pointermove',moveDrag);origin.addEventListener('pointerup',dropDrag);origin.addEventListener('pointercancel',cancelDrag);scheduleWires();
  }
  function moveDrag(event){if(!drag||event.pointerId!==drag.pointerId)return;const m=map.getBoundingClientRect();drag.point={x:event.clientX-m.left,y:event.clientY-m.top};scheduleWires();}
  function dropDrag(event){if(!drag||event.pointerId!==drag.pointerId)return;const target=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-match-target]'),k=target?.dataset.matchTarget;endDrag();if(k&&map.contains(target))selectTarget(k);else paint();}
  function cancelDrag(){endDrag();paint();}
  function endDrag(){if(!drag)return;const{origin,pointerId}=drag;drag=null;origin.removeEventListener('pointermove',moveDrag);origin.removeEventListener('pointerup',dropDrag);origin.removeEventListener('pointercancel',cancelDrag);if(origin.hasPointerCapture(pointerId))origin.releasePointerCapture(pointerId);scheduleWires();}
  return{open,close,refresh,dialog};
 }
 root.LogicSignalMatching={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
