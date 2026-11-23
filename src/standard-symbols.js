(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./standard-symbol-data'):root.LogicStandardSymbolData);
 if(node)module.exports=api;else root.LogicStandardSymbols=api;
})(globalThis,function(data){
 'use strict';

 const gate=type=>type==='AND'||type==='OR';
 const adjustable=(type,dir,name)=>
  type==='TRNSFINDX'&&dir==='outputs'&&/^O\d+$/.test(name)||
  ['DIGCOUNT','SELECTOR'].includes(type)&&dir==='inputs'&&/^IN\d+$/.test(name);
 const group=dir=>dir==='i'?'inputs':'outputs';
 const direction=(dx,dy)=>Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'top':'bottom');
 const sideLabels={left:'左',right:'右',top:'上',bottom:'下'};
 const entries=Object.fromEntries(Object.entries(data).map(([type,rows])=>[type,rows.map(([ids,outlines,strokes,marks,pins])=>{
  const names={inputs:new Set(),outputs:new Set()};
  for(const [name,dir] of pins)names[group(dir)].add(name);
  return{ids,outlines,strokes,marks,pins,names};
 })]));

 function variants(n){
  if(n.macroReference||!Object.hasOwn(entries,n.type))return[];
  const layouts=entries[n.type];
  return layouts.map(({ids,pins,names})=>{
   const main=pins.find(([name,dir])=>dir==='o'&&name==='OUT')||pins.find(([,dir])=>dir==='o');
   const side=main&&sideLabels[direction(main[4]-main[2],main[5]-main[3])];
   const outputs=[...names.outputs];
   const distinguish=outputs.length<=3&&layouts.some(v=>v.names.outputs.size!==outputs.length||outputs.some(name=>!v.names.outputs.has(name)));
   const shown=distinguish?' · '+outputs.join('、'):'';
   return [ids[0],names.inputs.size+' 入 / '+names.outputs.size+' 出'+shown+(side?' · '+side+'侧出线':'')+' · '+ids[0]];
  });
 }

 function select(n,ps,profile){
  const options=Object.hasOwn(entries,n.type)&&entries[n.type];
  if(!options?.length)return null;
  const requested=options.find(v=>v.ids.includes(n.symbolVariant));
  if(requested)return requested;
  const sides=new Map(profile.pins.map(p=>[p.name,p.side]));
  let best=options[0],bestScore=Infinity,bestSideChanges=Infinity;
  for(const v of options){
   let missing=0,extra=0;
   for(const dir of ['inputs','outputs']){
    if(gate(n.type)&&dir==='inputs'){
     const diff=v.names.inputs.size-Object.keys(ps.inputs).length;
     missing+=Math.max(0,-diff);
     extra+=Math.max(0,diff);
     continue;
    }
    for(const name of Object.keys(ps[dir]))if(!v.names[dir].has(name))missing++;
    for(const name of v.names[dir])if(!Object.hasOwn(ps[dir],name))extra++;
   }
   const score=missing*100+extra;
   const sideChanges=v.pins.filter(([name,dir,ax,ay,tx,ty])=>Object.hasOwn(ps[group(dir)],name)&&sides.get(name)!==direction(tx-ax,ty-ay)).length;
   if(score<bestScore||score===bestScore&&sideChanges<bestSideChanges){best=v;bestScore=score;bestSideChanges=sideChanges;}
  }
  return best;
 }

 function rectangle({x,y,width,height}){return{tag:'rect',attrs:{x,y,width,height}};}
 function geometry(n,ps,profile){
  const v=select(n,ps,profile);
  if(!v)return null;

  const {outlines,strokes,marks}=v, [tag,...bodyCoords]=outlines[0];
  const [left,top,w,h]=tag==='r'?bodyCoords:tag==='e'?
   [bodyCoords[0]-bodyCoords[2],bodyCoords[1]-bodyCoords[3],bodyCoords[2]*2,bodyCoords[3]*2]:
   [0,0,Math.max(...bodyCoords.filter((_,i)=>i%2===0)),Math.max(...bodyCoords.filter((_,i)=>i%2===1))];
  const resize=n.type==='TRNSFINDX'||n.type==='DIGCOUNT';
  const bodyH=n.type==='TRNSFINDX'?Math.max(100,20*Math.min(v.names.outputs.size,Object.keys(ps.outputs).length)):
   n.type==='DIGCOUNT'?Math.max(108,20*Object.keys(ps.inputs).length+20):h;
  const scaleY=y=>y*bodyH/h;
  const bounds={left,top,right:left+w,bottom:top+bodyH};
  function include(x,y,padX=0,padY=0){
   bounds.left=Math.min(bounds.left,x-padX);
   bounds.right=Math.max(bounds.right,x+padX);
   bounds.top=Math.min(bounds.top,y-padY);
   bounds.bottom=Math.max(bounds.bottom,y+padY);
  }

  const ports={inputs:{},outputs:{}},inactivePins=[],leaders=[],drawnMarks=[];
  function mark(text,x,y,size,start){
   const halfWidth=text.length*size*.28;
   include(x+(start?halfWidth:0),y,halfWidth,size*.55);
   drawnMarks.push({text,x,y,size,anchor:start?'start':'middle'});
  }
  function pin(name,dir,ax,ay,tx,ty,printed,additional=false){
   const side=direction(tx-ax,ty-ay),nx=side==='right'?1:side==='left'?-1:0,ny=side==='bottom'?1:side==='top'?-1:0;
   const portGroup=group(dir),active=Object.hasOwn(ps[portGroup],name),kind=active?ps[portGroup][name]:'unknown';
   const status=active?'active':profile.pins.some(p=>p.name===name&&p.software==='parameter')?'parameter':'unsupported';
   const text=printed||name;
   const label=nx?
    {x:ax+nx*6,y:ty-11,anchor:nx<0?'end':'start',text}:
    {x:tx+10,y:ay+ny*8,anchor:ny<0?'start':'end',rotation:-90,text};
   const offset=text.length*3;
   include(nx?label.x+nx*offset:label.x,ny?label.y+ny*offset:label.y,nx?offset:6,ny?offset:6);
   include(tx,ty,6,6);
   include(ax,ay);
   const port={name,x:tx,y:ty,nx,ny,side,label,kind,...(additional?{additional:true}:{})};
   if(active)ports[portGroup][name]=port;else inactivePins.push({...port,status});
   const attach={x:ax,y:ay},terminal={x:tx,y:ty};
   leaders.push({name,direction:dir==='i'?'input':'output',active,status,kind:kind==='boolean'?'digital':kind,
    arrow:dir==='i',points:[attach,terminal],arrowAt:attach,arrowFrom:terminal,label});
  }

  const gateNames=gate(n.type)&&v.names.inputs.size===Object.keys(ps.inputs).length?Object.keys(ps.inputs):null;
  let gateIndex=0;
  for(const [refName,dir,ax,ay,tx,ty,printed] of v.pins){
   const name=gateNames&&dir==='i'?gateNames[gateIndex++]:refName,portGroup=group(dir);
   const numbered=adjustable(n.type,portGroup,name);
   if(numbered&&!Object.hasOwn(ps[portGroup],name))continue;
   const y=resize&&!numbered?scaleY(ay):ay;
   pin(name,dir,ax,y,tx,y+ty-ay,printed);
  }

  const drawnStrokes=strokes.map(([x1,y1,x2,y2])=>{
   include(x1,y1);
   include(x2,y2);
   return[{x:x1,y:y1},{x:x2,y:y2}];
  });
  for(const [text,x,y,size,start] of marks)mark(text,x,scaleY(y),size,start);

  const missing=Object.fromEntries(Object.entries(ps).map(([dir,values])=>[dir,Object.keys(values).filter(name=>!Object.hasOwn(ports[dir],name))]));
  if(missing.inputs.length||missing.outputs.length){
   const y=bounds.bottom+18;
   mark('补充端口',left+w/2,y,11,false);
   for(const [dir,names] of Object.entries(missing)){
    const input=dir==='inputs',x=input?left:left+w,step=input?-1:1;
    names.forEach((name,index)=>pin(name,input?'i':'o',x,y+24+index*20,x+step*20,y+24+index*20,null,true));
   }
  }

  const dx=12-bounds.left,dy=32-bounds.top,move=({x,y,...extras})=>({...extras,x:x+dx,y:y+dy});
  for(const p of [...Object.values(ports.inputs),...Object.values(ports.outputs),...inactivePins]){
   p.x+=dx;
   p.y+=dy;
   // Leaders share the label with each pin.
   p.label.x+=dx;
   p.label.y+=dy;
  }
  for(const l of leaders){
   l.points=l.points.map(move);
   l.arrowAt=move(l.arrowAt);
   l.arrowFrom=move(l.arrowFrom);
  }
  const drawnOutlines=outlines.map(([kind,x,y,a,b,...rest],index)=>{
   if(kind==='r')return rectangle({x:x+dx,y:y+dy,width:a,height:resize?bodyH:b});
   const attrs=index?{fill:'none'}:{};
   if(kind==='e')return{tag:'ellipse',attrs:{...attrs,cx:x+dx,cy:y+dy,rx:a,ry:b}};
   const coords=[x,y,a,b,...rest],points=[];
   for(let i=0;i<coords.length;i+=2)points.push((coords[i]+dx)+','+(coords[i+1]+dy));
   return{tag:'polygon',attrs:{...attrs,points:points.join(' ')}};
  });
  return{
   manual:true,shape:tag==='r'?'rectangle':tag==='e'?'ellipse':'diamond',
   width:Math.max(158,Math.ceil(bounds.right-bounds.left+24)),height:Math.ceil(bounds.bottom-bounds.top+78),
   body:{x:left+dx,y:top+dy,width:w,height:bodyH},outlines:drawnOutlines,marks:drawnMarks.map(move),
   strokes:drawnStrokes.map(line=>line.map(move)),ports,inactivePins,leaders,
   source:{document:'Ovation Symbols',collection:'Symbols',page:profile.page,variant:v.ids.includes(n.symbolVariant)?n.symbolVariant:v.ids[0]}
  };
 }

 return{geometry,variants};
});
