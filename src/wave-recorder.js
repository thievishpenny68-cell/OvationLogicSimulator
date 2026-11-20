(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./signal-quality'):root.LogicSignalQuality);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LogicWaveRecorder=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Q){
 'use strict';
 const type='WAVE_RECORDER',model='wave-recorder-scan-v1',maxSamples=10000,maxTotalSamples=100000;
 const kinds=['boolean','analog','packed16'];
 const definition={
  label:'录波回放',group:'信号',model,replayTimeline:true,
  defaults:{kind:'boolean',mode:'capture',presetId:null,presets:[]},
  source:'模拟器软件工具：逐拍直通采集、保存类型及采样周期，按仿真时间阶梯回放'
 };

 function activePreset(params){
  return Array.isArray(params?.presets)?params.presets.find(p=>p?.id===params.presetId):undefined;
 }

 function validate(params,hasInput,typed){
  if(!kinds.includes(params.kind))throw Error('录波信号类型无效');
  if(!['capture','replay'].includes(params.mode))throw Error('录波模块模式无效');
  if(!Array.isArray(params.presets)||params.presets.length>maxTotalSamples)throw Error('录波预设列表无效');
  const ids=new Set();
  let total=0;
  for(const preset of params.presets){
   if(!preset||!Number.isSafeInteger(preset.id)||preset.id<1||ids.has(preset.id))throw Error('录波预设编号缺失、无效或重复');
   ids.add(preset.id);
   if(!Array.isArray(preset.samples)||!preset.samples.length||preset.samples.length>maxSamples||
      !kinds.includes(preset.kind)||!Number.isSafeInteger(preset.dtUs)||preset.dtUs<1||
      !Number.isSafeInteger(preset.dtUs*preset.samples.length))throw Error('录波预设类型、原采样周期或样本数无效');
   total+=preset.samples.length;
   if(total>maxTotalSamples)throw Error('录波预设样本总数超过 '+maxTotalSamples);
   for(const sample of preset.samples)typed(sample,preset.kind);
   if(Object.hasOwn(preset,'qualities')){
    if(preset.kind==='packed16'||!Array.isArray(preset.qualities)||preset.qualities.length!==preset.samples.length)throw Error('录波预设质量与样本数量或类型不一致');
    for(const quality of preset.qualities)Q.checkState(quality);
   }
  }
  const selected=activePreset(params);
  if(params.presetId!==null&&!selected)throw Error('选中的录波预设不存在');
  if(params.mode==='replay'){
   if(!selected)throw Error('请为录波模块选择回放预设');
   if(selected.kind!==params.kind)throw Error('回放预设与输出端口的类型不一致');
   if(hasInput)throw Error('回放前请断开录波模块输入线');
  }
 }

 function capture(node,frames,lastTick,dtUs,typed){
  const {kind,mode,presets}=node.params;
  if(mode!=='capture')throw Error('切换到采集模式后才可保存新的录波');
  if(!Number.isSafeInteger(lastTick)||lastTick<1)throw Error('请至少完成一拍扫描后再保存录波');
  if(lastTick>maxSamples||lastTick>=frames.length||!Number.isSafeInteger(dtUs)||dtUs<1||
     !Number.isSafeInteger(lastTick*dtUs))throw Error('录波扫描范围或原采样周期无效');
  if(!Array.isArray(presets)||presets.reduce((count,p)=>count+p.samples.length,0)+lastTick>maxTotalSamples)
   throw Error('预设样本总数超过 '+maxTotalSamples+'，请先删除不需要的预设');
  const id=presets.reduce((max,p)=>Math.max(max,p.id),0)+1;
  if(!Number.isSafeInteger(id))throw Error('录波预设编号超出范围');
  const samples=[],qualities=[];
  for(let tick=1;tick<=lastTick;tick++){
   const frame=frames[tick];
   if(frame?.tick!==tick)throw Error('录波需要连续的已提交扫描');
   const value=frame.values?.[node.id]?.OUT;
   if(value===undefined)throw Error('录波模块没有采样值，请检查是否禁用或依赖暂停');
   samples.push(typed(value,kind));
   if(kind!=='packed16')qualities.push(Q.read(frame,node.id,'OUT'));
  }
  return{id,kind,dtUs,samples,...(qualities.some(quality=>quality!=='GOOD')?{qualities}:{})};
 }

 function indexAt(preset,timeUs){
  const index=Math.max(0,Math.floor(timeUs/preset.dtUs)-1);
  return Math.min(index,preset.samples.length-1);
 }
 function sample(preset,timeUs){return preset.samples[indexAt(preset,timeUs)];}
 function qualityAt(preset,timeUs){return preset.qualities?.[indexAt(preset,timeUs)]??'GOOD';}

 return{type,definition,activePreset,validate,capture,sample,qualityAt};
});
