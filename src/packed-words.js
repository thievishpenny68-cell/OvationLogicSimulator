(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicPackedWords=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const bits=Array.from({length:16},(_,i)=>'D'+i),digital=()=>Object.fromEntries(bits.map(k=>[k,'boolean']));
 const catalog={
  PACK16:{label:'16位数字打包',group:'状态',defaults:{},stateful:true,packed:true,primaryOutput:'POUT',optionalInputs:bits,model:'ref1100-2006-pack16-good-v1',source:'REF_1100 §4.71 p261～262；LD数字输入写LP.A2相应位；未接位保持，GOOD质量；共享字按明确顺序读改写。'},
  UNPACK16:{label:'16位数字解包',group:'逻辑',defaults:{},packed:true,primaryOutput:'D0',model:'ref1100-2006-unpack16-good-v1',source:'REF_1100 §4.124 p420～421；LP.A2第0～15位复制至相应LD数字输出；GOOD质量。'}
 };
 function word(value){if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>65535)throw Error('LP.A2打包字必须为0～65535的整数');return value;}
 function pack(initial,inputs){let value=word(initial);for(const [pin,bit]of Object.entries(inputs)){if(!bits.includes(pin)||typeof bit!=='boolean')throw Error('PACK16需要D0～D15布尔输入');const mask=1<<Number(pin.slice(1));value=bit?value|mask:value&~mask;}return word(value);}
 function unpack(value){word(value);return Object.fromEntries(bits.map((pin,i)=>[pin,!!(value&(1<<i))]));}
 function ports(n){return n.type==='PACK16'?{inputs:digital(),outputs:{POUT:'packed16'}}:{inputs:{PIN:'packed16'},outputs:digital()};}
 const output=n=>n.type==='BCDNOUT'?'OUT':n.type==='FIRSTOUT'?'MNTR':n.type==='PACK16'?'POUT':n.type==='ASSIGN'&&n.params?.kind==='packed16'?'OUT':null;
 function inspect(project,allPorts,analysis){
  const issues=[],points=new Map(),bindings=new Map(),nodes=(project.nodes||[]).filter(Boolean),add=(code,message,nodeId)=>issues.push({code,message,nodeId,severity:'error'});
  if(project.packedPoints!==undefined&&!Array.isArray(project.packedPoints)){add('PACKED_POINTS','LP共享字配置须为数组');return{issues,points,bindings};}
  for(const p of project.packedPoints||[]){if(!p||typeof p.id!=='string'||!p.id.trim()||p.id!==p.id.trim()||points.has(p.id)||Object.keys(p).some(k=>!['id','initial'].includes(k))){add('PACKED_POINTS','LP共享字名称无效/重复，或含未支持字段');continue;}try{word(p.initial);points.set(p.id,{...p});}catch(e){add('PACKED_INITIAL_REQUIRED',e.message);}}
  for(const n of nodes){if(n.macroReference)continue;const at=n.provenance?.attributes||{},port=output(n),raw=port&&(at['cb-alg-'+port.toLowerCase()]??at['cb-alg-pbpt']??at['cb-macro-'+port.toLowerCase()]??at['cb-macro-pbpt']);if(typeof raw==='string'&&raw.startsWith('$'))add('PACKED_REFERENCE_REVIEW','LP输出引用尚未解释，不能用独立字或手填绑定代替原引用：'+raw,n.id);const bound=Object.hasOwn(n,'packedPoint');if(!bound)continue;
   if(!(output(n)||n.type==='UNPACK16')){add('PACKED_BINDING','只有PACK16、FIRSTOUT、BCDNOUT、UNPACK16或LP模式ASSIGN可绑定共享字',n.id);continue;}
   if(typeof n.packedPoint!=='string'||!points.has(n.packedPoint)){add('PACKED_BINDING','LP共享字不存在或未明确初值：'+String(n.packedPoint),n.id);continue;}
   bindings.set(n.id,n.packedPoint);if(port&&n.initial?.[port]!==points.get(n.packedPoint).initial)add('PACKED_INITIAL_CONFLICT','共享字 '+n.packedPoint+' 与 '+port+' 初态不一致，请明确统一初值',n.id);
   if(n.type==='UNPACK16'&&(project.edges||[]).some(e=>e?.to===n.id&&e.toPort==='PIN'))add('PACKED_INPUT_CONFLICT','PIN不能同时由连线和命名共享字驱动',n.id);
  }
  // Explicit source names denote shared process points, not independent node words.
  // Require an explicit binding and keep equal names in the same macro scope together.
  const sourceBindings=analysis?.bindings||[],names=new Map();
  for(const b of sourceBindings){if(b.kind!=='packed16'||!b.symbol)continue;const n=nodes.find(n=>n.id===b.nodeId),scope=b.recordScope??n?.provenance?.macroExpansionScope??'',key=JSON.stringify([scope,b.symbol]);if(!names.has(key))names.set(key,[]);names.get(key).push({...b,node:n});}
  for(const group of names.values()){
   const writers=group.filter(b=>b.direction==='outputs'&&output(b.node)),readers=group.filter(b=>b.direction==='inputs');
   if(!writers.length)continue;for(const b of writers)if(!bindings.has(b.nodeId))add('PACKED_BINDING_REQUIRED','源LP点 '+b.symbol+' 须明确共享字身份与初值，不能默认为独立节点字',b.nodeId);
   const ids=[...new Set(writers.map(b=>bindings.get(b.nodeId)).filter(Boolean))];if(ids.length>1)add('PACKED_ALIAS_CONFLICT','相同源LP点绑定到不同共享字：'+group[0].symbol,writers[0].nodeId);
   for(const b of readers)if(ids.length===1){const edge=(project.edges||[]).find(e=>e?.to===b.nodeId&&e.toPort===b.pin),actual=edge?bindings.get(edge.from):b.node.type==='UNPACK16'?bindings.get(b.nodeId):undefined;if(actual!==ids[0])add('PACKED_ALIAS_CONFLICT','源LP读写点与实际驱动的共享字不一致：'+b.symbol,b.nodeId);}
   for(const b of group)if(b.direction==='outputs'&&!output(b.node))add('PACKED_ALIAS_CONFLICT','共享LP点不能另建独立测试源覆盖同名记录：'+b.symbol,b.nodeId);
  }
  return{issues,points,bindings};
 }
 return{catalog,word,pack,unpack,ports,output,inspect};
});
