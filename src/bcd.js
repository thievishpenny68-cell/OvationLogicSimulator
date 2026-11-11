(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicBCD=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const common={defaults:{BITP:0,NDIG:1,CNTL:0},sourceFields:{BITP:'X2',NDIG:'X1',CNTL:'X3'},primaryOutput:'OUT'};
 const catalog={
  BCDNIN:{...common,label:'BCD解码',group:'运算',arithmetic:true,model:'ref1100-2006-bcd-valid-integers-v1',source:'REF_1100 §4.17 p53～55；LP.A2指定窗口BCD转LA；1～4位，直接/按位取反；每位只支持0～9。'},
  BCDNOUT:{...common,label:'BCD编码 / 局部字写入',group:'状态',stateful:true,packedOutput:'OUT',model:'ref1100-2006-bcd-window-write-v1',source:'REF_1100 §4.18 p56～58；LA整数转LP.A2；只改指定位窗，其他位保持；显式软件初值，仅GOOD且可由NDIG表示的非负整数。'}
 };
 function validate(n){const p=n.params;if(!Number.isInteger(p.NDIG)||p.NDIG<1||p.NDIG>4)throw Error('NDIG须为1～4整数');if(!Number.isInteger(p.BITP)||p.BITP<0||p.BITP+p.NDIG*4>16)throw Error('BITP须为非负整数，BCD位窗须位于LP.A2的0～15位');if(![0,1].includes(p.CNTL))throw Error('CNTL只允许0（直接）或1（按位取反）');}
 function word(v){if(!Number.isInteger(v)||v<0||v>65535)throw Error('BCD打包字须为0～65535整数');return v;}
 function decode(input,p){validate({params:p});word(input);const mask=2**(p.NDIG*4)-1;let bits=(input>>>p.BITP)&mask;if(p.CNTL===1)bits^=mask;let result=0;for(let i=0;i<p.NDIG;i++){const digit=(bits>>>(i*4))&15;if(digit>9)throw Error('BCD位窗含A～F：手册未定义该数字的转换，扫描已停止');result+=digit*10**i;}return result;}
 function encode(initial,input,p){validate({params:p});word(initial);if(!Number.isInteger(input)||input<0||input>=10**p.NDIG)throw Error('BCD编码只支持NDIG位数内的非负整数；手册未明确小数/负数/溢出的规则');let bits=0,value=input;for(let i=0;i<p.NDIG;i++){bits|=(value%10)<<(i*4);value=Math.floor(value/10);}const mask=2**(p.NDIG*4)-1;if(p.CNTL===1)bits^=mask;return word((initial&~(mask<<p.BITP))|(bits<<p.BITP));}
 const ports=n=>({inputs:{IN:n.type==='BCDNIN'?'packed16':'analog'},outputs:{OUT:n.type==='BCDNIN'?'analog':'packed16'}});
 function pin(type,name){if(!catalog[type])return null;return name==='IN'?{port:'IN',direction:'input'}:name==='OUT'?{port:'OUT',direction:'output'}:null;}
 return{catalog,ports,pin,validate,decode,encode};
});
