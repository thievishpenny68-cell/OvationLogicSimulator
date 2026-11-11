(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./core'):root.LogicCore,node?require('./vendor/xlsx.mini.min'):root.XLSX);if(node)module.exports=api;else root.LogicInputWaveExcel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,X){
 'use strict';
 const MAX_BYTES=5*1024*1024,MAX_POINTS=5000,decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
 function readWorkbook(input){
  const b=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  if(!b)throw Error('Excel内容须为文件字节');if(b.byteLength>MAX_BYTES)throw Error('Excel文件不能超过5 MiB');
  if(b.length<4||b[0]!==80||b[1]!==75||b[2]!==3||b[3]!==4)throw Error('仅支持未加密的.xlsx文件，请用Excel另存为.xlsx');
  let w;try{w=X.read(b,{type:'array',cellFormula:true,cellDates:true,cellNF:true,cellHTML:false,cellText:false,WTF:true});}catch(e){throw Error('无法读取.xlsx，文件可能损坏或加密：'+String(e.message||e).slice(0,160));}
  if(!w?.Sheets||!Array.isArray(w.SheetNames)||!w.SheetNames.length||new Set(w.SheetNames).size!==w.SheetNames.length||w.SheetNames.some(n=>typeof n!=='string'||!Object.hasOwn(w.Sheets,n)))throw Error('Excel工作表结构无效');
  return w;
 }
 function toWave(workbook,{kind,mode='table',sheetName}={}){
  if(!['boolean','analog','packed16'].includes(kind))throw Error('请先明确INPUT信号类型');
  if(!['table','linear'].includes(mode)||mode==='linear'&&kind!=='analog')throw Error('线性插值只适用于模拟量，数字/LP请用分段保持');
  if(!workbook?.SheetNames?.length||!workbook.Sheets)throw Error('Excel工作表结构无效');
  if(sheetName===undefined){if(workbook.SheetNames.length!==1)throw Error('请选择工作表');sheetName=workbook.SheetNames[0];}
  if(!workbook.SheetNames.includes(sheetName))throw Error('所选工作表不存在');const sheet=workbook.Sheets[sheetName];
  if(sheet['!merges']?.length)throw Error('工作表含合并单元格，请取消合并后导入');
  const rows=new Map(),blank=cell=>!cell||!Object.hasOwn(cell,'f')&&!cell.F&&(cell.v===undefined||cell.v===null||cell.v===''||cell.t==='z');
  for(const[key,cell]of Object.entries(sheet)){
   if(!/^[A-Z]+[1-9]\d*$/.test(key)||blank(cell))continue;const pos=X.utils.decode_cell(key);
   if(pos.c>1)throw Error(key+'：只允许两列，第一列时间（秒），第二列值');
   let row=rows.get(pos.r+1);if(!row){row={row:pos.r+1,cells:[]};rows.set(row.row,row);}row.cells[pos.c]=cell;
  }
  const ordered=[...rows.values()].sort((a,b)=>a.row-b.row);if(!ordered.length)throw Error('工作表没有时间/值数据');
  const scalar=(cell,addr)=>{if(blank(cell))throw Error(addr+'：缺少'+(addr[0]==='A'?'时间':'信号值'));if(Object.hasOwn(cell,'f')||cell.F)throw Error(addr+'：公式不能作为波形，请在Excel中复制并粘贴为数值');if(cell.t==='e')throw Error(addr+'：Excel错误单元格不能导入');if(cell.t==='d'||cell.v instanceof Date||cell.t==='n'&&cell.z&&X.SSF.is_date(cell.z))throw Error(addr+'：不接受Excel日期/时间格式，请填写以秒为单位的数值');if(!['s','n','b'].includes(cell.t))throw Error(addr+'：未支持的单元格类型');return cell.v;};
  const first=ordered[0],a=scalar(first.cells[0],'A'+first.row),b=scalar(first.cells[1],'B'+first.row),text=v=>typeof v==='string'?v.trim().toLowerCase().replace(/\s/g,''):'',timeHeaders=new Set(['时间','时间(秒)','时间（秒）','time','time_s','time(s)','t(s)']),valueHeaders=new Set(['值','value','信号值']);
  let header=false;if(timeHeaders.has(text(a))||valueHeaders.has(text(b))){if(!timeHeaders.has(text(a))||!valueHeaders.has(text(b)))throw Error('A'+first.row+'/B'+first.row+'：表头应为“时间（秒）”“值”，时间单位固定为秒');ordered.shift();header=true;}
  if(!ordered.length)throw Error('工作表只有表头，没有波形节点');if(ordered.length>MAX_POINTS)throw Error('最多导入5000个波形节点，文件未采用');
  const numeric=(v,addr)=>{const result=typeof v==='number'?v:typeof v==='string'&&decimal.test(v.trim())?Number(v.trim()):NaN;if(!Number.isFinite(result))throw Error(addr+'：需要有限数值'+(addr[0]==='A'?'，时间单位为秒':''));return result;};
  let last=-1;const points=[];
  for(const r of ordered){const ta='A'+r.row,va='B'+r.row,t=numeric(scalar(r.cells[0],ta),ta),raw=scalar(r.cells[1],va);if(t<0)throw Error(ta+'：时间必须为非负秒数');if(t<=last)throw Error(ta+'：时间必须按行严格递增，不能重复或倒序');last=t;let value;
   if(kind==='boolean'){if(typeof raw==='boolean')value=raw;else if(raw===0||raw===1)value=raw===1;else if(typeof raw==='string'&&/^(true|false|0|1)$/i.test(raw.trim()))value=/^(true|1)$/i.test(raw.trim());else throw Error(va+'：数字量只接受0、1或TRUE/FALSE');}
   else{value=kind==='packed16'&&typeof raw==='string'&&/^0x[\da-f]+$/i.test(raw.trim())?Number(raw.trim()):numeric(raw,va);if(kind==='packed16'&&(!Number.isInteger(value)||value<0||value>65535))throw Error(va+'：LP值须为0～65535整数');}
   try{C.checkWave({mode:'constant',value},kind);}catch(e){throw Error(va+'：'+e.message);}points.push([t,value]);
  }
  const wave={mode,points};C.checkWave(wave,kind);const start=header?first.row:ordered[0].row,ignoredBlankRows=ordered.at(-1).row-start+1-ordered.length-(header?1:0);
  return{wave,sheetName,dataRows:points.length,ignoredBlankRows};
 }
 return{readWorkbook,toWave,MAX_BYTES,MAX_POINTS};
});
