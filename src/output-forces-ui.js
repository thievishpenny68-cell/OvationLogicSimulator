/* Session-only controls. No project storage, localStorage or persistent form state. */
(function(root){'use strict';
 function mount({core:C,onApply}){
  const $=id=>document.getElementById(id),host=$('force-panel'),tabs=$('inspector-tabs'),normal=$('properties-tab'),force=$('forces-tab'),clear=$('force-clear-stale');let tab='properties',cache='',context=null;
  const make=(tag,attrs={},text)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
  function activate(next){tab=next;normal.setAttribute('aria-selected',String(tab==='properties'));force.setAttribute('aria-selected',String(tab==='forces'));normal.tabIndex=tab==='properties'?0:-1;force.tabIndex=tab==='forces'?0:-1;$('properties').hidden=tab!=='properties';host.hidden=tab!=='forces';}
  normal.onclick=()=>activate('properties');force.onclick=()=>{if(!force.disabled)activate('forces');};tabs.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const button=e.key==='Home'?normal:e.key==='End'?force:tab==='properties'?force:normal;if(!button.disabled){button.click();button.focus();}}};
  clear.onclick=()=>{if(context?.node)onApply(context.node,{});};
  function render(ctx){
   context=ctx;const{node:n,config={},running=false,inactive='',frame,revision}=ctx,eligible=!!n&&!['INPUT','OUTPUT'].includes(n.type);force.disabled=!eligible;
   clear.hidden=!n||eligible||!Object.keys(config).length;clear.disabled=running;tabs.hidden=!n;if(!eligible)activate('properties');
   const key=JSON.stringify([n?.id,n?.type,n&&C.forceableOutputs(n),config,running,inactive,revision]);
   if(key!==cache){cache=key;host.replaceChildren();if(eligible){
    host.append(make('h3',{},'强制输出 · '+n.name),make('p',{class:'source-note'},'仅当前页有效，工程不保存。应用或取消后清除旧运行，从初态重新仿真。'),make('p',{class:'source-note'},'模块照常计算，对外输出使用强制值；内部状态不被强制值改写。'));
    if(inactive)host.append(make('p',{class:'source-note'},inactive+'：恢复运算后强制才会生效。'));
    if(n.macroReference)host.append(make('p',{class:'source-note'},'强制不会使未实现的宏参与仿真；展开宏前请先取消强制。'));
    const ports=C.forceableOutputs(n),names=Object.keys(ports);
    for(const[port,kind]of Object.entries(ports)){
     const row=make('section',{'data-force-port':port,class:'force-row'}),label=make('label',{class:'force-enable'}),check=make('input',{type:'checkbox','aria-label':'强制 '+port}),exists=Object.hasOwn(config,port);check.checked=exists;check.disabled=running;label.append(check,document.createTextNode(port+' · '+(kind==='boolean'?'数字量':'模拟量')));
     const value=make(kind==='boolean'?'select':'input',{'aria-label':port+' 强制值',...(kind==='analog'?{type:'number',step:'any'}:{})});if(kind==='boolean'){value.append(make('option',{value:'false'},'0 · FALSE'),make('option',{value:'true'},'1 · TRUE'));value.value=String(exists?config[port]:false);}else value.value=String(exists?config[port]:(n.initial?.[port]??0));value.disabled=running||!check.checked;check.onchange=()=>{value.disabled=running||!check.checked;};row.append(label,value,make('div',{'data-force-readout':'',class:'source-note'}));host.append(row);
    }
    if(!names.length)host.append(make('p',{class:'source-note'},'没有可强制的数字量或模拟量输出。LP打包字不提供强制。'));
    const stale=Object.keys(config).filter(port=>!Object.hasOwn(ports,port));if(stale.length)host.append(make('p',{class:'force-error'},'原配置的端口已失效：'+stale.join('、')+'。请取消强制或重新应用。'));
    const message=make('p',{id:'force-message',role:'status',class:'force-error'}),actions=make('div',{class:'force-actions'}),apply=make('button',{id:'force-apply',class:'primary'},'应用强制'),cancel=make('button',{id:'force-clear'},'取消本模块强制');apply.disabled=running||!names.length;cancel.disabled=running||!Object.keys(config).length;
    apply.onclick=()=>{try{const map={};for(const row of host.querySelectorAll('[data-force-port]'))if(row.querySelector('input[type=checkbox]').checked){const port=row.dataset.forcePort,input=row.querySelector('select,input[type=number]');if(!input.value.trim())throw Error(port+'：请填写强制数值');map[port]=ports[port]==='boolean'?input.value==='true':Number(input.value);}const errors=C.forceOutputIssues(n,map);if(errors.length)throw Error(errors.map(i=>i.message).join('；'));onApply(n,map);}catch(e){message.textContent=e.message;}};
    cancel.onclick=()=>onApply(n,{});actions.append(apply,cancel);host.append(message,actions);
   }}
   if(n){const format=v=>v===undefined?'—':typeof v==='boolean'?(v?'TRUE':'FALSE'):String(v);for(const row of host.querySelectorAll('[data-force-port]')){const port=row.dataset.forcePort,output=frame?.values?.[n.id]?.[port],computed=frame?.computedValues?.[n.id]?.[port]??output;row.querySelector('[data-force-readout]').textContent='计算：'+format(computed)+'　输出：'+format(output);}}
  }
  return{render};
 }
 root.LogicOutputForces={mount};
})(globalThis);
