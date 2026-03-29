/* ============================================================
   Future Vision Page — future.js
   ============================================================ */
'use strict';

// Theme
(function(){var t=localStorage.getItem('qviz-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();
function wireThemeToggle(){
  const btn=document.getElementById('themeToggle');if(!btn)return;
  btn.textContent=(localStorage.getItem('qviz-theme')||'dark')==='dark'?'🌙':'☀️';
  btn.addEventListener('click',()=>{
    const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);localStorage.setItem('qviz-theme',next);
    btn.textContent=next==='dark'?'🌙':'☀️';
  });
}

// ═══════════════════════════════════════════════════════════
// WHAT IF CARDS — Accordion logic
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  wireThemeToggle();

  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => nb?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  const cards = document.querySelectorAll('.whatif-card');
  cards.forEach(card => {
    const header = card.querySelector('.wi-header');
    header.addEventListener('click', () => {
      const isExpanded = card.classList.contains('expanded');
      
      // Close all others
      cards.forEach(c => c.classList.remove('expanded'));
      
      // Toggle current
      if (!isExpanded) {
        card.classList.add('expanded');
      }
    });
  });
});
