/* ============================================================
   Surface Code Physics Engine — surface-code.js
   ============================================================ */
'use strict';

// ─── Theme (synced across pages via localStorage) ────────────
(function() {
  const t = localStorage.getItem('qviz-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();

function wireThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const cur = localStorage.getItem('qviz-theme') || 'dark';
  btn.textContent = cur === 'dark' ? '🌙' : '☀️';
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('qviz-theme', next);
    btn.textContent = next === 'dark' ? '🌙' : '☀️';
    // Re-render canvas with new palette context
    renderLattice();
    renderBraiding();
  });
}


// ═══════════════════════════════════════════════════════════
const State = {
  d: 3,
  errorRate: 0.05,
  errorType: 'X',
  layer: 0,          // 0=Intuition 1=Formalism 2=Computation
  activeTab: 'syndrome',
  // Lattice arrays (populated by buildLattice)
  dataQubits: [],    // {row,col,error:'none'|'X'|'Z'|'Y', correction:false}
  xAncillas: [],     // {row,col,violated:false}
  zAncillas: [],     // {row,col,violated:false}
  syndromeCount: 0,
  logicalError: false,
  // Braiding
  anyons: [],
  braidPaths: [],
  dragAnyon: null,
  braidOp: 'X',
  logicalXFlipped: false,
  logicalZFlipped: false,
  // Threshold chart
  thChart: null,
  mcRunning: false,
};

// ═══════════════════════════════════════════════════════════
// LATTICE BUILDER
// ═══════════════════════════════════════════════════════════
function buildLattice() {
  const d = State.d;
  State.dataQubits = [];
  State.xAncillas = [];
  State.zAncillas = [];
  State.syndromeCount = 0;
  State.logicalError = false;

  // Data qubits: d×d grid
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      State.dataQubits.push({ r, c, error: 'none', correction: false });
    }
  }

  // Ancilla qubits sit on the plaquettes between data qubits
  // X-stabilizers (vertex / plaquette): placed at half-integer positions
  // Simplified: (d-1)×(d-1) plaquette ancillas alternating X/Z in checkerboard
  for (let r = 0; r < d - 1; r++) {
    for (let c = 0; c < d - 1; c++) {
      if ((r + c) % 2 === 0) {
        State.xAncillas.push({ r: r + 0.5, c: c + 0.5, violated: false });
      } else {
        State.zAncillas.push({ r: r + 0.5, c: c + 0.5, violated: false });
      }
    }
  }
  // Boundary ancillas
  for (let c = 0; c < d - 1; c++) {
    State.xAncillas.push({ r: -0.5, c: c + 0.5, violated: false });
    State.xAncillas.push({ r: d - 0.5, c: c + 0.5, violated: false });
  }
  for (let r = 0; r < d - 1; r++) {
    State.zAncillas.push({ r: r + 0.5, c: -0.5, violated: false });
    State.zAncillas.push({ r: r + 0.5, c: d - 0.5, violated: false });
  }
}

// ═══════════════════════════════════════════════════════════
// SYNDROME EXTRACTION
// ═══════════════════════════════════════════════════════════
function extractSyndromes() {
  const d = State.d;

  function dataAt(r, c) {
    if (r < 0 || r >= d || c < 0 || c >= d) return null;
    return State.dataQubits[r * d + c];
  }

  // X-ancilla: detects Z errors on neighboring data qubits
  State.xAncillas.forEach(a => {
    const neighbors = [
      dataAt(Math.floor(a.r), Math.floor(a.c)),
      dataAt(Math.ceil(a.r),  Math.floor(a.c)),
      dataAt(Math.floor(a.r), Math.ceil(a.c)),
      dataAt(Math.ceil(a.r),  Math.ceil(a.c)),
    ].filter(Boolean);
    const zCount = neighbors.filter(q => q.error === 'Z' || q.error === 'Y').length;
    a.violated = zCount % 2 === 1;
  });

  // Z-ancilla: detects X errors on neighboring data qubits
  State.zAncillas.forEach(a => {
    const neighbors = [
      dataAt(Math.floor(a.r), Math.floor(a.c)),
      dataAt(Math.ceil(a.r),  Math.floor(a.c)),
      dataAt(Math.floor(a.r), Math.ceil(a.c)),
      dataAt(Math.ceil(a.r),  Math.ceil(a.c)),
    ].filter(Boolean);
    const xCount = neighbors.filter(q => q.error === 'X' || q.error === 'Y').length;
    a.violated = xCount % 2 === 1;
  });

  State.syndromeCount =
    State.xAncillas.filter(a => a.violated).length +
    State.zAncillas.filter(a => a.violated).length;

  checkLogicalError();
  updateSidebarState();
}

