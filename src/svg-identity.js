(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicSVGIdentity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Observed numeric object-ID substitutions; positions count after the first digit.
 // Protocol observations and independent source checks: docs/reference/svg-connections.md.
 // These tables do not decode property names or cb-input-pin values.
 const profiles={
  '321525511234':['KSN3vpbm6I','sMHZpjl8vo','emwzMNkcvQ'],
  '332152551123':['AQYLzrjcq6','KD2WQxkdbX','iRvOXw7aTb'],
  '342443321525':['T9xhem4EYP','j68QlZMXa0','z4QYrf8Gte'],
  '424433215255':['Fzjbiy8SNt','DXUa4xAZPy','racmpDfbvS'],
  '215255112342':['CSRH9zlkw8','tUcsz7FMml','IHBvDePOdc']
 };
 function index(root){
  const key=root.getAttribute('cb-key'),profile=profiles[key],elements=[root,...Array.from(root.getElementsByTagName('*'))],raw=new Map(),decoded=new Map(),byElement=new Map();
  const decode=id=>{
   if(!profile)return key?null:id;
   if(!/^[1-9][A-Za-z0-9]{0,3}$/.test(id||''))return null;
   let value=id[0];for(let i=1;i<id.length;i++){const digit=profile[i-1].indexOf(id[i]);if(digit<0)return null;value+=digit;}return value;
  };
  for(const e of elements){const id=e.getAttribute('id');if(!id)continue;const actual=decode(id);if(!raw.has(id))raw.set(id,[]);raw.get(id).push(e);if(actual!==null){byElement.set(e,actual);if(!decoded.has(actual))decoded.set(actual,[]);decoded.get(actual).push(e);}}
  const lookup=(map,id)=>{const matches=map.get(id);return matches?.length===1?matches[0]:null;};
  return{key:key||null,profile:profile?'observed-numeric-id-v1':key?'unsupported':null,actual:e=>byElement.get(e)||null,
   // References in cb-alg values / cb-graphic-line are plain IDs even in encoded sheets.
   reference:id=>key&&!profile?null:lookup(profile?decoded:raw,id),raw:id=>lookup(raw,id),supported:!key||!!profile};
 }
 return{index};
});
