(function(root){'use strict';
 const E=root.LogicEngineering;
 function mount(options){
  const doc=document,$=id=>doc.getElementById(id),el=(tag,attrs={},text)=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  const bar=el('div',{id:'engineering-bar',class:'engineering-bar'}),head=el('div',{class:'engineering-head'}),title=el('input',{id:'engineering-title','aria-label':'工程名称',placeholder:'工程名称'}),tabs=el('div',{id:'canvas-tabs',role:'tablist','aria-label':'工程画布，按从左到右顺序扫描'}),controls=el('div',{class:'engineering-controls'});
  head.append(el('span',{},'工程'),title);bar.append(head,tabs,controls);doc.querySelector('.canvas-panel').prepend(bar);
  const button=(id,label,handler)=>{const b=el('button',{id,type:'button'},label);b.onclick=handler;return b;};
  const group=(id,label)=>el('div',{id,class:'engineering-control-group',role:'group','aria-label':label}),management=group('canvas-management','画布增删'),priority=group('canvas-priority','扫描优先级'),files=group('canvas-files','画布文件');
  management.append(button('canvas-add','＋画布',options.addCanvas),button('canvas-delete','删除画布',options.deleteCanvas));
  priority.append(button('canvas-left','优先级＋',()=>options.moveCanvas(-1)),button('canvas-right','优先级－',()=>options.moveCanvas(1)));
  priority.querySelector('#canvas-left').title='提高优先级：向前移动，扫描时更早执行';priority.querySelector('#canvas-right').title='降低优先级：向后移动，扫描时更晚执行';
  const importTarget=el('select',{id:'engineering-import-target','aria-label':'Control Sheet导入目标'});importTarget.append(el('option',{value:'current'},'导入当前画布'),el('option',{value:'new'},'导入新画布'));files.append($('import'),importTarget);
  controls.append(management,files,priority,button('signal-matching','信号匹配',()=>matching.open()));
  title.onchange=()=>options.renameProject(title.value);
  const matching=LogicSignalMatching.mount(options);let signature='',editing=null;
  function renameTab(canvas,b){
   if(options.isRunning())return;
   if(editing)editing.finish(false);
   const input=el('input',{'data-canvas-rename':canvas.id,'aria-label':'画布名称',type:'text',value:canvas.name}),entry={finish};editing=entry;b.hidden=true;b.after(input);
   function finish(commit,blur=false){
    if(editing!==entry)return;
    const value=input.value.trim();
    if(commit&&!value&&!blur){input.setCustomValidity('画布名称不能为空');input.reportValidity();return;}
    editing=null;input.remove();b.hidden=false;
    if(commit&&value&&value!==canvas.name&&!options.isRunning())options.renameCanvas(value,canvas.id);
   }
   input.oninput=()=>input.setCustomValidity('');
   input.onkeydown=e=>{e.stopPropagation();if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);b.focus();}};
   input.onblur=()=>finish(true,true);input.focus();input.select();
  }
  function refresh(){
   const p=options.getProject(),id=options.getActiveCanvas(),c=p.canvases.find(c=>c.id===id)||p.canvases[0],key=JSON.stringify([p.title,p.canvases.map(c=>[c.id,c.name]),id]);
   if(key!==signature){signature=key;if(editing)editing.finish(false);if(doc.activeElement!==title)title.value=p.title;tabs.replaceChildren();for(const canvas of p.canvases){const b=button('',(p.canvases.indexOf(canvas)+1)+'. '+canvas.name,()=>options.selectCanvas(canvas.id));b.removeAttribute('id');b.dataset.canvasTab=canvas.id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(canvas.id===id));b.title='双击重命名画布';b.ondblclick=()=>renameTab(canvas,b);tabs.append(b);}}
   const index=p.canvases.indexOf(c),running=options.isRunning(),inside=options.isInsideMacro?.();for(const key of ['canvas-add','import','canvas-delete','canvas-left','canvas-right'])$(key).disabled=running||inside||key==='canvas-delete'&&p.canvases.length===1||key==='canvas-left'&&index===0||key==='canvas-right'&&index===p.canvases.length-1;title.disabled=running;importTarget.disabled=running||inside;$('signal-matching').disabled=inside;if((running||inside)&&editing)editing.finish(false);matching.refresh();
  }
  return{refresh,importTarget:()=>importTarget.value,dialog:matching.dialog};
 }
 root.LogicEngineeringUI={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