function checkLogicalError() {
  const d = State.d;
  // Logical X error: X chain spanning all rows in any column
  // Logical Z error: Z chain spanning all cols in any row
  let logX = false, logZ = false;
  for (let c = 0; c < d; c++) {
    if (State.dataQubits.filter(q => q.c === c && (q.error === 'X' || q.error === 'Y')).length === d) logX = true;
  }
  for (let r = 0; r < d; r++) {
    if (State.dataQubits.filter(q => q.r === r && (q.error === 'Z' || q.error === 'Y')).length === d) logZ = true;
  }
  State.logicalError = logX || logZ;
}

// ═══════════════════════════════════════════════════════════
// ERROR INJECTION
// ═══════════════════════════════════════════════════════════
function injectErrors() {
  const p = State.errorRate;
  State.dataQubits.forEach(q => {
    q.error = 'none';
    q.correction = false;
    const roll = Math.random();
    if (State.errorType === 'X' && roll < p) q.error = 'X';
    else if (State.errorType === 'Z' && roll < p) q.error = 'Z';
    else if (State.errorType === 'Y' && roll < p) q.error = 'Y';
    else if (State.errorType === 'depol') {
      if (roll < p / 3) q.error = 'X';
      else if (roll < 2 * p / 3) q.error = 'Z';
      else if (roll < p) q.error = 'Y';
    }
  });
  extractSyndromes();
  logComputation('// Errors injected');
  logComputation(`// Syndrome weight: ${State.syndromeCount}`);
  renderLattice();
  showPredictiveChallenge();
}

// ═══════════════════════════════════════════════════════════
// MINIMUM-WEIGHT DECODER (greedy approximation)
// ═══════════════════════════════════════════════════════════
function runDecoder() {
  State.dataQubits.forEach(q => q.correction = false);

  // For each violated X-ancilla, walk toward nearest violated X-ancilla (greedy)
  const viX = State.xAncillas.filter(a => a.violated);
  const viZ = State.zAncillas.filter(a => a.violated);

  function greedyMatch(violations, errorComp) {
    const used = new Set();
    violations.forEach((a, i) => {
      if (used.has(i)) return;
      let minDist = Infinity, minJ = -1;
      violations.forEach((b, j) => {
        if (i === j || used.has(j)) return;
        const dist = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
        if (dist < minDist) { minDist = dist; minJ = j; }
      });
      if (minJ !== -1) {
        used.add(i); used.add(minJ);
        const a2 = violations[minJ];
        // Mark corrections along path
        const rMin = Math.min(a.r, a2.r), rMax = Math.max(a.r, a2.r);
        const cMin = Math.min(a.c, a2.c), cMax = Math.max(a.c, a2.c);
        State.dataQubits.forEach(q => {
          if (q.r >= rMin && q.r <= rMax && q.c >= cMin && q.c <= cMax) {
            if ((errorComp === 'Z' && (q.error === 'Z' || q.error === 'Y')) ||
                (errorComp === 'X' && (q.error === 'X' || q.error === 'Y'))) {
              q.correction = true;
            }
          }
        });
      }
    });
  }

  greedyMatch(viX, 'Z');
  greedyMatch(viZ, 'X');
  logComputation('// Decoder ran MWPM (greedy approximation)');
  logComputation(`// Corrections applied: ${State.dataQubits.filter(q => q.correction).length}`);

  const el      = document.getElementById('lsChain');
  const correct = State.dataQubits.filter(q => q.correction).length;
  if (el) el.textContent = correct > 0 ? `${correct} qubit(s)` : '—';

  renderLattice();
}

// ═══════════════════════════════════════════════════════════
// LATTICE CANVAS RENDERER
// ═══════════════════════════════════════════════════════════
const CANVAS_PADDING = 48;
let latticeCanvas, lCtx;

function initLatticeCanvas() {
  latticeCanvas = document.getElementById('latticeCanvas');
  if (!latticeCanvas) return;
  lCtx = latticeCanvas.getContext('2d');
  resizeLatticeCanvas();
  window.addEventListener('resize', resizeLatticeCanvas);

  latticeCanvas.addEventListener('click', onLatticeClick);
  latticeCanvas.addEventListener('mousemove', onLatticeHover);
  latticeCanvas.addEventListener('mouseleave', () => {
    const tt = document.getElementById('overlayTooltip');
    if (tt) tt.style.display = 'none';
  });
}

