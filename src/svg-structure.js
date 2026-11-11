(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./declared-interfaces'):root.LogicDeclaredInterfaces,node?require('./basic-analog'):root.LogicBasicAnalog,node?require('./elementary'):root.LogicElementary,node?require('./bcd'):root.LogicBCD,node?require('./transport'):root.LogicTransport,node?require('./svg-identity'):root.LogicSVGIdentity);if(node)module.exports=api;else root.LogicSVG=api;})(typeof globalThis!=='undefined'?globalThis:this,function(DI,B,E,BC,TR,I){
 'use strict';
 const identity=()=>[1,0,0,1,0,0];
 function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
 function transformPoint(m,p){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}
 function transformMatrix(text){
  let result=identity(),last=0;const re=/([a-zA-Z]+)\s*\(([^)]*)\)/g;let match;
  while((match=re.exec(text||''))){
   if((text.slice(last,match.index)).replace(/[\s,]/g,''))throw Error('无效变换表达式');last=re.lastIndex;
   const raw=match[2].trim(),ns=raw?raw.split(/[\s,]+/).map(Number):[];
   if(ns.some(n=>!Number.isFinite(n)))throw Error('变换参数不是有限数');let m;
   const [x,y]=ns;
   if(match[1]==='matrix'&&ns.length===6)m=ns;
   else if(match[1]==='translate'&&[1,2].includes(ns.length))m=[1,0,0,1,x,y??0];
   else if(match[1]==='scale'&&[1,2].includes(ns.length))m=[x,0,0,y??x,0,0];
   else if(match[1]==='rotate'&&[1,3].includes(ns.length)){
    const theta=x*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta),rotation=[c,s,-s,c,0,0];
    m=ns.length===1?rotation:multiply(multiply([1,0,0,1,ns[1],ns[2]],rotation),[1,0,0,1,-ns[1],-ns[2]]);
   }else if(match[1]==='skewX'&&ns.length===1)m=[1,0,Math.tan(x*Math.PI/180),1,0,0];
   else if(match[1]==='skewY'&&ns.length===1)m=[1,Math.tan(x*Math.PI/180),0,1,0,0];
   else throw Error('未支持的变换 '+match[1]);
   result=multiply(result,m);if(result.some(v=>!Number.isFinite(v)))throw Error('变换超出有限范围');
  }
  if((text||'').slice(last).replace(/[\s,]/g,''))throw Error('无效变换表达式');return result;
 }
 const cls=e=>e.getAttribute?.('cb-classname');
 const descendants=e=>Array.from(e.getElementsByTagName('*'));
 const semantic=new Set(['ControlAlgorithm','FastBooleanAlgorithm','ExternalPointInterface','ControlMacroReference']);
 const outputPorts=new Set(['OUT','ACT']);
 function ancestor(e,predicate){for(let n=e.parentNode;n?.nodeType===1;n=n.parentNode)if(predicate(n))return n;return null;}
 function analyze(root){
  const els=[root,...descendants(root)],issues=[],connections=[],candidates=[],layouts=Object.create(null),byId=new Map(),matrices=new Map();
  const instances=new Map(els.filter(e=>cls(e)==='SignalConnection').map((e,i)=>[e,'connection-'+(i+1)]));
  const issue=(code,message,e)=>issues.push({code,message,objectId:e?.getAttribute('id')||null,connectionInstanceKey:instances.get(e)||null});
  for(const e of els){const id=e.getAttribute('id');if(id){if(!byId.has(id))byId.set(id,[]);byId.get(id).push(e);}}
  for(const [id,es]of byId)if(es.length>1)issue('SVG_DUPLICATE_ID','SVG 对象ID重复：'+id,es[0]);
  function viewport(e){
   if(e===root||(e.localName||e.tagName)!=='svg')return identity();
   const fail=message=>{const err=Error(message);err.code='SVG_VIEWPORT_UNSUPPORTED';throw err;};
   const length=(key,fallback)=>{const text=e.getAttribute(key)?.trim();if(!text){if(fallback!==undefined)return fallback;return fail('嵌套SVG缺少明确的 '+key);}if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:px)?$/.test(text))return fail('嵌套SVG尚未支持该长度形式：'+key+'='+text);const value=Number(text.replace(/px$/,''));if(!Number.isFinite(value))return fail('嵌套SVG长度无效');return value;};
   const x=length('x',0),y=length('y',0),viewBox=e.getAttribute('viewBox');
   for(const key of ['width','height'])if(e.hasAttribute(key)&&length(key)<=0)fail('非正尺寸视口不可生成几何候选');
   if(!viewBox)return[1,0,0,1,x,y];
   const vb=viewBox.trim().split(/[\s,]+/).map(Number);if(vb.length!==4||vb.some(n=>!Number.isFinite(n))||vb[2]<=0||vb[3]<=0)fail('viewBox 必须包含有效的正尺寸');
   const width=length('width'),height=length('height'),par=e.getAttribute('preserveAspectRatio')||'xMidYMid meet';
   const match=par.trim().match(/^(none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(meet|slice))?$/);if(!match)fail('未支持的 preserveAspectRatio');
   const align=match[1],mode=match[2]||'meet';let sx=width/vb[2],sy=height/vb[3];if(align!=='none')sx=sy=mode==='slice'?Math.max(sx,sy):Math.min(sx,sy);
   let tx=x-vb[0]*sx,ty=y-vb[1]*sy;if(align.includes('xMid'))tx+=(width-vb[2]*sx)/2;if(align.includes('xMax'))tx+=width-vb[2]*sx;if(align.includes('YMid'))ty+=(height-vb[3]*sy)/2;if(align.includes('YMax'))ty+=height-vb[3]*sy;
   return[sx,0,0,sy,tx,ty];
  }
  function world(e){
   if(matrices.has(e))return matrices.get(e);let m=null;
   try{const parent=e.parentNode?.nodeType===1?world(e.parentNode):identity();m=parent?multiply(multiply(parent,transformMatrix(e.getAttribute('transform')||'')),viewport(e)):null;}
   catch(err){issue(err.code||'SVG_TRANSFORM_UNSUPPORTED',err.message,e);}matrices.set(e,m);return m;
  }
  function coordinates(e,x,y){const m=world(e);if(!m)return null;const read=k=>{const v=e.getAttribute(k);return v===''||v===null?0:Number(v);};const px=read(x),py=read(y);if(!Number.isFinite(px)||!Number.isFinite(py)){issue('SVG_COORDINATE_INVALID','无法解析图形坐标',e);return null;}return transformPoint(m,{x:px,y:py});}
  const owners=els.filter(e=>semantic.has(cls(e))),shapes=new Map();
  for(const n of owners){
   const shape=descendants(n).find(e=>['rect','ellipse','circle'].includes(e.localName||e.tagName)&&ancestor(e,p=>semantic.has(cls(p)))===n);
   if(shape){shapes.set(n,shape);const name=shape.localName||shape.tagName,p=coordinates(shape,name==='rect'?'x':'cx',name==='rect'?'y':'cy');if(p)layouts[n.getAttribute('id')]=p;}
  }
  const pins=els.filter(e=>cls(e)==='ControlPin').map(e=>{
   const owner=ancestor(e,n=>semantic.has(cls(n))),name=e.getAttribute('cb-pin-name');
   const type=owner&&cls(owner)!=='ControlMacroReference'?(owner.getAttribute('cb-function-name')||'').toUpperCase():'',declared=DI.pin(type,name)||B.pin(type,name)||E.pin(type,name)||BC.pin(type,name)||TR.pin(type,name),port=DI.get(type)||B.catalog[type]||E.catalog[type]||BC.catalog[type]||TR.catalog[type]?declared?.port||null:/^(IN[1-8]|OUT|ACT|SET|RSET|ENBL|HISP|LOSP|SRST|INIT)$/.test(name||'')?name:null,direction=declared?.direction||(port?(outputPorts.has(port)?'output':'input'):null);
   const line=Array.from(e.childNodes).find(n=>n.nodeType===1&&(n.localName||n.tagName)==='line');
   return{e,id:e.getAttribute('id'),owner:owner?.getAttribute('id'),port,direction,points:line?[coordinates(line,'x1','y1'),coordinates(line,'x2','y2')].filter(Boolean):[]};
  });
  // Advisory layout hypotheses are kept separate from explicit semantic names.
  const suggestions=new Map(),near=(a,b)=>Math.abs(a-b)<=1e-6,unaryLayouts=new Set(['GAINBIAS','ASSIGN','SMOOTH']);
  for(const owner of owners){
   if(cls(owner)==='ControlMacroReference')continue;
   const ownerId=owner.getAttribute('id'),type=(owner.getAttribute('cb-function-name')||'').toUpperCase(),ps=pins.filter(p=>p.owner===ownerId);
   if(byId.get(ownerId)?.length!==1||!ps.length||ps.some(p=>!p.id||byId.get(p.id)?.length!==1||p.points.length!==2||p.points.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y))))continue;
   if(unaryLayouts.has(type)&&ps.some(p=>/^(?:cb-alg-)?(?:TRIN|TOUT)$/i.test((p.e.getAttribute('cb-pin-name')||'').trim())))continue;
   let groups,names,basis='symbol-side-and-vertical-order',profile='cb-symbol-pin-layout-v1';
   if(['INPUT','OUTPUT'].includes(type)&&ps.length===1){groups=type==='INPUT'?[[],ps]:[ps,[]];names=type==='INPUT'?[[],['OUT']]:[['IN1'],[]];basis='single-interface-pin';}
   else{
    const shape=shapes.get(owner),m=shape&&world(shape);if(!m||m[0]<=0||m[3]<=0||!near(m[1],0)||!near(m[2],0))continue;
    const tag=shape.localName||shape.tagName,num=k=>Number(shape.getAttribute(k)),rx=tag==='circle'?num('r'):num('rx'),ry=tag==='circle'?num('r'):num('ry'),x=tag==='rect'?num('x'):num('cx')-rx,y=tag==='rect'?num('y'):num('cy')-ry,w=tag==='rect'?num('width'):2*rx,h=tag==='rect'?num('height'):2*ry;
    if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;const a=transformPoint(m,{x,y}),b=transformPoint(m,{x:x+w,y:y+h}),left=[],right=[],top=[],bottom=[];let valid=true;
    for(const p of ps){const [u,v]=p.points;if(near(u.y,v.y)&&!near(u.x,v.x)&&u.y>=a.y-1e-6&&u.y<=b.y+1e-6){if(near(Math.max(u.x,v.x),a.x))left.push(p);else if(near(Math.min(u.x,v.x),b.x))right.push(p);else{valid=false;break;}}else if(unaryLayouts.has(type)&&near(u.x,v.x)&&!near(u.y,v.y)&&u.x>=a.x-1e-6&&u.x<=b.x+1e-6){if(near(Math.max(u.y,v.y),a.y))top.push(p);else if(near(Math.min(u.y,v.y),b.y))bottom.push(p);else{valid=false;break;}}else{valid=false;break;}}
    if(!valid)continue;
    if(unaryLayouts.has(type)&&tag!=='rect'&&ps.some(p=>{const[u,v]=p.points;return near(u.y,v.y)?!near(u.y,(a.y+b.y)/2):!near(u.x,(a.x+b.x)/2);}))continue;
    for(const side of [left,right])side.sort((a,b)=>a.points[0].y-b.points[0].y);if([left,right].some(side=>side.some((p,i)=>i&&near(p.points[0].y,side[i-1].points[0].y))))continue;
    groups=[left,right];if(['AND','OR'].includes(type)&&left.length>=2&&left.length<=8&&right.length===1)names=[left.map((_,i)=>'IN'+(i+1)),['OUT']];else if(type==='ONDELAY'&&left.length===2&&right.length===1)names=[['IN1','ENBL'],['OUT']];else if(['NOT','OFFDELAY','ONESHOT','HIGHMON','LOWMON'].includes(type)&&left.length===1&&right.length===1)names=[['IN1'],['OUT']];
    if(unaryLayouts.has(type)&&ps.length===2){if(top.length===1&&bottom.length===1){groups=[top,bottom];names=[['IN1'],['OUT']];basis='symbol-top-and-bottom';}else if(left.length===1&&right.length===1){names=[['IN1'],['OUT']];basis='symbol-left-and-right';}if(names)profile='cb-unary-pin-layout-v1';}
    if(type==='PACK16'){
     if(tag!=='rect'||left.length>16||right.length!==1||!near(right[0].points[0].y,(a.y+b.y)/2))continue;
     if(ps.some(p=>!p.port&&/^(?:cb-alg-)?(?:IN\d+|OUT|TRIN|TOUT|ACT|ENBL|SET|RSET|PIN|POUT|PBPT|D\d+)$/i.test((p.e.getAttribute('cb-pin-name')||'').trim())))continue;
     // Supported CB layout hypothesis: 16 bit rows in 17 equal intervals.
     const step=(b.y-a.y)/17,slots=left.map(p=>{const index=Math.round((p.points[0].y-a.y)/step)-1;return index>=0&&index<16&&near(p.points[0].y,a.y+(index+1)*step)?'D'+index:null;});
     const declared=[...new Set(Array.from(owner.attributes||[]).map(at=>at.name.match(/^cb-(?:alg|macro)-d(\d+)$/)?.[1]).filter(k=>k!==undefined).map(k=>'D'+k))];
     if(slots.some(k=>k===null)||new Set(slots).size!==slots.length||declared.length&&(declared.length!==slots.length||declared.some(k=>!slots.includes(k))))continue;
     names=[slots,['POUT']];profile='cb-packed-pin-layout-v1';basis='symbol-seventeen-slot-bit-position';
    }
   }
   if(names&&['AND','OR'].includes(type)){const declared=Array.from(owner.attributes||[]).map(a=>a.name.match(/^cb-alg-in([1-8])$/)?.[1]).filter(Boolean).map(i=>'IN'+i);if(declared.length&&(declared.length!==names[0].length||declared.some(pin=>!names[0].includes(pin))))continue;}
   if(!names||groups.some((group,side)=>group.some((p,i)=>p.port&&p.port!==names[side][i])))continue;
   groups.forEach((group,side)=>group.forEach((p,i)=>suggestions.set(p.id,{pinId:p.id,ownerId,port:names[side][i],direction:side?'output':'input',algorithm:type,profile,basis,order:i+1,observedInputs:groups[0].length,observedOutputs:groups[1].length,requiresReview:true})));
  }
  const hint=(pin,direction)=>{const h=pin&&!pin.port&&suggestions.get(pin.id);return h?.direction===direction?h:undefined;};
  function uniqueId(ref){if(root.getAttribute('cb-key'))return null;const id=(ref||'').match(/^\$([^$]+)\$$/)?.[1];const es=id&&byId.get(id);return es?.length===1?es[0]:null;}
  const coincides=(p,q)=>Math.abs(p.x-q.x)<=1e-6&&Math.abs(p.y-q.y)<=1e-6;
  for(const connection of els.filter(e=>cls(e)==='SignalConnection')){
   const sourcePinElement=ancestor(connection,e=>cls(e)==='ControlPin'),source=pins.find(p=>p.e===sourcePinElement);
   if(!source?.owner){issue('SVG_SOURCE_UNRESOLVED','连接缺少明确的源针脚归属',connection);continue;}
   const referenced=uniqueId(connection.getAttribute('cb-input-pin')),direct=pins.find(p=>p.e===referenced);
   const base={sourceObjectId:source.owner,sourcePort:source.port,destinationObjectId:direct?.owner||null,destinationPort:direct?.port||null,sourcePinId:source.id,destinationPinId:direct?.id||null,connectionId:connection.getAttribute('id'),connectionInstanceKey:instances.get(connection)};
   // Semantic names, explicit references and unambiguous ownership are all required.
   const srcUnambiguous=byId.get(source.id)?.length===1&&byId.get(source.owner)?.length===1;
   if(direct?.owner&&source.direction==='output'&&direct.direction==='input'&&srcUnambiguous&&byId.get(direct.owner)?.length===1){connections.push({...base,evidence:'explicit-pin-reference-and-name'});continue;}
   if(direct?.owner){candidates.push({...base,sourcePortSuggestion:hint(source,'output'),destinationPortSuggestion:hint(direct,'input'),requiresConfirmation:true,evidence:'explicit-reference-port-mapping-required'});issue('SVG_PORT_MAPPING_REQUIRED','针脚名称尚未识别，需要人工端口映射',connection);continue;}
   issue('SVG_REFERENCE_UNRESOLVED','无法唯一解析目标针脚引用：'+connection.getAttribute('cb-input-pin'),connection);
   const line=uniqueId(connection.getAttribute('cb-graphic-line'));
   let lines=line&&(line.localName||line.tagName)==='line'?[line]:[];
   if(!lines.length&&cls(connection.parentNode)==='SignalSegment')lines=Array.from(connection.parentNode.childNodes).filter(n=>n.nodeType===1&&(n.localName||n.tagName)==='line');
   const endpoints=lines.flatMap(l=>[coordinates(l,'x1','y1'),coordinates(l,'x2','y2')]).filter(Boolean);
   for(const target of pins){
    if(!target.owner||target.e===source.e||target.direction==='output')continue;
    if(target.points.some(p=>endpoints.some(q=>coincides(p,q))))candidates.push({...base,destinationObjectId:target.owner,destinationPort:target.port,destinationPinId:target.id,sourcePortSuggestion:hint(source,'output'),destinationPortSuggestion:hint(target,'input'),requiresConfirmation:true,evidence:'coincident-graphic-endpoint-only'});
   }
  }
  const identityIndex=I.index(root),physicalConnections=[];
  function anchor(pin,direction){
   const owner=owners.find(e=>e.getAttribute('id')===pin.owner),shape=owner&&shapes.get(owner),m=shape&&world(shape);if(!shape||!m||!near(m[1],0)||!near(m[2],0))return{side:direction==='input'?'left':'right',fraction:.5};
   const tag=shape.localName||shape.tagName,num=k=>Number(shape.getAttribute(k)),rx=tag==='circle'?num('r'):num('rx'),ry=tag==='circle'?num('r'):num('ry'),x=tag==='rect'?num('x'):num('cx')-rx,y=tag==='rect'?num('y'):num('cy')-ry,w=tag==='rect'?num('width'):2*rx,h=tag==='rect'?num('height'):2*ry;
   const a=transformPoint(m,{x,y}),b=transformPoint(m,{x:x+w,y:y+h});if(w<=0||h<=0)return{side:direction==='input'?'left':'right',fraction:.5};
   const p=pin.points.find(p=>near(p.x,a.x)||near(p.x,b.x)||near(p.y,a.y)||near(p.y,b.y));if(!p)return{side:direction==='input'?'left':'right',fraction:.5};
   const side=near(p.x,a.x)?'left':near(p.x,b.x)?'right':near(p.y,a.y)?'top':'bottom',fraction=['left','right'].includes(side)?(p.y-a.y)/(b.y-a.y):(p.x-a.x)/(b.x-a.x);return{side,fraction:Math.max(0,Math.min(1,fraction))};
  }
  if(identityIndex.key&&!identityIndex.supported)issue('SVG_ID_ENCODING_UNSUPPORTED','尚未验证该 cb-key 的对象编号编码：'+identityIndex.key,root);
  // A connection lives under the SOURCE pin's segment tree. The graphic-line
  // reference selects its terminating segment, NOT every line crossing the route.
  // Plain algorithm-property references independently corroborate the two owners.
  for(const connection of els.filter(e=>cls(e)==='SignalConnection')){
   const source=pins.find(p=>p.e===ancestor(connection,e=>cls(e)==='ControlPin'));
   const graphicId=(connection.getAttribute('cb-graphic-line')||'').match(/^\$([^$]+)\$$/)?.[1],referencedLine=graphicId&&identityIndex.reference(graphicId),lineReferenceResolved=!!referencedLine&&(referencedLine.localName||referencedLine.tagName)==='line'&&referencedLine.parentNode===connection.parentNode;
   const localLines=cls(connection.parentNode)==='SignalSegment'?Array.from(connection.parentNode.childNodes).filter(e=>e.nodeType===1&&(e.localName||e.tagName)==='line'):[];
   const line=lineReferenceResolved?referencedLine:localLines.length===1?localLines[0]:null;
   if(!source?.owner||!line||cls(line.parentNode)!=='SignalSegment')continue;
   const endpoints=[coordinates(line,'x1','y1'),coordinates(line,'x2','y2')].filter(Boolean);
   const targets=pins.filter(p=>p.owner&&p.owner!==source.owner&&p.direction!=='output'&&p.points.some(a=>endpoints.some(b=>coincides(a,b))));
   if(targets.length!==1){if(targets.length>1)issue('SVG_ENDPOINT_AMBIGUOUS','明确线段末端对应多个目标针脚，保留歧义',connection);continue;}
   const target=targets[0],sourceOwner=identityIndex.raw(source.owner),destinationOwner=identityIndex.raw(target.owner),sourceActual=sourceOwner&&identityIndex.actual(sourceOwner);
   if(!sourceOwner||!destinationOwner||byId.get(source.id)?.length!==1||byId.get(target.id)?.length!==1)continue;
   const bindings=Array.from(destinationOwner.attributes||[]).filter(a=>a.name.startsWith('cb-alg-')).map(a=>({attribute:a.name,value:a.value,ref:a.value.match(/^\$([^$]+)\$(cb-alg-[^$]+)\$$/)})).filter(a=>a.ref&&a.ref[1]===sourceActual);
   const refPorts=[...new Set(bindings.map(a=>a.ref[2].slice(7).toUpperCase()))];
   const sourcePort=source.port||(refPorts.length===1?refPorts[0]:hint(source,'output')?.port)||null;
   const ownerType=(destinationOwner.getAttribute('cb-function-name')||'').toUpperCase(),singleOutput=ownerType==='OUTPUT'&&pins.filter(p=>p.owner===target.owner).length===1;
   const semanticName=bindings.length===1?bindings[0].attribute.slice(7):null;
   const declared=semanticName&&(DI.pin(ownerType,semanticName)||B.pin(ownerType,semanticName)||E.pin(ownerType,semanticName)||BC.pin(ownerType,semanticName)||TR.pin(ownerType,semanticName));
   const destinationPort=target.port||(singleOutput?'IN1':declared?.direction==='input'?declared.port:null);
   const corroborated=lineReferenceResolved&&bindings.length>0&&refPorts.length===1&&(!source.port||refPorts[0]===source.port);
   const evidence=corroborated?'property-reference-and-terminating-segment':lineReferenceResolved?'terminating-segment-unique-endpoint':'containing-segment-unique-endpoint';
   const segments=[];for(let n=connection.parentNode;n&&n!==source.e;n=n.parentNode)if(cls(n)==='SignalSegment')for(const l of Array.from(n.childNodes).filter(e=>e.nodeType===1&&(e.localName||e.tagName)==='line')){const points=[coordinates(l,'x1','y1'),coordinates(l,'x2','y2')];if(points.every(Boolean))segments.unshift({id:l.getAttribute('id'),points});}
   const route={sourceObjectId:source.owner,destinationObjectId:target.owner,sourcePinId:source.id,destinationPinId:target.id,sourcePort,destinationPort,connectionId:connection.getAttribute('id'),connectionInstanceKey:instances.get(connection),evidence,corroborated,lineReferenceResolved,graphicLineId:line.getAttribute('id'),actualGraphicLineId:graphicId,sourceActualId:sourceActual,destinationActualId:identityIndex.actual(destinationOwner),bindings:bindings.map(({attribute,value})=>({attribute,value})),segments,sourcePoints:source.points,destinationPoints:target.points,sourceAnchor:anchor(source,'output'),destinationAnchor:anchor(target,'input')};
   physicalConnections.push(route);
   if(!identityIndex.key){for(const c of candidates.filter(c=>c.connectionInstanceKey===route.connectionInstanceKey&&c.destinationPinId===route.destinationPinId))Object.assign(c,{segments:route.segments,sourceAnchor:route.sourceAnchor,destinationAnchor:route.destinationAnchor});continue;} // Preserve ordinary SVG semantic decisions.
   const existing=connections.find(c=>c.connectionInstanceKey===route.connectionInstanceKey);
   if(existing)continue;
   for(let i=candidates.length-1;i>=0;i--)if(candidates[i].connectionInstanceKey===route.connectionInstanceKey)candidates.splice(i,1);
   for(let i=issues.length-1;i>=0;i--)if(issues[i].connectionInstanceKey===route.connectionInstanceKey&&(issues[i].code==='SVG_PORT_MAPPING_REQUIRED'||lineReferenceResolved&&issues[i].code==='SVG_REFERENCE_UNRESOLVED'))issues.splice(i,1);
   if(corroborated&&sourcePort&&destinationPort)connections.push({...route,evidence});
   else{candidates.push({...route,sourcePortSuggestion:hint(source,'output'),destinationPortSuggestion:hint(target,'input'),requiresConfirmation:true});issue('SVG_PORT_MAPPING_REQUIRED',corroborated?'已恢复源/目标和线段，端口编码仍需映射':'已恢复线段，缺少一致的逻辑属性引用；需核对端口',connection);}
  }
  const macroSymbols=[];for(const owner of owners.filter(e=>cls(e)==='ControlMacroReference')){const id=owner.getAttribute('id'),shape=shapes.get(owner);if(!shape)continue;const tag=shape.localName||shape.tagName,num=k=>Number(shape.getAttribute(k)),rx=tag==='circle'?num('r'):num('rx'),ry=tag==='circle'?num('r'):num('ry'),x=tag==='rect'?num('x'):num('cx')-rx,y=tag==='rect'?num('y'):num('cy')-ry,w=tag==='rect'?num('width'):2*rx,h=tag==='rect'?num('height'):2*ry,m=world(shape);if(!m||![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([x,y])=>transformPoint(m,{x,y})),body={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),width:Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height:Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y)),shape:tag};
   const distance=p=>Math.hypot(Math.max(body.x-p.x,0,p.x-body.x-body.width),Math.max(body.y-p.y,0,p.y-body.y-body.height));
   macroSymbols.push({objectId:id,body,pins:pins.filter(p=>p.owner===id).map(pin=>{if(pin.points.length!==2)return{id:pin.id,direction:null,points:pin.points,evidence:'missing-pin-line'};const [a,b]=pin.points,da=distance(a),db=distance(b),attach=da<db?a:db<da?b:null,terminal=attach===a?b:attach===b?a:null,routes=physicalConnections.filter(r=>r.corroborated),input=routes.some(r=>r.destinationPinId===pin.id),output=routes.some(r=>r.sourcePinId===pin.id);if(input&&output)return{id:pin.id,direction:null,points:pin.points,evidence:'conflicting-pin-roles'};let direction=input!==output?(input?'input':'output'):null,evidence=direction?'serialized-connection-role':null;
    if(!direction&&attach){const polygon=Array.from(pin.e.childNodes).find(e=>e.nodeType===1&&(e.localName||e.tagName)==='polygon'),pm=polygon&&world(polygon),raw=(polygon?.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number),ps=pm&&raw.length===6&&raw.every(Number.isFinite)?[0,2,4].map(i=>transformPoint(pm,{x:raw[i],y:raw[i+1]})):[];if(ps.some(p=>near(p.x,attach.x)&&near(p.y,attach.y))){direction='input';evidence='pin-arrow-into-body';}else if(ps.some(p=>near(p.x,terminal.x)&&near(p.y,terminal.y))){direction='output';evidence='pin-arrow-out-of-body';}else if(!polygon){direction=attach===a?'output':'input';evidence='serialized-pin-line-direction';}}
    const dx=attach&&terminal?terminal.x-attach.x:0,dy=attach&&terminal?terminal.y-attach.y:0,side=Math.abs(dx)>=Math.abs(dy)?dx<0?'left':'right':dy<0?'top':'bottom';return{id:pin.id,direction,evidence,attach,terminal,side,points:pin.points};})});
  }
  return{layouts,connections,candidates,physicalConnections,macroSymbols,identity:{key:identityIndex.key,profile:identityIndex.profile,objects:owners.map(e=>({id:e.getAttribute('id'),actualId:identityIndex.actual(e)}))},issues,pins:pins.map(({e,...p})=>p),pinSuggestions:[...suggestions.values()]};
 }
 return{analyze,transformMatrix,transformPoint};
});
