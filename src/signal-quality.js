(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LogicSignalQuality=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // REF_1140 §§1.8, 1.9, 2.2.2 and 3.2.2. The indices are the 1W bits 9:8.
 const model='ref1140-1w-quality-v1';
 const states=Object.freeze(['GOOD','FAIR','POOR','BAD']);
 const kinds=Object.freeze({GOOD:0,FAIR:1,POOR:2,BAD:3});
 const fields={constant:['mode','value'],step:['mode','at','before','after'],table:['mode','points']};
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const time=value=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('质量变化时刻须为非负有限秒数');
 };
 function checkState(value){
  if(typeof value!=='string'||!own(kinds,value))throw Error('质量须为 GOOD、FAIR、POOR 或 BAD');
  return value;
 }
 function checkWave(wave){
  if(!wave||typeof wave!=='object'||Array.isArray(wave)||typeof wave.mode!=='string'||!own(fields,wave.mode))throw Error('质量变化模式须为常量、阶跃或分段保持');
  if(Object.keys(wave).some(key=>!fields[wave.mode].includes(key)))throw Error('质量波形包含未支持的字段');
  if(wave.mode==='constant'){checkState(wave.value);return;}
  if(wave.mode==='step'){time(wave.at);checkState(wave.before);checkState(wave.after);return;}
  if(!Array.isArray(wave.points)||!wave.points.length)throw Error('质量分段至少需要一个节点');
  let last=-1;
  for(const pair of wave.points){
   if(!Array.isArray(pair)||pair.length!==2)throw Error('质量分段节点须为 [秒, 质量]');
   const [at,quality]=pair;
   time(at);checkState(quality);
   if(at<=last)throw Error('质量分段节点时间必须严格递增');
   last=at;
  }
 }
 function sample(wave,t){
  if(wave===undefined)return 'GOOD';
  if(wave.mode==='constant')return wave.value;
  if(wave.mode==='step')return t>=wave.at?wave.after:wave.before;
  let lo=0,hi=wave.points.length;
  while(hi-lo>1){const i=Math.floor((lo+hi)/2);if(wave.points[i][0]<=t)lo=i;else hi=i;}
  return wave.points[lo][1];
 }
 function read(frame,id,port){
  const map=frame?.qualities;
  return map&&own(map,id)&&own(map[id],port)?map[id][port]:'GOOD';
 }
 function write(frame,id,qualities){
  if(Object.keys(qualities).length)Object.defineProperty(frame.qualities??=Object.create(null),id,{value:qualities,enumerable:true,writable:true,configurable:true});
  else if(frame.qualities)delete frame.qualities[id];
 }
 function worst(values){return states[Math.max(0,...values.map(value=>kinds[value??'GOOD']))];}
 function selectExtremum(left,right,leftQuality,rightQuality,mode,high){
  const q1=leftQuality??'GOOD',q2=rightQuality??'GOOD';
  if(mode==='NOTBAD'&&(q1==='BAD')!==(q2==='BAD'))return q1==='BAD'?{value:right,quality:q2}:{value:left,quality:q1};
  const selectLeft=high?left>=right:left<=right;
  const value=selectLeft?left:right;
  if(mode==='WORSE')return{value,quality:worst([q1,q2])};
  return{value,quality:left===right?states[Math.min(kinds[q1],kinds[q2])]:selectLeft?q1:q2};
 }
 function outputQuality(n,ins,qualityByPin,previous,types,ports,derived={}){
  const q=pin=>qualityByPin[pin]??'GOOD';
  const quality=(()=>{
   switch(n.type){
    case'HIGHMON':case'LOWMON':case'TRANSPORT':case'SATOSP':return 'GOOD';
    case'DBEQUALS':case'MULTIPLY':case'DIVIDE':case'STEAMFLOW':return worst([q('IN1'),q('IN2')]);
    case'SUM':return worst(Object.keys(ins).map(q));
    case'QAVERAGE':{
     const included=Object.keys(ins).map(q).filter(value=>value!=='BAD');
     return included.length?worst(included):'BAD';
    }
    case'GAINBIAS':return n.params.PROQ===0?'GOOD':q('IN1');
    case'SELECTOR':{
     const address=Number(ins.DIN1)+2*Number(ins.DIN2)+4*Number(ins.DIN3);
     return address===0||address>n.params.NMIN?'GOOD':q('IN'+address);
    }
    case'TRANSFER':return q(ins.FLAG?'IN2':'IN1');
    default:{
     const data=ports.find(pin=>/^IN[0-9]+$/.test(pin)&&own(ins,pin));
     return q(data??ports.find(pin=>own(ins,pin)));
    }
   }
  })();
  return Object.fromEntries(Object.keys(types).filter(pin=>types[pin]!=='packed16').map(pin=>{
   if(own(derived,pin))return [pin,derived[pin]];
   if(n.type==='RESETSUM'){
    const update=ins.RUN&&(pin==='OUT'?!ins.RSET:ins.FFLG);
    return [pin,update?q('IN1'):previous[pin]??'GOOD'];
   }
   if(n.type==='FIRSTOUT'&&types[pin]==='boolean')return [pin,'GOOD'];
   return [pin,quality];
  }).filter(([,value])=>value!=='GOOD'));
 }
 return{model,states,checkState,checkWave,sample,read,write,worst,selectExtremum,outputQuality};
});
