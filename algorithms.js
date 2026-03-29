/* ============================================================
   Algorithms Page — algorithms.js
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
// GROVER'S ALGORITHM VISUALIZER
// ═══════════════════════════════════════════════════════════
const GRV = {
  N: 8,
  target: 3,
  amplitudes: [],
  iteration: 0,
  maxIter: 0,
  autoInterval: null,
};

function groverInit() {
  GRV.target = Math.floor(Math.random() * GRV.N);
  GRV.amplitudes = new Array(GRV.N).fill(1 / Math.sqrt(GRV.N));
  GRV.iteration = 0;
  GRV.maxIter = Math.round(Math.PI / 4 * Math.sqrt(GRV.N));
  if (GRV.autoInterval) { clearInterval(GRV.autoInterval); GRV.autoInterval = null; }

  document.getElementById('groverIter').textContent = '0';
  document.getElementById('groverMax').textContent = GRV.maxIter;
  document.getElementById('groverTarget').textContent = `item #${GRV.target}`;
  drawGrover();
}

function groverStep() {
  if (GRV.iteration >= GRV.maxIter + 2) return;
  const a = GRV.amplitudes;

  // Oracle: flip target
  a[GRV.target] *= -1;

  // Diffusion: reflect about mean
  const mean = a.reduce((s, v) => s + v, 0) / GRV.N;
  for (let i = 0; i < GRV.N; i++) {
    a[i] = 2 * mean - a[i];
  }

  GRV.iteration++;
  document.getElementById('groverIter').textContent = GRV.iteration;
  drawGrover();
}

function groverAuto() {
  if (GRV.autoInterval) { clearInterval(GRV.autoInterval); GRV.autoInterval = null; return; }
  GRV.autoInterval = setInterval(() => {
    if (GRV.iteration >= GRV.maxIter) {
      clearInterval(GRV.autoInterval);
      GRV.autoInterval = null;
      return;
    }
    groverStep();
  }, 500);
}

function drawGrover() {
  const canvas = document.getElementById('groverCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const a = GRV.amplitudes;
  const maxAmp = Math.max(...a.map(Math.abs), 0.01);
  const barW = (W - 60) / GRV.N;
  const pad = 30;
  const baseY = H - 35;

  // Grid lines
  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 5; y++) {
    const yy = 20 + y * (baseY - 20) / 4;
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W - pad, yy); ctx.stroke();
  }

  for (let i = 0; i < GRV.N; i++) {
    const x = pad + i * barW;
    const amp = a[i];
    const prob = amp * amp;
    const barH = (prob / (maxAmp * maxAmp)) * (baseY - 30);

    const isTarget = i === GRV.target;
    ctx.fillStyle = isTarget ? '#ec4899' : '#8b5cf6';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.roundRect(x + 4, baseY - barH, barW - 8, barH, [4, 4, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Glow for target
    if (isTarget && prob > 0.3) {
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ec4899';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.roundRect(x + 4, baseY - barH, barW - 8, barH, [4, 4, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Label
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    ctx.fillStyle = isTarget ? '#ec4899' : textColor;
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(i.toString(), x + barW / 2, baseY + 14);

    // Probability
    ctx.fillStyle = textColor;
    ctx.font = '9px JetBrains Mono';
    if (barH > 20) ctx.fillText((prob * 100).toFixed(1) + '%', x + barW / 2, baseY - barH - 4);
  }

  // Baseline
  ctx.strokeStyle = 'rgba(148,163,184,0.3)';
  ctx.beginPath();
  ctx.moveTo(pad, baseY);
  ctx.lineTo(W - pad, baseY);
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════
// SHOR'S ALGORITHM DEMO
// ═══════════════════════════════════════════════════════════
let shorN = 15;

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

function runShor() {
  const flow = document.getElementById('shorFlow');
  flow.innerHTML = '';

  const N = shorN;
  const addStep = (cls, text, delay) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'shor-step ' + cls;
      div.innerHTML = text;
      flow.appendChild(div);
      flow.scrollTop = flow.scrollHeight;
    }, delay);
  };

  addStep('info', `<strong>Step 0:</strong> Factor N = ${N}`, 0);

  // Pick a random a
  let a;
  do { a = 2 + Math.floor(Math.random() * (N - 3)); } while (gcd(a, N) !== 1);
  addStep('info', `<strong>Step 1:</strong> Choose random a = ${a}. gcd(${a}, ${N}) = 1, so proceed.`, 600);

  // Find period
  let r = 1;
  while (Math.pow(a, r) % N !== 1 && r < 1000) r++;
  addStep('quantum', `<strong>Step 2 (Quantum):</strong> 🌀 Run QFT on f(x) = ${a}<sup>x</sup> mod ${N}. Found period r = ${r}.`, 1400);

  if (r % 2 !== 0) {
    addStep('info', `r = ${r} is odd. Retry with different a.`, 2200);
    setTimeout(runShor, 2800);
    return;
  }

  const half = Math.pow(a, r / 2);
  const f1 = gcd(half - 1, N);
  const f2 = gcd(half + 1, N);
  addStep('info', `<strong>Step 3:</strong> r = ${r} is even. Compute a<sup>r/2</sup> = ${a}<sup>${r/2}</sup> = ${half}.`, 2200);
  addStep('info', `gcd(${half} - 1, ${N}) = ${f1}, gcd(${half} + 1, ${N}) = ${f2}`, 3000);

  if (f1 > 1 && f1 < N && f2 > 1 && f2 < N) {
    addStep('success', `✅ <strong>${N} = ${f1} × ${f2}</strong> — factored successfully!`, 3800);
  } else if (f1 > 1 && f1 < N) {
    addStep('success', `✅ <strong>${N} = ${f1} × ${N / f1}</strong> — factored!`, 3800);
  } else if (f2 > 1 && f2 < N) {
    addStep('success', `✅ <strong>${N} = ${f2} × ${N / f2}</strong> — factored!`, 3800);
  } else {
    addStep('info', `Trivial factors found. Retrying...`, 3800);
    setTimeout(runShor, 4400);
  }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  wireThemeToggle();
  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => nb?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  // Grover
  document.querySelectorAll('[data-n]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-n]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      GRV.N = parseInt(btn.dataset.n);
      groverInit();
    });
  });
  document.getElementById('btnGroverStep').addEventListener('click', groverStep);
  document.getElementById('btnGroverAuto').addEventListener('click', groverAuto);
  document.getElementById('btnGroverReset').addEventListener('click', groverInit);
  groverInit();

  // Shor
  document.querySelectorAll('[data-sn]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sn]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shorN = parseInt(btn.dataset.sn);
      document.getElementById('shorFlow').innerHTML = '';
    });
  });
  document.getElementById('btnShorRun').addEventListener('click', runShor);
});
