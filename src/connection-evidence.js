(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./core'):root.LogicCore,node?require('./source-semantics'):root.LogicSourceSemantics);if(node)module.exports=api;else root.LogicConnectionEvidence=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,A){
 'use strict';
 const PROFILE='mcr-layout-cross-check-v1',mappingKinds=new Set(['decoded-object-id','same-object-id','algorithm-record-name','type-and-reference-multiset','type-and-output-symbol']);
 function sourceGraph(project,node){if(!node.provenance?.macroExpansionScope)return project;const definitions=(project.library||[]).filter(d=>d.id===node.provenance.definitionId);return definitions.length===1?definitions[0].graph:null;}
 function sourceTypeMatches(project,node,type){if(node.type===type)return true;if(node.type!=='ASSIGN'||node.provenance?.interfaceRole!=='macro-input-relay'||type!=='INPUT'||!node.provenance?.macroExpansionScope)return false;const definitions=(project.library||[]).filter(d=>d.id===node.provenance.definitionId);return definitions.length===1&&(definitions[0].inputs||[]).some(p=>p.nodeId===node.provenance.originalNodeId);}
 function compare(project,candidate){
  const choice={from:candidate.from,fromPort:candidate.fromPort||candidate.sourcePortSuggestion?.port||null,to:candidate.to,toPort:candidate.toPort||candidate.destinationPortSuggestion?.port||null},row={candidateId:candidate.id,status:'unavailable',reason:'',choice,svg:{file:candidate.sourceFile,instanceKey:candidate.connectionInstanceKey,sourceInstanceKey:candidate.sourceConnectionInstanceKey||candidate.connectionInstanceKey,sourceObjectId:candidate.sourceObjectId,destinationObjectId:candidate.destinationObjectId,sourcePinId:candidate.sourcePinId,destinationPinId:candidate.destinationPinId}};
  const stop=(reason,status='unavailable')=>({...row,status,reason});
  if((project.connectionCandidates||[]).filter(c=>c.id===candidate.id).length!==1)return stop('候选ID不唯一','ambiguous');
  if(!candidate.connectionInstanceKey||!candidate.sourceFile)return stop('缺少原连接实例或文件');
  if((project.connectionCandidates||[]).filter(c=>c.status==='pending'&&c.sourceFile===candidate.sourceFile&&c.connectionInstanceKey===candidate.connectionInstanceKey).length!==1)return stop('同一原连接存在多个候选，请逐项核对','ambiguous');
  if(!choice.from||!choice.to||!choice.fromPort||!choice.toPort)return stop('针脚名称或端点尚不完整');
  const froms=project.nodes.filter(n=>n.id===choice.from),tos=project.nodes.filter(n=>n.id===choice.to);if(froms.length!==1||tos.length!==1)return stop('源或目标块不唯一','ambiguous');const from=froms[0],to=tos[0],scope=n=>n.provenance?.macroExpansionScope||null;
  if(scope(from)!==scope(to))return stop('连接跨越不同展开作用域，需逐项核对');
  const graph=sourceGraph(project,from);if(!graph||sourceGraph(project,to)!==graph)return stop('缺少唯一原宏定义图');
  const audit=graph.importAudit;if(!audit?.implementation||audit.target!==candidate.sourceFile||!Array.isArray(audit.svgObjects)||!Array.isArray(audit.implementationObjects))return stop('缺少对应SVG与MCR的原始审计');
  if((graph.issues||[]).some(i=>i.code==='SOURCE_CONFLICT'&&!i.resolved))return stop('原导入来源存在冲突，请先核对来源');
  const shared=graph!==project&&Array.isArray(graph.sources)&&graph.sources.length===0,sources=shared?project.sources:graph.sources;
  for(const[file,role]of [[audit.target,'macro-definition'],[audit.implementation,'macro-implementation']]){
   if((sources||[]).filter(s=>s.name===file).length!==1)return stop('原来源文件缺失或同名文件不唯一');
   if(shared){const entries=(project.importAudit?.sourceFiles||[]).filter(f=>f.file===file);if(entries.length!==1||!Array.isArray(entries[0].uses)||!entries[0].uses.some(u=>u.role===role&&u.sheet===audit.target))return stop('集中来源缺少对应宏图的文件用途记录');}
  }
  if(!audit.svgObjects.some(o=>o.kind==='connection'&&o.connectionInstanceKey===row.svg.sourceInstanceKey))return stop('无法定位原SVG连接审计实例');
  for(const[n,objectId]of[[from,candidate.sourceObjectId],[to,candidate.destinationObjectId]]){
   const p=n.provenance;if(!p?.layoutMatched||!mappingKinds.has(p.layoutEvidence)||p.svgObjectId!==objectId||p.svgSourceFile!==candidate.sourceFile||p.sourceFile!==audit.implementation)return stop('块关联仅供布局或已改变，不能作为MCR交叉证据');
   if(project.nodes.filter(other=>scope(other)===scope(n)&&other.provenance?.svgObjectId===objectId&&other.provenance?.svgSourceFile===candidate.sourceFile).length!==1)return stop('当前SVG块关联不唯一','ambiguous');
   const visuals=audit.svgObjects.filter(o=>o.kind==='logic'&&o.objectId===objectId),records=audit.implementationObjects.filter(o=>o.objectId===p.objectId),originalId=p.originalNodeId||n.id;
   if(visuals.length!==1||records.length!==1)return stop('原SVG或MCR对象不唯一','ambiguous');
   if(visuals[0].nodeId!==originalId||records[0].nodeId!==originalId||!sourceTypeMatches(project,n,visuals[0].type)||!sourceTypeMatches(project,n,records[0].type)||!mappingKinds.has(visuals[0].mappingEvidence))return stop('当前块类型或原对象关联与审计不一致');
  }
  const output=C.ports(from).outputs[choice.fromPort],input=C.ports(to).inputs[choice.toPort];if(!['boolean','analog','packed16'].includes(output)||output!==input)return stop('当前端口不存在、类型未知或不一致');
  const drivers=project.edges.filter(e=>e.to===choice.to&&e.toPort===choice.toPort);if(drivers.length!==1)return stop(drivers.length?'目标存在多个驱动':'当前图缺少此目标的已导入明确边',drivers.length?'ambiguous':'unavailable');const edge=drivers[0];
  if(edge.from!==choice.from||edge.fromPort!==choice.fromPort)return stop('当前驱动与列出的SVG端口建议冲突','conflict');
  const record=audit.implementationObjects.find(o=>o.objectId===to.provenance.objectId),source=audit.implementationObjects.find(o=>o.objectId===from.provenance.objectId),p=edge.provenance||{},value=record.attributes?.[p.attribute],ref=typeof value==='string'&&value.match(/^\$([^$]+)\$(cb-alg-[^$]+)\$$/);
  // A Boolean algorithm may omit its OUT point declaration (e.g. NOT -> AND/OR).
  // The already checked algorithm signature defines that output; the MCR reference names it.
  if(p.file!==audit.implementation||typeof p.attribute!=='string'||!p.attribute.startsWith('cb-alg-')||value!==p.sourceValue||!ref||ref[1]!==source.objectId)return stop('当前边与原MCR目标属性/源引用不一致');
  const key=ref[2].slice(7),sourcePort=(!from.macroReference&&C.declaredInterfaces.outputField(from.type,key))||key.toUpperCase();if(A.inputField(to,p.attribute.slice(7))!==choice.toPort||sourcePort!==choice.fromPort)return stop('MCR属性对应的当前端口不一致');
  return{...row,status:'matched',reason:'端口建议、当前边与原MCR明确引用一致；仍须人工核对原图并采用',kind:output,implementation:{file:p.file,attribute:p.attribute,value,sourceObjectId:source.objectId,destinationObjectId:record.objectId}};
 }
 function review(project){const rows=(project.connectionCandidates||[]).filter(c=>c.status==='pending').map(c=>compare(project,c)),counts={matched:0,conflict:0,ambiguous:0,unavailable:0};for(const row of rows)counts[row.status]++;return{schemaVersion:1,profile:PROFILE,note:'只读连接交叉核对；布局针脚可移动，候选仍需人工选择和依据。本报告不证明编码解码、来源真实性或算法运行准确性。',counts,rows};}
 return{PROFILE,review};
});
