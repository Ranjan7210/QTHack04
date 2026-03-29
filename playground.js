/* ============================================================
   Quantum Playground — playground.js
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
// QUBIT VISUALIZER
// ═══════════════════════════════════════════════════════════
const QV = { theta: 0, measured: false, counts: [0, 0] };

function updateQV() {
  const t = QV.theta * Math.PI / 180;
  const p0 = Math.cos(t / 2) ** 2;
  const p1 = 1 - p0;

  document.getElementById('qvBar0').style.height = (p0 * 100) + '%';
  document.getElementById('qvBar1').style.height = (p1 * 100) + '%';
  document.getElementById('qvVal0').textContent = (p0 * 100).toFixed(1) + '%';
  document.getElementById('qvVal1').textContent = (p1 * 100).toFixed(1) + '%';
  document.getElementById('qvThetaVal').textContent = QV.theta + '°';

  const coin = document.getElementById('qvCoin');
  coin.classList.remove('state-0', 'state-1', 'state-super');
  if (!QV.measured) {
    if (QV.theta === 0) coin.classList.add('state-0');
    else if (QV.theta === 180) coin.classList.add('state-1');
    else coin.classList.add('state-super');
  }

  // State equation
  let eq;
  if (QV.theta === 0) eq = '|ψ⟩ = |0⟩';
  else if (QV.theta === 180) eq = '|ψ⟩ = |1⟩';
  else if (QV.theta === 90) eq = '|ψ⟩ = (|0⟩ + |1⟩)/√2';
  else eq = `|ψ⟩ = ${Math.cos(t/2).toFixed(3)}|0⟩ + ${Math.sin(t/2).toFixed(3)}|1⟩`;
  document.getElementById('qvStateEq').textContent = eq;
}

function measureQV() {
  const t = QV.theta * Math.PI / 180;
  const p0 = Math.cos(t / 2) ** 2;
  const outcome = Math.random() < p0 ? 0 : 1;

  QV.measured = true;
  QV.counts[outcome]++;

  const coin = document.getElementById('qvCoin');
  coin.classList.remove('state-0', 'state-1', 'state-super');
  coin.classList.add('measuring');
  setTimeout(() => {
    coin.classList.remove('measuring');
    coin.classList.add(outcome === 0 ? 'state-0' : 'state-1');
  }, 1200);

  document.getElementById('qvResult').textContent = `Measured: |${outcome}⟩`;
  document.getElementById('qvResult').style.color = outcome === 0 ? 'var(--purple)' : 'var(--pink)';
  document.getElementById('stat0').textContent = QV.counts[0];
  document.getElementById('stat1').textContent = QV.counts[1];
  document.getElementById('statTotal').textContent = QV.counts[0] + QV.counts[1];
}

// ═══════════════════════════════════════════════════════════
// GATE SIMULATOR
// ═══════════════════════════════════════════════════════════
const GS = { gates: [], alpha: { re: 1, im: 0 }, beta: { re: 0, im: 0 } };

function complexMul(a, b) { return { re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re }; }
function complexAdd(a, b) { return { re: a.re+b.re, im: a.im+b.im }; }
function complexAbs2(c) { return c.re*c.re + c.im*c.im; }

function applyGateMatrix(a, b, gate) {
  const S2 = 1 / Math.SQRT2;
  if (gate === 'H') {
    return { a: { re: (a.re+b.re)*S2, im: (a.im+b.im)*S2 }, b: { re: (a.re-b.re)*S2, im: (a.im-b.im)*S2 } };
  } else if (gate === 'X') {
    return { a: b, b: a };
  } else if (gate === 'Z') {
    return { a, b: { re: -b.re, im: -b.im } };
  } else if (gate === 'S') {
    return { a, b: { re: -b.im, im: b.re } };
  } else if (gate === 'T') {
    const c = Math.cos(Math.PI/4), s = Math.sin(Math.PI/4);
    return { a, b: complexMul(b, { re: c, im: s }) };
  }
  return { a, b };
}

function recomputeGS() {
  GS.alpha = { re: 1, im: 0 };
  GS.beta = { re: 0, im: 0 };
  for (const g of GS.gates) {
    const r = applyGateMatrix(GS.alpha, GS.beta, g);
    GS.alpha = r.a;
    GS.beta = r.b;
  }
  updateGSDisplay();
}

function updateGSDisplay() {
  const p0 = complexAbs2(GS.alpha);
  const p1 = complexAbs2(GS.beta);
  const aMag = Math.sqrt(p0).toFixed(3);
  const bMag = Math.sqrt(p1).toFixed(3);

  document.getElementById('gsKet').textContent = `|ψ⟩ = ${aMag}|0⟩ + ${bMag}|1⟩`;
  document.getElementById('gsFill0').style.width = (p0 * 100) + '%';
  document.getElementById('gsFill1').style.width = (p1 * 100) + '%';
  document.getElementById('gsProb0').textContent = `P(0) = ${(p0*100).toFixed(1)}%`;
  document.getElementById('gsProb1').textContent = `P(1) = ${(p1*100).toFixed(1)}%`;
  document.getElementById('gsOutput').textContent = `→ ${aMag}|0⟩ + ${bMag}|1⟩`;
}

function addGate(g) {
  GS.gates.push(g);
  const box = document.createElement('div');
  box.className = 'gs-gate-box ' + g.toLowerCase();
  box.textContent = g;
  document.getElementById('gsGates').appendChild(box);
  recomputeGS();
}

function clearCircuit() {
  GS.gates = [];
  document.getElementById('gsGates').innerHTML = '';
  recomputeGS();
  document.getElementById('gsMResult').textContent = '';
}

function measureGS() {
  const p0 = complexAbs2(GS.alpha);
  const outcome = Math.random() < p0 ? 0 : 1;
  const el = document.getElementById('gsMResult');
  el.textContent = `⚡ Collapsed → |${outcome}⟩`;
  el.style.color = outcome === 0 ? 'var(--purple)' : 'var(--pink)';
}

// ═══════════════════════════════════════════════════════════
// RNG COMPARISON
// ═══════════════════════════════════════════════════════════
const RNG = { classical: new Array(10).fill(0), quantum: new Array(10).fill(0), cTotal: 0, qTotal: 0 };

function generateRNG(n) {
  for (let i = 0; i < n; i++) {
    // Classical
    const cBin = Math.floor(Math.random() * 10);
    RNG.classical[cBin]++;
    RNG.cTotal++;

    // Quantum (simulated: 4 Hadamard measurements → 4-bit number → mod 10)
    let qVal = 0;
    for (let b = 0; b < 4; b++) {
      qVal = (qVal << 1) | (Math.random() < 0.5 ? 1 : 0);
    }
    qVal = qVal % 10;
    RNG.quantum[qVal]++;
    RNG.qTotal++;
  }
  drawRNG();
  document.getElementById('rngClassCount').textContent = RNG.cTotal + ' samples';
  document.getElementById('rngQuantCount').textContent = RNG.qTotal + ' samples';
}

function drawRNG() {
  drawHist('rngClassical', RNG.classical, RNG.cTotal, '#f59e0b');
  drawHist('rngQuantum', RNG.quantum, RNG.qTotal, '#8b5cf6');
}

function drawHist(canvasId, data, total, color) {
  const el = document.getElementById(canvasId);
  const ctx = el.getContext('2d');
  const W = el.width, H = el.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data, 1);
  const barW = (W - 20) / 10;
  const pad = 10;

  for (let i = 0; i < 10; i++) {
    const barH = (data[i] / maxVal) * (H - 40);
    const x = pad + i * barW;
    const y = H - 25 - barH;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.roundRect(x + 2, y, barW - 4, barH, [3, 3, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(i.toString(), x + barW / 2, H - 8);
    if (data[i]) {
      ctx.fillText(data[i].toString(), x + barW / 2, y - 4);
    }
  }
}

function resetRNG() {
  RNG.classical.fill(0);
  RNG.quantum.fill(0);
  RNG.cTotal = 0;
  RNG.qTotal = 0;
  drawRNG();
  document.getElementById('rngClassCount').textContent = '0 samples';
  document.getElementById('rngQuantCount').textContent = '0 samples';
}

// ═══════════════════════════════════════════════════════════
// ENTANGLEMENT DEMO
// ═══════════════════════════════════════════════════════════
const ENT = { measured: false };

function resetEntanglement() {
  ENT.measured = false;
  const orbA = document.getElementById('entOrbA');
  const orbB = document.getElementById('entOrbB');
  orbA.className = 'ent-orb entangled';
  orbB.className = 'ent-orb entangled';
  orbA.textContent = '?';
  orbB.textContent = '?';
  document.getElementById('entStateA').textContent = 'Entangled';
  document.getElementById('entStateB').textContent = 'Entangled';
  document.getElementById('entExplainer').textContent = '';
  document.querySelector('.ent-line').style.opacity = '1';
  document.querySelector('.ent-pulse').style.display = '';
}

function measureEntanglement() {
  if (ENT.measured) return;
  ENT.measured = true;

  const outcome = Math.random() < 0.5 ? 0 : 1;
  const orbA = document.getElementById('entOrbA');
  const orbB = document.getElementById('entOrbB');

  // Flash effect
  orbA.classList.remove('entangled');
  orbA.classList.add(outcome === 0 ? 'result-0' : 'result-1');
  orbA.textContent = `|${outcome}⟩`;
  document.getElementById('entStateA').textContent = `Measured: |${outcome}⟩`;

  setTimeout(() => {
    orbB.classList.remove('entangled');
    orbB.classList.add(outcome === 0 ? 'result-0' : 'result-1');
    orbB.textContent = `|${outcome}⟩`;
    document.getElementById('entStateB').textContent = `Collapsed: |${outcome}⟩`;
    document.querySelector('.ent-line').style.opacity = '0.2';
    document.querySelector('.ent-pulse').style.display = 'none';

    document.getElementById('entExplainer').innerHTML =
      `Both qubits measured <strong>|${outcome}⟩</strong>. The Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2 guarantees perfect correlation — even across the universe. This is <em>not</em> communication; it's correlation without causation.`;
  }, 600);
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  wireThemeToggle();

  // Navbar scroll
  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => nb?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  // Qubit Visualizer
  const slider = document.getElementById('qvTheta');
  slider.addEventListener('input', () => {
    QV.theta = parseInt(slider.value);
    QV.measured = false;
    document.getElementById('qvResult').textContent = '';
    updateQV();
  });
  document.getElementById('btnMeasure').addEventListener('click', measureQV);
  document.getElementById('btnResetQV').addEventListener('click', () => {
    QV.theta = 0; QV.measured = false; QV.counts = [0, 0];
    slider.value = 0;
    document.getElementById('qvResult').textContent = '';
    document.getElementById('stat0').textContent = '0';
    document.getElementById('stat1').textContent = '0';
    document.getElementById('statTotal').textContent = '0';
    updateQV();
  });
  updateQV();

  // Gate Simulator
  document.querySelectorAll('.gate-chip').forEach(btn => {
    btn.addEventListener('click', () => addGate(btn.dataset.gate));
  });
  document.getElementById('btnClearCircuit').addEventListener('click', clearCircuit);
  document.getElementById('btnGsMeasure').addEventListener('click', measureGS);

  // RNG
  document.getElementById('btnRng100').addEventListener('click', () => generateRNG(100));
  document.getElementById('btnRng1000').addEventListener('click', () => generateRNG(1000));
  document.getElementById('btnRngReset').addEventListener('click', resetRNG);
  drawRNG();

  // Entanglement
  document.getElementById('btnEntMeasure').addEventListener('click', measureEntanglement);
  document.getElementById('btnEntReset').addEventListener('click', resetEntanglement);
  resetEntanglement();
});