function resizeLatticeCanvas() {
  if (!latticeCanvas) return;
  const wrapper = latticeCanvas.parentElement;
  const w = wrapper.clientWidth;
  const h = Math.max(350, Math.min(w * 0.75, 520));
  latticeCanvas.width  = w;
  latticeCanvas.height = h;
  renderLattice();
}

function cellSize() {
  if (!latticeCanvas) return 60;
  const usableW = latticeCanvas.width  - CANVAS_PADDING * 2;
  const usableH = latticeCanvas.height - CANVAS_PADDING * 2;
  return Math.min(usableW, usableH) / (State.d + 0.5);
}

function toCanvas(r, c) {
  const cs = cellSize();
  const ox  = (latticeCanvas.width  - cs * (State.d - 1)) / 2;
  const oy  = (latticeCanvas.height - cs * (State.d - 1)) / 2;
  return { x: ox + c * cs, y: oy + r * cs };
}

function renderLattice() {
  if (!lCtx) return;
  const W = latticeCanvas.width, H = latticeCanvas.height;
  lCtx.clearRect(0, 0, W, H);

  // Background grid ticks
  lCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  lCtx.lineWidth   = 1;
  const cs = cellSize();

  // Draw ancilla qubits (squares behind)
  [...State.xAncillas, ...State.zAncillas].forEach(a => {
    const isX = State.xAncillas.includes(a);
    const pos  = toCanvas(a.r, a.c);
    const size = cs * 0.36;
    const grd  = lCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size);

    if (a.violated) {
      grd.addColorStop(0, 'rgba(245,158,11,0.9)');
      grd.addColorStop(1, 'rgba(245,158,11,0.1)');
      // Pulse ring
      lCtx.beginPath();
      lCtx.arc(pos.x, pos.y, size * 1.8, 0, Math.PI * 2);
      lCtx.strokeStyle = 'rgba(245,158,11,0.35)';
      lCtx.lineWidth   = 1.5;
      lCtx.stroke();
    } else if (isX) {
      grd.addColorStop(0, 'rgba(239,68,68,0.25)');
      grd.addColorStop(1, 'rgba(239,68,68,0.03)');
    } else {
      grd.addColorStop(0, 'rgba(59,130,246,0.25)');
      grd.addColorStop(1, 'rgba(59,130,246,0.03)');
    }

    lCtx.fillStyle = grd;
    lCtx.fillRect(pos.x - size, pos.y - size, size * 2, size * 2);

    if (a.violated) {
      lCtx.strokeStyle = '#f59e0b';
      lCtx.lineWidth   = 1.5;
    } else {
      lCtx.strokeStyle = isX ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)';
      lCtx.lineWidth   = 1;
    }
    lCtx.setLineDash([3, 3]);
    lCtx.strokeRect(pos.x - size, pos.y - size, size * 2, size * 2);
    lCtx.setLineDash([]);
  });

  // Entanglement lines between data qubits
  lCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  lCtx.lineWidth   = 1;
  State.dataQubits.forEach(q => {
    const p = toCanvas(q.r, q.c);
    [[q.r, q.c + 1], [q.r + 1, q.c]].forEach(([nr, nc]) => {
      if (nr < State.d && nc < State.d) {
        const p2 = toCanvas(nr, nc);
        lCtx.beginPath();
        lCtx.moveTo(p.x, p.y);
        lCtx.lineTo(p2.x, p2.y);
        lCtx.stroke();
      }
    });
  });

  // Draw data qubits
  const R = cs * 0.22;
  State.dataQubits.forEach(q => {
    const pos = toCanvas(q.r, q.c);
    lCtx.beginPath();
    lCtx.arc(pos.x, pos.y, R, 0, Math.PI * 2);

    if (q.correction) {
      lCtx.fillStyle = 'rgba(16,185,129,0.5)';
      lCtx.shadowColor = '#10b981';
      lCtx.shadowBlur  = 12;
    } else if (q.error === 'X') {
      lCtx.fillStyle = 'rgba(239,68,68,0.8)';
      lCtx.shadowColor = '#ef4444';
      lCtx.shadowBlur  = 14;
    } else if (q.error === 'Z') {
      lCtx.fillStyle = 'rgba(59,130,246,0.8)';
      lCtx.shadowColor = '#3b82f6';
      lCtx.shadowBlur  = 14;
    } else if (q.error === 'Y') {
      lCtx.fillStyle = 'rgba(168,85,247,0.8)';
      lCtx.shadowColor = '#a855f7';
      lCtx.shadowBlur  = 14;
    } else {
      lCtx.fillStyle = 'rgba(148,163,184,0.35)';
      lCtx.shadowBlur = 0;
    }
    lCtx.fill();
    lCtx.shadowBlur = 0;

    lCtx.strokeStyle = q.error !== 'none'
      ? lCtx.fillStyle.replace('0.8', '1').replace('0.35', '0.6')
      : 'rgba(148,163,184,0.5)';
    lCtx.lineWidth = 1.5;
    lCtx.stroke();

    // Error label
    if (q.error !== 'none' && State.layer > 0) {
      lCtx.fillStyle = 'white';
      lCtx.font      = `bold ${Math.max(10, R * 1.1)}px JetBrains Mono, monospace`;
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      lCtx.fillText(q.error, pos.x, pos.y);
    }
  });

  // Syndrome count display
  updateSidebarState();
  updateFormalismPanels();
}

