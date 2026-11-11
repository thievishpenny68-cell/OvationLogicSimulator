(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LogicPaper=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validate(p){
  if(p===undefined)return null;
  if(!p||typeof p!=='object'||Array.isArray(p))return '画纸配置必须是对象';
  if(!['x','y','width','height'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))return '画纸位置与宽高必须是有限数值';
  if(p.width<=0||p.height<=0||!Number.isFinite(p.x+p.width)||!Number.isFinite(p.y+p.height))return '画纸宽高必须为正数，边界坐标必须有效';
  if(typeof p.showBorder!=='boolean')return '请明确是否显示画纸边界';
  if(p.borderStyle!==undefined&&!['dashed','solid'].includes(p.borderStyle))return '画纸边界样式只支持虚线或实线';
  return null;
 }
 function initial(boxes){let left=0,top=0,right=0,bottom=0;for(const b of boxes){left=Math.min(left,b.x-80);top=Math.min(top,b.y-80);right=Math.max(right,b.x+b.width+80);bottom=Math.max(bottom,b.y+b.height+80);}const x=Math.floor(left/100)*100,y=Math.floor(top/100)*100;return{x,y,width:Math.max(3600,Math.ceil((right-x)/100)*100),height:Math.max(2400,Math.ceil((bottom-y)/100)*100),showBorder:true,borderStyle:'dashed'};}
 function outside(p,boxes){return boxes.filter(b=>b.x<p.x||b.y<p.y||b.x+b.width>p.x+p.width||b.y+b.height>p.y+p.height);}
 return{validate,initial,outside};
});
