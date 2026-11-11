/* Offline classic script; also loadable by Node's built-in test runner. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./project-state.js'):root.LogicProjectState,node?require('./declared-interfaces.js'):root.LogicDeclaredInterfaces,node?require('./basic-analog.js'):root.LogicBasicAnalog,node?require('./elementary.js'):root.LogicElementary,node?require('./point-records.js'):root.LogicPointRecords,node?require('./packed-words.js'):root.LogicPackedWords,node?require('./firstout.js'):root.LogicFirstOut,node?require('./bcd.js'):root.LogicBCD,node?require('./transport.js'):root.LogicTransport);if(node)module.exports=api;else root.LogicCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(F,DI,B,E,PR,P,FO,BC,TR){
 'use strict';
 const PROFILE='ref1100-2006-normal-v1';
 const ENGINE_VERSION='0.30.0';
 const FORCE_MODEL='publish-override-private-state-v1';
 const DISABLE_MODEL='dependency-closure-v1';
 // A disabled output has no value. Suspend every consumer instead of inventing one.
 function executionScope(p){
  const nodes=Array.isArray(p?.nodes)?p.nodes.filter(Boolean):[],edges=Array.isArray(p?.edges)?p.edges:[],disabled=nodes.filter(n=>n.disabled===true).map(n=>n.id),inactive=new Set(disabled),followers=new Map(),groups=new Map();
  const pending=Array.isArray(p?.connectionCandidates)?p.connectionCandidates.filter(c=>c?.status==='pending'):[];
  for(const e of [...edges,...pending])if(e){if(!followers.has(e.from))followers.set(e.from,[]);followers.get(e.from).push(e.to);}
  for(const n of nodes)if(typeof n.packedPoint==='string'){if(!groups.has(n.packedPoint))groups.set(n.packedPoint,[]);groups.get(n.packedPoint).push(n.id);}
  const byId=new Map(nodes.map(n=>[n.id,n])),queue=[...inactive];for(let i=0;i<queue.length;i++){const id=queue[i],n=byId.get(id);for(const next of [...(followers.get(id)||[]),...(groups.get(n?.packedPoint)||[])])if(byId.has(next)&&!inactive.has(next)){inactive.add(next);queue.push(next);}}
  return{model:DISABLE_MODEL,disabled,suspended:nodes.filter(n=>inactive.has(n.id)&&n.disabled!==true).map(n=>n.id),active:nodes.filter(n=>!inactive.has(n.id)).map(n=>n.id)};
 }
 function executionProject(p){
  if(!Array.isArray(p?.nodes)||!Array.isArray(p?.edges))return p;
  const scope=executionScope(p);if(!scope.disabled.length)return p;
  const inactive=new Set([...scope.disabled,...scope.suspended]),active=new Set(scope.active),nodes=p.nodes.filter(n=>!inactive.has(n?.id)),edges=p.edges.filter(e=>!inactive.has(e?.from)&&!inactive.has(e?.to));
  const candidates=Array.isArray(p.connectionCandidates)?p.connectionCandidates:[],activeCandidates=candidates.filter(c=>!inactive.has(c?.from)&&!inactive.has(c?.to)),pendingCount=activeCandidates.filter(c=>c?.status==='pending').length,sourceConnections=new Map();
  const key=(file,id)=>typeof file==='string'&&typeof id==='string'?JSON.stringify([file,id]):null;
  for(const row of [...candidates,...(Array.isArray(p.svgConnections?.routes)?p.svgConnections.routes:[])]){const id=key(row?.sourceFile,row?.connectionInstanceKey||row?.sourceConnectionInstanceKey);if(id){if(!sourceConnections.has(id))sourceConnections.set(id,[]);sourceConnections.get(id).push(row);}}
  const relevant=i=>{
   if(inactive.has(i?.nodeId)||Number.isInteger(i?.edgeIndex)&&p.edges[i.edgeIndex]&&(inactive.has(p.edges[i.edgeIndex].from)||inactive.has(p.edges[i.edgeIndex].to))||i?.code==='SCAN_CONFIGURATION_REQUIRED'&&!nodes.length)return false;
   if(i?.code==='CONNECTION_REVIEW_REQUIRED'&&candidates.some(c=>c?.status==='pending')&&!pendingCount)return false;
   const rows=sourceConnections.get(key(i?.sourceFile,i?.sourceInstanceKey))||sourceConnections.get(key(i?.sourceFile,i?.sourceConnectionInstanceKey));
   return !rows?.length||!rows.every(row=>inactive.has(row.to)||inactive.has(row.from)&&!row.to);
  };
  const scopedIssue=i=>{let result=i;if(Number.isInteger(i?.edgeIndex)&&p.edges[i.edgeIndex])result={...i,edgeIndex:edges.indexOf(p.edges[i.edgeIndex])};if(i?.code==='CONNECTION_REVIEW_REQUIRED'&&pendingCount)result={...result,message:'当前参与范围存在 '+pendingCount+' 个待确认连接；仍需处理后才能仿真。'};return result;};
  return{...p,nodes,edges,...(Array.isArray(p.packedPoints)?{packedPoints:p.packedPoints.filter(point=>p.nodes.some(n=>active.has(n?.id)&&n.packedPoint===point?.id))}:{}),...(Array.isArray(p.issues)?{issues:p.issues.filter(relevant).map(scopedIssue)}:{}),...(Array.isArray(p.connectionCandidates)?{connectionCandidates:activeCandidates}:{}),...(p.execution?.mode==='explicit'&&Array.isArray(p.execution.order)?{execution:{...p.execution,order:p.execution.order.filter(id=>!inactive.has(id))}}:{})};
 }
 function setNodeDisabled(project,ids,disabled){
  if(typeof disabled!=='boolean'||!Array.isArray(ids)||!ids.length||ids.some(id=>!project.nodes.some(n=>n.id===id)))throw Error('禁用设置的模块不存在或状态无效');
  const previous=executionPlan(project),next=clone(project);next.schemaVersion=3;next.disableModel=DISABLE_MODEL;for(const n of next.nodes)if(ids.includes(n.id))n.disabled=disabled;
  // Keep the full declared order; only its active subsequence is executed.
  if(previous.confirmed&&next.execution){
   const confirmation=next.execution.confirmation,reviewed=confirmation.reviewedScope||{model:DISABLE_MODEL,nodeIds:previous.order,signature:previous.signature},valid=reviewed.model===DISABLE_MODEL&&Array.isArray(reviewed.nodeIds)&&typeof reviewed.signature==='string',allowed=new Set(valid?reviewed.nodeIds:[]),plan=executionPlan(next);
   const basis=valid?executionPlan({...next,nodes:next.nodes.map(n=>({...n,disabled:!allowed.has(n.id)}))}):null;
   if(valid&&plan.order.every(id=>allowed.has(id))&&basis.signature===reviewed.signature&&!plan.issues.some(i=>i.code!=='EXECUTION_CONFIRMATION_REQUIRED'))next.execution.confirmation={...confirmation,signature:plan.signature,reviewedScope:clone(reviewed)};
  }
  return next;
 }
 function outputDependencies(project,outputId){
  const nodes=project?.nodes,edges=project?.edges;if(!Array.isArray(nodes)||!Array.isArray(edges))throw Error('工程结构无效');
  const byId=new Map(nodes.filter(Boolean).map(n=>[n.id,n])),output=byId.get(outputId);if(!output||output.type!=='OUTPUT'||output.macroReference)throw Error('溯源恢复只能选择OUTPUT观察点');
  const predecessors=new Map(),groups=new Map(),pending=Array.isArray(project.connectionCandidates)?project.connectionCandidates.filter(c=>c?.status==='pending'):[];
  for(const e of [...edges,...pending])if(e&&byId.has(e.from)&&byId.has(e.to)){if(!predecessors.has(e.to))predecessors.set(e.to,[]);predecessors.get(e.to).push(e.from);}
  for(const n of nodes)if(typeof n?.packedPoint==='string'){if(!groups.has(n.packedPoint))groups.set(n.packedPoint,[]);groups.get(n.packedPoint).push(n.id);}
  const found=new Set([outputId]),queue=[outputId];for(let i=0;i<queue.length;i++){const id=queue[i],node=byId.get(id);for(const parent of [...(predecessors.get(id)||[]),...(groups.get(node.packedPoint)||[])])if(!found.has(parent)){found.add(parent);queue.push(parent);}}
  return nodes.filter(n=>found.has(n.id)).map(n=>n.id);
 }
 const NUMERIC_VALIDATION_MODEL='f32-f64-output-agreement-v1';
 const clone=x=>structuredClone(x);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const catalog=Object.assign(Object.create(null),{
  INPUT:{label:'输入信号',group:'信号',defaults:{kind:'boolean',wave:{mode:'constant',value:false}},source:'软件信号源；非 Ovation 算法'},
  OUTPUT:{label:'观察点',group:'信号',defaults:{kind:'boolean'},source:'软件观察点；非 Ovation 算法'},
  AND:{label:'与门',group:'逻辑',defaults:{inputs:2},source:'REF_1100 §4.7，p36；IN1/IN2必选，IN3～IN8可独立选用'},
  OR:{label:'或门',group:'逻辑',defaults:{inputs:2},source:'REF_1100 §4.70，p260；当前范围IN1/IN2必选，IN3～IN8可独立选用'},
  NOT:{label:'非门',group:'逻辑',defaults:{},source:'REF_1100 §4.66，p253'},
  XOR:{label:'异或',group:'逻辑',defaults:{},source:'REF_1100 §4.127，p423～424'},
  FLIPFLOP:{label:'置位/复位记忆',group:'状态',defaults:{TYPE:0},stateTypes:{memory:'boolean'},source:'REF_1100 §4.40，p168～169；显式用户初态，不等同控制器重启'},
  AAFLIPFLOP:{label:'上升沿翻转记忆',group:'状态',edgeState:true,model:'ref1100-2006-aaflipflop-v1',defaults:{},optionalInputs:['INIT'],stateTypes:{memory:'boolean',previousSRST:'boolean',firstPass:'boolean'},source:'REF_1100 §4.2 p25～26；SRST/RSET及可选INIT均数字，OUT数字。首次执行RSET优先，否则采用已连接INIT或保持显式OUT初态；以后仅SRST上升沿翻转，RSET始终优先，INIT不再参与。软件复位重新开始首次执行；GOOD质量范围。'},
  PULSECNT:{label:'上升沿脉冲计数',group:'状态',edgeState:true,inputHistory:true,model:'ref1100-2006-pulsecnt-v1',defaults:{},stateTypes:{previousIN1:'boolean'},source:'REF_1100 §4.79 p296；IN1/RSET数字，OUT模拟。先复位为0，再对新上升沿加1，因此同拍复位与新沿得1；持续高不重复计数。显式OUT/previousIN1初态；当前非负精确整数0～2^24，超界新脉冲整拍拒绝，不猜溢出。'},
  HIGHMON:{label:'高限监视 / 回差',group:'状态',monitor:true,model:'ref1100-2006-monitor-v2',selectableInputs:{HISP:'HISP'},defaults:{HISP:0,HIDB:0},stateTypes:{memory:'boolean'},source:'REF_1100 §4.46，p187；IN1/HISP模拟，OUT数字；严格比较、显式初态；正常有限数'},
  LOWMON:{label:'低限监视 / 回差',group:'状态',monitor:true,model:'ref1100-2006-monitor-v2',selectableInputs:{LOSP:'LOSP'},defaults:{LOSP:0,LODB:0},stateTypes:{memory:'boolean'},source:'REF_1100 §4.59，p219；IN1/LOSP模拟，OUT数字；严格比较、显式初态；正常有限数'},
  ABSVALUE:{label:'绝对值',group:'数值',defaults:{},source:'REF_1100 §4.3，p27；正常有限实数'},
  GAINBIAS:{label:'增益/偏置/限幅',group:'数值',arithmetic:true,model:'ref1100-2006-gainbias-v1',defaults:{GAIN:1,BIAS:0,BTSC:0,TPSC:100,TRAT:2.5,PROQ:1},optionalParameters:['TRAT','PROQ'],paramChoices:{PROQ:[0,1]},unsupportedInputs:['TRIN'],unsupportedOutputs:['TOUT'],source:'REF_1100 §4.42 p174～177；无跟踪、GOOD限定。TRAT保存跟踪速率但不参与当前OUT；PROQ0/OFF与1/ON在本范围均输出GOOD，非GOOD/跟踪仍未实现'},
  ONDELAY:{label:'接通延时',group:'状态',model:'ref1100-2006-scan-v3',timer:true,defaults:{BASE:1,TARG:0},stateTypes:{timing:'boolean',started:'boolean',elapsedUs:'analog',anchorACT:'analog'},source:'REF_1100 §4.68，p256～257；固定BASE/TARG、显式用户初态。普通目标复位后首次启动当拍ACT保持，暂停时保持，恢复当拍立即继续累计；ENBL FALSE清零并重置启动状态。扫描计时模型v3，精度分歧时停止，未实机对照'},
  OFFDELAY:{label:'断开延时',group:'状态',model:'ref1100-2006-scan-v2',timer:true,inputHistory:true,defaults:{BASE:1,TARG:0},stateTypes:{timing:'boolean',elapsedUs:'analog',anchorACT:'analog',previousIN1:'boolean'},source:'REF_1100 §4.67，p254～255；固定BASE/TARG、显式OUT/ACT/上一拍IN1；扫描模型v2，精度分歧时停止，未实机对照'},
  ONESHOT:{label:'单次脉冲',group:'状态',model:'ref1100-2006-scan-v2',timer:true,inputHistory:true,defaults:{BASE:1,TARG:0},stateTypes:{timing:'boolean',elapsedUs:'analog',anchorACT:'analog',previousIN1:'boolean'},source:'REF_1100 §4.69，p258～259；固定BASE/TARG、显式OUT/ACT/上一拍IN1；BASE0表示1秒；扫描模型v2，精度分歧时停止，未实机对照'}
 });
 Object.assign(catalog,B.catalog);
 Object.assign(catalog,E.catalog,P.catalog,FO.catalog,BC.catalog,TR.catalog);
 Object.values(catalog).forEach(d=>{d.evidence=d.group==='信号'?'软件定义':'文档规则；未取得 Ovation 运行对照';});
 function gateInputPins(value){
  if(Number.isInteger(value)&&value>=2&&value<=8)return Array.from({length:value},(_,i)=>'IN'+(i+1));
  const error='输入引脚须为2～8的连续输入数量，或包含IN1/IN2、无重复的IN1～IN8端口名数组';
  if(!Array.isArray(value)||value.length<2||value.length>8)throw Error(error);
  for(const pin of value)if(typeof pin!=='string'||!/^IN[1-8]$/.test(pin))throw Error(error);
  if(new Set(value).size!==value.length||!value.includes('IN1')||!value.includes('IN2'))throw Error(error);
  return [...value].sort((a,b)=>Number(a.slice(2))-Number(b.slice(2)));
 }
 function gateInputConfig(value){const pins=gateInputPins(value);return pins.every((pin,i)=>pin==='IN'+(i+1))?pins.length:pins;}
 function ports(n){
  if(n.macroReference&&!n.macroPorts)return{inputs:{},outputs:{}};
  if(n.macroReference&&n.macroPorts)return{inputs:{...n.macroPorts.inputs},outputs:{...n.macroPorts.outputs}};
  if(!catalog[n.type]){const d=!n.macroReference&&DI.get(n.type);return d?{inputs:{...d.inputs},outputs:{...d.outputs}}:{inputs:{},outputs:{}};}
  if(TR.catalog[n.type])return TR.ports(n);
  if(BC.catalog[n.type])return BC.ports(n);
  if(FO.catalog[n.type])return FO.ports(n);
  if(P.catalog[n.type])return P.ports(n);
  if(B.catalog[n.type])return B.ports(n.type);
  if(E.catalog[n.type])return E.ports(n);
  const kind=['analog','boolean','packed16'].includes(n.params?.kind)?n.params.kind:'unknown';let ins=[],out='boolean';
  if(n.type==='INPUT')out=kind;
  else if(n.type==='OUTPUT')return{inputs:{IN1:kind},outputs:{}};
  else if(['AND','OR'].includes(n.type)){let pins;try{pins=gateInputPins(n.params?.inputs);}catch{pins=['IN1','IN2'];}ins=pins.map(pin=>[pin,'boolean']);}
  else if(n.type==='XOR')ins=[['IN1','boolean'],['IN2','boolean']];
  else if(n.type==='FLIPFLOP')ins=[['SET','boolean'],['RSET','boolean']];
  else if(n.type==='AAFLIPFLOP')ins=[['SRST','boolean'],['RSET','boolean'],['INIT','boolean']];
  else if(n.type==='PULSECNT'){ins=[['IN1','boolean'],['RSET','boolean']];out='analog';}
  else if(['ABSVALUE','GAINBIAS'].includes(n.type)){ins=[['IN1','analog']];out='analog';}
  else if(catalog[n.type].monitor)ins=[['IN1','analog'],[n.type==='HIGHMON'?'HISP':'LOSP','analog']];
  else if(n.type==='ONDELAY')ins=[['IN1','boolean'],['ENBL','boolean']];
  else if(['NOT','OFFDELAY','ONESHOT'].includes(n.type))ins=[['IN1','boolean']];
  return {inputs:Object.fromEntries(ins),outputs:catalog[n.type].timer?{OUT:out,ACT:'analog'}:{OUT:out}};
 }
 // Observed values are distinct from connectable output pins.
 function valueTypes(n){return n.type==='OUTPUT'&&!n.macroReference?{OUT:ports(n).inputs.IN1}:ports(n).outputs;}
 // Overrides belong to a page session. Schema 4 is reserved for reproducible run evidence.
 const recordObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 function sourceProject(p){
  if(p?.schemaVersion!==4)return clone(p);
  if(p.forceModel!==FORCE_MODEL||![1,2,3].includes(p.editorSchemaVersion)||!recordObject(p.runtimeForces))throw Error('强制运行记录版本或模型无效');
  const source=clone(p);source.schemaVersion=source.editorSchemaVersion;delete source.editorSchemaVersion;delete source.forceModel;delete source.runtimeForces;return source;
 }
 function forceableOutputs(n){return ['INPUT','OUTPUT'].includes(n?.type)?{}:Object.fromEntries(Object.entries(ports(n).outputs).filter(([,kind])=>kind==='boolean'||kind==='analog'));}
 function forceOutputIssues(n,map){
  const issues=[],add=message=>issues.push({code:'FORCE_OUTPUT',message,nodeId:n.id,severity:'error'});
  if(!recordObject(map)){add('强制输出必须是逐引脚配置');return issues;}
  const eligible=forceableOutputs(n);for(const [port,value]of Object.entries(map)){
   if(!own(eligible,port)){add(n.name+'：不能强制该输出 '+port+'；仅支持非INPUT/OUTPUT模块的数字量、模拟量输出');continue;}
   try{typed(value,eligible[port]);}catch(e){add(n.name+'.'+port+' 强制值：'+e.message);}
  }return issues;
 }
 function validateOutputForces(p,overrides){
  if(!recordObject(overrides))return[{code:'FORCE_OUTPUT',message:'强制输出配置必须是模块/引脚映射',severity:'error'}];
  const nodes=new Map((p?.nodes||[]).map(n=>[n.id,n])),active=new Set(executionScope(p).active),issues=[];
  for(const [id,map]of Object.entries(overrides)){const n=nodes.get(id);if(!n)issues.push({code:'FORCE_OUTPUT',message:'强制输出引用的模块不存在：'+id,nodeId:id,severity:'error'});else if(active.has(id))issues.push(...forceOutputIssues(n,map));}return issues;
 }
 function outputForcing(p,overrides){
  const source=p?.schemaVersion===4?sourceProject(p):p,config=overrides===undefined?(p?.schemaVersion===4?p.runtimeForces:{}):overrides,active=new Set(recordObject(config)&&Object.keys(config).length?executionScope(source).active:[]),pins=[];
  if(recordObject(config))for(const n of source.nodes||[])if(active.has(n.id)&&recordObject(config[n.id]))for(const [port,requested]of Object.entries(config[n.id])){const kind=forceableOutputs(n)[port];if(kind)try{pins.push({nodeId:n.id,port,kind,requested,value:typed(requested,kind)});}catch{}}
  pins.sort((a,b)=>a.nodeId.localeCompare(b.nodeId,'en')||a.port.localeCompare(b.port,'en'));return{model:FORCE_MODEL,pins};
 }
 // Recording limits are presentation/resource policy, not algorithm semantics.
 function recordingPlan(p,{outputForces}={}){
  const forced=new Set(outputForcing(p,outputForces).pins.map(pin=>pin.nodeId));p=executionProject(p?.schemaVersion===4?sourceProject(p):p);
  const nodes=Array.isArray(p?.nodes)?p.nodes.filter(Boolean):[],shared=Array.isArray(p?.packedPoints)?p.packedPoints.length:0,maxCells=2100000;
  let frameScalars=2+shared;for(const n of nodes){frameScalars+=Object.keys(valueTypes(n)).length*(forced.has(n.id)?2:1);if(!n.macroReference)frameScalars+=Object.keys(catalog[n.type]?.stateTypes||{}).length;if(shared)frameScalars+=Object.values(ports(n).inputs).filter(kind=>kind==='packed16').length;}
  const validTime=Number.isSafeInteger(p?.dtUs)&&p.dtUs>0,timeScans=validTime?Math.floor(Number.MAX_SAFE_INTEGER/p.dtUs):0,maxSnapshots=Math.max(0,Math.min(10001,Math.floor(maxCells/frameScalars),timeScans+1)),maxScans=Math.max(0,maxSnapshots-1);
  return{maxScans,maxSnapshots,frameScalars,maxCells,seconds:validTime?maxScans*p.dtUs/1e6:0};
 }
 function newProject(){return {schemaVersion:2,engineVersion:ENGINE_VERSION,profile:PROFILE,title:'未命名逻辑',dtUs:100000,nodes:[],edges:[],issues:[],sources:[]};}
 function newNode(type,id,x=80,y=80){const def=catalog[type],initial=!catalog[type]&&DI.get(type)?{}:Object.fromEntries(Object.entries(valueTypes({type,params:def?.defaults})).map(([key,kind])=>[key,kind==='boolean'?false:0]));if(def?.inputHistory)initial.previousIN1=false;for(const [key,kind]of Object.entries(def?.initialStateTypes||{}))initial[key]=kind==='boolean'?false:0;return {id,type,name:type,x,y,params:clone(def?.defaults||{}),initial,provenance:{origin:'manual'}};}
 function typed(v,kind){
  if(kind==='packed16')return P.word(v);
  if(kind==='boolean'){if(typeof v!=='boolean')throw Error('数字信号必须为布尔 true/false');return v;}
  if(kind!=='analog')throw Error('信号类型尚未明确');
  if(typeof v!=='number'||!Number.isFinite(v))throw Error('模拟信号必须为有限数值');
  const f=Math.fround(v);
  if(!Number.isFinite(f)||(v!==0&&Math.abs(v)<2**-126))throw Error('数值超出已支持的正常 Float32 范围');
  return f;
 }
 const WAVE_FIELDS={constant:['mode','value'],step:['mode','at','before','after'],ramp:['mode','start','value','slope'],table:['mode','points'],linear:['mode','points']};
 function checkWave(w,kind){
  if(!w||typeof w!=='object'||Array.isArray(w))throw Error('输入规律结构必须是对象');
  if(typeof w.mode!=='string'||!own(WAVE_FIELDS,w.mode))throw Error('未知输入规律');
  const extra=Object.keys(w).filter(key=>!WAVE_FIELDS[w.mode].includes(key));if(extra.length)throw Error('未支持的输入规律字段 '+extra.join(', ')+'；时间单位固定为秒');
  const time=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('时间必须为非负有限秒数');};
  if(w.mode==='constant')typed(w.value,kind);
  else if(w.mode==='step'){time(w.at);typed(w.before,kind);typed(w.after,kind);}
  else if(w.mode==='ramp'){if(kind!=='analog')throw Error('斜坡仅适用于模拟量');time(w.start);typed(w.value,kind);typed(w.slope,kind);}
  else if(w.mode==='table'||w.mode==='linear'){
   if(w.mode==='linear'&&kind!=='analog')throw Error('线性插值仅适用于模拟量');
   if(!Array.isArray(w.points)||!w.points.length)throw Error('分段信号必须包含节点');
   let last=-1;for(const p of w.points){if(!Array.isArray(p)||p.length!==2)throw Error('分段节点须为 [秒,值]');time(p[0]);if(p[0]<=last)throw Error('节点时间必须严格递增');last=p[0];typed(p[1],kind);}
  }else throw Error('未知输入规律');
 }
 function sample(w,t,kind){
  checkWave(w,kind);let v;
  if(w.mode==='constant')v=w.value;
  else if(w.mode==='step')v=t>=w.at?w.after:w.before;
  else if(w.mode==='ramp')v=w.value+Math.max(0,t-w.start)*w.slope;
  else{
   const ps=w.points;let i=0;while(i+1<ps.length&&ps[i+1][0]<=t)i++;
   v=ps[i][1];if(w.mode==='linear'&&t>=ps[0][0]&&i+1<ps.length){const b=ps[i+1];v+=(b[1]-v)*(t-ps[i][0])/(b[0]-ps[i][0]);}
  }
  return typed(v,kind);
 }
 function schedule(p){
  const ids=p.nodes.map(n=>n.id),degree=new Map(ids.map(id=>[id,0])),next=new Map(ids.map(id=>[id,[]]));
  for(const e of p.edges)if(e&&degree.has(e.from)&&degree.has(e.to)){degree.set(e.to,degree.get(e.to)+1);next.get(e.from).push(e.to);}
  const ready=ids.filter(id=>degree.get(id)===0).sort(),order=[];
  while(ready.length){const id=ready.shift();order.push(id);for(const to of next.get(id)){degree.set(to,degree.get(to)-1);if(degree.get(to)===0){ready.push(to);ready.sort();}}}
  return {order,cyclic:order.length!==ids.length};
 }
 const SCAN_MODEL='single-task-ordered-v1';
 function requiresExecutionReview(p){return!!p.nodes?.some(n=>n&&Object.hasOwn(n,'packedPoint'))||!!p.execution?.required||!!p.executionConstraints||!!p.importAudit||p.nodes?.some(n=>n?.provenance?.origin==='import')||(Array.isArray(p.sources)&&p.sources.some(s=>typeof s?.name==='string'&&/\.(svg|mcr)$/i.test(s.name)));}
 function executionTaskIssues(c){
  if(c===undefined)return[];if(!c||c.schemaVersion!==1||!Array.isArray(c.taskGroups)||c.taskGroups.some(g=>!g||typeof g.scope!=='string'||!Array.isArray(g.tasks)||g.tasks.some(t=>!t||typeof t.file!=='string'||typeof t.taskId!=='string')))return[{code:'EXECUTION_PLAN',message:'来源任务元数据结构/版本无效',severity:'error'}];
  return c.taskGroups.flatMap(g=>new Set(g.tasks.map(t=>t.taskId.trim()).filter(Boolean)).size>1?[{code:'MULTITASK_UNSUPPORTED',message:'来源组 '+g.scope+' 包含多个任务标识 '+[...new Set(g.tasks.map(t=>t.taskId.trim()).filter(Boolean))].join(', ')+'（'+[...new Set(g.tasks.map(t=>t.file))].join(', ')+'），可能为多任务或来源冲突；当前不能合并成单任务',severity:'error'}]:[]);
 }
 function executionPlan(p){return executionPlanAll(executionProject(p));}
 function executionPlanAll(p){
  const issues=[],add=(code,message,nodeId)=>issues.push({code,message,nodeId,severity:'error'}),config=p.execution,mode=config?.mode||'topological';
  if(!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.some(n=>!n||typeof n.id!=='string')||new Set(p.nodes.map(n=>n.id)).size!==p.nodes.length)return{mode,order:[],backwardEdges:[],issues:[{code:'EXECUTION_PLAN',message:'扫描顺序需要唯一有效的节点',severity:'error'}]};
  const ids=p.nodes.map(n=>n.id),topology=schedule(p);
  issues.push(...executionTaskIssues(p.executionConstraints));
  if(config!==undefined&&(!config||config.model!==SCAN_MODEL||!['topological','explicit'].includes(config.mode)||typeof config.required!=='boolean'))add('EXECUTION_PLAN','未支持或损坏的扫描计划模型/模式');
  if(topology.cyclic)add('FEEDBACK_UNVERIFIED','反馈求值与编译边界尚未验证，不能猜测插入延迟');
  if(p.nodes.some(n=>n&&Object.hasOwn(n,'packedPoint'))&&mode!=='explicit')add('PACKED_ORDER_REQUIRED','LP共享字读写须采用明确的逐块执行顺序');
  const order=mode==='explicit'?config.order:topology.order;
  if(!Array.isArray(order)||order.length!==ids.length||new Set(order).size!==ids.length||order.some(id=>!ids.includes(id)))add('EXECUTION_PLAN','扫描顺序必须包含每个节点且只能出现一次');
  if(issues.length)return{mode,order:Array.isArray(order)?order:[],backwardEdges:[],issues};
  const positions=new Map(order.map((id,i)=>[id,i])),backwardEdges=p.edges.filter(e=>e&&positions.has(e.from)&&positions.has(e.to)&&positions.get(e.from)>positions.get(e.to)).map(e=>({...e}));
  const canonicalPorts=n=>{const ps=ports(n);return['inputs','outputs'].map(side=>Object.entries(ps[side]).sort(([a],[b])=>a<b?-1:a>b?1:0));};
  const signature=JSON.stringify({dtUs:p.dtUs,mode,order,taskConstraints:p.executionConstraints||null,...(p.packedPoints?.length||p.nodes.some(n=>n.packedPoint!==undefined)?{packedPoints:p.packedPoints||[],packedBindings:p.nodes.filter(n=>n.packedPoint!==undefined).map(n=>[n.id,n.packedPoint])}:{}),nodes:p.nodes.map(n=>[n.id,n.type,canonicalPorts(n)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),edges:p.edges.map(e=>e&&[e.from,e.fromPort,e.to,e.toPort]).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0)});
  const confirmation=config?.confirmation,confirmed=!!confirmation&&confirmation.signature===signature&&typeof confirmation.note==='string'&&!!confirmation.note.trim()&&typeof confirmation.at==='string';
  const required=!!requiresExecutionReview(p);if((required||config&&(mode==='explicit'||confirmation!=null))&&!confirmed)add('EXECUTION_CONFIRMATION_REQUIRED','请在扫描设置中确认当前周期及执行顺序；已有确认缺失或已过期');
  for(const edge of backwardEdges){const source=p.nodes.find(n=>n.id===edge.from);if(source.type==='INPUT')continue;try{if(!own(source.initial||{},edge.fromPort))throw Error('未填写');typed(source.initial[edge.fromPort],ports(source).outputs[edge.fromPort]);}catch(e){add('EXECUTION_INITIAL_REQUIRED','读取上拍的 '+source.id+'.'+edge.fromPort+' 需要明确有效初值：'+e.message,source.id);}}
  return{model:SCAN_MODEL,mode,order:clone(order),backwardEdges,signature,confirmed:config?confirmed:false,required,issues};
 }
 function confirmExecution(project,{mode,order,note}){
  if(typeof note!=='string'||!note.trim())throw Error('请填写周期及顺序核对依据');if(!['topological','explicit'].includes(mode))throw Error('未支持的扫描顺序模式');
  const next=clone(project);next.schemaVersion=project.schemaVersion===3?3:2;next.execution={model:SCAN_MODEL,mode,required:!!requiresExecutionReview(project),...(mode==='explicit'?{order:clone(order)}:{}),confirmation:null};
  const plan=executionPlan(next),errors=plan.issues.filter(i=>i.code!=='EXECUTION_CONFIRMATION_REQUIRED');if(errors.length)throw Error(errors.map(i=>i.message).join('\n'));
  next.execution.confirmation={signature:plan.signature,note:note.trim(),at:new Date().toISOString(),...(next.schemaVersion===3?{reviewedScope:{model:DISABLE_MODEL,nodeIds:clone(plan.order),signature:plan.signature}}:{})};
  for(const issue of next.issues||[])if(issue.code==='SCAN_CONFIGURATION_REQUIRED'){issue.resolved=true;issue.resolution={...next.execution.confirmation,note:'已明确单任务模拟周期及执行顺序：'+note.trim()};}
  return next;
 }
 function parameterBindingIssues(node,edges=[]){
  const history=node.provenance?.manualFieldBindings;if(history===undefined)return[];
  if(!Array.isArray(history)||history.some(b=>!b||!['bind','clear'].includes(b.action)||!Number.isSafeInteger(b.fieldIndex)||b.fieldIndex<0||typeof b.nodeType!=='string'||typeof b.key!=='string'||b.action==='bind'&&(typeof b.value!=='number'||!Number.isFinite(b.value))))return[{code:'PROJECT',message:'人工字段对应历史结构无效'}];
  const latest=new Map(history.map(b=>[b.fieldIndex,b])),issues=[];
  for(const b of latest.values())if(b.action==='bind'){
   const value=node.params?.[b.key],wired=catalog[node.type]?.selectableInputs?.[b.key]&&edges.some(e=>e?.to===node.id&&e.toPort===b.key);
   if(b.nodeType!==node.type||!own(catalog[node.type]?.defaults||{},b.key)||value!==b.value||wired)issues.push({code:'PARAMETER_BINDING_STALE',fieldIndex:b.fieldIndex,message:'来源字段对应已过期：'+b.key+' 原采用值 '+b.value+'，当前参数值 '+String(value)+(b.nodeType!==node.type?'；算法由 '+b.nodeType+' 改为 '+node.type:'')+(wired?'；当前由引脚连线驱动':'')+'。请重新核对并采用或解除对应。'});
  }return issues;
 }
 function validate(p){
  if(p?.schemaVersion===4){try{const source=sourceProject(p);return [...validate(source),...validateOutputForces(source,p.runtimeForces)];}catch(e){return[{code:'SCHEMA',message:e.message,severity:'error'}];}}
  if(p&&['forceModel','runtimeForces','editorSchemaVersion'].some(k=>own(p,k)))return[{code:'SCHEMA',message:'强制运行记录标记只允许用于记录版本4；普通工程不保存强制配置',severity:'error'}];
  const structural=[];const add=(code,message)=>structural.push({code,message,severity:'error'});
  if(p&&Array.isArray(p.nodes)&&Array.isArray(p.edges)){
   if(p.nodes.some(n=>!n||typeof n.id!=='string')||new Set(p.nodes.map(n=>n?.id)).size!==p.nodes.length)add('PROJECT','模块必须具有唯一有效的标识');
   if(p.nodes.some(n=>n&&own(n,'disabled')&&typeof n.disabled!=='boolean'))add('PROJECT','模块禁用状态必须是布尔值');
   if(p.nodes.some(n=>n&&own(n,'disabled'))||p.disableModel!==undefined||p.schemaVersion===3){if(p.schemaVersion!==3||p.disableModel!==DISABLE_MODEL)add('SCHEMA','禁用功能需要工程版本3及明确的执行范围模型');}
   if(p.edges.some(e=>!e||!p.nodes.some(n=>n?.id===e.from)||!p.nodes.some(n=>n?.id===e.to)))add('DANGLING_CONNECTION','连线引用的模块不存在');
   if(p.issues!==undefined&&(!Array.isArray(p.issues)||p.issues.some(i=>!i||typeof i.message!=='string'||!['error','warning'].includes(i.severity))))add('PROJECT','导入诊断结构无效');
   if(p.connectionCandidates!==undefined&&(!Array.isArray(p.connectionCandidates)||p.connectionCandidates.some(c=>!c||typeof c.id!=='string'||!['pending','accepted','rejected'].includes(c.status))))add('PROJECT','候选连接结构无效');
  }
  if(structural.length)return structural;
  const active=executionProject(p),issues=validateAll(active);if(active!==p)for(const i of issues)if(Number.isInteger(i.edgeIndex))i.edgeIndex=p.edges.indexOf(active.edges[i.edgeIndex]);return issues;
 }
 function validateAll(p){
  const issues=[];const add=(code,message,nodeId,edgeIndex)=>issues.push({code,message,nodeId,edgeIndex,severity:'error'});
  if(!p||typeof p!=='object'){add('PROJECT','项目不是有效对象');return issues;}
  if(![1,2,3].includes(p.schemaVersion)||p.schemaVersion===1&&(p.execution!==undefined||p.executionConstraints!==undefined))add('SCHEMA','未支持的项目版本；扫描计划需要工程版本2，禁用功能需要版本3');
  if(p.profile!==PROFILE)add('PROFILE','未支持的算法规则版本');
  if(!Number.isSafeInteger(p.dtUs)||p.dtUs<=0)add('TIMEBASE','扫描周期必须是正整数微秒');
  if(!Array.isArray(p.nodes)||!Array.isArray(p.edges)){add('PROJECT','项目必须包含块和连接数组');return issues;}
  if(p.library!==undefined&&!Array.isArray(p.library))add('PROJECT','宏库必须为数组');
  if(Array.isArray(p.library))for(const d of p.library){
   if(!d||typeof d!=='object'||typeof d.name!=='string'){add('PROJECT','宏定义结构无效');continue;}
   if(d.graph){
    if(!Array.isArray(d.graph.nodes)||!Array.isArray(d.graph.edges)){add('PROJECT','宏定义必须包含块和连接数组');continue;}
    if(d.graph.nodes.some(n=>!n||typeof n.id!=='string'||typeof n.type!=='string'||typeof n.name!=='string'||!n.params||typeof n.params!=='object'||Array.isArray(n.params)))add('PROJECT','宏内部块结构无效');
    if(d.graph.edges.some(e=>!e||['from','to','fromPort','toPort'].some(key=>typeof e[key]!=='string')))add('PROJECT','宏内部连接结构无效');
   }
   for(const key of ['inputs','outputs','parameters'])if(d[key]!==undefined&&(!Array.isArray(d[key])||d[key].some(port=>!port||typeof port.name!=='string'||typeof port.nodeId!=='string'||key==='parameters'&&typeof port.key!=='string')))add('PROJECT','宏接口结构无效：'+key);
  }
  const wired=new Set(p.edges.filter(Boolean).map(e=>e.to+'\0'+e.toPort)),ids=new Map();
  for(const n of p.nodes){
   if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)){add('NODE_ID','块 ID 缺失或重复',n?.id);continue;}ids.set(n.id,n);
   if(n.macroReference){add('MACRO_UNEXPANDED',n.macroReference.displayOnly?'自定义宏仅显示与连线，不提供仿真输出：'+n.type:'宏实例需要确认绑定后展开：'+n.type,n.id);continue;}
   const d=catalog[n.type];if(!d){const declared=DI.get(n.type);add(declared?'INTERFACE_ONLY':'UNKNOWN_BLOCK',declared?n.type+'接口已核对；LP.A2打包点状态及共享写入模型尚未实现，禁止执行':'未支持的控制块：'+n.type,n.id);continue;}
   if(d.unverified)add('SEMANTICS_UNVERIFIED',n.type+' 精确时序尚未验证，当前禁止仿真',n.id);
   const ps=n.params;
   if(!ps||typeof ps!=='object'||Array.isArray(ps)){add('PARAMETER','缺少参数对象',n.id);continue;}
   issues.push(...parameterBindingIssues(n,p.edges).map(i=>({...i,nodeId:n.id,severity:'error'})));
   if(own(n,'initial')){if(!n.initial||typeof n.initial!=='object'||Array.isArray(n.initial))add('INITIAL_REQUIRED',n.type+'初态结构必须为对象',n.id);else{const allowed=new Set([...Object.keys(valueTypes(n)),...(d.inputHistory?['previousIN1']:[]),...Object.keys(d.initialStateTypes||{})]);for(const key of Object.keys(n.initial))if(!allowed.has(key))add('INITIAL_REQUIRED','未支持的'+n.type+'初态字段 '+key,n.id);}}
   for(const key of Object.keys(d.defaults))if(!own(ps,key)&&!d.optionalParameters?.includes(key)&&!(d.selectableInputs?.[key]&&wired.has(n.id+'\0'+key)))add('PARAMETER','缺少参数 '+key,n.id);
   for(const key of Object.keys(ps))if(!own(d.defaults,key))add('PARAMETER','当前模式未支持参数 '+key,n.id);
   if(own(n,'quality')&&n.quality!=='GOOD')add('QUALITY_UNSUPPORTED','当前规则仅支持 GOOD 质量信号',n.id);
   if(['INPUT','OUTPUT'].includes(n.type)&&!['boolean','analog','packed16'].includes(ps.kind))add('PARAMETER','信号类型必须为 boolean/analog/packed16',n.id);
   if(['AND','OR'].includes(n.type))try{gateInputPins(ps.inputs);}catch(e){add('PARAMETER',e.message,n.id);}
   if(n.type==='FLIPFLOP'){
    if(![0,1].includes(ps.TYPE))add('PARAMETER','TYPE 只允许 0（复位优先）或 1（置位优先）',n.id);
    if(typeof n.initial?.OUT!=='boolean')add('INITIAL_REQUIRED','记忆块需要显式布尔初值',n.id);
   }
   if(d.edgeState){try{typed(n.initial?.OUT,ports(n).outputs.OUT);if(n.type==='PULSECNT'&&(!Number.isInteger(n.initial.OUT)||n.initial.OUT<0||n.initial.OUT>2**24))throw Error('计数初值须为0～2^24的精确整数');}catch(e){add('INITIAL_REQUIRED',n.type+'需要显式有效OUT初态：'+e.message,n.id);}if(d.inputHistory&&typeof n.initial?.previousIN1!=='boolean')add('INITIAL_REQUIRED',n.type+'需要明确上一拍IN1（布尔沿检测初态）',n.id);}
   if(B.catalog[n.type])try{B.validate(n,typed,wired);}catch(e){add('PARAMETER',e.message,n.id);}
   if(FO.catalog[n.type])issues.push(...FO.validate(n,typed));
   if(BC.catalog[n.type])try{BC.validate(n);}catch(e){add('PARAMETER',e.message,n.id);}
   if(TR.catalog[n.type]){try{TR.plan(n,p.dtUs);}catch(e){add('PARAMETER',e.message,n.id);}try{typed(n.initial?.OUT,'analog');}catch(e){add('INITIAL_REQUIRED','TRANSPORT需要显式OUT软件初态：'+e.message,n.id);}}
   if(n.type==='BCDNOUT')try{P.word(n.initial?.OUT);}catch(e){add('INITIAL_REQUIRED',e.message,n.id);}
   if(n.type==='PACK16')try{P.word(n.initial?.POUT);}catch(e){add('INITIAL_REQUIRED',e.message,n.id);}
   if(E.catalog[n.type]){try{E.validate(n,typed,wired);}catch(e){add('PARAMETER',e.message,n.id);}if(d.stateful)for(const[port,kind]of Object.entries(valueTypes(n)))try{typed(n.initial?.[port],kind);}catch(e){add('INITIAL_REQUIRED',n.type+'需要显式'+port+'初态：'+e.message,n.id);}}
   if(n.type==='GAINBIAS'){
    if(own(ps,'TRAT'))try{typed(ps.TRAT,'analog');}catch(e){add('PARAMETER','TRAT：'+e.message,n.id);}
    if(own(ps,'PROQ')&&![0,1].includes(ps.PROQ))add('PARAMETER','PROQ仅允许数字0（OFF）或1（ON），不忽略未知位或转换原始类型',n.id);
    try{for(const k of ['GAIN','BIAS','BTSC','TPSC'])typed(ps[k],'analog');if(ps.GAIN===0||ps.BTSC>ps.TPSC)throw Error('增益不能为0，且下限不得大于上限');}catch(e){add('PARAMETER',e.message,n.id);}
   }
   if(d.monitor){
    try{for(const key of Object.keys(d.defaults))if(!d.selectableInputs?.[key]||!wired.has(n.id+'\0'+key))typed(ps[key],'analog');}catch(e){add('PARAMETER',e.message,n.id);}
    if(typeof n.initial?.OUT!=='boolean')add('INITIAL_REQUIRED',n.type+'需要显式布尔OUT初值',n.id);
   }
   if(d.timer){
    try{typed(ps.BASE,'analog');typed(ps.TARG,'analog');if(ps.BASE<.1&&!(n.type==='ONESHOT'&&ps.BASE===0))throw Error('BASE必须至少为0.1秒；仅ONESHOT允许0表示1秒');}catch(e){add('PARAMETER',e.message,n.id);}
    if(typeof n.initial?.OUT!=='boolean')add('INITIAL_REQUIRED',n.type+'需要显式布尔OUT初值',n.id);
    try{typed(n.initial?.ACT,'analog');}catch(e){add('INITIAL_REQUIRED',n.type+'需要显式ACT初值：'+e.message,n.id);}
    if(d.inputHistory&&typeof n.initial?.previousIN1!=='boolean')add('INITIAL_REQUIRED',n.type+'需要明确上一拍IN1（布尔沿检测初态）',n.id);
   }
   if(n.type==='INPUT')try{checkWave(ps.wave,ps.kind);}catch(e){add('WAVE_INVALID',e.message,n.id);}
   if(n.initial)for(const[port,kind]of Object.entries(valueTypes(n)))if(own(n.initial,port))try{typed(n.initial[port],kind);}catch(e){add('INITIAL_REQUIRED',port+'初态：'+e.message,n.id);}
  }
  const pointAnalysis=PR.analyze(p,ports);issues.push(...pointAnalysis.issues,...P.inspect(p,ports,pointAnalysis).issues);
  const drivers=new Map();
  p.edges.forEach((e,i)=>{
   if(!e||!ids.has(e.from)||!ids.has(e.to)){add('DANGLING_CONNECTION','连接的源或目标块不存在',e?.to,i);return;}
   const from=ports(ids.get(e.from)),to=ports(ids.get(e.to));
   const unsupported=(!ids.get(e.from).macroReference&&B.unsupported(ids.get(e.from).type,e.fromPort,'output'))||(!ids.get(e.to).macroReference&&B.unsupported(ids.get(e.to).type,e.toPort,'input'));
   if(unsupported)add(unsupported,'当前基本模式未开放端口：'+e.fromPort+' → '+e.toPort,e.to,i);
   else if(!own(from.outputs,e.fromPort)||!own(to.inputs,e.toPort))add('PORT_UNKNOWN','连接引用了不存在/未支持的端口',e.to,i);
   else if((!['boolean','analog','packed16'].includes(from.outputs[e.fromPort])||!['boolean','analog','packed16'].includes(to.inputs[e.toPort]))&&!(ids.get(e.from).macroReference?.displayOnly||ids.get(e.to).macroReference?.displayOnly))add('PORT_TYPE_REQUIRED','连接端口的信号类型尚未明确',e.to,i);
   else if(['boolean','analog','packed16'].includes(from.outputs[e.fromPort])&&['boolean','analog','packed16'].includes(to.inputs[e.toPort])&&from.outputs[e.fromPort]!==to.inputs[e.toPort])add('PORT_TYPE','端口信号类型不一致',e.to,i);
   const key=e.to+'\0'+e.toPort;if(drivers.has(key))add('MULTIPLE_DRIVERS','输入端口存在多个驱动源',e.to,i);drivers.set(key,e);
  });
  for(const n of p.nodes.filter(n=>n&&!n.macroReference?.displayOnly))for(const port of Object.keys(ports(n).inputs))if(!drivers.has(n.id+'\0'+port)&&!(n.type==='UNPACK16'&&n.packedPoint&&port==='PIN')&&!( !n.macroReference&&catalog[n.type]?.selectableInputs?.[port])&&!( !n.macroReference&&catalog[n.type]?.optionalInputs?.includes(port))&&!(!n.macroReference&&DI.get(n.type)?.optionalInputs.includes(port)))add('MISSING_INPUT','缺少输入 '+port,n.id);
  if(ids.size===p.nodes.length)issues.push(...executionPlan(p).issues);
  if(p.connectionCandidates!==undefined&&!Array.isArray(p.connectionCandidates))add('PROJECT','候选连接必须为数组');
  if(Array.isArray(p.connectionCandidates))for(const candidate of p.connectionCandidates){
   if(!candidate||typeof candidate!=='object'||typeof candidate.id!=='string'||!['pending','accepted','rejected'].includes(candidate.status)){add('PROJECT','候选连接条目结构无效');continue;}
   if(candidate.status==='pending')add('PENDING_CONNECTION','存在待人工确认的候选连接：'+candidate.id,candidate.to||undefined);
  }
  if(p.issues!==undefined&&!Array.isArray(p.issues))add('PROJECT','导入诊断必须为数组');
  if(Array.isArray(p.issues))for(const issue of p.issues){
   if(!issue||typeof issue!=='object'||typeof issue.message!=='string'||!['error','warning'].includes(issue.severity)){add('PROJECT','导入诊断条目结构无效');continue;}
   if(!issue.resolved&&issue.severity==='error')issues.push({...issue,code:issue.code||'IMPORT_UNRESOLVED'});
  }
  return issues;
 }
 function precisionCheck(label,staged,wider){if(staged!==wider)throw Error('中间精度未确定：'+label+'；当前模型结果='+staged+'，另一精度候选='+wider+'；不能据现有资料选择，本次扫描未提交。');return staged;}
 function edgeMemory(n,ins,previous,state){
  if(n.type==='AAFLIPFLOP'){const out=ins.RSET?false:state.firstPass?(own(ins,'INIT')?ins.INIT:previous.OUT):ins.SRST&&!state.previousSRST?!previous.OUT:previous.OUT;return{values:{OUT:out},state:{memory:out,previousSRST:ins.SRST,firstPass:false}};}
  let count=ins.RSET?0:previous.OUT;if(ins.IN1&&!state.previousIN1){if(count>=2**24)throw Error('PULSECNT超出当前支持的精确整数范围0～2^24，本次扫描未提交');count=typed(count+1,'analog');}return{values:{OUT:count},state:{previousIN1:ins.IN1}};
 }
 function evaluate(n,ins,previous,time,dtUs){
  if(B.catalog[n.type])return B.evaluate(n,ins,previous,typed,precisionCheck);
  if(n.type==='BCDNIN')return{OUT:typed(BC.decode(ins.IN,n.params),'analog')};
  if(E.catalog[n.type])return E.evaluate(n,ins,previous,typed,precisionCheck,dtUs);
  const ps=n.params;let v;
  switch(n.type){
   case 'INPUT':v=sample(ps.wave,time,ps.kind);break;
   case 'OUTPUT':v=ins.IN1;break;
   case 'AND':v=Object.values(ins).every(x=>x===true);break;
   case 'OR':v=Object.values(ins).some(x=>x===true);break;
   case 'NOT':v=!ins.IN1;break;
   case 'XOR':v=ins.IN1!==ins.IN2;break;
   case 'FLIPFLOP':v=ps.TYPE===0?(ins.RSET?false:ins.SET?true:previous.OUT):(ins.SET?true:ins.RSET?false:previous.OUT);break;
   case 'HIGHMON':case 'LOWMON':{
    const high=n.type==='HIGHMON',key=high?'HISP':'LOSP',limit=typed(own(ins,key)?ins[key]:ps[key],'analog'),band=typed(ps[high?'HIDB':'LODB'],'analog'),input=typed(ins.IN1,'analog');
    if(high?input>limit:input<limit)v=true;else{const widerReset=high?limit-band:limit+band,reset=typed(widerReset,'analog'),staged=(high?input<reset:input>reset)?false:previous.OUT,wider=(high?input<widerReset:input>widerReset)?false:previous.OUT;v=precisionCheck(n.type+'复位比较（IN1='+input+'，Float32阈值='+reset+'，较高精度阈值='+widerReset+'）',staged,wider);}break;
   }
   case 'ABSVALUE':v=Math.abs(ins.IN1);break;
   case 'GAINBIAS':{
    const gain=typed(ps.GAIN,'analog'),bias=typed(ps.BIAS,'analog'),low=typed(ps.BTSC,'analog'),high=typed(ps.TPSC,'analog'),product=typed(ins.IN1*gain,'analog'),sum=typed(product+bias,'analog'),clamp=x=>Math.max(low,Math.min(high,x));v=precisionCheck('GAINBIAS.OUT',clamp(sum),typed(clamp(ins.IN1*gain+bias),'analog'));break;
   }
   default:throw Error('未支持的计算块 '+n.type);
  }
  return {OUT:typed(v,valueTypes(n).OUT)};
 }
 function shortTarget(target,base,dtUs){const duration=target*base,seconds=dtUs/1e6,nominal=duration<=Math.fround(seconds);precisionCheck('小目标分支（时长先转Float32）',nominal,Math.fround(duration)<=Math.fround(seconds));return precisionCheck('小目标分支（时长和周期用Float64）',nominal,duration<=seconds);}
 function timerActual(anchorACT,elapsedUs,base){const seconds=typed(elapsedUs/1e6,'analog'),increment=typed(seconds/base,'analog'),staged=typed(anchorACT+increment,'analog'),wider=typed(anchorACT+elapsedUs/1e6/base,'analog');return precisionCheck('计时ACT',staged,wider);}
 function ondelay(n,ins,previous,state,dtUs){
  const base=typed(n.params.BASE,'analog'),target=typed(n.params.TARG,'analog'),act=previous.ACT,next={...state};
  const result=(OUT,ACT)=>({values:{OUT,ACT},state:next});
  if(target<0||act<0)return result(false,act);
  if(!ins.ENBL){Object.assign(next,{timing:false,started:false,elapsedUs:0,anchorACT:0});return result(false,0);}
  if(target===0){next.timing=false;return result(ins.IN1,act);}
  if(act>=target){next.timing=false;return result(true,act);}
  if(!ins.IN1){next.timing=false;return result(false,act);}
  next.timing=true;
  if(!state.started){next.started=true;next.anchorACT=act;next.elapsedUs=shortTarget(target,base,dtUs)?dtUs:0;}
  else next.elapsedUs+=dtUs;
  const actual=timerActual(next.anchorACT,next.elapsedUs,base),out=actual>=target;
  if(out)next.timing=false;return result(out,actual);
 }
 function edgeTimer(n,ins,previous,state,dtUs){
  // REF_1100 p254 / p258: a new rising edge resets ACT; a one-shot
  // restarts its pulse, while an off-delay waits for the following falling edge.
  const rawBase=typed(n.params.BASE,'analog'),base=n.type==='ONESHOT'&&rawBase===0?1:rawBase,target=typed(n.params.TARG,'analog'),act=previous.ACT,next={...state},off=n.type==='OFFDELAY';
  const result=(OUT,ACT)=>({values:{OUT,ACT},state:next});
  if(target<0||act<0)return result(false,act);
  const rising=ins.IN1&&!state.previousIN1,falling=!ins.IN1&&state.previousIN1;next.previousIN1=ins.IN1;
  if(rising){Object.assign(next,{timing:!off&&target>0,elapsedUs:0,anchorACT:0});return result(target>0,0);}
  // Both manuals stop at ACT >= TARG; ONESHOT additionally states that
  // TARG=0 never energizes OUT. These rules also cover zero-target overlap.
  if(target===0||act>=target){next.timing=false;return result(false,act);}
  if(off&&ins.IN1){next.timing=false;return result(previous.OUT,act);}
  if(off&&falling){if(!previous.OUT){next.timing=false;return result(false,act);}next.timing=true;next.anchorACT=act;next.elapsedUs=shortTarget(target,base,dtUs)?dtUs:0;}
  else if(state.timing)next.elapsedUs+=dtUs;
  else{next.timing=false;return result(false,act);}
  const actual=timerActual(next.anchorACT,next.elapsedUs,base),out=actual<target;next.timing=out;return result(out,actual);
 }
 function createRun(project,options={}){
  const errors=validate(project);if(errors.length){const e=Error(errors.map(i=>i.message).join('\n'));e.issues=errors;throw e;}
  const original=sourceProject(project),config=clone(own(options,'outputForces')?options.outputForces:project.schemaVersion===4?project.runtimeForces:{}),forceErrors=validateOutputForces(original,config);if(forceErrors.length){const e=Error(forceErrors.map(i=>i.message).join('\n'));e.issues=forceErrors;throw e;}
  const declaration=outputForcing(original,config),forced=new Map();for(const pin of declaration.pins){if(!forced.has(pin.nodeId))forced.set(pin.nodeId,{});forced.get(pin.nodeId)[pin.port]=pin.value;}
  const recordForces=Object.fromEntries(declaration.pins.map(pin=>pin.nodeId).filter((id,i,ids)=>ids.indexOf(id)===i).map(id=>[id,Object.fromEntries(declaration.pins.filter(pin=>pin.nodeId===id).map(pin=>[pin.port,pin.requested]))])),hasForces=Object.keys(config).length>0||project.schemaVersion===4,recorded=hasForces?{...clone(original),schemaVersion:4,editorSchemaVersion:original.schemaVersion,forceModel:FORCE_MODEL,runtimeForces:recordForces}:original;
  const p=executionProject(original),order=executionPlan(p).order,byId=new Map(p.nodes.map(n=>[n.id,n]));
  const incoming=new Map(p.nodes.map(n=>[n.id,p.edges.filter(e=>e.to===n.id)])),fingerprints=F.fingerprints(recorded);let current,lastFailure=null;const packed=P.inspect(p,ports,PR.analyze(p,ports));
  function publish(frame,id){if(!forced.has(id))return;const raw=frame.values[id];frame.computedValues[id]=clone(raw);const output={...raw};for(const [port,value]of Object.entries(forced.get(id))){typed(raw[port],ports(byId.get(id)).outputs[port]);output[port]=value;}frame.values[id]=output;}
  function reset(){
   const values=Object.create(null),states=Object.create(null);
   for(const n of p.nodes){const initial={};for(const[port,kind]of Object.entries(valueTypes(n)))initial[port]=typed(own(n.initial||{},port)?n.initial[port]:kind==='boolean'?false:0,kind);values[n.id]=initial;if(FO.catalog[n.type])states[n.id]=FO.initial(n);if(n.type==='INPUT')values[n.id].OUT=sample(n.params.wave,0,n.params.kind);if(n.type==='FLIPFLOP'||catalog[n.type].monitor)states[n.id]={memory:values[n.id].OUT};if(catalog[n.type].edgeState)states[n.id]=n.type==='AAFLIPFLOP'?{memory:initial.OUT,previousSRST:false,firstPass:true}:{previousIN1:n.initial.previousIN1};if(catalog[n.type].timer){states[n.id]={timing:n.type==='ONESHOT'?initial.OUT:n.type==='OFFDELAY'?initial.OUT&&!n.initial.previousIN1:false,elapsedUs:0,anchorACT:initial.ACT};if(n.type==='ONDELAY')states[n.id].started=false;if(catalog[n.type].inputHistory)states[n.id].previousIN1=n.initial.previousIN1;}}
   const frame={values,...(forced.size?{computedValues:{}}:{})};for(const id of forced.keys())publish(frame,id);
   for(const n of p.nodes)if(TR.catalog[n.type]){const edge=incoming.get(n.id).find(e=>e.toPort==='IN1');states[n.id]=TR.initial(n,values[edge.from][edge.fromPort],(frame.computedValues?.[n.id]||values[n.id]).OUT,p.dtUs);}
   current={tick:0,time:0,...frame,states,...(packed.points.size?{packedPoints:Object.fromEntries([...packed.points].map(([id,r])=>[id,r.initial])),packedReads:{}}:{})};lastFailure=null;return snapshot();
  }
  function snapshot(){return clone(current);}
  function step(){
   const tick=current.tick+1,time=tick*p.dtUs/1e6;
   if(!Number.isSafeInteger(tick*p.dtUs)){lastFailure={code:'TIME_INDEX_RANGE',tick,nodeId:null,message:'时间索引超出精确整数范围'};throw Error(lastFailure.message);}
   const next=clone(current);next.tick=tick;next.time=time;if(packed.points.size)next.packedReads={};
   for(const id of order){const n=byId.get(id),ins={};for(const e of incoming.get(id))ins[e.toPort]=next.values[e.from][e.fromPort];
    try{const previousComputed=current.computedValues?.[id]||current.values[id],shared=packed.bindings.get(n.id),sharedValue=shared!==undefined?next.packedPoints[shared]:undefined;if(TR.catalog[n.type]){const result=TR.step(n,ins.IN1,previousComputed,current.states[id],p.dtUs);next.values[id]=result.values;next.states[id]=result.state;}else if(n.type==='BCDNOUT'){const value=BC.encode(shared!==undefined?sharedValue:previousComputed.OUT,ins.IN,n.params);next.values[id]={OUT:value};if(shared!==undefined)next.packedPoints[shared]=value;}else if(FO.catalog[n.type]){const previous={...previousComputed,...(shared!==undefined?{MNTR:sharedValue}:{})},result=FO.step(n,ins,previous,current.states[id]);next.values[id]=result.values;next.states[id]=result.state;if(shared!==undefined&&result.monitorWritten)next.packedPoints[shared]=P.word(result.values.MNTR);}else if(n.type==='UNPACK16'){const input=shared!==undefined?sharedValue:ins.PIN;if(packed.points.size)next.packedReads[id]={PIN:input};next.values[id]=P.unpack(input);}else if(n.type==='PACK16'){const value=P.pack(shared!==undefined?sharedValue:previousComputed.POUT,ins);next.values[id]={POUT:value};if(shared!==undefined)next.packedPoints[shared]=value;}else if(catalog[n.type].edgeState){const result=edgeMemory(n,ins,previousComputed,current.states[id]);next.values[id]=result.values;next.states[id]=result.state;}else if(catalog[n.type].timer){const result=(n.type==='ONDELAY'?ondelay:edgeTimer)(n,ins,previousComputed,current.states[id],p.dtUs);next.values[id]=result.values;next.states[id]=result.state;}else next.values[id]=evaluate(n,ins,previousComputed,time,p.dtUs);if(packed.points.size){const reads=Object.fromEntries(Object.entries(ins).filter(([pin])=>ports(n).inputs[pin]==='packed16'));if(Object.keys(reads).length)next.packedReads[id]=reads;}if(n.type==='ASSIGN'&&shared!==undefined)next.packedPoints[shared]=P.word(next.values[id].OUT);if(shared!==undefined&&P.output(n))for(const peer of p.nodes)if(packed.bindings.get(peer.id)===shared&&P.output(peer)){next.values[peer.id][P.output(peer)]=next.packedPoints[shared];if(next.computedValues?.[peer.id])next.computedValues[peer.id][P.output(peer)]=next.packedPoints[shared];}if(n.type==='FLIPFLOP'||catalog[n.type].monitor)next.states[id]={memory:next.values[id].OUT};publish(next,id);}
    catch(e){lastFailure={code:'SCAN_FAILED',tick,timeUs:tick*p.dtUs,nodeId:id,message:'扫描 '+tick+'，块 '+n.name+' ('+id+')：'+e.message};throw Error(lastFailure.message);}
   }
   current=next;lastFailure=null;return snapshot();
  }
  reset();return {step,reset,snapshot,order:clone(order),manifest:()=>({engineVersion:ENGINE_VERSION,profile:PROFILE,fingerprints:clone(fingerprints),resultRange:{firstTick:0,lastTick:current.tick,firstTimeUs:0,lastTimeUs:current.tick*p.dtUs,executedScans:current.tick,snapshotCount:current.tick+1},diagnostics:lastFailure?[clone(lastFailure)]:[],comparisonTolerances:null,project:clone(recorded),...(hasForces?{outputForcing:clone(declaration)}:{}),...(original.schemaVersion===3?{executionScope:executionScope(original)}:{}),order:clone(order),scanModel:SCAN_MODEL,execution:clone(original.execution||{model:SCAN_MODEL,mode:'topological',required:false,confirmation:null}),numericValidationModel:NUMERIC_VALIDATION_MODEL,arithmeticModels:Object.fromEntries(Object.entries(catalog).filter(([,d])=>d.arithmetic).map(([type,d])=>[type,d.model])),...(p.nodes.some(n=>(catalog[n.type].edgeState||catalog[n.type].stateful||catalog[n.type].packed))?{stateModels:Object.fromEntries(p.nodes.filter(n=>catalog[n.type].edgeState||catalog[n.type].stateful||catalog[n.type].packed).map(n=>[n.type,catalog[n.type].model]))}:{}),numericMode:'Float32 正常有限数；GAINBIAS 乘加分别舍入；计时块整数微秒计段、秒数/BASE/ACT逐阶段Float32',monitorModels:Object.fromEntries(Object.entries(catalog).filter(([,d])=>d.monitor).map(([type,d])=>[type,d.model])),timerModels:Object.fromEntries(Object.entries(catalog).filter(([,d])=>d.timer).map(([type,d])=>[type,d.model])),evidence:'文档规则与明确的软件扫描契约；未取得 Ovation 运行对照'})};
 }
 return {forceableOutputs,forceOutputIssues,validateOutputForces,outputForcing,sourceProject,FORCE_MODEL,outputDependencies,executionScope,executionProject,setNodeDisabled,DISABLE_MODEL,recordingPlan,transportPlan:TR.plan,allowedPointRecords:PR.allowed,pointRecordAnalysis:p=>PR.analyze(p,ports),PROFILE,ENGINE_VERSION,catalog,valueTypes,declaredInterfaces:DI,gateInputPins,gateInputConfig,ports,newProject,newNode,validate,checkWave,sample,createRun,executionPlan,confirmExecution,executionTaskIssues,parameterBindingIssues};
});