// ═══════════════════════════════════════════════════════════
// LATTICE INTERACTIONS
// ═══════════════════════════════════════════════════════════
function onLatticeClick(e) {
  const rect = latticeCanvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const cs   = cellSize();
  const hit  = State.dataQubits.find(q => {
    const p = toCanvas(q.r, q.c);
    return Math.hypot(p.x - mx, p.y - my) < cs * 0.28;
  });
  if (hit) {
    const cycle = ['none','X','Z','Y'];
    hit.error = cycle[(cycle.indexOf(hit.error) + 1) % cycle.length];
    extractSyndromes();
    renderLattice();
    logComputation(`// Clicked qubit [${hit.r},${hit.c}] → error: ${hit.error}`);
  }
}

function onLatticeHover(e) {
  const rect = latticeCanvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const cs   = cellSize();
  const wrap  = latticeCanvas.parentElement;
  const wRect = wrap.getBoundingClientRect();
  const tt    = document.getElementById('overlayTooltip');
  if (!tt) return;

  const hitQ = State.dataQubits.find(q => {
    const p = toCanvas(q.r, q.c);
    return Math.hypot(p.x - mx, p.y - my) < cs * 0.28;
  });

  if (hitQ) {
    tt.style.display  = 'block';
    tt.style.left     = `${e.clientX - wRect.left + 12}px`;
    tt.style.top      = `${e.clientY - wRect.top - 24}px`;
    tt.textContent    = `[${hitQ.r},${hitQ.c}] error:${hitQ.error} ${State.layer > 0 ? '· click to cycle' : ''}`;
    return;
  }

  const hitA = [...State.xAncillas, ...State.zAncillas].find(a => {
    const p = toCanvas(a.r, a.c);
    return Math.hypot(p.x - mx, p.y - my) < cs * 0.3;
  });

  if (hitA) {
    const isX = State.xAncillas.includes(hitA);
    tt.style.display  = 'block';
    tt.style.left     = `${e.clientX - wRect.left + 12}px`;
    tt.style.top      = `${e.clientY - wRect.top - 24}px`;
    tt.textContent    = `${isX ? 'X' : 'Z'}-stabilizer · ${hitA.violated ? '⚠ VIOLATED (syndrome)' : '✓ satisfied'}`;
  } else {
    tt.style.display  = 'none';
  }
}

// ═══════════════════════════════════════════════════════════
// ANYON BRAIDING
// ═══════════════════════════════════════════════════════════
let braidCanvas, bCtx, animFrame;

function initBraidingCanvas() {
  braidCanvas = document.getElementById('braidingCanvas');
  if (!braidCanvas) return;
  bCtx = braidCanvas.getContext('2d');
  resizeBraidingCanvas();
  window.addEventListener('resize', resizeBraidingCanvas);

  braidCanvas.addEventListener('mousedown', onBraidMouseDown);
  braidCanvas.addEventListener('mousemove', onBraidMouseMove);
  braidCanvas.addEventListener('mouseup',   onBraidMouseUp);
}

function resizeBraidingCanvas() {
  if (!braidCanvas) return;
  const w = braidCanvas.parentElement.clientWidth;
  const h = Math.max(350, Math.min(w * 0.75, 520));
  braidCanvas.width  = w;
  braidCanvas.height = h;
  renderBraiding();
}

