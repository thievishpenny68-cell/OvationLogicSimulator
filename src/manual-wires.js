(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicManualWires=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const same=(a,b)=>Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7,point=p=>({x:p.x,y:p.y}),valid=r=>r?.mode==='manual'&&Array.isArray(r.points)&&r.points.length>=2&&r.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 function nearest(p,segments){let best=null;for(const segment of segments){const{a,b}=segment,q=a.x===b.x?{x:a.x,y:Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),p.y))}:{x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),p.x)),y:a.y},distance=Math.hypot(q.x-p.x,q.y-p.y);if(!best||distance<best.distance)best={point:q,segment,distance};}return best;}
 function polyline(points,axis='h',endAxis=null){const out=[];const add=p=>{if(out.length&&same(out.at(-1),p))return;while(out.length>1){const a=out.at(-2),b=out.at(-1);if((a.x===b.x&&b.x===p.x||a.y===b.y&&b.y===p.y)&&((b.x-a.x)*(p.x-b.x)+(b.y-a.y)*(p.y-b.y)>0))out.pop();else break;}out.push(point(p));};for(let i=0;i<points.length;i++){const p=points[i],last=out.at(-1);if(last&&last.x!==p.x&&last.y!==p.y){const first=i===points.length-1&&endAxis?(endAxis==='h'?'v':'h'):axis;add(first==='h'?{x:p.x,y:last.y}:{x:last.x,y:p.y});}const before=out.at(-1);add(p);if(before&&!same(before,p))axis=before.x===p.x?'h':'v';}return out;}
 function resolve(start,end,routing){return polyline([start,...routing.points.slice(1,-1),end],start.ny?'v':'h',end.ny?'v':'h');}
 const path=points=>points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
 return{valid,nearest,polyline,resolve,path};
});
