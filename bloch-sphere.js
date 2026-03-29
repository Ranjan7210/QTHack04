/* ============================================================
   Bloch Sphere 3D Engine — bloch-sphere.js
   (Pure Canvas 2D with 3D projection, no Three.js dependency)
   ============================================================ */
'use strict';

// ─── Theme (synced across pages) ─────────────────────────────
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
  });
}


const BS = {
  theta: 0,   // polar angle (radians)
  phi:   0,   // azimuthal angle (radians)
  // Camera rotation
  camTheta: Math.PI / 5,
  camPhi:   -Math.PI / 6,
  dragging: false,
  lastMouse: { x: 0, y: 0 },
  animating: false,
  targetTheta: 0,
  targetPhi: 0,
  gateHistory: [],
  layer: 0,
};

// ─── Canvas & Context ─────────────────────────────────────
let canvas, ctx, W, H, CX, CY, R;

function init() {
  canvas = document.getElementById('blochCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
  canvas.addEventListener('touchend',   onTouchEnd);

  wireUI();
  loop();
}

function resize() {
  const wrap = canvas.parentElement;
  W = wrap.clientWidth;
  H = Math.max(360, Math.min(W * 0.72, 520));
  canvas.width  = W;
  canvas.height = H;
  CX = W / 2;
  CY = H / 2;
  R  = Math.min(W, H) * 0.34;
  positionAxisLabels();
}

// ─── 3D → 2D Projection ──────────────────────────────────
function project(x, y, z) {
  // Rotate by camera angles
  const cosT = Math.cos(BS.camTheta), sinT = Math.sin(BS.camTheta);
  const cosP = Math.cos(BS.camPhi),   sinP = Math.sin(BS.camPhi);

  // Rotate around Y axis by camPhi
  const x1 =  x * cosP + z * sinP;
  const y1 =  y;
  const z1 = -x * sinP + z * cosP;

  // Rotate around X axis by camTheta
  const x2 = x1;
  const y2 = y1 * cosT - z1 * sinT;
  const z2 = y1 * sinT + z1 * cosT;

  const perspective = 2.5;
  const scale = perspective / (perspective + z2 / R);
  return {
    x: CX + x2 * R * scale,
    y: CY - y2 * R * scale,
    z: z2,
    scale,
  };
}

// ─── State vector cartesian ───────────────────────────────
function stateXYZ() {
  return {
    x: Math.sin(BS.theta) * Math.cos(BS.phi),
    y: Math.cos(BS.theta),
    z: Math.sin(BS.theta) * Math.sin(BS.phi),
  };
}

// ─── Main render loop ─────────────────────────────────────
function loop() {
  if (BS.animating) {
    const dt = 0.08;
    const dTheta = BS.targetTheta - BS.theta;
    const dPhi   = BS.targetPhi   - BS.phi;
    if (Math.abs(dTheta) < 0.005 && Math.abs(dPhi) < 0.005) {
      BS.theta = BS.targetTheta;
      BS.phi   = BS.targetPhi;
      BS.animating = false;
    } else {
      BS.theta += dTheta * dt * 5;
      BS.phi   += dPhi   * dt * 5;
    }
    updateUI();
  }
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Outer glow
  const grd = ctx.createRadialGradient(CX, CY, R * 0.6, CX, CY, R * 1.2);
  grd.addColorStop(0, 'rgba(139,92,246,0.04)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Equatorial circle
  drawCircle3D(0, 1, 0, R, 'rgba(255,255,255,0.08)', 1);
  // Meridian circles
  drawCircle3D(0, 0, 1, R, 'rgba(255,255,255,0.06)', 1);
  drawCircle3D(1, 0, 0, R, 'rgba(255,255,255,0.06)', 1);

  // Sphere outline
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139,92,246,0.2)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Sphere fill (subtle)
  const sphereFill = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
  sphereFill.addColorStop(0, 'rgba(139,92,246,0.06)');
  sphereFill.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = sphereFill;
  ctx.fill();

  // Axes
  drawAxis( 0,  1,  0, '|0⟩',  '#94a3b8');
  drawAxis( 0, -1,  0, '|1⟩',  '#94a3b8');
  drawAxis( 1,  0,  0, '|+⟩',  'rgba(148,163,184,0.5)');
  drawAxis(-1,  0,  0, '|−⟩',  'rgba(148,163,184,0.5)');
  drawAxis( 0,  0,  1, '|i⟩',  'rgba(148,163,184,0.4)');
  drawAxis( 0,  0, -1, '|−i⟩', 'rgba(148,163,184,0.4)');

  // State vector
  const sv = stateXYZ();
  const tip = project(sv.x, sv.y, sv.z);
  const base = project(0, 0, 0);

  // Probability amplitudes as colored arcs
  const p0 = Math.pow(Math.cos(BS.theta / 2), 2);
  const t0 = project(0, 1, 0);
  const t1 = project(0, -1, 0);

  // Draw |0⟩ contribution arc on left
  ctx.beginPath();
  ctx.arc(CX - R * 1.12, CY, R * 0.1, -Math.PI * 0.9 * p0, Math.PI * 0.9 * p0);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw |1⟩ contribution arc on right
  ctx.beginPath();
  ctx.arc(CX + R * 1.12, CY, R * 0.1, Math.PI - Math.PI * 0.9 * (1 - p0), Math.PI * 0.9 * (1 - p0));
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Dashed projection lines
  drawDashedLine(tip, project(sv.x, 0, sv.z), 'rgba(139,92,246,0.3)');
  drawDashedLine(project(sv.x, 0, sv.z), project(0, 0, 0), 'rgba(139,92,246,0.15)');

  // Phase arc (in equatorial plane)
  if (Math.abs(BS.theta - Math.PI / 2) < 1.4) {
    ctx.beginPath();
    const arcSteps = 32;
    for (let i = 0; i <= arcSteps; i++) {
      const a = (i / arcSteps) * BS.phi;
      const px = Math.sin(BS.theta) * 0.6 * Math.cos(a);
      const pz = Math.sin(BS.theta) * 0.6 * Math.sin(a);
      const pp = project(px, 0, pz);
      if (i === 0) ctx.moveTo(pp.x, pp.y);
      else        ctx.lineTo(pp.x, pp.y);
    }
    ctx.strokeStyle = 'rgba(6,182,212,0.4)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // State vector arrow
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(tip.x, tip.y);
  const arrowGrad = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
  arrowGrad.addColorStop(0, 'rgba(139,92,246,0.5)');
  arrowGrad.addColorStop(1, '#a855f7');
  ctx.strokeStyle = arrowGrad;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const aLen  = 10;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - aLen * Math.cos(angle - 0.4), tip.y - aLen * Math.sin(angle - 0.4));
  ctx.lineTo(tip.x - aLen * Math.cos(angle + 0.4), tip.y - aLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = '#a855f7';
  ctx.fill();

  // State vector tip glow
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
  const tipGrd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 7);
  tipGrd.addColorStop(0, 'rgba(168,85,247,1)');
  tipGrd.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = tipGrd;
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur  = 20;
  ctx.fill();
  ctx.shadowBlur  = 0;
}

function drawAxis(x, y, z, label, color) {
  const tip  = project(x * 0.95, y * 0.95, z * 0.95);
  const base = project(0, 0, 0);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCircle3D(nx, ny, nz, radius, color, lineWidth) {
  // Draw a great circle perpendicular to normal (nx,ny,nz)
  const steps = 64;
  // Two perpendicular vectors to normal
  let ux, uy, uz, vx, vy, vz;
  if (Math.abs(nx) < 0.9) { ux=0; uy=nz; uz=-ny; }
  else                     { ux=-ny; uy=nx; uz=0; }
  const ul = Math.sqrt(ux*ux+uy*uy+uz*uz);
  ux/=ul; uy/=ul; uz/=ul;
  // v = n × u
  vx = ny*uz - nz*uy;
  vy = nz*ux - nx*uz;
  vz = nx*uy - ny*ux;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a  = (i / steps) * Math.PI * 2;
    const px = (ux * Math.cos(a) + vx * Math.sin(a)) * radius / R;
    const py = (uy * Math.cos(a) + vy * Math.sin(a)) * radius / R;
    const pz = (uz * Math.cos(a) + vz * Math.sin(a)) * radius / R;
    const pp = project(px, py, pz);
    if (i === 0) ctx.moveTo(pp.x, pp.y);
    else        ctx.lineTo(pp.x, pp.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.stroke();
}

function drawDashedLine(p1, p2, color) {
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ─── Axis label positioning ───────────────────────────────
function positionAxisLabels() {
  const axes = [
    { id:'lblZ1', x:0,  y:1,  z:0  },
    { id:'lblZm', x:0,  y:-1, z:0  },
    { id:'lblX1', x:1,  y:0,  z:0  },
    { id:'lblXm', x:-1, y:0,  z:0  },
    { id:'lblY1', x:0,  y:0,  z:1  },
    { id:'lblYm', x:0,  y:0,  z:-1 },
  ];
  axes.forEach(a => {
    const el = document.getElementById(a.id);
    if (!el) return;
    const p = project(a.x * 1.1, a.y * 1.1, a.z * 1.1);
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
  });
}

// ─── Camera drag ──────────────────────────────────────────
function onMouseDown(e) {
  BS.dragging   = true;
  BS.lastMouse  = { x: e.clientX, y: e.clientY };
}
function onMouseMove(e) {
  if (!BS.dragging) return;
  const dx = e.clientX - BS.lastMouse.x;
  const dy = e.clientY - BS.lastMouse.y;
  BS.camPhi   += dx * 0.008;
  BS.camTheta += dy * 0.008;
  BS.camTheta  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, BS.camTheta));
  BS.lastMouse = { x: e.clientX, y: e.clientY };
  positionAxisLabels();
}
function onMouseUp() { BS.dragging = false; }

function onTouchStart(e) {
  BS.dragging  = true;
  BS.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchMove(e) {
  if (!BS.dragging) return;
  const dx = e.touches[0].clientX - BS.lastMouse.x;
  const dy = e.touches[0].clientY - BS.lastMouse.y;
  BS.camPhi   += dx * 0.01;
  BS.camTheta += dy * 0.01;
  BS.camTheta  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, BS.camTheta));
  BS.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchEnd() { BS.dragging = false; }

// ─── Gate application ─────────────────────────────────────
const DEG = Math.PI / 180;

function applyGate(gate, angleRad) {
  const t = BS.theta, p = BS.phi;
  let nt = t, np = p;

  if (gate === 'X') { nt = Math.PI - t; np = Math.PI + p; }
  else if (gate === 'Y') { nt = Math.PI - t; np = p; }
  else if (gate === 'Z') { np = p + Math.PI; }
  else if (gate === 'H') {
    // H maps |0⟩→|+⟩, |1⟩→|−⟩
    const cos_t2 = Math.cos(t/2), sin_t2 = Math.sin(t/2);
    const a_re =  (cos_t2 + sin_t2 * Math.cos(p)) / Math.SQRT2;
    const a_im =  sin_t2 * Math.sin(p) / Math.SQRT2;
    const b_re = (cos_t2 - sin_t2 * Math.cos(p)) / Math.SQRT2;
    const b_im = -sin_t2 * Math.sin(p) / Math.SQRT2;
    const amp_a = Math.sqrt(a_re*a_re + a_im*a_im);
    const amp_b = Math.sqrt(b_re*b_re + b_im*b_im);
    nt = 2 * Math.acos(Math.min(1, amp_a));
    np = Math.atan2(b_im * amp_a - a_im * amp_b, b_re * amp_a - a_re * amp_b);
  }
  else if (gate === 'S') { np = p + Math.PI / 2; }
  else if (gate === 'T') { np = p + Math.PI / 4; }
  else if (gate === 'Rx') {
    // Rx(angle): rotates on Bloch sphere around X axis
    const a = angleRad || Math.PI / 2;
    // simplified: just rotate theta and phi around X
    nt = Math.acos(Math.cos(a/2) * Math.cos(t) - Math.sin(a/2) * Math.sin(t) * Math.sin(p));
    np = p + Math.atan2(Math.sin(a/2) * Math.cos(t), Math.cos(a/2) * Math.sin(t));
  }
  else if (gate === 'Rz') {
    const a = angleRad || Math.PI / 2;
    np = p + a;
  }

  // Normalize phi
  while (np < 0) np += 2 * Math.PI;
  while (np > 2 * Math.PI) np -= 2 * Math.PI;
  nt = Math.max(0, Math.min(Math.PI, nt));

  animateTo(nt, np);
  addHistory(gate, angleRad);
}

function animateTo(theta, phi) {
  BS.targetTheta = theta;
  BS.targetPhi   = phi;
  BS.animating   = true;
}

function addHistory(gate, angle) {
  BS.gateHistory.push({ gate, angle });
  const hist = document.getElementById('gateHistory');
  if (!hist) return;
  const empty = hist.querySelector('.history-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'history-entry';
  entry.innerHTML = `<span class="history-gate">${gate}${angle ? `(${Math.round(angle / DEG)}°)` : ''}</span>`;
  hist.appendChild(entry);
  hist.scrollTop = hist.scrollHeight;
}

// ─── UI Updates ───────────────────────────────────────────
function updateUI() {
  const t = BS.theta, p = BS.phi;
  const p0 = Math.pow(Math.cos(t / 2), 2);
  const p1 = 1 - p0;

  document.getElementById('dispTheta').textContent = `${Math.round(t / DEG)}°`;
  document.getElementById('dispPhi').textContent   = `${Math.round(p / DEG)}°`;
  document.getElementById('dispP0').textContent    = p0.toFixed(3);
  document.getElementById('dispP1').textContent    = p1.toFixed(3);

  // State equation
  const tSlider = document.getElementById('thetaSlider');
  const pSlider = document.getElementById('phiSlider');
  if (tSlider) tSlider.value = Math.round(t / DEG);
  if (pSlider) pSlider.value = Math.round(p / DEG);
  document.getElementById('thetaVal').textContent = `${Math.round(t / DEG)}°`;
  document.getElementById('phiVal').textContent   = `${Math.round(p / DEG)}°`;

  let eqText;
  if (t < 0.05) eqText = '|ψ⟩ = |0⟩';
  else if (t > Math.PI - 0.05) eqText = '|ψ⟩ = |1⟩';
  else if (Math.abs(t - Math.PI/2) < 0.05 && p < 0.05) eqText = '|ψ⟩ = |+⟩';
  else if (Math.abs(t - Math.PI/2) < 0.05 && Math.abs(p - Math.PI) < 0.05) eqText = '|ψ⟩ = |−⟩';
  else {
    const phaseStr = p < 0.05 ? '' : `e^(i·${Math.round(p/DEG)}°)`;
    eqText = `|ψ⟩ = ${p0.toFixed(2)}^½|0⟩ + ${phaseStr}${p1.toFixed(2)}^½|1⟩`;
  }
  document.getElementById('stateEq').textContent = eqText;

  positionAxisLabels();
}

// ─── Wire UI ──────────────────────────────────────────────
function wireUI() {
  // Gate buttons
  document.querySelectorAll('.gate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const gate = btn.dataset.gate;
      const angleCtrl = document.getElementById('angleCtrl');
      if (gate === 'Rx' || gate === 'Rz') {
        angleCtrl.style.display = 'flex';
        document.getElementById('applyRotBtn').onclick = () => {
          const angle = parseInt(document.getElementById('rotAngle').value) * DEG;
          applyGate(gate, angle);
        };
      } else {
        if (angleCtrl) angleCtrl.style.display = 'none';
        applyGate(gate);
      }
    });
  });

  document.getElementById('rotAngle')?.addEventListener('input', e => {
    document.getElementById('rotAngleVal').textContent = `${e.target.value}°`;
  });

  // Sliders
  document.getElementById('thetaSlider')?.addEventListener('input', e => {
    BS.theta = parseInt(e.target.value) * DEG;
    BS.animating = false;
    document.getElementById('thetaVal').textContent = `${e.target.value}°`;
    updateUI();
  });

  document.getElementById('phiSlider')?.addEventListener('input', e => {
    BS.phi = parseInt(e.target.value) * DEG;
    BS.animating = false;
    document.getElementById('phiVal').textContent = `${e.target.value}°`;
    updateUI();
  });

  // Preset states
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      animateTo(
        parseFloat(btn.dataset.theta) * DEG,
        parseFloat(btn.dataset.phi)   * DEG
      );
    });
  });

  // Reset
  document.getElementById('btnResetState')?.addEventListener('click', () => {
    animateTo(0, 0);
    document.getElementById('gateHistory').innerHTML = '<span class="history-empty">No gates applied yet</span>';
    BS.gateHistory = [];
  });

  // Layer toggle
  document.querySelectorAll('#bsLayerToggle .layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#bsLayerToggle .layer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      BS.layer = parseInt(btn.dataset.layer);
    });
  });

  // Navbar scroll
  const nb = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nb?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ─── Start ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  wireThemeToggle();
});