function spawnAnyons() {
  buildLattice();
  State.anyons     = [];
  State.braidPaths = [];
  State.logicalXFlipped = false;
  State.logicalZFlipped = false;

  const d = State.d;
  // Spawn 2 e-type (red, from Z errors) and 2 m-type (blue, from X errors)
  const positions = [
    { r: 0.5, c: 0.5, type: 'e' },
    { r: d - 1.5, c: d - 1.5, type: 'e' },
    { r: 0.5, c: d - 1.5, type: 'm' },
    { r: d - 1.5, c: 0.5, type: 'm' },
  ];
  State.anyons = positions.map((a, i) => ({
    ...a, id: i,
    path: [{ r: a.r, c: a.c }],
    dragging: false,
  }));

  document.getElementById('braidStatus').textContent =
    'Drag anyons along the lattice. Wrapping around creates logical operations.';
  renderBraiding();
}

function toBraidCanvas(r, c) {
  const d  = State.d;
  const cs = Math.min(
    (braidCanvas.width  - CANVAS_PADDING * 2) / (d + 1),
    (braidCanvas.height - CANVAS_PADDING * 2) / (d + 1)
  );
  const ox = (braidCanvas.width  - cs * d) / 2;
  const oy = (braidCanvas.height - cs * d) / 2;
  return { x: ox + c * cs, y: oy + r * cs };
}

function renderBraiding() {
  if (!bCtx) return;
  const W = braidCanvas.width, H = braidCanvas.height;
  bCtx.clearRect(0, 0, W, H);

  const d  = State.d;
  const cs = Math.min(
    (braidCanvas.width  - CANVAS_PADDING * 2) / (d + 1),
    (braidCanvas.height - CANVAS_PADDING * 2) / (d + 1)
  );

  // Background grid
  for (let r = 0; r <= d; r++) {
    for (let c = 0; c <= d; c++) {
      const p = toBraidCanvas(r - 0.5, c - 0.5);
      bCtx.fillStyle = 'rgba(255,255,255,0.03)';
      bCtx.fillRect(p.x - cs / 2, p.y - cs / 2, cs, cs);
      bCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      bCtx.lineWidth   = 1;
      bCtx.strokeRect(p.x - cs / 2, p.y - cs / 2, cs, cs);
    }
  }

  // Draw braid paths
  State.braidPaths.forEach(path => {
    if (path.length < 2) return;
    bCtx.beginPath();
    const start = toBraidCanvas(path[0].r, path[0].c);
    bCtx.moveTo(start.x, start.y);
    path.slice(1).forEach(pt => {
      const p = toBraidCanvas(pt.r, pt.c);
      bCtx.lineTo(p.x, p.y);
    });
    bCtx.strokeStyle = path.type === 'e'
      ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.5)';
    bCtx.lineWidth   = 2;
    bCtx.setLineDash([4, 3]);
    bCtx.stroke();
    bCtx.setLineDash([]);
  });

  // Draw anyons
  State.anyons.forEach(a => {
    const pos    = toBraidCanvas(a.r, a.c);
    const color  = a.type === 'e' ? '#ef4444' : '#3b82f6';
    const R      = cs * 0.22;

    bCtx.beginPath();
    bCtx.arc(pos.x, pos.y, R * 1.6, 0, Math.PI * 2);
    bCtx.fillStyle   = color + '22';
    bCtx.fill();

    bCtx.beginPath();
    bCtx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
    bCtx.fillStyle   = color;
    bCtx.shadowColor = color;
    bCtx.shadowBlur  = 16;
    bCtx.fill();
    bCtx.shadowBlur  = 0;

    bCtx.fillStyle   = 'white';
    bCtx.font        = `bold ${Math.max(9, R * 0.9)}px JetBrains Mono, monospace`;
    bCtx.textAlign   = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText(a.type, pos.x, pos.y);
  });
}

function onBraidMouseDown(e) {
  const rect = braidCanvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const d    = State.d;
  const cs   = Math.min(
    (braidCanvas.width  - CANVAS_PADDING * 2) / (d + 1),
    (braidCanvas.height - CANVAS_PADDING * 2) / (d + 1)
  );

  State.anyons.forEach(a => {
    const pos = toBraidCanvas(a.r, a.c);
    if (Math.hypot(pos.x - mx, pos.y - my) < cs * 0.28) {
      a.dragging = true;
      State.dragAnyon = a;
    }
  });
}

