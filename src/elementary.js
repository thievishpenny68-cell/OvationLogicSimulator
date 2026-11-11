(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./exact-math'):root.LogicExactMath);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicElementary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(X){
 'use strict';
 const catalog=Object.create(null),entry=(type,label,chapter,page,defaults={},extra={})=>catalog[type]={label,group:'数值',arithmetic:true,model:'ref1100-2006-'+type.toLowerCase()+'-v1',defaults,source:'REF_1100 §4.'+chapter+' p'+page+'；手册正常数/GOOD质量规则；不模拟控制器事件。',...extra};
 entry('COMPARE','模拟量三态比较',22,77,{}, {group:'逻辑',optionalInputs:['ENBL']});
 entry('SELECTOR','七路地址选择',93,'332～333',{NMIN:2},{sourceFields:{NMIN:'X1'}});
 entry('COUNTER','逐扫描加减计数',24,'79～80',{DRCT:1,TARG:0},{group:'状态',stateful:true,sourceFields:{DRCT:'X1',TARG:'R1'},selectableInputs:{TARG:'TARG'}});
 entry('DIGCOUNT','数字量计数 / 表决',30,125,{NMIN:2,MTRU:1},{group:'逻辑',sourceFields:{NMIN:'G4',MTRU:'X1'}});
 entry('HIGHLOWMON','高低限 / 回差',45,186,{HISP:100,HIDB:0,LOSP:0,LODB:0},{group:'状态',monitor:true,arithmetic:false,selectableInputs:{HISP:'HISP',LOSP:'LOSP'},stateTypes:{memory:'boolean'},sourceFields:{HISP:'R1',HIDB:'R2',LOSP:'R3',LODB:'R4'}});
 entry('RESETSUM','运行 / 冻结 / 复位累加',85,'307～309',{RCNT:0,GAIN:1,TRST:0},{group:'状态',stateful:true,sourceFields:{RCNT:'R1',GAIN:'R2',TRST:'R3'}});
 entry('TRANSFER','两路数字切换',118,'407～410',{IN1G:1,IN1B:0,IN2G:1,IN2B:0,TPSC:100,BTSC:-100,SLEW:'OFF',OTRK:'OFF',TRR1:2.5,TRR2:2.5},{paramChoices:{SLEW:['OFF'],OTRK:['OFF']},unsupportedInputs:['TRIN'],unsupportedOutputs:['TRK1','TRK2'],sourceFields:{IN1G:'R3',IN1B:'R4',IN2G:'R1',IN2B:'R2',TPSC:'R5',BTSC:'R6',TRR1:'R7',TRR2:'R9',SLEW:null,OTRK:null}});
 entry('SQUAREROOT','增益 / 偏置 / 平方根',106,'365～367',{IN1G:1,IN1B:0,TPSC:100,BTSC:0,TRAT:2.5},{unsupportedInputs:['TRIN'],unsupportedOutputs:['TOUT'],sourceFields:{IN1G:'R1',IN1B:'R2',TPSC:'R3',BTSC:'R4',TRAT:'R5'}});
 for(const[type,label,chapter,page]of [['LOG','常用对数',57,213],['NLOG','自然对数',65,252]])entry(type,label,chapter,page,{BIAS:0},{sourceFields:{BIAS:'R1'}});
 for(const[type,label,chapter,page]of [['ARCCOSINE','反余弦',10,41],['ARCSINE','反正弦',11,42],['ARCTANGENT','反正切',12,43],['COSINE','余弦',23,78],['SINE','正弦',96,337],['TANGENT','正切',114,401]])entry(type,label+'（弧度）',chapter,page);
 entry('POLYNOMIAL','五次多项式',75,'288～289',Object.fromEntries(Array.from({length:6},(_,i)=>['CX'+i,0])),{sourceFields:Object.fromEntries(Array.from({length:6},(_,i)=>['CX'+i,'R'+(i+1)]))});
 entry('ASSIGN','同类型点值传递',13,44,{kind:'analog'},{paramChoices:{kind:['analog','boolean','packed16']},sourceFields:{kind:null}});
 entry('INTERP','线性表查找 / 插值',52,'197～200',{TYPE:'LINEAR',NUMR:2,...Object.fromEntries(Array.from({length:10},(_,i)=>['X'+(i+1),i])),TPSC:100,BTSC:0},{primaryOutput:'YOUT',paramChoices:{TYPE:['LINEAR']},optionalParameters:Array.from({length:8},(_,i)=>'X'+(i+3)),sourceFields:{TYPE:'X2',NUMR:'X1',...Object.fromEntries(Array.from({length:9},(_,i)=>['X'+(i+1),'R'+(i+1)])),X10:'S1',TPSC:'S2',BTSC:'S3'}});
 // A null source field admits an explicitly named SVG attribute, never a guessed TFT slot code.
 entry('TRANSLATOR','整数表查找 / 保持',119,'411～414',Object.fromEntries(Array.from({length:50},(_,i)=>['I'+String(i+1).padStart(2,'0'),0])),{group:'状态',stateful:true,optionalParameters:Array.from({length:50},(_,i)=>'I'+String(i+1).padStart(2,'0')),sourceFields:Object.fromEntries(Array.from({length:50},(_,i)=>['I'+String(i+1).padStart(2,'0'),null]))});
 entry('AVALGEN','模拟量常数',15,47,{VALU:0},{sourceFields:{VALU:'R1'},parameterAliases:{VALUE:'VALU'}});
 entry('DVALGEN','数字量常数',36,158,{VALU:1},{group:'逻辑',sourceFields:{VALU:'R1'},parameterAliases:{VALUE:'VALU'}});
 entry('TRNSFINDX','索引存储 / 分路保持',121,'417～418',{NMIN:1},{group:'状态',stateful:true,primaryOutput:'O01',sourceFields:{NMIN:'X1'}});
 entry('QAVERAGE','多路未加权平均',80,297,{}, {optionalInputs:Array.from({length:8},(_,i)=>'IN'+(i+1))});
 entry('SMOOTH','指数平滑 / 低通滤波',104,'363～364',{SMTH:0},{group:'状态',stateful:true,model:'ref1100-2006-smooth-v2',sourceFields:{SMTH:'R1'}});
 catalog.SMOOTH.source+='SMTH为固定秒制常数，0直通，负值涉及BAD质量而拒绝。t=0采用显式OUT初态，每扫描以旧OUT递推；不推断控制器重启初值。';
 entry('FUNCTION','十二点分段线性函数',41,'170～173',{GAIN:1,BIAS:0,TPSC:100,BTSC:0,TRAT:2.5,BPTS:2,...Object.fromEntries(Array.from({length:12},(_,i)=>[['X'+(i+1),i===0?-100:i===1?100:0],['Y'+(i+1),i===0?-100:i===1?100:0]]).flat())},{unsupportedInputs:['TRIN'],unsupportedOutputs:['TOUT'],optionalParameters:Array.from({length:10},(_,i)=>['X'+(i+3),'Y'+(i+3)]).flat(),parameterAliases:Object.fromEntries(Array.from({length:12},(_,i)=>[['X-'+(i+1),'X'+(i+1)],['Y-'+(i+1),'Y'+(i+1)]]).flat()),sourceFields:{GAIN:'T7',BIAS:'T8',TPSC:'T9',BTSC:'U1',TRAT:'U2',BPTS:'X1',...Object.fromEntries(Array.from({length:12},(_,i)=>[['X'+(i+1),i<9?'R'+(i+1):'S'+(i-8)],['Y'+(i+1),i<6?'S'+(i+4):'T'+(i-5)]]).flat())}});
 catalog.QAVERAGE.model='ref1100-2006-qaverage-v2';catalog.POLYNOMIAL.model='ref1100-2006-polynomial-v2';
 catalog.FUNCTION.source+='当前仅无跟踪/全GOOD；X须非递减。重复X精确命中取首个Y；不同Y重复点相邻插值未核实时明确停止。TPSC/BTSC/TRAT保留为跟踪配置，正常OUT按正文直接取函数值。';
 catalog.QAVERAGE.source+='当前仅全部已接输入GOOD且每扫描更新；BAD/FAIR/未更新剔除和质量传播未实现。';
 function count(ps,max){return Number.isInteger(ps.NMIN)&&ps.NMIN>=1&&ps.NMIN<=max?ps.NMIN:1;}
 function ports(n){let inputs={IN1:'analog'},outputs={OUT:'analog'};const ps=n.params||{};
  switch(n.type){
   case'QAVERAGE':inputs=Object.fromEntries(catalog.QAVERAGE.optionalInputs.map(pin=>[pin,'analog']));break;
   case'AVALGEN':inputs={};break;
   case'DVALGEN':inputs={};outputs={OUT:'boolean'};break;
   case'TRNSFINDX':inputs={IN1:'analog',IN2:'analog'};outputs=Object.fromEntries(Array.from({length:count(ps,64)},(_,i)=>['O'+String(i+1).padStart(2,'0'),'analog']));break;
   case'ASSIGN':{const kind=['analog','boolean','packed16'].includes(ps.kind)?ps.kind:'unknown';inputs={IN1:kind};outputs={OUT:kind};break;}
   case'INTERP':inputs={XIN:'analog',...Object.fromEntries(Array.from({length:Number.isInteger(ps.NUMR)&&ps.NUMR>=2&&ps.NUMR<=10?ps.NUMR:2},(_,i)=>['Y'+(i+1),'analog']))};outputs={YOUT:'analog',VALID:'boolean'};break;
   case'COMPARE':inputs={IN1:'analog',ENBL:'boolean',IN2:'analog'};outputs={OUT:'boolean',OUTG:'boolean',OUTL:'boolean'};break;
   case'SELECTOR':inputs={...Object.fromEntries(Array.from({length:count(ps,7)},(_,i)=>['IN'+(i+1),'analog'])),DIN1:'boolean',DIN2:'boolean',DIN3:'boolean'};break;
   case'COUNTER':inputs={IN1:'boolean',ENBL:'boolean',TARG:'analog'};outputs={OUT:'boolean',ACT:'analog'};break;
   case'DIGCOUNT':inputs=Object.fromEntries(Array.from({length:count(ps,12)},(_,i)=>['IN'+(i+1),'boolean']));outputs={OUT:'analog',FOUT:'boolean'};break;
   case'HIGHLOWMON':inputs={HISP:'analog',IN1:'analog',LOSP:'analog'};outputs={OUT:'boolean'};break;
   case'RESETSUM':inputs={IN1:'analog',FFLG:'boolean',RSET:'boolean',RUN:'boolean'};outputs={OUT:'analog',FOUT:'analog'};break;
   case'TRANSFER':inputs={IN1:'analog',IN2:'analog',FLAG:'boolean'};break;
  }return{inputs,outputs};
 }
 function validate(n,typed,wired){const ps=n.params,d=catalog[n.type];for(const k of Object.keys(d.defaults))if(!d.paramChoices?.[k]&&!(d.selectableInputs?.[k]&&wired.has(n.id+'\0'+k))&&!(d.optionalParameters?.includes(k)&&!Object.hasOwn(ps,k)))typed(ps[k],'analog');
  for(const[key,choices]of Object.entries(d.paramChoices||{}))if(!choices.includes(ps[key]))throw Error(key+'不在手册已支持的选项中：'+choices.join('/'));
  if(n.type==='QAVERAGE'&&!d.optionalInputs.some(pin=>wired.has(n.id+'\0'+pin)))throw Error('QAVERAGE至少需要一路明确的GOOD模拟量输入；未接端不当作零参与平均');
  if(n.type==='SMOOTH'&&ps.SMTH<0)throw Error('SMOOTH的负SMTH会产生BAD质量，当前GOOD范围不支持；SMTH=0为直通');
  if(n.type==='FUNCTION'){if(!Number.isInteger(ps.BPTS)||ps.BPTS<2||ps.BPTS>12)throw Error('BPTS须为2～12的断点数量');if(ps.GAIN===0)throw Error('FUNCTION输入GAIN不能为0');if(ps.BTSC>ps.TPSC)throw Error('BTSC不得大于TPSC');let prior=-Infinity;for(let i=1;i<=ps.BPTS;i++){for(const prefix of ['X','Y']){const key=prefix+i;try{typed(ps[key],'analog');}catch{throw Error('FUNCTION需要有效的 '+key+' 断点参数');}}const x=typed(ps['X'+i],'analog');if(x<prior)throw Error('FUNCTION当前要求X阵列非递减，不自动排序断点');prior=x;}}
  if(n.type==='INTERP'){if(!Number.isInteger(ps.NUMR)||ps.NUMR<2||ps.NUMR>10)throw Error('NUMR须为2～10的表格节点数量');if(ps.BTSC>ps.TPSC)throw Error('BTSC不得大于TPSC');for(let i=1;i<=ps.NUMR;i++)typed(ps['X'+i],'analog');}
  if(n.type==='TRANSLATOR')for(const key of Object.keys(d.defaults))if(Object.hasOwn(ps,key)&&(!Number.isInteger(ps[key])||ps[key]<-32768||ps[key]>32767))throw Error(key+'须为当前支持的-32768～32767整数');
  if(n.type==='SELECTOR'||n.type==='DIGCOUNT'){const max=n.type==='SELECTOR'?7:12;if(!Number.isInteger(ps.NMIN)||ps.NMIN<1||ps.NMIN>max)throw Error('NMIN须为1～'+max+'的输入数量');if(n.type==='DIGCOUNT'&&(!Number.isInteger(ps.MTRU)||ps.MTRU<0||ps.MTRU>ps.NMIN))throw Error('MTRU须为0～NMIN的整数表决门槛');}
  if(n.type==='TRNSFINDX'&&(!Number.isInteger(ps.NMIN)||ps.NMIN<1||ps.NMIN>64))throw Error('NMIN须为1～64的输出数量');
  if(n.type==='COUNTER'&&![0,1].includes(ps.DRCT))throw Error('DRCT只允许0递减或1递增');
  if(['SQUAREROOT','TRANSFER'].includes(n.type)){if(ps.BTSC>ps.TPSC)throw Error('BTSC不得大于TPSC');if(ps.IN1G===0||n.type==='TRANSFER'&&ps.IN2G===0)throw Error('输入增益不能初始化为0');}
  if(n.type==='TRANSFER'&&(ps.SLEW!=='OFF'||ps.OTRK!=='OFF'))throw Error('TRANSFER当前只支持SLEW=OFF、OTRK=OFF的无跟踪直接切换');
 }
 function evaluate(n,ins,previous,typed,check,dtUs){const p=n.params,f=v=>typed(v,'analog'),get=k=>f(Object.hasOwn(ins,k)?ins[k]:p[k]),clamp=v=>Math.max(f(p.BTSC),Math.min(f(p.TPSC),v)),agree=(label,a,b)=>check(n.type+' '+label,a,b),pair=(a,b)=>f(agree('OUT',f(a),f(b)));
  switch(n.type){
   case'SMOOTH':{const smth=f(p.SMTH);if(smth===0)return{OUT:ins.IN1};const seconds=dtUs/1e6,beta=f(Math.exp(f(-f(seconds)/smth))),alpha=f(1-beta),staged=f(f(alpha*ins.IN1)+f(beta*previous.OUT)),wideBeta=Math.exp(-seconds/smth),wide=(1-wideBeta)*ins.IN1+wideBeta*previous.OUT,agreed=pair(staged,wide),stable=-Math.expm1(-seconds/smth)*ins.IN1+wideBeta*previous.OUT;return{OUT:f(agree('OUT 消减误差核对',agreed,f(stable)))};}
   case'QAVERAGE':{const values=catalog.QAVERAGE.optionalInputs.filter(pin=>Object.hasOwn(ins,pin)).map(pin=>ins[pin]);let sum=values[0],wide=values[0];for(const value of values.slice(1)){sum=f(sum+value);wide+=value;}return{OUT:f(agree('OUT 精确均值核对',pair(sum/values.length,wide/values.length),f(X.mean32(values))))};}
   case'FUNCTION':{const xs=Array.from({length:p.BPTS},(_,i)=>f(p['X'+(i+1)])),ys=Array.from({length:p.BPTS},(_,i)=>f(p['Y'+(i+1)]));const lookup=(x,staged)=>{const exact=xs.indexOf(x);if(exact>=0)return ys[exact];if(x<xs[0])return ys[0];if(x>xs.at(-1))return ys[xs.indexOf(xs.at(-1))];const upper=xs.findIndex(v=>v>x),lower=upper-1;for(const index of [lower,upper])if(xs.some((v,i)=>v===xs[index]&&ys[i]!==ys[index]))throw Error('FUNCTION重复X对应不同Y的相邻区间插值尚未核实；精确命中按手册取首个Y，本拍未提交');if(!staged)return ys[lower]+(ys[upper]-ys[lower])*((x-xs[lower])/(xs[upper]-xs[lower]));const dy=f(ys[upper]-ys[lower]),fraction=f(f(x-xs[lower])/f(xs[upper]-xs[lower]));return f(ys[lower]+f(dy*fraction));};const x=f(f(ins.IN1*f(p.GAIN))+f(p.BIAS)),wide=ins.IN1*f(p.GAIN)+f(p.BIAS);return{OUT:pair(lookup(x,true),lookup(wide,false))};}
   case'AVALGEN':return{OUT:f(p.VALU)};
   case'DVALGEN':return{OUT:f(p.VALU)!==0};
   case'TRNSFINDX':{const index=ins.IN2;if(index<=0||index>p.NMIN)return{...previous};if(!Number.isInteger(index))throw Error('TRNSFINDX有效范围内索引须为整数；手册未定义分数索引的选路规则，本拍未提交');return{...previous,['O'+String(index).padStart(2,'0')]:ins.IN1};}
   case'ASSIGN':return{OUT:typed(ins.IN1,p.kind)};
   case'TRANSLATOR':{const index=Math.floor(ins.IN1);if(index<1||index>50)return{OUT:previous.OUT};const key='I'+String(index).padStart(2,'0');return{OUT:Object.hasOwn(p,key)?f(p[key]):0};}
   case'INTERP':{const xs=Array.from({length:p.NUMR},(_,i)=>f(p['X'+(i+1)])),ys=Array.from({length:p.NUMR},(_,i)=>ins['Y'+(i+1)]),x=ins.XIN,result=(y,valid)=>({YOUT:f(clamp(y)),VALID:valid});if(xs.some((v,i)=>i>0&&v<=xs[i-1]))return result(ys.at(-1),false);if(x<xs[0])return result(ys[0],false);if(x>xs.at(-1))return result(ys.at(-1),false);const exact=xs.indexOf(x);if(exact>=0)return result(ys[exact],true);const upper=xs.findIndex(v=>v>x),i=upper-1,deltaY=f(ys[upper]-ys[i]),fraction=f(f(x-xs[i])/f(xs[upper]-xs[i])),staged=f(ys[i]+f(deltaY*fraction)),wide=ys[i]+(ys[upper]-ys[i])*((x-xs[i])/(xs[upper]-xs[i]));return result(pair(clamp(staged),clamp(wide)),true);}
   case'COMPARE':{const enabled=!Object.hasOwn(ins,'ENBL')||ins.ENBL;return{OUT:enabled&&ins.IN1===ins.IN2,OUTG:enabled&&ins.IN1>ins.IN2,OUTL:enabled&&ins.IN1<ins.IN2};}
   case'SELECTOR':{const address=Number(ins.DIN1)+2*Number(ins.DIN2)+4*Number(ins.DIN3);return{OUT:address===0||address>p.NMIN?0:ins['IN'+address]};}
   case'DIGCOUNT':{const count=Object.values(ins).filter(v=>v===true).length;return{OUT:count,FOUT:count>=p.MTRU};}
   case'COUNTER':{const up=p.DRCT===1,target=get('TARG');let actual=ins.ENBL?previous.ACT:up?0:target;const out=up?actual>=target:actual<=0;if(ins.ENBL&&ins.IN1){if(!Number.isInteger(actual)||Math.abs(actual)>=2**24)throw Error('COUNTER当前只支持绝对值小于2^24的精确整数加减；本次扫描未提交');actual=f(actual+(up?1:-1));}return{OUT:out,ACT:actual};}
   case'HIGHLOWMON':{const high=get('HISP'),low=get('LOSP'),input=ins.IN1;if(input>high||input<low)return{OUT:true};const a=f(high-f(p.HIDB)),b=f(low+f(p.LODB)),reset=input<a&&input>b,wide=input<high-f(p.HIDB)&&input>low+f(p.LODB);return{OUT:agree('回差比较',reset?false:previous.OUT,wide?false:previous.OUT)};}
   case'RESETSUM':{let out=f(p.TRST)!==0?f(p.TRST):previous.OUT,frozen=previous.FOUT;if(ins.RUN){const wide=out+f(p.GAIN)*ins.IN1,temp=f(out+f(f(p.GAIN)*ins.IN1));if(ins.FFLG)frozen=pair(temp,wide);out=ins.RSET?f(p.RCNT):pair(temp,wide);}return{OUT:out,FOUT:frozen};}
   case'TRANSFER':{const key=ins.FLAG?'IN2':'IN1',wide=ins[key]*f(p[key+'G'])+f(p[key+'B']),staged=f(f(ins[key]*f(p[key+'G']))+f(p[key+'B']));return{OUT:pair(clamp(staged),clamp(wide))};}
   case'SQUAREROOT':{const wide=ins.IN1*f(p.IN1G)+f(p.IN1B),staged=f(f(ins.IN1*f(p.IN1G))+f(p.IN1B)),root=x=>x>0?Math.sqrt(x):0;return{OUT:pair(clamp(f(root(staged))),clamp(root(wide)))};}
   case'LOG':case'NLOG':{if(ins.IN1<=0)return{OUT:f(-3.4e38)};const value=n.type==='LOG'?Math.log10(ins.IN1):Math.log(ins.IN1),bias=f(p.BIAS);return{OUT:pair(f(value)+bias,value+bias)};}
   case'POLYNOMIAL':{const x=ins.IN1,coefficients=Array.from({length:6},(_,i)=>f(p['CX'+i]));let staged=0,wide=0,power=1;for(let i=0;i<6;i++){const c=coefficients[i];staged=f(staged+f(c*power));wide+=c*x**i;if(i<5)power=f(power*x);}return{OUT:f(agree('OUT 精确多项式核对',pair(staged,wide),f(X.polynomial32(x,coefficients))))};}
   default:{const fn={ARCCOSINE:Math.acos,ARCSINE:Math.asin,ARCTANGENT:Math.atan,COSINE:Math.cos,SINE:Math.sin,TANGENT:Math.tan}[n.type];if(!fn)throw Error('未支持的基本运算 '+n.type);if(['ARCCOSINE','ARCSINE'].includes(n.type)&&Math.abs(ins.IN1)>1)throw Error('反三角函数输入须在[-1,1]内；手册的无效数/报警路径尚未模拟');return{OUT:f(fn(ins.IN1))};}
  }
 }
 function pin(type,name){const d=catalog[type];if(!d||typeof name!=='string')return null;const ps={...d.defaults,...(type==='TRNSFINDX'?{NMIN:64}:type==='INTERP'?{NUMR:10}:type==='SELECTOR'?{NMIN:7}:type==='DIGCOUNT'?{NMIN:12}:{})},p=ports({type,params:ps});if(Object.hasOwn(p.inputs,name)||d.unsupportedInputs?.includes(name))return{port:name,direction:'input'};if(Object.hasOwn(p.outputs,name)||d.unsupportedOutputs?.includes(name))return{port:name,direction:'output'};return null;}
 return{catalog,ports,pin,validate,evaluate};
});
