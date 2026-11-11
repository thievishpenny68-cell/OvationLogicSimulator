(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicReferenceCSV=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
 const fail=(line,message)=>{throw Error('CSV第'+line+'行：'+message);};
 function rows(text){
  if(typeof text!=='string')throw Error('CSV内容必须为文本');text=text.replace(/^\uFEFF/,'');
  const result=[];let row=[],field='',state='plain',line=1,start=1;
  const endField=()=>{row.push(field);field='';state='plain';},endRow=()=>{endField();result.push({cells:row,line:start});row=[];};
  for(let i=0;i<text.length;i++){const ch=text[i];
   if(state==='quoted'){
    if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else state='closed';}
    else if(ch==='\r'||ch==='\n'){field+=ch;if(ch==='\r'&&text[i+1]==='\n'){field+='\n';i++;}line++;}
    else field+=ch;continue;
   }
   if(ch===','){endField();continue;}
   if(ch==='\r'||ch==='\n'){endRow();if(ch==='\r'&&text[i+1]==='\n')i++;line++;start=line;continue;}
   if(state==='closed')fail(line,'闭合引号后只能有逗号或换行');
   if(ch==='"'){if(field!=='')fail(line,'未加引号的字段中出现双引号');state='quoted';}else field+=ch;
  }
  if(state==='quoted')fail(start,'双引号未闭合');
  if(row.length||field!==''||state==='closed')endRow();return result;
 }
 function number(text,line,label){const value=Number(text.trim());if(!decimal.test(text.trim())||!Number.isFinite(value))fail(line,label+'必须为有限十进制数');return value;}
 function value(text,kind,line){const s=text.trim();if(kind==='boolean'){if(/^(?:true|1)$/i.test(s))return true;if(/^(?:false|0)$/i.test(s))return false;fail(line,'数字量只能填写TRUE/FALSE或0/1');}
  if(kind==='packed16'){if(!/^(?:\d+|0x[\da-f]+)$/i.test(s))fail(line,'LP整字需要十进制或0x十六进制整数');const v=Number(s);if(!Number.isInteger(v)||v<0||v>65535)fail(line,'LP整字超出0～65535');return v;}
  return number(s,line,'模拟量');
 }
 function parse(text,channels){
  const data=rows(text);if(data.length<2)fail(1,'需要表头和至少一条数据');
  const header=data[0].cells,longHeader=['tick','time_s','node_id','section','field','kind','value'],long=header.length===7&&header.every((v,i)=>v===longHeader[i]);
  if(header.length<3||header[0]!=='tick'||header[1]!=='time_s'||new Set(header).size!==header.length)fail(1,'表头须为tick,time_s及唯一信号列，或规定的长表格式');
  const byKey=new Map(),byLabel=new Map();for(const c of channels||[]){if(!c||typeof c.nodeId!=='string'||typeof c.field!=='string'||!['values','states'].includes(c.section)||!['analog','boolean','packed16'].includes(c.kind))fail(1,'当前信号目录无效');const key=JSON.stringify([c.nodeId,c.section,c.field]);if(byKey.has(key))fail(1,'当前信号标识重复');const item={key,nodeId:c.nodeId,section:c.section,field:c.field,kind:c.kind};byKey.set(key,item);const label=c.nodeId+'.'+c.field;if(!byLabel.has(label))byLabel.set(label,[]);byLabel.get(label).push(item);}
  const mapping=long?[]:header.slice(2).map(label=>{const found=byLabel.get(label)||[];if(found.length!==1)fail(1,found.length?'信号列存在歧义，请使用明确长表：'+label:'当前组态没有信号列：'+label);return found[0];});
  const trace=[],used=new Map();let lastTick=-1,lastTime=-1,snapshot=null,seen=new Set();
  const put=(c,v,line)=>{if(seen.has(c.key))fail(line,'同一扫描的信号重复：'+c.nodeId+'.'+c.field);seen.add(c.key);used.set(c.key,c);const records=snapshot[c.section];if(!Object.hasOwn(records,c.nodeId))records[c.nodeId]=Object.create(null);records[c.nodeId][c.field]=v;};
  for(const row of data.slice(1)){const cells=row.cells,line=row.line;if(cells.length!==header.length)fail(line,'列数与表头不一致');if(!/^\d+$/.test(cells[0].trim()))fail(line,'tick需要非负整数');const tick=Number(cells[0].trim()),time=number(cells[1],line,'time_s');if(!Number.isSafeInteger(tick)||time<0)fail(line,'扫描编号超出安全整数或时间为负');
   if(long&&tick===lastTick){if(time!==lastTime)fail(line,'同一扫描的time_s不一致');}
   else{if(tick<=lastTick||time<=lastTime)fail(line,'扫描编号与秒时间必须严格递增');snapshot={tick,time,values:Object.create(null),states:Object.create(null)};trace.push(snapshot);seen=new Set();lastTick=tick;lastTime=time;}
   if(long){const c=byKey.get(JSON.stringify([cells[2],cells[3],cells[4]]));if(!c)fail(line,'当前组态没有该节点/字段/状态信号');if(cells[5]!==c.kind)fail(line,'kind与当前信号类型不一致');put(c,value(cells[6],c.kind,line),line);}
   else mapping.forEach((c,i)=>put(c,value(cells[i+2],c.kind,line),line));
  }
  return{trace,csvImport:{format:long?'long-v1':'wide-v1',dataRows:data.length-1,timeUnit:'s',alignment:'tick',channels:[...used.values()]}};
 }
 return{parse};
});