function onBraidMouseMove(e) {
  if (!State.dragAnyon) return;
  const rect = braidCanvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const d    = State.d;
  const cs   = Math.min(
    (braidCanvas.width  - CANVAS_PADDING * 2) / (d + 1),
    (braidCanvas.height - CANVAS_PADDING * 2) / (d + 1)
  );
  const ox   = (braidCanvas.width  - cs * d) / 2;
  const oy   = (braidCanvas.height - cs * d) / 2;

  const snappedC = Math.max(-0.5, Math.min(d - 0.5, Math.round((mx - ox) / cs * 2) / 2));
  const snappedR = Math.max(-0.5, Math.min(d - 0.5, Math.round((my - oy) / cs * 2) / 2));

  if (snappedR !== State.dragAnyon.r || snappedC !== State.dragAnyon.c) {
    State.dragAnyon.r = snappedR;
    State.dragAnyon.c = snappedC;
    State.dragAnyon.path.push({ r: snappedR, c: snappedC });
    checkLogicalBraiding();
    renderBraiding();
  }
}

function onBraidMouseUp() {
  if (State.dragAnyon) {
    State.braidPaths.push({ ...State.dragAnyon.path.slice(), type: State.dragAnyon.type });
    State.dragAnyon.dragging = false;
    State.dragAnyon.path     = [{ r: State.dragAnyon.r, c: State.dragAnyon.c }];
    State.dragAnyon = null;
    renderBraiding();
  }
}

function checkLogicalBraiding() {
  const d = State.d;
  // Check if any anyon has swept across the full lattice (logical operation)
  State.anyons.forEach(a => {
    const path = a.path;
    if (path.length < 2) return;
    const minC = Math.min(...path.map(p => p.c));
    const maxC = Math.max(...path.map(p => p.c));
    const minR = Math.min(...path.map(p => p.r));
    const maxR = Math.max(...path.map(p => p.r));
    if (a.type === 'e' && maxC - minC >= d - 1) State.logicalZFlipped = !State.logicalZFlipped;
    if (a.type === 'm' && maxR - minR >= d - 1) State.logicalXFlipped = !State.logicalXFlipped;
  });

  const liX = document.getElementById('liX');
  const liZ = document.getElementById('liZ');
  if (liX) {
    liX.textContent = State.logicalXFlipped ? 'X̄ Applied!' : 'Identity';
    liX.className   = 'li-val' + (State.logicalXFlipped ? ' flipped' : '');
  }
  if (liZ) {
    liZ.textContent = State.logicalZFlipped ? 'Z̄ Applied!' : 'Identity';
    liZ.className   = 'li-val' + (State.logicalZFlipped ? ' flipped' : '');
  }

  const bs = document.getElementById('braidStatus');
  if (bs && (State.logicalXFlipped || State.logicalZFlipped)) {
    bs.textContent = '🎉 Logical operation applied! The anyon path crossed the lattice boundary.';
  }
}

// ═══════════════════════════════════════════════════════════
// MONTE CARLO THRESHOLD SIMULATION
// ═══════════════════════════════════════════════════════════
function initThresholdChart() {
  const ctx = document.getElementById('thresholdChart');
  if (!ctx) return;

  const colors = {
    3:  { border: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    5:  { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    7:  { border: '#06b6d4', bg: 'rgba(6,182,212,0.1)'  },
    9:  { border: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  };

  const datasets = [3, 5, 7, 9].map(d => ({
    label: `d = ${d}`,
    data: [],
    borderColor: colors[d].border,
    backgroundColor: colors[d].bg,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0.35,
    fill: false,
  }));

  State.thChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Space Grotesk', size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (c) => ` p_L = ${(c.parsed.y * 100).toFixed(2)}%`,
            title: (items) => `p_phys = ${items[0].label}%`,
          }
        },
        annotation: {
          annotations: {
            threshold: {
              type: 'line',
              xMin: '1.0', xMax: '1.0',
              borderColor: 'rgba(245,158,11,0.6)',
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                display: true,
                content: 'p_th ≈ 1%',
                color: '#f59e0b',
                font: { size: 11 },
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Physical Error Rate p (%)', color: '#64748b', font: { size: 11 } },
          ticks: { color: '#64748b' },
          grid:  { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          title: { display: true, text: 'Logical Error Rate p_L', color: '#64748b', font: { size: 11 } },
          ticks: { color: '#64748b', callback: v => (v * 100).toFixed(1) + '%' },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          min: 0, max: 0.6,
        }
      }
    }
  });
}

