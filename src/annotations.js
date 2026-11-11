(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicAnnotations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const tools=['pen','rect','ellipse','text','eraser'],fontFamily='"Segoe UI","Microsoft YaHei",DengXian,SimHei,sans-serif';
 function mount(canvas){
  const doc=canvas.ownerDocument,ctx=canvas.getContext('2d',{willReadFrequently:true}),cursor=doc.createElement('div'),editor=doc.createElement('textarea');
  cursor.className='annotation-cursor';cursor.setAttribute('aria-hidden','true');cursor.hidden=true;cursor.style.left=cursor.style.top='0px';
  editor.id='annotation-text-editor';editor.className='annotation-text-editor';editor.setAttribute('aria-label','标注文本');editor.setAttribute('wrap','off');editor.placeholder='输入文字，Ctrl+Enter完成，Esc取消';editor.hidden=true;canvas.tabIndex=-1;canvas.after(cursor,editor);
  const styles=Object.fromEntries(['pen','rect','ellipse','text'].map(tool=>[tool,{color:'#dc2626',width:4,fontSize:20}]));
  let mode='select',eraserMode='local',eraserSize=24,gesture=null,textDraft=null,cssWidth=0,cssHeight=0,ratio=1,operations=[],serial=0,scratch=null,frame=0,cursorLook='';
  const alphaTiles=new Map(),tileSize=64,alphaLimit=2*1024*1024;let alphaBytes=0;
  const style=tool=>styles[tool]||styles.pen,intersects=(a,b)=>a&&b&&a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
  const union=(a,b)=>!a?b:!b?a:{left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)};
  function clip(area){const result={left:Math.max(0,Math.floor(area.left)),top:Math.max(0,Math.floor(area.top)),right:Math.min(cssWidth,Math.ceil(area.right)),bottom:Math.min(cssHeight,Math.ceil(area.bottom))};return result.right>result.left&&result.bottom>result.top?result:null;}
  function physical(area){const x=Math.floor(area.left*ratio),y=Math.floor(area.top*ratio);return{x,y,w:Math.min(canvas.width,Math.ceil(area.right*ratio))-x,h:Math.min(canvas.height,Math.ceil(area.bottom*ratio))-y};}
  function invalidateAlpha(area){for(const[key,tile]of alphaTiles)if(!area||intersects(tile.bounds,area)){alphaBytes-=tile.data.data.byteLength;alphaTiles.delete(key);}}
  // A bounded cache of current visible pixels makes repeated erasing of a hole cheap.
  function hasInk(area){
   for(let ty=Math.floor(area.top/tileSize);ty*tileSize<area.bottom;ty++)for(let tx=Math.floor(area.left/tileSize);tx*tileSize<area.right;tx++){
    const key=tx+':'+ty;let tile=alphaTiles.get(key);
    if(!tile){const bounds=clip({left:tx*tileSize,top:ty*tileSize,right:(tx+1)*tileSize,bottom:(ty+1)*tileSize}),p=physical(bounds);tile={bounds,...p,data:ctx.getImageData(p.x,p.y,p.w,p.h)};const bytes=tile.data.data.byteLength;if(bytes<=alphaLimit){while(alphaBytes+bytes>alphaLimit&&alphaTiles.size){const oldest=alphaTiles.keys().next().value;alphaBytes-=alphaTiles.get(oldest).data.data.byteLength;alphaTiles.delete(oldest);}alphaTiles.set(key,tile);alphaBytes+=bytes;}}
    else{alphaTiles.delete(key);alphaTiles.set(key,tile);}
    const left=Math.max(tile.x,Math.floor(area.left*ratio)),top=Math.max(tile.y,Math.floor(area.top*ratio)),right=Math.min(tile.x+tile.w,Math.ceil(area.right*ratio)),bottom=Math.min(tile.y+tile.h,Math.ceil(area.bottom*ratio)),bytes=tile.data.data;
    for(let y=top;y<bottom;y++)for(let i=((y-tile.y)*tile.w+left-tile.x)*4+3,end=((y-tile.y)*tile.w+right-tile.x)*4;i<end;i+=4)if(bytes[i])return true;
   }return false;
  }
  function draw(target,op){
   target.save();target.globalCompositeOperation=op.kind==='erase'?'destination-out':'source-over';target.strokeStyle=target.fillStyle=op.color;target.lineWidth=op.width;target.lineCap=target.lineJoin='round';
   if(op.kind==='text'){target.font=op.fontSize+'px '+fontFamily;target.textBaseline='top';op.text.split('\n').forEach((line,i)=>target.fillText(line,op.x,op.y+i*op.fontSize*1.35));}
   else if(op.kind==='rect'||op.kind==='ellipse'){
    const x=Math.min(op.a.x,op.b.x),y=Math.min(op.a.y,op.b.y),w=Math.abs(op.b.x-op.a.x),h=Math.abs(op.b.y-op.a.y);target.beginPath();
    if(op.kind==='rect')target.rect(x,y,w,h);else if(w&&h)target.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else{target.moveTo(op.a.x,op.a.y);target.lineTo(op.b.x,op.b.y);}target.stroke();
   }else if(op.points?.length){
    target.beginPath();const first=op.points[0];if(op.points.length===1){target.arc(first.x,first.y,op.width/2,0,Math.PI*2);target.fill();}else{target.moveTo(first.x,first.y);for(let i=1;i<op.points.length;i++)target.lineTo(op.points[i].x,op.points[i].y);target.stroke();}
   }
   target.restore();
  }
  function repaint(dirty){
   const area=clip(dirty||{left:0,top:0,right:cssWidth,bottom:cssHeight});if(!area)return;const p=physical(area);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(p.x,p.y,p.w,p.h);ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();ctx.setTransform(ratio,0,0,ratio,0,0);for(const op of operations)if(!dirty||intersects(op.bounds,area))draw(ctx,op);ctx.restore();invalidateAlpha(dirty?area:null);
  }
  function restorePreview(g,area){const region=area&&clip(area);if(!region)return;const p=physical(region);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(p.x,p.y,p.w,p.h);ctx.drawImage(g.base,p.x,p.y,p.w,p.h,p.x,p.y,p.w,p.h);ctx.restore();invalidateAlpha(region);}
  function flushGesture(){
   const g=gesture;if(!g)return;
   if(g.mode==='rect'||g.mode==='ellipse'){restorePreview(g,union(g.previewBounds,g.op.bounds));draw(ctx,g.op);g.previewBounds={...g.op.bounds};}
   else if(g.pending?.length){const points=g.pending.splice(0),segments=[];let previous=g.processed||points[0];for(const point of points){segments.push([previous,point]);previous=point;}g.processed=previous;eraseWhole(segments);}
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;flushGesture();});}
  function finish(){
   if(!gesture)return;if(frame){cancelAnimationFrame(frame);frame=0;}flushGesture();const g=gesture,{id,op}=g;gesture=null;if(op&&(op.kind==='rect'||op.kind==='ellipse')&&Math.abs(op.a.x-op.b.x)+Math.abs(op.a.y-op.b.y)<2){operations=operations.filter(item=>item!==op);restorePreview(g,g.previewBounds);}
   if(g.base)g.base.width=g.base.height=1;
   if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);if(scratch)scratch.width=scratch.height=1;
  }
  function resize(){if(!cssWidth&&!tools.includes(mode))return;finish();const w=innerWidth,h=innerHeight,dpr=devicePixelRatio||1;if(w===cssWidth&&h===cssHeight&&dpr===ratio)return;cssWidth=w;cssHeight=h;ratio=dpr;canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);repaint();}
  function append(op,p){if(!op)return;const last=op.points.at(-1);if(last&&last.x===p.x&&last.y===p.y)return;op.points.push(p);const pad=op.width/2+1,b=op.bounds;op.bounds=b?{left:Math.min(b.left,p.x-pad),top:Math.min(b.top,p.y-pad),right:Math.max(b.right,p.x+pad),bottom:Math.max(b.bottom,p.y+pad)}:{left:p.x-pad,top:p.y-pad,right:p.x+pad,bottom:p.y+pad};}
  function shapePoint(op,p,constrain){
   if(constrain){const dx=p.x-op.a.x,dy=p.y-op.a.y,size=Math.max(Math.abs(dx),Math.abs(dy));p={x:op.a.x+(dx<0?-size:size),y:op.a.y+(dy<0?-size:size)};}
   op.b=p;const pad=op.width/2+1;op.bounds={left:Math.min(op.a.x,p.x)-pad,top:Math.min(op.a.y,p.y)-pad,right:Math.max(op.a.x,p.x)+pad,bottom:Math.max(op.a.y,p.y)+pad};schedule();
  }
  function finishText(commit){
   if(!textDraft)return;const draft=textDraft,text=editor.value.replace(/\r\n?/g,'\n');textDraft=null;editor.hidden=true;editor.value='';
   if(commit&&text.trim()){
    const op={id:++serial,kind:'text',...draft,text};ctx.save();ctx.font=op.fontSize+'px '+fontFamily;const w=Math.max(...text.split('\n').map(line=>ctx.measureText(line).width)),pad=op.fontSize*.4;ctx.restore();
    op.bounds={left:op.x-pad,top:op.y-pad,right:op.x+w+pad,bottom:op.y+text.split('\n').length*op.fontSize*1.35+pad};operations.push(op);draw(ctx,op);invalidateAlpha(op.bounds);
   }
  }
  function startText(p){
   finishText(true);const current=style('text'),left=Math.max(4,Math.min(p.x,innerWidth-180)),top=Math.max(4,Math.min(p.y,innerHeight-130));textDraft={x:left+6,y:top+6,color:current.color,fontSize:current.fontSize};
   editor.style.left=left+'px';editor.style.top=top+'px';editor.style.width=Math.min(340,innerWidth-left-8)+'px';editor.style.font=current.fontSize+'px '+fontFamily;editor.style.lineHeight='1.35';editor.style.color=current.color;editor.hidden=false;editor.focus({preventScroll:true});
  }
  editor.addEventListener('blur',()=>finishText(true));editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishText(false);canvas.focus({preventScroll:true});}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();finishText(true);canvas.focus({preventScroll:true});}});
  // Hit-test visible ink, not the bounding rectangle; local gaps remain erased.
  function eraseWhole(segments){
   const removed=new Set();let dirty=null;
   for(const[a,b]of segments){
    const area=clip({left:Math.min(a.x,b.x)-13,top:Math.min(a.y,b.y)-13,right:Math.max(a.x,b.x)+13,bottom:Math.max(a.y,b.y)+13});if(!area||!hasInk(area))continue;
    const nearby=operations.filter(op=>intersects(op.bounds,area)),erasures=nearby.filter(op=>op.kind==='erase');
    for(const op of nearby){
     if(op.kind==='erase'||removed.has(op.id))continue;const left=Math.max(area.left,Math.floor(op.bounds.left)),top=Math.max(area.top,Math.floor(op.bounds.top)),right=Math.min(area.right,Math.ceil(op.bounds.right)),bottom=Math.min(area.bottom,Math.ceil(op.bounds.bottom));if(right<=left||bottom<=top)continue;
     scratch??=doc.createElement('canvas');const w=Math.max(1,Math.ceil((right-left)*ratio)),h=Math.max(1,Math.ceil((bottom-top)*ratio));if(scratch.width!==w)scratch.width=w;if(scratch.height!==h)scratch.height=h;
     const hit=scratch.getContext('2d',{willReadFrequently:true});hit.setTransform(1,0,0,1,0,0);hit.globalCompositeOperation='source-over';hit.clearRect(0,0,w,h);hit.setTransform(ratio,0,0,ratio,-left*ratio,-top*ratio);draw(hit,{...op,color:'#000'});
     for(const later of erasures)if(later.id>op.id)draw(hit,later);
     hit.globalCompositeOperation='destination-in';hit.lineWidth=24;hit.lineCap='round';hit.lineJoin='round';hit.strokeStyle=hit.fillStyle='#000';hit.beginPath();if(a.x===b.x&&a.y===b.y){hit.arc(a.x,a.y,12,0,Math.PI*2);hit.fill();}else{hit.moveTo(a.x,a.y);hit.lineTo(b.x,b.y);hit.stroke();}
     const pixels=hit.getImageData(0,0,w,h).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){removed.add(op.id);dirty=union(dirty,op.bounds);break;}
    }
   }
   if(removed.size){operations=operations.filter(op=>!removed.has(op.id));const first=operations.findIndex(op=>op.kind!=='erase');operations=first<0?[]:operations.slice(first);repaint(dirty);}
  }
  function cursorAt(e){
   if(!['pen','eraser'].includes(mode)){cursor.hidden=true;return;}const size=mode==='eraser'?(eraserMode==='local'?eraserSize:24):Math.max(6,style('pen').width),color=mode==='eraser'?'#64748b':style('pen').color,look=size+'|'+color;cursor.hidden=false;if(cursorLook!==look){cursor.style.width=cursor.style.height=size+'px';cursor.style.borderColor=color;cursorLook=look;}cursor.style.transform='translate3d('+e.clientX+'px,'+e.clientY+'px,0) translate(-50%,-50%)';
  }
  function paint(a,b,dot=false){
   if(gesture.mode==='eraser'&&gesture.eraserMode==='stroke'){const previous=gesture.pending.at(-1)||gesture.processed;if(!previous||previous.x!==b.x||previous.y!==b.y){gesture.pending.push(b);schedule();}return;}
   draw(ctx,{kind:gesture.mode==='eraser'?'erase':'pen',color:gesture.color,width:gesture.mode==='eraser'?gesture.eraserWidth:gesture.width,points:dot?[b]:[a,b]});const pad=(gesture.mode==='eraser'?gesture.eraserWidth:gesture.width)/2+1;invalidateAlpha({left:Math.min(a.x,b.x)-pad,top:Math.min(a.y,b.y)-pad,right:Math.max(a.x,b.x)+pad,bottom:Math.max(a.y,b.y)+pad});
  }
  canvas.addEventListener('pointerdown',e=>{
   if(!tools.includes(mode)||e.button!==0||gesture)return;e.preventDefault();e.stopPropagation();const p={x:e.clientX,y:e.clientY};if(mode==='text'){startText(p);return;}canvas.setPointerCapture(e.pointerId);const current=style(mode);
   if(mode==='rect'||mode==='ellipse'){const base=doc.createElement('canvas');base.width=canvas.width;base.height=canvas.height;base.getContext('2d',{willReadFrequently:true}).drawImage(canvas,0,0);const op={id:++serial,kind:mode,...current,a:p,b:p,bounds:null};operations.push(op);gesture={id:e.pointerId,mode,op,base,previewBounds:null};shapePoint(op,p,e.shiftKey);return;}
   const op=mode==='pen'||eraserMode==='local'?{id:++serial,kind:mode==='pen'?'pen':'erase',color:current.color,width:mode==='pen'?current.width:eraserSize,points:[],bounds:null}:null;if(op){append(op,p);operations.push(op);}gesture={id:e.pointerId,mode,eraserMode,...current,eraserWidth:eraserMode==='local'?eraserSize:24,last:p,op,pending:[],processed:null};paint(p,p,true);cursorAt(e);
  });
  canvas.addEventListener('pointermove',e=>{
   if(!tools.includes(mode))return;e.preventDefault();cursorAt(e);if(!gesture||e.pointerId!==gesture.id)return;if(['rect','ellipse'].includes(gesture.mode)){shapePoint(gesture.op,{x:e.clientX,y:e.clientY},e.shiftKey);return;}
   const samples=e.getCoalescedEvents?.()||[];for(const event of samples.length?samples:[e]){const p={x:event.clientX,y:event.clientY};append(gesture.op,p);paint(gesture.last,p);gesture.last=p;}
  });
  canvas.addEventListener('pointerup',e=>{if(gesture?.id!==e.pointerId)return;const p={x:e.clientX,y:e.clientY};if(['rect','ellipse'].includes(gesture.mode))shapePoint(gesture.op,p,e.shiftKey);else{append(gesture.op,p);paint(gesture.last,p);}finish();});
  canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);canvas.addEventListener('pointerleave',()=>cursor.hidden=true);canvas.addEventListener('contextmenu',e=>e.preventDefault());addEventListener('resize',resize);addEventListener('blur',()=>{finish();finishText(true);});canvas.width=canvas.height=1;canvas.dataset.eraserMode=eraserMode;canvas.dataset.eraserSize=String(eraserSize);
  return{
   setMode(next){if(mode===next)return;finish();finishText(true);mode=next;resize();canvas.dataset.mode=next;canvas.classList.toggle('annotation-active',tools.includes(next));cursor.hidden=true;},
   setEraserMode(next){if(!['local','stroke'].includes(next))return;finish();eraserMode=next;canvas.dataset.eraserMode=next;cursor.hidden=true;},
   setEraserSize(next){if(!Number.isFinite(Number(next)))return;finish();eraserSize=Math.max(4,Math.min(120,Math.round(Number(next))));canvas.dataset.eraserSize=String(eraserSize);cursor.hidden=true;},
   setColor(next,tool='pen'){if(/^#[\da-f]{6}$/i.test(next))style(tool).color=next;},
   setWidth(next,tool='pen'){if(Number.isFinite(Number(next))&&Number(next)>0)style(tool).width=Number(next);},
   setFontSize(next){if(Number.isFinite(Number(next)))styles.text.fontSize=Math.max(8,Math.min(96,Math.round(Number(next))));return styles.text.fontSize;}
  };
 }
 return{mount};
});
