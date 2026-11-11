(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicParameterDefaults=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // REF_1100 parameter tables, audited separately in docs/reference/manual-parameter-defaults.md.
 // These are import defaults; the editor's runnable examples remain separate.
 const definitions={
 "AND":{"file":"REF_1100 §4.7","section":"4.7","parameters":{}},
 "OR":{"file":"REF_1100 §4.70","section":"4.70","parameters":{}},
 "NOT":{"file":"REF_1100 §4.66","section":"4.66","parameters":{}},
 "XOR":{"file":"REF_1100 §4.127","section":"4.127","parameters":{}},
 "FLIPFLOP":{"file":"REF_1100 §4.40","section":"4.40","parameters":{"TYPE":[0,1,168]}},
 "AAFLIPFLOP":{"file":"REF_1100 §4.2","section":"4.2","parameters":{}},
 "PULSECNT":{"file":"REF_1100 §4.79","section":"4.79","parameters":{}},
 "HIGHMON":{"file":"REF_1100 §4.46","section":"4.46","parameters":{"HISP":[0,1,187],"HIDB":[0,1,187]}},
 "LOWMON":{"file":"REF_1100 §4.59","section":"4.59","parameters":{"LOSP":[0,1,219],"LODB":[0,1,219]}},
 "ABSVALUE":{"file":"REF_1100 §4.3","section":"4.3","parameters":{}},
 "GAINBIAS":{"file":"REF_1100 §4.42","section":"4.42","parameters":{"GAIN":[1,3,176],"BIAS":[0,3,176],"BTSC":[0,3,176],"TPSC":[100,3,176],"TRAT":[2.5,3,176],"PROQ":[1,3,176]}},
 "ONDELAY":{"file":"REF_1100 §4.68","section":"4.68","parameters":{"BASE":[1,2,257],"TARG":[0,2,257]}},
 "OFFDELAY":{"file":"REF_1100 §4.67","section":"4.67","parameters":{"BASE":[1,2,255],"TARG":[0,2,255]}},
 "ONESHOT":{"file":"REF_1100 §4.69","section":"4.69","parameters":{"BASE":[1,2,259],"TARG":[0,2,259]}},
 "DBEQUALS":{"file":"REF_1100 §4.25","section":"4.25","parameters":{"DBND":[0,1,81],"RTRN":[0,1,81]}},
 "SUM":{"file":"REF_1100 §4.112","section":"4.112","parameters":{"IN1G":[1,2,397],"IN1B":[0,2,397],"IN2G":[1,2,397],"IN2B":[0,2,397],"IN3G":[1,3,398],"IN3B":[0,3,398],"IN4G":[1,3,398],"IN4B":[0,3,398],"TPSC":[100,3,398],"BTSC":[0,3,398],"TRAT":[2.5,3,398]}},
 "MULTIPLY":{"file":"REF_1100 §4.64","section":"4.64","parameters":{"IN1G":[1,2,250],"IN1B":[0,2,250],"IN2G":[1,2,250],"IN2B":[0,2,250],"TPSC":[100,2,250],"BTSC":[0,2,250],"TRAT":[2.5,2,250]}},
 "DIVIDE":{"file":"REF_1100 §4.33","section":"4.33","parameters":{"NUMG":[1,2,152],"NUMB":[0,2,152],"DENG":[1,2,152],"DENB":[0,2,152],"TPSC":[100,2,152],"BTSC":[0,2,152],"TRAT":[2.5,2,152]}},
 "HISELECT":{"file":"REF_1100 §4.47","section":"4.47","parameters":{"IN1G":[1,3,190],"IN1B":[0,3,190],"IN2G":[1,3,190],"IN2B":[0,3,190],"TPSC":[100,3,190],"BTSC":[0,3,190],"TRAT":[2.5,3,190],"QUAL":["WORSE",4,191]}},
 "LOSELECT":{"file":"REF_1100 §4.58","section":"4.58","parameters":{"IN1G":[1,3,216],"IN1B":[0,3,216],"IN2G":[1,3,216],"IN2B":[0,3,216],"TPSC":[100,3,216],"BTSC":[0,3,216],"TRAT":[2.5,3,216],"QUAL":["WORSE",4,217]}},
 "COMPARE":{"file":"REF_1100 §4.22","section":"4.22","parameters":{}},
 "SELECTOR":{"file":"REF_1100 §4.93","section":"4.93","parameters":{"NMIN":[0,2,333]}},
 "COUNTER":{"file":"REF_1100 §4.24","section":"4.24","parameters":{"DRCT":[0,1,79],"TARG":[0,1,79]}},
 "DIGCOUNT":{"file":"REF_1100 §4.30","section":"4.30","parameters":{"NMIN":[0,1,125],"MTRU":[0,1,125]}},
 "HIGHLOWMON":{"file":"REF_1100 §4.45","section":"4.45","parameters":{"HISP":[0,1,186],"HIDB":[0,1,186],"LOSP":[0,1,186],"LODB":[0,1,186]}},
 "RESETSUM":{"file":"REF_1100 §4.85","section":"4.85","parameters":{"RCNT":[0,2,308],"GAIN":[1,2,308],"TRST":[0,2,308]}},
 "TRANSFER":{"file":"REF_1100 §4.118","section":"4.118","parameters":{"IN1G":[1,2,408],"IN1B":[0,3,409],"IN2G":[1,3,409],"IN2B":[0,3,409],"TPSC":[100,3,409],"BTSC":[-100,3,409],"SLEW":["OFF",3,409],"OTRK":["ON",3,409],"TRR1":[2.5,3,409],"TRR2":[2.5,3,409]}},
 "SQUAREROOT":{"file":"REF_1100 §4.106","section":"4.106","parameters":{"IN1G":[1,2,366],"IN1B":[0,2,366],"TPSC":[100,2,366],"BTSC":[0,2,366],"TRAT":[2.5,2,366]}},
 "LOG":{"file":"REF_1100 §4.57","section":"4.57","parameters":{"BIAS":[0,1,213]}},
 "NLOG":{"file":"REF_1100 §4.65","section":"4.65","parameters":{"BIAS":[0,1,252]}},
 "ARCCOSINE":{"file":"REF_1100 §4.10","section":"4.10","parameters":{}},
 "ARCSINE":{"file":"REF_1100 §4.11","section":"4.11","parameters":{}},
 "ARCTANGENT":{"file":"REF_1100 §4.12","section":"4.12","parameters":{}},
 "COSINE":{"file":"REF_1100 §4.23","section":"4.23","parameters":{}},
 "SINE":{"file":"REF_1100 §4.96","section":"4.96","parameters":{}},
 "TANGENT":{"file":"REF_1100 §4.114","section":"4.114","parameters":{}},
 "POLYNOMIAL":{"file":"REF_1100 §4.75","section":"4.75","parameters":{"CX0":[0,1,288],"CX1":[0,1,288],"CX2":[0,1,288],"CX3":[0,1,288],"CX4":[0,1,288],"CX5":[0,2,289]}},
 "ASSIGN":{"file":"REF_1100 §4.13","section":"4.13","parameters":{}},
 "INTERP":{"file":"REF_1100 §4.52","section":"4.52","parameters":{"TYPE":["LINEAR",3,199],"NUMR":[0,3,199],"X1":[0,3,199],"X2":[0,3,199],"X3":[0,3,199],"X4":[0,3,199],"X5":[0,3,199],"X6":[0,3,199],"X7":[0,3,199],"X8":[0,3,199],"X9":[0,3,199],"X10":[0,3,199],"TPSC":[100,3,199],"BTSC":[0,3,199]}},
 "TRANSLATOR":{"file":"REF_1100 §4.119","section":"4.119","parameters":{"I01":[0,2,412],"I02":[0,2,412],"I03":[0,2,412],"I04":[0,2,412],"I05":[0,2,412],"I06":[0,2,412],"I07":[0,2,412],"I08":[0,2,412],"I09":[0,2,412],"I10":[0,2,412],"I11":[0,2,412],"I12":[0,2,412],"I13":[0,2,412],"I14":[0,2,412],"I15":[0,2,412],"I16":[0,2,412],"I17":[0,2,412],"I18":[0,3,413],"I19":[0,3,413],"I20":[0,3,413],"I21":[0,3,413],"I22":[0,3,413],"I23":[0,3,413],"I24":[0,3,413],"I25":[0,3,413],"I26":[0,3,413],"I27":[0,3,413],"I28":[0,3,413],"I29":[0,3,413],"I30":[0,3,413],"I31":[0,3,413],"I32":[0,3,413],"I33":[0,3,413],"I34":[0,3,413],"I35":[0,3,413],"I36":[0,3,413],"I37":[0,3,413],"I38":[0,4,414],"I39":[0,4,414],"I40":[0,4,414],"I41":[0,4,414],"I42":[0,4,414],"I43":[0,4,414],"I44":[0,4,414],"I45":[0,4,414],"I46":[0,4,414],"I47":[0,4,414],"I48":[0,4,414],"I49":[0,4,414],"I50":[0,4,414]}},
 "AVALGEN":{"file":"REF_1100 §4.15","section":"4.15","parameters":{"VALU":[0,1,47]}},
 "DVALGEN":{"file":"REF_1100 §4.36","section":"4.36","parameters":{"VALU":[1,1,158]}},
 "TRNSFINDX":{"file":"REF_1100 §4.121","section":"4.121","parameters":{"NMIN":[1,1,417]}},
 "QAVERAGE":{"file":"REF_1100 §4.80","section":"4.80","parameters":{}},
 "SMOOTH":{"file":"REF_1100 §4.104","section":"4.104","parameters":{"SMTH":[0,1,363]}},
 "FUNCTION":{"file":"REF_1100 §4.41","section":"4.41","parameters":{"GAIN":[1,3,172],"BIAS":[0,3,172],"TPSC":[100,3,172],"BTSC":[0,3,172],"TRAT":[2.5,3,172],"BPTS":[2,3,172],"X1":[-100,3,172],"Y1":[-100,3,172],"X2":[100,3,172],"Y2":[100,3,172],"X3":[0,3,172],"Y3":[0,3,172],"X4":[0,3,172],"Y4":[0,3,172],"X5":[0,3,172],"Y5":[0,3,172],"X6":[0,3,172],"Y6":[0,3,172],"X7":[0,4,173],"Y7":[0,4,173],"X8":[0,4,173],"Y8":[0,4,173],"X9":[0,4,173],"Y9":[0,4,173],"X10":[0,4,173],"Y10":[0,4,173],"X11":[0,4,173],"Y11":[0,4,173],"X12":[0,4,173],"Y12":[0,4,173]}},
 "PACK16":{"file":"REF_1100 §4.71","section":"4.71","parameters":{}},
 "UNPACK16":{"file":"REF_1100 §4.124","section":"4.124","parameters":{}},
 "FIRSTOUT":{"file":"REF_1100 §4.39","section":"4.39","parameters":{"MCFG":[0,4,166]}},
 "BCDNIN":{"file":"REF_1100 §4.17","section":"4.17","parameters":{"NDIG":[1,1,53],"CNTL":[0,2,54]}},
 "BCDNOUT":{"file":"REF_1100 §4.18","section":"4.18","parameters":{"BITP":[0,1,56],"NDIG":[1,1,56],"CNTL":[0,2,57]}},
 "TRANSPORT":{"file":"REF_1100 §4.120","section":"4.120","parameters":{"TSAM":[0,1,415],"NSAM":[0,1,415],"INIT":[2,2,416]}}
 };
 function apply(node,{attributes=[],records=[],fields={},aliases={},blocked=false}={}){
  const d=definitions[node.type],adopted=[];if(!d||node.macroReference||blocked)return adopted;
  for(const[key,[value,pdfPage,manualPage]]of Object.entries(d.parameters)){
   if(Object.hasOwn(node.params,key))continue;
   const field=fields[key];if(field!=null&&records.some(r=>r.field===field))continue;
   const names=[key,...Object.entries(aliases).filter(([,canonical])=>canonical===key).map(([alias])=>alias)].map(k=>k.toLowerCase());
   if(attributes.some(at=>names.some(name=>['cb-alg-','cb-macro-'].some(prefix=>Object.hasOwn(at,prefix+name)))))continue;
   const source={kind:'manual-default',algorithmType:node.type,value,reference:'REF_1100 §'+d.section+' p'+manualPage,manualFile:d.file,pdfPage,manualPage};
   node.params[key]=value;node.provenance.parameterSources[key]=source;adopted.push({nodeId:node.id,parameter:key,...source});
  }return adopted;
 }
 return{apply};
});