function logicalErrorRate(d, p, shots) {
  let logErrors = 0;
  for (let s = 0; s < shots; s++) {
    const errors = [];
    for (let i = 0; i < d * d; i++) {
      if (Math.random() < p) errors.push(i);
    }
    // Simplified: logical X error if any full column has X errors
    let logErr = false;
    for (let c = 0; c < d; c++) {
      let colErr = 0;
      for (let r = 0; r < d; r++) {
        if (errors.includes(r * d + c)) colErr++;
      }
      if (colErr > Math.floor((d - 1) / 2)) { logErr = true; break; }
    }
    if (logErr) logErrors++;
  }
  return logErrors / shots;
}

async function runMonteCarlo() {
  if (State.mcRunning) return;
  State.mcRunning = true;
  const btn = document.getElementById('btnRunMC');
  if (btn) btn.disabled = true;

  const shots      = parseInt(document.getElementById('shotsSlider').value);
  const pValues    = [0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const distances  = [3, 5, 7, 9];
  const checkboxes = {
    3: document.getElementById('cbD3')?.checked,
    5: document.getElementById('cbD5')?.checked,
    7: document.getElementById('cbD7')?.checked,
    9: document.getElementById('cbD9')?.checked,
  };
  const fill = document.getElementById('progressFill');
  const total = pValues.length * distances.filter(d => checkboxes[d]).length;
  let done = 0;

  State.thChart.data.labels   = pValues.map(p => p.toFixed(1));
  State.thChart.data.datasets.forEach(ds => { ds.data = []; });

  for (const p of pValues) {
    for (const [i, d] of distances.entries()) {
      if (!checkboxes[d]) {
        State.thChart.data.datasets[i].data.push(null);
        continue;
      }
      const pL = logicalErrorRate(d, p / 100, shots);
      State.thChart.data.datasets[i].data.push(pL);
      done++;
      if (fill) fill.style.width = `${(done / total) * 100}%`;
      State.thChart.update('none');
      await new Promise(r => setTimeout(r, 12));
    }
  }

  State.thChart.update();
  State.mcRunning = false;
  if (btn) btn.disabled = false;
  if (fill) fill.style.width = '100%';
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR & UI UPDATES
// ═══════════════════════════════════════════════════════════
function updateSidebarState() {
  const lsError  = document.getElementById('lsError');
  const lsWeight = document.getElementById('lsWeight');
  const lsZero   = document.getElementById('lsZero');

  if (lsWeight) lsWeight.textContent = State.syndromeCount;
  if (lsError) {
    lsError.textContent = State.logicalError ? 'Logical error!' : 'None';
    lsError.className   = 'ls-val' + (State.logicalError ? ' red' : '');
  }
  if (lsZero) {
    lsZero.textContent = State.logicalError ? '✗ Corrupted' : '✓ Protected';
    lsZero.className   = 'ls-val' + (State.logicalError ? ' red' : ' green');
  }

  const cvEl = document.getElementById('syndromeCountVal');
  if (cvEl) cvEl.textContent = State.syndromeCount;
}

function updateFormalismPanels() {
  const fps = [
    document.getElementById('formalismPanel'),
    document.getElementById('braidFormalismPanel'),
    document.getElementById('thrFormalismPanel'),
  ];
  const comp = document.getElementById('computationPanel');
  fps.forEach(fp => {
    if (fp) fp.style.display = State.layer === 1 ? 'flex' : 'none';
  });
  if (comp) comp.style.display = State.layer === 2 ? 'flex' : 'none';
}

function logComputation(msg) {
  const log = document.getElementById('computationLog');
  if (!log) return;
  log.textContent += '\n' + msg;
  log.scrollTop    = log.scrollHeight;
}

// ═══════════════════════════════════════════════════════════
// PREDICTIVE CHALLENGE
// ═══════════════════════════════════════════════════════════
let correctAnswer = true;

function showPredictiveChallenge() {
  const box = document.getElementById('predictiveChallenge');
  const q   = document.getElementById('challengeQ');
  const res = document.getElementById('challengeResult');
  if (!box || !q) return;

  correctAnswer = State.syndromeCount <= Math.floor((State.d - 1) / 2) * 2;
  q.textContent  = `Syndrome weight = ${State.syndromeCount}. Will the decoder correct all errors?`;
  if (res) res.style.display = 'none';
  box.style.display = 'block';
}

function handleChallenge(guess) {
  const res = document.getElementById('challengeResult');
  if (!res) return;
  const correct = guess === correctAnswer;
  res.textContent   = correct
    ? '✅ Correct! Good quantum intuition.'
    : `❌ Not quite. ${correctAnswer ? 'The decoder should succeed.' : 'Too many errors to correct!'}`;
  res.style.color   = correct ? 'var(--green)' : '#ef4444';
  res.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════
function wireEvents() {
  // Layer toggle
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.layer = parseInt(btn.dataset.layer);
      updateFormalismPanels();

      // Update about text
      const aboutText = document.getElementById('aboutText');
      if (aboutText && State.layer === 1) {
        aboutText.querySelector('p').textContent =
          'Stabilizers A_v = ⊗X_e and B_p = ⊗Z_e commute with all logical operators. Syndromes s_v ∈ {0,1} identify error locations.';
      }
    });
  });

  // Tabs
  document.querySelectorAll('.sc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      State.activeTab = tab.dataset.tab;
      document.getElementById(`tabContent${capitalize(tab.dataset.tab)}`).classList.add('active');

      if (tab.dataset.tab === 'braiding' && State.anyons.length === 0) spawnAnyons();
      if (tab.dataset.tab === 'threshold') initThresholdChart();
    });
  });

  // Distance buttons
  document.querySelectorAll('.dist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dist-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.d = parseInt(btn.dataset.d);
      buildLattice();
      extractSyndromes();
      renderLattice();
    });
  });

  // Error type
  document.querySelectorAll('.etype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.closest('#braidOpX, #braidOpZ, #braidOpReset')) return;
      document.querySelectorAll('#errorTypeGroup .etype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.errorType = btn.dataset.type;
    });
  });

  // Error rate slider
  const erSlider = document.getElementById('errorRateSlider');
  if (erSlider) erSlider.addEventListener('input', () => {
    State.errorRate = parseInt(erSlider.value) / 100;
    document.getElementById('errorRateVal').textContent = `${erSlider.value}%`;
  });

  // Shots slider
  const shotsSlider = document.getElementById('shotsSlider');
  if (shotsSlider) shotsSlider.addEventListener('input', () => {
    document.getElementById('shotsVal').textContent = shotsSlider.value;
  });

  // Action buttons
  document.getElementById('btnInjectErrors')?.addEventListener('click', injectErrors);
  document.getElementById('btnRunDecoder')?.addEventListener('click', runDecoder);
  document.getElementById('btnReset')?.addEventListener('click', () => {
    buildLattice();
    extractSyndromes();
    renderLattice();
    const log = document.getElementById('computationLog');
    if (log) log.textContent = '// Reset\n// Inject errors to begin...';
    document.getElementById('predictiveChallenge').style.display = 'none';
  });

  // Braiding
  document.getElementById('btnSpawnAnyons')?.addEventListener('click', spawnAnyons);
  document.getElementById('btnClearBraiding')?.addEventListener('click', () => {
    State.anyons = [];
    State.braidPaths = [];
    State.logicalXFlipped = false;
    State.logicalZFlipped = false;
    const liX = document.getElementById('liX'); if (liX) { liX.textContent = 'Identity'; liX.className = 'li-val'; }
    const liZ = document.getElementById('liZ'); if (liZ) { liZ.textContent = 'Identity'; liZ.className = 'li-val'; }
    renderBraiding();
  });

  document.getElementById('braidOpX')?.addEventListener('click', () => { State.braidOp = 'X'; });
  document.getElementById('braidOpZ')?.addEventListener('click', () => { State.braidOp = 'Z'; });
  document.getElementById('braidOpReset')?.addEventListener('click', () => {
    State.braidPaths = [];
    renderBraiding();
  });

  // Threshold
  document.getElementById('btnRunMC')?.addEventListener('click', runMonteCarlo);
  document.getElementById('btnClearChart')?.addEventListener('click', () => {
    if (State.thChart) {
      State.thChart.data.labels   = [];
      State.thChart.data.datasets.forEach(ds => { ds.data = []; });
      State.thChart.update();
    }
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = '0%';
  });

  // Predictive challenge
  document.getElementById('challengeA')?.addEventListener('click', () => handleChallenge(true));
  document.getElementById('challengeB')?.addEventListener('click', () => handleChallenge(false));
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildLattice();
  initLatticeCanvas();
  initBraidingCanvas();
  wireEvents();
  wireThemeToggle();
  renderLattice();
  updateFormalismPanels();

  // Navbar scroll
  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nb?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
});
