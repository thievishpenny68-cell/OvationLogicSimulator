(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.LogicCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicMacros=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function definition(project,id){const ds=(project.library||[]).filter(d=>d.id===id);if(ds.length!==1)throw Error('宏定义必须唯一，缺少或重复定义');const d=ds[0];if(!d.graph||!Array.isArray(d.graph.nodes)||!Array.isArray(d.graph.edges))throw Error('宏定义尚无可展开的组态图');return d;}
 function interfaces(d){
  const result={inputs:d.inputs||[],outputs:d.outputs||[],parameters:d.parameters||[]};
  if(Object.values(result).some(v=>!Array.isArray(v)))throw Error('宏接口必须为数组');
  const ids=new Set();for(const n of d.graph.nodes){if(!n||typeof n.id!=='string'||ids.has(n.id))throw Error('宏内部对象 ID 缺失或重复');ids.add(n.id);}
  for(const [direction,type]of [['inputs','INPUT'],['outputs','OUTPUT']]){const names=new Set();for(const p of result[direction]){if(!p||typeof p.name!=='string'||!p.name||names.has(p.name)||!d.graph.nodes.some(n=>n.id===p.nodeId&&n.type===type))throw Error('宏接口名称重复或指向错误对象');names.add(p.name);}}
  const params=new Set();for(const p of result.parameters){if(!p||typeof p.name!=='string'||params.has(p.name))throw Error('宏参数接口名称重复');params.add(p.name);const n=d.graph.nodes.find(n=>n.id===p.nodeId);if(!n||!C.catalog[n.type]||!own(C.catalog[n.type].defaults,p.key))throw Error('宏参数目标未支持或不明确');}
  return result;
 }
 function instantiate(d,id,x=100,y=100){
  const io=interfaces(d);return{id,type:d.name,name:d.name+' '+id,x,y,params:{},initial:{},macroReference:{definitionId:d.id,name:d.name,crc:d.crc||null},macroPorts:{inputs:Object.fromEntries(io.inputs.map(p=>[p.name,p.kind||'unknown'])),outputs:Object.fromEntries(io.outputs.map(p=>[p.name,p.kind||'unknown']))},provenance:{origin:'manual-macro'}};
 }
 function expand(project,instanceId,options){
  if(!options||typeof options.note!=='string'||!options.note.trim())throw Error('宏展开需要填写绑定核对依据');
  const matches=project.nodes.filter(n=>n.id===instanceId);if(matches.length!==1||!matches[0].macroReference)throw Error('宏实例不存在或身份不唯一');
  const original=matches[0],d=definition(project,options.definitionId||original.macroReference.definitionId),io=interfaces(d);
  if((project.connectionCandidates||[]).some(c=>c.status==='pending'&&c.segments?.length&&((c.to===instanceId&&!c.toPort)||(c.from===instanceId&&!c.fromPort))))throw Error('宏外部连线仍有未映射端口，请先在黄色连线中完成端口映射或明确拒绝该连接，再展开宏；当前图纸保持。');
  if(project.edges.some(e=>e.to===instanceId&&!io.inputs.some(p=>p.name===e.toPort)||e.from===instanceId&&!io.outputs.some(p=>p.name===e.fromPort)))throw Error('宏的原始针脚已自动接线，但其语义接口尚未与宏定义自动对应；当前不支持展开该版本，图纸及连线保留。');
  const chain=original.provenance?.macroChain||[];if(chain.includes(d.id))throw Error('检测到递归宏引用');
  if(original.macroReference.crc&&d.crc&&String(original.macroReference.crc)!==String(d.crc))throw Error('宏 CRC 版本与实例引用不一致');
  if(d.graph.profile!==project.profile)throw Error('宏与项目采用不同算法规则版本');
  const instanceParameters=Object.keys(original.params||{}),instanceInitial=Object.keys(original.initial||{});
  if(instanceParameters.length)throw Error('宏实例含未支持参数：'+instanceParameters.join(', ')+'；请核对原字段，已映射的公开参数需通过实例参数配置');
  if(instanceInitial.length)throw Error('宏实例含未支持初态：'+instanceInitial.join(', ')+'；请在内部状态块明确配置，不能通过展开忽略');
  if(own(original,'quality')&&original.quality!=='GOOD')throw Error('宏实例质量未支持：'+String(original.quality)+'；当前仅支持GOOD，不能通过展开忽略');
  for(const port of io.inputs){const n=d.graph.nodes.find(n=>n.id===port.nodeId),extra=Object.keys(n.params||{}).filter(k=>!['kind','wave'].includes(k));if(extra.length)throw Error('宏输入接口 '+port.name+' 含未支持参数：'+extra.join(', ')+'；不能通过转换为传递节点忽略');}
  for(const e of d.graph.edges)if(!e||!d.graph.nodes.some(n=>n.id===e.from)||!d.graph.nodes.some(n=>n.id===e.to))throw Error('宏内部存在悬空连接，需先修复定义');
  const next=structuredClone(project),instance=next.nodes.find(n=>n.id===instanceId),used=new Set(next.nodes.map(n=>n.id)),nodeMap=Object.create(null);next.schemaVersion=project.schemaVersion===3||d.graph.schemaVersion===3?3:2;if(next.schemaVersion===3)next.disableModel=C.DISABLE_MODEL;
  if(d.graph.execution){next.execution=next.execution||{model:'single-task-ordered-v1',mode:'topological',confirmation:null};next.execution.required=true;}
  if(next.macroExpansions!==undefined&&!Array.isArray(next.macroExpansions))throw Error('宏展开记录结构无效');
  const identities=[...used,...(next.issues||[]).flatMap(i=>[i.id,i.sourceInstanceKey]),...(next.connectionCandidates||[]).flatMap(c=>[c.id,c.connectionInstanceKey]),...(next.macroExpansions||[]).map(e=>e.scope)];
  let generation=(next.macroExpansions||[]).length+1,scope;
  do{scope='macro:'+encodeURIComponent(instanceId)+':expansion-'+generation+':';generation++;}while(identities.some(key=>typeof key==='string'&&key.startsWith(scope)));
  if(d.graph.executionConstraints){const error=[...C.executionTaskIssues(d.graph.executionConstraints),...C.executionTaskIssues(next.executionConstraints)].find(i=>i.code==='EXECUTION_PLAN');if(error)throw Error(error.message);next.executionConstraints=next.executionConstraints||{schemaVersion:1,taskGroups:[]};next.executionConstraints.taskGroups.push(...d.graph.executionConstraints.taskGroups.map(g=>({...structuredClone(g),scope:scope+g.scope})));}
  for(const n of d.graph.nodes){let id=scope+encodeURIComponent(n.id);while(used.has(id))id+='~';used.add(id);nodeMap[n.id]=id;}
  if(d.graph.packedPoints){if(!Array.isArray(d.graph.packedPoints))throw Error('宏LP共享字配置无效');next.packedPoints=next.packedPoints||[];for(const point of d.graph.packedPoints)next.packedPoints.push({...structuredClone(point),id:scope+point.id});}
  const copied=structuredClone(d.graph.nodes),byId=new Map(copied.map(n=>[n.id,n])),resolution={note:options.note.trim(),at:new Date().toISOString()};
  const overrides=options.overrides||{};for(const key of Object.keys(overrides)){const param=io.parameters.find(p=>p.name===key);if(!param)throw Error('未声明的宏参数：'+key);const value=overrides[key];if(typeof value!=='number'||!Number.isFinite(value))throw Error('宏参数需要有限数值');const n=byId.get(param.nodeId);if(C.catalog[n.type]?.selectableInputs?.[param.key]&&d.graph.edges.some(e=>e.to===param.nodeId&&e.toPort===param.key))throw Error('公开参数对应的限值已由引脚连线驱动，不能覆盖固定值');n.params={...n.params,[param.key]:value};n.provenance={...n.provenance,instanceOverrides:{...n.provenance?.instanceOverrides,[key]:{key:param.key,value,...resolution}}};}
  const addedIssues=[],incoming=project.edges.filter(e=>e.to===instanceId),outgoing=project.edges.filter(e=>e.from===instanceId),addedEdges=[];
  const issue=(code,message,nodeId)=>addedIssues.push({id:scope+'issue-'+addedIssues.length,code,severity:'error',message,nodeId,resolved:false});
  const applyKind=(port,n,side)=>{const explicit=instance.macroPorts?.[side]?.[port.name],kind=explicit&&explicit!=='unknown'?explicit:port.kind;if(kind&&kind!=='unknown'){if(port.kind&&port.kind!=='unknown'&&port.kind!==kind)throw Error('宏端口信号类型与定义不符');n.params.kind=kind;}};
  for(const port of io.inputs){
   const n=byId.get(port.nodeId);n.name=port.name;applyKind(port,n,'inputs');const bound=incoming.filter(e=>e.toPort===port.name);if(bound.length>1)throw Error('宏输入存在多个驱动');
   n.type='ASSIGN';n.params={kind:n.params.kind};n.initial={};n.provenance={...n.provenance,interfaceRole:'macro-input-relay'};
   if(!bound.length)issue('UNBOUND_MACRO_INPUT','宏输入 '+port.name+' 尚未绑定；请明确连接外部信号源',nodeMap[n.id]);
  }
  for(const e of incoming)if(!io.inputs.some(p=>p.name===e.toPort))throw Error('外部连接引用未声明的宏输入：'+e.toPort);
  for(const port of io.outputs){byId.get(port.nodeId).name=port.name;applyKind(port,byId.get(port.nodeId),'outputs');}
  for(const e of outgoing)if(!io.outputs.some(p=>p.name===e.fromPort))throw Error('外部连接引用未声明的宏输出：'+e.fromPort);
  const mapExternal=e=>{const mapped={...structuredClone(e)};if(e.from===instanceId){const port=io.outputs.find(p=>p.name===e.fromPort);const driver=port?d.graph.edges.filter(edge=>edge.to===port.nodeId&&edge.toPort==='IN1'):[];if(driver.length===1){mapped.from=nodeMap[driver[0].from];mapped.fromPort=driver[0].fromPort;}else{mapped.from=port?nodeMap[port.nodeId]:null;mapped.fromPort='OUT';if(port&&!addedIssues.some(i=>i.code==='UNBOUND_MACRO_OUTPUT'&&i.nodeId===mapped.from))issue('UNBOUND_MACRO_OUTPUT','宏输出 '+e.fromPort+' 内部驱动未唯一确定；保留待修复连接，请补充真实信号源',mapped.from);}}if(e.to===instanceId){const port=io.inputs.find(p=>p.name===e.toPort);mapped.to=port?nodeMap[port.nodeId]:null;mapped.toPort='IN1';}return mapped;};
  for(const e of project.edges)if(e.from===instanceId||e.to===instanceId)addedEdges.push(mapExternal(e));
  for(const n of copied){if(instance.disabled===true)n.disabled=true;if(n.packedPoint!==undefined)n.packedPoint=scope+n.packedPoint;const old=n.id;n.id=nodeMap[old];n.x=instance.x+(Number.isFinite(n.x)?n.x:0);n.y=instance.y+(Number.isFinite(n.y)?n.y:0);n.name=instance.name+'/'+n.name;n.provenance={...n.provenance,macroInstance:instanceId,macroExpansionScope:scope,definitionId:d.id,originalNodeId:old,macroChain:[...chain,d.id]};}
  if(copied.length)for(const group of d.graph.importAudit?.tftGroups||[])if(!group.nodeId)for(const record of group.records||[]){const p=copied[0].provenance;p.fieldAudit=p.fieldAudit||[];p.fieldAudit.push({namespace:'tft',file:group.file,record:record.name,recordType:record.recordType,field:record.field,raw:record.raw,role:record.recordType==='LC'?'parameter':record.field?'parameter':'record-declaration',status:'declared-not-interpreted',unassignedSourceGroup:group.objectId});}
  const first=copied[0]?.id;
  const scopeKey=key=>key?scope+key:key;
  const scopedIssue=(i,index)=>{const result={...structuredClone(i),id:scope+'diagnostic-'+index,sourceIssueId:i.id,nodeId:nodeMap[i.nodeId]||first,sourceInstanceKey:scopeKey(i.sourceInstanceKey)};if(result.resolved)return result;
   const typedInterface=[...io.inputs,...io.outputs].some(port=>port.nodeId===i.nodeId&&['boolean','analog','packed16'].includes(byId.get(port.nodeId)?.params.kind));let reason;
   if(i.code==='SIGNAL_TYPE_REQUIRED'&&typedInterface)reason='命名接口的类型已由定义或显式实例绑定明确';
   if(i.code==='INPUT_SCENARIO_REQUIRED'&&typedInterface&&io.inputs.some(port=>port.nodeId===i.nodeId&&incoming.some(e=>e.toPort===port.name)))reason='宏输入已重连调用者信号；内部传递接口不再使用独立波形';
   if(i.code==='SCAN_CONFIGURATION_REQUIRED'&&i.nodeId==null&&d.graph.importMetadata?.kind==='ControlMacro'&&Number.isSafeInteger(project.dtUs)&&project.dtUs>0)reason='宏内联到调用图，同一扫描执行；采用调用图周期 '+project.dtUs+' 微秒';
   if(reason){result.resolved=true;result.resolution={...resolution,reason};}return result;
  };
  next.nodes=next.nodes.filter(n=>n.id!==instanceId).concat(copied);
  next.edges=next.edges.filter(e=>e.from!==instanceId&&e.to!==instanceId).concat(d.graph.edges.map(e=>({...structuredClone(e),from:nodeMap[e.from],to:nodeMap[e.to]})),addedEdges);
  next.issues=next.issues||[];
  for(const i of next.issues)if(i.nodeId===instanceId){if(['UNKNOWN_BLOCK','MACRO_BINDING_REQUIRED','MACRO_UNEXPANDED'].includes(i.code)){i.resolved=true;i.resolution=resolution;}else{i.nodeId=first;i.expandedFromInstance=instanceId;}}
  if(original.provenance?.origin==='import'&&original.macroReference.crc&&!d.crc)issue('MACRO_VERSION_UNCONFIRMED','宏定义缺少版本校验信息',first);
  next.issues.push(...(d.graph.issues||[]).map(scopedIssue),...addedIssues);
  next.connectionCandidates=(next.connectionCandidates||[]).map(mapExternal);
  next.connectionCandidates.push(...(d.graph.connectionCandidates||[]).map(c=>({...structuredClone(c),id:scopeKey(c.id),connectionInstanceKey:scopeKey(c.connectionInstanceKey),from:nodeMap[c.from]||null,to:nodeMap[c.to]||null})));
  const record={instanceId,scope,definitionId:d.id,originalNode:structuredClone(original),nodeMap:{...nodeMap},overrides:structuredClone(overrides),...resolution};next.macroExpansions=next.macroExpansions||[];next.macroExpansions.push(record);
  return next;
 }
 return{instantiate,expand};
});
