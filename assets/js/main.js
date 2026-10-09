(() => {
 const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.site-nav');
 if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰';});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';}));}
 document.querySelectorAll('[data-year]').forEach(n=>n.textContent=new Date().getFullYear());
})();