(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicExactMath=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const bits=new DataView(new ArrayBuffer(4));
 // Each binary32 value is an exact signed integer multiple of 2^-149.
 function units(value){if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(Math.fround(value)))throw Error('精确参考需要有限Float32值');bits.setFloat32(0,value);const word=bits.getUint32(0),exponent=(word>>>23)&255,fraction=word&0x7fffff;const integer=exponent?BigInt(fraction|0x800000)<<BigInt(exponent-1):BigInt(fraction);return word>>>31?-integer:integer;}
 function round(numerator,denominator,scale){if(numerator===0n)return 0;const sign=numerator<0n?-1:1,n=numerator<0n?-numerator:numerator;let exponent=n.toString(2).length-denominator.toString(2).length+scale,power=exponent-scale;
  if(power>=0?n<(denominator<<BigInt(power)):(n<<BigInt(-power))<denominator)exponent--;
  if(exponent>127)return sign*Infinity;
  const quantum=Math.max(-149,exponent-23),shift=scale-quantum,a=shift>=0?n<<BigInt(shift):n,b=shift<0?denominator<<BigInt(-shift):denominator;let q=a/b;const remainder=a%b,twice=remainder*2n;if(twice>b||twice===b&&(q&1n))q++;
  return q===0n?0:sign*Math.fround(Number(q)*2**quantum);
 }
 function sum32(values){return round(values.reduce((n,v)=>n+units(v),0n),1n,-149);}
 function mean32(values){if(!values.length)throw Error('精确均值需要输入');return round(values.reduce((n,v)=>n+units(v),0n),BigInt(values.length),-149);}
 function linearSum32(terms){return round(terms.reduce((n,[x,g,b])=>n+units(x)*units(g)+(units(b)<<149n),0n),1n,-298);}
 function polynomial32(x,coefficients){if(!coefficients.length||coefficients.length>6)throw Error('精确多项式需要1～6项系数');const input=units(x),degree=coefficients.length-1;let n=0n,power=1n;for(let i=0;i<=degree;i++){n+=(units(coefficients[i])*power)<<BigInt(149*(degree-i));if(i<degree)power*=input;}return round(n,1n,-149*(degree+1));}
 function dbequals32(left,right,deadband,returned,previous){const abs=n=>n<0n?-n:n,difference=abs(units(left)-units(right)),bound=units(deadband),reset=abs(bound-units(returned));return difference>bound?true:difference<reset?false:previous;}
 return{sum32,mean32,linearSum32,polynomial32,dbequals32};
});
