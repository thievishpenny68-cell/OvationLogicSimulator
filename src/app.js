(function(){
 'use strict';const C=LogicCore,PE=LogicEngineering,Recompute=LogicRecompute,F=LogicProjectState,I=LogicImport,R=LogicRepair,M=LogicMacros,T=LogicTrace,S=LogicScopes,A=LogicSourceSemantics,P=LogicSourcePreview,W=LogicWireDisplay,WN=LogicWireNetworks,MW=LogicManualWires,TB=LogicSheetTitleBlock,MS=LogicMacroSymbols,CD=LogicCanvasDelete,K=LogicSymbols,E=LogicConnectionEvidence,TextInput=LogicTextInput,CSV=LogicReferenceCSV,WaveEditor=LogicInputWaveEditor,$=id=>document.getElementById(id),copy=x=>structuredClone(x),NS='http://www.w3.org/2000/svg';
 let project=C.newProject(),selected=null,selectedEdge=null,selectedProbe=null,selectedNet=null,selectedCandidate=null,pending=null,run=null,timer=null,trace=[],undo=[],redo=[],drag=null,camera={x:0,y:0,w:1000,h:600},librarySignature='';
 const palette=['#168c78','#458dbb','#bd8a4d','#9c77b5','#ce6972','#4fa5a7'].map((color,i)=>'var(--trace-'+i+','+color+')');
 let cursor=null,observed=null,channelSignature='',defaultSignals=true;
 let reference=null,referenceName='',comparison=null,referenceLoad=0,projectLoad=0;
 let overviewWindow=10;LogicSignalChart.bind($('overview-cursor'),$('chart'));
 let overviewSelection=null,outputOptionsSignature='',outputCheckedSignature='';
 const waveDrafts=new Map();let activeWaveEditor=null,activeQualityEditor=null,waveProject=0;
 let defaultPaper=null,paperPanelKey=null,paperBorderKey='',titleBlockView=null,titleBlockBox=null,titleSourceText=null,titleSourceData=null;
 function resetWaveDrafts(){outputForces=Object.create(null);waveProject++;waveDrafts.clear();defaultPaper=null;paperPanelKey=null;}
 const waveIdentity=n=>JSON.stringify([n.params.kind,n.params.wave??null,n.qualityWave??null]);
 function waveDraft(n){const entry=waveDrafts.get(n.id);if(entry&&(entry.project!==waveProject||entry.base!==waveIdentity(n))){waveDrafts.delete(n.id);return null;}return entry?.draft;}
 let repairDraft=null,sourceViewer=null,sourceTarget=null;
 let recomputation=null,runtimeFailure=null,importDraft=null;
 let executionDraft=null,executionDraftKey='';
 let logicRevision=0,canvasSignature=null,probeSignature=null,nodeValueElements=[],wireValueElements=[],probeValueElements=[],propertyCache=null,problemCache=null,executionCache=null,showWireValues=true;
 let selectedNodes=new Set(),suppressGestureClick=false,canvasTool='select',wireDraft=null;const annotations=LogicAnnotations.mount($('annotation-canvas'));
 let signalCache=null,checkedSignalSignature=null,outputForces=Object.create(null);
 let engineering=null,activeCanvasId='c1',engineeringTrace=[],canvasSessions=new Map(),engineeringUI=null,importDestination=null,savingProject=false,workspaceUI=null,workspaceDocument=0;
 const tracePreparedCanvases=new Set();
 let macroPath=[],rootTrace=[],macroImportRevision=0;
 const insideMacro=()=>macroPath.length>0;
 const topProject=()=>macroPath[0]?.parent||project;
 const canvasKey=()=>insideMacro()?JSON.stringify([activeCanvasId,...macroPath.map(entry=>entry.id)]):activeCanvasId;
 const macroNode=entry=>entry.parent.nodes.find(n=>n.id===entry.id);
 function syncMacro(){if(insideMacro())macroNode(macroPath.at(-1)).macroGraph=project;}
 function macroFrame(frame){for(const entry of macroPath)frame=frame?.macros?.[entry.id];return frame;}
 function emptyFrame(frame){return {tick:frame?.tick,time:frame?.time,values:{},states:{}};}
 function viewFrame(frame){
  const root=engineering?frame.canvases[activeCanvasId]:frame;
  return macroFrame(root)||emptyFrame(root);
 }
 function refreshViewTrace(){trace=engineering?engineeringTrace.map(viewFrame):insideMacro()?rootTrace.map(viewFrame):rootTrace;}
 function changeMacroView(action){
  const previousKey=canvasKey();
  if(drag)cancelGesture();cancelProjectReads();closeSource();repairDraft=null;wireDraft=null;
  canvasTool='select';saveCanvasSession();action();loadCanvasSession(previousKey);render();setCamera();
 }
 function openMacro(n){
  if(!n.macroGraph)return;
  const fresh=!canvasSessions.has(JSON.stringify([activeCanvasId,...macroPath.map(entry=>entry.id),n.id]));
  changeMacroView(()=>{macroPath.push({id:n.id,parent:project});project=n.macroGraph;});
  showTab('trends');if(fresh)fit();status('宏画布 · '+n.name+'，与父工程同步扫描。');
 }
 function leaveMacro(all=false){
  if(!insideMacro())return;
  changeMacroView(()=>{const first=all?macroPath[0]:macroPath.at(-1);project=first.parent;macroPath.splice(all?0:macroPath.length-1);});
  showTab('trends');
 }
 function engineeringDocument(){syncMacro();const root=topProject();if(engineering){const c=engineering.canvases.find(c=>c.id===activeCanvasId);if(c)c.project=root;return engineering;}return{documentType:PE.TYPE,formatVersion:1,title:root.title||'未命名工程',dtUs:root.dtUs,...(root.utcStart!==undefined?{utcStart:root.utcStart}:{}),canvases:[{id:'c1',name:root.title||'画布1',project:root}]};}
 function allForces(){const result=Object.fromEntries([...canvasSessions].map(([id,s])=>[id,s.outputForces]));if(!insideMacro())result[activeCanvasId]=outputForces;const valid=new Set(engineeringDocument().canvases.map(c=>c.id));return Object.fromEntries(Object.entries(result).filter(([id])=>valid.has(id)));}
 function promoteEngineering(){if(!engineering){engineering=PE.create(project);engineering.canvases[0].project=project;activeCanvasId='c1';}}
 function inputBinding(id){return !insideMacro()&&engineering?PE.signals(engineeringDocument()).bindings.find(b=>b.input.canvasId===activeCanvasId&&b.input.nodeId===id):null;}
 function engineeringScope(){if(!engineering||insideMacro())return C.executionScope(project);const scope=PE.scope(engineeringDocument()),local=list=>list.map(k=>JSON.parse(k)).filter(([id])=>id===activeCanvasId).map(([,id])=>id);return{...scope,disabled:local(scope.disabled),suspended:local(scope.suspended),active:local(scope.active)};}
 function historyState(){saveCanvasSession();return{sessions:canvasSessions,engineering:engineering?copy(engineeringDocument()):null,project:engineering?null:copy(topProject()),activeCanvasId,macroIds:macroPath.map(entry=>entry.id)};}
 function saveCanvasSession(){engineeringDocument();canvasSessions.set(canvasKey(),{outputForces,waveProject,waveDrafts:new Map(waveDrafts),camera:copy(camera),selected,selectedNodes:new Set(selectedNodes),observed:observed&&new Set(observed),defaultSignals,overviewSelection:overviewSelection&&new Set(overviewSelection),annotations:annotations.snapshot(),executionDraft:copy(executionDraft),executionDraftKey});}
 function loadCanvasSession(previousKey=canvasKey()){
  const key=canvasKey(),s=canvasSessions.get(key);
  if(previousKey!==key)clearReference();
  outputForces=s?.outputForces||Object.create(null);waveProject=s?.waveProject??waveProject+1;waveDrafts.clear();for(const[k,v]of s?.waveDrafts||[])waveDrafts.set(k,v);camera=s?.camera||{x:0,y:0,w:1000,h:600};selected=s?.selected||null;selectedNodes=s?.selectedNodes||new Set();observed=s?.observed||null;defaultSignals=s?.defaultSignals??true;overviewSelection=s?.overviewSelection||null;executionDraft=s?.executionDraft||null;executionDraftKey=s?.executionDraftKey||'';annotations.restore(s?.annotations||[]);selectedEdge=selectedProbe=selectedNet=selectedCandidate=pending=null;defaultPaper=null;paperPanelKey=null;propertyCache=problemCache=executionCache=signalCache=null;canvasSignature=probeSignature=null;channelSignature=outputOptionsSignature=outputCheckedSignature='';refreshViewTrace();logicRevision++;
 }
 function selectCanvas(id,nodeId){leaveMacro(true);if(id===activeCanvasId){if(nodeId){selectOnly(nodeId);canvas();properties();fit([nodeId]);}return;}if(!engineering?.canvases.some(c=>c.id===id))return;if(drag)cancelGesture();const previousKey=canvasKey();cancelProjectReads();closeSource();repairDraft=null;wireDraft=null;pending=null;saveCanvasSession();activeCanvasId=id;project=engineering.canvases.find(c=>c.id===id).project;loadCanvasSession(previousKey);prepareTraceCanvas();render();setCamera();if(nodeId){selectOnly(nodeId);canvas();properties();fit([nodeId]);}status('已切换画布：'+engineering.canvases.find(c=>c.id===id).name+(canvasTool==='trace-output'?'；'+recoveryLabel()+'模式，点击OUTPUT恢复上游。':'；扫描历史保留。'));}
 function clearEngineering(){workspaceDocument++;engineering=null;activeCanvasId='c1';engineeringTrace=[];rootTrace=[];macroPath=[];canvasSessions=new Map();annotations.restore([]);}
 function restoreHistory(next){const previousKey=canvasKey();cancelProjectReads();saveCanvasSession();canvasSessions=next.sessions||new Map();engineering=next.engineering;activeCanvasId=next.activeCanvasId||'c1';project=engineering?engineering.canvases.find(c=>c.id===activeCanvasId).project:next.project;macroPath=[];
  for(const id of next.macroIds||[]){const n=project.nodes.find(n=>n.id===id);if(!n?.macroGraph)break;macroPath.push({id,parent:project});project=n.macroGraph;}loadCanvasSession(previousKey);selectOnly(null);}
 function addCanvasProject(p,name){const previousKey=canvasKey();beginProjectLoad();promoteEngineering();saveCanvasSession();let n=1;while(engineering.canvases.some(c=>c.id==='c'+n)||canvasSessions.has('c'+n))n++;const id='c'+n;p.dtUs=engineering.dtUs;if(engineering.utcStart!==undefined)p.utcStart=engineering.utcStart;else delete p.utcStart;engineering.canvases.push({id,name:name||'画布'+n,project:p});activeCanvasId=id;project=p;loadCanvasSession(previousKey);}
 function setEngineeringPeriod(value){project.dtUs=value;if(engineering){engineering.dtUs=value;for(const c of engineering.canvases)c.project.dtUs=value;}}
 function setEngineeringUtc(value){project.utcStart=value;if(engineering){engineering.utcStart=value;for(const c of engineering.canvases)c.project.utcStart=value;}}
 function checkDocument(p){if(PE.isProject(p)){PE.check(p);for(const c of p.canvases)checkProject(c.project);}else checkProject(p);}
 function installDocument(p){clearEngineering();resetWaveDrafts();if(PE.isProject(p)){engineering=PE.sourceProject(p);p=engineering;activeCanvasId=p.canvases[0].id;project=p.canvases[0].project;for(const c of p.canvases){c.project.dtUs=p.dtUs;if(p.utcStart!==undefined)c.project.utcStart=p.utcStart;else delete c.project.utcStart;}}else{project=p;project.schemaVersion=project.schemaVersion===3?3:2;}loadCanvasSession();}
 function useImportedProject(p){if(importDestination&&importDestination.canvasId!==activeCanvasId)throw Error('导入目标已改变，未替换画布');if(importDestination?.kind==='new'){addCanvasProject(p,p.title||'导入画布');resetWaveDrafts();}else{resetWaveDrafts();project=p;if(engineering){project.dtUs=engineering.dtUs;if(engineering.utcStart!==undefined)project.utcStart=engineering.utcStart;else delete project.utcStart;}annotations.restore([]);}}
 function pendingInputDrafts(){
  const ep=engineeringDocument(),candidates=[];
  for(const canvas of ep.canvases){
   const state=canvas.id===activeCanvasId&&!insideMacro()?{waveDrafts,waveProject}:canvasSessions.get(canvas.id);
   for(const[id,entry]of state?.waveDrafts||[]){
    const node=canvas.project.nodes.find(n=>n.id===id);
    if(node?.type==='INPUT'&&!node.macroReference&&entry.project===state.waveProject&&entry.base===waveIdentity(node))candidates.push({canvas,node});
   }
  }
  if(!candidates.length)return candidates;
  if(!engineering){
   const active=new Set(C.executionScope(topProject()).active);
   return candidates.filter(({node})=>active.has(node.id));
  }
  const active=new Set(PE.scope(ep).active),bound=new Set(PE.signals(ep).bindings.map(b=>PE.nodeKey(b.input.canvasId,b.input.nodeId)));
  return candidates.filter(({canvas,node})=>{const key=PE.nodeKey(canvas.id,node.id);return active.has(key)&&!bound.has(key);});
 }
 function prepareEngineeringRun(){saveCanvasSession();run=PE.createRun(engineeringDocument(),{outputForces:allForces()});engineeringTrace=[run.snapshot()];refreshViewTrace();}

 function changeEngineeringDisabled(keys,disabled){const byCanvas=new Map();for(const key of keys){const[cid,id]=JSON.parse(key);if(!byCanvas.has(cid))byCanvas.set(cid,[]);byCanvas.get(cid).push(id);}mutate(()=>{engineeringDocument();for(const c of engineering.canvases)if(byCanvas.has(c.id))c.project=C.setNodeDisabled(c.project,byCanvas.get(c.id),disabled);project=engineering.canvases.find(c=>c.id===activeCanvasId).project;});}
 function setupEngineeringUI(){engineeringUI=LogicEngineeringUI.mount({
  getProject:engineeringDocument,getActiveCanvas:()=>activeCanvasId,getFrame:()=>engineering?engineeringTrace[cursor??engineeringTrace.length-1]:null,isRunning:()=>!!timer,pause:()=>{stop();render();},
  isInsideMacro:insideMacro,selectCanvas,selectNode:(cid,id)=>selectCanvas(cid,id),
  addCanvas:()=>{mutate(()=>addCanvasProject(C.newProject()));fit();},
  moveCanvas:delta=>{if(!engineering)return;const i=engineering.canvases.findIndex(c=>c.id===activeCanvasId),j=i+delta;if(j<0||j>=engineering.canvases.length)return;mutate(()=>{[engineering.canvases[i],engineering.canvases[j]]=[engineering.canvases[j],engineering.canvases[i]];});status('画布顺序已修改，下一轮按新顺序扫描。');},
  deleteCanvas:()=>{if(!engineering||engineering.canvases.length===1)return;beginProjectLoad();mutate(()=>{const previousKey=canvasKey();saveCanvasSession();const i=engineering.canvases.findIndex(c=>c.id===activeCanvasId);engineering.canvases.splice(i,1);activeCanvasId=engineering.canvases[Math.min(i,engineering.canvases.length-1)].id;project=engineering.canvases.find(c=>c.id===activeCanvasId).project;loadCanvasSession(previousKey);});},
  renameProject:value=>{if(!value.trim())return;mutateView(()=>{if(engineering)engineering.title=value.trim();else topProject().title=value.trim();});},
  renameCanvas:(value,id)=>{if(!value.trim()||timer||id!==activeCanvasId)return;mutateView(()=>{if(engineering)engineering.canvases.find(c=>c.id===id).name=value.trim();else topProject().title=value.trim();});},
  renameInputs:(inputs,source)=>{const ep=engineeringDocument(),c=ep.canvases.find(c=>c.id===source.canvasId),n=c?.project.nodes.find(n=>n.id===source.nodeId);if(!n||n.type!=='OUTPUT')throw Error('OUTPUT来源已改变');for(const i of inputs){const input=ep.canvases.find(c=>c.id===i.canvasId)?.project.nodes.find(n=>n.id===i.nodeId);if(!input||input.type!=='INPUT'||input.params.kind!==n.params.kind||i.canvasId===source.canvasId)throw Error('INPUT或类型已改变，请重新预览');}mutate(()=>{for(const i of inputs)ep.canvases.find(c=>c.id===i.canvasId).project.nodes.find(n=>n.id===i.nodeId).name=n.name.trim();});}
 });}

 const forcePanel=LogicOutputForces.mount({core:C,onApply:(node,map)=>{try{if(timer)throw Error('请先暂停运行，再修改强制输出。');if(!project.nodes.some(n=>n===node))throw Error('模块已改变，请重新选择。');const errors=C.forceOutputIssues(node,map);if(errors.length)throw Error(errors.map(i=>i.message).join('；'));invalidate();if(Object.keys(map).length)outputForces[node.id]=copy(map);else delete outputForces[node.id];render();status(Object.keys(map).length?'已应用强制输出，仅当前页面有效；旧运行记录已清除。':'已取消本模块强制，旧运行记录已清除。');}catch(e){status(e.message,true);}}});
 function forcePin(id,port){return signalCatalog().forces.get(id)?.has(port)||false;}

 function inactiveReason(id){const cache=signalCatalog();return cache.inactive.get(id)||'';}
 function allowBlockAddition(){if(canvasTool!=='trace-output')return true;status('请先按Esc退出溯源恢复，再添加模块。');return false;}
 function changeDisabled(ids,disabled){
  stop();const nodes=project.nodes.filter(n=>ids.includes(n.id));if(!nodes.some(n=>(n.disabled===true)!==disabled)){status(disabled?'所选模块已禁用。':nodes.some(n=>inactiveReason(n.id))?'此模块因上游被禁用而暂停，请恢复被禁用的上游模块。':'所选模块已启用。');return;}
  try{const next=C.setNodeDisabled(project,ids,disabled);mutate(()=>{project=next;executionDraftKey='';});const scope=C.executionScope(project);status('已'+(disabled?'禁用':'恢复')+' '+nodes.length+' 个模块；依赖暂停 '+scope.suspended.length+' 个，参与运算 '+scope.active.length+' 个。连线保留，旧运行记录已清除。');}catch(e){status(e.message,true);}
 }
 function executionSetting(n){
  const host=$('properties'),row=html('label',{class:'execution-setting'}),box=html('input',{id:'node-disabled',type:'checkbox','data-execution-toggle':''});box.checked=n.disabled===true;box.onchange=()=>changeDisabled([n.id],box.checked);row.append(box,document.createTextNode('禁用此模块'));host.append(row);
  const reason=inactiveReason(n.id);if(reason)host.append(html('p',{class:'source-note execution-status'},reason+(n.disabled===true?'：不参与运算；依赖它的下游自动暂停。':'：上游被禁用，恢复上游后自动解除。')));
 }

 function signalCatalog(){if(!signalCache||signalCache.project!==project||signalCache.revision!==logicRevision){const scope=engineeringScope(),inactive=new Map([...scope.disabled.map(id=>[id,'已禁用']),...scope.suspended.map(id=>[id,'依赖暂停'])]),displayAll=T.channels(project,{includeInactive:true,outputForces}).map(c=>inactive.has(c.nodeId)?{...c,inactive:inactive.get(c.nodeId)}:c),all=displayAll.filter(c=>!inactive.has(c.nodeId)),byKey=new Map(all.map(c=>[c.key,c]));signalCache={project,revision:logicRevision,scope,inactive,all,byKey,keys:new Set(byKey.keys()),signature:JSON.stringify(all),capacity:engineering?PE.recordingPlan(engineeringDocument(),{outputForces:allForces()}):C.recordingPlan(topProject(),{outputForces:insideMacro()?canvasSessions.get(activeCanvasId)?.outputForces||{}:outputForces}),forces:new Map(C.outputForcing(project,outputForces).pins.map(pin=>pin.nodeId).filter((id,i,ids)=>ids.indexOf(id)===i).map(id=>[id,new Set(Object.keys(outputForces[id]||{}))])),displayAll};}return signalCache;}

 function nodeSelection(){if(!selected){selectedNodes.clear();return selectedNodes;}const available=new Set(project.nodes.map(n=>n.id));for(const id of selectedNodes)if(!available.has(id))selectedNodes.delete(id);if(!available.has(selected)){selected=null;selectedNodes.clear();}else if(!selectedNodes.has(selected))selectedNodes=new Set([selected]);return selectedNodes;}
 function selectOnly(id){selected=id;selectedNodes=new Set(id?[id]:[]);selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;}
 function beginProjectLoad(inputId){if(canvasTool!=='select')setCanvasTool('select');return cancelProjectReads(inputId);}
 function cancelProjectReads(inputId){
  const load=++projectLoad;if(importDraft)closeImport();for(const id of ['open-file','import-files'])if(id!==inputId)$(id).value='';return load;
 }
 function connectInput(owner,port,routing=null){
  if(!pending){status('请先选择输出端口。',true);return false;}if(pending.section==='states'){status('内部状态探针只能接入示波器，不能作为算法引脚。',true);return false;}if(timer){status('请先暂停并复位，再修改逻辑连线。',true);return false;}
  const edge={from:pending.id,fromPort:pending.port,to:owner,toPort:port,...(routing?{routing}:{})},from=project.nodes.find(n=>n.id===edge.from),to=project.nodes.find(n=>n.id===edge.to);if(!from||!to){status('源块或目标块已不存在。',true);return false;}const output=C.ports(from).outputs[edge.fromPort];let input=C.ports(to).inputs[edge.toPort],recordingKind=null;
  if(to.type===LogicWaveRecorder.type&&!to.macroReference&&port==='IN1'){
   if(to.params.mode==='replay'){status('请先将录波模块切回采集，再连接输入。',true);return false;}
   if(['boolean','analog','packed16'].includes(output)){
    if(!recorderOutputCompatible(to,output)){status('录波信号与现有下游连线类型不符。请先断开不兼容的输出连线。',true);return false;}
    recordingKind=input=output;
   }
  }
  if(!output||!input){status('所选端口不存在，连接未建立。',true);return false;}const display=MS.isDisplay(from)||MS.isDisplay(to);if((!['boolean','analog','packed16'].includes(output)||!['boolean','analog','packed16'].includes(input))&&!display){status('请先明确端口信号类型，连接未建立。',true);return false;}if(['boolean','analog','packed16'].includes(output)&&['boolean','analog','packed16'].includes(input)&&output!==input){status('端口类型不符，连接未建立。',true);return false;}if(project.edges.some(x=>x.to===edge.to&&x.toPort===edge.toPort)){status('目标输入已有驱动，请先删除原连接。',true);return false;}
  mutate(()=>{if(recordingKind){to.params.kind=recordingKind;to.initial={};}project.edges.push(edge);pending=null;});status('连接已建立，旧运行记录已清除。');return true;
 }
 function crossPageRecovery(){return !insideMacro()&&$('trace-output-scope').value==='project'&&engineering?.canvases.length>1;}
 function prepareTraceCanvas(){
  if(canvasTool!=='trace-output'||crossPageRecovery()||tracePreparedCanvases.has(canvasKey()))return;
  tracePreparedCanvases.add(canvasKey());
  if(project.nodes.some(n=>n.disabled!==true))changeDisabled(project.nodes.map(n=>n.id),true);else if(run)invalidate();
 }
 function recoveryLabel(){return crossPageRecovery()?'跨页溯源':'单页溯源';}
 function updateCanvasTool(){const scope=$('trace-output-scope'),cross=!insideMacro()&&engineering?.canvases.length>1;scope.querySelector('[value="project"]').disabled=!cross;if(!cross)scope.value='canvas';$('trace-output-tool').title=recoveryLabel()+'：先禁用'+(crossPageRecovery()?'全部画布':'当前画布')+'模块，再点击OUTPUT或IN1端子，累加恢复上游依赖；Esc退出';const deleting=canvasTool==='delete',wiring=canvasTool==='wire';for(const mode of ['disable','restore','trace-output'])$(mode+'-tool').setAttribute('aria-pressed',String(canvasTool===mode));$('canvas').classList.toggle('execution-tool-mode',['disable','restore'].includes(canvasTool));$('delete-tool').setAttribute('aria-pressed',String(deleting));$('wire-tool').setAttribute('aria-pressed',String(wiring));$('select-tool').setAttribute('aria-pressed',String(canvasTool==='select'));$('canvas').classList.toggle('delete-mode',deleting);$('canvas').classList.toggle('trace-output-mode',canvasTool==='trace-output');$('canvas').classList.toggle('wire-mode',wiring);for(const tool of ['pen','eraser','rect','ellipse','text']){const panel=$(tool+'-settings');$(tool+'-tool').setAttribute('aria-pressed',String(canvasTool===tool));if(canvasTool!==tool&&panel.matches(':popover-open'))panel.hidePopover();}annotations.setMode(canvasTool);}
 function setCanvasTool(mode){const enteringRecovery=mode==='trace-output'&&canvasTool!=='trace-output';if(drag)cancelGesture();if(['wire','delete','disable','restore','trace-output'].includes(mode))stop();canvasTool=mode;wireDraft=null;pending=null;repairDraft=null;selectOnly(null);if(enteringRecovery){tracePreparedCanvases.clear();if(crossPageRecovery())changeEngineeringDisabled(engineeringDocument().canvases.flatMap(c=>c.project.nodes.map(n=>PE.nodeKey(c.id,n.id))),true);else prepareTraceCanvas();}updateCanvasTool();render();$('canvas').focus({preventScroll:true});status(mode==='trace-output'?(project.nodes.some(n=>n.type==='OUTPUT'&&!n.macroReference)?recoveryLabel()+'：已禁用'+(crossPageRecovery()?'全部画布':'当前画布')+'模块，仅点击OUTPUT观察点或其IN1端子，累加恢复上游；Esc退出。':recoveryLabel()+'：当前没有OUTPUT观察点。Esc退出后可添加。'):mode==='disable'?'禁用工具：点击模块禁用，依赖它的下游自动暂停；Esc退出。':mode==='restore'?'恢复工具：点击被禁用模块恢复；依赖暂停的模块需恢复其上游；Esc退出。':mode==='delete'?'删除工具已启用：点击元素删除，空白拖框批量删除；Esc退出。':mode==='wire'?'连线工具已启用：从端口或主线起笔，点击空白设置折点，接到目标端；Esc取消。':mode==='rect'?'方框：拖拽绘制，Shift约束正方形；Esc退出。':mode==='ellipse'?'圆形与椭圆：拖拽绘制，Shift约束正圆；Esc退出。':mode==='text'?'文本：点击位置输入，Ctrl+Enter或点击别处完成，Esc取消；退出工具后仍保留。':mode==='pen'?'手写笔已启用：临时标注不写入工程，刷新或关闭页面后丢弃；Esc退出。':mode==='eraser'?'橡皮擦已启用：仅擦除临时笔迹；Esc退出。':'已切换到选择工具。');}
 function recoverOutput(id){try{const n=project.nodes.find(n=>n.id===id),cross=crossPageRecovery(),ids=cross?PE.outputDependencies(engineeringDocument(),activeCanvasId,id):C.outputDependencies(project,id);if(cross)changeEngineeringDisabled(ids,false);else changeDisabled(ids,false);status(recoveryLabel()+'：已恢复 '+n.name+' 及 '+(ids.length-1)+' 个依赖模块'+(cross?'，涉及 '+new Set(ids.map(key=>JSON.parse(key)[0])).size+' 张画布':'；其他画布状态不变')+'；可继续点击其他OUTPUT累加恢复，Esc退出。');}catch(e){status(e.message,true);}}
 function wireToolHit(target,p){const terminal=target.closest('[data-direction]');if(terminal){const n=project.nodes.find(n=>n.id===terminal.dataset.owner);if(n)return{kind:terminal.dataset.direction,id:n.id,port:terminal.dataset.port,point:point(n,terminal.dataset.port,terminal.dataset.direction)};}const net=target.closest('[data-wire-net]'),edge=target.closest('[data-edge-index]'),logical=edge&&project.edges[Number(edge.dataset.edgeIndex)],entry=wireNets.get(net?.dataset.wireNet||(logical?JSON.stringify([logical.from,logical.fromPort]):null));if(entry){const snap=MW.nearest(p,entry.net.segments),host=entry.entries.find(e=>snap?.segment.edgeIndices.includes(e.index));if(snap&&host)return{kind:'net',id:entry.from,port:entry.port,point:{...snap.point,nx:snap.segment.a.x===snap.segment.b.x?1:0,ny:snap.segment.a.y===snap.segment.b.y?1:0},branch:{to:host.edge.to,toPort:host.edge.toPort}};}return null;}
 function wireToolPoint(raw){const p={x:Math.round(raw.x/10)*10,y:Math.round(raw.y/10)*10},last=wireDraft?.points.at(-1)||wireDraft?.start.point,m=$('canvas').getScreenCTM(),tolerance=6/Math.max(.001,Math.hypot(m.a,m.b));if(last){if(Math.abs(raw.x-last.x)<tolerance)p.x=last.x;if(Math.abs(raw.y-last.y)<tolerance)p.y=last.y;}return p;}
 function wireToolClick(e){const raw=toWorld(e),p=wireToolPoint(raw),hit=wireToolHit(e.target,p);if(!wireDraft){if(!hit){status('请从输出端、输入端或已有主线起笔。',true);return;}wireDraft={start:hit,points:[],cursor:hit.point};drawGesture();status(hit.kind==='input'?'已选输入端：点击空白放置折点，再接输出端或主线。':'已选信号源：点击空白放置折点，再接目标输入。');return;}
  if(hit){const reverse=wireDraft.start.kind==='input',input=reverse?wireDraft.start:hit,source=reverse?hit:wireDraft.start;if(input.kind!=='input'||!['output','net'].includes(source.kind)){status('请连接一个源输出（或其主线）和一个目标输入；不能合并两个信号源。',true);return;}let points=MW.polyline([wireDraft.start.point,...wireDraft.points,hit.point],wireDraft.start.point.ny?'v':'h',hit.point.ny?'v':'h');if(reverse)points.reverse();const routing={mode:'manual',points,...(source.branch?{branch:source.branch}:{})},previous=wireDraft;pending={id:source.id,port:source.port};wireDraft=null;if(!connectInput(input.id,input.port,routing)){pending=null;wireDraft=previous;}drawGesture();return;}
  if(e.target.closest('[data-node-id],[data-scope-id],[data-probe-key],[data-svg-candidate]')){status('请点击明确的端口或信号主线完成连接，空白处可放置折点。',true);return;}wireDraft.points.push(p);wireDraft.cursor=p;drawGesture();status('折点已加入；接到目标端完成，Backspace撤回折点，Esc取消。');
 }
 function eraseHit(target){const t=CD.empty(),scope=target.closest('[data-scope-id]'),probe=target.closest('[data-probe-key]'),candidate=target.closest('[data-svg-candidate]'),net=target.closest('[data-wire-net]'),edge=target.closest('[data-edge-index]'),node=target.closest('[data-node-id]'),inlet=target.closest('[data-scope-input]');if(scope)t.scopes.push(scope.dataset.scopeId);else if(probe)t.probes.push({scopeId:probe.dataset.probeScope,key:probe.dataset.probeKey});else if(candidate)t.candidates.push(candidate.dataset.svgCandidate);else if(net)t.edges.push(...(wireNets.get(net.dataset.wireNet)?.entries||[]).map(e=>e.index));else if(edge)t.edges.push(Number(edge.dataset.edgeIndex));else if(node)t.nodes.push(node.dataset.nodeId);else if(inlet)t.scopes.push(inlet.dataset.scopeInput);return t;}
 function eraseInRect(rect){const t=CD.empty(),inside=b=>b.x>=rect.x&&b.y>=rect.y&&b.x+b.width<=rect.right&&b.y+b.height<=rect.bottom;for(const n of project.nodes)if(inside({x:n.x,y:n.y,width:width(n),height:height(n)}))t.nodes.push(n.id);for(const s of project.scopes||[])if(inside({...S.bounds(s),x:s.x-40,width:S.bounds(s).width+40}))t.scopes.push(s.id);for(const entry of wireNets.values())for(const[index,route]of Object.entries(entry.net.routes))if(route.points.length>1&&route.points.every(p=>p.x>=rect.x&&p.x<=rect.right&&p.y>=rect.y&&p.y<=rect.bottom))t.edges.push(Number(index));for(const g of $('edge-layer').querySelectorAll('[data-svg-candidate]')){const path=g.querySelector('.imported-connection-wire');if(path&&inside(path.getBBox()))t.candidates.push(g.dataset.svgCandidate);}for(const g of $('probe-layer').querySelectorAll('[data-probe-key]')){const path=g.querySelector('.probe-wire');if(path&&inside(path.getBBox()))t.probes.push({scopeId:g.dataset.probeScope,key:g.dataset.probeKey});}return t;}
 function performErase(targets){try{if(timer){status('请先暂停运行，再删除元素。',true);return;}const result=CD.apply(project,targets);if(!result.changed){status('框内没有完整包含的可删除元素。');return;}const commit=result.logicChanged?mutate:mutateView;commit(()=>{for(const id of targets.nodes||[])waveDrafts.delete(id);project=result.project;selectOnly(null);pending=null;});const c=result.counts,parts=[[c.nodes,'个模块'],[c.edges+c.candidates,'条连线'],[c.scopes,'个示波器'],[c.probes,'个探针']].filter(([count])=>count).map(([count,label])=>count+label);status('已删除 '+parts.join('、')+'；可撤销。');}catch(e){status(e.message,true);}}
 function drawGesture(){
  const layer=$('gesture-layer');if(!layer)return;if(layer.childElementCount)layer.replaceChildren();if(wireDraft){const points=MW.polyline([wireDraft.start.point,...wireDraft.points,wireDraft.cursor],wireDraft.start.point.ny?'v':'h');layer.append(el('path',{'data-gesture':'manual-wire',class:'gesture-wire',d:MW.path(points)}));for(const p of [wireDraft.start.point,...wireDraft.points])layer.append(el('circle',{cx:p.x,cy:p.y,r:3,class:'wire-draft-point'}));}if(!drag?.moved)return;
  if(drag.kind==='wire'){const n=project.nodes.find(n=>n.id===drag.from);if(!n)return;const a=point(n,drag.port,'output'),b=drag.to,k=Math.max(35,Math.abs(b.x-a.x)*.4);layer.append(el('path',{'data-gesture':'wire',class:'gesture-wire',d:W.curvePath(a,b,k)}));}
  if(drag.kind==='marquee')layer.append(el('rect',{'data-gesture':'marquee',class:'selection-box',x:Math.min(drag.x,drag.to.x),y:Math.min(drag.y,drag.to.y),width:Math.abs(drag.to.x-drag.x),height:Math.abs(drag.to.y-drag.y)}));
 }
 function cancelGesture(){
  const old=drag;drag=null;$('canvas').classList.remove('panning');if(old?.kind==='node'&&old.moved)for(const start of old.positions){const n=project.nodes.find(n=>n.id===start.id);if(n){n.x=start.x;n.y=start.y;}}
  if(old?.kind==='scope'&&old.moved){const s=project.scopes?.find(s=>s.id===old.id);if(s)for(const key of ['x','y','width','height'])s[key]=old.start[key];}
  if(old?.kind==='pan'){camera=old.camera;setCamera();}if(old?.kind==='wire')pending=old.previousPending;
  if(old?.kind==='marquee'){selectedNodes=new Set(old.previousIds);selected=old.previousSelected;pending=old.previousPending;}
  drawGesture();render();
 }
 function status(message,error=false){$('status').textContent=message;$('status').title=message;$('status').classList.toggle('error',error);}
 function el(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
 function html(tag,attrs={},text){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
 function current(){return trace[cursor??trace.length-1];}
 function signalState(n){
  const frame=current(),output=frame?.values?.[n.id]??null,types=C.valueTypes(n);
  const quality=Object.fromEntries(Object.keys(output||{}).filter(pin=>types[pin]!=='packed16').map(pin=>[pin,C.signalQuality.read(frame,n.id,pin)]));
  return JSON.stringify({output,...(frame?.computedValues?.[n.id]?{computedOutput:frame.computedValues[n.id]}:{}),...(Object.keys(quality).length?{quality}:{}),state:frame?.states?.[n.id]??null},null,2);
 }
 function stop(){if(timer)clearInterval(timer);timer=null;}
 function invalidate(){stop();closeSource();logicRevision++;runtimeFailure=null;run=null;trace=[];rootTrace=[];engineeringTrace=[];cursor=null;clearComparison();}
 function remember(){undo.push(historyState());if(undo.length>50)undo.shift();redo=[];}
 function mutate(fn){if(timer){status('请先暂停并复位，再修改组态。',true);return;}remember();invalidate();fn();engineeringDocument();MS.inferTypes(project);render();}
 function mutateView(fn){remember();fn();syncMacro();render();}
 function sameLogic(a,b){const key=x=>x.engineering?PE.fingerprints(x.engineering).simulation:F.logicKey(x.project||x);return key(a)===key(b);}
 function connectProbe(scopeId,index){const channel=signalCatalog().all.find(c=>c.nodeId===pending?.id&&c.field===pending?.port&&c.section===(pending?.section||'values'));if(!channel){status('请先点击类型已明确的输出端口，或在属性区选取内部状态探针。',true);return false;}const scope=project.scopes?.find(s=>s.id===scopeId);if(!scope)return false;if(scope.channels.includes(channel.key)&&index===undefined){pending=null;canvas();status('此信号已接入该示波器，没有重复添加。');return true;}const next=copy(scope);try{S.connect(next,channel.key,index);}catch(e){status(e.message,true);return false;}mutateView(()=>{scope.channels=next.channels;scope.channelPorts=next.channelPorts;pending=null;selectedProbe=null;});status(scope.name+' · CH'+(S.inputChannels(scope).indexOf(channel.key)+1)+' 已接入观察探针。');return true;}
 function removeProbe(){if(!selectedProbe)return;const{scopeId,key}=selectedProbe;mutateView(()=>{const scope=project.scopes?.find(s=>s.id===scopeId);if(scope)S.setChannels(scope,scope.channels.filter(k=>k!==key));selectedProbe=null;});}
 function probes(){
  const signature=canvasSignature+'|'+JSON.stringify([project.scopes,selectedProbe]);if(signature===probeSignature)return;probeSignature=signature;probeValueElements=[];const layer=$('probe-layer');layer.replaceChildren();const channels=new Map(signalCatalog().displayAll.map(c=>[c.key,c]));
  for(const scope of project.scopes||[]){const slots=S.inputChannels(scope);
   slots.forEach((key,i)=>{const c=channels.get(key),n=c&&project.nodes.find(n=>n.id===c.nodeId);if(!n)return;const b=S.inputPoint(scope,i),physical=c.section==='values'&&Object.hasOwn(C.ports(n).outputs,c.field),a=physical?point(n,c.field,'output'):{x:n.x+width(n),y:n.y+height(n)-10},k=Math.max(35,Math.abs(b.x-a.x)*.4),isSelected=selectedProbe?.scopeId===scope.id&&selectedProbe.key===key,path=el('path',{d:W.curvePath(a,b,k),class:'probe-wire'+(isSelected?' selected':''),stroke:palette[i%palette.length]}),group=el('g',{'data-probe-scope':scope.id,'data-probe-key':key,'data-probe-channel':i}),title=el('title',{},c.label+' → '+scope.name+' CH'+(i+1)+'（观察探针）'),position=W.labelPoint(a,b,k,i),label=el('g',{class:'wire-label',transform:`translate(${position.x},${position.y})`}),rect=el('rect',{y:-10,height:20,rx:3}),text=el('text',{y:4,'text-anchor':'middle'});label.append(rect,text);group.append(title,el('path',{d:path.getAttribute('d'),class:'probe-hit'}),path,label);probeValueElements.push({element:path,label,rect,text,title,nodeId:c.nodeId,section:c.section,port:c.field,kind:c.kind,selected:isSelected,sourceLabel:c.label,scopeName:scope.name});layer.append(group);if(!physical){const marker=K.terminal(c.kind,a);layer.append(el(marker.tag,{...marker.attrs,class:'state-probe-source',stroke:palette[i%palette.length]}));}});
   for(let i=0;i<S.MAX_CHANNELS;i++){const b=S.inputPoint(scope,i),c=channels.get(slots[i]),marker=K.terminal(c?.kind||'unknown',b),input=el('g',{'data-scope-input':scope.id,'data-scope-channel-index':i,class:'scope-input-port',role:'button',tabindex:0,'aria-label':scope.name+' CH'+(i+1)});input.append(el('title',{},scope.name+' CH'+(i+1)+(c?'：'+c.label:'：接入观察探针')),el('circle',{cx:b.x,cy:b.y,r:11,fill:'transparent',stroke:'none'}),el(marker.tag,{...marker.attrs,class:'scope-probe-input','data-port-kind':c?.kind||'unknown'}),el('text',{x:b.x-13,y:b.y+4,'text-anchor':'end',class:'scope-input-label'},'CH'+(i+1)));input.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();connectProbe(scope.id,i);}};layer.append(input);}
  }
 }
 function addScope(where){if(!allowBlockAddition())return;mutateView(()=>{const scope=S.create(project,where?.x??camera.x+camera.w*.22,where?.y??camera.y+camera.h*.2);if(!where){const previous=project.scopes?.at(-1);if(previous){scope.x=previous.x+previous.width+24;scope.y=previous.y;}const occupied=project.nodes.map(n=>({x:n.x,y:n.y,width:width(n),height:height(n)})).concat(project.scopes||[]);if(occupied.some(b=>scope.x<b.x+b.width+20&&scope.x+scope.width+20>b.x&&scope.y<b.y+b.height+20&&scope.y+scope.height+20>b.y)){scope.x=occupied.reduce((x,b)=>Math.max(x,b.x+b.width),scope.x)+40;scope.y=occupied.reduce((y,b)=>Math.min(y,b.y),scope.y);}}if(!project.scopes)project.scopes=[];project.scopes.push(scope);});if(!where)fit();status('示波器已添加；将输出端拖到左侧CH1～CH4端口接入探针，拖动标题放置，右下角调整大小。');}
 function scopes(){S.render($('scope-layer'),project,trace,cursor,{change:(id,fn)=>mutateView(()=>{const s=project.scopes?.find(s=>s.id===id);if(s)fn(s);}),remove:id=>mutateView(()=>{project.scopes=project.scopes.filter(s=>s.id!==id);}),notify:message=>status(message,true),connect:connectProbe,selectedChannels:()=>signalCatalog().all.filter(c=>c.nodeId===selected).map(c=>c.key),gesture:(e,id,mode)=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();$('canvas').focus({preventScroll:true});const scope=project.scopes.find(s=>s.id===id),p=toWorld(e);drag={kind:'scope',pointerId:e.pointerId,mode,id,x:p.x,y:p.y,start:copy(scope),before:historyState(),moved:false};}},{...signalCatalog(),all:signalCatalog().displayAll,byKey:new Map(signalCatalog().displayAll.map(c=>[c.key,c])),signature:JSON.stringify(signalCatalog().displayAll)});}
 function id(){const reserved=new Set(project.nodes.map(n=>n.id));for(const scope of project.scopes||[])for(const key of scope.channels)reserved.add(JSON.parse(key)[0]);let n=1;while(reserved.has('n'+n))n++;return 'n'+n;}
 function number(v){return typeof v==='boolean'?(v?'TRUE':'FALSE'):typeof v==='number'?Number(v.toPrecision(7)).toString():'—';}
 function precise(v){return typeof v==='number'?String(v):number(v);}
 const geometryCache=new WeakMap();
 function displayPrimary(n){return n.type===C.MACRO_TYPE&&!n.macroReference?Object.keys(C.ports(n).outputs)[0]:C.catalog[n.type]?.primaryOutput||'OUT';}
 function displayPorts(n){const ports=C.ports(n);if(!n.macroReference&&!C.catalog[n.type])for(const name of n.provenance?.svgDisplayOutputs||[])if(typeof name==='string'&&!Object.hasOwn(ports.outputs,name))ports.outputs[name]='unknown';if(!n.macroReference&&!C.catalog[n.type])for(const name of n.provenance?.svgDisplayInputs||[])if(typeof name==='string'&&!Object.hasOwn(ports.inputs,name))ports.inputs[name]='unknown';
  if(n.sourceMacroSymbol)return ports;
  if(n.macroReference||!C.catalog[n.type]){const candidates=(project.connectionCandidates||[]).filter(c=>c.status==='pending'&&c.segments?.length),order=(a,b,key)=>(a[key]?.[0]?.y??0)-(b[key]?.[0]?.y??0);
   for(const c of candidates.filter(c=>c.to===n.id&&!c.toPort&&!c.destinationPortSuggestion?.port&&c.destinationPinId).sort((a,b)=>order(a,b,'destinationPoints')))ports.inputs['?'+c.destinationPinId]='unknown';
   for(const c of candidates.filter(c=>c.from===n.id&&!c.fromPort&&!c.sourcePortSuggestion?.port&&c.sourcePinId).sort((a,b)=>order(a,b,'sourcePoints')))ports.outputs['?'+c.sourcePinId]='unknown';}return ports;}
 function geometry(n){const ports=displayPorts(n),key=JSON.stringify([n.type,n.params?.inputs,n.params?.NMIN,n.params?.NUMR,n.params?.kind,n.ioOrientation,n.disabled,inactiveReason(n.id),!!n.macroReference,n.macroPorts,n.sourceMacroSymbol,ports]);let cached=geometryCache.get(n);if(!cached||cached.key!==key){cached={key,value:K.geometry(n,ports)};geometryCache.set(n,cached);}return cached.value;}
 function width(n){return geometry(n).width;}
 function height(n){return geometry(n).height;}
 function point(n,port,direction){const g=geometry(n),pin=g.ports[direction==='input'?'inputs':'outputs'][port]||{x:direction==='input'?0:g.width,y:48,nx:direction==='input'?-1:1,ny:0};return{...pin,x:n.x+pin.x,y:n.y+pin.y};}
 function drawImportedConnections(){
  for(const candidate of project.connectionCandidates||[]){
   if(candidate.status!=='pending'||!candidate.segments?.length)continue;
   const from=project.nodes.find(n=>n.id===candidate.from),to=project.nodes.find(n=>n.id===candidate.to);if(!from||!to)continue;
   const fromPort=candidate.fromPort||candidate.sourcePortSuggestion?.port,toPort=candidate.toPort||candidate.destinationPortSuggestion?.port;
   if(fromPort&&toPort&&project.edges.some(e=>e.from===from.id&&e.fromPort===fromPort&&e.to===to.id&&e.toPort===toPort))continue;
   const locate=(node,port,direction,anchor,pinId)=>{const g=geometry(node),ports=g.ports[direction==='input'?'inputs':'outputs'];if(port&&Object.hasOwn(ports,port))return point(node,port,direction);if(Object.hasOwn(ports,'?'+pinId))return point(node,'?'+pinId,direction);const b=g.body||{x:0,y:30,width:g.width,height:g.height-50},side=anchor?.side||(direction==='input'?'left':'right'),f=anchor?.fraction??.5;return{x:node.x+b.x+(side==='left'?0:side==='right'?b.width:b.width*f),y:node.y+b.y+(side==='top'?0:side==='bottom'?b.height:b.height*f)};};
   const a=locate(from,fromPort,'output',candidate.sourceAnchor,candidate.sourcePinId),b=locate(to,toPort,'input',candidate.destinationAnchor,candidate.destinationPinId),k=Math.max(45,Math.abs(b.x-a.x)*.45),entry=candidate.corroborated&&fromPort?wireNets.get(JSON.stringify([from.id,fromPort])):null,branch=entry?WN.branch(a,{index:0,toId:to.id,point:b},entry.net.segments,{obstacles:routingObstacles,fromId:from.id,source:entry.key}):null,d=branch?.path||W.curvePath(a,b,k),position=branch?.label||W.labelPoint(a,b,k,0),g=el('g',{'data-svg-candidate':candidate.id,class:'imported-connection'+(selectedCandidate===candidate.id?' selected':''),tabindex:0,role:'button','aria-label':'核对导入连线 '+candidate.connectionInstanceKey});
   const open=()=>selectImportedConnection(candidate.id);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
   g.append(el('title',{},'原SVG连线：'+from.name+' → '+to.name+'\n端口名称待映射；此线尚未参与仿真。点击核对。\n'+candidate.evidence),el('path',{d,class:'imported-connection-hit'}),el('path',{d,class:'imported-connection-wire','vector-effect':'non-scaling-stroke'}));
   for(const p of [a,b])g.append(el('path',{d:`M ${p.x} ${p.y-5} l 5 5 -5 5 -5 -5 Z`,class:'imported-connection-pin'}));
   const label=el('g',{transform:`translate(${position.x},${position.y})`,class:'imported-connection-label'});label.append(el('rect',{x:-38,y:-10,width:76,height:20,rx:3}),el('text',{'text-anchor':'middle',y:4},'待映射端口'));g.append(label);$('edge-layer').append(g);
   if(entry&&branch.points.length>1){const p=branch.attachment,root=a,existing=[...entry.net.junctions,...(entry.extraJunctions||[])];if(Math.abs(p.x-root.x)+Math.abs(p.y-root.y)>1e-7&&!existing.some(q=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y)<1e-7)){const dot=el('circle',{cx:p.x,cy:p.y,r:3.5,class:'wire-junction '+entry.kind,'data-wire-net':entry.key});$('edge-layer').append(dot);entry.extraJunctions||=[];entry.extraJunctions.push(p);const binding=wireValueElements.find(v=>v.netKey===entry.key&&v.edgeIndex===entry.net.rootEdgeIndex);if(binding)(binding.junctions||=[]).push(dot);}}
  }
  scaleJunctions();
 }
 function scaleJunctions(){const svg=$('canvas'),m=svg.getScreenCTM(),r=3.5/(m?Math.hypot(m.a,m.b):svg.clientWidth/camera.w||1);for(const dot of svg.querySelectorAll('.wire-junction'))dot.setAttribute('r',r);}
 function setCamera(){const s=$('canvas');s.setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);$('zoom').textContent=Math.round(s.clientWidth/camera.w*100)+'%';scaleJunctions();}
 function fit(onlyIds){const filtered=Array.isArray(onlyIds)&&onlyIds.length,objects=[...project.nodes.filter(n=>!filtered||onlyIds.includes(n.id)).map(n=>({x:n.x,y:n.y,width:width(n),height:height(n)})),...(filtered?[]:(project.scopes||[]).map(S.bounds)),...(!filtered&&titleBlockBox?[titleBlockBox]:[])];if(!objects.length){camera={x:0,y:0,w:1000,h:600};setCamera();return;}const x=Math.min(...objects.map(n=>n.x))-70,y=Math.min(...objects.map(n=>n.y))-55,w=Math.max(...objects.map(n=>n.x+n.width))+70-x,h=Math.max(...objects.map(n=>n.y+n.height))+50-y;const ratio=$('canvas').clientWidth/Math.max(1,$('canvas').clientHeight);camera={x,y,w:Math.max(w,h*ratio),h:Math.max(h,w/ratio)};setCamera();}
 function toWorld(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());return{x:p.x,y:p.y};}
 function add(type,where){if(!allowBlockAddition())return;let added;const columns=Math.max(1,Math.floor((camera.w-120)/380));mutate(()=>{const n=C.newNode(type,id(),where?.x??camera.x+80+(project.nodes.length%columns)*380,where?.y??camera.y+90+Math.floor(project.nodes.length/columns)*280);if(engineering&&!insideMacro()&&['INPUT','OUTPUT'].includes(type)){const used=new Set(engineeringDocument().canvases.flatMap(c=>c.project.nodes.filter(n=>['INPUT','OUTPUT'].includes(n.type)).map(n=>n.name.trim())));let suffix=1;while(used.has(n.name))n.name=type+(++suffix);}project.nodes.push(n);added=n;selectOnly(n.id);});if(!where&&added&&(added.x+width(added)>camera.x+camera.w-20||added.y+height(added)>camera.y+camera.h-20))fit();}
 function library(){const term=$('search').value.toUpperCase();$('catalog').replaceChildren();for(const group of ['信号','逻辑','状态','数值','待核查']){const list=Object.entries(C.catalog).filter(([type,d])=>d.group===group&&(type.includes(term)||d.label.includes(term)));if(!list.length)continue;$('catalog').append(html('div',{class:'group-title'},group));for(const[type,d]of list){const b=html('button',{'data-add':type,draggable:'true',class:'block-choice'+(d.unverified?' pending':'')});const glyph=html('span',{class:'glyph'});if(K.profiles[type]){const sample=K.geometry({type},C.ports({type,params:d.defaults})),box=sample.body,preview=el('svg',{viewBox:`${box.x-6} ${box.y-box.height*.16-6} ${box.width+12} ${box.height*1.32+12}`,width:26,height:26,'aria-hidden':true});K.render(preview,sample,el);glyph.append(preview);}else glyph.textContent=type==='INPUT'?'↗':type==='OUTPUT'?'◉':'ƒ';b.append(glyph);const txt=html('span',{},type);txt.append(html('small',{},d.label));b.append(txt);b.onclick=()=>add(type);b.ondragstart=e=>e.dataTransfer.setData('text/plain',type);$('catalog').append(b);}}
  const definitions=(project.library||[]).filter(d=>d.graph&&d.name.toUpperCase().includes(term));if(definitions.length)$('catalog').append(html('div',{class:'group-title'},'宏定义 · 独立实例'));
  for(const d of definitions){const b=html('button',{class:'block-choice','data-macro-definition':d.id},d.name);b.onclick=()=>{if(!allowBlockAddition())return;try{const current=project.library.find(x=>x.id===d.id),n=M.instantiate(current,id(),camera.x+120,camera.y+120);mutate(()=>{project.nodes.push(n);selectOnly(n.id);});}catch(e){status(e.message,true);}};$('catalog').append(b);}if(!term||'示波器 SCOPE'.includes(term)){const b=html('button',{id:'add-scope',class:'block-choice',draggable:'true'});b.append(html('span',{class:'glyph'},'∿'),html('span',{},'示波器'));b.onclick=()=>addScope();b.ondragstart=e=>e.dataTransfer.setData('text/plain','SCOPE');$('catalog').append(html('div',{class:'group-title'},'观察仪表'),b);}librarySignature=JSON.stringify((project.library||[]).map(d=>[d.id,d.name,!!d.graph]));
 }
 function paintWireLabel(binding,d){if(!binding.label)return;const labelClass='wire-label '+binding.kind+' '+d.state+(binding.section!=='states'&&forcePin(binding.nodeId,binding.port)?' forced':'');if(binding.label.getAttribute('class')!==labelClass)binding.label.setAttribute('class',labelClass);if(binding.text.textContent!==d.text){binding.text.textContent=d.text;const width=Math.max(30,d.text.length*(d.state==='inactive'?12:7)+12);binding.rect.setAttribute('width',width);binding.rect.setAttribute('x',-width/2);}}
 function paperBoxes(){return [...project.nodes.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y,width:width(n),height:height(n)})),...(project.scopes||[]).map(s=>({id:s.id,name:s.name,...S.bounds(s),x:s.x-40,width:S.bounds(s).width+40}))];}
 function titleBlockData(){const saved=project.titleBlock;if(Object.hasOwn(project,'titleBlock')&&(!saved||saved.schemaVersion>=2))return saved;const name=project.importMetadata?.file||project.importAudit?.target,sources=(project.sources||[]).filter(s=>s.name===name&&/\.svg$/i.test(s.name));const text=sources.length===1?sources[0].text:saved?.sourceXML||null;if(text!==titleSourceText){titleSourceText=text;titleSourceData=null;if(text&&!/<!\s*(DOCTYPE|ENTITY)\b/i.test(text)){try{const doc=new DOMParser().parseFromString(text,'image/svg+xml');if(!doc.querySelector('parsererror'))titleSourceData=TB.extract(doc.documentElement,name);}catch{}}}return titleSourceData||saved||null;}
 function drawTitleBlock(){try{titleBlockView=TB.render($('title-block-layer'),titleBlockData(),paperSettings(),P.sanitize,DOMParser,titleBlockView);titleBlockBox=titleBlockView?.box||null;}catch(e){$('title-block-layer').replaceChildren();titleBlockView=null;titleBlockBox=null;}}
 function paperSettings(){if(project.paper)return{borderStyle:'dashed',...project.paper};if(!defaultPaper)defaultPaper=titleBlockData()?.sourcePaper||LogicPaper.initial(paperBoxes());return defaultPaper;}
 function drawPaper(){const p=paperSettings(),key=JSON.stringify(p);if(key===paperBorderKey)return;paperBorderKey=key;for(const id of ['paper-surface','paper-boundary'])for(const k of ['x','y','width','height'])$(id).setAttribute(k,p[k]);$('paper-boundary').setAttribute('visibility',p.showBorder?'visible':'hidden');$('paper-boundary').setAttribute('data-style',p.borderStyle);}
 function fitPaper(){const p=paperSettings(),ratio=$('canvas').clientWidth/Math.max(1,$('canvas').clientHeight),w=p.width+80,h=p.height+80;camera={x:p.x-40,y:p.y-40,w:Math.max(w,h*ratio),h:Math.max(h,w/ratio)};setCamera();}
 function paperPanel(){
  const host=$('paper'),p=paperSettings(),key=JSON.stringify([waveProject,p]);
  if(paperPanelKey!==key){paperPanelKey=key;host.replaceChildren(html('h3',{},'画纸设置'));host.append(html('p',{class:'source-note'},'宽高与位置使用画布单位。边界提示排布范围；更改画纸保留布局、运行记录和输入草稿。'));
   const form=html('div',{class:'paper-controls'});for(const[k,label]of [['x','左边界'],['y','上边界'],['width','宽度'],['height','高度']]){const input=field(form,label,'paper-'+k,p[k]);input.step='any';if(k==='width'||k==='height')input.min='0.001';}field(form,'边界线','paper-style',p.borderStyle,[['dashed','虚线'],['solid','实线']]);const visible=html('label',{class:'paper-visible'},'显示边界线 '),check=html('input',{id:'paper-visible',type:'checkbox'});check.checked=p.showBorder;visible.append(check);form.append(visible);host.append(form);
   const actions=html('div',{class:'paper-actions'}),apply=html('button',{id:'paper-apply',class:'primary'},'应用画纸设置'),content=html('button',{id:'paper-fit-content'},'包围全部内容'),view=html('button',{id:'paper-view'},'查看整张画纸');actions.append(apply,content,view);host.append(actions,html('p',{id:'paper-summary',class:'source-note',role:'status'}));
   apply.onclick=()=>{try{const next={...project.paper,showBorder:$('paper-visible').checked,borderStyle:$('paper-style').value};for(const k of ['x','y','width','height']){const value=$('paper-'+k).value.trim();if(!value)throw Error('请填写画纸位置和宽高');next[k]=Number(value);}const error=LogicPaper.validate(next);if(error)throw Error(error);mutateView(()=>project.paper=next);status('画纸设置已应用；原布局、运行记录和输入草稿保留。');}catch(e){status(e.message,true);}};
   content.onclick=()=>{mutateView(()=>project.paper={...LogicPaper.initial(paperBoxes()),showBorder:p.showBorder,borderStyle:p.borderStyle});fitPaper();status('画纸已包围全部模块及示波器。');};view.onclick=fitPaper;
  }
  const outside=LogicPaper.outside(p,paperBoxes());$('paper-summary').textContent=outside.length?'超出画纸 '+outside.length+' 个对象：'+outside.slice(0,5).map(b=>b.name||b.id).join('、')+(outside.length>5?'…':''):'全部模块和示波器均在画纸范围内。';
 }
 let routingObstacles=[],routingOccupied=[],wireNets=new Map();
 function drawLogicNets(){
  wireNets=new Map();const groups=new Map();project.edges.forEach((edge,index)=>{const key=JSON.stringify([edge.from,edge.fromPort]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({edge,index});});
  for(const[key,entries]of groups){const first=entries[0].edge,from=project.nodes.find(n=>n.id===first.from);if(!from)continue;const source=point(from,first.fromPort,'output'),targets=entries.map(({edge,index})=>{const to=project.nodes.find(n=>n.id===edge.to);return to?{index,toId:to.id,toPort:edge.toPort,routing:edge.routing,point:point(to,edge.toPort,'input')}:null;}).filter(Boolean);if(!targets.length)continue;
   const net=WN.route(source,targets,{obstacles:routingObstacles,occupied:routingOccupied,fromId:from.id,source:key}),kind=C.ports(from).outputs[first.fromPort]||'unknown',entry={key,from:from.id,port:first.fromPort,entries,net,kind};wireNets.set(key,entry);
   const elements=new Map();for(const{edge,index}of entries){if(!net.routes[index])continue;const stroke=net.strokes.find(s=>s.edgeIndex===index),g=el('g',{'data-edge-index':index,class:'logic-edge'}),title=el('title',{class:'wire-edge-title'}),wire=el('path',{d:stroke?.path||'M'+source.x+','+source.y,class:'wire','vector-effect':'non-scaling-stroke','pointer-events':'none'});g.append(title,wire);let label=null,rect=null,text=null,netTitle=null;
    if(index===net.rootEdgeIndex){label=el('g',{class:'wire-label','data-wire-label-for':entries.map(e=>e.index).join(' '),transform:`translate(${net.label.x},${net.label.y})`,...(entries.length>1?{'data-wire-net':key}:{})});rect=el('rect',{y:-10,height:20,rx:3});text=el('text',{y:4,'text-anchor':'middle'});netTitle=el('title');label.append(rect,text,netTitle);g.append(label);}
    $('edge-layer').append(g);elements.set(index,g);wireValueElements.push({element:wire,label,rect,text,title,netTitle,netCount:entries.length,netKey:key,edgeIndex:index,nodeId:from.id,port:edge.fromPort,toId:edge.to,toPort:edge.toPort,sourceName:from.name,kind,selected:selectedEdge===index||selectedNet===key});
   }
   const shared=el('g',{class:'wire-shared-hits'});for(const segment of net.segments){const attributes={d:`M${segment.a.x},${segment.a.y} L${segment.b.x},${segment.b.y}`,class:'net-hit','vector-effect':'non-scaling-stroke'};if(segment.edgeIndices.length===1)elements.get(segment.edgeIndices[0])?.append(el('path',attributes));else if(segment.edgeIndices.length>1)shared.append(el('path',{...attributes,'data-wire-net':key}));}$('edge-layer').append(shared);
   const dots=net.junctions.map(j=>{const dot=el('circle',{cx:j.x,cy:j.y,r:3.5,class:'wire-junction '+kind,'data-wire-net':key,'data-degree':j.degree});dot.append(el('title',{},from.name+'.'+first.fromPort+' · 同源分叉'));$('edge-layer').append(dot);return dot;}),binding=wireValueElements.find(b=>b.netKey===key&&b.edgeIndex===net.rootEdgeIndex);if(binding)binding.junctions=dots;const rootGroup=elements.get(net.rootEdgeIndex),valueLabel=rootGroup?.querySelector('.wire-label');if(rootGroup&&valueLabel){rootGroup.append(valueLabel);$('edge-layer').append(rootGroup);}
   for(const stroke of net.strokes)routingOccupied.push({source:key,points:stroke.points});
   if(selectedEdge!==null&&net.routes[selectedEdge])$('edge-layer').append(el('path',{d:net.routes[selectedEdge].path,class:'wire-selected-route'+(forcePin(from.id,first.fromPort)?' forced':''),'vector-effect':'non-scaling-stroke','pointer-events':'none'}));
  }
  if(selectedNet&&!wireNets.has(selectedNet))selectedNet=null;scaleJunctions();
 }
 function canvas(){
  drawPaper();drawTitleBlock();const scope=signalCatalog().scope,summary=$('execution-scope-summary');summary.hidden=!scope.disabled.length;summary.textContent='禁用 '+scope.disabled.length+' · 依赖暂停 '+scope.suspended.length+' · 参与 '+scope.active.length;summary.title='当前只运行参与范围内的逻辑；灰色模块没有仿真值。';
  const selection=nodeSelection(),frame=current(),values=frame?.values||{},signature=JSON.stringify([project.nodes.map(n=>[n.id,n.type,n.name,n.x,n.y,n.params?.inputs,n.params?.NMIN,n.params?.NUMR,n.params?.kind,n.ioOrientation,n.disabled,inactiveReason(n.id),Object.keys(outputForces[n.id]||{}),!!n.macroReference,n.type===C.MACRO_TYPE&&!n.macroReference?C.ports(n):n.macroPorts,n.sourceMacroSymbol]),project.edges.map(e=>[e.from,e.fromPort,e.to,e.toPort,e.routing]),project.scopes?.map(s=>[s.id,s.x,s.y,s.width,s.height]),titleBlockBox&&[titleBlockBox.x,titleBlockBox.y,titleBlockBox.width,titleBlockBox.height],selected,[...selection].sort(),(project.connectionCandidates||[]).map(c=>[c.id,c.status,c.from,c.to,c.fromPort,c.toPort]),selectedEdge,selectedNet,selectedCandidate,pending,repairDraft&&[repairDraft.from,repairDraft.fromPort,repairDraft.to,repairDraft.toPort]]);
  if(signature!==canvasSignature){canvasSignature=signature;nodeValueElements=[];wireValueElements=[];routingOccupied=[];routingObstacles=project.nodes.map(n=>{const g=geometry(n),b=g.body||{x:0,y:0,width:g.width,height:g.height};return{id:n.id,x:n.x+b.x,y:n.y+b.y,width:b.width,height:b.height};}).concat((project.scopes||[]).map(s=>({id:s.id,x:s.x,y:s.y,width:s.width,height:s.height}))).concat(titleBlockBox?[titleBlockBox]:[]);$('edge-layer').replaceChildren();$('node-layer').replaceChildren();
  drawLogicNets();
  drawImportedConnections();
  if(repairDraft){const a=project.nodes.find(n=>n.id===repairDraft.from),b=project.nodes.find(n=>n.id===repairDraft.to);if(a&&b&&Object.hasOwn(C.ports(a).outputs,repairDraft.fromPort)&&Object.hasOwn(C.ports(b).inputs,repairDraft.toPort)){const from=point(a,repairDraft.fromPort,'output'),to=point(b,repairDraft.toPort,'input'),k=Math.max(45,Math.abs(to.x-from.x)*.45);$('edge-layer').append(el('path',{d:W.curvePath(from,to,k),class:'repair-choice-wire'}),el('text',{x:(from.x+to.x)/2,y:(from.y+to.y)/2-10,class:'repair-choice-label'},'待确认'));}}
  for(const n of project.nodes){const d=C.catalog[n.type],shape=geometry(n),g=el('g',{'data-node-id':n.id,'data-node-type':n.type,'data-forced':String(signalCatalog().forces.has(n.id)),'data-symbol-shape':shape.shape,'data-symbol-source':shape.macro?'SVG ControlMacroReference':shape.manual?'REF_1100 p'+shape.source.page:'software',transform:`translate(${n.x},${n.y})`,'data-execution-state':n.disabled===true?'disabled':inactiveReason(n.id)?'suspended':'active',class:'logic-node'+(n.disabled===true?' execution-disabled':inactiveReason(n.id)?' dependency-suspended':'')+(selection.has(n.id)?' selected':'')+((!d||d.unverified)&&!shape.macro?' unknown':'')});
   g.append(el('rect',{width:shape.width,height:shape.height,rx:3,class:'node-hit'}));K.render(g,shape,el);g.append(el('text',{x:13,y:19,class:'node-title'},n.type===C.MACRO_TYPE&&!n.macroReference?'自定义宏':n.type),el('text',{x:13,y:shape.height-10,class:'node-subtitle'},n.name.length>26?n.name.slice(0,24)+'…':n.name),el('text',{x:shape.width-8,y:shape.height-28,'text-anchor':'end',class:'node-value'},number(values[n.id]?.[displayPrimary(n)])));
   if(signalCatalog().forces.has(n.id))g.append(el('text',{x:shape.width-12,y:19,'text-anchor':'end',class:'forced-badge'},'强制'));const ps=displayPorts(n);for(const [direction,ports]of [['input',ps.inputs],['output',ps.outputs]])Object.entries(ports).forEach(([name,kind])=>{const pin=shape.ports[direction==='input'?'inputs':'outputs'][name],label=pin.label;const marker=K.terminal(kind,pin),terminal=el(marker.tag,{...marker.attrs,'data-port-shape':marker.shape,class:'port '+kind+(direction==='output'&&forcePin(n.id,name)?' forced-port':'')+(C.catalog[n.type]?.selectableInputs?.[name]&&direction==='input'?' selectable-port':'')+((pending?.id===n.id&&pending.port===name&&direction==='output')||(repairDraft&&((direction==='output'&&repairDraft.from===n.id&&repairDraft.fromPort===name)||(direction==='input'&&repairDraft.to===n.id&&repairDraft.toPort===name)))?' port-pending':''),...(pin.sourcePinId?{'data-source-pin-id':pin.sourcePinId}:{}),'data-direction':direction,'data-port':name,'data-owner':n.id,'data-pin-side':pin.side});if(name.startsWith('?')){terminal.removeAttribute('data-direction');const candidate=(project.connectionCandidates||[]).find(c=>c.status==='pending'&&((direction==='input'&&c.to===n.id&&'?'+c.destinationPinId===name)||(direction==='output'&&c.from===n.id&&'?'+c.sourcePinId===name)));if(candidate)terminal.setAttribute('data-svg-candidate',candidate.id);terminal.setAttribute('data-imported-pin',name.slice(1));}terminal.append(el('title',{},(name.startsWith('?')?'原SVG待映射针脚 ':'')+name+' · '+({boolean:'数字量',analog:'模拟量',packed16:'16位打包量'}[kind]||'类型未确定')+(shape.macro?'；来源：自定义宏SVG子引脚':'；手册允许 '+(C.allowedPointRecords(n.type,direction==='input'?'inputs':'outputs',name).join('/')||'待核对'))));g.append(terminal,el('text',{x:label.x,y:label.y,'text-anchor':label.anchor,'dominant-baseline':shape.manual?'central':'auto',class:'port-label'+(shape.manual?' manual-pin-label':''),...(label.rotation?{transform:'rotate('+label.rotation+' '+label.x+' '+label.y+')'}:{})},label.text));});$('node-layer').append(g);nodeValueElements.push({element:g.querySelector('.node-value'),nodeId:n.id,port:displayPrimary(n),kind:C.valueTypes(n)[displayPrimary(n)]});}
  }
  for(const binding of nodeValueElements){const raw=values[binding.nodeId]?.[binding.port],text=inactiveReason(binding.nodeId)||(binding.kind==='packed16'?W.describe('packed16',raw).text:number(raw));const quality=raw===undefined||binding.kind==='packed16'?'GOOD':C.signalQuality.read(frame,binding.nodeId,binding.port);
   const display=quality==='GOOD'?text:text+' · '+quality;
   if(binding.element.textContent!==display)binding.element.textContent=display;
  }
  const order=run&&project.execution?.mode==='explicit'?project.execution.order:[],positions=new Map(order.map((id,i)=>[id,i])),previous=trace[(cursor??trace.length-1)-1];
  for(const binding of wireValueElements){const reason=inactiveReason(binding.nodeId),d=reason?{...W.describe(binding.kind,undefined),text:reason,full:reason,state:'inactive'}:W.describe(binding.kind,values[binding.nodeId]?.[binding.port]),className='wire '+binding.kind+' '+d.state+(binding.selected?' selected':'')+(forcePin(binding.nodeId,binding.port)?' forced':'');if(binding.element.getAttribute('class')!==className)binding.element.setAttribute('class',className);paintWireLabel(binding,d);const backward=positions.has(binding.nodeId)&&positions.has(binding.toId)&&positions.get(binding.nodeId)>positions.get(binding.toId),actualPacked=frame?.packedReads?.[binding.toId]?.[binding.toPort],input=W.describe(binding.kind,actualPacked!==undefined?actualPacked:backward?previous?.values[binding.nodeId]?.[binding.port]:values[binding.nodeId]?.[binding.port]);const title=binding.sourceName+'.'+binding.port+' 源端输出：'+d.full+(forcePin(binding.nodeId,binding.port)?'（强制）\n原计算值：'+W.describe(binding.kind,frame?.computedValues?.[binding.nodeId]?.[binding.port]).full:'')+(frame?.tick>0?'\n目标本拍读入：'+input.full+(actualPacked!==undefined?'（共享字实际读取）':backward?'（顺序回读上一拍）':''):'\n尚未执行扫描')+(binding.kind==='analog'?'\n数值框显示6位有效数字；此处为完整记录值':'');if(binding.title.textContent!==title)binding.title.textContent=title;if(binding.netTitle)binding.netTitle.textContent=binding.sourceName+'.'+binding.port+' 源端输出：'+d.full+(forcePin(binding.nodeId,binding.port)?'（强制）':'')+'；共 '+binding.netCount+' 个输入，选择分线可查看目标连接。';for(const dot of binding.junctions||[])dot.setAttribute('class','wire-junction '+binding.kind+' '+d.state+(forcePin(binding.nodeId,binding.port)?' forced':''));}
  probes();for(const binding of probeValueElements){const reason=inactiveReason(binding.nodeId),d=reason?{...W.describe(binding.kind,undefined),text:reason,full:reason,state:'inactive'}:W.describe(binding.kind,frame?.[binding.section]?.[binding.nodeId]?.[binding.port]),className='probe-wire '+binding.kind+' '+d.state+(binding.selected?' selected':'')+(binding.section==='values'&&forcePin(binding.nodeId,binding.port)?' forced':'');if(binding.element.getAttribute('class')!==className)binding.element.setAttribute('class',className);paintWireLabel(binding,d);const title=binding.sourceLabel+' → '+binding.scopeName+'（观察探针）\n源端值：'+d.full+(binding.kind==='analog'?'\n数值框显示6位有效数字':'');if(binding.title.textContent!==title)binding.title.textContent=title;}$('canvas').classList.toggle('hide-wire-values',!showWireValues);drawGesture();$('canvas').classList.toggle('connecting',!!pending);$('title').textContent=project.title||'未命名逻辑';$('canvas-hint').textContent=repairDraft?'核对模式 · 点选输出/输入，填写依据后采用':pending?'已选 '+pending.id+'.'+pending.port+' · 点击输入接线，或示波器接入探针':'拖动输出端到输入 / 示波器入口；也可依次点击';if(['disable','restore'].includes(canvasTool))$('canvas-hint').textContent=(canvasTool==='disable'?'禁用':'恢复')+'工具 · 点击模块 · 保留连线 · Esc退出';if(canvasTool==='delete')$('canvas-hint').textContent='删除工具 · 点击删除 · 空白拖框批量删除 · Esc退出';if(canvasTool==='trace-output')$('canvas-hint').textContent=recoveryLabel()+' · 仅点击OUTPUT观察点 / IN1端子 · 累加恢复上游 · Esc退出';if(canvasTool==='wire')$('canvas-hint').textContent='连线工具 · 点击端口/主线起笔 · 空白放置折点 · Esc取消';if(['pen','eraser','rect','ellipse','text'].includes(canvasTool))$('canvas-hint').textContent='临时绘画 · 不写入工程 · 刷新后丢弃 · Esc退出';workspaceUI?.refresh();
 }
 function field(parent,label,id,value,type='number'){const row=html('div',{class:'field'});row.append(html('label',{for:id},label));let input;if(Array.isArray(type)){input=html('select',{id});for(const [val,text]of type)input.append(html('option',{value:val},text));input.value=value??'';}else{input=html(type==='textarea'?'textarea':'input',{id,...(type==='textarea'?{}:{type,step:'any'})});input.value=value??'';}row.append(input);parent.append(row);return input;}
 function clearSourceInspection(){$('source-object-panel').classList.add('hidden');$('source-object-panel').open=false;$('source-object-links').replaceChildren();$('source-object-details').textContent='';}
 function inspectSource(info,file){
  const panel=$('source-object-panel'),links=$('source-object-links');panel.classList.remove('hidden');panel.open=true;$('source-object-details').textContent=JSON.stringify({sourceFile:file,...info},null,2);links.replaceChildren();
  const focus=html('button',{id:'source-object-focus'},'放大源对象');focus.onclick=()=>{if(!sourceViewer?.focusElement(info.owner?.index??info.element.index))status('所选源对象没有可定位图元，请查看原属性。',true);};links.append(focus);
  if(info.owner&&!info.owner.uniqueId){links.append(html('p',{class:'source-note'},'源对象ID重复或缺失，无法唯一定位编辑块。'));return;}
  const matches=P.matchingNodes(project,file,info);if(!matches.length){links.append(html('p',{class:'source-note'},'没有可唯一归属文件的编辑块对应，请依据原属性人工核对。'));return;}
  for(const match of matches){const button=html('button',{'data-source-locate':match.id},'定位 '+match.name+' · '+match.type+(match.scope?' · '+match.scope:''));button.title='已有布局关联依据：'+match.evidence;button.onclick=()=>{selectOnly(match.id);canvas();properties();fit([match.id]);status('已定位对应的编辑块。');};links.append(button);}
 }
 function closeSource(){const visible=!$('source-panel').classList.contains('hidden');sourceViewer?.destroy();sourceViewer=null;sourceTarget=null;repairDraft=null;clearSourceInspection();$('source-panel').classList.add('hidden');if(visible)fit();}
 function focusSource(){if(!sourceViewer||!sourceTarget)return;const result=sourceViewer.focusConnection(sourceTarget.sourceConnectionInstanceKey||sourceTarget.connectionInstanceKey,sourceTarget.connectionId);$('source-description').textContent=result.message;}
 function openSource(candidate=null,manualIssueId=null,note='',readOnly=false){
  if(candidate)stop();pending=null;clearSourceInspection();sourceViewer?.destroy();sourceViewer=null;sourceTarget=candidate;repairDraft=candidate&&!readOnly?{candidateId:candidate.id,candidate,manualIssueId,from:candidate.from,fromPort:candidate.fromPort,to:candidate.to,toPort:candidate.toPort,note}:null;
  const file=candidate?.sourceFile||project.importMetadata?.file||project.importAudit?.target,sources=(project.sources||[]).filter(s=>s.name===file);$('source-panel').classList.remove('hidden');$('source-title').textContent=file||'原SVG';$('source-description').textContent='';$('source-warnings').textContent='';
  try{if(sources.length!==1)throw Error(sources.length?'存在多份同名来源，不能唯一选择原图。':'当前项目未提供该原SVG，仍可依据外部资料人工核对。');const result=P.sanitize(sources[0].text,DOMParser);sourceViewer=P.mount($('source-viewport'),result,{inspect:info=>inspectSource(info,file)});$('source-warnings').textContent=result.warnings.join('；');if(candidate)focusSource();}catch(e){$('source-viewport').replaceChildren(html('p',{class:'source-note'},e.message));$('source-description').textContent=e.message;}
  render();fit(candidate?[candidate.from,candidate.to].filter(Boolean):null);status(readOnly?'自动解析问题：'+candidate.automaticMapping.reason:candidate?'在编辑画布中点选输出端和输入端，填写依据后点击“采用连接”。':'已打开原SVG预览，可缩放、平移。');
 }
 function startManualRepair(issueId){try{const result=R.addManualCandidate(project,issueId);openSource(result.project.connectionCandidates.find(c=>c.id===result.candidateId),issueId);}catch(e){status(e.message,true);}}
 function repairProperties(host){
  const d=repairDraft;if(!d)return false;const candidate=d.manualIssueId?d.candidate:project.connectionCandidates?.find(c=>c.id===d.candidateId);if(!candidate||candidate.status!=='pending'){closeSource();return false;}
  host.append(html('div',{class:'prop-title'},'人工核对连接'),html('div',{class:'source-note'},candidate.sourceFile+' · '+(candidate.connectionId||candidate.connectionInstanceKey)),html('p',{class:'repair-instruction'},'点选画布输出端口与输入端口，或在此指定。选取只是草稿；填写依据后才采用。'));
  const locate=html('button',{},'定位所选端点');locate.onclick=()=>fit([d.from,d.to].filter(Boolean));host.append(locate);
  const names=[['','请选择块'],...project.nodes.map(n=>[n.id,n.name+' · '+n.type])],from=field(host,'源块','repair-from',d.from,names),fromPort=field(host,'输出端口','repair-from-port',d.fromPort,[['','请选择']]),to=field(host,'目标块','repair-to',d.to,names),toPort=field(host,'输入端口','repair-to-port',d.toPort,[['','请选择']]);
  const update=(select,nodeId,direction,value)=>{select.replaceChildren(html('option',{value:''},'请选择端口'));const n=project.nodes.find(n=>n.id===nodeId);if(n)for(const key of Object.keys(C.ports(n)[direction]))select.append(html('option',{value:key},key));select.value=value||'';};update(fromPort,d.from,'outputs',d.fromPort);update(toPort,d.to,'inputs',d.toPort);
  from.onchange=()=>{d.from=from.value;d.fromPort=null;update(fromPort,d.from,'outputs',null);canvas();};to.onchange=()=>{d.to=to.value;d.toPort=null;update(toPort,d.to,'inputs',null);canvas();};fromPort.onchange=()=>{d.fromPort=fromPort.value;canvas();};toPort.onchange=()=>{d.toPort=toPort.value;canvas();};
  const note=field(host,'人工核对依据','repair-note',d.note,'textarea');note.oninput=()=>{d.note=note.value;};const actions=html('div',{class:'property-actions'}),accept=html('button',{id:'repair-accept',class:'primary'},'采用连接'),reject=html('button',{id:'repair-reject'},'拒绝连接');actions.append(accept,reject);host.append(actions);const cancel=html('button',{id:'repair-cancel'},'取消核对');host.append(cancel);
  const decide=decision=>{try{if(timer)throw Error('请先暂停');let base=project,id=d.candidateId;if(d.manualIssueId){const created=R.addManualCandidate(project,d.manualIssueId);base=created.project;id=created.candidateId;}const next=R.resolveCandidate(base,id,decision,{from:d.from,fromPort:d.fromPort,to:d.to,toPort:d.toPort},d.note);mutate(()=>project=next);status(decision==='accept'?'连接已按人工依据采用，来源和决定已保存。':'该源连接已按人工依据拒绝，其他问题仍保留。');}catch(e){status(e.message,true);}};
  accept.onclick=()=>decide('accept');reject.onclick=()=>decide('reject');cancel.onclick=()=>{closeSource();render();status('已取消核对，原组态与运行记录保持。');};return true;
 }
 function kindValue(text,kind){if(kind==='packed16'){const value=Number(text);if(!text.trim()||!Number.isInteger(value)||value<0||value>65535)throw Error('LP字须为0～65535的整数，可输入0x十六进制');return value;}if(kind==='boolean'){if(text==='true')return true;if(text==='false')return false;throw Error('数字值只能填写 true 或 false');}if(text.trim()===''||!Number.isFinite(Number(text)))throw Error('需要填写有限数值');return Number(text);}
 function waveProblem(n){if(inputBinding(n.id))return null;if(n.params.wave==null)return null;try{C.checkWave(n.params.wave,n.params.kind);return null;}catch(e){return e.message;}}
 function replaceWave(n,reason){if(n.params.wave!=null){const history=n.provenance?.waveReplacements;if(history!==undefined&&!Array.isArray(history))throw Error('输入规律重设记录结构无效，请先核对项目中的waveReplacements');n.provenance={...n.provenance,waveReplacements:[...(history||[]),{at:new Date().toISOString(),reason,previous:copy(n.params.wave)}]};}n.params.wave=null;}
 function waveForm(n,parent){
  const binding=inputBinding(n.id);
  if(binding){
   const info=html('div',{id:'input-shared-source',class:'shared-input-source'},'读取跨画布信号：'+binding.source.canvasName+' / '+binding.name+'。信号值和质量由来源提供，本地设置保留。'),jump=html('button',{},'定位 OUTPUT 来源');
   jump.onclick=()=>selectCanvas(binding.source.canvasId,binding.source.nodeId);info.append(jump);parent.append(info);return;
  }
  const problem=waveProblem(n);
  if(problem){
   const reset=html('button',{},'重新配置输入规律');
   reset.onclick=()=>{try{mutate(()=>replaceWave(n,'用户明确重新配置输入规律，原配置保留'));}catch(e){status(e.message,true);}};
   parent.append(html('div',{class:'source-note'},problem+'。原配置如下；重新配置会保留原数据，操作可撤销。'),html('pre',{},JSON.stringify(n.params.wave,null,2)),reset);return;
  }
  const ownerSessions=canvasSessions,ownerCanvas=activeCanvasId,ownerWave=waveProject,base=waveIdentity(n);
  const saved={...waveDraft(n)};
  function update(key,draft,dirty){
   if(ownerSessions!==canvasSessions||ownerCanvas!==activeCanvasId||ownerWave!==waveProject||waveIdentity(n)!==base)return;
   if(dirty)saved[key]=draft;else delete saved[key];
   if(Object.keys(saved).length)waveDrafts.set(n.id,{project:ownerWave,base,draft:{...saved}});else waveDrafts.delete(n.id);
  }
  const quality=n.params.kind==='packed16'?null:{wave:n.qualityWave,draft:saved.quality,onChange:(draft,dirty)=>update('quality',draft,dirty)};
  activeWaveEditor=WaveEditor.mount(parent,{kind:n.params.kind,wave:n.params.wave,dtUs:project.dtUs,draft:saved.value,quality,onChange:(draft,dirty)=>update('value',draft,dirty)});
  activeQualityEditor=activeWaveEditor.qualityEditor;
 }
 function readWave(kind){if(!['boolean','analog','packed16'].includes(kind)||!activeWaveEditor)throw Error('请先明确信号类型及输入规律');return activeWaveEditor.read();}
 function gateInputForm(n,host){
  let pins;try{pins=C.gateInputPins(n.params.inputs);}catch(e){host.append(html('div',{class:'source-note'},e.message+'。原配置保留如下，请明确修正。'));field(host,'输入引脚配置（JSON）','param-inputs-raw',JSON.stringify(n.params.inputs)??'','textarea');return;}
  host.append(html('div',{class:'prop-section'},'参与运算的数字输入引脚'));const group=html('div',{class:'gate-inputs',id:'gate-inputs'});
  for(let i=1;i<=8;i++){const pin='IN'+i,label=html('label',{class:'gate-input-option'}),input=html('input',{type:'checkbox','data-gate-pin':pin,'aria-label':pin});input.checked=pins.includes(pin);input.disabled=i<=2;label.append(input,document.createTextNode(pin+(i<=2?'（必选）':'')));group.append(label);}host.append(group,html('div',{class:'source-note'},'未选可选引脚不参与运算；选中的每个引脚须接线。IN1/IN2为当前支持范围的必选引脚。取消选用会保留原连线供人工处理。'));
 }
 function readGateInputs(){const raw=$('param-inputs-raw');return C.gateInputConfig(raw?JSON.parse(raw.value):Array.from($('gate-inputs').querySelectorAll('input:checked'),input=>input.dataset.gatePin));}
 function helperKinds(n){const kinds=[];for(const e of project.edges){const peer=project.nodes.find(p=>p.id===(e.from===n.id?e.to:e.to===n.id?e.from:null));if(!peer)continue;const kind=e.from===n.id?C.ports(peer).inputs[e.toPort]:C.ports(peer).outputs[e.fromPort];if(['boolean','analog','packed16'].includes(kind))kinds.push(kind);}return[...new Set(kinds)];}
 function inputPins(n,host){const inputs=Object.entries(C.ports(n).inputs);if(!inputs.length)return;host.append(html('div',{class:'prop-section'},'输入引脚 · 类型由块定义'));
  for(const[port,kind]of inputs){const row=html('div',{class:'input-pin','data-input-pin':port}),label=kind==='boolean'?'数字量':kind==='analog'?'模拟量':kind==='packed16'?'LP.A2打包字（0～65535）':'类型待明确';row.append(html('div',{},port+' · '+label+(!n.macroReference&&(C.catalog[n.type]?.optionalInputs?.includes(port)||C.declaredInterfaces.get(n.type)?.optionalInputs.includes(port))?'（可选）':'')));const drivers=project.edges.filter(e=>e.to===n.id&&e.toPort===port),fixed=C.catalog[n.type]?.selectableInputs?.[port];if(fixed)row.append(html('div',{class:'source-note'},drivers.length?'由模拟量连线驱动；固定参数不参与当前运算':'使用固定参数 '+fixed+' = '+(Object.hasOwn(n.params,fixed)?precise(n.params[fixed]):'待补')));
   if(!drivers.length&&['boolean','analog','packed16'].includes(kind)){const add=html('button',{},fixed?'改用测试信号':'添加测试信号');add.onclick=()=>{mutate(()=>{const source=C.newNode('INPUT',id(),n.x-230,n.y+inputs.findIndex(([name])=>name===port)*140);source.name=n.name+'.'+port;source.params={kind,wave:{mode:'constant',value:fixed&&Object.hasOwn(n.params,fixed)?copy(n.params[fixed]):kind==='boolean'?false:0}};source.initial={OUT:kind==='boolean'?false:0};project.nodes.push(source);project.edges.push({from:source.id,fromPort:'OUT',to:n.id,toPort:port});selectOnly(source.id);});fit();};row.append(add);}
   for(const edge of drivers){const source=project.nodes.find(x=>x.id===edge.from);const view=html('button',{},source?source.name+'.'+edge.fromPort:'源块缺失');view.onclick=()=>{selectOnly(edge.from);canvas();properties();};row.append(view);}host.append(row);
  }
 }
 function packedProperties(n,host){
  host.append(html('div',{class:'prop-section'},'LP.A2共享字'),html('div',{class:'source-note'},'名称相同的写者按已确认扫描顺序读改写；未接位保持。名称留空使用独立节点字（UNPACK须接PIN）。源图有明确LP点名时必须绑定。'));
  const name=field(host,'共享字名称（留空独立）','packed-point-name',n.packedPoint||'','text'),existing=(project.packedPoints||[]).find(p=>p.id===n.packedPoint),value=field(host,'共享字软件起点（0～65535 / 0x）','packed-point-initial',existing?.initial??n.initial?.POUT??n.initial?.MNTR??n.initial?.PACK??n.initial?.OUT??0,'text'),apply=html('button',{id:'packed-point-apply'},'应用LP绑定');
  const names=html('div',{class:'source-note'},'已有共享字：'+((project.packedPoints||[]).map(p=>p.id).join('、')||'无'));host.append(names,apply);
  name.oninput=()=>{const record=(project.packedPoints||[]).find(p=>p.id===name.value.trim());if(record)value.value=String(record.initial);};
  apply.onclick=()=>{try{const id=name.value.trim(),initial=kindValue(value.value,'packed16');if(n.type==='UNPACK16'&&id&&project.edges.some(e=>e.to===n.id&&e.toPort==='PIN'))throw Error('请先删除PIN连线，再绑定共享字；不能设置两个输入驱动');mutate(()=>{if(!id){delete n.packedPoint;return;}project.packedPoints=project.packedPoints||[];const record=project.packedPoints.find(p=>p.id===id);if(record)record.initial=initial;else project.packedPoints.push({id,initial});n.packedPoint=id;for(const node of project.nodes.filter(x=>x.packedPoint===id)){const output=node.type==='SATOSP'?'PACK':node.type==='FIRSTOUT'?'MNTR':node.type==='PACK16'?'POUT':['ASSIGN','BCDNOUT'].includes(node.type)?'OUT':null;if(output){node.initial=node.initial||{};node.initial[output]=initial;}}});status('LP绑定与共享初态已保存；请在扫描设置中明确执行顺序。');}catch(e){status(e.message,true);}};
 }
 function customMacroProperties(n,host){
  host.append(html('div',{class:'prop-title'},'自定义宏'));
  moduleNameForm(n,host);
  const upload=html('input',{id:'custom-macro-svg',type:'file',accept:'.svg,.mcr,.tft,.xml',multiple:'',hidden:''});
  const importButton=html('button',{id:'custom-macro-import',type:'button'},n.macroGraph?'替换宏 SVG':'导入宏 SVG');
  importButton.disabled=!!timer;
  importButton.onclick=()=>upload.click();
  upload.onchange=async()=>{
   const files=Array.from(upload.files),owner=project,load=projectLoad,revision=++macroImportRevision;if(!files.length)return;
   try{
    if(files.filter(f=>/\.svg$/i.test(f.name)).length!==1)throw Error('请选择一份宏 SVG，可同时选择同名 MCR/TFT。');
    const graph=I.importMacro(await Promise.all(files.map(async f=>({name:f.name,text:await TextInput.read(f)}))),DOMParser);
    if(projectLoad!==load||revision!==macroImportRevision||project!==owner||!project.nodes.includes(n))return;
    if(timer)throw Error('请先暂停，再更换宏图。');
    const next=C.ports({...n,macroGraph:graph}),previous=C.ports(n);
    const dropped=project.edges.some(e=>e.from===n.id&&next.outputs[e.fromPort]!==previous.outputs[e.fromPort]||e.to===n.id&&next.inputs[e.toPort]!==previous.inputs[e.toPort]);
    const forced=Object.keys(outputForces[n.id]||{}).some(pin=>next.outputs[pin]!==previous.outputs[pin]);
    if(dropped||forced)throw Error('新宏移除或更改了已接线或已强制的端口，请先断开相应连接或取消强制。');
    mutate(()=>{n.macroGraph=graph;if(n.name===C.MACRO_TYPE)n.name=graph.title;n.initial={};});
    status('已导入 '+graph.title+'。打开宏画布可核对内部逻辑和导入问题。');
   }catch(error){if(projectLoad===load&&revision===macroImportRevision&&project===owner)status(error.message,true);}finally{if(revision===macroImportRevision)upload.value='';}
  };
  host.append(importButton,upload);
  if(n.macroGraph){
   const enter=html('button',{id:'custom-macro-open',type:'button'},'打开宏画布');enter.onclick=()=>openMacro(n);
   host.append(enter);inputPins(n,host);host.append(html('pre',{id:'state-view'},signalState(n)));
   for(const [name,kind] of Object.entries(C.ports(n).outputs))host.append(html('div',{class:'source-note'},'输出 '+name+' · '+kind));
  }else host.append(html('p',{class:'source-note'},'导入后，内部命名 INPUT / OUTPUT 会成为宏块引脚。'));
 }
 function macroInputProperties(n,host){
  host.append(html('div',{class:'prop-title'},'宏输入'),html('p',{class:'source-note'},'扫描时读取父画布上的同名输入引脚。'));
  const name=field(host,'引脚名称','macro-pin-name',n.name,'text'),kind=field(host,'信号类型','macro-pin-kind',n.params.kind||'',[['','待明确'],['boolean','数字量（LD）'],['analog','模拟量（LA）'],['packed16','打包字（LP）']]),initial=field(host,'扫描前初值','macro-pin-initial',n.initial?.OUT??'','text'),apply=html('button',{id:'macro-pin-apply',type:'button'},'应用参数');
  for(const control of [name,kind,initial,apply])control.disabled=!!timer;
  apply.onclick=()=>{
   try{
    const label=name.value.trim(),type=kind.value,value=initial.value.trim().toLowerCase(),zero=type==='boolean'?false:0;
    if(!label||!type)throw Error('请填写引脚名称并选择信号类型。');
    if(type==='boolean'&&value&&!['true','false'].includes(value))throw Error('数字量初值须为 true 或 false。');
    const out=value?(type==='boolean'?value==='true':Number(value)):zero;
    C.sample({mode:'constant',value:out},0,type);
    mutate(()=>{n.name=label;n.params={...n.params,kind:type};n.initial={...n.initial,OUT:out};for(const issue of project.issues||[])if(issue.nodeId===n.id&&issue.code==='SIGNAL_TYPE_REQUIRED')issue.resolved=true;});
   }catch(error){status(error.message,true);}
  };
  host.append(apply,html('pre',{id:'state-view'},signalState(n)));
 }
 function macroProperties(n,host){
  if(MS.isDisplay(n)&&n.sourceMacroSymbol){host.append(html('div',{class:'prop-title'},n.type),html('span',{class:'badge'},'自定义宏 · 仅显示与连线'),html('p',{class:'source-note'},'要运行宏内部逻辑，请添加可运行的“自定义宏”，并在属性中导入宏 SVG。'));const name=field(host,'模块名称','macro-display-name',n.name,'text'),saveName=html('button',{},'保存名称');saveName.onclick=()=>{mutateView(()=>n.name=name.value.trim()||n.type);status('自定义宏名称已保存。');};host.append(saveName);for(const pin of n.sourceMacroSymbol.pins){const kind=C.ports(n)[pin.direction==='input'?'inputs':'outputs'][pin.port];host.append(html('p',{class:'source-note','data-macro-pin':pin.id},(pin.direction==='input'?'输入 ':'输出 ')+(pin.nameDecoded?pin.port:'PIN '+pin.id)+' · '+({left:'左',right:'右',top:'上',bottom:'下'}[pin.side])+'侧 · '+({boolean:'数字量',analog:'模拟量',packed16:'LP打包字'}[kind]||'类型未确定')));}if(n.sourceMacroSymbol.unresolvedPins.length)host.append(html('p',{class:'source-note'},'方向未解析的源针脚：'+n.sourceMacroSymbol.unresolvedPins.map(p=>p.id).join('、')));const view=html('button',{},'查看原SVG'),del=html('button',{},'删除宏图形');view.onclick=()=>openSource();del.onclick=removeSelected;del.disabled=!!timer;host.append(view,del);return;}

  const unhandled={};if(Object.keys(n.params||{}).length)unhandled.params=n.params;if(Object.keys(n.initial||{}).length)unhandled.initial=n.initial;if(Object.hasOwn(n,'quality')&&n.quality!=='GOOD')unhandled.quality=n.quality;
  if(Object.keys(unhandled).length)host.append(html('div',{class:'source-note'},'实例含未支持的参数、初态或质量，展开将被拒绝；原字段保留如下。'),html('pre',{id:'macro-unhandled'},JSON.stringify(unhandled,null,2)));
  host.append(html('div',{class:'prop-title'},n.type),html('span',{class:'badge warn'},'宏实例 · 展开前不运行'));
  const name=field(host,'实例名称','macro-name',n.name,'text'),definitions=(project.library||[]).filter(d=>d.graph),select=field(host,'宏定义','macro-definition',n.macroReference.definitionId||'',[['','请选择定义'],...definitions.map(d=>[d.id,d.name+' · '+(d.crc||'无CRC')])]);
  const config=html('div');host.append(config);const note=field(host,'接口 / 参数核对依据','macro-note','','textarea');
  const show=()=>{config.replaceChildren();const d=definitions.find(d=>d.id===select.value);if(!d){config.append(html('div',{class:'source-note'},'请同时导入宏的 SVG/MCR/TFT，或打开包含定义图的项目。'));return;}
   for(const side of ['inputs','outputs'])for(const [index,p]of(d[side]||[]).entries()){const fixed=['boolean','analog','packed16'].includes(p.kind),input=field(config,(side==='inputs'?'输入 ':'输出 ')+p.name,'macro-'+side+'-'+index,fixed?p.kind:n.macroPorts?.[side]?.[p.name]||'unknown',fixed?[[p.kind,({boolean:'数字量',analog:'模拟量',packed16:'LP打包字'}[p.kind]+' · 定义固定')]]:[['unknown','待明确类型'],['boolean','数字量（LD）'],['analog','模拟量（LA）'],['packed16','16位打包字（LP）']]);input.disabled=fixed;}
   for(const[index,p]of(d.parameters||[]).entries()){const input=field(config,'实例参数 '+p.name,'macro-param-'+index,n.macroOverrides?.[p.name]??'');input.placeholder='留空沿用定义：'+(p.value??'待补');}
   for(const missing of d.unmappedParameters||[])config.append(html('div',{class:'source-note'},'尚未映射的公开参数：'+missing));
  };select.onchange=show;show();host.append(html('div',{class:'source-note'},'展开后，可在画布直接编辑内部模块。'));
  const actions=html('div',{class:'property-actions'}),apply=html('button',{},'保存绑定'),expand=html('button',{class:'primary'},'展开宏实例');actions.append(apply,expand);host.append(actions);
  const configured=()=>{const d=definitions.find(d=>d.id===select.value);if(!d)throw Error('请选择宏定义');const p=copy(project),instance=p.nodes.find(x=>x.id===n.id);instance.name=name.value;instance.macroReference={...instance.macroReference,definitionId:d.id};instance.macroPorts={inputs:{},outputs:{}};for(const side of ['inputs','outputs'])for(const[index,port]of(d[side]||[]).entries())instance.macroPorts[side][port.name]=$('macro-'+side+'-'+index).value;instance.macroOverrides={};for(const[index,param]of(d.parameters||[]).entries()){const value=$('macro-param-'+index).value;if(value!==''){if(!Number.isFinite(Number(value)))throw Error('参数必须是有限数值');instance.macroOverrides[param.name]=Number(value);}}return{p,d,instance};};
  apply.onclick=()=>{try{if(!note.value.trim())throw Error('请填写绑定核对依据');const{p,instance}=configured();instance.provenance={...instance.provenance,bindingReview:{note:note.value.trim(),at:new Date().toISOString()}};mutate(()=>project=p);status('宏绑定已保存，尚未展开。');}catch(e){status(e.message,true);}};
  expand.onclick=()=>{try{if(Object.keys(outputForces[n.id]||{}).length)throw Error('请先取消此宏的强制输出，再展开宏。');const{p,d,instance}=configured(),next=M.expand(p,n.id,{definitionId:d.id,overrides:instance.macroOverrides,note:note.value});mutate(()=>{project=next;selectOnly(Object.values(next.macroExpansions.at(-1).nodeMap)[0]||null);pending=null;});fit();status('宏已展开；请继续处理内部图中未解决的信息。');}catch(e){status(e.message,true);}};
  const del=html('button',{},'删除宏实例');del.onclick=removeSelected;host.append(del);if(timer)host.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=true);
 }
 function parameterBindings(n,host){
  const choices=R.parameterChoices(n);if(!choices.length)return;
  host.append(html('div',{class:'prop-section'},'来源字段 · 人工对应参数'),html('div',{class:'source-note'},'选择字段和对应参数，填写采用值与依据。解除对应后保留参数值。'));
  const select=field(host,'来源字段','parameter-source-field',String(choices[0].index),choices.map(c=>[String(c.index),(c.field.namespace==='svg'?'SVG':'MCR')+' · '+c.field.attribute]));
  const form=html('div');host.append(form);
  const show=()=>{form.replaceChildren();const c=choices.find(c=>String(c.index)===select.value);if(!c)return;form.append(html('pre',{id:'parameter-source-detail'},JSON.stringify({file:c.field.file,namespace:c.field.namespace,attribute:c.field.attribute,sourceValue:c.field.value},null,2)));
   const key=field(form,'对应参数','parameter-binding-key',c.binding?.key||'',[['','请选择参数'],...c.keys.map(k=>[k,k])]);key.disabled=!!c.binding;
   const valueHost=html('div');form.append(valueHost);const valueForm=()=>{valueHost.replaceChildren();field(valueHost,'采用值（显式填写）','parameter-binding-value',c.binding?.key===key.value?c.binding.value:'',key.value==='TYPE'?[['','请选择'],['0','0 · 复位优先'],['1','1 · 置位优先']]:'number');};key.onchange=valueForm;valueForm();
   const stale=C.parameterBindingIssues(n,project.edges).find(i=>i.fieldIndex===c.index),note=field(form,'对应依据 / 解除原因','parameter-binding-note','','textarea'),current=html('div',{id:'parameter-binding-current',class:'source-note'},c.binding?(stale?'对应已过期 · ':'已对应 ')+c.binding.key+'，采用值 '+c.binding.value+'；当前参数值 '+n.params[c.binding.key]+'。依据：'+c.binding.note+(stale?'；'+stale.message:''):'尚无人工对应。');form.append(current);
   const actions=html('div',{class:'property-actions'}),accept=html('button',{id:'parameter-binding-accept'},'采用字段对应'),clear=html('button',{id:'parameter-binding-clear'},'解除对应（保留参数值）');clear.disabled=!c.binding;actions.append(accept,clear);form.append(actions);
   if(c.binding&&!c.keys.includes(c.binding.key))accept.disabled=true;
   accept.onclick=()=>{try{const value=kindValue($('parameter-binding-value').value,'analog'),next=R.bindParameter(project,n.id,c.index,key.value,value,note.value);mutate(()=>project=next);status('字段对应与采用值已保存；其他问题及未支持参数仍须处理。');}catch(e){status(e.message,true);}};
   clear.onclick=()=>{try{const next=R.clearParameterBinding(project,n.id,c.index,note.value);mutate(()=>project=next);status('来源对应已解除，参数值保留；本字段重新待核对。');}catch(e){status(e.message,true);}};
  };select.onchange=show;show();
 }
 function executionPanel(force=false){
  if(!force&&executionCache?.revision===logicRevision&&executionCache.project===project&&executionCache.running===!!timer)return;
  executionCache={revision:logicRevision,project,running:!!timer};
  const graph=insideMacro()?C.macroProject(project,topProject()):project,host=$('execution'),plan=C.executionPlan(graph),key=JSON.stringify([project.execution,plan.signature,plan.order]);
  if(key!==executionDraftKey){executionDraftKey=key;executionDraft={mode:plan.mode,order:copy(project.execution?.mode==='explicit'&&Array.isArray(project.execution.order)?project.execution.order:plan.order)};}
  host.replaceChildren();const label=plan.confirmed?'已确认':plan.required?'需要确认 / 已过期':'自动拓扑 · 软件模型';
  host.append(html('div',{id:'execution-summary'},label+' · '+(insideMacro()?'继承父工程':'单任务')+' · '+graph.dtUs/1000+' ms'),html('div',{id:'execution-active-order'},'当前实际顺序：'+plan.order.join(' → ')),html('p',{class:'source-note'},'上游已执行则读取本拍值，否则读取上一拍值。调整顺序后，点击“确认并采用扫描计划”。'));
  if(!insideMacro()&&(project.utcStart!==undefined||project.nodes.some(node=>['TIMECHANGE','TIMEDETECT'].includes(node.type)&&!node.macroReference))){
   const clock=html('div',{class:'execution-controls'});
   const input=field(clock,'仿真UTC起点（ISO 8601）','execution-utc-start',project.utcStart,'text');
   input.placeholder='2026-11-15T00:00:00.000Z';
   const apply=html('button',{id:'execution-utc-apply'},'采用UTC起点');
   apply.onclick=()=>{
    try{
     const utcStart=new Date(C.parseUtcStart(input.value.trim())).toISOString();
     mutate(()=>setEngineeringUtc(utcStart));
     status('UTC起点已采用：'+utcStart);
    }catch(e){status(e.message,true);}
   };
   clock.append(apply);
   host.append(clock);
  }
  if(plan.issues.length)host.append(html('div',{class:'execution-errors'},plan.issues.map(i=>i.message).join('；')));
  const controls=html('div',{class:'execution-controls'}),mode=field(controls,'顺序草稿模式','execution-mode',executionDraft.mode,[['','请选择'],['topological','建议拓扑顺序'],['explicit','人工逐块顺序']]),propose=html('button',{id:'execution-propose'},'重新生成拓扑建议');controls.append(propose);host.append(controls);
  mode.onchange=()=>{executionDraft.mode=mode.value;if(mode.value==='topological')executionDraft.order=C.executionPlan({...project,execution:undefined}).order;executionPanel(true);};
  propose.onclick=()=>{executionDraft={mode:'topological',order:C.executionPlan({...project,execution:undefined}).order};executionPanel(true);};
  const list=html('ol',{id:'execution-order'}),positions=new Map(executionDraft.order.map((id,i)=>[id,i]));
  executionDraft.order.forEach((id,i)=>{const n=project.nodes.find(n=>n.id===id),back=project.edges.filter(e=>e.to===id&&positions.get(e.from)>i),row=html('li',{'data-order-id':String(id)}),text=html('span',{},(i+1)+'. '+(n?.name||String(id))+' ['+id+']'+(back.length?' · 读取上拍：'+back.map(e=>e.from+'.'+e.fromPort).join(', '):''));row.append(text);for(const[delta,mark]of[[-1,'↑'],[1,'↓']]){const b=html('button',{[delta<0?'data-order-up':'data-order-down']:'','aria-label':String(id)+(delta<0?' 上移':' 下移')},mark);b.disabled=i+delta<0||i+delta>=executionDraft.order.length;b.onclick=()=>{const order=executionDraft.order;[order[i],order[i+delta]]=[order[i+delta],order[i]];executionDraft.mode='explicit';executionPanel(true);};row.append(b);}list.append(row);});host.append(list);
  const note=field(host,'周期及顺序核对依据','execution-note',executionDraft.note||'','textarea'),accept=html('button',{id:'execution-confirm',class:'primary'},'确认并采用扫描计划');note.oninput=()=>executionDraft.note=note.value;host.append(accept);accept.onclick=()=>{try{const next=C.confirmExecution(graph,{mode:executionDraft.mode,order:executionDraft.order,note:note.value});mutate(()=>project=next);status('已采用扫描周期和执行顺序。');}catch(e){status(e.message,true);}};
  if(project.execution?.confirmation)host.append(html('div',{class:'source-note'},'最近依据：'+project.execution.confirmation.note));if(timer)host.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=true);
 }
 function inputSourceChoices(n){
  const select=$('input-source');select.replaceChildren(html('option',{value:''},'请选择输入源'));
  for(const source of project.nodes.filter(node=>node.type==='INPUT'&&!node.macroReference))select.append(html('option',{value:source.id},T.nodeLabel(project,source)));
  select.value=n?.id||'';select.onchange=()=>{if(!select.value)return;selectOnly(select.value);canvas();properties();showTab('inputs');};
 }
 function moduleNameForm(n,host){
  const input=field(host,'模块名称','prop-name',n.name,'text'),save=html('button',{id:'save-module-name',type:'button','data-display-edit':'true'},'保存名称');input.dataset.displayEdit='true';const row=input.closest('.field');row.classList.add('module-name-field');row.append(save);input.title='名称用于输入设置、输出总览及观察信号选择';
  save.onclick=()=>{const name=input.value.trim();if(!name){status('模块名称不能为空。',true);return;}if(name===n.name){status('模块名称未改变。');return;}if((engineering||insideMacro())&&timer){status('请先暂停运行，再修改信号名称。',true);return;}const commit=engineering||insideMacro()?mutate:mutateView;commit(()=>{n.name=name;signalCache=null;propertyCache=null;problemCache=null;executionCache=null;});status(engineering?'模块名称已保存，同名关联已更新；旧运行记录已清除。':'模块名称已保存；选择列表已更新，当前运行和输入草稿保留。');};
 }
 function ioOrientationForm(n,host){
  const input=n.type==='INPUT',choices=input?[['horizontal','左侧 · 向右输出'],['vertical','上部 · 向下输出']]:[['horizontal','右侧 · 从左接入'],['vertical','底部 · 从上接入']],select=field(host,'图形方向','prop-io-orientation',n.ioOrientation==='vertical'?'vertical':'horizontal',choices);select.dataset.displayEdit='true';
  select.onchange=()=>{const orientation=select.value;if(orientation===(n.ioOrientation||'horizontal'))return;mutateView(()=>{n.ioOrientation=orientation;propertyCache=null;});status('图形方向已更新；引脚与连线位置同步，运行记录和输入草稿保留。');};
 }
 function selectImportedConnection(id){selectOnly(null);selectedCandidate=id;pending=null;canvas();properties();}
 function deleteImportedConnection(){const id=selectedCandidate,candidate=project.connectionCandidates?.find(c=>c.id===id&&c.status==='pending');if(!candidate)return;const next=R.resolveCandidate(project,id,'reject',{},'用户从画布删除未解析导入连线；原SVG与源连接记录保留');mutate(()=>{project=next;selectOnly(null);});status('已删除导入线段，可撤销；原SVG和删除记录已保留。');}
 function candidateProperties(host){if(!selectedCandidate)return false;const c=project.connectionCandidates?.find(c=>c.id===selectedCandidate&&c.status==='pending');if(!c){selectedCandidate=null;return false;}const from=project.nodes.find(n=>n.id===c.from),to=project.nodes.find(n=>n.id===c.to);host.append(html('div',{class:'prop-title'},'导入未解析连线'),html('p',{},(from?.name||c.from)+'.'+(c.fromPort||c.sourcePinId)+' → '+(to?.name||c.to)+'.'+(c.toPort||c.destinationPinId)),html('p',{class:'source-note'},c.automaticMapping?.reason||'端口名称尚未完成核对，此线未参与仿真。'));const view=html('button',{},'查看原SVG'),del=html('button',{id:'delete-imported-connection'},'删除此导入线段');view.onclick=()=>openSource(c,null,'',c.automaticMapping?.status==='blocked');del.onclick=deleteImportedConnection;del.disabled=!!timer;host.append(view,del);return true;}
 function netProperties(host){
  if(!selectedNet)return false;const entry=wireNets.get(selectedNet);if(!entry){selectedNet=null;selectedCandidate=null;return false;}const from=project.nodes.find(n=>n.id===entry.from);host.append(html('div',{class:'prop-title'},'信号主线'),html('p',{},(from?.name||entry.from)+'.'+entry.port),html('p',{class:'source-note'},'连接 '+entry.entries.length+' 个输入。选择下方分线可单独删除；主线按剩余连接重绘。'));
  for(const{edge,index}of entry.entries){const to=project.nodes.find(n=>n.id===edge.to),button=html('button',{'data-net-edge-index':index,class:'net-branch-choice'},(to?.name||edge.to)+'.'+edge.toPort);button.onclick=()=>{selectOnly(null);selectedEdge=index;canvas();properties();};host.append(button);}return true;
 }
 function recorderOutputCompatible(node,kind){
  return project.edges.filter(e=>e.from===node.id).every(e=>{
   const target=project.nodes.find(n=>n.id===e.to);
   const actual=target&&C.ports(target).inputs[e.toPort];
   return actual===kind||actual==='unknown'&&target.macroReference?.displayOnly;
  });
 }
 const recorderKindNames={boolean:'数字量（LD）',analog:'模拟量（LA）',packed16:'16 位打包字（LP）'};
 function updateRecorderStatus(node){
  const summary=$('wave-recorder-status'),save=$('wave-recorder-save');
  if(!summary||!save)return;
  const tick=current()?.tick??0;
  const takingSamples=node.params.mode==='capture'&&!inactiveReason(node.id)&&tick>0&&current()?.values?.[node.id]?.OUT!==undefined;
  save.disabled=!takingSamples;
  summary.textContent=node.params.mode==='replay'?'回放 · '+(recorderKindNames[node.params.kind]||'类型待明确'):
   takingSamples?'采集 · '+tick+' 拍 · 截止 '+number(current().time)+' s'+(cursor===null?'':'（回看）'):
   '采集 · 接入信号并至少完成一拍后可保存';
 }
 function recorderProperties(node,host){
  const params=node.params,presets=Array.isArray(params.presets)?params.presets.filter(p=>p&&Number.isSafeInteger(p.id)&&Array.isArray(p.samples)):[];
  const inbound=project.edges.find(e=>e.to===node.id&&e.toPort==='IN1');
  host.append(html('div',{class:'prop-title'},'录波回放'),html('p',{class:'source-note'},'IN1 接入信号后逐拍采集，OUT 同步直通。保存后可断开输入，用 OUT 回放。预设随工程保存。'));
  moduleNameForm(node,host);
  host.append(html('p',{id:'wave-recorder-status',class:'source-note','aria-live':'off'}));
  const save=html('button',{id:'wave-recorder-save',type:'button'},'保存为新预设');
  host.append(save);
  save.onclick=()=>{
   try{
    const preset=C.captureWave(node,trace,current()?.tick??0,topProject().dtUs);
    mutateView(()=>{params.presets.push(preset);params.presetId=preset.id;propertyCache=null;});
    status('已保存预设 '+preset.id+'，共 '+preset.samples.length+' 拍。保存工程后可重新使用。');
   }catch(error){status(error.message,true);}
  };
  const choices=presets.map(p=>[String(p.id),'预设 '+p.id+' · '+(recorderKindNames[p.kind]||'未知类型')+' · '+p.samples.length+' 拍']);
  const select=field(host,'录波预设','wave-recorder-preset',String(params.presetId??presets[0]?.id??''),choices.length?choices:[['','暂无预设']]);
  select.disabled=!choices.length||!!timer;
  const details=html('p',{class:'source-note',id:'wave-recorder-details'}),actions=html('div',{class:'property-actions'});
  const play=html('button',{id:'wave-recorder-replay',class:'primary',type:'button'},inbound?'断开输入并回放':'回放所选预设');
  const capture=html('button',{id:'wave-recorder-capture',type:'button'},'切回采集');
  const remove=html('button',{id:'wave-recorder-remove',type:'button'},'删除所选预设');
  const selectedPreset=()=>presets.find(p=>String(p.id)===select.value);
  function updateChoice(){
   const preset=selectedPreset(),active=params.mode==='replay'&&preset?.id===params.presetId;
   play.disabled=!!timer||!preset||active;capture.disabled=!!timer||params.mode!=='replay';
   remove.disabled=!!timer||!preset||active;
   const duration=preset?preset.dtUs*preset.samples.length/1e6:0;
   details.textContent=preset?'采样间隔 '+number(preset.dtUs/1000)+' ms · 最后一拍 '+number(duration)+' s'+(active?' · 正在使用':''):'运行或单步后，点击“保存为新预设”。';
  }
  select.onchange=updateChoice;updateChoice();
  play.onclick=()=>{
   const preset=selectedPreset();if(!preset||timer)return;
   if(!recorderOutputCompatible(node,preset.kind)){status('预设类型与已有输出连线不符。请先断开不兼容的输出连线。',true);return;}
   mutate(()=>{
    project.edges=project.edges.filter(e=>!(e.to===node.id&&e.toPort==='IN1'));
    Object.assign(params,{mode:'replay',kind:preset.kind,presetId:preset.id});
    node.initial={};
   });
   status('已启用预设 '+preset.id+'。下一次运行从仿真零点回放。');
  };
  capture.onclick=()=>{
   if(timer)return;
   mutate(()=>{params.mode='capture';node.initial={};});
   status('已切回采集。请把信号连到 IN1。');
  };
  remove.onclick=()=>{
   const preset=selectedPreset();if(!preset||remove.disabled)return;
   mutateView(()=>{
    params.presets=params.presets.filter(p=>p.id!==preset.id);
    if(params.presetId===preset.id)params.presetId=params.presets[0]?.id??null;
    propertyCache=null;
   });
   status('已删除预设 '+preset.id+'，可用撤销恢复。');
  };
  actions.append(play,capture,remove);host.append(details,actions);
  host.append(html('p',{class:'source-note'},'回放按原采样周期切换，首拍前使用首值，结束后保持末值。'));
  const deleteBlock=html('button',{type:'button'},'删除模块');deleteBlock.disabled=!!timer;deleteBlock.onclick=removeSelected;host.append(deleteBlock);
  updateRecorderStatus(node);
 }
 function properties(){
  const selection=nodeSelection(),n=project.nodes.find(n=>n.id===selected),editingInput=!insideMacro()&&n?.type==='INPUT'&&!n.macroReference&&!repairDraft&&!selectedProbe&&selectedEdge===null&&selection.size===1,host=editingInput?$('input-settings'):$('properties'),key=JSON.stringify([selected,[...selection].sort(),selectedEdge,selectedNet,selectedCandidate,selectedProbe,!!timer,!!repairDraft]);
  forcePanel.render({node:!insideMacro()&&selection.size===1&&!repairDraft&&!selectedProbe&&selectedEdge===null&&!selectedNet&&!selectedCandidate?n:null,config:outputForces[n?.id]||{},running:!!timer,inactive:n?inactiveReason(n.id):'',frame:current(),revision:logicRevision});
  if(!repairDraft&&propertyCache?.revision===logicRevision&&propertyCache.project===project&&propertyCache.key===key){const pre=$('state-view');if(pre&&n)pre.textContent=signalState(n);if(n?.type===LogicWaveRecorder.type)updateRecorderStatus(n);return;}
  const previousInput=propertyCache?.inputNodeId;propertyCache={revision:logicRevision,project,key,inputNodeId:editingInput?n.id:null};activeWaveEditor=activeQualityEditor=null;$('properties').replaceChildren();$('input-settings').replaceChildren();inputSourceChoices(editingInput?n:null);
  if(editingInput){$('properties').append(html('div',{class:'prop-title'},'INPUT · 输入源'));if(previousInput!==n.id&&!drag)showTab('inputs');}else $('input-settings').append(html('p',{class:'empty'},'在上方选择一个INPUT输入源，或从左侧添加INPUT模块。'));
  if(repairProperties(host))return;if(netProperties(host))return;if(candidateProperties(host))return;
  if(selection.size>1){host.append(html('div',{class:'prop-title',id:'selection-summary'},'已选 '+selection.size+' 个控制块'),html('p',{class:'source-note'},'左键按住空白拖出方框，Shift 框选/点选可追加或增减。拖动任一所选块可成组移动，保留运行历史。删除所选块及相关连线会清除旧运行，可一次撤销。'));for(const node of project.nodes.filter(n=>selection.has(n.id))){const b=html('button',{class:'selection-member'},'仅选 '+node.name+' · '+node.type);b.onclick=()=>{selectOnly(node.id);canvas();properties();};host.append(b);}const del=html('button',{},'删除所选块');del.disabled=!!timer;del.onclick=removeSelected;host.append(del);return;}
  if(selectedProbe){const scope=project.scopes?.find(s=>s.id===selectedProbe.scopeId),channel=signalCatalog().displayAll.find(c=>c.key===selectedProbe.key);if(scope&&scope.channels.includes(selectedProbe.key)){host.append(html('div',{class:'prop-title'},'观察探针'),html('p',{},(channel?.label||'缺失信号')+' → '+scope.name),html('div',{class:'source-note'},'仅将信号送到示波器显示，不参与控制逻辑。'));const remove=html('button',{},'移除此探针');remove.onclick=removeProbe;host.append(remove);return;}selectedProbe=null;}
  if(!n){host.append(html('div',{class:'empty'},selectedEdge!==null?'已选中连线。点击删除，或按 Delete。':'选择控制块，查看参数、信号与内部状态。'));if(selectedEdge!==null){const edge=project.edges[selectedEdge];if(edge){const from=project.nodes.find(n=>n.id===edge.from),to=project.nodes.find(n=>n.id===edge.to);host.append(html('p',{'data-selected-branch':selectedEdge},(from?.name||edge.from)+'.'+edge.fromPort+' → '+(to?.name||edge.to)+'.'+edge.toPort));}const b=html('button',{},'删除连线');b.onclick=()=>mutate(()=>{project.edges.splice(selectedEdge,1);selectedEdge=null;});host.append(b);}return;}
  executionSetting(n);if(n.macroReference){macroProperties(n,host);return;}
  if(n.type===C.MACRO_TYPE){customMacroProperties(n,host);return;}
  if(insideMacro()&&n.type==='INPUT'){macroInputProperties(n,host);return;}
  if(n.type===LogicWaveRecorder.type){recorderProperties(n,host);return;}
  const d=C.catalog[n.type],parameterLabels={SMTH:'SMTH（平滑时间常数，秒；0直通）',DBND:'DBND（差值死区）',RTRN:'RTRN（返回量）',NMIN:'NMIN（输入路数）',MTRU:'MTRU（TRUE数量门槛）',DRCT:'DRCT（0递减 / 1递增）',RCNT:'RCNT（复位计数）',TRST:'TRST（非零时预置输出）',TRAT:'TRAT（跟踪速率；当前无跟踪）',HISP:'HISP（未接线时固定高限）',HIDB:'HIDB（复位死区）',LOSP:'LOSP（未接线时固定低限）',LODB:'LODB（复位死区）'};host.append(html('div',{class:'prop-title'},n.type));
  if(!d||d.unverified)host.append(html('span',{class:'badge warn'},C.declaredInterfaces.get(n.type)?'已识别引脚 · 无法运行':'当前无法运行'));
  if(d?.numericScope)host.append(html('p',{class:'source-note'},d.numericScope));
  const basicHost=editingInput?$('properties'):host;
  if(['INPUT','OUTPUT'].includes(n.type))ioOrientationForm(n,basicHost);
  if(['INPUT','OUTPUT'].includes(n.type))moduleNameForm(n,basicHost);else field(host,'显示名称','prop-name',n.name,'text');const choices=[['','选择控制块'],...Object.keys(C.catalog).map(k=>[k,k])];if(!d)choices.push([n.type,n.type+'（未支持）']);const type=field(basicHost,'控制块类型 / 人工映射','prop-type',n.type,choices);
  type.onchange=()=>{if(type.value&&type.value!==n.type){const chosen=type.value;let next=copy(project);for(const c of R.parameterChoices(n))if(c.binding)next=R.clearParameterBinding(next,n.id,c.index,'控制块类型由 '+n.type+' 改为 '+chosen+'，解除原参数来源对应并重新核对字段');const mapped=next.nodes.find(node=>node.id===n.id);const sourceBacked=key=>Object.hasOwn(n.provenance?.parameterSources||{},key)||Object.hasOwn(n.provenance?.attributes||{},'cb-alg-'+key.toLowerCase())||Object.hasOwn(n.provenance?.attributes||{},'cb-macro-'+key.toLowerCase())||n.params[key]?.sourceStatus==='unresolved';mapped.type=chosen;if(chosen!=='INPUT')delete mapped.qualityWave;mapped.params={...copy(C.catalog[chosen].defaults),...Object.fromEntries(Object.entries(n.params).filter(([key])=>!Object.hasOwn(d?.defaults||{},key)||sourceBacked(key)&&!Object.hasOwn(C.catalog[chosen].defaults,key)))};mapped.initial=copy(C.newNode(chosen,'tmp').initial);mapped.provenance={...mapped.provenance,manualMapping:{type:chosen,at:new Date().toISOString()}};waveDrafts.delete(n.id);mutate(()=>project=next);}};
  if(d){
   for(const [key,value]of Object.entries(d.defaults)){if(key==='wave')continue;if(key==='inputs'){gateInputForm(n,host);continue;}let inputType=d.paramChoices?.[key]?[ ['','请选择'],...d.paramChoices[key].map(v=>[v,v])]:'number';if(d.paramChoices?.[key]&&n.params[key]!==undefined&&!d.paramChoices[key].includes(n.params[key]))inputType.push([String(n.params[key]),'未支持原值：'+JSON.stringify(n.params[key])]);const required=key==='kind'?helperKinds(n):[];if(key==='kind')inputType=required.length===1?[['','待补：按已连接引脚类型'],[required[0],({boolean:'数字量',analog:'模拟量',packed16:'LP打包字'}[required[0]]+' · 已连接引脚限定')]]:[['','待补信号类型'],['boolean','数字量（LD）'],['analog','模拟量（LA）'],['packed16','16位打包字（LP）']];if(n.type==='FLIPFLOP'&&key==='TYPE')inputType=[['','待补类型'],['0','0 · 复位优先'],['1','1 · 置位优先']];const proq=n.type==='GAINBIAS'&&key==='PROQ';if(proq)inputType=[['','未指定（旧工程）'],['on','ON（1）传递输入质量'],['off','OFF（0）输出GOOD'],...(n.params[key]!==undefined&&![0,1].includes(n.params[key])?[['unsupported','未支持原值：'+JSON.stringify(n.params[key])]]:[])];const input=field(key==='kind'?basicHost:host,key==='kind'?'信号类型':n.type==='RATEMON'&&['PRAT','PDB','NRAT','NDB'].includes(key)?key+'（单位/秒）':n.type==='RATELIMIT'&&key==='RALM'?'RALM（单位/秒）':n.type==='RATECHANGE'&&key==='SMTH'?'SMTH（秒；当前仅0）':key==='BASE'?(n.type==='STEAMFLOW'?'BASE（基本比容）':n.type==='ANTILOG'?'BASE（0=e，正整数=10）':n.type==='ONESHOT'?'BASE（秒/计时单位，0=1秒）':'BASE（秒/计时单位）'):key==='TARG'?'TARG（计时单位数）':parameterLabels[key]||key,key==='kind'?'prop-kind':'param-'+key,proq?(n.params[key]===1?'on':n.params[key]===0?'off':n.params[key]===undefined?'':'unsupported'):n.params[key],inputType);if(d.selectableInputs?.[key]&&project.edges.some(e=>e.to===n.id&&e.toPort===key))input.disabled=true;if(key==='kind'){input.disabled=required.length===1&&required[0]===n.params.kind;input.onchange=()=>{const k=input.value;try{mutate(()=>{if(n.type==='INPUT')replaceWave(n,'信号类型由 '+n.params.kind+' 改为 '+k+'，重新定义输入规律');n.params.kind=k;if(k==='packed16')delete n.qualityWave;n.initial={OUT:k==='boolean'?false:0};});}catch(e){status(e.message,true);}};if(required.length>1||required.length===1&&required[0]!==n.params.kind)basicHost.append(html('div',{class:'source-note'},'已连接引脚类型与当前信号冲突，请先核对连接和信号类型。'));}}
   if(n.type==='INPUT'){if(['boolean','analog','packed16'].includes(n.params.kind))waveForm(n,host);else host.append(html('div',{class:'source-note'},'请先明确信号类型，再设置输入规律。'));}
   if(!d.fixedInitialOutputs&&(n.type==='FLIPFLOP'||d.timer||d.monitor||d.edgeState||d.stateful)&&Object.hasOwn(C.ports(n).outputs,'OUT')){const kind=C.ports(n).outputs.OUT;field(host,'OUT 初值','prop-initial',kind==='boolean'?(typeof n.initial?.OUT==='boolean'?String(n.initial.OUT):''):n.initial?.OUT,kind==='boolean'?[['','待补初态'],['false','FALSE'],['true','TRUE']]:'number');}
  }
  if(d&&!d.timer&&!d.fixedInitialOutputs)for(const[port,kind]of Object.entries(C.ports(n).outputs))if(port!=='OUT')field(host,port+'初值','prop-output-initial-'+port,kind==='boolean'?(typeof n.initial?.[port]==='boolean'?String(n.initial[port]):''):n.initial?.[port],kind==='boolean'?[['','待补初态'],['false','FALSE'],['true','TRUE']]:'number');
  for(const [key,kind]of Object.entries(d?.initialStateTypes||{}))field(host,({previousIN1:'上一拍IN1（仿真起点；非控制器重启初态）',mode:'软件起点模式（0禁用/1待命/2跳闸）',previousRST:'起点前RST',previousRTAT:'起点前RTAT',previousMask:'起点前输入位图（IN1为第0位）'}[key]||key),'prop-state-initial-'+key,kind==='boolean'?(typeof n.initial?.[key]==='boolean'?String(n.initial[key]):''):n.initial?.[key],kind==='boolean'?[['','待补'],['false','FALSE'],['true','TRUE']]:kind==='packed16'?'text':'number');
  if(d?.timer)field(host,'ACT初值（计时单位数）','prop-act',n.initial?.ACT);
  if(d?.inputHistory)field(host,'上一拍IN1（沿检测初态）','prop-previous',typeof n.initial?.previousIN1==='boolean'?String(n.initial.previousIN1):'',[['','待补沿检测初态'],['false','FALSE'],['true','TRUE']]);
  const readbackKind=d&&!d.timer&&!d.monitor&&!d.edgeState&&!d.stateful&&!['INPUT','FLIPFLOP'].includes(n.type)?C.valueTypes(n).OUT:null;if(['boolean','analog','packed16'].includes(readbackKind))field(host,'仿真起点OUT（顺序回读时使用）','prop-readback-initial',readbackKind==='boolean'?(typeof n.initial?.OUT==='boolean'?String(n.initial.OUT):''):n.initial?.OUT,readbackKind==='boolean'?[['','未指定初值'],['false','FALSE'],['true','TRUE']]:'number');
  if(n.type==='SATOSP'||n.type==='BCDNOUT'||n.type==='FIRSTOUT'||n.type==='PACK16'||n.type==='UNPACK16'||n.type==='ASSIGN'&&n.params.kind==='packed16')packedProperties(n,host);
  if(n.type==='GAINBIAS')host.append(html('div',{class:'source-note',id:'gainbias-source-options'},'TRAT保存跟踪速率。PROQ为ON时输出继承输入质量，为OFF时有效结果输出GOOD。'));
  if(n.type==='TRANSPORT'){let info;try{const dtUs=topProject().dtUs,c=C.transportPlan(n,dtUs);info='有效样本数 '+c.count+' · 每 '+c.scans+' 拍采样 · 有效延迟 '+number(c.scans*dtUs/1e6*c.count)+' s。复位时重建延迟线。';}catch(e){info=e.message;}host.append(html('div',{class:'source-note',id:'transport-configuration'},info));}
  inputPins(n,host);const actions=html('div',{class:'property-actions'}),apply=html('button',{class:'primary'},'应用参数'),del=html('button',{},'删除');actions.append(apply,del);host.append(actions);
  apply.disabled=n.type==='INPUT'&&!!waveProblem(n);apply.onclick=()=>{try{
   const params=copy(n.params);let qualityWave=n.qualityWave;if(d)for(const key of Object.keys(d.defaults)){if(key==='wave'||d.selectableInputs?.[key]&&project.edges.some(e=>e.to===n.id&&e.toPort===key))continue;if(key==='inputs'){params.inputs=readGateInputs();continue;}delete params[key];const v=$(key==='kind'?'prop-kind':'param-'+key).value;if(v!=='')params[key]=key==='kind'?v:n.type==='GAINBIAS'&&key==='PROQ'?(v==='on'?1:v==='off'?0:copy(n.params[key])):d.paramChoices?.[key]?(!d.paramChoices[key].includes(v)&&String(n.params[key])===v?copy(n.params[key]):v):Number(v);else if(n.params[key]&&typeof n.params[key]==='object')params[key]=copy(n.params[key]);}
   if(n.type==='INPUT'&&!inputBinding(n.id)){const problem=waveProblem(n);if(problem)throw Error(problem+'；请先明确重新配置输入规律');params.wave=readWave(params.kind);C.checkWave(params.wave,params.kind);qualityWave=activeQualityEditor?.read();}
   const initialState=copy(n.initial||{});Object.assign(initialState,d?.fixedInitialOutputs);if(!d?.fixedInitialOutputs&&(n.type==='FLIPFLOP'||d?.timer||d?.monitor||d?.edgeState||d?.stateful)&&Object.hasOwn(C.ports(n).outputs,'OUT'))initialState.OUT=kindValue($('prop-initial').value,C.ports(n).outputs.OUT);
   if(d&&!d.timer&&!d.fixedInitialOutputs)for(const[port,kind]of Object.entries(C.ports(n).outputs))if(port!=='OUT'){const value=$('prop-output-initial-'+port).value;if(value==='')delete initialState[port];else initialState[port]=kindValue(value,kind);}
   for(const [key,kind]of Object.entries(d?.initialStateTypes||{}))initialState[key]=kindValue($('prop-state-initial-'+key).value,kind);
   if(d?.timer)initialState.ACT=kindValue($('prop-act').value,'analog');if(d?.inputHistory)initialState.previousIN1=kindValue($('prop-previous').value,'boolean');
   if(['boolean','analog','packed16'].includes(readbackKind)){const value=$('prop-readback-initial').value;if(value==='')delete initialState.OUT;else initialState.OUT=kindValue(value,readbackKind);}
   let removedInitials=0;if(n.type==='TRNSFINDX'){const outputs=C.ports({...n,params}).outputs;for(const key of Object.keys(initialState))if(/^O\d{2}$/.test(key)&&!Object.hasOwn(outputs,key)){delete initialState[key];removedInitials++;}}
   const name=['INPUT','OUTPUT'].includes(n.type)?$('prop-name').value.trim():$('prop-name').value;if(['INPUT','OUTPUT'].includes(n.type)&&!name)throw Error('模块名称不能为空');let next=copy(project),cleared=0;for(const c of R.parameterChoices(n))if(c.binding&&params[c.binding.key]!==c.binding.value){next=R.clearParameterBinding(next,n.id,c.index,'普通参数编辑：'+c.binding.key+' 原采用值 '+c.binding.value+' 改为 '+String(params[c.binding.key])+'，解除旧来源对应并重新核对');cleared++;}const edited=next.nodes.find(node=>node.id===n.id);edited.name=name;edited.params=params;edited.initial=initialState;if(n.type==='INPUT'&&!inputBinding(n.id)){if(!qualityWave||qualityWave.mode==='constant'&&qualityWave.value==='GOOD')delete edited.qualityWave;else edited.qualityWave=qualityWave;}edited.provenance={...edited.provenance,parametersEdited:true};if(n.type==='INPUT')waveDrafts.delete(n.id);mutate(()=>project=next);status('参数已应用；旧运行记录已清除。'+(removedInitials?' 已移除'+removedInitials+'个不再选用输出的初值；原接线保留供核对。':'')+(cleared?' '+cleared+'项来源字段对应已解除，请重新核对。':''));
  }catch(e){status(e.message,true);}};
  del.onclick=()=>removeSelected();
  if(!d)host.append(html('div',{class:'source-note'},C.declaredInterfaces.get(n.type)?'仅识别接口，打包点状态与共享写入模型未实现，禁止执行。':'请映射为已支持块，并核对端口及参数。'));
  if(d){const extras=Object.fromEntries(Object.entries(n.params).filter(([key])=>!Object.hasOwn(d.defaults,key)));if(Object.keys(extras).length)host.append(html('div',{class:'source-note'},'保留的未支持参数（仍阻止运行）'),html('pre',{},JSON.stringify(extras,null,2)));}
  parameterBindings(n,host);
  const section=html('div',{class:'prop-section'},'当前输出 / 内部状态'),pre=html('pre',{id:'state-view'},signalState(n));host.append(section,pre);
  const states=signalCatalog().all.filter(c=>c.nodeId===n.id&&(c.section==='states'||n.type==='OUTPUT'));if(states.length){host.append(html('div',{class:'source-note'},'状态探针（观察用途，非算法引脚）：选取后接入示波器。'));for(const c of states){const b=html('button',{'data-state-probe':c.field,class:'state-probe-choice'},'⊕ '+(n.type==='OUTPUT'?'读数':c.field)+' → 探针');b.onclick=()=>{pending={id:n.id,port:c.field,section:c.section};canvas();status('已选内部状态探针 '+c.field+'，请点击示波器接入探针。');};host.append(b);}}
  const defaults=Object.entries(n.provenance?.parameterSources||{}).filter(([,s])=>s.kind==='manual-default'&&s.algorithmType===n.type);if(defaults.length){const details=html('details',{id:'manual-defaults'});details.append(html('summary',{},'导入采用手册默认值 · '+defaults.length+' 项'));for(const[key,s]of defaults)details.append(html('p',{},key+' = '+String(s.value)+' · '+s.reference+(Object.is(n.params[key],s.value)?'':' · 当前已修改为 '+String(n.params[key]))));host.append(details);}
  if(n.provenance){const details=html('details'),sum=html('summary',{},'来源与人工补充记录');details.append(sum,html('pre',{},JSON.stringify(n.provenance,null,2)));host.append(details);}
  if(editingInput){const jump=html('button',{id:'open-input-settings'},'编辑输入变化模式');jump.onclick=()=>showTab('inputs');basicHost.append(html('p',{class:'source-note'},'信号类型受已连接引脚限定。时间、信号值与波形在下方“输入设置”页编辑。'),jump);const advanced=html('details',{class:'input-advanced'});advanced.append(html('summary',{},'高级：控制块类型映射'),type.closest('.field'));basicHost.append(advanced);}
  if(timer)for(const panel of new Set([host,basicHost]))panel.querySelectorAll('input,select,textarea,button:not([data-state-probe])').forEach(e=>{if(!e.hasAttribute('data-display-edit')&&!e.hasAttribute('data-execution-toggle')&&e.id!=='open-input-settings')e.disabled=true;});
 }
 function mcrReviewPanel(host){if(project.importMetadata?.automaticPorts)return;
  const report=E.review(C.executionProject(project));if(!report.rows.length||!project.importAudit?.implementation&&!report.counts.matched&&!report.counts.conflict&&!report.counts.ambiguous)return;
  const panel=html('details',{class:'mcr-review',open:''}),summary=html('summary',{id:'mcr-review-summary'},'MCR连线交叉核对 · '+report.counts.matched+' 项吻合；'+report.counts.conflict+' 项冲突；'+report.counts.ambiguous+' 项多义；'+report.counts.unavailable+' 项证据不足');panel.append(summary,html('p',{class:'source-note'},'比较列出的端口建议、当前边与原MCR属性。针脚可移动，请对照原图后选择并填写依据。批量采用仅确认已有吻合边，其他连接和问题保持。'));
  const list=html('div',{class:'mcr-review-list'}),table=html('table'),head=html('tr');for(const title of ['选择','列出的连接','MCR依据 / 不可批量原因'])head.append(html('th',{},title));table.append(head);
  for(const row of report.rows){const tr=html('tr',{'data-mcr-row':row.candidateId}),cell=html('td'),select=html('input',{type:'checkbox','data-mcr-select':row.candidateId,'aria-label':'采用 '+row.candidateId});select.disabled=!!timer||row.status!=='matched';cell.append(select);const name=(id,port)=>(project.nodes.find(n=>n.id===id)?.name||id||'未知块')+'.'+(port||'?'),connection=name(row.choice.from,row.choice.fromPort)+' → '+name(row.choice.to,row.choice.toPort);tr.append(cell,html('td',{},connection),html('td',{class:'mcr-proof'},row.implementation?row.implementation.file+' · '+row.implementation.attribute+' = '+row.implementation.value:row.reason));table.append(tr);}list.append(table);panel.append(list);
  const actions=html('div',{class:'mcr-review-actions'}),all=html('button',{id:'mcr-review-all'},'选择全部吻合项'),clear=html('button',{id:'mcr-review-clear'},'清除选择'),exportReport=html('button',{id:'export-mcr-review'},'导出交叉核对报告');all.disabled=clear.disabled=!!timer;all.onclick=()=>panel.querySelectorAll('[data-mcr-select]').forEach(input=>input.checked=!input.disabled);clear.onclick=()=>panel.querySelectorAll('[data-mcr-select]').forEach(input=>input.checked=false);exportReport.onclick=()=>download('MCR连接交叉核对.json',JSON.stringify(E.review(project),null,2));actions.append(all,clear,exportReport);panel.append(actions);
  const note=field(panel,'所选连接的人工核对依据','mcr-review-note','','textarea'),accept=html('button',{id:'mcr-review-accept',class:'primary'},'采用所选吻合连接');note.disabled=accept.disabled=!!timer;accept.onclick=()=>{try{if(timer)throw Error('请先暂停');const ids=Array.from(panel.querySelectorAll('[data-mcr-select]:checked'),input=>input.dataset.mcrSelect),next=R.resolveMcrMatches(project,ids,note.value);mutate(()=>project=next);status('已按人工依据采用 '+ids.length+' 条吻合连接；没有新增或改接逻辑边，其他问题仍须处理。');}catch(e){status(e.message,true);}};panel.append(accept);host.append(panel);
 }
 function candidateCards(host){
  mcrReviewPanel(host);
  for(const candidate of (C.executionProject(project).connectionCandidates||[]).filter(c=>c.status==='pending')){
   const row=html('div',{class:'candidate-card','data-testid':'candidate-card'});if(candidate.automaticMapping?.status==='blocked'){row.append(html('strong',{},'自动接线未完成 · '+candidate.id),html('p',{class:'source-note'},candidate.automaticMapping.reason+'。请提供配套源文件后重新导入。'));const view=html('button',{},'查看原SVG');view.onclick=()=>openSource();row.append(view);host.append(row);continue;}row.append(html('strong',{},'待确认连接 · '+candidate.id),html('div',{class:'source-note'},candidate.evidence==='coincident-graphic-endpoint-only'?'依据仅为图形端点重合，不参与仿真。请核对源与目标端口。':'引用已定位到对象，但针脚名称需要人工映射。'));
   if(candidate.sourcePortSuggestion||candidate.destinationPortSuggestion){const describe=h=>h?h.algorithm+' '+h.port+'（符号'+h.observedInputs+'入'+h.observedOutputs+'出）':'无建议';row.append(html('div',{class:'source-note port-suggestion-note'},'试验性针脚建议，待核对：源 '+describe(candidate.sourcePortSuggestion)+'；目标 '+describe(candidate.destinationPortSuggestion)+'。依据：单针脚接口或符号左右位置/上下顺序。针脚可移动，请对照原图；缺失输入路数仍须在参数区填写。采用前不参与仿真。'));}
   const controls=html('div',{class:'candidate-controls'}),fromWrap=html('div'),toWrap=html('div');controls.append(fromWrap,toWrap);row.append(controls);
   const names=[['','请选择控制块'],...project.nodes.map(n=>[n.id,n.name+' · '+n.type+' ('+n.id+')'])];
   const from=field(fromWrap,'源块','candidate-from-'+candidate.id,candidate.from,names),fromPort=field(fromWrap,'输出端口','candidate-output-'+candidate.id,'',[['','请选择']]);
   const to=field(toWrap,'目标块','candidate-to-'+candidate.id,candidate.to,names),toPort=field(toWrap,'输入端口','candidate-input-'+candidate.id,'',[['','请选择']]);
   const update=(select,which,nodeId,value)=>{select.replaceChildren(html('option',{value:''},'请选择端口'));const n=project.nodes.find(n=>n.id===nodeId);if(n)for(const name of Object.keys(C.ports(n)[which]))select.append(html('option',{value:name},name));select.value=value||'';};
   update(fromPort,'outputs',from.value,candidate.fromPort||candidate.sourcePortSuggestion?.port);update(toPort,'inputs',to.value,candidate.toPort||candidate.destinationPortSuggestion?.port);
   from.onchange=()=>update(fromPort,'outputs',from.value,null);to.onchange=()=>update(toPort,'inputs',to.value,null);
   const note=html('input',{'data-resolution-note':'true',placeholder:'填写逐针脚核对依据，或拒绝原因','aria-label':'人工核对依据'});row.append(note);
   const actions=html('div',{class:'candidate-actions'}),accept=html('button',{},'采用连接'),reject=html('button',{},'拒绝候选'),inspect=html('button',{},'对照源图');actions.append(inspect,accept,reject);row.append(actions);inspect.onclick=()=>openSource({...candidate,from:from.value,fromPort:fromPort.value,to:to.value,toPort:toPort.value},null,note.value);
   const decide=decision=>{if(timer){status('请先暂停。',true);return;}try{const next=R.resolveCandidate(project,candidate.id,decision,{from:from.value,fromPort:fromPort.value,to:to.value,toPort:toPort.value},note.value);mutate(()=>project=next);status(decision==='accept'?'连接已按人工核对结果采用，依据已记录。':'候选已拒绝，原因已记录。');}catch(e){status(e.message,true);}};
   accept.onclick=()=>decide('accept');reject.onclick=()=>decide('reject');host.append(row);
  }
 }
 function importInformation(){if(project.importAudit){const audit=project.importAudit,summary=audit.summary,card=html('div',{id:'import-audit-summary',class:'import-audit-summary'},'导入快照 · SVG逻辑对象 '+summary.svgLogicTotal+'（布局关联 '+summary.svgLogicAssociated+'）；SVG连接 '+summary.svgConnectionsTotal+'（自动映射 '+(summary.svgConnectionsAutomaticallyMapped||0)+'，针脚显式识别 '+summary.svgConnectionsExplicit+'，属性交叉确认 '+(summary.svgConnectionsPropertyVerified||0)+'，物理连线恢复 '+(summary.svgConnectionsRecovered||0)+'）；TFT记录 '+summary.tftRecordsTotal+'；字段待处理 '+['unresolved','unsupported','invalid','conflict'].reduce((sum,key)=>sum+(summary.fieldStatuses[key]||0),0)+'，点记录声明保留 '+(summary.fieldStatuses['declared-not-interpreted']||0)+'。');card.append(html('p',{},'当前待处理项见上方问题列表。'));if(audit.parameterDefaults?.length)card.append(html('p',{id:'import-defaults-summary'},'导入已按手册补齐 '+audit.parameterDefaults.length+' 项默认参数；各块属性中可查看采用值和手册页码。输入工况、仿真起点及不支持模式仍单独检查。'));if(audit.auxiliaryDocuments?.length){const box=html('details',{id:'xml-audit-summary'});box.append(html('summary',{},'辅助XML '+summary.xmlDocumentsTotal+' 份 · 指令 '+summary.xmlInstructionsTotal+' · 参数记录 '+summary.xmlArgumentsTotal+'（未解读）'));for(const doc of audit.auxiliaryDocuments){box.append(html('p',{},doc.file+' · '+(doc.association==='same-stem'?'同名关联':'未关联')+' · '+(doc.format==='compiled-control-program'?'编译程序未解读':doc.format==='invalid-xml'?'XML无效':doc.format==='unconsumed-control-builder'?'Builder XML未采用':'格式未支持')+' · 未解释元素 '+doc.unrecognizedElementKeys.length));if(doc.root)box.append(html('pre',{},JSON.stringify(doc.root.attributes,null,2)));if(doc.instructions.length){const table=html('table'),head=html('tr');for(const label of ['文档序号','算法名','算法编码','参数记录'])head.append(html('th',{},label));table.append(head);for(const instruction of doc.instructions){const row=html('tr');for(const value of [instruction.ordinal,instruction.attributes['function-name']||'未指定',instruction.attributes['algorithm-id']||'未指定',instruction.arguments.length])row.append(html('td',{},value));table.append(row);}box.append(table);}}box.append(html('p',{},'通过“导出逐对象核对清单”查看完整 XML 属性和参数。'));card.append(box);}const button=html('button',{id:'export-import-audit'},'导出逐对象核对清单');button.onclick=()=>download('导入来源核对清单.json',JSON.stringify(audit,null,2));const view=html('button',{id:'view-source'},'查看原SVG');view.onclick=()=>openSource();card.append(sourceFileUsage(audit));const details=html('details',{id:'import-information',class:'import-information'});details.append(html('summary',{},'导入资料与历史快照（不计入当前问题）'),card);const actions=html('div',{class:'import-tools'});actions.append(html('span',{},'来源工具'),view,button);$('issues').append(details,actions);}
 }
 function documentIssues(){
  if(engineering)return PE.validate(engineeringDocument(),{outputForces:allForces()});
  syncMacro();const root=topProject(),forces=insideMacro()?canvasSessions.get(activeCanvasId)?.outputForces||{}:outputForces;
  return [...C.validate(root),...C.validateOutputForces(root,forces)];
 }
 function problems(){
  if(problemCache?.revision===logicRevision&&problemCache.project===project&&problemCache.failure===runtimeFailure)return problemCache.issues;
  const issues=insideMacro()?C.validate(C.macroProject(project,topProject())):documentIssues();
  if(runtimeFailure){
   const path=runtimeFailure.macroPath;
   if(!insideMacro())issues.push({...runtimeFailure,severity:'error'});
   else if(path&&macroPath.every((entry,index)=>entry.id===path[index]))issues.push({...runtimeFailure,nodeId:path[macroPath.length],severity:'error'});
  }const warnings=(C.executionProject(project).issues||[]).filter(i=>!i.resolved&&i.severity==='warning');
  $('issue-count').textContent=issues.length;$('warning-count').textContent=warnings.length;$('issues').replaceChildren();
  const group=(id,title,count,empty)=>{const box=html('section',{id,class:'problem-group', 'aria-labelledby':id+'-title'});box.append(html('h3',{id:id+'-title'},title+' · '+count));if(!count)box.append(html('p',{class:'source-note'},empty));$('issues').append(box);return box;};
  const errorHost=group('simulation-errors','报错（影响仿真执行）',issues.length,'没有阻止仿真的报错。'),warningHost=group('simulation-warnings','警告（提醒，不影响仿真）',warnings.length,'当前没有警告。');
  const list=[...issues,...warnings];for(const issue of list){const row=html('div',{class:'issue '+(issue.severity==='warning'?'warning':'error')}),text=html('div',{},issue.message);text.append(html('small',{},[issue.nodeId,issue.code].filter(Boolean).join(' · ')));row.append(text);if(issue.nodeId){const b=html('button',{},'定位');b.onclick=()=>{if(issue.canvasId&&issue.canvasId!==activeCanvasId)selectCanvas(issue.canvasId,issue.nodeId);else{selectOnly(issue.nodeId);canvas();properties();}};row.append(b);}const original=(!issue.canvasId||issue.canvasId===activeCanvasId)&&(project.issues||[]).find(i=>i.id&&i.id===issue.id);if(original&&!project.importMetadata?.automaticPorts&&['SVG_SOURCE_UNRESOLVED','SVG_REFERENCE_UNRESOLVED','SVG_PORT_MAPPING_REQUIRED'].includes(original.code)&&original.sourceFile&&original.sourceInstanceKey&&!project.connectionCandidates?.some(c=>c.sourceFile===original.sourceFile&&c.connectionInstanceKey===original.sourceInstanceKey)){const repair=html('button',{},'手工补线');repair.onclick=()=>startManualRepair(original.id);row.append(repair);}if(original){const b=html('button',{},'人工确认');b.onclick=()=>{const note=prompt('请记录补充依据或处理结果。确认会保留记录；内核仍检查块、端口、参数及支持范围。');if(note?.trim())mutate(()=>{original.resolved=true;original.resolution={note:note.trim(),at:new Date().toISOString()};});};row.append(b);}(issue.severity==='warning'?warningHost:errorHost).append(row);}
  candidateCards(errorHost);importInformation();
  problemCache={revision:logicRevision,project,issues,failure:runtimeFailure};return issues;
 }
 function clearComparison(){comparison=null;$('export-comparison').disabled=true;$('comparison-result').replaceChildren(document.createTextNode('尚未对照或设置/记录已更改。先运行当前组态，选择观察信号，并载入参考轨迹。参考格式见 README。'));}
 function clearReference(){referenceLoad++;reference=null;referenceName='';$('reference-name').textContent='未载入';$('reference-file').value='';clearComparison();}
 function referenceForView(data){
  let frames=data.trace;
  const engineeringRecord=frames.some(frame=>frame?.canvases);
  if(engineeringRecord){
   if(!engineering)throw Error('工程参考需要在对应多画布工程中对照');
   frames=frames.map(frame=>frame?.canvases?.[activeCanvasId]);
   if(frames.some(frame=>!frame))throw Error('参考工程缺少当前画布 '+activeCanvasId);
  }
  if(insideMacro()&&(engineeringRecord||frames.some(frame=>frame?.macros)||Array.isArray(data.manifest?.project?.nodes))){
   const nested=frames.map(macroFrame);
   if(!nested.some(Boolean))throw Error('参考记录缺少当前宏实例 '+macroPath.map(entry=>entry.id).join(' / '));
   frames=nested.map((frame,i)=>frame||emptyFrame(frames[i]));
  }
  return frames===data.trace?data:{...data,trace:frames};
 }
 function comparisonView(report){const host=$('comparison-result');host.replaceChildren(html('div',{class:'comparison-summary'},(report.matched?'所选信号匹配':'对照未通过')+' · 已比较 '+report.comparedSamples+' / '+report.requestedSamples+' 个样本 · '+report.diagnosticCount+' 项差异/缺失'),html('p',{},report.scope));
  if(!report.diagnosticCount)return;const table=html('table'),head=html('tr');for(const text of ['扫描','信号','问题','当前','参考'])head.append(html('th',{},text));table.append(head);for(const d of report.diagnostics){const row=html('tr');for(const text of [d.tick??'—',d.label||'—',d.message,precise(d.actual),precise(d.expected)])row.append(html('td',{},text));table.append(row);}host.append(table);if(report.diagnosticsTruncated)host.append(html('p',{},'仅列前200项，分类总数包含全部差异。'));
 }
 function observationChannels(){
  const catalog=signalCatalog(),all=catalog.all,keys=catalog.keys;if(defaultSignals||observed===null)observed=new Set(all.filter(c=>c.section==='values').slice(0,6).map(c=>c.key));else observed=new Set([...observed].filter(k=>keys.has(k)));
  const signature=catalog.signature;if(signature!==channelSignature){$('signal-options').replaceChildren();for(const c of all){const label=html('label'),input=html('input',{type:'checkbox','data-channel-key':c.key,'data-channel-node':c.nodeId,'data-channel-section':c.section});input.onchange=()=>{defaultSignals=false;input.checked?observed.add(c.key):observed.delete(c.key);clearComparison();results();};label.append(input,document.createTextNode(c.label));$('signal-options').append(label);}channelSignature=signature;checkedSignalSignature=null;}
  const selectedSignature=JSON.stringify([...observed]);if(selectedSignature!==checkedSignalSignature){for(const e of $('signal-options').querySelectorAll('input'))e.checked=observed.has(e.dataset.channelKey);checkedSignalSignature=selectedSignature;}
  const s=current(),last=trace.at(-1);$('history-cursor').max=Math.max(0,trace.length-1);$('history-cursor').value=cursor??Math.max(0,trace.length-1);$('history-cursor').disabled=!trace.length||!!timer;$('history-label').textContent=s?'扫描 '+s.tick+' / '+last.tick+(cursor===null?' · 最新':' · 回看'):'暂无记录';$('history-latest').disabled=!trace.length;
  return all.filter(c=>observed.has(c.key));
 }
 function outputOverviewChannels(){
  const catalog=signalCatalog(),nodes=project.nodes.filter(n=>n.type==='OUTPUT'&&!n.macroReference),available=catalog.all.filter(c=>c.section==='values'&&c.field==='OUT'&&nodes.some(n=>n.id===c.nodeId)),ids=new Set(available.map(c=>c.nodeId));
  if(overviewSelection!==null)overviewSelection=new Set([...overviewSelection].filter(id=>ids.has(id)));const selectedIds=overviewSelection||ids;
  const kindNames={boolean:'数字量',analog:'模拟量',packed16:'LP整字'},signature=JSON.stringify(nodes.map(n=>[n.id,n.name,available.find(c=>c.nodeId===n.id)?.kind]));
  if(signature!==outputOptionsSignature){const host=$('output-overview-options');host.replaceChildren();for(const n of nodes){const c=available.find(c=>c.nodeId===n.id),label=html('label'),box=html('input',{type:'checkbox','data-output-node':n.id});box.disabled=!c;box.onchange=()=>{overviewSelection=new Set(overviewSelection||ids);box.checked?overviewSelection.add(n.id):overviewSelection.delete(n.id);results();};label.append(box,document.createTextNode(T.nodeLabel(project,n)+' · '+(inactiveReason(n.id)||kindNames[c?.kind]||'类型待明确')));host.append(label);}outputOptionsSignature=signature;outputCheckedSignature='';}
  const checked=JSON.stringify([...selectedIds]);if(checked!==outputCheckedSignature){for(const box of $('output-overview-options').querySelectorAll('input'))box.checked=selectedIds.has(box.dataset.outputNode);outputCheckedSignature=checked;}
  $('output-overview-count').textContent=selectedIds.size+'/'+nodes.length;const s=current();$('output-overview-summary').textContent=nodes.length?'已选择 '+selectedIds.size+' / '+nodes.length+' 个OUTPUT模块 · '+(s?'当前 t = '+s.time+' s':'尚未运行')+'。仅影响本页曲线，逐扫描/对照信号单独选择。':'当前没有OUTPUT模块。添加OUTPUT终端并接线后，可在此勾选一个或多个输出点。';
  return available.filter(c=>selectedIds.has(c.nodeId));
 }
 function results(){
  scopes();probes();
  const s=current();$('tick').textContent='扫描 '+(s?.tick||0);$('time').textContent='t = '+(s?.time||0).toFixed(3)+' s';$('legend').replaceChildren();
  const observedChannels=observationChannels(),channels=outputOverviewChannels(),cards=[];
  channels.forEach((c,i)=>{const card=html('div',{class:'overview-readout','data-overview-channel':c.key}),name=html('span',{},'● '+c.label),value=html('strong',{},'—');card.title=c.label;card.style.color=palette[i%palette.length];card.append(name,value);card.onclick=()=>LogicSignalChart.activate($('chart'),c.key);$('legend').append(card);cards.push(card);});
  const m=S.model({channels:channels.map(c=>c.key),windowSeconds:overviewWindow,sharedAnalogAuto:true},project,trace,cursor,signalCatalog().byKey,signalCatalog().capacity);
  LogicSignalChart.paint($('chart'),m,{colors:palette,pick:time=>S.cursorSample(m.samples,time,m.startTime),onReadout:({sample,enabled,activeKey,values,rawValues})=>{cards.forEach((card,i)=>{card.querySelector('strong').textContent=values[i];card.querySelector('strong').title=rawValues[i]===undefined?'没有有效采样':String(rawValues[i]);card.classList.toggle('active',channels[i].key===activeKey);});if(trace.length)$('output-overview-summary').textContent='窗口 '+number(m.startTime)+'–'+number(m.endTime)+' s'+(enabled&&sample?' · 游标 '+number(sample.time)+' s / 扫描 '+sample.tick:' · 实时');}});
  if(!trace.length){$('records').replaceChildren();return;}
  const table=html('table'),head=html('tr');for(const name of ['扫描','秒',...observedChannels.map(c=>c.label)])head.append(html('th',{},name));table.append(head);const end=(cursor??trace.length-1)+1;for(const t of trace.slice(Math.max(0,end-100),end)){const tr=html('tr',{'data-tick':t.tick,class:t.tick===s?.tick?'current-scan':''});for(const v of [t.tick,t.time,...observedChannels.map(c=>T.read(t,c))])tr.append(html('td',{},precise(v)));table.append(tr);}$('records').replaceChildren(table);
 }
 function render(){for(const id of Object.keys(outputForces))if(!project.nodes.some(n=>n.id===id))delete outputForces[id];updateCanvasTool();renderMacroBar();engineeringUI?.refresh();const signature=JSON.stringify((project.library||[]).map(d=>[d.id,d.name,!!d.graph]));if(signature!==librarySignature)library();canvas();properties();problems();results();executionPanel();paperPanel();$('period').value=topProject().dtUs/1000;$('period').disabled=!!timer||insideMacro();$('undo').disabled=!undo.length||!!timer;$('redo').disabled=!redo.length||!!timer;const capacity=signalCatalog().capacity,full=trace.length>0&&trace.length>=capacity.maxSnapshots;$('run').disabled=$('step').disabled=full;$('recording-capacity').textContent='记录上限 '+capacity.maxScans+' 拍';$('recording-capacity').title='保留全部已记录输出和状态；到达本工程容量上限停止，请先导出再复位。';}
 function ensureRun(){
  if(['wire','delete','disable','restore','trace-output'].includes(canvasTool))setCanvasTool('select');
  const [draft]=pendingInputDrafts();
  if(draft){
   if(insideMacro()||draft.canvas.id!==activeCanvasId)selectCanvas(draft.canvas.id,draft.node.id);
   else{selectOnly(draft.node.id);canvas();properties();}
   showTab('inputs');throw Error(draft.canvas.name+' 有未应用的 INPUT 输入草稿，请先应用或恢复。');
  }
  if(!run){const errors=insideMacro()?documentIssues():problems();if(errors.length){showTab('problems');throw Error('运行前检查：'+errors.length+' 个问题待处理。'+(insideMacro()?' '+errors[0].message:''));}if(signalCatalog().capacity.maxScans<1)throw Error('本工程超出记录容量，请减少同时记录的逻辑规模。');if(engineering)prepareEngineeringRun();else{run=C.createRun(topProject(),{outputForces:insideMacro()?canvasSessions.get(activeCanvasId)?.outputForces||{}:outputForces});rootTrace=[run.snapshot()];refreshViewTrace();}cursor=null;}
 }
 function step(){try{ensureRun();const capacity=signalCatalog().capacity;if(trace.length>=capacity.maxSnapshots){stop();throw Error('本工程记录已达 '+capacity.maxScans+' 次扫描，请导出后复位。');}const frame=run.step();if(engineering){engineeringTrace.push(frame);trace.push(viewFrame(frame));}else{rootTrace.push(frame);if(insideMacro())trace.push(viewFrame(frame));}runtimeFailure=null;cursor=null;clearComparison();const full=trace.length>=capacity.maxSnapshots;if(full)stop();render();status(full?'记录已达本工程上限 '+capacity.maxScans+' 次扫描；原始数据完整保留，请导出后复位。':'扫描完成；输出和内部状态已更新。');}catch(e){stop();runtimeFailure=run?.manifest().diagnostics[0]||null;render();if(runtimeFailure)showTab('problems');status(e.message,true);}}
 function showTab(id){if(id==='paper')paperPanel();if(id==='inputs'&&!project.nodes.some(n=>n.id===selected&&n.type==='INPUT'&&!n.macroReference)){const first=project.nodes.find(n=>n.type==='INPUT'&&!n.macroReference);if(first){selectOnly(first.id);canvas();properties();}}document.body.classList.toggle('input-settings-open',id==='inputs');document.body.classList.toggle('output-overview-open',id==='trends');for(const e of document.querySelectorAll('.tab-content'))e.classList.toggle('hidden',e.id!==id);for(const e of document.querySelectorAll('.tab'))e.classList.toggle('active',e.dataset.tab===id);}
 function removeSelected(){if(selectedCandidate){deleteImportedConnection();return;}if(selectedProbe){removeProbe();return;}const ids=new Set(nodeSelection());if(!ids.size&&selectedEdge===null)return;mutate(()=>{if(ids.size){for(const id of ids)waveDrafts.delete(id);project.nodes=project.nodes.filter(n=>!ids.has(n.id));project.edges=project.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));selectOnly(null);}else{project.edges.splice(selectedEdge,1);selectedEdge=null;}pending=null;});}
 function sourceFileUsage(audit){
  const box=html('details',{id:'source-file-usage'});if(!audit.sourceFiles){box.append(html('summary',{},'旧导入快照未记录逐文件用途，请重新导入原文件取得此清单。'));return box;}
  const rows=audit.sourceFiles,unused=rows.filter(f=>!f.uses.length).length;box.open=unused>0;box.append(html('summary',{},'来源文件 '+rows.length+' 份 · 未采用 '+unused+' 份'));
  const labels={target:'主图',implementation:'主图实现',parameters:'主图参数来源','macro-definition':'宏定义','macro-implementation':'宏实现','macro-parameters':'宏参数来源','xml-audit':'XML 结构','task-constraints':'任务约束'},table=html('table'),head=html('tr');for(const title of ['序号 / 文件','用途'])head.append(html('th',{},title));table.append(head);
  rows.forEach((file,i)=>{const row=html('tr');row.append(html('td',{},(i+1)+' / '+file.file),html('td',{},file.uses.length?file.uses.map(u=>labels[u.role]+(u.role.startsWith('macro-')?'：'+u.sheet:'')).join('；'):'未采用'));table.append(row);});box.append(table);return box;
 }
 function checkProject(p){if(!p||![1,2,3].includes(p.schemaVersion)||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.some(n=>!n||typeof n.id!=='string'||typeof n.type!=='string'||typeof n.name!=='string'||!Number.isFinite(n.x)||!Number.isFinite(n.y))||p.edges.some(edge=>!edge||['from','to','fromPort','toPort'].some(key=>typeof edge[key]!=='string'))||(p.connectionCandidates!==undefined&&(!Array.isArray(p.connectionCandidates)||p.connectionCandidates.some(c=>!c||typeof c.id!=='string'||!['pending','accepted','rejected'].includes(c.status))))||(p.issues!==undefined&&(!Array.isArray(p.issues)||p.issues.some(issue=>!issue||typeof issue!=='object'||typeof issue.message!=='string'||!['error','warning'].includes(issue.severity))))||p.nodes.some(n=>!n.params||typeof n.params!=='object'||Array.isArray(n.params)))throw Error('项目版本/结构或块坐标无效');const auditError=A.validateAudit(p.importAudit);if(auditError)throw Error(auditError);const fieldError=R.validateFieldBindings(p);if(fieldError)throw Error(fieldError);const paperError=LogicPaper.validate(p.paper);if(paperError)throw Error(paperError);const scopeError=S.validate(p.scopes);if(scopeError)throw Error(scopeError);for(const n of p.nodes)if(n.type===C.MACRO_TYPE&&!n.macroReference&&n.macroGraph)checkProject(n.macroGraph);const structural=C.validate(p).find(i=>i.code==='PROJECT');if(structural)throw Error('项目结构无效：'+structural.message);}
 function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=html('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function save(){
  if(savingProject)return;
  const draftNote=pendingInputDrafts().length?' 尚有未应用输入草稿未写入文件，请先应用参数后再保存。':'';
  const saved=engineering?engineeringDocument():topProject(),name=(saved.title||'逻辑组态').replace(/[\\/:*?"<>|]/g,'_')+'.json',text=JSON.stringify(saved,null,2);
  if(typeof window.showSaveFilePicker!=='function'){download(name,text);status('工程已下载。此浏览器可在下载设置中开启“每次询问保存位置”。'+draftNote);return;}
  savingProject=true;$('save').disabled=true;let writable;
  try{
   const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'逻辑组态工程 JSON',accept:{'application/json':['.json']}}]});
   writable=await handle.createWritable();await writable.write(text);await writable.close();writable=null;
   status('工程已保存：'+handle.name+'。'+draftNote);
  }catch(e){
   if(writable?.abort)try{await writable.abort();}catch{}
   if(e.name==='AbortError')status('已取消保存工程。');else status('保存工程失败：'+e.message,true);
  }finally{savingProject=false;$('save').disabled=false;}
 }
 function example(){const p=C.newProject();p.title='示例 · 置位保持与复位';p.nodes=[C.newNode('INPUT','s',80,90),C.newNode('INPUT','r',80,280),C.newNode('FLIPFLOP','f',400,180),C.newNode('OUTPUT','o',720,180)];p.nodes[0].name='置位脉冲';p.nodes[0].params.wave={mode:'table',points:[[0,false],[.5,true],[.8,false]]};p.nodes[1].name='复位请求';p.nodes[1].params.wave={mode:'step',at:2.5,before:false,after:true};p.nodes[2].name='记忆状态';p.nodes[3].name='输出观察';p.edges=[{from:'s',fromPort:'OUT',to:'f',toPort:'SET'},{from:'r',fromPort:'OUT',to:'f',toPort:'RSET'},{from:'f',fromPort:'OUT',to:'o',toPort:'IN1'}];return p;}
 function closeRecompute(){const ctx=recomputation;if(ctx){clearTimeout(ctx.scheduled);ctx.job?.cancel();}recomputation=null;$('recompute-dialog').close();}
 function recomputeDetails(r){if(r.error)return '当前工程与历史未被替换。可导出报告保留此错误。';const checks=['工程指纹：'+(r.fingerprintCheck==='matched'?'一致':'记录未附'),'扫描范围：0～'+r.traceRange.lastTick+'，'+r.totalSnapshots+'份快照'+(r.rangeCheck==='not-present'?'（记录未附范围声明）':''),'末次故障：'+({'not-present':'记录未附','none-recorded':'无已记录故障','not-completed':'待复现','reproduced':'已复现','different':'复现有差异'}[r.diagnosticsCheck]||r.diagnosticsCheck),'比较范围：全部输出、内部状态及快照字段；数字与布尔值严格区分。'];if(r.differences.length){checks.push('','差异明细（最多列200项）：');const value=x=>x.present?JSON.stringify(x.value):'缺失';for(const d of r.differences){const path=d.path[0]==='trace'?'扫描 '+d.path[1]+' · '+d.path.slice(2).join('.') :d.path.join('.');checks.push(path+'：记录 '+value(d.expected)+'；复算 '+value(d.actual));}}return checks.join('\n');}
 function recomputeError(ctx,error){if(recomputation!==ctx)return;ctx.running=false;ctx.report={format:'simulator-record-recompute-v1',status:'invalid',matched:false,error:error.message,ovationRuntimeEvidence:false};$('recompute-status').dataset.status='invalid';$('recompute-status').textContent=error.message;$('recompute-details').textContent=recomputeDetails(ctx.report);$('recompute-report').disabled=false;$('recompute-start').disabled=true;$('recompute-load').disabled=true;}
 $('recompute-record').onclick=()=>$('recompute-file').click();
 $('recompute-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;stop();render();const ctx={fileName:file.name,job:null,scheduled:null,running:false,report:null};recomputation=ctx;for(const id of ['recompute-start','recompute-load','recompute-report'])$(id).disabled=true;$('recompute-info').textContent=file.name;$('recompute-details').textContent='';$('recompute-status').dataset.status='reading';$('recompute-status').textContent='正在读取并核对记录元数据…';$('recompute-progress').value=0;$('recompute-progress').max=1;$('recompute-dialog').showModal();
  try{const text=await TextInput.read(file);if(recomputation!==ctx)return;const record=JSON.parse(text);if(!record?.manifest?.project)throw Error('记录缺少内嵌工程。只有轨迹数据时，请使用“轨迹对照”。');checkDocument(PE.isProject(record.manifest.project)?PE.sourceProject(record.manifest.project):C.sourceProject(record.manifest.project));ctx.job=Recompute.prepare(record);const report=ctx.job.report();$('recompute-info').textContent=file.name+' · 记录引擎 '+report.recordEngineVersion+' → 当前 '+report.actualEngineVersion+' · '+report.totalSnapshots+'份快照';$('recompute-status').dataset.status='ready';$('recompute-status').textContent='已核对现有模型声明；点击开始复算。'+(report.fingerprintCheck==='not-present'?' 旧记录未附工程指纹。':'')+(report.rangeCheck==='not-present'?' 旧记录未附范围声明，将核对完整0..N快照。':'')+(report.diagnosticsCheck==='not-present'?' 旧记录未附末次故障信息。':'');$('recompute-details').textContent=recomputeDetails(report);$('recompute-progress').max=report.totalSnapshots;$('recompute-start').disabled=false;}catch(error){recomputeError(ctx,error);}finally{e.target.value='';}
 };
 $('recompute-start').onclick=()=>{const ctx=recomputation;if(!ctx?.job||ctx.running)return;ctx.running=true;$('recompute-start').disabled=true;$('recompute-status').dataset.status='running';
  const slice=()=>{if(recomputation!==ctx)return;try{const end=performance.now()+16;let progress;do{progress=ctx.job.advance(1);}while(progress.status==='running'&&performance.now()<end);$('recompute-progress').value=progress.processedSnapshots;$('recompute-status').textContent='已核对 '+progress.processedSnapshots+' / '+progress.totalSnapshots+' 份完整快照';if(progress.status==='running'){ctx.scheduled=setTimeout(slice,0);return;}ctx.running=false;ctx.report=ctx.job.report();$('recompute-status').dataset.status=ctx.report.status;$('recompute-status').textContent=ctx.report.matched?'全部快照精确匹配，可载入当前引擎复算结果。':'复算发现 '+ctx.report.differenceCount+' 项差异，未载入结果。';$('recompute-details').textContent=recomputeDetails(ctx.report);$('recompute-report').disabled=false;$('recompute-load').disabled=!ctx.report.matched;}catch(error){recomputeError(ctx,error);}};ctx.scheduled=setTimeout(slice,0);
 };
 $('recompute-load').onclick=()=>{const ctx=recomputation;if(!ctx?.report?.matched)return;try{const result=ctx.job.result();checkDocument(result.project);closeRecompute();mutate(()=>{beginProjectLoad();installDocument(result.project);if(engineering){for(const c of engineering.canvases)canvasSessions.set(c.id,{outputForces:result.outputForces[c.id]||{}});outputForces=result.outputForces[activeCanvasId]||{};engineeringTrace=result.trace;trace=engineeringTrace.map(f=>f.canvases[activeCanvasId]);}else{outputForces=Object.assign(Object.create(null),result.outputForces);rootTrace=trace=result.trace;}run=result.run;runtimeFailure=run.manifest().diagnostics[0]||null;cursor=null;executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selectOnly(null);pending=null;});fit();status(trace.length>=signalCatalog().capacity.maxSnapshots?'已载入复算一致的完整轨迹；已达到本工程记录容量，可回看/导出，复位后开始新试验。':'已载入复算一致的工程与完整轨迹；继续运行使用当前引擎。'+(Object.keys(outputForces).length?' 本页已恢复记录中的强制状态，工程保存不携带强制。':''));}catch(error){recomputeError(ctx,error);}};
 $('recompute-report').onclick=()=>{const ctx=recomputation;if(ctx?.report)download('运行记录复算报告.json',JSON.stringify({fileName:ctx.fileName,createdAt:new Date().toISOString(),...ctx.report},null,2));};
 $('recompute-close').onclick=closeRecompute;$('recompute-dialog').addEventListener('cancel',e=>{e.preventDefault();closeRecompute();});
 $('reference-file').onchange=async e=>{const load=++referenceLoad,file=e.target.files[0];if(!file)return;reference=null;referenceName='';clearComparison();$('reference-name').textContent='未载入';try{const text=await TextInput.read(file);if(load!==referenceLoad)return;const csv=/\.csv$/i.test(file.name),data=csv?CSV.parse(text,signalCatalog().all):JSON.parse(text);if(!Array.isArray(data?.trace))throw Error('参考文件应包含 trace 扫描数组');reference=data;referenceName=file.name;$('reference-name').textContent=referenceName;status(csv?'已载入 CSV 参考。请选择来源并填写依据和容差。':'已载入参考轨迹。');}catch(err){if(load===referenceLoad)status(err.message,true);}finally{if(load===referenceLoad)e.target.value='';}};
 for(const name of ['reference-kind','reference-note','compare-abs','compare-rel','compare-time'])$(name).oninput=clearComparison;
 $('compare-run').onclick=()=>{
  try{
   if(!run||!trace.length)throw Error('请先运行当前组态。');
   if(!reference)throw Error('请载入参考轨迹。');
   const kind=$('reference-kind').value,note=$('reference-note').value.trim();
   if(!kind||!note)throw Error('请说明参考来源与工况依据。');
   stop();render();
   const settings={channels:signalCatalog().all.filter(c=>observed.has(c.key))};
   for(const[key,id]of [['absTol','compare-abs'],['relTol','compare-rel'],['timeTol','compare-time']]){if($(id).value==='')throw Error('请明确填写容差。');settings[key]=Number($(id).value);}
   const actual={manifest:run.manifest(),trace:trace.slice()},report=T.compare(actual,referenceForView(reference),settings);
   comparison={...(engineering?{canvasId:activeCanvasId,canvasName:engineering.canvases.find(c=>c.id===activeCanvasId).name}:{}),...(insideMacro()?{macroPath:macroPath.map(entry=>entry.id)}:{}),report,actual,reference:copy(reference),referenceFile:referenceName,review:{kind,note},createdAt:new Date().toISOString()};
   comparisonView(report);$('export-comparison').disabled=false;
   status(report.matched?'对照完成：所选范围内匹配。':'对照完成：发现差异或覆盖缺失。');
  }catch(e){clearComparison();status(e.message,true);}
 };
 $('export-comparison').onclick=()=>{if(comparison)download('轨迹对照报告.json',JSON.stringify(comparison,null,2));};
 $('history-cursor').oninput=()=>{stop();cursor=Number($('history-cursor').value);render();status('正在回看已记录扫描；继续运行从最新扫描推进。');};$('history-latest').onclick=()=>{cursor=null;render();};
 document.addEventListener('pointerdown',e=>{const picker=$('output-overview-picker');if(picker.open&&!picker.contains(e.target))picker.open=false;});$('output-overview-picker').addEventListener('keydown',e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.stopPropagation();}});$('overview-window').onchange=e=>{overviewWindow=Number(e.target.value);results();};$('output-overview-all').onclick=()=>{overviewSelection=null;results();};$('output-overview-clear').onclick=()=>{overviewSelection=new Set();results();};
 $('signals-clear').onclick=()=>{defaultSignals=false;observed=new Set();clearComparison();results();};$('signals-default').onclick=()=>{defaultSignals=true;observed=new Set(signalCatalog().all.filter(c=>c.section==='values').slice(0,6).map(c=>c.key));clearComparison();results();};$('signals-selected').onclick=()=>{if(!selected){status('请先在画布选择控制块。',true);return;}defaultSignals=false;observed=new Set(signalCatalog().all.filter(c=>c.nodeId===selected).map(c=>c.key));clearComparison();results();};
 $('new').onclick=()=>mutate(()=>{beginProjectLoad();clearEngineering();resetWaveDrafts();project=C.newProject();executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selected=null;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;pending=null;});$('help').onclick=()=>window.open('guide.html?theme='+(document.documentElement.dataset.theme==='dark'?'dark':'light'),'_blank','noopener');$('example').onclick=()=>{mutate(()=>{beginProjectLoad();clearEngineering();resetWaveDrafts();project=example();executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selectOnly('f');});fit();};$('source-close').onclick=()=>{closeSource();render();};$('source-overview').onclick=()=>sourceViewer?.fitAll();$('source-focus').onclick=focusSource;$('save').onclick=save;$('open').onclick=()=>$('open-file').click();$('import').onclick=()=>$('import-files').click();$('fit').onclick=fit;$('search').oninput=()=>{if($('search').value.trim().toLowerCase()==='zhongycz'){$('author-dialog').showModal();return;}library();};$('author-close').onclick=()=>$('author-dialog').close();$('author-dialog').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();$('author-dialog').close();}});
 for(const id of ['undo','redo'])$(id).onclick=()=>{const source=id==='undo'?undo:redo,target=id==='undo'?redo:undo;if(timer||!source.length)return;if(canvasTool==='trace-output'){canvasTool='select';updateCanvasTool();}wireDraft=null;const next=source.pop(),before=historyState();target.push(before);if(!sameLogic(before,next))invalidate();restoreHistory(next);render();setCamera();};

 $('period').onchange=()=>{const raw=Number($('period').value)*1000,value=Math.abs(raw-Math.round(raw))<1e-7?Math.round(raw):raw;mutate(()=>setEngineeringPeriod(value));};$('step').onclick=()=>{stop();step();};$('reset').onclick=()=>{invalidate();render();status('已复位。下一次运行从明确的用户初值开始。');};$('pause').onclick=()=>{stop();render();status('已暂停，可检查逐扫描输出和内部状态。');};$('run').onclick=()=>{try{ensureRun();if(timer)return;cursor=null;timer=setInterval(()=>{for(let i=0;i<1&&timer;i++)step();},Math.max(20,Math.min(1000,topProject().dtUs/1000)));render();status('正在运行。');}catch(e){status(e.message,true);}};
 $('export-csv').onclick=()=>{if(!trace.length){status('请先运行或单步。',true);return;}const quote=s=>'"'+String(s).replace(/"/g,'""')+'"',channels=signalCatalog().all,columns=['tick','time_s',...channels.map(c=>c.nodeId+'.'+c.field)],rows=[columns.map(quote).join(',')];for(const t of trace)rows.push([t.tick,t.time,...channels.map(c=>T.read(t,c))].map(quote).join(','));download('运行轨迹.csv','\ufeff'+rows.join('\r\n'),'text/csv');};
 $('export-run').onclick=()=>{if(!run){status('请先运行或单步。',true);return;}download('可复现运行记录.json',JSON.stringify({manifest:run.manifest(),trace:engineering?engineeringTrace:rootTrace},null,2));};
 $('open-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const load=beginProjectLoad('open-file');try{if(timer)throw Error('请先暂停运行，再打开项目。');const text=await TextInput.read(file);if(load!==projectLoad)return;if(timer)throw Error('请先暂停运行，再打开项目。');const p=JSON.parse(text);checkDocument(p);mutate(()=>{installDocument(p);executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selected=null;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;pending=null;});fit();status('项目已打开，运行前仍检查全部配置。');}catch(err){if(load===projectLoad)status(err.message,true);}finally{if(load===projectLoad)e.target.value='';}};
 function applyImport(result){
  if(!result.targetFound)throw Error('未导入 '+result.project.sources.map(f=>f.name).join('、')+'：'+result.issues.map(i=>i.message).join('；')+'。当前工程和运行记录已保留。');
  if(timer)throw Error('请先暂停运行，再导入 Control Sheet。');
  mutate(()=>{useImportedProject(result.project);executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selectOnly(project.nodes[0]?.id||null);selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;pending=null;});showTab('problems');fit();status('已导入 '+result.summary.target+'；已提取 '+result.summary.nodes+' 个对象、'+result.summary.connections+' 条显式连接；请处理导入问题。');
 }
 function closeImport(){importDraft=null;$('import-sheet-dialog').close();}
 function chooseImport(inputs,result){
  importDraft=inputs;$('import-sheet-apply').disabled=true;$('import-sheet-info').textContent=inputs.length+' 个来源文件。'+result.issues.map(i=>i.message).join('；');const choices=$('import-sheet-choices');choices.replaceChildren();
  for(const target of result.targets){const label=html('label',{class:'import-sheet-choice'}),radio=html('input',{type:'radio',name:'import-sheet',value:target.file});radio.disabled=!target.selectable;radio.onchange=()=>{$('import-sheet-apply').disabled=false;};label.append(radio,html('span',{},target.file),html('small',{},(target.kind==='ControlFunction'?'控制功能':'控制宏')+' · '+(target.title||'未提供标题')+(target.selectable?'':' · 文件名重复，请重命名后重新选择')));choices.append(label);}
  $('import-sheet-dialog').showModal();status('请选择要编辑的主图；当前图纸和运行记录已保留。');
 }
 $('import-sheet-apply').onclick=()=>{try{const choice=$('import-sheet-choices').querySelector('input:checked:not(:disabled)');if(!importDraft||!choice)throw Error('请选择主图。');const result=I.importFiles(importDraft,DOMParser,{target:choice.value});applyImport(result);closeImport();}catch(err){$('import-sheet-info').textContent=err.message;status(err.message,true);}};
 $('import-sheet-cancel').onclick=()=>{closeImport();status('已取消导入；当前图纸和运行记录已保留。');};$('import-sheet-dialog').addEventListener('cancel',e=>{e.preventDefault();$('import-sheet-cancel').click();});
 $('import-files').onchange=async e=>{const files=Array.from(e.target.files);if(!files.length)return;const load=beginProjectLoad('import-files');importDestination={kind:engineeringUI.importTarget(),canvasId:activeCanvasId};try{if(timer)throw Error('请先暂停运行，再导入 Control Sheet。');const inputs=await Promise.all(files.map(async file=>({name:file.name,text:await TextInput.read(file)})));if(load!==projectLoad)return;const result=I.importFiles(inputs,DOMParser);if(timer)throw Error('请先暂停运行，再导入 Control Sheet。');if(result.selectionRequired)chooseImport(inputs,result);else applyImport(result);}catch(err){if(load===projectLoad)status(err.message,true);}finally{if(load===projectLoad)e.target.value='';}};
 for(const tab of document.querySelectorAll('.tab'))tab.onclick=()=>showTab(tab.dataset.tab);
 const svg=$('canvas');
 const macroBar=html('div',{class:'macro-canvas-bar',hidden:''}),macroBack=html('button',{id:'custom-macro-back',type:'button'},'返回父画布'),macroTitle=html('strong',{id:'custom-macro-title'});
 macroBack.onclick=()=>leaveMacro();macroBar.append(macroBack,macroTitle);
 svg.addEventListener('mousedown',e=>{if(e.button!==0||e.detail!==2||canvasTool!=='select')return;const n=project.nodes.find(node=>node.id===e.target.closest('[data-node-id]')?.dataset.nodeId);if(n?.type===C.MACRO_TYPE&&!n.macroReference&&n.macroGraph)openMacro(n);});
 function renderMacroBar(){
  macroBar.hidden=!insideMacro();macroTitle.textContent=macroPath.map(entry=>macroNode(entry).name).join(' / ');
 }
 function positionDrawingSettings(tool){const panel=$(tool+'-settings'),box=$(tool+'-tool').getBoundingClientRect(),height=panel.offsetHeight||220;panel.style.left='clamp(12px, '+box.left+'px, calc(100vw - 322px))';panel.style.top='clamp(12px, '+(box.bottom+8)+'px, calc(100vh - '+(height+12)+'px))';}
 function positionEraserSettings(){positionDrawingSettings('eraser');}
 window.addEventListener('resize',()=>{for(const tool of ['pen','eraser','rect','ellipse','text'])if($(tool+'-settings').matches(':popover-open'))positionDrawingSettings(tool);});
 function setLocalEraserSize(value){const numeric=String(value).trim()===''?NaN:Number(value),size=Number.isFinite(numeric)?Math.max(4,Math.min(120,Math.round(numeric))):Number($('eraser-size').value);annotations.setEraserSize(size);$('eraser-size').value=$('eraser-size-value').value=String(size);}
 $('eraser-size').oninput=()=>setLocalEraserSize($('eraser-size').value);$('eraser-size-value').onchange=()=>setLocalEraserSize($('eraser-size-value').value);
 for(const tool of ['pen','rect','ellipse','text']){const panel=$(tool+'-settings');$(tool+'-tool').onclick=()=>{setCanvasTool(tool);if(!panel.matches(':popover-open'))panel.showPopover();positionDrawingSettings(tool);};$(tool+'-settings-close').onclick=()=>panel.hidePopover();panel.addEventListener('toggle',()=>$(tool+'-tool').setAttribute('aria-expanded',String(panel.matches(':popover-open'))));if(tool!=='text')$(tool+'-width').onchange=()=>annotations.setWidth($(tool+'-width').value,tool);}$('eraser-tool').onclick=()=>{setCanvasTool('eraser');const panel=$('eraser-settings');positionEraserSettings();if(!panel.matches(':popover-open'))panel.showPopover();};$('eraser-settings-close').onclick=()=>$('eraser-settings').hidePopover();$('eraser-settings').addEventListener('toggle',()=>{$('eraser-tool').setAttribute('aria-expanded',String($('eraser-settings').matches(':popover-open')));});for(const button of document.querySelectorAll('#eraser-settings [data-eraser-mode]'))button.onclick=()=>{annotations.setEraserMode(button.dataset.eraserMode);for(const option of document.querySelectorAll('#eraser-settings [data-eraser-mode]'))option.setAttribute('aria-pressed',String(option===button));$('eraser-tool').title=button.dataset.eraserMode==='stroke'?'整笔擦除':'局部擦除';$('eraser-size-controls').hidden=button.dataset.eraserMode!=='local';if(button.dataset.eraserMode==='stroke')$('eraser-settings').hidePopover();status('橡皮擦 · '+(button.dataset.eraserMode==='stroke'?'整笔擦除':'局部擦除'));};$('text-size').oninput=()=>{if($('text-size').value)annotations.setFontSize($('text-size').value);};$('text-size').onchange=()=>{$('text-size').value=annotations.setFontSize($('text-size').value||20);};for(const button of document.querySelectorAll('[data-drawing-color]'))button.onclick=()=>{const panel=button.closest('[data-drawing-settings]');annotations.setColor(button.dataset.drawingColor,panel.dataset.drawingSettings);for(const color of panel.querySelectorAll('[data-drawing-color]'))color.setAttribute('aria-pressed',String(color===button));};
 $('trace-output-scope').onchange=()=>{if(canvasTool==='trace-output')setCanvasTool('select');tracePreparedCanvases.clear();updateCanvasTool();status('已选择'+recoveryLabel()+'，点击“溯源恢复”开始。');};
 for(const mode of ['disable','restore','trace-output'])$(mode+'-tool').onclick=()=>setCanvasTool(canvasTool===mode?'select':mode);$('select-tool').onclick=()=>setCanvasTool('select');$('wire-tool').onclick=()=>setCanvasTool(canvasTool==='wire'?'select':'wire');$('delete-tool').onclick=()=>setCanvasTool(canvasTool==='delete'?'select':'delete');
 svg.addEventListener('click',e=>{if(canvasTool==='trace-output'){e.preventDefault();e.stopImmediatePropagation();const element=e.target.closest('[data-node-id]'),n=element&&project.nodes.find(n=>n.id===element.dataset.nodeId);if(n?.type==='OUTPUT'&&!n.macroReference)recoverOutput(n.id);else status('溯源恢复仅可点击OUTPUT观察点或其IN1端子；Esc退出。');return;}if(['disable','restore'].includes(canvasTool)){e.preventDefault();e.stopImmediatePropagation();const node=e.target.closest('[data-node-id]');if(node)changeDisabled([node.dataset.nodeId],canvasTool==='disable');return;}if(canvasTool==='wire'){e.preventDefault();e.stopImmediatePropagation();wireToolClick(e);return;}if(canvasTool==='delete'){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 svg.addEventListener('pointerdown',e=>{if(['wire','disable','restore','trace-output'].includes(canvasTool)&&e.button===0){e.preventDefault();e.stopImmediatePropagation();svg.focus({preventScroll:true});return;}if(canvasTool!=='delete'||e.button!==0||drag)return;e.preventDefault();e.stopImmediatePropagation();svg.focus({preventScroll:true});const targets=eraseHit(e.target),hit=Object.values(targets).some(v=>v.length),p=toWorld(e);drag=hit?{kind:'delete-click',pointerId:e.pointerId,targets,projectAtStart:project,clientX:e.clientX,clientY:e.clientY,moved:false}:{kind:'marquee',deleting:true,pointerId:e.pointerId,x:p.x,y:p.y,to:p,projectAtStart:project,previousIds:[...nodeSelection()],previousSelected:selected,previousPending:pending,moved:false};svg.setPointerCapture(e.pointerId);},{capture:true});
 function suppressClick(){suppressGestureClick=true;setTimeout(()=>{suppressGestureClick=false;},0);}
 svg.addEventListener('click',e=>{
  if(suppressGestureClick){suppressGestureClick=false;e.preventDefault();e.stopPropagation();return;}
  const imported=e.target.closest('[data-svg-candidate]');if(imported){const candidate=project.connectionCandidates.find(c=>c.id===imported.dataset.svgCandidate);if(candidate)selectImportedConnection(candidate.id);return;}
  const input=e.target.closest('[data-scope-input]');if(input){connectProbe(input.dataset.scopeInput,Number(input.dataset.scopeChannelIndex));return;}
  const probe=e.target.closest('[data-probe-key]');if(probe){selectOnly(null);selectedProbe={scopeId:probe.dataset.probeScope,key:probe.dataset.probeKey};pending=null;canvas();properties();return;}
  const port=e.target.closest('[data-direction]');if(port&&repairDraft){if(port.dataset.direction==='output'){repairDraft.from=port.dataset.owner;repairDraft.fromPort=port.dataset.port;}else{repairDraft.to=port.dataset.owner;repairDraft.toPort=port.dataset.port;}canvas();properties();status('已选择核对端口，填写依据后采用连接。');return;}
  if(port){if(port.dataset.direction==='output'){pending={id:port.dataset.owner,port:port.dataset.port};canvas();status('请选择目标输入端口，或点击示波器接入探针。');}else if(pending)connectInput(port.dataset.owner,port.dataset.port);return;}
  const net=e.target.closest('[data-wire-net]');if(net){selectOnly(null);selectedNet=net.dataset.wireNet;pending=null;canvas();properties();return;}
  const edge=e.target.closest('[data-edge-index]');if(edge){selectOnly(null);selectedEdge=Number(edge.dataset.edgeIndex);canvas();properties();}
 });
 svg.addEventListener('pointerdown',e=>{
  if(drag)return;if(e.button===1){e.preventDefault();svg.focus({preventScroll:true});drag={kind:'pan',pointerId:e.pointerId,x:e.clientX,y:e.clientY,camera:{...camera},moved:false};svg.classList.add('panning');svg.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;const port=e.target.closest('[data-direction]');
  if(e.target.closest('[data-scope-id]')||e.target.closest('[data-scope-input]')||e.target.closest('[data-probe-key]')||e.target.closest('[data-edge-index]')||e.target.closest('[data-svg-candidate]')||e.target.closest('[data-wire-net]'))return;
  svg.focus({preventScroll:true});if(port){if(port.dataset.direction==='output'&&!repairDraft)drag={kind:'wire',pointerId:e.pointerId,from:port.dataset.owner,port:port.dataset.port,x:e.clientX,y:e.clientY,previousPending:pending,moved:false};return;}
  const g=e.target.closest('[data-node-id]'),p=toWorld(e),ids=nodeSelection();
  if(g){const id=g.dataset.nodeId;if(e.shiftKey){if(ids.has(id))ids.delete(id);else ids.add(id);selected=ids.has(id)?id:[...ids].at(-1)||null;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;canvas();properties();return;}if(!ids.has(id))selectOnly(id);else{selected=id;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;}drag={kind:'node',pointerId:e.pointerId,x:p.x,y:p.y,positions:project.nodes.filter(n=>selectedNodes.has(n.id)).map(n=>({id:n.id,x:n.x,y:n.y})),before:historyState(),moved:false};canvas();properties();}
  else{e.preventDefault();drag={kind:'marquee',pointerId:e.pointerId,x:p.x,y:p.y,to:p,additive:e.shiftKey,previousIds:[...ids],previousSelected:selected,previousPending:pending,moved:false};}
  svg.setPointerCapture(e.pointerId);
 });
 svg.addEventListener('pointermove',e=>{
  if(canvasTool==='wire'&&wireDraft&&!drag){const p=wireToolPoint(toWorld(e)),snapped=wireToolHit(e.target,p);wireDraft.cursor=snapped?.point||p;drawGesture();}
  if(!drag||e.pointerId!==drag.pointerId)return;
  if(drag.kind==='delete-click'){if(Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)>4)drag.moved=true;return;}
  if(drag.kind==='wire'){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3&&!drag.moved){svg.setPointerCapture(e.pointerId);drag.moved=true;pending={id:drag.from,port:drag.port};}if(drag.moved){drag.to=toWorld(e);canvas();}return;}
  if(drag.kind==='pan'){const m=svg.getScreenCTM().inverse(),dx=e.clientX-drag.x,dy=e.clientY-drag.y;camera.x=drag.camera.x-dx*m.a-dy*m.c;camera.y=drag.camera.y-dx*m.b-dy*m.d;setCamera();return;}
  const p=toWorld(e),dx=p.x-drag.x,dy=p.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;if(!drag.moved)return;
  if(drag.kind==='marquee'){drag.to=p;drawGesture();return;}
  if(drag.kind==='scope'){svg.setPointerCapture(e.pointerId);const object=$('scope-layer').querySelector('[data-scope-id="'+CSS.escape(drag.id)+'"]');if(object&&object!==object.parentNode.lastElementChild)object.parentNode.append(object);const s=project.scopes.find(s=>s.id===drag.id);if(!s)return;if(drag.mode==='resize'){s.width=Math.max(320,drag.start.width+dx);s.height=Math.max(220,drag.start.height+dy);}else{s.x=drag.start.x+dx;s.y=drag.start.y+dy;}const b=S.bounds(s);for(const o of $('scope-layer').children)if(o.dataset.scopeId===s.id)for(const key of ['x','y','width','height'])o.setAttribute(key,b[key]);probes();return;}
  for(const start of drag.positions){const n=project.nodes.find(n=>n.id===start.id);if(n){n.x=start.x+dx;n.y=start.y+dy;}}canvas();
 });
 svg.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;const old=drag;drag=null;svg.classList.remove('panning');drawGesture();if(old.kind==='pan'){e.preventDefault();return;}if(old.kind==='delete-click'){suppressClick();if(!old.moved&&old.projectAtStart===project)performErase(old.targets);return;}if(old.kind==='marquee'&&old.deleting){suppressClick();if(old.moved&&old.projectAtStart===project)performErase(eraseInRect({x:Math.min(old.x,old.to.x),y:Math.min(old.y,old.to.y),right:Math.max(old.x,old.to.x),bottom:Math.max(old.y,old.to.y)}));return;}if(old.kind==='node'&&!old.moved&&!insideMacro()&&project.nodes.some(n=>n.id===selected&&n.type==='INPUT'&&!n.macroReference))showTab('inputs');
  if(old.kind==='wire'){if(!old.moved)return;suppressClick();const target=document.elementFromPoint(e.clientX,e.clientY),port=target?.closest('[data-direction="input"]'),scope=target?.closest('[data-scope-input]'),button=target?.closest('[data-scope-connect]');let connected=false;if(port)connected=connectInput(port.dataset.owner,port.dataset.port);else if(scope||button)connected=connectProbe(scope?.dataset.scopeInput||button.closest('[data-scope-id]').dataset.scopeId,scope?Number(scope.dataset.scopeChannelIndex):undefined);if(!connected){pending=old.previousPending;canvas();}return;}
  if(old.kind==='marquee'&&old.moved){const x=Math.min(old.x,old.to.x),y=Math.min(old.y,old.to.y),right=Math.max(old.x,old.to.x),bottom=Math.max(old.y,old.to.y);selectedNodes=new Set(old.additive?old.previousIds:[]);for(const n of project.nodes)if(n.x>=x&&n.y>=y&&n.x+width(n)<=right&&n.y+height(n)<=bottom)selectedNodes.add(n.id);selected=[...selectedNodes].at(-1)||null;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;pending=null;suppressClick();canvas();properties();return;}
  if(old.kind==='marquee'&&!old.moved){if(!old.additive){selectOnly(null);pending=null;canvas();properties();}return;}
  if(['node','scope'].includes(old.kind)&&old.moved){undo.push(old.before);if(undo.length>50)undo.shift();redo=[];suppressClick();render();}
 });
 svg.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
 svg.addEventListener('pointercancel',()=>{if(drag)cancelGesture();});
 svg.addEventListener('lostpointercapture',e=>{if(drag?.pointerId===e.pointerId)cancelGesture();});
 // A tentative output click has no capture yet; its release may occur outside the SVG.
 for(const type of ['pointerup','pointercancel'])window.addEventListener(type,e=>{if(drag?.pointerId===e.pointerId)cancelGesture();});
 window.addEventListener('blur',()=>{if(drag)cancelGesture();});
 svg.addEventListener('wheel',e=>{if(e.target.closest('[data-scope-id]'))return;e.preventDefault();const p=toWorld(e),scale=e.deltaY>0?1.12:1/1.12;if(camera.w*scale<200||camera.w*scale>20000)return;camera.x=p.x-(p.x-camera.x)*scale;camera.y=p.y-(p.y-camera.y)*scale;camera.w*=scale;camera.h*=scale;setCamera();},{passive:false});
 svg.ondragover=e=>e.preventDefault();svg.ondrop=e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');if(type==='SCOPE')addScope(toWorld(e));else if(C.catalog[type])add(type,toWorld(e));};
 const feedback=LogicFeedback.mount({pause:()=>{const wasRunning=!!timer;stop();render();if(wasRunning)status('仿真已暂停（错误反馈）。');},readContext:()=>{const recorded=(engineering?engineeringTrace:rootTrace).slice(),recordedManifest=run?.manifest(),last=recorded.at(-1);return{project:copy(engineering?engineeringDocument():topProject()),readRunRecord:recordedManifest?()=>({manifest:recordedManifest,trace:recorded}):null,context:{app:{version:document.querySelector('meta[name="application-version"]').content,engineVersion:C.ENGINE_VERSION,profile:C.PROFILE},capturedAt:new Date().toISOString(),projectTitle:project.title,environment:{browser:navigator.userAgent,language:navigator.language,platform:navigator.platform,protocol:location.protocol,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio}},interface:{canvasTool,activeTab:document.querySelector('.tab.active')?.dataset.tab||null,camera:copy(camera),statusMessage:$('status').textContent,statusIsError:$('status').classList.contains('error')},selectedNodes:[...nodeSelection()].map(id=>{const n=project.nodes.find(n=>n.id===id);return{id:n.id,name:n.name,type:n.type};}),simulation:{tick:last?.tick??0,time:last?.time??0,dtUs:topProject().dtUs,snapshots:recorded.length,viewedSnapshot:copy(current())},diagnostics:{errors:copy(problems()),warnings:copy((project.issues||[]).filter(i=>!i.resolved&&i.severity==='warning'))}}};}});
 window.addEventListener('keydown',e=>{
  if(feedback.isActive()){if(e.ctrlKey&&e.key.toLowerCase()==='s')e.preventDefault();return;}
  if(e.key==='Escape'){const panel=['pen','eraser','rect','ellipse','text'].map(tool=>$(tool+'-settings')).find(panel=>panel.matches(':popover-open'));if(panel){e.preventDefault();panel.hidePopover();return;}}
  if($('recompute-dialog').open||$('import-sheet-dialog').open){if(e.key==='Delete'||e.ctrlKey&&['s','z','y'].includes(e.key.toLowerCase()))e.preventDefault();return;}
  if(e.key==='Escape'&&['pen','eraser','rect','ellipse','text'].includes(canvasTool)){e.preventDefault();setCanvasTool('select');return;}
  if(e.key==='Escape'&&canvasTool==='wire'){e.preventDefault();if(wireDraft){wireDraft=null;drawGesture();status('本条连线已取消；可重新从端口或主线起笔。');}else setCanvasTool('select');return;}
  if(e.key==='Escape'&&['delete','disable','restore','trace-output'].includes(canvasTool)){e.preventDefault();setCanvasTool('select');return;}
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;
  if(['pen','eraser','rect','ellipse','text'].includes(canvasTool)&&(['Delete','Backspace'].includes(e.key)||e.ctrlKey&&['a','z','y'].includes(e.key.toLowerCase()))){e.preventDefault();return;}
  if(canvasTool==='trace-output'&&(['Delete','Backspace'].includes(e.key)||e.ctrlKey&&e.key.toLowerCase()==='a')){e.preventDefault();return;}
  if(canvasTool==='wire'&&wireDraft&&e.key==='Backspace'){e.preventDefault();wireDraft.points.pop();wireDraft.cursor=wireDraft.points.at(-1)||wireDraft.start.point;drawGesture();return;}
  if(e.key==='Escape'){e.preventDefault();if(drag)cancelGesture();else{selectOnly(null);pending=null;canvas();properties();}return;}
  if(drag)return;
  if(e.ctrlKey&&e.key.toLowerCase()==='a'&&document.activeElement===svg){e.preventDefault();selectedNodes=new Set(project.nodes.map(n=>n.id));selected=project.nodes.at(-1)?.id||null;selectedEdge=null;selectedProbe=null;selectedNet=null;selectedCandidate=null;pending=null;canvas();properties();}
  else if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();save();}else if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}else if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}else if(e.key==='Delete')removeSelected();
 });
 $('wire-values').onclick=()=>{showWireValues=!showWireValues;$('wire-values').setAttribute('aria-pressed',String(showWireValues));$('canvas').classList.toggle('hide-wire-values',!showWireValues);};
 window.addEventListener('resize',setCamera);setupEngineeringUI();workspaceUI=LogicCanvasWorkspace.mount({
 getProject:engineeringDocument,getActiveCanvas:()=>activeCanvasId,getRevision:()=>logicRevision,getDocumentKey:()=>workspaceDocument,
 getFrame:cid=>engineering?engineeringTrace[cursor??engineeringTrace.length-1]?.canvases[cid]:rootTrace[cursor??rootTrace.length-1],getFrames:cid=>engineering?engineeringTrace.map(f=>f.canvases[cid]):rootTrace,getCursor:()=>cursor,
 beforeViewChange:()=>{if(drag)cancelGesture();},
 activate:(cid,nodeId)=>{const fresh=!canvasSessions.has(cid);selectCanvas(cid);if(fresh)fit();if(nodeId&&project.nodes.some(n=>n.id===nodeId)){if(canvasTool==='trace-output'){const n=project.nodes.find(n=>n.id===nodeId);if(n.type==='OUTPUT'&&!n.macroReference)recoverOutput(nodeId);}else if(['disable','restore'].includes(canvasTool))changeDisabled([nodeId],canvasTool==='disable');else{selectOnly(nodeId);canvas();properties();}}$('canvas').focus({preventScroll:true});},
 resize:()=>requestAnimationFrame(setCamera)
});$('engineering-bar').after(macroBar);project=example();executionDraftKey='';observed=null;defaultSignals=true;overviewSelection=null;selectOnly('f');library();render();fit();
})();
