(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicTextInput=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const labels={'UTF-8':'utf-8',UTF8:'utf-8','UTF-16':'utf-16',UTF16:'utf-16','UTF-16LE':'utf-16le','UTF-16BE':'utf-16be'};
 function decode(input,name='文件'){
  const fail=message=>{throw Error(name+'：'+message);};
  if(!(input instanceof ArrayBuffer)&&!(input instanceof Uint8Array))fail('读取内容不是字节数组');const b=input instanceof Uint8Array?input:new Uint8Array(input);
  if(b[0]===0&&b[1]===0&&(b[2]===254&&b[3]===255||b[2]===255&&b[3]===254)||(b[0]===255&&b[1]===254||b[0]===254&&b[1]===255)&&b[2]===0&&b[3]===0)fail('不支持UTF-32，请在源软件另存为UTF-8或带BOM的UTF-16');
  let encoding='utf-8',bom=false,sniffed=false;
  if(b[0]===255&&b[1]===254){encoding='utf-16le';bom=true;}else if(b[0]===254&&b[1]===255){encoding='utf-16be';bom=true;}else if(b[0]===239&&b[1]===187&&b[2]===191)bom=true;
  else if(b[0]===0&&b[1]===60&&b[2]===0&&b[3]===63){encoding='utf-16be';sniffed=true;}else if(b[0]===60&&b[1]===0&&b[2]===63&&b[3]===0){encoding='utf-16le';sniffed=true;}
  let text;try{text=new TextDecoder(encoding,{fatal:true}).decode(b);}catch{fail('无法按'+encoding.toUpperCase()+'读取，存在非法或不完整字节；请核对源文件编码');}
  const declaration=text.match(/^<\?xml\s[\s\S]*?\?>/),match=declaration?.[0].match(/\bencoding\s*=\s*(['"])([^'"]+)\1/i),label=match?.[2],declared=label&&labels[label.toUpperCase()];
  if(label&&!declared)fail('未支持XML编码声明 '+label+'；支持UTF-8、UTF-16、UTF-16LE/BE');
  if(declared==='utf-16'&&!bom)fail('XML声明UTF-16但缺少BOM，不能确定字节序');
  if(declared&&(declared==='utf-16'?!encoding.startsWith('utf-16'):declared!==encoding))fail('XML编码声明 '+label+' 与实际'+encoding.toUpperCase()+'字节序不一致');
  if(sniffed&&declared!==encoding)fail('无BOM的UTF-16文件须明确声明UTF-16LE或UTF-16BE');
  if(text.includes('\0'))fail('文本包含NUL空字符；请核对文件是否为未标明编码的UTF-16/UTF-32或非文本文件');
  return{text,encoding,bom};
 }
 async function read(file){let bytes;try{bytes=await file.arrayBuffer();}catch{throw Error((file.name||'文件')+'：读取失败');}return decode(bytes,file.name||'文件').text;}
 return{decode,read};
});
