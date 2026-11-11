(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicDeclaredInterfaces=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const bits=Array.from({length:16},(_,i)=>'D'+i),digital=()=>Object.fromEntries(bits.map(k=>[k,'boolean']));
 const definitions=Object.assign(Object.create(null),{
  PACK16:{inputs:digital(),outputs:{POUT:'packed16'},optionalInputs:bits,inputAliases:{},outputAliases:{PBPT:'POUT'},source:'REF_1100 §4.71，p261～262；D0～D15为可选数字输入，PBPT/POUT为LP.A2打包点'},
  UNPACK16:{inputs:{PIN:'packed16'},outputs:digital(),optionalInputs:[],inputAliases:{PBPT:'PIN'},outputAliases:{},source:'REF_1100 §4.124，p420～421；PBPT/PIN为LP.A2打包点输入，D0～D15为可选数字输出'}
 });
 const get=type=>definitions[type];
 function pin(type,name){const d=get(type);if(!d||typeof name!=='string')return null;for(const [direction,ports,aliases]of [['input',d.inputs,d.inputAliases],['output',d.outputs,d.outputAliases]]){const key=aliases[name]||name;if(Object.hasOwn(ports,key))return{port:key,direction};}return null;}
 function field(type,key,direction){const p=typeof key==='string'&&pin(type,key.toUpperCase());return p?.direction===direction?p.port:null;}
 return{get,pin,inputField:(type,key)=>field(type,key,'input'),outputField:(type,key)=>field(type,key,'output')};
});
