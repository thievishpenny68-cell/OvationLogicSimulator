(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.LogicCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicBindings=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 function inferInterfaces(project){
  const next=structuredClone(project),nodes=new Map(next.nodes.map(n=>[n.id,n])),helpers=next.nodes.filter(n=>!n.macroReference&&['INPUT','OUTPUT','ASSIGN'].includes(n.type)),parent=new Map(helpers.map(n=>[n.id,n.id])),known=k=>['boolean','analog','packed16'].includes(k);
  const find=id=>{let root=id;while(parent.get(root)!==root)root=parent.get(root);while(parent.get(id)!==id){const old=parent.get(id);parent.set(id,root);id=old;}return root;};
  const edges=next.edges.filter(e=>{const a=nodes.get(e?.from),b=nodes.get(e?.to);return a&&b&&Object.hasOwn(C.ports(a).outputs,e.fromPort)&&Object.hasOwn(C.ports(b).inputs,e.toPort);});
  for(const e of edges)if(parent.has(e.from)&&parent.has(e.to))parent.set(find(e.to),find(e.from));
  const groups=new Map();for(const n of helpers){const key=find(n.id);if(!groups.has(key))groups.set(key,{members:[],constraints:[]});const g=groups.get(key);g.members.push(n);if(known(n.params.kind))g.constraints.push({nodeId:n.id,kind:n.params.kind,basis:'显式接口类型'});}
  const constrain=(id,peer,port,direction)=>{const kind=C.ports(peer)[direction==='input'?'inputs':'outputs'][port];if(known(kind))groups.get(find(id)).constraints.push({nodeId:peer.id,port,direction,kind,basis:(!peer.macroReference&&C.catalog[peer.type]?.source)||(!peer.macroReference&&C.declaredInterfaces.get(peer.type)?.source)||'宏实例已声明接口'});};
  for(const e of edges){if(parent.has(e.from)&&!parent.has(e.to))constrain(e.from,nodes.get(e.to),e.toPort,'input');if(parent.has(e.to)&&!parent.has(e.from))constrain(e.to,nodes.get(e.from),e.fromPort,'output');}
  for(const binding of C.pointRecordAnalysis(next).bindings)if(parent.has(binding.nodeId))for(const record of binding.records){const g=groups.get(find(binding.nodeId)),kind={LA:'analog',LD:'boolean',LP:'packed16'}[record.recordType];if(kind)g.constraints.push({nodeId:binding.nodeId,port:binding.pin,direction:binding.direction,kind,basis:'TFT明确点记录 '+record.record+' / '+record.recordType});else g.blocked=true;}
  const diagnostics=[];for(const g of groups.values()){const kinds=[...new Set(g.constraints.map(c=>c.kind))];if(kinds.length>1){diagnostics.push({code:'SIGNAL_TYPE_CONFLICT',severity:'error',nodeId:g.members[0].id,message:'接口连线同时要求数字量、模拟量或LP打包字，请核对连接及接口定义',constraints:g.constraints});continue;}
   if(kinds.length===1&&!g.blocked)for(const n of g.members)if(n.params.kind==null||n.params.kind==='unknown'){n.params.kind=kinds[0];n.provenance={...n.provenance,typeInference:{kind:kinds[0],evidence:'confirmed-edge-type-constraints',constraints:structuredClone(g.constraints)}};}
  }
  return{project:next,diagnostics};
 }
 return{inferInterfaces};
});
