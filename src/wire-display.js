(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicWireDisplay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function analog(value){
  if(Object.is(value,-0))return'-0';const rounded=Number(value.toPrecision(6)),magnitude=Math.abs(rounded);
  if(magnitude&&(magnitude>=1e6||magnitude<1e-3)){const [mantissa,exponent]=rounded.toExponential(5).split('e');return mantissa.replace(/\.?0+$/,'')+'e'+exponent;}
  return String(rounded);
 }
 function describe(kind,value){
  if(kind==='packed16'&&Number.isInteger(value)&&value>=0&&value<=65535)return{text:'0x'+value.toString(16).toUpperCase().padStart(4,'0'),state:'value',full:value+' / 0x'+value.toString(16).toUpperCase().padStart(4,'0')+' / '+value.toString(2).padStart(16,'0')};
  if(kind==='boolean'&&typeof value==='boolean')return{text:value?'SET':'RESET',state:value?'set':'reset',full:value?'TRUE':'FALSE'};
  if(kind==='analog'&&typeof value==='number'&&Number.isFinite(value))return{text:analog(value),state:'value',full:Object.is(value,-0)?'-0':String(value)};
  return{text:'—',state:'unavailable',full:'无已记录的有效值'};
 }
 const same=(a,b)=>Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8;
 function simplify(points){const out=[];for(const p of points){if(out.length&&same(out.at(-1),p))continue;while(out.length>1){const a=out.at(-2),b=out.at(-1),aligned=Math.abs(a.x-b.x)<1e-8&&Math.abs(b.x-p.x)<1e-8||Math.abs(a.y-b.y)<1e-8&&Math.abs(b.y-p.y)<1e-8,forward=(b.x-a.x)*(p.x-b.x)+(b.y-a.y)*(p.y-b.y)>0;if(!aligned||!forward)break;out.pop();}out.push({x:p.x,y:p.y});}return out;}
 function intersects(a,b,r){return a.y===b.y?a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width:a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height;}
 function overlap(a,b,c,d){if(a.y===b.y&&c.y===d.y&&a.y===c.y)return Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));if(a.x===b.x&&c.x===d.x&&a.x===c.x)return Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)));return 0;}
 function pathLabel(points,index=1){const lengths=points.slice(1).map((p,i)=>Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)),total=lengths.reduce((a,b)=>a+b,0),fraction=[.38,.5,.62][Math.abs(index)%3];let remaining=total*fraction;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const t=lengths[i]?remaining/lengths[i]:0;return{x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}remaining-=lengths[i];}return points[0]||{x:0,y:0};}
 function orthogonalRoute(a,b,k=60,options={}){
  const lead=Math.max(18,Math.min(36,Math.abs(k)*.4)),start={x:a.x+(a.nx??1)*lead,y:a.y+(a.ny??0)*lead},end={x:b.x+(b.nx??-1)*lead,y:b.y+(b.ny??0)*lead},margin=8,boxes=(options.obstacles||[]).filter(r=>[r.x,r.y,r.width,r.height].every(Number.isFinite)).map(r=>({...r,x:r.x-margin,y:r.y-margin,width:r.width+margin*2,height:r.height+margin*2}));
  const lane=((options.index||0)%7-3)*10,mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
  const nearest=(values,center)=>[...new Set(values)].sort((a,b)=>Math.abs(a-center)-Math.abs(b-center)).slice(0,12),xs=nearest([mx,mx+lane,Math.min(start.x,end.x)-lead,Math.max(start.x,end.x)+lead,...boxes.flatMap(r=>[r.x-lead,r.x+r.width+lead])],mx),ys=nearest([my,my+lane,Math.min(start.y,end.y)-lead,Math.max(start.y,end.y)+lead,...boxes.flatMap(r=>[r.y-lead,r.y+r.height+lead])],my),candidates=[];
  const add=middle=>candidates.push(simplify([a,start,...middle,end,b]));
  if((a.y===b.y&&Math.sign(b.x-a.x)===(a.nx??1)&&Math.sign(a.x-b.x)===(b.nx??-1))||(a.x===b.x&&Math.sign(b.y-a.y)===(a.ny??0)&&Math.sign(a.y-b.y)===(b.ny??0)))candidates.push(simplify([a,b]));
  add([{x:end.x,y:start.y}]);add([{x:start.x,y:end.y}]);for(const x of xs)add([{x,y:start.y},{x,y:end.y}]);for(const y of ys)add([{x:start.x,y},{x:end.x,y}]);
  // Explicit outer channels handle feedback and rows of intervening modules.
  if(boxes.length){const top=Math.min(start.y,end.y,...boxes.map(r=>r.y))-lead,bottom=Math.max(start.y,end.y,...boxes.map(r=>r.y+r.height))+lead;for(const y of [top,bottom])add([{x:start.x,y},{x:end.x,y}]);}
  function score(points){let cost=(points.length-2)*18;for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];cost+=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);for(const r of boxes){if(i===1&&r.id===options.fromId||i===points.length-1&&r.id===options.toId)continue;if(intersects(p,q,r))cost+=1e7;}
    for(const used of (options.occupied||[]).slice(-64)){if(used.source===options.source)continue;for(let j=1;j<used.points.length;j++)cost+=overlap(p,q,used.points[j-1],used.points[j])*100;}
    if(i>1){const prev=points[i-2];if((p.x-prev.x)*(q.x-p.x)+(p.y-prev.y)*(q.y-p.y)<0)cost+=1e6;}}
   return cost;}
  let points=candidates[0],best=Infinity;for(const candidate of candidates){const value=score(candidate);if(value<best){best=value;points=candidate;}}
  return{points,path:points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' '),label:pathLabel(points,options.index??1),cost:best};
 }
 // Kept as an API alias for saved integrations; paths now contain straight segments only.
 function curvePath(a,b,k){return orthogonalRoute(a,b,k).path;}
 function labelPoint(a,b,k,index){return orthogonalRoute(a,b,k,{index}).label;}
 return{describe,labelPoint,curvePath,orthogonalRoute};
});
