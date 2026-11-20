(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./core'):root.LogicCore,node?require('./project-state'):root.LogicProjectState);if(node)module.exports=api;else root.LogicEngineering=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,F){
 'use strict';
 const TYPE='ovation-logic-engineering-project',MODEL='ordered-canvases-shared-signals-v1',clone=x=>structuredClone(x),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),nodeKey=(canvasId,nodeId)=>JSON.stringify([canvasId,nodeId]);
 const endpoint=(canvas,node)=>({canvasId:canvas.id,canvasName:canvas.name,nodeId:node.id,name:node.name.trim(),kind:node.params?.kind});
 function isProject(p){return p?.documentType===TYPE;}
 function create(project=C.newProject()){return{documentType:TYPE,formatVersion:1,title:project.title||'未命名工程',dtUs:project.dtUs,...(project.utcStart!==undefined?{utcStart:project.utcStart}:{}),canvases:[{id:'c1',name:'画布1',project:clone(project)}]};}
 function check(p){
  if(!isProject(p)||p.formatVersion!==1||typeof p.title!=='string'||!Number.isSafeInteger(p.dtUs)||p.dtUs<=0||!Array.isArray(p.canvases)||!p.canvases.length)throw Error('工程格式、版本或扫描周期无效');
  const ids=new Set();for(const c of p.canvases){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim())throw Error('画布标识缺失或重复，或画布名称为空');ids.add(c.id);const g=c.project;if(!g||![1,2,3].includes(g.schemaVersion)||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.some(n=>!n||typeof n.id!=='string'||typeof n.type!=='string'||typeof n.name!=='string'||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!n.params||typeof n.params!=='object')||g.edges.some(e=>!e||['from','fromPort','to','toPort'].some(k=>typeof e[k]!=='string')))throw Error('画布 '+c.name+' 的组态结构无效');}
  if(p.utcStart!==undefined)C.parseUtcStart(p.utcStart);
 }
 function sourceProject(p){const result=clone(p);delete result.runtimeForces;return result;}
 function signals(p){
  const map=new Map(),bindings=[],issues=[];const row=name=>{if(!map.has(name))map.set(name,{name,outputs:[],inputs:[],status:'independent'});return map.get(name);};
  for(const c of p.canvases||[])for(const n of c.project.nodes||[])if(!n.macroReference&&['INPUT','OUTPUT'].includes(n.type)){const name=n.name?.trim()||'';row(name)[n.type==='OUTPUT'?'outputs':'inputs'].push(endpoint(c,n));}
  const multi=p.canvases.length>1;for(const r of map.values()){
   r.kind=r.outputs[0]?.kind||r.inputs[0]?.kind;
   if(!r.name){r.status='conflict';issues.push({code:'SHARED_SIGNAL_NAME',message:'共享信号名称不能为空',endpoints:[...r.outputs,...r.inputs],severity:'error'});continue;}
   if(multi&&r.outputs.length>1){r.status='conflict';issues.push({code:'SHARED_SIGNAL_MULTIPLE_OUTPUTS',message:'信号 '+r.name+' 有多个 OUTPUT 来源，请保留唯一来源或更名',endpoints:[...r.outputs,...r.inputs],severity:'error'});continue;}
   r.source=r.outputs.length===1?r.outputs[0]:null;const receivers=multi&&r.source?r.inputs.filter(i=>i.canvasId!==r.source.canvasId):[];
   const invalid=receivers.filter(i=>i.kind!==r.source.kind);if(invalid.length){r.status='type-conflict';issues.push({code:'SHARED_SIGNAL_TYPE',message:'信号 '+r.name+' 的 OUTPUT / INPUT 类型不一致',endpoints:[r.source,...invalid],severity:'error'});}
   else r.status=receivers.length?'matched':r.source?'unused':'independent';
   for(const input of receivers)if(input.kind===r.source.kind)bindings.push({name:r.name,kind:r.source.kind,source:r.source,input});
  }
  return{rows:[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),bindings,issues};
 }
 function dependencyGraph(p,index=signals(p)){
  const nodes=[],edges=[],connectionCandidates=[];for(const c of p.canvases){for(const n of c.project.nodes)nodes.push({...n,id:nodeKey(c.id,n.id),...(n.packedPoint!==undefined?{packedPoint:nodeKey(c.id,n.packedPoint)}:{})});for(const e of c.project.edges)edges.push({...e,from:nodeKey(c.id,e.from),to:nodeKey(c.id,e.to)});for(const e of c.project.connectionCandidates||[])connectionCandidates.push({...e,from:nodeKey(c.id,e.from),to:nodeKey(c.id,e.to)});}
  for(const b of index.bindings)edges.push({from:nodeKey(b.source.canvasId,b.source.nodeId),to:nodeKey(b.input.canvasId,b.input.nodeId)});return{nodes,edges,connectionCandidates};
 }
 function scope(p){return{...C.executionScope(dependencyGraph(p)),model:MODEL};}
 function outputDependencies(p,canvasId,nodeId){const graph=dependencyGraph(p);return C.outputDependencies(graph,nodeKey(canvasId,nodeId));}
 function runtimeProjects(p,index=signals(p),executionScope=scope(p)){
  const inactive=new Set([...executionScope.disabled,...executionScope.suspended]);
  return p.canvases.map(c=>{
   let g=clone(c.project);g.dtUs=p.dtUs;if(p.utcStart!==undefined)g.utcStart=p.utcStart;else delete g.utcStart;const initialInputs=Object.create(null);
   for(const b of index.bindings.filter(b=>b.input.canvasId===c.id)){
    const n=g.nodes.find(n=>n.id===b.input.nodeId),source=p.canvases.find(c=>c.id===b.source.canvasId).project.nodes.find(n=>n.id===b.source.nodeId);
    const value=own(source.initial||{},'OUT')?source.initial.OUT:b.kind==='boolean'?false:0;n.params.wave={mode:'constant',value};delete n.qualityWave;initialInputs[n.id]=value;
   }
   const suspended=g.nodes.filter(n=>n.disabled!==true&&inactive.has(nodeKey(c.id,n.id))).map(n=>n.id);if(suspended.length)g=C.setNodeDisabled(g,suspended,true);
   return{canvas:c,project:g,initialInputs};
  });
 }
 function validate(p,{outputForces}={}){
  try{check(p);}catch(e){return[{code:'PROJECT',message:e.message,severity:'error'}];}
  const index=signals(p),executionScope=scope(p),active=new Set(executionScope.active),issues=index.issues.filter(i=>i.endpoints.some(e=>active.has(nodeKey(e.canvasId,e.nodeId))));
  for(const b of index.bindings)if(active.has(nodeKey(b.source.canvasId,b.source.nodeId))){const n=p.canvases.find(c=>c.id===b.source.canvasId).project.nodes.find(n=>n.id===b.source.nodeId);try{if(!own(n.initial||{},'OUT'))throw Error('未填写');C.sample({mode:'constant',value:n.initial.OUT},0,b.kind);}catch(e){issues.push({code:'SHARED_SIGNAL_INITIAL',message:'共享信号 '+b.name+' 的来源 OUTPUT 需要明确合法初态：'+e.message,canvasId:b.source.canvasId,nodeId:b.source.nodeId,severity:'error'});}}
  const forces=outputForces??p.runtimeForces??{};if(!forces||typeof forces!=='object'||Array.isArray(forces))return[...issues,{code:'PROJECT',message:'工程强制输出配置无效',severity:'error'}];
  for(const id of Object.keys(forces))if(!p.canvases.some(c=>c.id===id))issues.push({code:'PROJECT',message:'强制输出引用不存在的画布 '+id,severity:'error'});
  try{for(const r of runtimeProjects(p,index,executionScope))for(const i of [...C.validate(r.project),...C.validateOutputForces(r.project,forces[r.canvas.id]||{})])issues.push({...i,canvasId:r.canvas.id,message:r.canvas.name+'：'+i.message});}catch(e){issues.push({code:'PROJECT',message:e.message,severity:'error'});}
  return issues;
 }
 function recordingPlan(p,{outputForces}={}){
  const runtime=runtimeProjects(p),includeQuality=runtime.some(r=>C.hasQuality(r.project)),plans=runtime.map(r=>C.recordingPlan(r.project,{outputForces:(outputForces??p.runtimeForces??{})[r.canvas.id]||{},includeQuality})),sources=signals(p).rows.filter(r=>r.source),frameScalars=2+sources.length+(includeQuality?sources.filter(r=>r.kind!=='packed16').length:0)+plans.reduce((n,r)=>n+r.frameScalars,0),maxCells=2100000,maxSnapshots=Math.max(0,Math.min(10001,Math.floor(maxCells/frameScalars),Math.floor(Number.MAX_SAFE_INTEGER/p.dtUs)+1)),maxScans=Math.max(0,maxSnapshots-1);
  return{maxScans,maxSnapshots,frameScalars,maxCells,seconds:maxScans*p.dtUs/1e6};
 }
 function fingerprints(p){
  const value=clone(p),projection=clone(p);delete projection.title;
  projection.canvases=projection.canvases.map(c=>{const g=JSON.parse(F.logicKey(c.project));g.dtUs=p.dtUs;if(p.utcStart!==undefined)g.utcStart=p.utcStart;else delete g.utcStart;if(p.canvases.length>1)for(let i=0;i<g.nodes.length;i++)if(['INPUT','OUTPUT'].includes(g.nodes[i].type)&&!g.nodes[i].macroReference)g.nodes[i].name=c.project.nodes[i].name.trim();return{id:c.id,project:g};});
  return{algorithm:'SHA-256',canonicalization:'sorted-json-v1',simulationProjection:MODEL,project:F.sha256(F.canonical(value)),simulation:F.sha256(F.canonical(projection))};
 }
 function activeNodes(p){return runtimeProjects(p).flatMap(r=>C.executionProject(r.project).nodes.map(n=>({...n,id:nodeKey(r.canvas.id,n.id)})));}
 function createRun(project,options={}){
  const errors=validate(project,options);if(errors.length){const e=Error(errors.map(i=>i.message).join('\n'));e.issues=errors;throw e;}
  const original=sourceProject(project),forces=clone(options.outputForces??project.runtimeForces??{}),recorded=Object.keys(forces).some(id=>Object.keys(forces[id]||{}).length)?{...clone(original),runtimeForces:forces}:original,index=signals(original),executionScope=scope(original),active=new Set(executionScope.active);
  const runs=runtimeProjects(original,index,executionScope).map(r=>({...r,run:C.createRun(r.project,{initialInputs:r.initialInputs,outputForces:forces[r.canvas.id]||{}})}));let current,lastFailure=null;
  function reset(){const canvases=Object.fromEntries(runs.map(r=>[r.canvas.id,r.run.reset()])),shared=Object.create(null);for(const row of index.rows)if(row.source&&active.has(nodeKey(row.source.canvasId,row.source.nodeId)))shared[row.name]=canvases[row.source.canvasId].values[row.source.nodeId].OUT;current={tick:0,time:0,canvases,signals:shared};lastFailure=null;return snapshot();}
  function snapshot(){return clone(current);}
  function step(){
   const shared=Object.assign(Object.create(null),current.signals),sharedQuality=Object.assign(Object.create(null),current.signalQualities),candidates=[];
   for(const r of runs){
    const reads=new Map(index.bindings.filter(b=>b.input.canvasId===r.canvas.id).map(b=>[b.input.nodeId,b.name]));
    try{
     const candidate=r.run.prepareStep({
      readInput:n=>reads.has(n.id)?shared[reads.get(n.id)]:undefined,
      readInputQuality:n=>reads.has(n.id)?sharedQuality[reads.get(n.id)]:undefined,
      publishOutput:(n,value,quality)=>{
       const name=n.name.trim();shared[name]=value;
       if(quality==='GOOD')delete sharedQuality[name];else sharedQuality[name]=quality;
      }
     });
     candidates.push([r,candidate]);
    }catch(e){lastFailure={...r.run.manifest().diagnostics[0],canvasId:r.canvas.id,message:r.canvas.name+'：'+e.message};throw Error(lastFailure.message);}
   }
   const canvases=Object.fromEntries(candidates.map(([r,frame])=>[r.canvas.id,r.run.commitStep(frame)]));
   current={tick:current.tick+1,time:(current.tick+1)*original.dtUs/1e6,canvases,signals:shared,...(Object.keys(sharedQuality).length?{signalQualities:sharedQuality}:{})};lastFailure=null;return snapshot();
  }
  function manifest(){
   const ms=runs.map(r=>[r.canvas.id,r.run.manifest()]),first=ms[0][1],models={};for(const key of ['arithmeticModels','stateModels','monitorModels','timerModels']){const rows=ms.filter(([,m])=>m[key]);if(rows.length)models[key]=Object.assign({},...rows.map(([,m])=>m[key]));}
   const forcing=ms.flatMap(([canvasId,m])=>(m.outputForcing?.pins||[]).map(pin=>({...pin,canvasId})));
   return{engineVersion:C.ENGINE_VERSION,profile:C.PROFILE,scanModel:MODEL,sharedSignalModel:MODEL,...(ms.some(([,m])=>m.qualityModel)?{qualityModel:C.signalQuality.model}:{}),numericMode:first.numericMode,numericValidationModel:first.numericValidationModel,...models,project:clone(recorded),fingerprints:fingerprints(recorded),order:ms.flatMap(([id,m])=>m.order.map(n=>nodeKey(id,n))),execution:{model:MODEL,canvasOrder:original.canvases.map(c=>c.id),canvases:Object.fromEntries(ms.map(([id,m])=>[id,m.execution]))},executionScope:clone(executionScope),...(forcing.length?{outputForcing:{model:C.FORCE_MODEL,pins:forcing}}:{}),resultRange:{firstTick:0,lastTick:current.tick,firstTimeUs:0,lastTimeUs:current.tick*original.dtUs,executedScans:current.tick,snapshotCount:current.tick+1},diagnostics:lastFailure?[clone(lastFailure)]:[],comparisonTolerances:null,evidence:'软件约定：有序画布与同名信号；未取得 Ovation 实机多任务运行对照'};
  }
  reset();return{step,reset,snapshot,manifest};
 }
 return{TYPE,MODEL,nodeKey,isProject,create,check,sourceProject,signals,scope,outputDependencies,runtimeProjects,validate,recordingPlan,fingerprints,activeNodes,createRun};
});
