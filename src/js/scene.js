/* The hero scene: an era backdrop that grows with your hardware, the tappable CPU, circuit traces with data pulses,
   floating earnings, and traffic spikes. Static parts are baked into an offscreen canvas; only lights and motion are live. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  let cv, g, W = 0, H = 0, dpr = 1;
  let bake = null, bakeKey = '';
  let chip = { x: 0, y: 0, s: 100 };
  let traces = [], pulses = [], floats = [], ripples = [], sparks = [];
  let press = 0, pulseAcc = 0;
  let spike = null;
  const ERAS = [
    { name: 'desk', accent: '#3dff8a', sub: '#174d31', ihs: ['#2a2e35', '#16191e'], label: 'SF-01', text: '#d7dde5' },
    { name: 'room', accent: '#6fd3ff', sub: '#173f33', ihs: ['#d5dae2', '#8a929e'], label: 'SF-X16', text: '#3a414c' },
    { name: 'hall', accent: '#9aa6ff', sub: '#18304f', ihs: ['#6d7686', '#3a404b'], label: 'SF-9000', text: '#dfe5ee' },
    { name: 'orbit', accent: '#ffd24a', sub: '#4a3712', ihs: ['#f2d27a', '#b48a2c'], label: 'SF-ORBIT', text: '#4a3510' },
    { name: 'cosmos', accent: '#ff7be0', sub: '#22123a', ihs: null, label: 'SF-∞', text: '#fff0fb' },
  ];
  const eraOf = (tier) => (tier < 3 ? 0 : tier < 6 ? 1 : tier < 9 ? 2 : tier < 12 ? 3 : 4);

  function rng(seed) { let s = (seed ^ 0x9e3779b9) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function init(canvas) { cv = canvas; g = cv.getContext('2d'); }
  function resize(w, h) {
    dpr = Math.min(2, root.devicePixelRatio || 1);
    W = Math.max(1, w); H = Math.max(1, h);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const s = Math.min(W * 0.42, H * 0.5, 230);
    chip = { x: W / 2, y: H * 0.5, s };
    buildTraces();
    bakeKey = '';
  }

  // ---------------- circuit traces from the chip's pins to the edges
  function buildTraces() {
    traces = [];
    const { x, y, s } = chip, half = s / 2, r = rng(7);
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < 5; k++) {
        const t = (k - 2) * s * 0.17;
        const dir = side === 0 ? [0, -1] : side === 1 ? [1, 0] : side === 2 ? [0, 1] : [-1, 0];
        const perp = [-dir[1], dir[0]];
        const start = [x + dir[0] * (half + s * 0.08) + perp[0] * t, y + dir[1] * (half + s * 0.08) + perp[1] * t];
        const out1 = s * (0.12 + r() * 0.25);
        const p1 = [start[0] + dir[0] * out1, start[1] + dir[1] * out1];
        const bend = (k - 2) * s * (0.12 + r() * 0.1);
        const p2 = [p1[0] + dir[0] * Math.abs(bend) + perp[0] * bend, p1[1] + dir[1] * Math.abs(bend) + perp[1] * bend];
        const far = 2000;
        const p3 = [p2[0] + dir[0] * far, p2[1] + dir[1] * far];
        const pts = [start, p1, p2, p3];
        const len = [0];
        for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        traces.push({ pts, len });
      }
    }
  }
  function along(tr, d) {
    const { pts, len } = tr;
    for (let i = 1; i < pts.length; i++) {
      if (d <= len[i]) { const f = (d - len[i - 1]) / (len[i] - len[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
    }
    return pts[pts.length - 1];
  }

  // ---------------- baked backdrop
  function detailKey(v) {
    const o = v.owned;
    const era = eraOf(v.tier);
    const c = (id) => Math.min(o[id] || 0, 12);
    if (era === 0) return [c('pi'), c('laptop'), c('nas')].join(',');
    if (era === 1) return [Math.min(14, (o.tower || 0) + (o.rack || 0) + (o.room || 0))].join(',');
    if (era === 2) return [Math.min(3, Math.ceil(((o.colo || 0) + (o.dc || 0) + (o.campus || 0)) / 15))].join(',');
    if (era === 3) return [o.cable ? 1 : 0, o.lunar ? 1 : 0].join(',');
    return [o.brain ? 1 : 0, o.universe ? 1 : 0].join(',');
  }
  let leds = [];
  function makeBake(v) {
    const era = eraOf(v.tier);
    const key = `${W}x${H}@${dpr}|${era}|${detailKey(v)}`;
    if (key === bakeKey && bake) return;
    bakeKey = key;
    if (!bake) bake = document.createElement('canvas');
    bake.width = cv.width; bake.height = cv.height;
    const b = bake.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    leds = [];
    [bakeDesk, bakeRoom, bakeHall, bakeOrbit, bakeCosmos][era](b, v, rng(31 + era));
    leds.sort((a, c) => (a.color < c.color ? -1 : a.color > c.color ? 1 : 0));
    // traces
    const E = ERAS[era];
    b.lineCap = 'round'; b.lineJoin = 'round';
    for (const tr of traces) {
      b.strokeStyle = 'rgba(0,0,0,0.35)'; b.lineWidth = 4; poly(b, tr.pts);
      b.strokeStyle = hexA(E.accent, 0.16); b.lineWidth = 2; poly(b, tr.pts);
      b.fillStyle = hexA(E.accent, 0.35); b.beginPath(); b.arc(tr.pts[1][0], tr.pts[1][1], 1.8, 0, TAU); b.arc(tr.pts[2][0], tr.pts[2][1], 1.8, 0, TAU); b.fill();
    }
    // vignette
    const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    b.fillStyle = vg; b.fillRect(0, 0, W, H);
  }
  function poly(b, pts) { b.beginPath(); b.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) b.lineTo(pts[i][0], pts[i][1]); b.stroke(); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function led(x, y, color, rate) { leds.push({ x, y, color, phase: Math.random() * TAU, rate: rate || (0.6 + Math.random() * 2.5) }); }
  function stars(b, r, n, maxY) {
    for (let i = 0; i < n; i++) {
      const s = r() < 0.08 ? 1.6 : r() < 0.3 ? 1.1 : 0.7;
      b.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`; b.fillRect(r() * W, r() * (maxY || H), s, s);
    }
  }

  function bakeDesk(b, v, r) {
    let gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16243a'); gr.addColorStop(1, '#0c1522');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    // window
    const wx = W * 0.06, wy = H * 0.1, ww = W * 0.34, wh = H * 0.42;
    gr = b.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#0b1a33'); gr.addColorStop(1, '#25446b');
    b.fillStyle = gr; b.fillRect(wx, wy, ww, wh);
    b.save(); b.beginPath(); b.rect(wx, wy, ww, wh); b.clip();
    for (let i = 0; i < 30; i++) { b.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; b.fillRect(wx + r() * ww, wy + r() * wh * 0.5, 1, 1); }
    b.fillStyle = '#e8eef9'; b.beginPath(); b.arc(wx + ww * 0.75, wy + wh * 0.22, Math.min(ww, wh) * 0.09, 0, TAU); b.fill();
    let x = wx;
    while (x < wx + ww) {
      const bw = ww * (0.08 + r() * 0.12), bh = wh * (0.2 + r() * 0.45);
      b.fillStyle = '#0a1220'; b.fillRect(x, wy + wh - bh, bw, bh);
      for (let yy = wy + wh - bh + 4; yy < wy + wh - 3; yy += 5) for (let xx = x + 2; xx < x + bw - 2; xx += 4) if (r() < 0.25) { b.fillStyle = r() < 0.8 ? 'rgba(255,214,120,0.8)' : 'rgba(140,200,255,0.8)'; b.fillRect(xx, yy, 1.6, 2); }
      x += bw + 1;
    }
    b.restore();
    b.strokeStyle = '#2b3a52'; b.lineWidth = 4; b.strokeRect(wx, wy, ww, wh);
    b.lineWidth = 2; b.beginPath(); b.moveTo(wx + ww / 2, wy); b.lineTo(wx + ww / 2, wy + wh); b.moveTo(wx, wy + wh / 2); b.lineTo(wx + ww, wy + wh / 2); b.stroke();
    // shelf with a few things on the right wall
    const sx = W * 0.66, sy = H * 0.26;
    b.fillStyle = '#2a2019'; b.fillRect(sx, sy, W * 0.3, 5);
    [[0.02, 22, '#7a4f9e'], [0.05, 26, '#3f6fb5'], [0.08, 19, '#b5523f'], [0.11, 24, '#3a8a5c']].forEach(([fx, h, c]) => { b.fillStyle = c; b.fillRect(sx + W * fx, sy - h, W * 0.025, h); });
    b.fillStyle = '#3b6b3f'; b.beginPath(); b.arc(sx + W * 0.24, sy - 12, 10, 0, TAU); b.fill(); b.fillStyle = '#8a5a3b'; b.fillRect(sx + W * 0.225, sy - 7, 14, 7);
    // warm lamp glow
    gr = b.createRadialGradient(W * 0.95, H * 0.55, 0, W * 0.95, H * 0.55, W * 0.6);
    gr.addColorStop(0, 'rgba(255,170,80,0.18)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    // desk
    const dy = H * 0.8;
    gr = b.createLinearGradient(0, dy, 0, H); gr.addColorStop(0, '#3a2b20'); gr.addColorStop(1, '#1c140f');
    b.fillStyle = gr; b.fillRect(0, dy, W, H - dy);
    b.fillStyle = 'rgba(255,200,150,0.12)'; b.fillRect(0, dy, W, 2);
    // gear on the desk, both sides of the CPU
    const o = v.owned;
    const items = [];
    for (let i = 0; i < Math.min(o.nas || 0, 4); i++) items.push('nas');
    for (let i = 0; i < Math.min(o.laptop || 0, 4); i++) items.push('laptop');
    for (let i = 0; i < Math.min(o.pi || 0, 6); i++) items.push('pi');
    const slots = [];
    const leftEnd = chip.x - chip.s * 0.75, rightStart = chip.x + chip.s * 0.75;
    let lx = 8, rx = W - 8;
    items.forEach((it, i) => {
      const w = it === 'nas' ? 26 : it === 'laptop' ? 40 : 22;
      if (i % 2 === 0 && lx + w < leftEnd) { slots.push([it, lx]); lx += w + 6; }
      else if (rx - w > rightStart) { rx -= w; slots.push([it, rx]); rx -= 6; }
      else if (lx + w < leftEnd) { slots.push([it, lx]); lx += w + 6; }
    });
    for (const [it, x0] of slots) {
      if (it === 'nas') {
        b.fillStyle = '#20252f'; b.fillRect(x0, dy - 32, 26, 32); b.strokeStyle = '#4a5468'; b.lineWidth = 1; b.strokeRect(x0 + 0.5, dy - 31.5, 25, 31);
        for (let k = 0; k < 4; k++) { b.fillStyle = '#323a49'; b.fillRect(x0 + 4, dy - 28 + k * 7, 14, 4); led(x0 + 21, dy - 26 + k * 7, '#3dff8a', 3 + Math.random() * 4); }
      } else if (it === 'laptop') {
        b.fillStyle = '#4a5265'; b.beginPath(); b.moveTo(x0, dy); b.lineTo(x0 + 40, dy); b.lineTo(x0 + 37, dy - 5); b.lineTo(x0 + 3, dy - 5); b.fill();
        b.fillStyle = '#5c667c'; b.fillRect(x0 + 3, dy - 8, 34, 3);
        led(x0 + 34, dy - 2.5, '#6fd3ff', 0.5);
      } else {
        b.fillStyle = '#1d7a45'; b.fillRect(x0, dy - 6, 22, 6); b.fillStyle = '#c9ced8'; b.fillRect(x0 + 16, dy - 9, 6, 4); b.fillStyle = '#23262e'; b.fillRect(x0 + 6, dy - 9, 6, 3);
        led(x0 + 3, dy - 3, '#ff4a4a', 0.2); led(x0 + 6, dy - 3, '#3dff8a', 4 + Math.random() * 6);
      }
    }
  }

  function rackFront(b, x, y, w, h, r, ledScale) {
    b.fillStyle = '#121821'; b.fillRect(x, y, w, h);
    b.strokeStyle = '#3a4659'; b.lineWidth = 1; b.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const u = Math.max(4, h / 22);
    for (let yy = y + 3; yy < y + h - u; yy += u) {
      if (r() < 0.15) continue;
      b.fillStyle = r() < 0.5 ? '#222b38' : '#1b2330'; b.fillRect(x + 3, yy, w - 6, u - 1.2);
      if (r() < 0.8) led(x + w - 6, yy + u / 2 - 0.5, r() < 0.75 ? '#3dff8a' : r() < 0.6 ? '#6fd3ff' : '#ffb000', (ledScale || 1) * (1 + r() * 5));
      if (r() < 0.4) led(x + w - 10, yy + u / 2 - 0.5, '#3dff8a', (ledScale || 1) * (2 + r() * 6));
    }
  }
  function bakeRoom(b, v, r) {
    let gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#111c29'); gr.addColorStop(1, '#0a121c');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(255,255,255,0.03)'; b.lineWidth = 1;
    for (let x = 0; x < W; x += 46) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H * 0.78); b.stroke(); }
    // ceiling light strips
    for (let i = 0; i < 3; i++) { const lx = W * (0.2 + i * 0.3); b.fillStyle = 'rgba(190,230,255,0.75)'; b.fillRect(lx - 30, 4, 60, 3); const lg = b.createRadialGradient(lx, 6, 0, lx, 6, 120); lg.addColorStop(0, 'rgba(150,210,255,0.16)'); lg.addColorStop(1, 'rgba(150,210,255,0)'); b.fillStyle = lg; b.fillRect(lx - 120, 0, 240, 130); }
    // racks along the back wall
    const o = v.owned;
    const n = Math.max(2, Math.min(14, (o.tower || 0) + (o.rack || 0) + (o.room || 0)));
    const rw = Math.min(46, W / 9), top = H * 0.16, bottom = H * 0.78;
    const order = [];
    for (let i = 0; i < 14; i++) order.push(i % 2 ? Math.ceil(i / 2) : -Math.ceil(i / 2));
    const cols = Math.floor(W / (rw + 4));
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let col = Math.floor(cols / 2) + order[i];
      if (col < 0 || col >= cols || used.has(col)) continue;
      used.add(col);
      const x = (W - cols * (rw + 4)) / 2 + col * (rw + 4);
      rackFront(b, x, top, rw, bottom - top, r);
    }
    // raised floor with perforated tiles
    const fy = H * 0.78;
    gr = b.createLinearGradient(0, fy, 0, H); gr.addColorStop(0, '#1c2635'); gr.addColorStop(1, '#101722');
    b.fillStyle = gr; b.fillRect(0, fy, W, H - fy);
    b.strokeStyle = 'rgba(160,190,230,0.12)';
    for (let i = -10; i <= 10; i++) { b.beginPath(); b.moveTo(W / 2 + i * 40, fy); b.lineTo(W / 2 + i * 120, H); b.stroke(); }
    for (let y = fy + 8, k = 1; y < H; y += 6 + k * 4, k++) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    gr = b.createLinearGradient(0, fy, 0, H); gr.addColorStop(0, 'rgba(111,211,255,0.12)'); gr.addColorStop(1, 'rgba(111,211,255,0)');
    b.fillStyle = gr; b.fillRect(0, fy, W, H - fy);
  }

  function bakeHall(b, v, r) {
    const vx = W / 2, vy = H * 0.42;
    let gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b1018'); gr.addColorStop(0.42, '#141c2b'); gr.addColorStop(1, '#0a0f17');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    // floor
    b.fillStyle = '#121a27'; b.beginPath(); b.moveTo(0, H); b.lineTo(W, H); b.lineTo(vx + 20, vy + 8); b.lineTo(vx - 20, vy + 8); b.fill();
    b.strokeStyle = 'rgba(140,170,220,0.1)'; b.lineWidth = 1;
    for (let i = -8; i <= 8; i++) { b.beginPath(); b.moveTo(vx + i * 4, vy + 8); b.lineTo(vx + i * W * 0.22, H); b.stroke(); }
    for (let k = 1; k < 14; k++) { const t = Math.pow(k / 14, 2); const y = vy + 8 + (H - vy - 8) * t; b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    // cold aisle glow on the floor
    gr = b.createLinearGradient(0, vy, 0, H); gr.addColorStop(0, 'rgba(111,170,255,0)'); gr.addColorStop(1, 'rgba(111,170,255,0.18)');
    b.fillStyle = gr; b.beginPath(); b.moveTo(W * 0.25, H); b.lineTo(W * 0.75, H); b.lineTo(vx + 10, vy + 8); b.lineTo(vx - 10, vy + 8); b.fill();
    // ceiling light runs
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
      const t = k / 9, t2 = (k + 0.5) / 9;
      const p = (tt) => [vx + s * (8 + tt * tt * W * 0.18), vy - 8 - tt * tt * vy * 0.95];
      const [x1, y1] = p(t), [x2, y2] = p(t2);
      b.strokeStyle = `rgba(200,230,255,${0.25 + t * 0.6})`; b.lineWidth = 1 + t * 3; b.beginPath(); b.moveTo(x1, y1); b.lineTo(x2, y2); b.stroke();
    }
    // rack rows on both sides, in perspective
    const o = v.owned;
    const rows = 1 + Math.min(3, Math.ceil(((o.colo || 0) + (o.dc || 0) + (o.campus || 0)) / 15));
    for (const s of [-1, 1]) {
      for (let k = 0; k < 22; k++) {
        const t1 = Math.pow(k / 22, 1.6), t2 = Math.pow((k + 0.85) / 22, 1.6);
        const xa = vx + s * (22 + t1 * W * 0.62), xb = vx + s * (22 + t2 * W * 0.62);
        const ya = vy - 6 - t1 * H * 0.42, yb = vy - 6 - t2 * H * 0.42;
        const fa = vy + 6 + t1 * (H - vy) * 0.95, fb = vy + 6 + t2 * (H - vy) * 0.95;
        b.fillStyle = k % 2 ? '#161e2c' : '#141b28';
        b.beginPath(); b.moveTo(xa, ya); b.lineTo(xb, yb); b.lineTo(xb, fb); b.lineTo(xa, fa); b.fill();
        b.strokeStyle = 'rgba(120,150,200,0.18)'; b.lineWidth = 0.6; b.stroke();
        const n = Math.max(2, Math.floor((fa - ya) / 9));
        for (let i = 1; i < n; i++) if (r() < 0.6 + rows * 0.1) {
          const tt = i / n, xx = (xa + xb) / 2, yy = (ya + yb) / 2 + ((fa + fb) / 2 - (ya + yb) / 2) * tt;
          led(xx, yy, r() < 0.7 ? '#3dff8a' : r() < 0.5 ? '#6fd3ff' : '#ffb000', 1 + r() * 6);
        }
      }
    }
    // end-of-hall glow
    gr = b.createRadialGradient(vx, vy, 0, vx, vy, W * 0.3);
    gr.addColorStop(0, 'rgba(160,190,255,0.35)'); gr.addColorStop(1, 'rgba(160,190,255,0)');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
  }

  function bakeOrbit(b, v, r) {
    b.fillStyle = '#03060d'; b.fillRect(0, 0, W, H);
    stars(b, r, 260);
    // Earth's limb at the bottom
    const ex = W * 0.5, er = Math.max(W, H) * 1.25, ey = H * 0.82 + er;
    let gr = b.createRadialGradient(ex, ey, er * 0.98, ex, ey, er * 1.06);
    gr.addColorStop(0, 'rgba(90,170,255,0.55)'); gr.addColorStop(1, 'rgba(90,170,255,0)');
    b.fillStyle = gr; b.beginPath(); b.arc(ex, ey, er * 1.06, 0, TAU); b.fill();
    gr = b.createLinearGradient(0, ey - er, 0, H);
    gr.addColorStop(0, '#0d2445'); gr.addColorStop(1, '#050d1c');
    b.fillStyle = gr; b.beginPath(); b.arc(ex, ey, er, 0, TAU); b.fill();
    // city lights near the limb
    b.save(); b.beginPath(); b.arc(ex, ey, er, 0, TAU); b.clip();
    for (let i = 0; i < 9; i++) {
      const cx = r() * W, cy = H * 0.84 + r() * H * 0.16;
      for (let k = 0; k < 40; k++) { b.fillStyle = `rgba(255,${200 + r() * 40},${120 + r() * 60},${0.3 + r() * 0.6})`; b.fillRect(cx + (r() - 0.5) * 50, cy + (r() - 0.5) * 18, 1.2, 1.2); }
    }
    if (v.owned.cable) {
      b.strokeStyle = 'rgba(80,255,230,0.45)'; b.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { b.beginPath(); const x0 = r() * W * 0.4, x1 = W * 0.6 + r() * W * 0.4; b.moveTo(x0, H * 0.9 + r() * 20); b.quadraticCurveTo((x0 + x1) / 2, H * 0.86 + r() * 30, x1, H * 0.9 + r() * 20); b.stroke(); }
    }
    b.restore();
    // the Moon
    const mx = W * 0.84, my = H * 0.18, mr = Math.min(W, H) * 0.07;
    gr = b.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    gr.addColorStop(0, '#e9ecf2'); gr.addColorStop(1, '#8b919e');
    b.fillStyle = gr; b.beginPath(); b.arc(mx, my, mr, 0, TAU); b.fill();
    b.fillStyle = 'rgba(0,0,0,0.15)'; b.beginPath(); b.arc(mx + mr * 0.3, my + mr * 0.2, mr * 0.22, 0, TAU); b.arc(mx - mr * 0.35, my - mr * 0.1, mr * 0.15, 0, TAU); b.fill();
    if (v.owned.lunar) for (let i = 0; i < 6; i++) led(mx + (r() - 0.5) * mr * 1.2, my + (r() - 0.2) * mr * 0.9, '#6fd3ff', 0.5 + r() * 2);
  }

  function bakeCosmos(b, v, r) {
    b.fillStyle = '#05030b'; b.fillRect(0, 0, W, H);
    for (const [x, y, rad, c] of [[0.2, 0.25, 0.5, 'rgba(160,60,220,0.22)'], [0.85, 0.7, 0.55, 'rgba(40,180,200,0.16)'], [0.6, 0.15, 0.35, 'rgba(255,80,160,0.14)']]) {
      const gr = b.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * rad);
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = gr; b.fillRect(0, 0, W, H);
    }
    stars(b, r, 320);
    if (v.owned.universe) {
      // distant spiral galaxy
      b.save(); b.translate(W * 0.18, H * 0.78); b.rotate(-0.4); b.scale(1, 0.45);
      for (let i = 0; i < 700; i++) {
        const t = r() * 4.5, arm = r() < 0.5 ? 0 : Math.PI, rr = t * 14 + r() * 6;
        const a = t + arm;
        b.fillStyle = `rgba(${200 + r() * 55},${180 + r() * 60},255,${0.15 + r() * 0.5})`;
        b.fillRect(Math.cos(a) * rr + (r() - 0.5) * 6, Math.sin(a) * rr + (r() - 0.5) * 6, 1.2, 1.2);
      }
      const gr = b.createRadialGradient(0, 0, 0, 0, 0, 22); gr.addColorStop(0, 'rgba(255,240,210,0.9)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
      b.fillStyle = gr; b.beginPath(); b.arc(0, 0, 22, 0, TAU); b.fill();
      b.restore();
    }
    // the star behind the core
    const gr = b.createRadialGradient(chip.x, chip.y, chip.s * 0.2, chip.x, chip.y, chip.s * 1.6);
    gr.addColorStop(0, 'rgba(255,200,120,0.55)'); gr.addColorStop(0.4, 'rgba(255,120,80,0.18)'); gr.addColorStop(1, 'rgba(255,120,80,0)');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
  }

  // ---------------- live layers
  const litBuf = [];
  function drawLeds(now, speed) {
    // leds are sorted by colour after baking, so each colour is two batched passes instead of a state change per light
    const t = now * 0.001 * speed;
    let i = 0;
    while (i < leds.length) {
      const color = leds[i].color;
      litBuf.length = 0;
      for (; i < leds.length && leds[i].color === color; i++) { const l = leds[i]; if (Math.sin(t * l.rate + l.phase) > -0.2) litBuf.push(l); }
      if (!litBuf.length) continue;
      g.fillStyle = color;
      g.globalAlpha = 0.25;
      g.beginPath(); for (const l of litBuf) g.rect(l.x - 2, l.y - 2, 5, 5); g.fill();
      g.globalAlpha = 1;
      g.beginPath(); for (const l of litBuf) g.rect(l.x - 0.8, l.y - 0.8, 2.2, 2.2); g.fill();
    }
  }
  function drawOrbiters(v, now) {
    const era = eraOf(v.tier);
    const t = now / 1000;
    if (era === 3) {
      const n = Math.min(8, Math.max(1, v.owned.orbital || 0));
      for (let i = 0; i < n; i++) {
        const a = t * (0.12 + i * 0.013) + i * 2.1, rx = W * (0.42 + (i % 3) * 0.05), ry = H * (0.1 + (i % 2) * 0.04);
        const x = W / 2 + Math.cos(a) * rx, y = H * 0.68 + Math.sin(a) * ry;
        if (Math.sin(a) < -0.2 && Math.abs(x - chip.x) < chip.s * 0.6) continue; // behind the chip
        g.fillStyle = '#c9d3e6'; g.fillRect(x - 2, y - 1.5, 4, 3);
        g.fillStyle = '#3b6fd6'; g.fillRect(x - 8, y - 1, 5, 2); g.fillRect(x + 3, y - 1, 5, 2);
        if ((t * 2 + i) % 1 < 0.5) { g.fillStyle = '#ff4a4a'; g.fillRect(x - 0.5, y + 1.5, 1.2, 1.2); }
      }
    } else if (era === 4) {
      const n = Math.min(60, 12 + (v.owned.swarm || 0));
      g.save(); g.translate(chip.x, chip.y);
      for (let i = 0; i < n; i++) {
        const ring = i % 3, a = t * (0.3 - ring * 0.07) + i * 2.399;
        const rx = chip.s * (0.95 + ring * 0.28), ry = rx * (0.32 + ring * 0.05);
        const x = Math.cos(a) * rx, y = Math.sin(a) * ry * Math.cos(0.3) + Math.cos(a) * rx * 0.12;
        const front = Math.sin(a) > 0;
        if (!front) continue;
        g.fillStyle = ring === 1 ? '#6fd3ff' : '#4f7bff'; g.globalAlpha = 0.85; g.fillRect(x - 2.5, y - 1, 5, 2);
      }
      g.globalAlpha = 1;
      if (v.owned.brain) {
        g.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const rr = chip.s * (1.0 + k * 0.22), a0 = t * (0.2 + k * 0.1) * (k % 2 ? -1 : 1);
          g.strokeStyle = ['rgba(255,176,46,0.45)', 'rgba(255,123,84,0.4)', 'rgba(176,123,255,0.35)'][k];
          g.setLineDash([rr * 0.5, rr * 0.18]); g.beginPath(); g.arc(0, 0, rr, a0, a0 + TAU); g.stroke();
        }
        g.setLineDash([]);
      }
      g.restore();
    }
  }
  function drawSwarmBack(v, now) {
    if (eraOf(v.tier) !== 4) return;
    const t = now / 1000, n = Math.min(60, 12 + (v.owned.swarm || 0));
    g.save(); g.translate(chip.x, chip.y); g.globalAlpha = 0.45;
    for (let i = 0; i < n; i++) {
      const ring = i % 3, a = t * (0.3 - ring * 0.07) + i * 2.399;
      if (Math.sin(a) > 0) continue;
      const rx = chip.s * (0.95 + ring * 0.28), ry = rx * (0.32 + ring * 0.05);
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry * Math.cos(0.3) + Math.cos(a) * rx * 0.12;
      g.fillStyle = '#4f7bff'; g.fillRect(x - 2, y - 1, 4, 2);
    }
    g.restore();
  }

  function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function drawChip(v, now) {
    const era = eraOf(v.tier), E = ERAS[era];
    const sc = 1 - 0.06 * press;
    const s = chip.s * sc, x = chip.x - s / 2, y = chip.y - s / 2;
    const t = now / 1000;
    const heat = Math.min(1, Math.log10(1 + v.income) / 12);
    // glow
    const glow = 0.25 + 0.2 * heat + 0.35 * press + (v.boost ? 0.25 : 0);
    const gr = g.createRadialGradient(chip.x, chip.y, s * 0.3, chip.x, chip.y, s * 1.05);
    gr.addColorStop(0, hexA(E.accent, glow)); gr.addColorStop(1, hexA(E.accent, 0));
    g.fillStyle = gr; g.fillRect(chip.x - s * 1.1, chip.y - s * 1.1, s * 2.2, s * 2.2);
    // pins
    const pins = 11, pl = s * 0.075, pw = s * 0.034;
    g.fillStyle = era === 4 ? '#c9a2ff' : '#d9b54a';
    for (let i = 0; i < pins; i++) {
      const p = -s * 0.4 + (i / (pins - 1)) * s * 0.8;
      g.fillRect(chip.x + p - pw / 2, y - pl, pw, pl);
      g.fillRect(chip.x + p - pw / 2, y + s, pw, pl);
      g.fillRect(x - pl, chip.y + p - pw / 2, pl, pw);
      g.fillRect(x + s, chip.y + p - pw / 2, pl, pw);
    }
    // substrate
    rrect(x, y, s, s, s * 0.06);
    g.fillStyle = E.sub; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.stroke();
    // little SMD parts on the substrate
    g.fillStyle = '#b8892f';
    for (const [fx, fy] of [[0.1, 0.1], [0.84, 0.1], [0.1, 0.86], [0.84, 0.86]]) { g.fillRect(x + s * fx, y + s * fy, s * 0.06, s * 0.035); g.fillRect(x + s * (fx + 0.01), y + s * (fy + 0.045), s * 0.04, s * 0.02); }
    // heat spreader / die
    const m = s * 0.17, ix = x + m, iy = y + m, iw = s - 2 * m;
    if (E.ihs) {
      rrect(ix, iy, iw, iw, s * 0.04);
      const ig = g.createLinearGradient(ix, iy, ix + iw, iy + iw);
      ig.addColorStop(0, E.ihs[0]); ig.addColorStop(1, E.ihs[1]);
      g.fillStyle = ig; g.fill();
      // shine sweep every few seconds
      const sweep = ((t * 0.35) % 2.2) - 0.6;
      if (sweep > -0.3 && sweep < 1.3) {
        g.save(); rrect(ix, iy, iw, iw, s * 0.04); g.clip();
        const sx = ix + iw * sweep;
        const sg = g.createLinearGradient(sx - iw * 0.25, iy, sx + iw * 0.25, iy + iw * 0.2);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sg; g.fillRect(ix, iy, iw, iw); g.restore();
      }
      g.fillStyle = E.text; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${Math.round(s * 0.11)}px "sans-serif-condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif`;
      g.fillText(E.label, chip.x, chip.y - s * 0.05);
      g.font = `500 ${Math.round(s * 0.055)}px system-ui, sans-serif`;
      g.globalAlpha = 0.7; g.fillText(['4 cores', '16 cores', '128 cores', 'rad-hard', ''][era], chip.x, chip.y + s * 0.09); g.globalAlpha = 1;
      // pin-1 marker
      g.fillStyle = hexA(E.text, 0.6); g.beginPath(); g.arc(ix + iw * 0.1, iy + iw * 0.1, s * 0.02, 0, TAU); g.fill();
    } else {
      // cosmic era: a glowing crystal core
      const cg = g.createRadialGradient(chip.x, chip.y, 0, chip.x, chip.y, iw * 0.7);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.35, '#ff9ef0'); cg.addColorStop(0.7, '#7a4dff'); cg.addColorStop(1, '#2a1150');
      g.save(); g.translate(chip.x, chip.y); g.rotate(t * 0.2);
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, rr = iw * (0.48 + 0.04 * Math.sin(t * 2 + i)); if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.restore();
      g.fillStyle = cg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5; g.stroke();
    }
    // status LED on the substrate
    const blink = Math.sin(t * (4 + heat * 20)) > 0;
    g.fillStyle = blink ? E.accent : hexA(E.accent, 0.25);
    g.beginPath(); g.arc(x + s * 0.92, y + s * 0.5, s * 0.022, 0, TAU); g.fill();
  }

  function drawPulses(dt, v) {
    const E = ERAS[eraOf(v.tier)];
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.d += p.speed * dt;
      const tr = traces[p.tr];
      const a = along(tr, p.d), b = along(tr, Math.max(0, p.d - p.len));
      if (a[0] < -20 || a[0] > W + 20 || a[1] < -20 || a[1] > H + 20) { pulses.splice(i, 1); continue; }
      g.strokeStyle = hexA(p.color || E.accent, 0.35); g.lineWidth = 5; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(a[0], a[1]); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(a[0], a[1]); g.stroke();
    }
    g.restore();
  }
  function addPulse(color, fast) {
    if (pulses.length > 70) return;
    pulses.push({ tr: Math.floor(Math.random() * traces.length), d: 0, speed: (fast ? 520 : 260) + Math.random() * 140, len: 10 + Math.random() * 10, color });
  }

  function drawFx(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.t += dt;
      if (r.t > 0.5) { ripples.splice(i, 1); continue; }
      const f = r.t / 0.5;
      g.strokeStyle = hexA(r.color, (1 - f) * 0.6); g.lineWidth = 3 * (1 - f) + 0.5;
      rrect(chip.x - chip.s * (0.5 + f * 0.35), chip.y - chip.s * (0.5 + f * 0.35), chip.s * (1 + f * 0.7), chip.s * (1 + f * 0.7), chip.s * 0.08);
      g.stroke();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.t += dt;
      if (p.t > p.life) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt;
      g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.color; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt;
      if (f.t > f.life) { floats.splice(i, 1); continue; }
      const k = f.t / f.life;
      g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      g.font = `800 ${f.size}px "sans-serif-condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif`;
      const y = f.y - 60 * Math.sqrt(k);
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(f.text, f.x, y);
      g.fillStyle = f.color; g.fillText(f.text, f.x, y);
    }
    g.globalAlpha = 1;
  }

  // ---------------- traffic spike
  function spawnSpike(life) {
    const margin = 40;
    let x, y, tries = 0;
    do {
      // keep clear of the toast band at the top and the timers and ticker at the bottom
      x = margin + Math.random() * (W - margin * 2); y = 84 + Math.random() * Math.max(10, H - 84 - 96);
      tries++;
    } while (tries < 30 && Math.hypot(x - chip.x, y - chip.y) < chip.s * 0.95);
    spike = { x, y, bx: x, by: y, t: 0, life, seed: Math.random() * 10 };
  }
  function drawSpike(dt) {
    if (!spike) return;
    spike.t += dt;
    if (spike.t > spike.life) { spike = null; return; }
    const t = spike.t;
    spike.x = spike.bx + Math.sin(t * 0.9 + spike.seed) * 14;
    spike.y = spike.by + Math.sin(t * 1.7 + spike.seed) * 8;
    const appear = Math.min(1, t / 0.35);
    const left = spike.life - t;
    const alpha = left < 2 ? (Math.sin(t * 18) > 0 ? 0.9 : 0.35) : 1;
    const R = 24 * (0.6 + 0.4 * appear) * (1 + 0.06 * Math.sin(t * 6));
    g.save(); g.globalAlpha = alpha; g.translate(spike.x, spike.y);
    const gr = g.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 2.4);
    gr.addColorStop(0, 'rgba(255,210,74,0.55)'); gr.addColorStop(1, 'rgba(255,210,74,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 2.4, 0, TAU); g.fill();
    g.rotate(t * 1.4);
    g.strokeStyle = 'rgba(255,240,180,0.8)'; g.lineWidth = 2; g.setLineDash([4, 6]);
    g.beginPath(); g.arc(0, 0, R * 1.35, 0, TAU); g.stroke(); g.setLineDash([]);
    g.rotate(-t * 1.4);
    g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = '#fff1b0'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#b07a00'; g.lineWidth = 1.2;
    g.beginPath(); const k = R / 24;
    g.moveTo(3 * k, -15 * k); g.lineTo(-8 * k, 2 * k); g.lineTo(-1 * k, 2 * k); g.lineTo(-4 * k, 15 * k); g.lineTo(8 * k, -3 * k); g.lineTo(1 * k, -3 * k); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    if (Math.random() < dt * 20) sparks.push({ x: spike.x + (Math.random() - 0.5) * 30, y: spike.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, t: 0, life: 0.6, color: '#ffe48a' });
  }
  function hitSpike(x, y) { return !!spike && Math.hypot(x - spike.x, y - spike.y) < 44; }
  function popSpike() {
    if (!spike) return null;
    const p = { x: spike.x, y: spike.y };
    for (let i = 0; i < 36; i++) { const a = Math.random() * TAU, sp = 80 + Math.random() * 220; sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, t: 0, life: 0.7 + Math.random() * 0.5, color: i % 3 ? '#ffd24a' : '#ffffff' }); }
    spike = null;
    return p;
  }

  // ---------------- public
  function hitChip(x, y) { const h = chip.s * 0.62; return Math.abs(x - chip.x) < h && Math.abs(y - chip.y) < h; }
  function tapFx(x, y, text, color, big) {
    press = 1;
    const E = color || '#ffffff';
    if (floats.length > 28) floats.shift();
    floats.push({ x: clampX(x + (Math.random() - 0.5) * 16, text, big ? 30 : 20), y: y - 10, text, color: E, size: big ? 30 : 20, t: 0, life: big ? 1.6 : 1.0 });
    if (ripples.length < 6) ripples.push({ t: 0, color: E });
    for (let i = 0; i < 2; i++) addPulse(null, true);
    for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 120; sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, t: 0, life: 0.4 + Math.random() * 0.3, color: '#ffffff' }); }
    if (sparks.length > 200) sparks.splice(0, sparks.length - 200);
  }
  // keep floating numbers fully on screen
  function clampX(x, text, size) { const half = text.length * size * 0.29; return Math.max(half + 4, Math.min(W - half - 4, x)); }
  function floatText(x, y, text, color, size) { size = size || 22; floats.push({ x: clampX(x, text, size), y, text, color, size, t: 0, life: 1.8 }); }

  /** v: { tier, owned, income, boost (active income effect color or null) } */
  function frame(v, now, dt) {
    if (!W) return;
    makeBake(v);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bake, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const speed = 1 + Math.min(3, Math.log10(1 + v.income) / 4);
    drawLeds(now, speed);
    drawSwarmBack(v, now);
    // ambient data pulses: more income, more traffic
    pulseAcc += dt * Math.min(14, 0.6 + Math.log10(1 + v.income) * 1.1) * (v.boost ? 2 : 1);
    while (pulseAcc >= 1) { pulseAcc -= 1; addPulse(v.boost || null, !!v.boost); }
    drawPulses(dt, v);
    drawOrbiters(v, now);
    press = Math.max(0, press - dt * 7);
    drawChip(v, now);
    drawFx(dt);
    drawSpike(dt);
    // the boost glow around the edges is a CSS overlay (#boost): far cheaper than a full-canvas gradient per frame
  }

  root.Scene = { init, resize, frame, hitChip, tapFx, floatText, spawnSpike, hitSpike, popSpike, eraOf, ERAS, get spike() { return spike; }, get chip() { return chip; } };
})(this);
