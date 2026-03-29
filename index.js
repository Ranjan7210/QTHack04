/* ============================================================
   QuantumViz — Landing Page Script (index.js)
   ============================================================ */
'use strict';

// ─── Theme System (shared across all pages via localStorage) ─
(function initTheme() {
  const saved = localStorage.getItem('qviz-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('qviz-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ─── Navbar scroll effect ───────────────────────────────────

const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ─── Theme Toggle ────────────────────────────────────────────
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
  const cur = localStorage.getItem('qviz-theme') || 'dark';
  themeBtn.textContent = cur === 'dark' ? '🌙' : '☀️';
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

// ─── Hamburger menu ─────────────────────────────────────────

const hamburger = document.getElementById('navHamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = navLinks.style.display === 'flex';
    navLinks.style.cssText = open
      ? ''
      : 'display:flex;flex-direction:column;position:absolute;top:70px;left:0;right:0;background:rgba(4,6,16,0.97);padding:20px 32px;gap:16px;border-bottom:1px solid rgba(255,255,255,0.08);z-index:200;backdrop-filter:blur(20px)';
  });
}

// ─── Animated Qubit Nodes (hero visual) ─────────────────────
(function createQubitNodes() {
  const container = document.getElementById('qubitNodes');
  if (!container) return;

  const nodes = [
    { angle: 20, radius: 42, color: '#8b5cf6', label: '|0⟩', size: 10 },
    { angle: 95, radius: 38, color: '#3b82f6', label: '|1⟩', size: 9 },
    { angle: 165, radius: 45, color: '#ec4899', label: '|+⟩', size: 8 },
    { angle: 250, radius: 40, color: '#06b6d4', label: '|−⟩', size: 9 },
    { angle: 310, radius: 36, color: '#10b981', label: '|i⟩', size: 7 },
    { angle: 200, radius: 48, color: '#f59e0b', label: '|Φ+⟩', size: 8 },
  ];

  nodes.forEach((n, i) => {
    const dot = document.createElement('div');
    const rad = (n.angle * Math.PI) / 180;
    const r = n.radius;
    dot.style.cssText = `
      position:absolute;
      width:${n.size * 2}px; height:${n.size * 2}px;
      left: calc(50% + ${Math.cos(rad) * r}% - ${n.size}px);
      top:  calc(50% + ${Math.sin(rad) * r}% - ${n.size}px);
      border-radius:50%;
      background:${n.color};
      box-shadow: 0 0 ${n.size * 3}px ${n.color}80;
      animation: float-node ${3.5 + i * 0.4}s ease-in-out infinite alternate;
      cursor:default;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes float-node {
        from { transform: translateY(0); opacity: 0.8; }
        to   { transform: translateY(-6px); opacity: 1; }
      }
    `;
    if (i === 0) document.head.appendChild(style);

    const tooltip = document.createElement('span');
    tooltip.style.cssText = `
      position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
      background:rgba(10,14,35,0.9); border:1px solid ${n.color}40;
      padding:2px 6px; border-radius:4px;
      font-family:'JetBrains Mono',monospace; font-size:0.65rem; color:${n.color};
      white-space:nowrap; pointer-events:none; opacity:0; transition:opacity 0.2s;
    `;
    tooltip.textContent = n.label;
    dot.appendChild(tooltip);
    dot.addEventListener('mouseenter', () => (tooltip.style.opacity = '1'));
    dot.addEventListener('mouseleave', () => (tooltip.style.opacity = '0'));

    container.appendChild(dot);
  });

  // Entanglement lines (SVG)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  const pairs = [[0, 3], [1, 4], [2, 5]];
  const colors = ['rgba(139,92,246,0.25)', 'rgba(59,130,246,0.2)', 'rgba(236,72,153,0.2)'];

  // Draw in a delayed fashion after layout
  setTimeout(() => {
    const rect = container.getBoundingClientRect();
    pairs.forEach(([a, b], idx) => {
      const nA = nodes[a], nB = nodes[b];
      const rA = (nA.angle * Math.PI) / 180;
      const rB = (nB.angle * Math.PI) / 180;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const scale = rect.width / 100;

      const x1 = cx + Math.cos(rA) * nA.radius * scale / 2;
      const y1 = cy + Math.sin(rA) * nA.radius * scale / 2;
      const x2 = cx + Math.cos(rB) * nB.radius * scale / 2;
      const y2 = cy + Math.sin(rB) * nB.radius * scale / 2;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', colors[idx]);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 4');
      svg.appendChild(line);
    });
  }, 100);

  container.appendChild(svg);
})();

// ─── Module card click routing ───────────────────────────────
document.querySelectorAll('.module-card:not(.locked)').forEach(card => {
  const href = card.dataset.href;
  if (href) {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.module-btn')) {
        window.location.href = href;
      }
    });
  }
});

// ─── Knowledge Layer Toggle ──────────────────────────────────
const layers = [
  document.getElementById('layer0'),
  document.getElementById('layer1'),
  document.getElementById('layer2'),
];
const panels = [
  document.getElementById('demoPanel0'),
  document.getElementById('demoPanel1'),
  document.getElementById('demoPanel2'),
];

function activateLayer(idx) {
  layers.forEach((l, i) => l.classList.toggle('active', i === idx));
  panels.forEach((p, i) => p.classList.toggle('active-panel', i === idx));
}

layers.forEach((l, i) => l.addEventListener('click', () => activateLayer(i)));

// ─── Intersection Observer reveal animation ──────────────────
const reveals = document.querySelectorAll('.module-card, .layer-item, .about-grid');
const revealStyle = document.createElement('style');
revealStyle.textContent = `
  .module-card, .layer-item, .about-grid {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .module-card.revealed, .layer-item.revealed, .about-grid.revealed {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(revealStyle);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

reveals.forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  observer.observe(el);
});

// ─── Hero launch button particle burst ─────────────────────
const heroLaunch = document.getElementById('heroLaunch');
if (heroLaunch) {
  heroLaunch.addEventListener('click', (e) => {
    const rect = heroLaunch.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      const angle = (i / 8) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      p.style.cssText = `
        position:fixed;
        width:6px; height:6px;
        border-radius:50%;
        background: hsl(${260 + i * 20}, 80%, 65%);
        left:${rect.left + rect.width / 2}px;
        top:${rect.top + rect.height / 2}px;
        pointer-events:none;
        z-index:9999;
        transition: transform 0.5s ease-out, opacity 0.5s ease-out;
      `;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        p.style.opacity = '0';
      });
      setTimeout(() => p.remove(), 600);
    }
  });
}
