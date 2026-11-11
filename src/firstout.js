(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicFirstOut=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const pins=Array.from({length:16},(_,i)=>'IN'+(i+1)),initialStateTypes={mode:'analog',previousRST:'boolean',previousMask:'packed16'},outputs={MNTR:'packed16',MULT:'boolean',NTRP:'analog',TRPD:'boolean'};
 const catalog={FIRSTOUT:{label:'首出报警 / 首次事件锁存',group:'状态',defaults:{MCFG:0},sourceFields:{MCFG:'X2'},stateful:true,primaryOutput:'TRPD',packedOutput:'MNTR',optionalInputs:pins,initialStateTypes,stateTypes:initialStateTypes,model:'ref1100-2006-firstout-scan-v1',source:'REF_1100 §4.39 p163～167；RST上升重新待命并忽略已有高，首次新沿锁存；MCFG0全部/1最低编号；GOOD输入。禁用TRPD清零，其余报告保持为明确软件约定；非硬件重启模型。'}};
 const ports=()=>({inputs:{RST:'boolean',...Object.fromEntries(pins.map(pin=>[pin,'boolean']))},outputs:{...outputs}}),count=mask=>{let result=0;for(let n=mask;n;n&=n-1)result++;return result;};
 function validate(n,typed){
  const issues=[],add=(code,message)=>issues.push({code,message,nodeId:n.id,severity:'error'}),i=n.initial;
  if(![0,1].includes(n.params.MCFG))add('PARAMETER','MCFG只允许0（所有首出位）或1（最低编号位）');
  try{for(const [name,kind]of Object.entries({...outputs,...initialStateTypes}))typed(i?.[name],kind);
   if(![0,1,2].includes(i.mode)||i.previousRST!==(i.mode!==0)||i.TRPD!==(i.mode===2))throw Error('mode须为0禁用/1待命/2跳闸，previousRST和TRPD须与模式一致');
   if(!Number.isInteger(i.NTRP)||i.NTRP<0||i.NTRP>16)throw Error('NTRP须为0～16整数');
   if(i.MULT!==(i.NTRP>1))throw Error('MULT须与NTRP>1一致');
   if(i.mode===1&&(i.MNTR!==0||i.NTRP!==0||i.MULT))throw Error('待命初态须清空MNTR/MULT/NTRP');
   if(i.mode===2&&(i.NTRP===0||count(i.MNTR)!==(n.params.MCFG===0?i.NTRP:1)))throw Error('跳闸初态的MNTR位数须符合MCFG及NTRP');
  }catch(e){add('INITIAL_REQUIRED','FIRSTOUT需要明确且一致的软件起点：'+e.message);}
  return issues;
 }
 function initial(n){return Object.fromEntries(Object.keys(initialStateTypes).map(key=>[key,n.initial[key]]));}
 function step(n,inputs,previous,state){
  if(typeof inputs.RST!=='boolean')throw Error('FIRSTOUT.RST须为布尔值');
  // The timing diagram explicitly clears TRPD when disabled. The other report
  // values are retained under the documented "does not execute" software rule.
  if(!inputs.RST)return{values:{...previous,TRPD:false},state:{...state,mode:0,previousRST:false},monitorWritten:false};
  if(state.previousRST&&state.mode===2)return{values:{...previous},state:{...state},monitorWritten:false};
  let mask=0;for(let i=0;i<16;i++){const value=inputs[pins[i]];if(value!==undefined&&typeof value!=='boolean')throw Error('FIRSTOUT数字输入须为布尔值');if(value)mask|=1<<i;}
  if(!state.previousRST)return{values:{MNTR:0,MULT:false,NTRP:0,TRPD:false},state:{mode:1,previousRST:true,previousMask:mask},monitorWritten:true};
  const edges=mask&~state.previousMask,number=count(edges),tripped=number>0;
  return{values:{MNTR:n.params.MCFG===1?edges&-edges:edges,MULT:number>1,NTRP:number,TRPD:tripped},state:{mode:tripped?2:1,previousRST:true,previousMask:mask},monitorWritten:true};
 }
 return{catalog,ports,validate,initial,step,count};
});
