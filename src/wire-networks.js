(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./wire-display'):root.LogicWireDisplay,node?require('./manual-wires'):root.LogicManualWires);if(node)module.exports=api;else root.LogicWireNetworks=api;})(typeof globalThis!=='undefined'?globalThis:this,function(W,MW){
 'use strict';
 const eps=1e-7,near=(a,b)=>Math.abs(a-b)<eps,key=p=>Math.round(p.x/eps)+','+Math.round(p.y/eps),length=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),same=(a,b)=>near(a.x,b.x)&&near(a.y,b.y);
 const path=ps=>ps.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
 function on(p,a,b){return(near(a.x,b.x)&&near(p.x,a.x)&&p.y>=Math.min(a.y,b.y)-eps&&p.y<=Math.max(a.y,b.y)+eps)||(near(a.y,b.y)&&near(p.y,a.y)&&p.x>=Math.min(a.x,b.x)-eps&&p.x<=Math.max(a.x,b.x)+eps);}
 function crossings(a,b,c,d){const result=[];if(near(a.y,b.y)&&near(c.x,d.x)){const p={x:c.x,y:a.y};if(on(p,a,b)&&on(p,c,d))result.push(p);}else if(near(a.x,b.x)&&near(c.y,d.y)){const p={x:a.x,y:c.y};if(on(p,a,b)&&on(p,c,d))result.push(p);}else for(const p of [a,b,c,d])if(on(p,a,b)&&on(p,c,d)&&!result.some(q=>same(p,q)))result.push(p);return result;}
 function parts(points){return points.slice(1).map((b,i)=>({a:points[i],b})).filter(s=>!same(s.a,s.b));}
 function clipToTree(points,tree){let best=-1,cut=null,index=0,offset=0;for(let i=1;i<points.length;i++){for(const s of tree)for(const p of crossings(points[i-1],points[i],s.a,s.b)){const at=offset+length(points[i-1],p);if(at>best+eps){best=at;cut=p;index=i;}}offset+=length(points[i-1],points[i]);}return cut?[cut,...points.slice(index)].filter((p,i,ps)=>!i||!same(p,ps[i-1])):points;}
 function branch(source,target,tree,options={}){
  if(!tree.length){const r=W.orthogonalRoute(source,target.point,45,{...options,toId:target.toId});return{...r,attachment:source};}
    let best=null;const anchors=new Map();const add=(p,tangent)=>{const k=key(p);if(!anchors.has(k))anchors.set(k,{...p,tangent});};
    for(const s of tree){add(s.a,near(s.a.y,s.b.y)?'h':'v');add(s.b,near(s.a.y,s.b.y)?'h':'v');if(near(s.a.y,s.b.y)){for(const x of [target.point.x,target.point.x+(target.point.nx??-1)*30])add({x:Math.max(Math.min(s.a.x,s.b.x),Math.min(Math.max(s.a.x,s.b.x),x)),y:s.a.y},'h');}else for(const y of [target.point.y,target.point.y+(target.point.ny??0)*30])add({x:s.a.x,y:Math.max(Math.min(s.a.y,s.b.y),Math.min(Math.max(s.a.y,s.b.y),y))},'v');}
    const nearest=[...anchors.values()].sort((a,b)=>length(a,target.point)-length(b,target.point)).slice(0,8);let score=Infinity;
    for(const anchor of nearest){const atRoot=same(anchor,source),dx=target.point.x-anchor.x,dy=target.point.y-anchor.y,a=atRoot?source:{x:anchor.x,y:anchor.y,nx:anchor.tangent==='v'?(Math.sign(dx)||1):0,ny:anchor.tangent==='h'?(Math.sign(dy)||1):0},r=W.orthogonalRoute(a,target.point,45,{...options,fromId:atRoot?options.fromId:null,toId:target.toId,index:target.index});if(r.cost<score){score=r.cost;best=r.points;}}
    best=clipToTree(best,tree);let remaining=best.slice(1).reduce((n,p,i)=>n+length(best[i],p),0)/2,label=best[0];for(let i=1;i<best.length;i++){const len=length(best[i-1],best[i]);if(remaining<=len){const t=len?remaining/len:0;label={x:best[i-1].x+(best[i].x-best[i-1].x)*t,y:best[i-1].y+(best[i].y-best[i-1].y)*t};break;}remaining-=len;}return{points:best,path:path(best),label,attachment:best[0]};
 }
 function route(source,targets,options={}){
  if(!targets.length)return{strokes:[],segments:[],junctions:[],routes:{},label:{x:source.x,y:source.y},rootEdgeIndex:null};
  const nx=source.nx??1,ny=source.ny??0,forward=p=>(p.x-source.x)*nx+(p.y-source.y)*ny,rank=t=>MW.valid(t.routing)?t.routing.branch?2:0:1,pending=targets.slice().sort((a,b)=>rank(a)-rank(b)||forward(b.point)-forward(a.point)||length(source,a.point)-length(source,b.point)||a.index-b.index),ordered=[],tree=[],strokes=[];
  while(pending.length){let i=pending.findIndex(t=>!t.routing?.branch||!pending.some(other=>other!==t&&other.toId===t.routing.branch.to&&other.toPort===t.routing.branch.toPort));if(i<0)i=0;ordered.push(...pending.splice(i,1));}
  for(const target of ordered){let best=null;
   if(MW.valid(target.routing)){const start=target.routing.branch&&tree.length?MW.nearest(target.routing.points[0],tree).point:source;best=MW.resolve(start,target.point,target.routing);if(tree.length)best=clipToTree(best,tree);}
   else if(!tree.length){const r=W.orthogonalRoute(source,target.point,Math.max(45,length(source,target.point)*.35),{...options,toId:target.toId,index:target.index});best=r.points;}
   else{
    best=branch(source,target,tree,options).points;
   }
   const segments=parts(best);if(segments.length){strokes.push({edgeIndex:target.index,points:best,path:path(best)});tree.push(...segments);}
  }
  // Node the tree at branch attachments. Only this source's geometry is considered;
  // an unrelated signal crossing the same coordinates never creates a junction.
  const cuts=tree.map(s=>[s.a,s.b]);for(let i=0;i<tree.length;i++){for(const target of targets)if(on(target.point,tree[i].a,tree[i].b))cuts[i].push(target.point);for(let j=i+1;j<tree.length;j++)for(const p of crossings(tree[i].a,tree[i].b,tree[j].a,tree[j].b)){cuts[i].push(p);cuts[j].push(p);}}
  const vertices=new Map(),segments=[],unique=new Set(),adj=new Map(),point=p=>{const k=key(p);if(!vertices.has(k))vertices.set(k,{x:p.x,y:p.y});return k;};
  for(let i=0;i<tree.length;i++){const s=tree[i],ps=[...new Map(cuts[i].map(p=>[key(p),p])).values()].sort((a,b)=>length(s.a,a)-length(s.a,b));for(let j=1;j<ps.length;j++){const a=point(ps[j-1]),b=point(ps[j]);if(a===b)continue;const id=[a,b].sort().join('|');if(unique.has(id))continue;unique.add(id);const index=segments.length;segments.push({a:vertices.get(a),b:vertices.get(b),edgeIndices:[]});for(const[k,other]of[[a,b],[b,a]]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push({to:other,index});}}}
  const root=key(source),parents=new Map([[root,null]]),queue=[root];for(let i=0;i<queue.length;i++)for(const edge of adj.get(queue[i])||[])if(!parents.has(edge.to)){parents.set(edge.to,{from:queue[i],index:edge.index});queue.push(edge.to);}
  const routes={};for(const target of targets){let current=key(target.point);if(!parents.has(current))throw Error('同源连接树缺少目标端点');const ps=[vertices.get(current)||{x:source.x,y:source.y}];while(parents.get(current)){const step=parents.get(current);segments[step.index].edgeIndices.push(target.index);current=step.from;ps.push(vertices.get(current));}ps.reverse();routes[target.index]={points:ps,path:path(ps)};}
  const junctions=[...adj].filter(([k,edges])=>edges.length>=3&&k!==root).map(([k,edges])=>({...vertices.get(k),degree:edges.length})),shared=segments.filter(s=>s.edgeIndices.length>1),labelSegment=(shared.length?shared:segments).slice().sort((a,b)=>length(b.a,b.b)-length(a.a,a.b))[0],label=labelSegment?{x:(labelSegment.a.x+labelSegment.b.x)/2,y:(labelSegment.a.y+labelSegment.b.y)/2}:{x:source.x,y:source.y};
  return{strokes,segments,junctions,routes,label,rootEdgeIndex:ordered[0].index};
 }
 return{route,branch};
});
