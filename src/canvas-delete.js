(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./repair'):root.LogicRepair);if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicCanvasDelete=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R){
 'use strict';
 const empty=()=>({nodes:[],edges:[],candidates:[],scopes:[],probes:[]}),note='用户使用画布删除工具删除；原始来源与导入审计保留';
 function apply(project,targets){
  const nodes=new Set((targets.nodes||[]).filter(id=>project.nodes.some(n=>n.id===id))),edges=new Set((targets.edges||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<project.edges.length)),scopes=new Set((targets.scopes||[]).filter(id=>project.scopes?.some(s=>s.id===id))),requested=new Set(targets.candidates||[]),candidates=(project.connectionCandidates||[]).filter(c=>c.status==='pending'&&(requested.has(c.id)||nodes.has(c.from)||nodes.has(c.to))).map(c=>c.id),probes=new Set((targets.probes||[]).map(p=>JSON.stringify([p.scopeId,p.key]))),isRemovedChannel=(scope,key)=>probes.has(JSON.stringify([scope.id,key]))||nodes.has(JSON.parse(key)[0]);
  const removedEdges=project.edges.filter((e,i)=>edges.has(i)||nodes.has(e.from)||nodes.has(e.to)).length,removedProbes=(project.scopes||[]).filter(s=>!scopes.has(s.id)).reduce((sum,s)=>sum+s.channels.filter(key=>isRemovedChannel(s,key)).length,0),counts={nodes:nodes.size,edges:removedEdges,candidates:candidates.length,scopes:scopes.size,probes:removedProbes},changed=Object.values(counts).some(Boolean),logicChanged=!!(counts.nodes||counts.edges||counts.candidates);
  if(!changed)return{project,changed:false,logicChanged:false,counts};
  const next=candidates.length?R.rejectCandidates(project,candidates,note):structuredClone(project);next.nodes=next.nodes.filter(n=>!nodes.has(n.id));next.edges=next.edges.filter((e,i)=>!edges.has(i)&&!nodes.has(e.from)&&!nodes.has(e.to));if(next.scopes)next.scopes=next.scopes.filter(s=>!scopes.has(s.id)).map(s=>{const kept={...s,channels:s.channels.filter(key=>!isRemovedChannel(s,key))};if(s.ranges){kept.ranges=Object.fromEntries(Object.entries(s.ranges).filter(([key])=>!isRemovedChannel(s,key)));if(!Object.keys(kept.ranges).length)delete kept.ranges;}return kept;});
  for(const issue of next.issues||[])if(nodes.has(issue.nodeId)&&!issue.resolved){issue.resolved=true;issue.resolution={method:'canvas-delete',note,at:new Date().toISOString()};}
  return{project:next,changed:true,logicChanged,counts};
 }
 return{empty,apply};
});
