(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LogicFIFO=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const capacity=16;
 const eventPins=Array.from({length:capacity},(_,index)=>'IN'+(index+1));
 const initialStateTypes={previousMask:'packed16',previousRTAT:'boolean'};
 const catalog={FIFO:{
  label:'数字事件队列 / 先入先出',group:'状态',stateful:true,
  defaults:{},optionalInputs:eventPins.slice(1),
  fixedInitialOutputs:{OUT:0,FLAG:false},initialStateTypes,
  stateTypes:{...initialStateTypes,depth:'analog'},
  model:'ref1100-2006-fifo-scan-v1',
  source:'REF_1100 §4.38 p161–162',
  numericScope:'空队列起步。IN1、RTAT、CLR必接。队列和最近出队编号可在内部状态中查看。同拍动作顺序会改变结果时，暂停并提示。'
 }};
 function ports(){
  return{
   inputs:{...Object.fromEntries(eventPins.map(pin=>[pin,'boolean'])),RTAT:'boolean',CLR:'boolean'},
   outputs:{OUT:'analog',FLAG:'boolean'}
  };
 }
 function validate(node,typed){
  const initial=node.initial;
  for(const [key,kind] of Object.entries(initialStateTypes))typed(initial?.[key],kind);
  for(const [key,value] of Object.entries(catalog.FIFO.fixedInitialOutputs)){
   if(Object.hasOwn(initial,key)&&initial[key]!==value)throw Error('FIFO以空队列启动，OUT初值固定为0，FLAG初值固定为FALSE');
  }
 }
 function initial(node){
  return{queue:[],depth:0,previousMask:node.initial.previousMask,previousRTAT:node.initial.previousRTAT};
 }
 function appendEvents(queue,events){
  queue.push(...events.slice(0,capacity-queue.length));
 }
 function step(inputs,previous,state){
  let mask=0;
  for(let index=0;index<eventPins.length;index++){
   if(inputs[eventPins[index]])mask|=1<<index;
  }
  // Track levels during CLR so suppressed edges are not replayed on release.
  const history={previousMask:mask,previousRTAT:inputs.RTAT};
  if(inputs.CLR)return{values:{OUT:0,FLAG:false},state:{...history,queue:[],depth:0}};

  const rising=mask&~state.previousMask;
  const events=[];
  for(let index=0;index<eventPins.length;index++){
   if(rising&(1<<index))events.push(index+1);
  }
  const rotate=inputs.RTAT&&!state.previousRTAT;
  const queue=state.queue.slice();
  let out=previous.OUT;
  if(rotate&&events.length){
   // Check the result of both orders. The manual does not select a winner.
   const rotateFirst=state.queue.slice();
   const alternateOut=rotateFirst.shift()??0;
   appendEvents(rotateFirst,events);
   appendEvents(queue,events);
   out=queue.shift()??0;
   if(out!==alternateOut||queue.length!==rotateFirst.length||
      queue.some((event,index)=>event!==rotateFirst[index])){
    throw Error('FIFO同拍入队与RTAT出队的先后顺序未核定，且两种顺序结果不同。请把两个上升沿分到不同扫描');
   }
  }else if(rotate){
   out=queue.shift()??0;
  }else{
   appendEvents(queue,events);
  }
  return{values:{OUT:out,FLAG:queue.length>0},state:{...history,queue,depth:queue.length}};
 }
 return{catalog,capacity,ports,validate,initial,step};
});
