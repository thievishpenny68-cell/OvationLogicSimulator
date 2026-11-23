(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./svg-field-codec'):root.LogicSVGFieldCodec);if(node)module.exports=api;else root.LogicSVGIdentity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(F){
 'use strict';
 // Numeric object-ID substitutions. Each row maps digits 0–9 for one position
 // after the unchanged first digit. Verified against terminating line references.
 const profiles={
  '111111111111':['IMQUYZRJB3','GFwr4bCOnU','0s2iYTfjhr','ImQ14NDx5i'],
  '112342443321':['wAIWNBvhck','Isn81kpu93','1CAaKumc4g','mWFyLQa7St'],
  '123424433215':['MUP9vdeoCI','Oj0Iqmnlv5','cFNlVKfUOZ','SDM8UHjkti'],
  '152551123424':['UND5xfiwCK','BTpANahmD6','Sl0K1z9unL','TM4uWc6Y0i'],
  '215255112342':['CSRH9zlkw8','tUcsz7FMml','IHBvDePOdc','Ugxrv2SLXP'],
  '234244332152':['QVF1jbi2EO','pAKIXsSQZw','23hsRUm1Zi','PY9TzIlyOk'],
  '244332152551':['VF5zdg0MQX','36tq8md7YW','2LJmoGz3cK','k7OAbC6W0M'],
  '255112342443':['WXNBpfk2EM','F4yXJDTNHu','iloweOj2rG','17B2MdReaI'],
  '321525511234':['KSN3vpbm6I','sMHZpjl8vo','emwzMNkcvQ','LCT1QK8tOP'],
  '332152551123':['AQYLzrjcq6','KD2WQxkdbX','iRvOXw7aTb','LIocwdYGC7'],
  '342443321525':['T9xhem4EYP','j68QlZMXa0','z4QYrf8Gte','nUex6WrV9g'],
  '424433215255':['Fzjbiy8SNt','DXUa4xAZPy','racmpDfbvS','7SnwWcREe8'],
  '433215255112':['KQRHxbgoyG','d7wPIeLAxZ','iG3PmWvcLD','CJ69WS4xml'],
  '443321525511':['YVNztby4AS','urebOw3CU8','sAD2nckegT','G1w94lHDXU'],
  '511234244332':['8KWRBvhgsI','0mlay2NGnM','1v8MzTwy9K','OFgKd7tWz2'],
  '525511234244':['HB5rdmwCQN','O4CnVluKFh','oMKUJeOcTH','I0HF8boONc'],
  '551123424433':['UXJzpas4ER','jkizO3SUD5','dKyptaC91F','Z3Fn5YCoSW']
 };
 function index(root){
  const key=root.getAttribute('cb-key'),profile=Object.hasOwn(profiles,key)?profiles[key]:null,elements=[root,...Array.from(root.getElementsByTagName('*'))],raw=new Map(),decoded=new Map(),byElement=new Map();
  const decode=id=>{
   if(!profile)return key?null:id;
   if(!/^[1-9][A-Za-z0-9]{0,4}$/.test(id||''))return null;
   let value=id[0];for(let i=1;i<id.length;i++){const digit=profile[i-1].indexOf(id[i]);if(digit<0)return null;value+=digit;}return value;
  };
  for(const e of elements){const id=e.getAttribute('id');if(!id)continue;const actual=decode(id);if(!raw.has(id))raw.set(id,[]);raw.get(id).push(e);if(actual!==null){byElement.set(e,actual);if(!decoded.has(actual))decoded.set(actual,[]);decoded.get(actual).push(e);}}
  const lookup=(map,id)=>{const matches=map.get(id);return matches?.length===1?matches[0]:null;};
  return{key:key||null,profile:profile?'observed-numeric-id-v1':key?'unsupported':null,actual:e=>byElement.get(e)||null,
   decodeField:(e,value)=>{const id=byElement.get(e);return profile&&lookup(decoded,id)===e?F.decode(key,id,value):null;},
   // References in cb-alg values / cb-graphic-line are plain IDs even in encoded sheets.
   reference:id=>key&&!profile?null:lookup(profile?decoded:raw,id),raw:id=>lookup(raw,id),supported:!key||!!profile};
 }
 return{index};
});
