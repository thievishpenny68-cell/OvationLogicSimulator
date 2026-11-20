(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./exact-math'):root.LogicExactMath,typeof module==='object'&&module.exports?require('./signal-quality'):root.LogicSignalQuality);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicBasicAnalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(X,Q){
 'use strict';
 const limits={TPSC:100,BTSC:0,TRAT:2.5},common={IN1G:1,IN1B:0,IN2G:1,IN2B:0,...limits},sourceFields={IN1G:'R1',IN1B:'R2',IN2G:'R3',IN2B:'R4',TPSC:'R5',BTSC:'R6',TRAT:'R7'},catalog=Object.create(null);
 catalog.DBEQUALS={label:'差值 / 返回死区',group:'状态',monitor:true,model:'ref1100-2006-dbequals-v3',defaults:{DBND:0,RTRN:0},sourceFields:{DBND:'R1',RTRN:'R2'},stateTypes:{memory:'boolean'},source:'REF_1100 §4.25 p81；IN1/IN2模拟、OUT数字；差绝对值>DBND置TRUE，<abs(DBND-RTRN)复位，其余保持；显式OUT初态；DBND、RTRN均须非负；GOOD正常数'};
 for(const [type,label,page]of [['SUM','两路求和','§4.112 p396～398'],['MULTIPLY','乘法','§4.64 p249～251'],['DIVIDE','除法','§4.33 p151～153'],['HISELECT','两路高选','§4.47 p188～192'],['LOSELECT','两路低选','§4.58 p214～218']]){
  const selector=type==='HISELECT'||type==='LOSELECT';catalog[type]={label,group:'数值',arithmetic:true,model:'ref1100-2006-'+type.toLowerCase()+'-v1',defaults:type==='DIVIDE'?{NUMG:1,NUMB:0,DENG:1,DENB:0,...limits}:{...common,...(selector?{QUAL:'WORSE'}:{})},sourceFields:type==='DIVIDE'?{NUMG:'R1',NUMB:'R2',DENG:'R3',DENB:'R4',TPSC:'R5',BTSC:'R6',TRAT:'R7'}:{...sourceFields,...(selector?{QUAL:'X1'}:{})},source:'REF_1100 '+page+'；仅两路IN1/IN2模拟输入与OUT模拟输出、GOOD正常数、无跟踪。TRAT保留为跟踪速率，当前不参与OUT；TRIN/TOUT/TRK未开放，不伪造输出。'+(type==='DIVIDE'?'变换后的分母为0时，分子≥0取上限，否则取下限（0/0取上限）。':'')};
  catalog[type].unsupportedInputs=['TRIN',...(['SUM','HISELECT','LOSELECT'].includes(type)?['IN3','IN4']:[])];catalog[type].unsupportedOutputs=selector?['TRK1','TRK2','TRK3','TRK4']:['TOUT'];
  if(type==='DIVIDE')catalog[type].parameterAliases={IN1G:'NUMG',IN1B:'NUMB',IN2G:'DENG',IN2B:'DENB'};
  if(selector)catalog[type].paramChoices={QUAL:['WORSE','SELECTED','NOTBAD']};
 }
 Object.assign(catalog.SUM,{label:'多路求和（2～4路）',defaults:{IN1G:1,IN1B:0,IN2G:1,IN2B:0,IN3G:1,IN3B:0,IN4G:1,IN4B:0,...limits},sourceFields:{...sourceFields,IN3G:'R8',IN3B:'R9',IN4G:'S1',IN4B:'S2'},optionalInputs:['IN3','IN4'],optionalParameters:['IN3G','IN3B','IN4G','IN4B'],unsupportedInputs:['TRIN'],model:'ref1100-2006-sum-optional-zero-v4',source:'REF_1100 §4.112 p396～399；IN1/IN2必接，IN3/IN4可选，未接值为0；各路分别增益偏置后求和限幅。GOOD正常数、无跟踪；TRIN/TOUT未开放。'});
 const ports=type=>({inputs:{IN1:'analog',IN2:'analog',...(type==='SUM'?{IN3:'analog',IN4:'analog'}:{})},outputs:{OUT:type==='DBEQUALS'?'boolean':'analog'}});
 function pin(type,name){const d=catalog[type];if(!d)return null;const port=type==='DIVIDE'?({NUM:'IN1',DEN:'IN2'})[name]||name:name,p=ports(type);if(Object.hasOwn(p.inputs,port)||d.unsupportedInputs?.includes(port))return{port,direction:'input'};if(Object.hasOwn(p.outputs,port)||d.unsupportedOutputs?.includes(port))return{port,direction:'output'};return null;}
 function validate(n,typed,wired=new Set()){const d=catalog[n.type],ps=n.params;for(const key of Object.keys(d.defaults))if(key!=='QUAL'){const unused=d.optionalParameters?.includes(key)&&!wired.has(n.id+'\0'+key.slice(0,3));if(unused&&!Object.hasOwn(ps,key))continue;if(d.optionalParameters?.includes(key)&&!unused&&!Object.hasOwn(ps,key))throw Error('SUM已连接'+key.slice(0,3)+'，缺少参数 '+key);try{typed(ps[key],'analog');}catch(e){throw Error(key+'：'+e.message);}}if(n.type==='DBEQUALS'){if(ps.DBND<0||ps.RTRN<0)throw Error('DBEQUALS要求DBND、RTRN均为非负数');}
  else{if(ps.BTSC>ps.TPSC)throw Error('BTSC不得大于TPSC');if(n.type!=='DIVIDE'&&ps.IN1G===0)throw Error(n.type+'的IN1G不能初始化为0');if(d.paramChoices?.QUAL&&ps.IN2G===0)throw Error(n.type+'的IN2G不能初始化为0');if(d.paramChoices?.QUAL&&!d.paramChoices.QUAL.includes(ps.QUAL))throw Error('QUAL须明确选择WORSE/SELECTED/NOTBAD，不推断未知整数编码');}
 }
 function unsupported(type,port,direction){const d=catalog[type];if(!(direction==='input'?d?.unsupportedInputs:d?.unsupportedOutputs)?.includes(port))return null;return ['IN3','IN4'].includes(port)?'OPTIONAL_INPUT_UNSUPPORTED':'TRACKING_UNSUPPORTED';}
 function evaluate(n,ins,previous,typed,precisionCheck,quality){const ps=n.params;
  if(n.type==='DBEQUALS'){const db=typed(ps.DBND,'analog'),r=typed(ps.RTRN,'analog'),wideDifference=Math.abs(ins.IN1-ins.IN2),difference=Math.abs(typed(ins.IN1-ins.IN2,'analog')),wideReset=Math.abs(db-r),reset=Math.abs(typed(db-r,'analog')),result=(delta,bound)=>delta>db?true:delta<bound?false:previous.OUT;const agreed=precisionCheck('DBEQUALS比较',result(difference,reset),result(wideDifference,wideReset));return{OUT:precisionCheck('DBEQUALS精确差值核对',agreed,X.dbequals32(ins.IN1,ins.IN2,db,r,previous.OUT))};}
  if(n.type==='SUM'){
   const defaults=catalog.SUM.defaults;
   const values=Object.keys(ports('SUM').inputs).map(pin=>{
    const input=ins[pin]??0,g=typed(ps[pin+'G']??defaults[pin+'G'],'analog'),b=typed(ps[pin+'B']??defaults[pin+'B'],'analog');
    return{staged:typed(typed(input*g,'analog')+b,'analog'),wide:input*g+b,exact:[input,g,b]};
   });
   let staged=values[0].staged,wide=values[0].wide;
   for(const value of values.slice(1)){staged=typed(staged+value.staged,'analog');wide+=value.wide;}
   const low=typed(ps.BTSC,'analog'),high=typed(ps.TPSC,'analog'),clamp=v=>Math.max(low,Math.min(high,v));
   const agreed=precisionCheck('SUM.OUT',clamp(staged),typed(clamp(wide),'analog'));
   return{OUT:precisionCheck('SUM.OUT 精确求和核对',agreed,typed(clamp(X.linearSum32(values.map(v=>v.exact))),'analog'))};
  }
  const keys=n.type==='DIVIDE'?['NUMG','NUMB','DENG','DENB']:['IN1G','IN1B','IN2G','IN2B'],[g1,b1,g2,b2]=keys.map(k=>typed(ps[k],'analog'));
  const low=typed(ps.BTSC,'analog'),high=typed(ps.TPSC,'analog'),clamp=v=>Math.max(low,Math.min(high,v));
  const selector=quality&&(n.type==='HISELECT'||n.type==='LOSELECT'),q1=quality?.input.IN1,q2=quality?.input.IN2;
  const transform=(value,gain,bias)=>typed(typed(value*gain,'analog')+bias,'analog');
  if(selector&&ps.QUAL==='NOTBAD'&&(q1==='BAD')!==(q2==='BAD')){
   const [value,gain,bias,selected]=q1==='BAD'?[ins.IN2,g2,b2,q2]:[ins.IN1,g1,b1,q1];
   quality.output.OUT=selected??'GOOD';
   return{OUT:precisionCheck(n.type+'.OUT',clamp(transform(value,gain,bias)),typed(clamp(value*gain+bias),'analog'))};
  }
  const left=transform(ins.IN1,g1,b1),right=transform(ins.IN2,g2,b2),wideLeft=ins.IN1*g1+b1,wideRight=ins.IN2*g2+b2;
  if(selector){
   const highSelected=n.type==='HISELECT';
   const staged=Q.selectExtremum(left,right,q1,q2,ps.QUAL,highSelected),wide=Q.selectExtremum(wideLeft,wideRight,q1,q2,ps.QUAL,highSelected);
   quality.output.OUT=precisionCheck(n.type+'.OUT质量',staged.quality,wide.quality);
   return{OUT:precisionCheck(n.type+'.OUT',clamp(typed(staged.value,'analog')),typed(clamp(wide.value),'analog'))};
  }
  const calculate=(a,b)=>{switch(n.type){case'MULTIPLY':return a*b;case'DIVIDE':return b===0?(a>=0?high:low):a/b;case'HISELECT':return Math.max(a,b);case'LOSELECT':return Math.min(a,b);default:throw Error('未知基本块');}};
  const staged=clamp(typed(calculate(left,right),'analog')),wider=typed(clamp(calculate(wideLeft,wideRight)),'analog');return{OUT:precisionCheck(n.type+'.OUT',staged,wider)};
 }
 return{catalog,ports,pin,validate,unsupported,evaluate};
});
