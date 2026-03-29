/* ============================================================
   Applications Page — applications.js
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
// PROBLEM SOLVER — Race Engine
// ═══════════════════════════════════════════════════════════
const PROBLEMS = {
  search: {
    title: 'Database Search (N = 1,000,000 records)',
    classicalSteps: 1000000,
    quantumSteps: 1000,
    detail: `Classical: Linear search — check every record one by one → O(N) = 1,000,000 steps.<br/>Quantum: Grover's algorithm uses amplitude amplification → O(√N) = 1,000 steps. <strong>1,000× faster.</strong>`
  },
  factor: {
    title: 'Factor RSA-64 (N = 15 digits)',
    classicalSteps: 500000,
    quantumSteps: 800,
    detail: `Classical: Trial division / General Number Field Sieve → exponential time.<br/>Quantum: Shor's algorithm uses quantum Fourier transform → polynomial time. <strong>~600× faster</strong> for this size.`
  },
  route: {
    title: 'Route Optimization (12 cities)',
    classicalSteps: 479001600,  // 12!
    quantumSteps: 50000,
    detail: `Classical: Brute force over 12! = 479,001,600 permutations.<br/>Quantum: QAOA explores routes in superposition → near-optimal in ~50,000 oracle calls. <strong>~10,000× faster.</strong>`
  }
};

let currentProblem = 'search';
let raceInterval = null;
let raceRunning = false;

function selectProblem(key) {
  currentProblem = key;
  const p = PROBLEMS[key];
  document.getElementById('solverTitle').textContent = p.title;
  document.getElementById('solverDetail').innerHTML = p.detail;
  document.querySelectorAll('.solver-choice').forEach(b => b.classList.toggle('active', b.dataset.problem === key));
  resetRace();
}

function resetRace() {
  if (raceInterval) clearInterval(raceInterval);
  raceRunning = false;
  document.getElementById('raceClassical').style.width = '0%';
  document.getElementById('raceQuantum').style.width = '0%';
  document.getElementById('raceClassSteps').textContent = '0 steps';
  document.getElementById('raceQuantSteps').textContent = '0 steps';
  document.getElementById('solverResult').textContent = '';
}

function startRace() {
  if (raceRunning) return;
  resetRace();
  raceRunning = true;

  const p = PROBLEMS[currentProblem];
  // Quantum finishes in ~60 ticks, we calculate classical proportion
  const totalTicks = 80;
  const qTicksToFinish = 60;
  const qStepPerTick = p.quantumSteps / qTicksToFinish;
  const cStepPerTick = p.classicalSteps / totalTicks;

  let tick = 0;
  let qDone = false, cDone = false;
  let qStep = 0, cStep = 0;

  raceInterval = setInterval(() => {
    tick++;

    // Quantum
    if (!qDone) {
      qStep = Math.min(p.quantumSteps, Math.round(qStepPerTick * tick));
      const qPct = (qStep / p.quantumSteps) * 100;
      document.getElementById('raceQuantum').style.width = qPct + '%';
      document.getElementById('raceQuantSteps').textContent = qStep.toLocaleString() + ' steps';
      if (qStep >= p.quantumSteps) {
        qDone = true;
        document.getElementById('solverResult').innerHTML =
          `⚛️ Quantum finished in <strong>${p.quantumSteps.toLocaleString()}</strong> steps! Classical still at ${Math.round((cStep/p.classicalSteps)*100)}%...`;
      }
    }

    // Classical (always slower)
    if (!cDone) {
      cStep = Math.min(p.classicalSteps, Math.round(cStepPerTick * tick));
      const cPct = (cStep / p.classicalSteps) * 100;
      document.getElementById('raceClassical').style.width = cPct + '%';
      document.getElementById('raceClassSteps').textContent = cStep.toLocaleString() + ' steps';
      if (cStep >= p.classicalSteps) cDone = true;
    }

    if (qDone && tick > qTicksToFinish + 15) {
      clearInterval(raceInterval);
      raceRunning = false;
      const speedup = Math.round(p.classicalSteps / p.quantumSteps);
      document.getElementById('solverResult').innerHTML =
        `🏆 Quantum wins! <strong>${speedup.toLocaleString()}×</strong> speedup (${p.quantumSteps.toLocaleString()} vs ${p.classicalSteps.toLocaleString()} steps)`;
    }
  }, 50);
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  wireThemeToggle();

  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => nb?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  // Problem picker
  document.querySelectorAll('.solver-choice').forEach(btn => {
    btn.addEventListener('click', () => selectProblem(btn.dataset.problem));
  });

  document.getElementById('btnRace').addEventListener('click', startRace);
  document.getElementById('btnRaceReset').addEventListener('click', resetRace);

  selectProblem('search');
});
