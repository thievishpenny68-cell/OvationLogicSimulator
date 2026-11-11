(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicTransport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const slots=Array.from({length:25},(_,i)=>'S'+String(i+1).padStart(2,'0'));
 const catalog={TRANSPORT:{label:'模拟传输延迟',group:'状态',defaults:{TSAM:0,NSAM:0,INIT:2},sourceFields:{TSAM:'T9',NSAM:'G0',INIT:'X1'},stateful:true,stateTypes:{...Object.fromEntries([...slots,'phase'].map(k=>[k,'analog'])),firstPass:'boolean'},model:'ref1100-2006-transport-aligned-cold-v1',source:'REF_1100 §4.120 p415～416；GOOD质量、1～25样本及五INIT；软件t0冷初始化，整扫描采样周期；热重启与非对齐时基未实现。'}};
 const ports=()=>({inputs:{IN1:'analog'},outputs:{OUT:'analog'}});
 function plan(n,dtUs){const p=n.params,t=Math.fround(p.TSAM),dt=dtUs/1e6;if(typeof p.TSAM!=='number'||!Number.isFinite(t)||(p.TSAM!==0&&Math.abs(p.TSAM)<2**-126))throw Error('TSAM须为正常有限Float32秒数或0');if(!Number.isSafeInteger(p.NSAM))throw Error('NSAM须为可精确表示的整数（运行时限幅1～25）');if(![0,1,2,3,4].includes(p.INIT))throw Error('INIT只允许0、1、2、3、4');if(!Number.isSafeInteger(dtUs)||dtUs<=0)throw Error('TRANSPORT需要有效扫描周期');const scans=t<=Math.fround(dt)?1:Math.round(t/dt);if(!Number.isSafeInteger(scans)||scans<1||t>Math.fround(dt)&&Math.fround(scans*dt)!==t)throw Error('TRANSPORT采样周期未与扫描周期整倍数对齐；手册未明确跨扫描采样相位，当前不猜取整');return{count:Math.max(1,Math.min(25,p.NSAM)),scans};}
 // Initialize after every node has its software t0 value; never execute upstream early.
 function initial(n,input,out,dtUs){const {count}=plan(n,dtUs),fill=n.params.INIT===2?input:n.params.INIT===3?out:0;return{...Object.fromEntries(slots.map((key,i)=>[key,i<count?fill:0])),phase:0,firstPass:true};}
 // Pop before insertion so a sampled value appears after exactly NSAM periods.
 function step(n,input,previous,state,dtUs){const {count,scans}=plan(n,dtUs),next={...state,phase:state.phase+1,firstPass:false};if(next.phase<scans)return{values:state.firstPass?{OUT:state.S01}:{...previous},state:next};next.phase=0;const out=state.S01;for(let i=0;i<count-1;i++)next[slots[i]]=state[slots[i+1]];next[slots[count-1]]=input;return{values:{OUT:out},state:next};}
 const pin=(type,name)=>type!=='TRANSPORT'?null:name==='IN1'?{port:'IN1',direction:'input'}:name==='OUT'?{port:'OUT',direction:'output'}:null;
 return{catalog,ports,plan,initial,step,pin};
});
