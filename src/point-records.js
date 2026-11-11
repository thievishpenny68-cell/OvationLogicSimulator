(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./pin-record-data'):root.LogicPinRecordData);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicPointRecords=api;})(typeof globalThis!=='undefined'?globalThis:this,function(data){
 'use strict';
 const basic=['LA','LD','LP'],kinds={LA:'analog',LD:'boolean',LP:'packed16'};
 function allowed(type,direction,pin){return [...(['INPUT','OUTPUT'].includes(type)?basic:data[type]?.[direction]?.[pin]||[])];}
 function analyze(project,ports){
  const nodes=(project.nodes||[]).filter(n=>n&&typeof n.id==='string'),byId=new Map(nodes.map(n=>[n.id,n])),issues=[],bindings=[],records=[],seen=new Set();
  const add=(code,message,nodeId,extra={})=>issues.push({code:'POINT_RECORD_'+code,message,nodeId,severity:'error',...extra});
  function retain(r,owner,scope){if(r.namespace!=='tft'||typeof r.recordType!=='string'||!r.recordType)return;const key=JSON.stringify([owner,r.file,r.record,r.field,r.recordType]);if(seen.has(key))return;seen.add(key);records.push({...r,owner,scope});if(![...basic,'LC'].includes(r.recordType))add('UNSUPPORTED','未支持的点记录类型 '+r.recordType+'（'+r.record+'）；当前仅允许LA、LD、LP，LC仅作算法存储',owner,{sourceFile:r.file,sourceField:r.field});}
  for(const n of nodes)for(const r of n.provenance?.fieldAudit||[])retain(r,n.id,n.provenance?.macroExpansionScope||'');
  for(const group of project.importAudit?.tftGroups||[]){const owner=byId.get(group.nodeId);if(group.nodeId&&!owner)continue;for(const r of group.records||[])retain({namespace:'tft',file:group.file,record:r.name,recordType:r.recordType,field:r.field,role:r.recordType==='LC'?'parameter':r.field?'parameter':'record-declaration'},owner?.id,owner?.provenance?.macroExpansionScope||'');}
  function symbol(n,direction,pin,visited=new Set()){
   const key=n.id+'\0'+direction+'\0'+pin;if(visited.has(key))return;visited.add(key);const at=n.provenance?.attributes||{},aliases=pin==='IN1'?['in1','in',...(n.type==='DIVIDE'?['num']:[]),...(n.type==='OUTPUT'?['tout']:[])]:pin==='IN2'&&n.type==='DIVIDE'?['in2','den']:['POUT','PIN'].includes(pin)?[pin.toLowerCase(),'pbpt']:[pin.toLowerCase()];
   const raw=aliases.map(k=>at['cb-alg-'+k]??at['cb-macro-'+k]).find(v=>typeof v==='string'&&v.trim());if(raw&&!raw.startsWith('$'))return{name:raw,scope:n.provenance?.macroExpansionScope||''};
   if(direction==='inputs'){const edges=(project.edges||[]).filter(e=>e?.to===n.id&&e.toPort===pin),edge=edges.length===1?edges[0]:null,source=edge&&byId.get(edge.from);if(source)return symbol(source,'outputs',edge.fromPort,visited);}
  }
  for(const n of nodes){if(n.macroReference)continue;const ps=ports(n);for(const [direction,map]of Object.entries(ps))for(const [pin,kind]of Object.entries(map)){
   const permit=allowed(n.type,direction,pin),identity=symbol(n,direction,pin),name=identity?.name,declarations=name?records.filter(r=>r.scope===identity.scope&&!(r.recordType==='LC'&&['record-header','parameter','runtime-state','metadata'].includes(r.role))&&(r.record===name||r.field&&r.record===name+':'+r.field)):[],types=[...new Set(declarations.map(r=>r.recordType))],binding={nodeId:n.id,direction,pin,kind,symbol:name,recordScope:identity?.scope,allowed:permit,records:declarations};bindings.push(binding);
   if((data[n.type]||['INPUT','OUTPUT'].includes(n.type))&&!permit.length)add('DEFINITION_REQUIRED','缺少手册引脚记录类型定义：'+n.type+'.'+pin,n.id);
   if(types.length>1)add('CONFLICT','点 '+name+' 存在冲突记录类型：'+types.join('/'),n.id);
   for(const type of types){if(!basic.includes(type)){if(type==='LC')add('TYPE','LC算法存储不能作为信号点接入 '+pin,n.id);continue;}
    if(!permit.includes(type))add('TYPE',n.type+'.'+pin+' 手册只允许 '+permit.join('/')+'，实际声明为 '+type,n.id);
    if(type==='LP'&&kind!=='packed16')add('LP_UNSUPPORTED','点 '+name+' 为LP；整字/位地址及共享写入模型尚未实现，不能当作模拟量或布尔量执行',n.id);
    else if(kinds[type]!==kind&&['analog','boolean','packed16'].includes(kind))add('KIND',pin+' 的 '+type+' 记录与当前 '+kind+' 类型冲突',n.id);
   }
   const defaultRecord={analog:'LA',boolean:'LD',packed16:'LP'}[kind];if(defaultRecord&&permit.length&&!permit.includes(defaultRecord))add('DEFINITION_CONFLICT','当前引脚标量定义不符合手册：'+n.type+'.'+pin,n.id);
  }
   if(data[n.type]?.sameRecordRequired){const declared=[...new Set(bindings.filter(b=>b.nodeId===n.id).flatMap(b=>b.records.map(r=>r.recordType)))];if(declared.length>1)add('ASSIGN_SAME_TYPE','ASSIGN输入和输出必须为同一记录类型，实际为 '+declared.join('/'),n.id);}
  }
  return{bindings,issues};
 }
 return{data,allowed,analyze};
});
