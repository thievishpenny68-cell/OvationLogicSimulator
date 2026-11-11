(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./core.js'):root.LogicCore,node?require('./source-semantics.js'):root.LogicSourceSemantics,node?require('./connection-evidence.js'):root.LogicConnectionEvidence);if(node)module.exports=api;else root.LogicRepair=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,A,E){
 'use strict';
 const knownParameters=new Set(Object.values(A.fields).flatMap(Object.keys).map(k=>k.toLowerCase()));
 const symbolFields=new Set(['alg','out','tout','diag','crc',...Object.keys(A.inputFields)]);
 function validateFieldBindings(project){
  const graphs=[project,...(project.library||[]).filter(d=>d.graph).map(d=>d.graph)];
  for(const graph of graphs)for(const node of graph.nodes||[]){const fields=node.provenance?.fieldAudit,history=node.provenance?.manualFieldBindings;
   if(fields!==undefined&&(!Array.isArray(fields)||fields.some(f=>!f||typeof f!=='object'||['attribute','file','namespace','status'].some(k=>f[k]!==undefined&&typeof f[k]!=='string'))))return '来源字段审计结构无效';
   if(history!==undefined&&(!Array.isArray(history)||history.some(b=>!b||!['bind','clear'].includes(b.action)||!Number.isSafeInteger(b.fieldIndex)||b.fieldIndex<0||!fields?.[b.fieldIndex]||typeof b.nodeType!=='string'||typeof b.key!=='string'||typeof b.note!=='string'||!b.note.trim()||typeof b.at!=='string'||!b.source||typeof b.source.attribute!=='string'||b.action==='bind'&&(typeof b.value!=='number'||!Number.isFinite(b.value)))))return '人工字段对应历史结构无效';
  }return null;
 }
 function activeBinding(node,index){const last=(node.provenance?.manualFieldBindings||[]).findLast(b=>b.fieldIndex===index);return last?.action==='bind'?last:null;}
 function parameterChoices(node){
  const keys=Object.keys(A.fields[node.type]||{}).filter(k=>Object.hasOwn(C.catalog[node.type]?.defaults||{},k)&&!C.catalog[node.type]?.paramChoices?.[k]);
  return(node.provenance?.fieldAudit||[]).flatMap((field,index)=>{const binding=activeBinding(node,index),match=field.attribute?.match(/^cb-(?:alg|macro)-(.+)$/),name=match?.[1].toLowerCase();if(!binding&&(!keys.length||!['svg','implementation'].includes(field.namespace)||field.status!=='unresolved'||typeof field.file!=='string'||!match||symbolFields.has(name)&&!C.catalog[node.type]?.selectableInputs?.[name.toUpperCase()]))return[];const allowed=knownParameters.has(name)?keys.filter(k=>k.toLowerCase()===name):keys;if(!allowed.length&&!binding)return[];return[{index,field,keys:allowed,binding}];});
 }
 function refreshFieldIssues(project,node,field,note){
  for(const issue of project.issues||[]){if(issue.nodeId!==node.id||!['SVG_FIELDS_UNRESOLVED','OPAQUE_BINDINGS'].includes(issue.code)||issue.sourceFile!==field.file||issue.sourceNamespace!==field.namespace||!issue.sourceFields?.includes(field.attribute))continue;
   issue.remainingSourceFields=issue.sourceFields.filter(attribute=>{const matches=(node.provenance.fieldAudit||[]).map((f,i)=>({f,i})).filter(({f})=>f.namespace===issue.sourceNamespace&&f.file===issue.sourceFile&&f.attribute===attribute);return!matches.length||matches.some(({i})=>!activeBinding(node,i));});
   issue.resolved=issue.remainingSourceFields.length===0;
   issue.resolution={kind:'manual-parameter-bindings',note,at:new Date().toISOString()};
  }
 }
 function bindingContext(project,nodeId,index,note){if(typeof note!=='string'||!note.trim())throw Error('请填写人工对应依据或解除原因');const node=project.nodes.find(n=>n.id===nodeId),choice=node&&parameterChoices(node).find(c=>c.index===index);if(!choice)throw Error('请选择本节点尚未解释的参数来源字段');return{node,choice};}
 function bindParameter(project,nodeId,index,key,value,note){
  const{node:originalNode,choice}=bindingContext(project,nodeId,index,note);if(!choice.keys.includes(key))throw Error('该来源字段不能对应此参数，或当前模式未支持该参数');if(choice.binding&&choice.binding.key!==key)throw Error('该字段已有不同参数对应，请先解除对应并核对原参数值');
  if(C.catalog[originalNode.type]?.selectableInputs?.[key]&&project.edges.some(e=>e.to===nodeId&&e.toPort===key))throw Error('该限值由引脚连线驱动，不能采用固定参数值对应');
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('采用值必须是明确的有限数值');C.sample({mode:'constant',value},0,'analog');
  if(key==='TYPE'&&![0,1].includes(value))throw Error('TYPE只允许0或1');if(key==='BASE'&&value<.1&&!(originalNode.type==='ONESHOT'&&value===0))throw Error('BASE必须至少0.1秒；仅ONESHOT允许0');if(key==='GAIN'&&value===0)throw Error('增益不能为0');
  if(parameterChoices(originalNode).some(c=>c.index!==index&&c.binding?.key===key&&c.binding.value!==value))throw Error('同一参数的其他来源采用值冲突，请先核对或解除对应');
  const next=structuredClone(project),node=next.nodes.find(n=>n.id===nodeId),at=new Date().toISOString(),binding={action:'bind',nodeType:node.type,fieldIndex:index,source:structuredClone(choice.field),key,value,note:note.trim(),at,previousValue:node.params[key],previousSource:node.provenance.parameterSources?.[key]};
  (node.provenance.manualFieldBindings??=[]).push(binding);node.params[key]=value;(node.provenance.parameterSources??={})[key]={manual:true,file:choice.field.file,attribute:choice.field.attribute,fieldIndex:index,value,note:note.trim(),at};refreshFieldIssues(next,node,choice.field,note.trim());return next;
 }
 function clearParameterBinding(project,nodeId,index,note){const{choice}=bindingContext(project,nodeId,index,note);if(!choice.binding)throw Error('此字段没有当前人工对应');const next=structuredClone(project),node=next.nodes.find(n=>n.id===nodeId),at=new Date().toISOString();node.provenance.manualFieldBindings.push({action:'clear',nodeType:node.type,fieldIndex:index,source:structuredClone(choice.field),key:choice.binding.key,note:note.trim(),at});const source=node.provenance.parameterSources?.[choice.binding.key];if(source?.manual&&source.fieldIndex===index)source.bindingCleared=at;refreshFieldIssues(next,node,choice.field,note.trim());return next;}
 const connectionCodes=new Set(['SVG_REFERENCE_UNRESOLVED','SVG_PORT_MAPPING_REQUIRED','SVG_SOURCE_UNRESOLVED']);
 function addManualCandidate(project,issueId){const issue=project.issues?.find(i=>i.id===issueId);if(!issue||issue.resolved||!connectionCodes.has(issue.code)||!issue.sourceFile||!issue.sourceInstanceKey)throw Error('请选择具有明确来源实例的未处理源连接');if(project.connectionCandidates?.some(c=>c.sourceFile===issue.sourceFile&&c.connectionInstanceKey===issue.sourceInstanceKey))throw Error('该源连接已有候选，请核对已有记录');const next=structuredClone(project);next.connectionCandidates=next.connectionCandidates||[];let serial=1;while(next.connectionCandidates.some(c=>c.id==='manual-candidate-'+serial))serial++;const candidateId='manual-candidate-'+serial;next.connectionCandidates.push({id:candidateId,status:'pending',sourceFile:issue.sourceFile,connectionId:issue.sourceObjectId||null,connectionInstanceKey:issue.sourceInstanceKey,sourceConnectionInstanceKey:issue.sourceConnectionInstanceKey||null,evidence:'manual-source-review',from:null,fromPort:null,to:null,toPort:null,sourceIssueId:issue.id});return{project:next,candidateId};}
 function resolveInto(next,id,decision,choice,note){
  if(typeof note!=='string'||!note.trim())throw Error('请填写人工核对依据或拒绝原因');
  if(!['accept','reject'].includes(decision))throw Error('未知处理决定');
  const candidate=next.connectionCandidates?.find(c=>c.id===id);if(!candidate||candidate.status!=='pending')throw Error('候选不存在或已处理');
  const resolution={note:note.trim(),at:new Date().toISOString()};
  const group=c=>c.id===candidate.id||!!candidate.connectionInstanceKey&&c.connectionInstanceKey===candidate.connectionInstanceKey&&c.sourceFile===candidate.sourceFile;
  if(decision==='accept'){
   const from=next.nodes.find(n=>n.id===choice.from),to=next.nodes.find(n=>n.id===choice.to);
   if(!from||!to||(!C.catalog[from.type]&&!C.declaredInterfaces.get(from.type)&&!from.macroReference)||(!C.catalog[to.type]&&!C.declaredInterfaces.get(to.type)&&!to.macroReference))throw Error('请选择已识别的源块与目标块');
   const output=C.ports(from).outputs[choice.fromPort],input=C.ports(to).inputs[choice.toPort];
   if(!output||!input)throw Error('请选择有效的输出和输入端口');if(!['boolean','analog','packed16'].includes(output)||!['boolean','analog','packed16'].includes(input))throw Error('端口信号类型尚未明确');if(output!==input)throw Error('端口信号类型不一致');
   const existing=next.edges.find(e=>e.to===choice.to&&e.toPort===choice.toPort);
   if(existing&&(existing.from!==choice.from||existing.fromPort!==choice.fromPort))throw Error('目标端口已有其他驱动，请先核对并删除原连接');
   const manualConfirmation={...resolution,candidateId:id,sourcePinId:candidate.sourcePinId,destinationPinId:candidate.destinationPinId,sourceInstanceKey:candidate.connectionInstanceKey,sourceConnectionInstanceKey:candidate.sourceConnectionInstanceKey||null};
   if(existing)existing.provenance={...existing.provenance,manualConfirmation};
   else next.edges.push({...choice,provenance:{file:candidate.sourceFile,evidence:candidate.evidence,manualConfirmation}});
   Object.assign(candidate,choice,{status:'accepted',resolution});
   for(const other of next.connectionCandidates)if(other.id!==id&&group(other)&&other.status==='pending'){other.status='rejected';other.resolution={...resolution,note:'同一源连接的另一候选已被人工采用：'+id+'。'+resolution.note};}
  }else{candidate.status='rejected';candidate.resolution=resolution;}
  const done=next.connectionCandidates.filter(group).every(c=>c.status!=='pending');
  for(const issue of next.issues||[]){
   if(done&&candidate.connectionInstanceKey&&issue.sourceFile===candidate.sourceFile&&issue.sourceInstanceKey===candidate.connectionInstanceKey&&connectionCodes.has(issue.code)){issue.resolved=true;issue.resolution=resolution;}
   if(issue.code==='CONNECTION_REVIEW_REQUIRED'&&next.connectionCandidates.every(c=>c.status!=='pending')){issue.resolved=true;issue.resolution={...resolution,note:'所有候选已留下人工决定。最后一项依据：'+resolution.note};}
  }
  return next;
 }
 function resolveCandidate(project,id,decision,choice,note){return resolveInto(structuredClone(project),id,decision,choice,note);}
 function rejectCandidates(project,ids,note){const next=structuredClone(project);for(const id of new Set(ids))resolveInto(next,id,'reject',{},note);return next;}
 function resolveMcrMatches(project,ids,note){
  if(typeof note!=='string'||!note.trim())throw Error('请填写本批连接的人工核对依据');
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('请选择非重复的待采用连接');
  const report=E.review(project),rows=ids.map(id=>report.rows.find(row=>row.candidateId===id));if(rows.some(row=>!row||row.status!=='matched'))throw Error('所选连接不再全部与MCR吻合，请重新核对；本批未提交');
  const next=structuredClone(project);for(const row of rows){resolveInto(next,row.candidateId,'accept',row.choice,note);const crossCheck={profile:E.PROFILE,choice:structuredClone(row.choice),svg:structuredClone(row.svg),implementation:structuredClone(row.implementation)},candidate=next.connectionCandidates.find(c=>c.id===row.candidateId),edge=next.edges.find(e=>e.from===row.choice.from&&e.fromPort===row.choice.fromPort&&e.to===row.choice.to&&e.toPort===row.choice.toPort);candidate.resolution.crossCheck=crossCheck;edge.provenance.manualConfirmation.crossCheck=structuredClone(crossCheck);}return next;
 }
 return {resolveCandidate,rejectCandidates,resolveMcrMatches,addManualCandidate,parameterChoices,bindParameter,clearParameterBinding,validateFieldBindings};
});
