(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LogicClockBlocks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const catalog={
  TIMECHANGE:{
   label:'UTC时分秒变化脉冲',group:'状态',stateful:true,defaults:{},
   fixedInitialOutputs:{HCHG:false,MCHG:false,SCHG:false},
   stateTypes:{oldHour:'analog',oldMinute:'analog',oldSecond:'analog'},
   model:'ref1100-2006-timechange-utc-v1',source:'REF_1100 §4.115 p402',
   numericScope:'在扫描设置中填写工程UTC起点。首次扫描使用手册内部旧值0。'
  },
  TIMEDETECT:{
   label:'UTC日 / 班次 / 周变化',group:'状态',stateful:true,
   defaults:{SHF1:0,SHF2:0,SHF3:0,WEEK:0},sourceFields:{SHF1:'X1',SHF2:'X2',SHF3:'X3',WEEK:'X4'},
   fixedInitialOutputs:{DCHG:false,SHFT:false,WCHG:false},
   stateTypes:{oldHour:'analog'},
   model:'ref1100-2006-timedetect-utc-v1',source:'REF_1100 §4.116 p403–404',
   numericScope:'在扫描设置中填写工程UTC起点。SHF1为换日小时，WEEK为0时停用周脉冲。'
  }
 };
 function parseStart(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)){
   throw Error('请在扫描设置填写UTC起点，例如 2026-11-15T00:00:00.000Z');
  }
  const date=new Date(value),ms=date.getTime();
  const canonical=value.replace(/(\.\d{1,3})?Z$/,(_,fraction)=>'.'+(fraction?.slice(1)||'').padEnd(3,'0')+'Z');
  if(!Number.isFinite(ms)||date.toISOString()!==canonical)throw Error('UTC起点的日期或时间无效');
  return ms;
 }
 function ports(node){
  return{inputs:{},outputs:Object.fromEntries(Object.keys(catalog[node.type].fixedInitialOutputs).map(pin=>[pin,'boolean']))};
 }
 function validateParams(node){
  if(node.type!=='TIMEDETECT')return;
  for(const [key,value] of Object.entries(node.params)){
   const max=key==='WEEK'?7:23;
   if(!Number.isInteger(value)||value<0||value>max)throw Error(key+'须为0～'+max+'的整数');
  }
 }
 function initial(node,start){
  return node.type==='TIMECHANGE'?{oldHour:0,oldMinute:0,oldSecond:0}:{oldHour:new Date(start).getUTCHours()};
 }
 function step(node,previous,start,elapsedUs){
  const date=new Date(start+Math.floor(elapsedUs/1000));
  if(!Number.isFinite(date.getTime()))throw Error('仿真UTC时刻超出支持范围');
  const hour=date.getUTCHours(),hourChanged=hour!==previous.oldHour;
  if(node.type==='TIMECHANGE'){
   const minute=date.getUTCMinutes(),second=date.getUTCSeconds();
   return{
    values:{HCHG:hourChanged,MCHG:minute!==previous.oldMinute,SCHG:second!==previous.oldSecond},
    state:{oldHour:hour,oldMinute:minute,oldSecond:second}
   };
  }
  const {SHF1,SHF2,SHF3,WEEK}=node.params;
  const dayChanged=hourChanged&&hour===SHF1;
  const otherShifts=[SHF2,SHF3].filter(value=>value!==0);
  return{
   values:{
    DCHG:dayChanged,
    SHFT:hourChanged&&otherShifts.length>0&&(hour===SHF1||otherShifts.includes(hour)),
    WCHG:dayChanged&&WEEK!==0&&date.getUTCDay()+1===WEEK
   },
   state:{oldHour:hour}
  };
 }
 return{catalog,parseStart,ports,validateParams,initial,step};
});
