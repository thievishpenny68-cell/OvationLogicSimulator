(function(root){'use strict';
 const C=root.LogicCore,E=root.LogicEngineering,K=root.LogicSymbols,W=root.LogicWireDisplay,S=root.LogicScopes,NS='http://www.w3.org/2000/svg';
 const svg=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 const html=(tag,attrs={},text)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 function mount(options){
  const workspace=document.querySelector('.canvas-workspace'),board=html('div',{id:'parallel-canvases',hidden:'','aria-label':'并列画布'}),controls=html('div',{class:'engineering-control-group',role:'group','aria-label':'画布显示'}),toggle=html('button',{id:'canvas-parallel',type:'button','aria-pressed':'false'},'并列显示'),equalize=html('button',{id:'canvas-equalize',type:'button',hidden:''},'均分尺寸');
  document.querySelector('.engineering-controls').append(controls);controls.append(toggle,equalize);workspace.after(board);
  let enabled=false,activeId=null,documentKey=null,resize=null,scopeRevision=-1,scope=null,serial=0;const tiles=new Map();
  const observer=new ResizeObserver(()=>options.resize());observer.observe(workspace);
  function releasePreview(tile){for(const plot of tile.scopeLayer?.querySelectorAll('.scope-plot')||[])root.LogicSignalChart.release(plot);tile.scopeLayer=null;tile.preview=null;}
  function setEnabled(value){options.beforeViewChange();enabled=value;toggle.setAttribute('aria-pressed',String(value));toggle.textContent=value?'单画布显示':'并列显示';board.hidden=!value;equalize.hidden=!value;if(!value){board.before(workspace);for(const tile of tiles.values()){releasePreview(tile);tile.body.replaceChildren();}}refresh();if(value)distribute();options.resize();}
  toggle.onclick=()=>setEnabled(!enabled);equalize.onclick=distribute;
  function distribute(){if(!enabled)return;const count=tiles.size,width=Math.max(240,(board.clientWidth-12*(count-1)-16)/count),height=Math.max(160,board.clientHeight-16);for(const tile of tiles.values()){tile.element.style.width=width+'px';tile.element.style.height=height+'px';}options.resize();}
  function finishResize(cancel=false){if(!resize)return;const r=resize;resize=null;if(cancel){r.tile.element.style.width=r.width+'px';r.tile.element.style.height=r.height+'px';}if(r.handle.hasPointerCapture(r.pointerId))r.handle.releasePointerCapture(r.pointerId);options.resize();}
  function makeTile(canvas){
   const element=html('section',{'data-canvas-tile':canvas.id,class:'canvas-tile','aria-label':canvas.name}),head=html('div',{class:'canvas-tile-head'}),name=html('button',{class:'canvas-tile-name',type:'button'}),state=html('span',{class:'canvas-tile-state'}),body=html('div',{class:'canvas-tile-body',tabindex:'0'}),handle=html('button',{class:'canvas-tile-resize',type:'button','aria-label':'调整 '+canvas.name+' 尺寸',title:'拖动调整宽高；方向键调整；Esc取消'},'◢');
   element.append(head,body,handle);head.append(name,state);const tile={element,name,state,body,handle,project:null,revision:-1,values:[],wires:[],preview:null,scopeLayer:null};
   const activate=e=>{if(canvas.id===options.getActiveCanvas())return;if(e?.target.closest('.canvas-tile-resize'))return;const hit=e?.target.closest('[data-preview-node]');options.activate(canvas.id,hit?.dataset.previewNode);};
   name.onclick=activate;body.onpointerdown=activate;body.onkeydown=e=>{if(e.target===body&&e.key==='Enter'){e.preventDefault();activate(e);}};
   handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const box=element.getBoundingClientRect();resize={tile,handle,pointerId:e.pointerId,x:e.clientX,y:e.clientY,width:box.width,height:box.height};handle.focus();handle.setPointerCapture(e.pointerId);};
   handle.onpointermove=e=>{if(!resize||resize.handle!==handle||resize.pointerId!==e.pointerId)return;element.style.width=Math.max(240,resize.width+e.clientX-resize.x)+'px';element.style.height=Math.max(160,resize.height+e.clientY-resize.y)+'px';options.resize();};
   handle.onpointerup=e=>{if(resize?.pointerId===e.pointerId)finishResize();};handle.onpointercancel=()=>finishResize(true);handle.onlostpointercapture=()=>{if(resize?.handle===handle)finishResize(true);};
   handle.onkeydown=e=>{if(e.key==='Escape'&&resize){e.preventDefault();e.stopPropagation();finishResize(true);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const b=element.getBoundingClientRect(),step=e.shiftKey?40:16;element.style.width=Math.max(240,b.width+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))+'px';element.style.height=Math.max(160,b.height+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))+'px';options.resize();};
   return tile;
  }
  function buildPreview(tile,canvas){
   releasePreview(tile);
   const p=canvas.project,geometries=new Map(p.nodes.map(n=>[n.id,K.geometry(n,C.ports(n))])),view=svg('svg',{class:'canvas-preview','aria-label':canvas.name+'，点击激活编辑',preserveAspectRatio:'xMidYMid meet'}),defs=svg('defs'),patternId='tile-grid-'+(++serial),pattern=svg('pattern',{id:patternId,width:24,height:24,patternUnits:'userSpaceOnUse'});pattern.append(svg('circle',{cx:1,cy:1,r:.8,class:'preview-grid-dot'}));defs.append(pattern);view.append(defs,svg('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#'+patternId+')',class:'preview-grid'}));tile.values=[];tile.wires=[];
   const boxes=p.nodes.map(n=>({x:n.x,y:n.y,width:geometries.get(n.id).width,height:geometries.get(n.id).height})).concat((p.scopes||[]).map(S.bounds));
   const titleLayer=svg('g');view.append(titleLayer);
   if(p.titleBlock)try{const title=root.LogicSheetTitleBlock.render(titleLayer,p.titleBlock,p.paper||root.LogicPaper.initial(boxes),root.LogicSourcePreview.sanitize,DOMParser);if(title?.box)boxes.push(title.box);}catch{}
   const nodeMap=new Map(p.nodes.map(n=>[n.id,n])),point=(n,port,dir)=>{const g=geometries.get(n.id),pin=g.ports[dir][port];return pin?{...pin,x:n.x+pin.x,y:n.y+pin.y}:null;},obstacles=boxes.map((b,i)=>({...b,id:p.nodes[i]?.id}));
   const groups=new Map();p.edges.forEach((edge,index)=>{const key=JSON.stringify([edge.from,edge.fromPort]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({edge,index});});
   for(const entries of groups.values()){
    const first=entries[0].edge,from=nodeMap.get(first.from),start=from&&point(from,first.fromPort,'outputs');if(!start)continue;
    const targets=entries.map(({edge,index})=>{const n=nodeMap.get(edge.to),end=n&&point(n,edge.toPort,'inputs');return end?{index,toId:n.id,toPort:edge.toPort,routing:edge.routing,point:end}:null;}).filter(Boolean);if(!targets.length)continue;
    const net=root.LogicWireNetworks.route(start,targets,{obstacles,occupied:[],fromId:from.id}),kind=C.ports(from).outputs[first.fromPort]||'unknown';
    for(const stroke of net.strokes){const path=svg('path',{d:stroke.path,class:'wire','vector-effect':'non-scaling-stroke'});view.append(path);tile.wires.push({element:path,nodeId:from.id,port:first.fromPort,kind});}
   }
   for(const candidate of p.connectionCandidates||[])if(candidate.status==='pending')for(const segment of candidate.segments||[])if(Array.isArray(segment.points)&&segment.points.length)view.append(svg('path',{d:segment.points.map((q,i)=>(i?'L':'M')+q.x+' '+q.y).join(' '),class:'unresolved-wire'}));
   for(const n of p.nodes){
    const shape=geometries.get(n.id),g=svg('g',{'data-preview-node':n.id,'data-node-type':n.type,'data-symbol-source':K.sourceLabel(shape),...(shape.source?.variant?{'data-symbol-variant':shape.source.variant}:{}),transform:'translate('+n.x+','+n.y+')',class:'logic-node'});g.append(svg('rect',{width:shape.width,height:shape.height,class:'node-hit'}));K.render(g,shape,svg);const value=svg('text',{x:shape.width-8,y:shape.height-28,'text-anchor':'end',class:'node-value'});g.append(svg('text',{x:13,y:19,class:'node-title'},n.type),svg('text',{x:13,y:shape.height-10,class:'node-subtitle'},n.name),value);
    for(const [dir,ports]of Object.entries(C.ports(n)))if(['inputs','outputs'].includes(dir))for(const[name,kind]of Object.entries(ports)){const pin=shape.ports[dir][name];if(!pin)continue;const terminal=K.terminal(kind,pin);g.append(svg(terminal.tag,{...terminal.attrs,class:'port '+kind}));if(pin.label)g.append(svg('text',{x:pin.label.x,y:pin.label.y,'text-anchor':pin.label.anchor,'dominant-baseline':shape.manual?'central':'auto',class:'port-label'+(shape.manual?' manual-pin-label':''),...(pin.label.rotation?{transform:'rotate('+pin.label.rotation+' '+pin.label.x+' '+pin.label.y+')'}:{})},pin.label.text));}
    view.append(g);tile.values.push({element:value,group:g,nodeId:n.id,port:C.catalog[n.type]?.primaryOutput||'OUT',kind:C.valueTypes(n)[C.catalog[n.type]?.primaryOutput||'OUT'],disabled:n.disabled===true});
   }
   tile.scopeLayer=svg('g');view.append(tile.scopeLayer);
   if(boxes.length){const x=Math.min(...boxes.map(b=>b.x))-65,y=Math.min(...boxes.map(b=>b.y))-55,right=Math.max(...boxes.map(b=>b.x+b.width))+65,bottom=Math.max(...boxes.map(b=>b.y+b.height))+55;view.setAttribute('viewBox',[x,y,Math.max(100,right-x),Math.max(100,bottom-y)].join(' '));}
   else{view.setAttribute('viewBox','0 0 600 300');view.append(svg('text',{x:300,y:150,'text-anchor':'middle',class:'canvas-preview-empty'},'空白画布 · 点击后添加模块'));}
   tile.preview=view;tile.body.replaceChildren(view);tile.project=p;tile.revision=options.getRevision();
  }
  function refresh(){
   const project=options.getProject(),id=options.getActiveCanvas(),canvases=project.canvases;
   toggle.disabled=canvases.length<2;
   const key=options.getDocumentKey();if(key!==documentKey){documentKey=key;scopeRevision=-1;if(workspace.parentNode!==board.parentNode)board.before(workspace);for(const tile of tiles.values()){releasePreview(tile);tile.element.remove();}tiles.clear();}
   if(enabled&&canvases.length<2){enabled=false;toggle.setAttribute('aria-pressed','false');toggle.textContent='并列显示';equalize.hidden=true;board.hidden=true;board.before(workspace);for(const tile of tiles.values()){releasePreview(tile);tile.body.replaceChildren();}}
   if(!enabled)return;
   const valid=new Set(canvases.map(c=>c.id));for(const[cid,tile]of tiles)if(!valid.has(cid)){if(workspace.parentNode===tile.body)board.before(workspace);releasePreview(tile);tile.element.remove();tiles.delete(cid);}
   if(scopeRevision!==options.getRevision()){scope=E.scope(project);scopeRevision=options.getRevision();}
   const disabled=new Set(scope.disabled),suspended=new Set(scope.suspended);let created=false;
   for(const[index,canvas]of canvases.entries()){
    let tile=tiles.get(canvas.id);if(!tile){tile=makeTile(canvas);tiles.set(canvas.id,tile);created=true;}
    if(board.children[index]!==tile.element)board.insertBefore(tile.element,board.children[index]||null);
    tile.name.textContent=(index+1)+'. '+canvas.name;tile.element.setAttribute('aria-label',canvas.name);tile.element.classList.toggle('is-active',canvas.id===id);tile.state.textContent=canvas.id===id?'编辑中':'点击激活编辑';tile.handle.setAttribute('aria-label','调整 '+canvas.name+' 尺寸');
    if(canvas.id===id){if(workspace.parentNode!==tile.body){releasePreview(tile);tile.body.replaceChildren(workspace);}tile.name.setAttribute('aria-pressed','true');}
    else{
     tile.name.setAttribute('aria-pressed','false');if(!tile.preview||tile.project!==canvas.project||tile.revision!==options.getRevision())buildPreview(tile,canvas);
     const frame=options.getFrame(canvas.id);
     for(const v of tile.values){
      const key=E.nodeKey(canvas.id,v.nodeId),reason=disabled.has(key)?'已禁用':suspended.has(key)?'依赖暂停':'',value=frame?.values?.[v.nodeId]?.[v.port];
      const quality=reason||value===undefined||v.kind==='packed16'?'GOOD':C.signalQuality.read(frame,v.nodeId,v.port);
      const display=reason||(typeof value==='boolean'?(value?'TRUE':'FALSE'):typeof value==='number'?W.describe(v.kind,value).text:'—');
      const text=quality==='GOOD'?display:display+' · '+quality;
      if(v.element.textContent!==text)v.element.textContent=text;
      v.group.setAttribute('data-execution-state',reason==='已禁用'?'disabled':reason?'suspended':'active');
      v.group.setAttribute('class','logic-node'+(reason==='已禁用'?' execution-disabled':reason?' dependency-suspended':''));
     }
     for(const wire of tile.wires){const state=disabled.has(E.nodeKey(canvas.id,wire.nodeId))||suspended.has(E.nodeKey(canvas.id,wire.nodeId))?'inactive':W.describe(wire.kind,frame?.values?.[wire.nodeId]?.[wire.port]).state;wire.element.setAttribute('class','wire '+wire.kind+' '+state);}
     if(canvas.project.scopes?.length){S.render(tile.scopeLayer,canvas.project,options.getFrames(canvas.id),options.getCursor(),{change:()=>{},remove:()=>{},select:()=>{},connect:()=>{}});for(const panel of tile.scopeLayer.querySelectorAll('.scope-panel'))panel.inert=true;}
    }
   }
   activeId=id;if(created)distribute();
  }
  return{refresh,close:()=>setEnabled(false)};
 }
 root.LogicCanvasWorkspace={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
