(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./core.js'):root.LogicCore,node?require('./svg-structure.js'):root.LogicSVG,node?require('./bindings.js'):root.LogicBindings,node?require('./source-semantics.js'):root.LogicSourceSemantics,node?require('./svg-auto-ports.js'):root.LogicSVGAutoPorts,node?require('./sheet-title-block.js'):root.LogicSheetTitleBlock,node?require('./macro-symbols'):root.LogicMacroSymbols,node?require('./manual-parameter-defaults'):root.LogicParameterDefaults);if(node)module.exports=api;else root.LogicImport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,S,B,A,AP,TB,MS,D){
 'use strict';
 const all=e=>[e,...Array.from(e.getElementsByTagName('*'))];
 const attrs=e=>Object.fromEntries(Array.from(e.attributes||[]).map(a=>[a.name,a.value]));
 const cls=e=>e.getAttribute('cb-classname');
 const stem=name=>name.replace(/\\/g,'/').split('/').pop().replace(/\.[^.]+$/,'').toLowerCase();
 const logicClasses=new Set(['ControlAlgorithm','FastBooleanAlgorithm','ExternalPointInterface','ControlMacroReference']),builderKinds=new Set(['ControlFunction','ControlMacro','MacroImplementation']);
 function elements(root){return all(root).filter(e=>logicClasses.has(cls(e)));}
 function parseTft(text){
  const groups=new Map();let group=null;
  for(const rawLine of text.split(/\r?\n/)){const line=rawLine.trimStart();
   const m=line.match(/^#\s+(\S+)\s+ALGID=(\S+)/);if(m){if(groups.has(m[2])){group=groups.get(m[2]);group.duplicate=true;}else{group={type:m[1],id:m[2],records:[]};groups.set(m[2],group);}}
   if(line.startsWith('PRM:')){if(!group){group={type:null,id:null,unassigned:true,records:[]};groups.set(Symbol('unassigned-tft-records'),group);}const ts=line.slice(4).match(/"[^"]*"|\S+/g)||[];const clean=s=>s?.replace(/^"|"$/g,''),field=(clean(ts[3])||'').trim(),hasValue=!field||ts.length>=8,trailingToken=clean(ts.at(-1))??'',sourceValue=hasValue?trailingToken:null,v=hasValue?Number(sourceValue):NaN;group.records.push({name:clean(ts[0])||'',field,recordType:(clean(ts[2])||'').trim(),value:hasValue&&sourceValue.trim()&&Number.isFinite(v)?v:null,sourceValue,trailingToken,parseStatus:hasValue?'parsed':'truncated',raw:rawLine});}
  }
  return groups;
 }
 function auditAuxiliaryXml(file,doc,target){
  const root=doc?.root,nodes=root?all(root):[],keys=new Map(nodes.map((e,i)=>[e,'xml-element-'+(i+1)])),tag=e=>e.localName||e.tagName,compiled=root&&tag(root)==='ControlFunction'&&(!cls(root)||nodes.some(e=>tag(e)==='ControlProgramInstruction')),known=new Set(['ControlFunction','ControlProgramInstruction','ControlProgramArgument']);
  return {file:file.name,format:!root?'invalid-xml':builderKinds.has(cls(root))?'unconsumed-control-builder':compiled?'compiled-control-program':'unsupported',association:stem(file.name)===stem(target.file.name)?'same-stem':'unmatched',root:root?{tagName:root.tagName,attributes:attrs(root)}:null,
   elements:nodes.map(e=>({instanceKey:keys.get(e),parentInstanceKey:keys.get(e.parentNode)||null,tagName:e.tagName,attributes:attrs(e),text:Array.from(e.childNodes||[]).filter(n=>[3,4].includes(n.nodeType)).map(n=>n.nodeValue).join('')})),
   instructions:compiled?nodes.filter(e=>tag(e)==='ControlProgramInstruction').map((e,i)=>({elementKey:keys.get(e),ordinal:i+1,attributes:attrs(e),arguments:Array.from(e.childNodes||[]).filter(n=>n.nodeType===1&&tag(n)==='ControlProgramArgument').map((a,j)=>({elementKey:keys.get(a),position:j+1,attributes:attrs(a)}))})):[],
   argumentsTotal:compiled?nodes.filter(e=>tag(e)==='ControlProgramArgument').length:0,unrecognizedElementKeys:nodes.filter(e=>!compiled||!known.has(tag(e))).map(e=>keys.get(e))};
 }
 function importFiles(files,Parser,options={}){
  const project=C.newProject(),issues=[];let serial=0;project.execution={model:'single-task-ordered-v1',mode:'topological',required:true,confirmation:null};
  const add=(code,message,nodeId,severity='error',extra={})=>{const i={id:'import-'+(++serial),code,message,nodeId,severity,resolved:false,...extra};issues.push(i);return i;};
  project.title='导入的组态';project.sources=files.map(f=>({name:f.name,text:f.text}));
  const docs=[];
  for(const f of files){
   if(!/\.(svg|mcr|xml)$/i.test(f.name))continue;
   try{
    if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(f.text))throw Error('不支持实体/DTD 声明');
    let parseError='';const parser=new Parser({onError:(level,message)=>{if(level!=='warning')parseError=message;}});
    const d=parser.parseFromString(f.text,'application/xml');
    if(parseError||!d.documentElement||d.getElementsByTagName('parsererror').length)throw Error(parseError||'XML 结构不完整');
    docs.push({file:f,root:d.documentElement,kind:cls(d.documentElement)});
   }catch(e){add('XML_INVALID',f.name+'：'+e.message,undefined,'error',{sourceFile:f.name});}
  }
  const svgDocs=docs.filter(d=>['ControlFunction','ControlMacro'].includes(d.kind));
  const targets=svgDocs.map(d=>({file:d.file.name,kind:d.kind,title:d.root.getAttribute('cb-sheet-title')||'',selectable:files.filter(f=>f.name===d.file.name).length===1})),explicit=Object.hasOwn(options,'target'),functions=svgDocs.filter(d=>d.kind==='ControlFunction'),preferred=functions.length?functions:svgDocs,matches=explicit?svgDocs.filter(d=>d.file.name===options.target):preferred;
  const target=matches.length===1&&targets.find(t=>t.file===matches[0].file.name)?.selectable?matches[0]:null;
  if(!target){
   const selectionRequired=matches.length>0;
   if(selectionRequired){const duplicate=matches.some(d=>!targets.find(t=>t.file===d.file.name).selectable);add(duplicate?'TARGET_AMBIGUOUS':'TARGET_SELECTION_REQUIRED',duplicate?'目标文件名重复，请重命名后重新选择文件':'发现多张 Control Sheet，请选择要编辑的主图');}
   else if(explicit)add('TARGET_NOT_FOUND','未找到指定的 Control Sheet：'+String(options.target));
   else if(!issues.length)add('FORMAT_UNKNOWN','未找到可识别的 ControlFunction/ControlMacro SVG');
   project.issues=issues;return {targetFound:false,selectionRequired,targets,project,issues,summary:{nodes:0,connections:0,usedImplementation:false,documents:svgDocs.map(d=>d.file.name)}};
  }
  project.title=target.root.getAttribute('cb-sheet-title')||target.file.name;
  project.importMetadata={file:target.file.name,kind:target.kind,internalId:target.root.getAttribute('cb-function-id'),description:target.root.getAttribute('cb-sheet-title'),taskId:target.root.getAttribute('cb-task-id'),sourceCycleKnown:false};
  project.library=[];
  if(options.includeLibrary!==false)for(const doc of svgDocs.filter(d=>d.kind==='ControlMacro')){
   if(!targets.find(t=>t.file===doc.file.name).selectable){if(!issues.some(i=>i.code==='SOURCE_CONFLICT'&&i.sourceFile===doc.file.name))add('SOURCE_CONFLICT','宏定义文件名重复，未生成定义：'+doc.file.name+'；请重命名后重新导入',undefined,'error',{sourceFile:doc.file.name});continue;}
   const localFiles=files.filter(f=>stem(f.name)===stem(doc.file.name));
   const graph=importFiles(localFiles,Parser,{target:doc.file.name,includeLibrary:false}).project;graph.sources=[];graph.library=[];
   const io=type=>graph.nodes.filter(n=>n.type===type).map(n=>({name:n.provenance.attributes[type==='INPUT'?'cb-alg-out':'cb-alg-tout']||(type+'_'+n.provenance.objectId),nodeId:n.id,kind:n.params.kind||'unknown'}));
   const declared=all(doc.root).filter(e=>cls(e)==='ControlMacroParameterInterface').map(e=>e.getAttribute('cb-param-name')).filter(Boolean),parameters=[];
   for(const n of graph.nodes)for(const [key,source]of Object.entries(n.provenance.parameterSources||{}))if(declared.includes(source.record))parameters.push({name:source.record,nodeId:n.id,key,value:n.params[key],source});
   const unmapped=declared.filter(name=>!parameters.some(p=>p.name===name));
   for(const name of unmapped)graph.issues.push({id:'unmapped-parameter-'+name,code:'MACRO_PARAMETER_UNMAPPED',severity:'error',message:'宏公开参数尚未映射：'+name,resolved:false});
   project.library.push({id:'definition:'+doc.file.name,name:doc.root.getAttribute('cb-sheet-title')||doc.file.name,crc:doc.root.getAttribute('cb-macro-crc'),sourceFile:doc.file.name,graph,inputs:io('INPUT'),outputs:io('OUTPUT'),parameters,unmappedParameters:unmapped});
  }
  const implementations=docs.filter(d=>d.kind==='MacroImplementation'&&stem(d.file.name)===stem(target.file.name));
  const implementationConflict=implementations.length>1||implementations.length===1&&files.filter(f=>f.name===implementations[0].file.name).length!==1;
  if(implementationConflict)add('SOURCE_CONFLICT','有多个同名宏实现来源，均未采用；请明确来源后重新导入');
  const impl=implementations.length===1&&!implementationConflict?implementations[0]:null;const root=impl?impl.root:target.root,rawNodes=elements(root),visible=elements(target.root);
  const tfts=files.filter(f=>/\.tft$/i.test(f.name)&&stem(f.name)===stem(target.file.name)),tftFile=tfts.length===1?tfts[0]:null;
  if(tfts.length>1)add('SOURCE_CONFLICT','有多个同名 TFT 参数来源，均未采用；请明确来源后重新导入');
  const consumedFiles=new Set(),fileUses=new Map(files.map(f=>[f,[]])),use=(file,role,sheet)=>{if(file){if(role!=='task-constraints')consumedFiles.add(file);const uses=fileUses.get(file);if(!uses.some(u=>u.role===role&&u.sheet===sheet))uses.push({role,sheet});}};
  project.executionConstraints={schemaVersion:1,taskGroups:[{scope:'import',tasks:[target,...implementations].flatMap(doc=>{const tasks=all(doc.root).filter(e=>e.hasAttribute('cb-task-id')).map(e=>({file:doc.file.name,objectId:e.getAttribute('id')||null,sourceClass:cls(e),taskId:e.getAttribute('cb-task-id')}));if(tasks.length)use(doc.file,'task-constraints',target.file.name);return tasks;})}]};
  use(target.file,'target',target.file.name);use(impl?.file,'implementation',target.file.name);use(tftFile,'parameters',target.file.name);
  for(const definition of project.library){const source=svgDocs.find(d=>d.kind==='ControlMacro'&&d.file.name===definition.sourceFile),implementation=docs.find(d=>d.kind==='MacroImplementation'&&d.file.name===definition.graph.importAudit?.implementation&&stem(d.file.name)===stem(definition.sourceFile)),parameters=files.find(f=>f.name===definition.graph.importAudit?.parameterFile);use(source?.file,'macro-definition',definition.sourceFile);use(implementation?.file,'macro-implementation',definition.sourceFile);use(parameters,'macro-parameters',definition.sourceFile);}
  const auxiliaryFiles=files.filter(f=>/\.xml$/i.test(f.name)&&!consumedFiles.has(f)),auxiliaryDocuments=auxiliaryFiles.map(f=>{use(f,'xml-audit',target.file.name);return auditAuxiliaryXml(f,docs.find(d=>d.file===f),target);});
  for(const [docIndex,doc] of auxiliaryDocuments.entries()){
   if(doc.format==='invalid-xml')continue;
   if(doc.format==='unsupported')add('AUXILIARY_FORMAT_UNSUPPORTED','辅助XML格式未支持，全部元素已保留供核对：'+doc.file,undefined,'error',{sourceFile:doc.file});
   if(doc.association==='unmatched'){add('AUXILIARY_UNASSOCIATED','辅助XML未与当前SVG同名关联，未采用其任务或内容：'+doc.file,undefined,'error',{sourceFile:doc.file});continue;}
   if(doc.format==='unconsumed-control-builder')add('AUXILIARY_BUILDER_NOT_APPLIED','XML '+doc.file+' 含Builder类型标记但未被采用为目标、实现或宏定义；全部内容保留待核对',undefined,'error',{sourceFile:doc.file});
   const taskCount=project.executionConstraints.taskGroups[0].tasks.length;
   for(const e of doc.elements)if(Object.hasOwn(e.attributes,'cb-task-id'))project.executionConstraints.taskGroups[0].tasks.push({file:doc.file,objectId:e.attributes.id||null,sourceClass:e.attributes['cb-classname']||e.tagName,taskId:e.attributes['cb-task-id']});
   if(['compiled-control-program','unconsumed-control-builder'].includes(doc.format)&&Object.hasOwn(doc.root.attributes,'task-id'))project.executionConstraints.taskGroups[0].tasks.push({file:doc.file,objectId:doc.root.attributes.id||null,sourceClass:doc.root.tagName,taskId:doc.root.attributes['task-id']});
   if(project.executionConstraints.taskGroups[0].tasks.length>taskCount)use(auxiliaryFiles[docIndex],'task-constraints',target.file.name);
   if(doc.format==='compiled-control-program'){
    add('COMPILED_PROGRAM_REVIEW_REQUIRED','编译XML '+doc.file+' 含 '+doc.instructions.length+' 条指令、'+doc.argumentsTotal+' 个参数记录；位置/类型/编译顺序未解读，需人工核对，未用于生成算法或执行计划',undefined,'error',{sourceFile:doc.file});
   }
  }
  const structure=S.analyze(target.root);
  const tft=parseTft(tftFile?.text||'');
  if(impl){
   const counts=ns=>{const c={};for(const n of ns){const k=n.getAttribute('cb-function-name');c[k]=(c[k]||0)+1;}return JSON.stringify(Object.entries(c).sort());};
   if(counts(rawNodes)!==counts(visible))add('SOURCE_CONFLICT','SVG 与 MCR 的算法种类/数量不一致，需核对来源');
  }
  const decorative=new Set(['ControlFunction','ControlMacro','MacroImplementation','AlgorithmContainer','EntityStyle','NamedObject','ControlPin','SignalSegment','SignalConnection','DynamicText','PointDescription','PointReferences','PointStatusIndicator','IncludeDocument','GroupText','ControlMacroParameterInterface']);
  for(const doc of [target,...(impl?[impl]:[])])for(const e of all(doc.root)){const c=cls(e);if(c&&!logicClasses.has(c)&&!decorative.has(c)&&!c.startsWith('Graphic'))add('UNKNOWN_ENTITY','无法确定对象用途：'+c,undefined,'error',{sourceObjectId:e.getAttribute('id'),sourceFile:doc.file.name});}
  const nodeIds=new Map(),seen=new Set(),visualForNode=new Map(),rawForNode=new Map();
  for(let i=0;i<rawNodes.length;i++){
   const e=rawNodes[i],at=attrs(e),id=e.getAttribute('id')||'missing-'+i,type=e.getAttribute('cb-function-name')||'UNKNOWN';
   if(seen.has(id)){add('SOURCE_CONFLICT','源文件存在重复对象ID：'+id);continue;}seen.add(id);
   const nodeId='source-'+id;nodeIds.set(id,nodeId);
   let visual=impl?(structure.identity.key?null:visible.find(v=>v.getAttribute('id')===id&&v.getAttribute('cb-function-name')===type)):e,layoutEvidence=visual?'same-object-id':'unmatched';
   if(!visual&&structure.identity.profile==='observed-numeric-id-v1'){const ids=structure.identity.objects.filter(o=>o.actualId===id).map(o=>o.id),candidates=visible.filter(v=>ids.includes(v.getAttribute('id'))&&v.getAttribute('cb-function-name')===type);if(candidates.length===1){visual=candidates[0];layoutEvidence='decoded-object-id';}}
   if(!visual&&at['cb-alg-alg']){const candidates=visible.filter(v=>v.getAttribute('cb-macro-alg')===at['cb-alg-alg']&&v.getAttribute('cb-function-name')===type);if(candidates.length===1){visual=candidates[0];layoutEvidence='algorithm-record-name';}}
   if(!visual){const references=n=>Object.entries(attrs(n)).filter(([key,value])=>key.startsWith('cb-alg-')&&/^\$[^$]+\$[^$]+\$$/.test(value)).map(([,value])=>value).sort();const refs=references(e);if(refs.length){const candidates=visible.filter(v=>v.getAttribute('cb-function-name')===type&&JSON.stringify(references(v))===JSON.stringify(refs));if(candidates.length===1){visual=candidates[0];layoutEvidence='type-and-reference-multiset';}}}
   if(!visual&&at['cb-alg-out']&&!at['cb-alg-out'].startsWith('$')){const symbol=at['cb-alg-out'],candidates=visible.filter(v=>v.getAttribute('cb-function-name')===type&&Object.entries(attrs(v)).some(([key,value])=>(key.startsWith('cb-alg-')||key.startsWith('cb-macro-'))&&value===symbol));if(candidates.length===1){visual=candidates[0];layoutEvidence='type-and-output-symbol';}}
   if(!visual){const candidates=visible.filter(v=>v.getAttribute('cb-function-name')===type);if(candidates.length===1){visual=candidates[0];layoutEvidence='unique-type-layout-only';}}
   const shape=visual&&all(visual).find(n=>['rect','ellipse'].includes(n.localName||n.tagName));
   const coordinate=(k,alt,fallback)=>{const v=shape?.getAttribute(k)||shape?.getAttribute(alt);return v&&Number.isFinite(Number(v))?Number(v):fallback;};
   const layout=visual&&structure.layouts[visual.getAttribute('id')];
   const n={id:nodeId,type,name:at['cb-alg-alg']||type+' '+id,x:layout?.x??coordinate('x','cx',100+(i%5)*410),y:layout?.y??coordinate('y','cy',100+Math.floor(i/5)*460),params:{},initial:{},provenance:{origin:'import',sourceFile:impl?.file.name||target.file.name,objectId:id,svgObjectId:visual?.getAttribute('id')||null,svgSourceFile:target.file.name,attributes:at,parameterSources:{},layoutMatched:!!visual,layoutEvidence}};
   rawForNode.set(nodeId,e);if(visual)visualForNode.set(nodeId,visual);
   const d=C.catalog[type],macroClass=cls(visual||e)==='ControlMacroReference';
   if(!d&&!macroClass){const declared=cls(e)!=='ControlMacroReference'&&C.declaredInterfaces.get(type);add(declared?'INTERFACE_ONLY':'UNKNOWN_BLOCK',declared?type+'接口已核对；LP.A2打包点运算尚未支持':'未支持的控制块：'+type,nodeId);}
   if(macroClass){
    const matches=project.library.filter(x=>x.name===type),definition=matches.length===1?matches[0]:null;
    n.provenance.svgClassName='ControlMacroReference';n.macroReference={displayOnly:true,name:type,crc:at['cb-macro-crc'],definitionId:definition?.id||null};
    if(definition)n.macroPorts={inputs:Object.fromEntries(definition.inputs.map(p=>[p.name,p.kind])),outputs:Object.fromEntries(definition.outputs.map(p=>[p.name,p.kind]))};
    add('DISPLAY_ONLY_MACRO','自定义宏仅还原图形和引脚，不建立仿真模型：'+type,nodeId,'warning');
   }
   if(!n.macroReference&&['INPUT','OUTPUT'].includes(type)){
    n.params.kind=null;
    if(type==='INPUT'){n.params.wave=null;add('INPUT_SCENARIO_REQUIRED','需要设置外部输入随时间变化的规律',nodeId);}
   }
   if(!n.macroReference&&['AND','OR'].includes(type)){
    const names=Object.keys(at).map(k=>k.match(/^cb-alg-in([1-8])$/)).filter(Boolean);n.params.inputs=2;
     if(names.length){const pins=names.map(m=>'IN'+m[1]);n.params.inputs=pins;try{n.params.inputs=C.gateInputConfig(pins);}catch{/* Missing required pins remain invalid for explicit repair. */}}
   }
   const fields=n.macroReference?{}:A.fields[type]||{};
   const group=tft.get(id);
   if(group?.duplicate)add('SOURCE_CONFLICT','TFT 中存在重复 ALGID：'+id+'；保留全部记录，不选择最后一份',nodeId);
   if(group&&group.type!==type)add('SOURCE_CONFLICT','TFT 的算法类型与对象不一致',nodeId);
   for(const [key,field] of Object.entries(fields)){
    const records=field===null?[]:(group?.records||[]).filter(r=>r.field===field);
    const attributes=['cb-alg-'+key.toLowerCase(),...Object.entries(d?.parameterAliases||{}).filter(([,canonical])=>canonical===key).map(([alias])=>'cb-alg-'+alias.toLowerCase())],provided=attributes.filter(attribute=>Object.hasOwn(at,attribute)),explicitAttribute=provided[0]||attributes[0],rawExplicit=at[explicitAttribute],selectableReference=d?.selectableInputs?.[key]&&/^\$[^$]+\$[^$]+\$$/.test(rawExplicit||''),explicit=selectableReference?undefined:rawExplicit;
    if(provided.some(attribute=>at[attribute]!==rawExplicit&&(!Number.isFinite(Number(at[attribute]))||!Number.isFinite(Number(rawExplicit))||Number(at[attribute])!==Number(rawExplicit)))){add('SOURCE_CONFLICT','参数 '+key+' 的明确别名值冲突，未采用',nodeId);continue;}
    if(records.length&&(!group||group.duplicate||group.type!==type))continue;
    if(records.length===1&&records[0].value!==null){n.params[key]=records[0].value;n.provenance.parameterSources[key]={file:tftFile.name,record:records[0].name,field};if(explicit!==undefined&&(explicit.trim()===''||Number(explicit)!==records[0].value))add('SOURCE_CONFLICT','SVG/TFT 参数 '+key+' 不一致',nodeId);}
    else if(records.length>1)add('SOURCE_CONFLICT','TFT 参数 '+key+' 存在多个候选',nodeId);
    else if(!records.length&&explicit!==undefined&&d?.paramChoices?.[key]?.some(choice=>choice===explicit||typeof choice==='number'&&explicit.trim()!==''&&Number(explicit)===choice)){n.params[key]=d.paramChoices[key].find(choice=>choice===explicit||typeof choice==='number'&&explicit.trim()!==''&&Number(explicit)===choice);n.provenance.parameterSources[key]={file:impl?.file.name||target.file.name,attribute:explicitAttribute};}
    else if(!records.length&&explicit!==undefined&&!d?.paramChoices?.[key]&&explicit.trim()!==''&&Number.isFinite(Number(explicit))){n.params[key]=Number(explicit);n.provenance.parameterSources[key]={file:impl?.file.name||target.file.name,attribute:explicitAttribute};}
    else if(!records.length&&explicit!==undefined)add('SOURCE_PARAMETER_INVALID','参数 '+key+' 不是明确的有限数值',nodeId);
   }
   D.apply(n,{attributes:[at,...(visual&&visual!==e?[attrs(visual)]:[])],fields,aliases:d?.parameterAliases,records:group?.records,blocked:implementationConflict||tfts.length>1||!!group&&(group.duplicate||group.type!==type)});
   for(const record of group?.records||[])if(A.role(n,record)==='parameter'&&!Object.values(fields).includes(record.field)){const key='TFT:'+record.field;if(!n.params[key])n.params[key]=[];n.params[key].push({record:record.name,value:record.value,sourceValue:record.sourceValue});}
   for(const[key,field]of Object.entries(fields))if((!Object.hasOwn(d?.defaults||{},key)||d?.optionalParameters?.includes(key))&&!Object.hasOwn(n.params,key)){const records=(group?.records||[]).filter(r=>r.field===field),attribute='cb-alg-'+key.toLowerCase();if(records.length||at[attribute]!==undefined)n.params[key]={sourceStatus:'unresolved',records,explicitValue:at[attribute]??null};}
   for(const key of Object.keys(fields))if(Object.hasOwn(n.params,key)&&!Object.hasOwn(d?.defaults||{},key)&&!group?.records.some(r=>r.field===fields[key]))add('SOURCE_PARAMETER_UNSUPPORTED','当前模式未支持导入参数 '+key,nodeId);
   {const opaque=Object.keys(at).filter(k=>k.startsWith('cb-alg-')&&!A.declaredBinding(n,k.slice(7)));if(opaque.length)add('OPAQUE_BINDINGS','存在未解析的端口/参数字段：'+opaque.join(', '),nodeId,MS.isDisplay(n)?'warning':'error',{sourceFile:impl?.file.name||target.file.name,sourceNamespace:impl?'implementation':'svg',sourceFields:opaque});}
   if(!n.macroReference){const documents=[[e,impl?.file.name||target.file.name],[visualForNode.get(nodeId),target.file.name]];
    for(const port of d?.unsupportedInputs||[]){const bindings=[];for(const[element,file]of documents)for(const prefix of ['cb-alg-','cb-macro-']){const attribute=prefix+port.toLowerCase(),value=element?.getAttribute(attribute);if(value?.trim()&&!bindings.some(b=>b.file===file&&b.attribute===attribute&&b.value===value))bindings.push({file,attribute,value});}if(bindings.length){n.params[port]={unsupportedSourceBindings:bindings};add(port==='TRIN'?'TRACKING_UNSUPPORTED':'OPTIONAL_INPUT_UNSUPPORTED','当前基本模式未开放输入 '+port+'，原绑定已保留',nodeId);}}
    for(const port of d?.unsupportedOutputs||[])if(documents.some(([element])=>['cb-alg-','cb-macro-'].some(prefix=>element?.getAttribute(prefix+port.toLowerCase())?.trim())))add('TRACKING_OUTPUT_NOT_SIMULATED','已识别但未仿真的跟踪输出 '+port+'；当前仅计算OUT',nodeId,'warning');
   }
   project.nodes.push(n);
  }
  const inputFields=A.inputFields;
  for(const e of rawNodes){const to=nodeIds.get(e.getAttribute('id'));if(!to)continue;
   for(const [attr,v] of Object.entries(attrs(e))){
    if(!attr.startsWith('cb-alg-'))continue;const key=attr.slice(7),port=A.inputField(project.nodes.find(n=>n.id===to),key);
    const ref=v.match(/^\$([^$]+)\$([^$]+)\$$/);
    if(ref&&port){const from=nodeIds.get(ref[1]);if(from)project.edges.push({from,fromPort:(()=>{const n=project.nodes.find(n=>n.id===from),key=ref[2].replace(/^cb-alg-/,'');return(!n.macroReference&&C.declaredInterfaces.outputField(n.type,key))||key.toUpperCase();})(),to,toPort:port,provenance:{file:impl?.file.name||target.file.name,attribute:attr,sourceValue:v}});else add('UNRESOLVED_REFERENCE','未找到连接源：'+ref[1],to);}
    else if(port&&v&&!(C.catalog[project.nodes.find(n=>n.id===to)?.type]?.selectableInputs?.[port]&&Object.hasOwn(project.nodes.find(n=>n.id===to).params,port)))add('EXTERNAL_BINDING_REQUIRED','输入 '+port+' 的点/常量绑定需要补充：'+v,to);
    else if(ref&&!port)add('PORT_MAPPING_REQUIRED','未支持的引用端口：'+attr,to);
   }
  }
  if(impl&&project.nodes.some(n=>!n.provenance.layoutMatched))add('LAYOUT_UNMAPPED','部分布局无法与宏实现唯一对应；采用临时位置，原始 SVG 已保留',undefined,'warning');
  const visualMap=new Map();for(const n of project.nodes){const id=n.provenance.svgObjectId;if(id){if(!visualMap.has(id))visualMap.set(id,[]);visualMap.get(id).push(n.id);}}
  const mapped=id=>visualMap.get(id)?.length===1?visualMap.get(id)[0]:null;
  for(const n of project.nodes){const visual=visualForNode.get(n.id),svgAttributes=visual?attrs(visual):{},mappingUsable=!!visual&&n.provenance.layoutEvidence!=='unique-type-layout-only'&&visualMap.get(n.provenance.svgObjectId)?.length===1&&visible.filter(v=>v.getAttribute('id')===n.provenance.svgObjectId).length===1&&rawNodes.filter(v=>v.getAttribute('id')===n.provenance.objectId).length===1;
   n.provenance.svgAttributes=svgAttributes;
   const audit=A.auditNode(n,{svgAttributes,svgFile:target.file.name,tftRecords:tft.get(n.provenance.objectId)?.records||[],tftFile:tftFile?.name,implementationFile:impl?.file.name,implementationObjects:rawNodes.map(attrs),hasImplementation:!!impl,mappingUsable});n.provenance.fieldAudit=audit.fields;
   for(const issue of audit.diagnostics){const{code,message,nodeId,...extra}=issue;add(code,message,nodeId,MS.isDisplay(n)?'warning':'error',extra);}
  }
  for(const issue of structure.issues)add(issue.code,issue.message,undefined,'error',{sourceFile:target.file.name,sourceObjectId:issue.objectId,sourceInstanceKey:issue.connectionInstanceKey,sourceConnectionInstanceKey:issue.connectionInstanceKey});
  if(!structure.identity.key||options.automaticPorts===false)for(const item of MS.apply(project,target.root,structure))add(item.code,item.message,item.nodeId,'warning');
  for(const connection of structure.connections){
   const from=mapped(connection.sourceObjectId),to=mapped(connection.destinationObjectId);
   if(!from||!to){add('SVG_NODE_MAPPING_REQUIRED','无法将图形端口归属唯一映射到宏实现',undefined,'error',{sourceFile:target.file.name,sourceObjectId:connection.connectionId});continue;}
   const sourceNode=project.nodes.find(n=>n.id===from);if(sourceNode?.macroReference&&!Object.hasOwn(C.ports(sourceNode).outputs,connection.sourcePort)&&!sourceNode.macroReference.definitionId){sourceNode.macroPorts||={inputs:{},outputs:{}};sourceNode.macroPorts.outputs[connection.sourcePort]='unknown';}
   if(sourceNode&&!sourceNode.macroReference&&!C.catalog[sourceNode.type]&&!Object.hasOwn(C.ports(sourceNode).outputs,connection.sourcePort)){sourceNode.provenance.svgDisplayOutputs||=[];if(!sourceNode.provenance.svgDisplayOutputs.includes(connection.sourcePort))sourceNode.provenance.svgDisplayOutputs.push(connection.sourcePort);}
   const edge={from,fromPort:connection.sourcePort,to,toPort:connection.destinationPort,provenance:{file:target.file.name,sourceObjectId:connection.connectionId,sourcePinId:connection.sourcePinId,destinationPinId:connection.destinationPinId,evidence:connection.evidence,...(connection.bindings?{propertyBindings:connection.bindings,graphicLineId:connection.graphicLineId}:{} )}};
   const existing=project.edges.find(e=>e.to===to&&e.toPort===edge.toPort);
   if(existing){if(existing.from!==from||existing.fromPort!==edge.fromPort)add('SOURCE_CONFLICT','图形连接与语义引用冲突',to);else existing.provenance.svgConfirmation=edge.provenance;}
   else if(impl)add('SOURCE_CONFLICT','SVG 存在 MCR 未给出的连接，请核对文件版本',to);
   else project.edges.push(edge);
  }
  project.connectionCandidates=structure.candidates.map((candidate,i)=>({id:'candidate-'+(i+1),...candidate,sourceConnectionInstanceKey:candidate.connectionInstanceKey,from:mapped(candidate.sourceObjectId),fromPort:candidate.sourcePort,to:mapped(candidate.destinationObjectId),toPort:candidate.destinationPort,status:'pending',sourceFile:target.file.name}));
  // Preserve recovered physical routes separately from executable edges. Unknown
  // pin names remain visible and editable through the existing connection repair UI.
  project.svgConnections={schemaVersion:1,identity:structure.identity,routes:structure.physicalConnections.map(route=>({...route,from:mapped(route.sourceObjectId),to:mapped(route.destinationObjectId),sourceFile:target.file.name}))};
  const automatic=(structure.identity.key||project.nodes.some(n=>MS.isDisplay(n)&&n.sourceMacroSymbol))&&options.automaticPorts!==false?AP.apply(project,target.root,structure,mapped,{implementation:!!impl}):null;
  if(automatic){project.importMetadata.automaticPorts={profile:'automatic-svg-ports-v1',...automatic.counts};project.svgConnections.portMappings=automatic.mappings;
   for(const item of automatic.issues)add(item.code,item.message,item.nodeId);
   const mappedConnections=new Set(automatic.mappings.filter(m=>m.status!=='blocked').map(m=>m.connectionInstanceKey));
   for(const issue of issues){let fixed=false;if(['SVG_PORT_MAPPING_REQUIRED','SVG_REFERENCE_UNRESOLVED'].includes(issue.code)&&mappedConnections.has(issue.sourceInstanceKey))fixed=true;
    const n=project.nodes.find(n=>n.id===issue.nodeId),known={...n?.provenance.decodedPortFields,...n?.provenance.sourcePinFields};
    if(['OPAQUE_BINDINGS','SVG_FIELDS_UNRESOLVED'].includes(issue.code)&&issue.sourceFields){issue.sourceFields=issue.sourceFields.filter(f=>!Object.hasOwn(known,f));if(!issue.sourceFields.length)fixed=true;else issue.message='尚未解析的来源字段：'+issue.sourceFields.join(', ');}
    if(issue.code==='PORT_MAPPING_REQUIRED'&&n){const refs=Object.entries(n.provenance.attributes).filter(([k,v])=>k.startsWith('cb-alg-')&&/^\$[^$]+\$cb-alg-[^$]+\$$/.test(v));if(refs.length&&refs.every(([k])=>Object.hasOwn(known,k)))fixed=true;}
    if(fixed){issue.resolved=true;issue.resolution={method:'automatic',note:'程序已按源引用、针脚编码及算法接口完成自动映射'};}}
  }
  for(const n of project.nodes)if(!n.macroReference)for(const key of Object.keys(C.catalog[n.type]?.selectableInputs||{}))if(n.provenance.parameterSources[key]?.kind==='manual-default'&&project.edges.some(edge=>edge.to===n.id&&edge.toPort===key)){delete n.params[key];delete n.provenance.parameterSources[key];}
  const titleBlock=TB.extract(target.root,target.file.name,automatic?.decoded.dynamicSources);if(titleBlock){project.titleBlock=titleBlock;if(titleBlock.sourcePaper)project.paper={...titleBlock.sourcePaper};if(titleBlock.missingFields?.length)add('TITLE_BLOCK_FIELDS_MISSING','原SVG图框未提供：'+titleBlock.missingFields.join('、'),undefined,'warning');if(titleBlock.status!=='ready')add('TITLE_BLOCK_AMBIGUOUS','图框信息存在多个候选，原文已保留',undefined,'warning');}
  const svgObjects=[];let connectionOrdinal=0;
  for(const e of all(target.root)){const c=cls(e),kind=logicClasses.has(c)?'logic':c==='SignalConnection'?'connection':c==='ControlMacroParameterInterface'?'parameter-interface':c&&!decorative.has(c)&&!c.startsWith('Graphic')?'unknown':null;if(!kind)continue;
   const objectId=e.getAttribute('id')||null,instanceKey='svg-object-'+(svgObjects.length+1),n=kind==='logic'?project.nodes.find(n=>visualForNode.get(n.id)===e):null,object={instanceKey,objectId,kind,className:c,type:e.getAttribute('cb-function-name')||null,nodeId:n?.id||null,status:'unresolved',attributes:attrs(e)};
   if(kind==='logic'){object.mappingEvidence=n?.provenance.layoutEvidence||'unmapped';object.status=n?'associated':'unmapped';object.fields=n?.provenance.fieldAudit||Object.entries(attrs(e)).filter(([k])=>/^cb-(alg|macro)-/.test(k)).map(([attribute,value])=>({namespace:'svg',file:target.file.name,attribute,value,status:'unresolved',evidence:[]}));if(!n)add('SVG_NODE_MAPPING_REQUIRED','SVG逻辑对象未关联到可编辑节点：'+(objectId||instanceKey),undefined,'error',{sourceFile:target.file.name,sourceObjectId:objectId,sourceInstanceKey:instanceKey});}
   if(kind==='connection'){const key='connection-'+(++connectionOrdinal);object.connectionInstanceKey=key;const verified=structure.connections.find(c=>c.connectionInstanceKey===key);const auto=automatic?.mappings.find(m=>m.connectionInstanceKey===key&&m.status!=='blocked');object.status=auto?(auto.status==='mapped'?'automatic-port-map':'source-pin-identity'):verified?(verified.evidence==='explicit-pin-reference-and-name'?'explicit-reference':'property-reference'):project.connectionCandidates.some(c=>c.connectionInstanceKey===key)?'candidate':'unresolved';}
   svgObjects.push(object);
  }
  const tftGroups=Array.from(tft.values()).map((g,i)=>{const n=project.nodes.find(n=>n.provenance.objectId===g.id);if(!n)add(g.unassigned?'TFT_RECORD_UNASSIGNED':'TFT_NODE_UNMAPPED',g.unassigned?'TFT存在未归属ALGID的PRM记录，已保留在清单中':'TFT算法组未找到对象：'+g.id,undefined,'error',{sourceFile:tftFile?.name,sourceObjectId:g.id});return{instanceKey:'tft-group-'+(i+1),file:tftFile?.name,objectId:g.id,type:g.type,nodeId:n?.id||null,duplicate:!!g.duplicate,unassigned:!!g.unassigned,records:g.records};});
  const implementationObjects=impl?rawNodes.map((e,i)=>{const n=project.nodes.find(n=>rawForNode.get(n.id)===e);return{instanceKey:'implementation-object-'+(i+1),objectId:e.getAttribute('id')||null,type:e.getAttribute('cb-function-name')||null,nodeId:n?.id||null,attributes:attrs(e),fields:n?n.provenance.fieldAudit.filter(f=>f.namespace==='implementation'):Object.entries(attrs(e)).filter(([k])=>k.startsWith('cb-alg-')).map(([attribute,value])=>({namespace:'implementation',file:impl.file.name,attribute,value,status:'unresolved',evidence:[]}))};}):[];
  const countedFields=project.nodes.flatMap(n=>n.provenance.fieldAudit);
  for(const o of [...svgObjects,...implementationObjects])if(!o.nodeId)countedFields.push(...(o.fields||[]));
  for(const g of tftGroups)if(!g.nodeId)for(const r of g.records)countedFields.push({status:!r.field&&r.recordType?'declared-not-interpreted':r.value===null?'invalid':'unresolved'});
  const fieldStatuses={};for(const f of countedFields)fieldStatuses[f.status]=(fieldStatuses[f.status]||0)+1;
  project.importAudit={schemaVersion:1,scope:'import-snapshot',target:target.file.name,implementation:impl?.file.name||null,parameterFile:tftFile?.name||null,note:'导入时的逐对象/字段快照，不是准确性验收；后续人工处理见项目issues与connectionCandidates。对象清单包含逻辑、连接、参数接口及未知语义类，不含已分类图形/文字装饰。辅助XML仅保留结构，编译指令和位置参数未解释。',svgObjects,implementationObjects,tftGroups,auxiliaryDocuments,parameterDefaults:project.nodes.flatMap(n=>Object.entries(n.provenance.parameterSources).filter(([,s])=>s.kind==='manual-default').map(([parameter,source])=>({nodeId:n.id,parameter,...source}))),summary:{svgLogicTotal:svgObjects.filter(x=>x.kind==='logic').length,svgLogicAssociated:svgObjects.filter(x=>x.kind==='logic'&&x.nodeId).length,svgConnectionsTotal:svgObjects.filter(x=>x.kind==='connection').length,svgConnectionsExplicit:svgObjects.filter(x=>x.kind==='connection'&&x.status==='explicit-reference').length,svgConnectionsPropertyVerified:automatic?structure.physicalConnections.filter(c=>c.corroborated).length:svgObjects.filter(x=>x.kind==='connection'&&x.status==='property-reference').length,svgConnectionsRecovered:structure.physicalConnections.length,svgConnectionsAutomaticallyMapped:automatic?automatic.mappings.filter(m=>m.status!=='blocked').length:0,svgParameterInterfacesTotal:svgObjects.filter(x=>x.kind==='parameter-interface').length,tftRecordsTotal:tftGroups.reduce((sum,g)=>sum+g.records.length,0),xmlDocumentsTotal:auxiliaryDocuments.length,xmlInstructionsTotal:auxiliaryDocuments.reduce((sum,d)=>sum+d.instructions.length,0),xmlArgumentsTotal:auxiliaryDocuments.reduce((sum,d)=>sum+d.argumentsTotal,0),fieldStatuses}};
  project.importAudit.sheetSelection={mode:explicit?'explicit':functions.length?'single-control-function':'single-sheet',targetFile:target.file.name,documents:svgDocs.map(d=>({file:d.file.name,kind:d.kind,title:d.root.getAttribute('cb-sheet-title')||'',role:d===target?'target':project.library.some(m=>m.sourceFile===d.file.name)?'macro-definition':'not-imported'}))};
  for(const doc of project.importAudit.sheetSelection.documents)if(doc.role==='not-imported'&&doc.kind==='ControlFunction')add('CONTROL_SHEET_NOT_IMPORTED','未导入到当前图纸：'+doc.file+'；原文保留在来源文件中，可另行导入',undefined,'warning',{sourceFile:doc.file});
  project.importAudit.sourceFiles=files.map((file,i)=>({instanceKey:'source-file-'+(i+1),file:file.name,uses:fileUses.get(file)}));
  for(const file of project.importAudit.sourceFiles)if(!file.uses.length&&!issues.some(i=>i.sourceFile===file.file&&['CONTROL_SHEET_NOT_IMPORTED','SOURCE_CONFLICT','XML_INVALID'].includes(i.code)))add('SOURCE_FILE_NOT_APPLIED','来源文件未采用：'+file.file+'；未用于当前图纸或宏定义，原文已保留，请核对配套文件名/格式',undefined,'warning',{sourceFile:file.file,sourceFileInstance:file.instanceKey});
  MS.inferTypes(project);
  const inferred=B.inferInterfaces(project);project.nodes=inferred.project.nodes;
  for(const d of inferred.diagnostics)add(d.code,d.message,d.nodeId,'error',{constraints:d.constraints});
  for(const n of project.nodes)if(!n.macroReference&&['INPUT','OUTPUT'].includes(n.type)&&!['boolean','analog','packed16'].includes(n.params.kind))add('SIGNAL_TYPE_REQUIRED','需要明确外部接口的信号类型',n.id);
  const pendingConnections=project.connectionCandidates.filter(c=>c.status==='pending').length;if(pendingConnections)add('CONNECTION_REVIEW_REQUIRED',automatic?'程序无法唯一解析 '+pendingConnections+' 条连接，请查看解析问题及原始来源':'存在 '+pendingConnections+' 个待确认连接候选；它们不参与仿真',undefined,impl?'warning':'error');
  add('SCAN_CONFIGURATION_REQUIRED','源文件未提供已核实扫描周期；请明确设置模拟周期',undefined,'error');
  project.issues=issues;
  // Core diagnostics are computed, not stored as stale repairable import flags.
  const computed=C.validate({...project,issues:[]});
  return {targetFound:true,selectionRequired:false,targets,project,issues:[...issues,...computed],summary:{nodes:project.nodes.length,connections:project.edges.length,usedImplementation:!!impl,target:target.file.name,documents:svgDocs.map(d=>d.file.name)}};
 }
 return {importFiles,parseTft};
});
