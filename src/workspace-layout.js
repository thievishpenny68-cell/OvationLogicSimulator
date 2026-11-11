(function(){
 'use strict';
 const main=document.querySelector('main'),results=document.querySelector('.results'),splitter=document.getElementById('workspace-splitter');
 // Layout is display state: keep the existing form DOM, drafts and simulation intact.
 for(const side of ['library','inspector']){
  const panel=document.querySelector('.'+side),button=document.getElementById(side+'-toggle'),content=document.getElementById(button.getAttribute('aria-controls')),title=panel.querySelector('.panel-title').textContent;
  button.onclick=()=>{const collapsed=panel.classList.toggle('sidebar-collapsed');main.classList.toggle(side+'-collapsed',collapsed);content.hidden=collapsed;if(collapsed)panel.scrollTop=0;button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',(collapsed?'展开':'收起')+title);button.title=button.getAttribute('aria-label');button.textContent=side==='library'?(collapsed?'›':'‹'):(collapsed?'‹':'›');window.dispatchEvent(new Event('resize'));};
 }
 let height=null,gesture=null;
 function bounds(){const top=document.getElementById('source-panel').classList.contains('hidden')?140:260;return{min:Math.ceil(results.querySelector('.results-head').getBoundingClientRect().height)+2,max:Math.max(40,main.clientHeight-top-1)};}
 function apply(next){
  const b=bounds();height=Math.max(b.min,Math.min(b.max,next));main.style.gridTemplateRows='minmax(0, 1fr) '+height+'px';
  main.classList.toggle('results-minimized',height<b.min+45);splitter.setAttribute('aria-valuemin',String(b.min));splitter.setAttribute('aria-valuemax',String(b.max));splitter.setAttribute('aria-valuenow',String(Math.round(height)));window.dispatchEvent(new Event('resize'));
 }
 function auto(){height=null;main.style.gridTemplateRows='';main.classList.remove('results-minimized');splitter.removeAttribute('aria-valuenow');window.dispatchEvent(new Event('resize'));}
 function finish(cancel=false){if(!gesture)return;const previous=gesture.previous,id=gesture.id;gesture=null;document.body.classList.remove('resizing-results');if(splitter.hasPointerCapture(id))splitter.releasePointerCapture(id);if(cancel){if(previous===null)auto();else apply(previous);}}
 splitter.onpointerdown=e=>{if(e.button!==0||gesture)return;e.preventDefault();splitter.focus();gesture={id:e.pointerId,y:e.clientY,start:results.getBoundingClientRect().height,previous:height};splitter.setPointerCapture(e.pointerId);document.body.classList.add('resizing-results');};
 splitter.onpointermove=e=>{if(gesture&&gesture.id===e.pointerId)apply(gesture.start+gesture.y-e.clientY);};
 splitter.onpointerup=()=>finish();splitter.onpointercancel=()=>finish(true);splitter.onlostpointercapture=()=>finish(true);splitter.ondblclick=auto;
 window.addEventListener('blur',()=>finish(true));
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){e.preventDefault();e.stopImmediatePropagation();finish(true);}},true);
 splitter.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();apply((height??results.getBoundingClientRect().height)+(e.key==='ArrowUp'?20:-20));}else if(e.key==='Home'){e.preventDefault();apply(bounds().max);}else if(e.key==='End'){e.preventDefault();apply(bounds().min);}else if(e.key==='Enter'){e.preventDefault();auto();}};
 // Observe the available workspace, not row heights (avoids resize feedback).
 new ResizeObserver(()=>{if(height!==null)apply(height);}).observe(main);
 new MutationObserver(()=>{if(height!==null)apply(height);}).observe(document.getElementById('source-panel'),{attributes:true,attributeFilter:['class']});
})();
