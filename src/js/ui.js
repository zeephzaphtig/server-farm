/* DOM side: the money readout, tabs and lists, effect pills, toasts, ticker, dialogs. */
(function (root) {
  'use strict';
  const D = root.Data, E = root.Engine, F = root.Fmt, LCD = root.LCD, Sound = root.Sound;
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TABS = [
    { id: 'hw', name: 'Hardware', c: 'var(--cable-blue)' },
    { id: 'up', name: 'Upgrades', c: 'var(--cable-yellow)' },
    { id: 'eq', name: 'Equity', c: 'var(--cable-red)' },
    { id: 'st', name: 'Stats', c: 'var(--cable-green)' },
  ];
  const ui = { tab: 'hw', amt: 1, sig: '', rows: {}, achSel: null, tabEls: {}, lcdText: '', modalOpen: null, toasts: [] };
  let S = null; // game state
  let actions = null;

  function init(state, acts) {
    S = state; actions = acts;
    const tabs = $('#tabs');
    for (const t of TABS) {
      const b = el('button', 'tab', `<span>${t.name}</span><span class="badge" hidden></span>`);
      b.setAttribute('role', 'tab');
      b.style.setProperty('--c', t.c);
      b.addEventListener('click', () => { if (ui.tab !== t.id) { Sound.play('tab'); Sound.buzz('light'); setTab(t.id); } });
      tabs.appendChild(b);
      ui.tabEls[t.id] = b;
    }
    $('#gear').addEventListener('click', () => { Sound.play('tab'); showSettings(); });
    setTab('hw');
    nextNews();
  }
  function setState(state) { S = state; ui.sig = ''; ui.lcdText = ''; render(); }
  function setTab(id) {
    ui.tab = id;
    for (const t of TABS) { ui.tabEls[t.id].classList.toggle('on', t.id === id); ui.tabEls[t.id].setAttribute('aria-selected', String(t.id === id)); }
    ui.sig = '';
    render();
    $('#list').scrollTop = 0;
  }

  // ---------------- money readout
  let lcdBg = null, lcdKey = '';
  function drawLCD(force) {
    const cv = $('#lcd');
    const inc = E.income(S, true);
    const boost = E.effectMult(S);
    const line1 = F.money(S.money);
    const line2 = '+' + F.money(inc) + '/s' + (boost > 1 ? '  ×' + F.num(boost) : '');
    const text = line1 + '|' + line2;
    const w = cv.clientWidth, h = cv.clientHeight;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const key = `${w}x${h}@${dpr}`;
    if (!force && text === ui.lcdText && key === lcdKey) return;
    ui.lcdText = text;
    cv.setAttribute('aria-label', `${line1}, earning ${line2.replace('/s', ' per second')}`);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    const pad = 9;
    const p1 = Math.min((h * 0.6) / 7, (w - pad * 2) / 59);
    const p2 = Math.min(p1 * 0.45, (h - pad - p1 * 7 - 6) / 7);
    const y1 = Math.max(5, (h - p1 * 7 - p2 * 7 - 5) / 2), y2 = y1 + p1 * 7 + 5;
    if (key !== lcdKey || !lcdBg) {
      // unlit dot grid, drawn once per size
      lcdKey = key;
      lcdBg = document.createElement('canvas'); lcdBg.width = cv.width; lcdBg.height = cv.height;
      const b = lcdBg.getContext('2d'); b.scale(dpr, dpr);
      const gr = b.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1308'); gr.addColorStop(1, '#0f0b05');
      b.fillStyle = gr; b.fillRect(0, 0, w, h);
      b.fillStyle = 'rgba(255,179,64,0.07)';
      for (const [p, y] of [[p1, y1], [p2, y2]]) {
        const n = Math.floor((w - pad * 2) / p);
        for (let r = 0; r < 7; r++) for (let c = 0; c < n; c++) { b.beginPath(); b.arc(pad + c * p + p / 2, y + r * p + p / 2, p * 0.36, 0, 6.283); b.fill(); }
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lcdBg, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // shrink if a long number would overflow
    const c1 = LCD.cols(line1), c2 = LCD.cols(line2);
    const q1 = Math.min(p1, (w - pad * 2) / c1), q2 = Math.min(p2, (w - pad * 2) / c2);
    LCD.draw(g, line1, pad, y1 + (p1 - q1) * 3.5, q1, '#ffb340', null);
    LCD.draw(g, line2, pad, y2, q2, boost > 1 ? '#ffd88a' : '#d08a2a', null);
  }

  // ---------------- lists
  function render() {
    if (!S) return;
    const list = $('#list');
    list.innerHTML = '';
    ui.rows = {};
    if (ui.tab === 'hw') renderHardware(list);
    else if (ui.tab === 'up') renderUpgrades(list);
    else if (ui.tab === 'eq') renderEquity(list);
    else renderStats(list);
    update(true);
  }
  function signature() {
    if (ui.tab === 'hw') return E.visibleGens(S).map(v => v.g.id + v.state).join(',');
    if (ui.tab === 'up') return E.availableUpgrades(S).map(u => u.id).join(',') + '|' + !!S.perks.procure;
    if (ui.tab === 'eq') return [S.equity, S.equitySpent, Object.keys(S.perks).join(','), E.equityFor(S.earnedLife) >= 1].join('|');
    return 'st';
  }

  function renderHardware(list) {
    const top = el('div', 'bar-top');
    top.appendChild(el('div', 'grow', 'Buy'));
    const seg = el('div', 'seg');
    for (const a of [1, 10, 100, 'max']) {
      const b = el('button', ui.amt === a ? 'on' : '', a === 'max' ? 'Max' : '×' + a);
      b.setAttribute('aria-pressed', String(ui.amt === a));
      b.setAttribute('aria-label', a === 'max' ? 'Buy as many as you can afford' : 'Buy ' + a + ' at a time');
      b.addEventListener('click', () => { ui.amt = a; Sound.play('tab'); [...seg.children].forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); update(true); });
      seg.appendChild(b);
    }
    top.appendChild(seg);
    list.appendChild(top);
    E.visibleGens(S).forEach(({ g, state }, i) => {
      const b = el('button', 'unit' + (state === 'mystery' ? ' mystery' : ''));
      const name = state === 'mystery' ? '???' : g.name;
      b.innerHTML = `<span class="ear"><i></i><b>${i + 1}</b><i></i></span><span class="ico">${g.icon}</span>` +
        `<span class="body"><span class="nm">${name}</span><span class="sub"></span><span class="ms"><i></i></span></span>` +
        `<span class="cnt">0</span><span class="buy"><span class="led"></span><span class="pr"></span><span class="qty"></span></span><span class="ear"><i></i><i></i></span>`;
      if (state !== 'mystery') b.addEventListener('click', () => actions.buyGen(g.id, ui.amt, b));
      else b.addEventListener('click', () => { Sound.play('deny'); toast('Locked', 'Buy the hardware above it first.'); });
      list.appendChild(b);
      ui.rows[g.id] = { b, state, sub: b.querySelector('.sub'), ms: b.querySelector('.ms i'), cnt: b.querySelector('.cnt'), pr: b.querySelector('.pr'), qty: b.querySelector('.qty') };
    });
  }
  function updateHardware() {
    const total = E.income(S, false) || 1;
    for (const id in ui.rows) {
      const r = ui.rows[id], g = D.GEN[id], n = S.owned[id] || 0;
      let k = ui.amt === 'max' ? Math.max(1, E.maxAfford(S, id)) : ui.amt;
      const cost = E.genCost(S, id, k);
      const ok = r.state !== 'mystery' && cost <= S.money * (1 + 1e-12);
      setText(r.cnt, F.num(n));
      setText(r.pr, F.money(cost));
      setText(r.qty, k > 1 ? '×' + F.num(k) : '');
      r.b.classList.toggle('ok', ok);
      r.b.setAttribute('aria-disabled', String(!ok));
      if (r.state === 'mystery') { setText(r.sub, 'Keep growing to unlock'); continue; }
      const each = E.unitRate(S, id);
      const share = E.genIncome(S, id) / total * 100;
      if (n > 0) setText(r.sub, `${F.money(each)}/s each · ${share < 1 ? '<1' : Math.round(share)}%`);
      else setText(r.sub, g.desc);
      r.sub.classList.toggle('wrap', n === 0);
      const next = D.TIER_AT.find(t => t > n) || null;
      const prev = [...D.TIER_AT].reverse().find(t => t <= n) || 0;
      r.ms.style.width = next ? Math.round((n - prev) / (next - prev) * 100) + '%' : '100%';
    }
  }

  function renderUpgrades(list) {
    const avail = E.availableUpgrades(S);
    const top = el('div', 'bar-top');
    top.appendChild(el('div', 'grow', `${E.count(S.ups)} of ${D.UPGRADES.length} installed`));
    if (S.perks.procure) {
      const t = el('button', 'btn', S.autobuy ? 'Auto-buy on' : 'Auto-buy off');
      t.addEventListener('click', () => { S.autobuy = !S.autobuy; t.textContent = S.autobuy ? 'Auto-buy on' : 'Auto-buy off'; Sound.play('tab'); });
      top.appendChild(t);
    }
    const all = el('button', 'btn go', 'Buy all');
    all.addEventListener('click', () => actions.buyAllUpgrades());
    top.appendChild(all);
    ui.rows.all = { b: all };
    list.appendChild(top);
    if (!avail.length) {
      list.appendChild(el('div', 'empty', '<b>No upgrades yet</b>Upgrades show up when you own 1, 5, 25, 50 and more of a piece of hardware, and as your earnings grow.'));
      return;
    }
    const grid = el('div', 'cards');
    for (const u of avail) {
      const c = el('button', 'card');
      c.innerHTML = `<span class="top"><span class="ico">${u.icon}<em>${u.badge}</em></span><span><span class="nm">${esc(u.name)}</span><br><span class="sb">${esc(u.sub)}</span></span></span>` +
        `<span class="ds">${esc(u.desc)}</span><span class="pr"><span class="led"></span>${F.money(u.cost)}</span>`;
      c.addEventListener('click', () => actions.buyUpgrade(u.id, c));
      grid.appendChild(c);
      ui.rows[u.id] = { b: c, cost: u.cost, card: true };
    }
    list.appendChild(grid);
  }
  function updateUpgrades() {
    let n = 0;
    for (const id in ui.rows) {
      const r = ui.rows[id];
      if (!r.card) continue;
      const ok = S.money >= r.cost;
      if (ok) n++;
      r.b.classList.toggle('ok', ok);
      r.b.setAttribute('aria-disabled', String(!ok));
    }
    if (ui.rows.all) ui.rows.all.b.disabled = n === 0;
  }

  let eqCanvas = null;
  function renderEquity(list) {
    const reach = E.equityFor(S.earnedLife);
    if (S.equity === 0 && reach < 1) {
      const need = E.T.equityScale;
      list.appendChild(el('div', 'empty', `<b>Sell the company</b>Once your all-time earnings reach ${F.money(need)}, you can sell. You start over with nothing but keep Equity: each point adds ${Math.round(E.T.equityPct * 100)}% to all income forever, and buys permanent board perks.`));
      const p = el('div', 'board');
      p.innerHTML = `<p>All-time earnings <b>${F.money(S.earnedLife)}</b> of ${F.money(need)}</p><div class="prog"><i style="width:${Math.min(100, S.earnedLife / need * 100)}%"></i></div>`;
      ui.rows.lockProg = { p };
      list.appendChild(p);
      return;
    }
    const board = el('div', 'board');
    eqCanvas = el('canvas');
    board.appendChild(eqCanvas);
    const info = el('p', '');
    board.appendChild(info);
    const prog = el('div', 'prog', '<i></i>');
    board.appendChild(prog);
    const wrap = el('div', 'epo-wrap');
    const epo = el('button', 'epo', '<span>SELL</span>');
    epo.setAttribute('aria-label', 'Sell the company');
    epo.addEventListener('click', () => confirmSell());
    const txt = el('div', 'txt');
    wrap.appendChild(epo); wrap.appendChild(txt);
    board.appendChild(wrap);
    list.appendChild(board);
    ui.rows.eq = { info, prog: prog.firstChild, epo, txt };
    list.appendChild(el('h3', 'sec', `Board perks<small>${E.equityFree(S)} Equity to spend</small>`));
    for (const p of D.PERKS) {
      const owned = !!S.perks[p.id];
      const reqOk = !p.req || S.perks[p.req];
      const b = el('button', 'perk' + (owned ? ' owned' : '') + (!reqOk ? ' locked' : ''));
      b.innerHTML = `<span class="bd"><span class="nm">${esc(p.name)}</span><span class="ds">${esc(p.desc)}${!reqOk ? ` Needs ${esc(D.PERK[p.req].name)}.` : ''}</span></span>` +
        `<span class="pr">${owned ? '<span class="led on"></span>Owned' : `<span class="led"></span>${p.cost} Eq`}</span>`;
      if (!owned) b.addEventListener('click', () => actions.buyPerk(p.id));
      list.appendChild(b);
      ui.rows['perk_' + p.id] = { b, perk: p, led: b.querySelector('.led') };
    }
  }
  function updateEquity() {
    if (ui.rows.lockProg) {
      const need = E.T.equityScale;
      ui.rows.lockProg.p.innerHTML = `<p>All-time earnings <b>${F.money(S.earnedLife)}</b> of ${F.money(need)}</p><div class="prog"><i style="width:${Math.min(100, S.earnedLife / need * 100)}%"></i></div>`;
      return;
    }
    const r = ui.rows.eq;
    if (!r) return;
    const gain = E.equityGain(S);
    const bonus = Math.round(E.equityBonus(S) * 100);
    if (eqCanvas) {
      const w = eqCanvas.clientWidth, h = eqCanvas.clientHeight, dpr = Math.min(2, root.devicePixelRatio || 1);
      const t = 'EQUITY ' + F.num(S.equity);
      if (eqCanvas.dataset.t !== t + w) {
        eqCanvas.dataset.t = t + w;
        eqCanvas.width = Math.round(w * dpr); eqCanvas.height = Math.round(h * dpr);
        const g = eqCanvas.getContext('2d'); g.scale(dpr, dpr);
        const p = Math.min((h - 12) / 7, (w - 16) / LCD.cols(t));
        LCD.draw(g, t, 8, (h - p * 7) / 2, p, '#ffb340', 'rgba(255,179,64,0.07)');
      }
    }
    setHTML(r.info, `Equity adds <b>+${bonus}%</b> to all income. Selling now adds <b>+${F.num(gain)}</b> Equity.`);
    const next = E.nextEquityAt(S), cur = Math.pow(Math.max(E.equityFor(S.earnedLife), S.equity), 1 / E.T.equityPow) * E.T.equityScale;
    r.prog.style.width = Math.max(0, Math.min(100, (S.earnedLife - cur) / (next - cur) * 100)) + '%';
    r.epo.disabled = gain < 1;
    const advice = gain < 1 ? 'Earn more to gain Equity.' : gain < Math.max(10, S.equity) ? 'Most players wait until selling at least doubles their Equity.' : 'Selling now is a great deal.';
    setHTML(r.txt, `<b>${gain >= 1 ? `Sell for +${F.num(gain)} Equity` : 'Not enough to sell yet'}</b>${advice} Next point at ${F.money(next)} all-time.`);
    for (const id in ui.rows) {
      const x = ui.rows[id];
      if (!x.perk || S.perks[x.perk.id]) continue;
      const can = E.canBuyPerk(S, x.perk.id);
      x.b.classList.toggle('ok', can);
      x.b.setAttribute('aria-disabled', String(!can));
    }
  }

  const ACH_COLOR = { owned: 'var(--led-green)', earnedLife: 'var(--amber)', income: 'var(--cold)', taps: '#ffffff', packets: '#ffd24a', prestige: '#ff7be0', allgens: '#9aa6ff', upgrades: '#9aa6ff' };
  function renderStats(list) {
    const st = el('div', 'status', '<span class="led on"></span><b>All systems operational</b>');
    list.appendChild(st);
    const kv = el('div', 'kv');
    list.appendChild(kv);
    ui.rows.kv = { kv };
    list.appendChild(el('h3', 'sec', `Achievements<small></small>`));
    ui.rows.achHead = { h: list.lastChild.querySelector('small') };
    const det = el('div', 'ach-detail', 'Tap a light to see what it is for. Each achievement adds income.');
    list.appendChild(det);
    const grid = el('div', 'achs');
    for (const a of D.ACH) {
      const b = el('button', 'ach' + (S.ach[a.id] ? ' got' : ''), '<i></i>');
      b.style.setProperty('--c', ACH_COLOR[a.cond.type]);
      b.setAttribute('aria-label', S.ach[a.id] ? `${a.name}, unlocked` : `Locked: ${a.desc}`);
      b.addEventListener('click', () => {
        grid.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        const got = !!S.ach[a.id];
        det.innerHTML = `<b>${got ? esc(a.name) : '???'}</b>${esc(a.desc)}${got ? ' Done.' : ''}`;
        Sound.play('tab');
      });
      grid.appendChild(b);
      ui.rows['ach_' + a.id] = { b, a };
    }
    list.appendChild(grid);
  }
  function updateStats() {
    const kv = ui.rows.kv && ui.rows.kv.kv;
    if (!kv) return;
    const rows = [
      ['Income', F.money(E.income(S, true)) + '/s'],
      ['Each tap', F.money(E.tapValue(S))],
      ['Earned this run', F.money(S.earnedRun)],
      ['Earned all time', F.money(S.earnedLife)],
      ['This run', F.time(S.runClock)],
      ['Total play time', F.time(S.clock)],
      ['Taps', F.num(S.taps)],
      ['Traffic spikes caught', F.num(S.packets)],
      ['Times sold', F.num(S.prestiges)],
      ['Achievement bonus', '+' + Math.round(E.achBonus(S) * 100) + '%'],
      ['Equity bonus', '+' + Math.round(E.equityBonus(S) * 100) + '%'],
      ['Offline earnings', Math.round(E.offlineRate(S) * 100) + '% for up to ' + E.offlineCap(S) / 3600 + 'h'],
    ];
    const html = rows.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join('');
    setHTML(kv, html);
    setText(ui.rows.achHead.h, `${E.count(S.ach)} of ${D.ACH.length}`);
    for (const id in ui.rows) {
      const r = ui.rows[id];
      if (!r.a) continue;
      const got = !!S.ach[r.a.id];
      if (r.b.classList.contains('got') !== got) { r.b.classList.toggle('got', got); r.b.setAttribute('aria-label', got ? `${r.a.name}, unlocked` : `Locked: ${r.a.desc}`); }
    }
  }

  function setText(e, t) { if (e && e.textContent !== t) e.textContent = t; }
  function setHTML(e, h) { if (e && e._h !== h) { e._h = h; e.innerHTML = h; } }

  /** Refresh numbers; rebuild the list when what it should show has changed. */
  function update(force) {
    if (!S) return;
    drawLCD(force);
    const sig = signature();
    if (sig !== ui.sig) { ui.sig = sig; if (!force) { render(); return; } }
    if (ui.tab === 'hw') updateHardware();
    else if (ui.tab === 'up') updateUpgrades();
    else if (ui.tab === 'eq') updateEquity();
    else updateStats();
    // tab badges
    const affordable = E.availableUpgrades(S).filter(u => u.cost <= S.money).length;
    badge('up', affordable ? String(affordable) : '');
    badge('eq', E.equityGain(S) >= Math.max(10, S.equity) ? '!' : '');
    updateEffects();
  }
  function badge(tab, text) {
    const b = ui.tabEls[tab].querySelector('.badge');
    if (text) { b.hidden = false; setText(b, text); } else b.hidden = true;
  }

  // ---------------- effect pills
  function updateEffects() {
    const box = $('#effects');
    const want = S.effects.filter(e => e.until > S.clock);
    const key = want.map(e => e.kind).join(',');
    if (box.dataset.k !== key) {
      box.dataset.k = key;
      box.innerHTML = '';
      for (const e of want) {
        const fx = D.EFFECTS[e.kind];
        const p = el('div', 'fx', `<span class="dot"></span><span>${fx.desc}</span><span class="tm"></span><span class="bar"></span>`);
        p.setAttribute('aria-label', fx.name + ', ' + fx.desc);
        p.style.color = fx.color;
        p.firstChild.nextSibling.style.color = '#fff';
        box.appendChild(p);
      }
    }
    want.forEach((e, i) => {
      const p = box.children[i]; if (!p) return;
      const left = e.until - S.clock, total = E.effectDur(S, e.kind);
      setText(p.querySelector('.tm'), Math.ceil(left) + 's');
      p.querySelector('.bar').style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
    });
  }

  // ---------------- toasts
  function toast(title, text, icon) {
    const box = $('#toasts');
    const t = el('div', 'toast', `${icon ? `<span class="ico">${icon}</span>` : ''}<div><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`);
    box.appendChild(t);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2400);
  }

  // ---------------- news ticker
  const tick = { x: 0, w: 0, recent: [] };
  function nextNews() {
    const span = $('#ticker span');
    const tier = S ? E.topTier(S) : -1;
    let pool = D.NEWS.filter(([t]) => t <= tier).map(n => n[1]);
    if (S && S.prestiges) pool = pool.concat(D.NEWS_SPECIAL.prestige);
    if (S && S.packets) pool = pool.concat(D.NEWS_SPECIAL.packet);
    // favour headlines from the current stage
    const fresh = D.NEWS.filter(([t]) => t === tier).map(n => n[1]);
    let choice;
    for (let i = 0; i < 8; i++) {
      const arr = Math.random() < 0.45 && fresh.length ? fresh : pool;
      choice = arr[Math.floor(Math.random() * arr.length)];
      if (choice && !tick.recent.includes(choice)) break;
    }
    if (!choice) choice = pool[0];
    tick.recent.push(choice); if (tick.recent.length > 6) tick.recent.shift();
    span.textContent = choice;
    tick.w = span.offsetWidth;
    tick.x = $('#ticker').clientWidth + 10;
  }
  function updateTicker(dt) {
    tick.x -= dt * 55;
    if (tick.x < -tick.w - 20) nextNews();
    $('#ticker span').style.transform = `translateX(${tick.x.toFixed(1)}px)`;
  }

  // ---------------- dialogs
  function modal(build, opts) {
    const m = $('#modal');
    m.innerHTML = '';
    const d = el('div', 'dlg');
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.tabIndex = -1;
    build(d);
    m.appendChild(d);
    m.hidden = false;
    $('#app').inert = true;
    ui.modalOpen = opts || {};
    m.onclick = (e) => { if (e.target === m && !(opts && opts.sticky)) closeModal(); };
    d.focus({ preventScroll: true });
  }
  /** Close the open dialog. Its onClose runs (e.g. going back to Settings) unless skipAfter is set. */
  function closeModal(skipAfter) {
    const m = $('#modal');
    if (m.hidden) return false;
    const after = !skipAfter && ui.modalOpen && ui.modalOpen.onClose;
    m.hidden = true; m.innerHTML = ''; ui.modalOpen = null;
    $('#app').inert = false;
    if (after) after();
    return true;
  }
  function actionsRow(d, buttons) {
    const a = el('div', 'acts');
    for (const [label, cls, fn] of buttons) { const b = el('button', 'btn ' + (cls || ''), label); b.addEventListener('click', fn); a.appendChild(b); }
    d.appendChild(a);
    return a;
  }

  function showOffline(r) {
    modal((d) => {
      d.innerHTML = `<h2>Welcome back</h2><p>You were away ${F.time(r.away)}. Your servers kept running at ${Math.round(r.rate * 100)}% and earned</p>` +
        `<div class="big-num">${F.money(r.earned)}</div>` + (r.capped ? `<p>Offline earnings stop after ${F.time(r.secs)}. Board perks can raise that.</p>` : '');
      actionsRow(d, [['Collect', 'go', () => { closeModal(); }]]);
    }, { onClose: () => { Sound.play('collect'); Sound.buzz('medium'); } });
  }

  function confirmSell() {
    const gain = E.equityGain(S);
    if (gain < 1) { Sound.play('deny'); return; }
    Sound.buzz('medium');
    modal((d) => {
      d.innerHTML = `<h2>Sell the company?</h2><p>You get <b>+${F.num(gain)} Equity</b>, for ${F.num(S.equity + gain)} in total (+${Math.round((S.equity + gain) * (S.perks.compound ? E.T.compoundPct : E.T.equityPct) * 100)}% income).</p>` +
        `<p>Your money, hardware and upgrades reset. You keep Equity, board perks, achievements and stats.</p>`;
      actionsRow(d, [['Keep running', '', () => closeModal()], ['Sell', 'warn', () => { closeModal(); actions.sell(); }]]);
    });
  }

  function showSettings() {
    const st = S.settings;
    modal((d) => {
      d.appendChild(el('h2', '', 'Settings'));
      const slider = (label, key, fn) => {
        const row = el('div', 'row', `<span>${label}</span>`);
        const r = el('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = st[key];
        r.setAttribute('aria-label', label);
        r.addEventListener('input', () => { st[key] = +r.value; fn(st[key]); });
        r.addEventListener('change', () => actions.save());
        row.appendChild(r); d.appendChild(row);
      };
      const rocker = (label, get, set) => {
        const row = el('div', 'row', `<span>${label}</span>`);
        const b = el('button', 'rocker' + (get() ? ' on' : ''));
        b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!get()));
        b.setAttribute('aria-label', label);
        b.addEventListener('click', () => { set(!get()); b.classList.toggle('on', get()); b.setAttribute('aria-checked', String(!!get())); actions.save(); Sound.play('tab'); Sound.buzz('light'); });
        row.appendChild(b); d.appendChild(row);
      };
      slider('Sound effects', 'sfx', (v) => { Sound.setVolume('sfx', v); Sound.play('buy'); });
      slider('Music', 'music', (v) => { Sound.setVolume('music', v); if (v > 0) Sound.startMusic(); else Sound.stopMusic(); });
      rocker('Vibration', () => st.haptics, (v) => { st.haptics = v; Sound.setHaptics(v); });
      rocker('Scientific numbers (1.23e15)', () => st.notation === 'sci', (v) => { st.notation = v ? 'sci' : 'short'; F.setNotation(st.notation); ui.lcdText = ''; ui.sig = ''; render(); });
      const backHere = () => showSettings();
      actionsRow(d, [['How to play', '', () => showHelp(backHere)], ['Back up save', '', () => showExport(backHere)], ['Restore save', '', () => showImport(backHere)]]);
      actionsRow(d, [['Erase everything', 'warn', () => confirmReset(backHere)], ['Done', 'go', () => closeModal()]]);
      d.appendChild(el('p', '', '<span style="color:var(--muted);font-size:12px">Server Farm 1.0 · made for Rob</span>'));
    }, { onClose: () => actions.save() });
  }
  function showHelp(after) {
    modal((d) => {
      d.innerHTML = '<h2>How to play</h2><ol class="howto">' +
        '<li>Tap the chip to earn money.</li>' +
        '<li>Buy hardware in the Hardware tab. It earns money every second, even while the app is closed.</li>' +
        '<li>Upgrades double what your hardware makes. New ones appear as you own more.</li>' +
        '<li>When a golden traffic spike floats across the screen, tap it for a bonus.</li>' +
        '<li>Later, sell the company for Equity. You start over, but everything earns more, and Equity buys permanent perks.</li></ol>';
      actionsRow(d, [['Got it', 'go', () => closeModal()]]);
    }, { onClose: after });
  }
  function showExport(after) {
    const code = E.exportCode(S);
    modal((d) => {
      d.innerHTML = '<h2>Back up save</h2><p>Copy this code somewhere safe. Restore save brings it back, even on another phone.</p>';
      const ta = el('textarea'); ta.readOnly = true; ta.value = code; d.appendChild(ta);
      const row = actionsRow(d, [['Copy', 'go', () => {
        ta.select();
        const btn = row.firstChild;
        const result = (ok) => { btn.textContent = ok ? 'Copied' : 'Copy failed: select the text and copy it'; Sound.play(ok ? 'buy' : 'deny'); };
        const fallback = () => { let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } result(ok); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => result(true), fallback);
        else fallback();
      }], ['Close', '', () => closeModal()]]);
    }, { onClose: after });
  }
  function showImport(after) {
    modal((d) => {
      d.innerHTML = '<h2>Restore save</h2><p>Paste a save code. This replaces your current game.</p>';
      const ta = el('textarea'); ta.placeholder = 'SF1:...'; d.appendChild(ta);
      const msg = el('p', ''); d.appendChild(msg);
      actionsRow(d, [['Cancel', '', () => closeModal()], ['Restore', 'go', () => {
        try { const ns = E.importCode(ta.value); closeModal(true); actions.replace(ns); toast('Save restored', 'Your previous game is kept as a backup.'); }
        catch (e) { msg.textContent = e.message; Sound.play('deny'); }
      }]]);
    }, { onClose: after });
  }
  function confirmReset(after) {
    modal((d) => {
      d.innerHTML = '<h2>Erase everything?</h2><p>All progress, Equity, perks and achievements are deleted. This cannot be undone.</p>';
      actionsRow(d, [['Cancel', '', () => closeModal()], ['Erase', 'warn', () => { closeModal(true); actions.replace(E.newState()); toast('Fresh start'); }]]);
    }, { onClose: after });
  }

  /** Android back button / Escape. Returns false when there is nothing left to close. */
  function back() {
    if (closeModal()) return true;
    if (ui.tab !== 'hw') { setTab('hw'); return true; }
    return false;
  }

  root.UI = { init, setState, update, render, toast, drawLCD, updateTicker, nextNews, showOffline, showHelp, closeModal, back, flash, get tab() { return ui.tab; }, get modalOpen() { return !!ui.modalOpen; } };
  function flash(b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
})(this);
