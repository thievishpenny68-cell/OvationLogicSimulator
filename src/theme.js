(function(){
 'use strict';
 const key='ovation-theme',root=document.documentElement,button=document.getElementById('theme-toggle');
 function apply(theme){root.dataset.theme=theme;button.setAttribute('aria-pressed',String(theme==='dark'));button.textContent=theme==='dark'?'☀ 浅色模式':'☾ 黑夜模式';}
 let theme='light';try{if(localStorage.getItem(key)==='dark')theme='dark';}catch{}
 apply(theme);button.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';apply(next);try{localStorage.setItem(key,next);}catch{}});
})();
