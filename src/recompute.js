(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./core'):root.LogicCore,node?require('./project-state'):root.LogicProjectState);if(node)module.exports=api;else root.LogicRecompute=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,F){
 'use strict';const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),same=(a,b)=>F.canonical(a)===F.canonical(b),check=(ok,message)=>{if(!ok)throw Error(message);};
 function prepare(record){
  const m=record?.manifest,frames=record?.trace;check(m&&m.project&&Array.isArray(frames)&&frames.length>=1&&frames.length<=10001,'运行记录需含manifest.project及1～10001份完整快照');
  check(typeof m.engineVersion==='string'&&m.engineVersion.length,'缺少记录引擎版本');
  for(let i=0;i<frames.length;i++)check(frames[i]&&frames[i].tick===i&&typeof frames[i].time==='number'&&Number.isFinite(frames[i].time)&&frames[i].time>=0,'运行记录必须含连续0..N扫描和有限时间，不补造缺失扫描');
  const run=C.createRun(m.project),actual=run.manifest(),lastTick=frames.length-1,lastTimeUs=lastTick*m.project.dtUs;
  check(Number.isSafeInteger(lastTimeUs),'记录逻辑时间范围超出精确整数');
  check(m.profile===actual.profile&&m.scanModel===actual.scanModel&&m.numericMode===actual.numericMode,'记录的算法profile、扫描模型或数值合同缺失/不兼容');
  check(Array.isArray(m.order)&&same(m.order,actual.order),'记录声明顺序与工程实际执行顺序不一致');
  check(m.execution&&same(m.execution,actual.execution),'记录声明扫描计划与工程不一致');
  check(same(m.executionScope??null,actual.executionScope??null),'记录禁用执行范围缺失或不一致');check(same(m.outputForcing??null,actual.outputForcing??null),'记录强制输出声明缺失或不一致');const active=C.executionProject(C.sourceProject(m.project));
  const models={};for(const n of active.nodes){const d=C.catalog[n.type],sections=[...(d.edgeState||d.stateful||d.packed?['stateModels']:[]),...(d.timer?['timerModels']:[]),...(d.monitor?['monitorModels']:[]),...(d.arithmetic?['arithmeticModels']:[])],section=sections[0];if(section){check(m[section]?.[n.type]===d.model,'记录缺少或不支持模型 '+n.type);for(const declared of sections.slice(1))if(m[declared]&&own(m[declared],n.type))check(m[declared][n.type]===d.model,'记录存在冲突或不支持模型 '+declared+'.'+n.type);models[n.type]=d.model;}}
  const numericValidationRequired=active.nodes.some(n=>{const d=C.catalog[n.type];return d.timer||d.monitor||d.arithmetic;});if(numericValidationRequired)check(m.numericValidationModel===actual.numericValidationModel,'记录缺少或不支持当前精度核对模型');
  const fingerprintCheck=m.fingerprints===undefined?'not-present':'matched';if(m.fingerprints!==undefined)check(same(m.fingerprints,actual.fingerprints),'记录工程指纹不匹配或指纹合同未支持');
  const range={firstTick:0,lastTick,firstTimeUs:0,lastTimeUs,executedScans:lastTick,snapshotCount:frames.length},rangeCheck=m.resultRange===undefined?'not-present':'matched';if(m.resultRange!==undefined)check(m.resultRange&&Object.keys(range).every(k=>m.resultRange[k]===range[k]),'记录声明范围与完整轨迹/周期不一致');
  const failures=m.diagnostics===undefined?[]:m.diagnostics;check(Array.isArray(failures)&&failures.length<=1,'记录故障诊断格式未支持');
  const failure=failures[0];if(failures.length)check(failure&&typeof failure==='object'&&!Array.isArray(failure)&&['SCAN_FAILED','TIME_INDEX_RANGE'].includes(failure.code)&&failure.tick===lastTick+1&&(failure.code==='SCAN_FAILED'?typeof failure.nodeId==='string'&&Number.isSafeInteger(failure.timeUs)&&failure.timeUs===(lastTick+1)*m.project.dtUs:failure.nodeId===null&&!own(failure,'timeUs')),'记录末次故障的类型/扫描范围/时间无效');
  let status='ready',processed=0,differenceCount=0,actualRange=null,actualFailure=null;const differences=[];
  const preview=v=>v&&typeof v==='object'?{kind:Array.isArray(v)?'array':'object',keys:Object.keys(v).slice(0,12)}:typeof v==='number'&&!Number.isFinite(v)?String(v):v;
  function difference(path,expected,computed,expectedPresent=true,actualPresent=true){differenceCount++;if(differences.length<200)differences.push({path,expected:{present:expectedPresent,value:preview(expected)},actual:{present:actualPresent,value:preview(computed)}});}
  function compare(expected,computed,path){
   if(expected===computed)return;const ea=Array.isArray(expected),ca=Array.isArray(computed);
   if(expected&&computed&&typeof expected==='object'&&typeof computed==='object'&&ea===ca){for(const key of new Set([...Object.keys(expected),...Object.keys(computed)])){const ep=own(expected,key),ap=own(computed,key);if(!ep||!ap)difference([...path,key],expected[key],computed[key],ep,ap);else compare(expected[key],computed[key],[...path,key]);}return;}
   difference(path,expected,computed);
  }
  function finish(){
   if(failure){try{run.step();difference(['manifest','diagnostics'],'应发生已记录的失败扫描','扫描却成功');}catch{actualFailure=run.manifest().diagnostics[0]||null;for(const key of ['code','tick','nodeId',...(failure.code==='SCAN_FAILED'?['timeUs']:[])])if(failure[key]!==actualFailure?.[key])difference(['manifest','diagnostics',key],failure[key],actualFailure?.[key]);}}
   actualRange=run.manifest().resultRange;status=differenceCount?'different':'matched';
  }
  function advance(count=1){check(Number.isInteger(count)&&count>0,'分片次数必须为正整数');if(!['ready','running'].includes(status))return progress();status='running';for(let i=0;i<count&&processed<frames.length;i++){
    let snapshot;try{snapshot=processed===0?run.snapshot():run.step();}catch(e){actualFailure=run.manifest().diagnostics[0]||{message:e.message};difference(['trace',processed],'应产生已记录的完整扫描',actualFailure);status='different';actualRange=run.manifest().resultRange;return progress();}
    compare(frames[processed],snapshot,['trace',processed]);processed++;
   }if(processed===frames.length)finish();return progress();
  }
  function progress(){return{status,processedSnapshots:processed,totalSnapshots:frames.length};}
  function report(){return{format:'simulator-record-recompute-v1',scope:'完整快照字段及JSON数值精确比较；故障比较code/tick/node/time，不比较诊断措辞',...progress(),matched:status==='matched',recordEngineVersion:m.engineVersion,actualEngineVersion:C.ENGINE_VERSION,engineChanged:m.engineVersion!==C.ENGINE_VERSION,profile:C.PROFILE,models,numericValidationModel:actual.numericValidationModel,numericValidationCheck:numericValidationRequired?'matched':'not-required',fingerprints:structuredClone(actual.fingerprints),recordedFingerprints:m.fingerprints===undefined?null:structuredClone(m.fingerprints),fingerprintCheck,rangeCheck,diagnosticsCheck:m.diagnostics===undefined?'not-present':failure?(status==='matched'?'reproduced':['ready','running','cancelled'].includes(status)?'not-completed':'different'):'none-recorded',traceRange:range,declaredRange:m.resultRange===undefined?null:structuredClone(m.resultRange),actualRange,differenceCount,differences:structuredClone(differences),actualFailure,ovationRuntimeEvidence:false,note:'以当前引擎按相同声明模型复算，不启动旧引擎；结果不证明来源真实性或Ovation现场符合性'};}
  function result(){check(status==='matched','记录未完全匹配，不能载入');const p=run.manifest().project;return{project:C.sourceProject(p),outputForces:p.schemaVersion===4?structuredClone(p.runtimeForces):{},run,trace:frames.slice()};}
  return{advance,progress,report,result,cancel:()=>{if(['ready','running'].includes(status))status='cancelled';}};
 }
 return{prepare};
});
