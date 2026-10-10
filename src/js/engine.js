/* Game rules: income, costs, buying, taps, traffic spikes, achievements, prestige, offline earnings, save format.
   No DOM here, so the node tools (tests, balance simulator) run the exact same code as the phone. */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./data.js') : root.Data);
  if (isNode) module.exports = api; else root.Engine = api;
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  const GROWTH = 1.15;
  // Tuning knobs (the balance simulator overrides these to compare settings).
  // equity = floor((lifetime / scale) ^ pow). A 4th root (not CC's cube root) keeps prestige runs from snowballing once every tier is reachable.
  const T = { equityScale: 1e8, equityPow: 0.25, equityPct: 0.04, compoundPct: 0.06 };
  const OFFLINE_MIN = 30;    // seconds away before offline earnings kick in
  const SAVE_KEY = 'server-farm.save.v1';

  function newState() {
    return {
      v: 1,
      money: 0, earnedRun: 0, earnedLife: 0,
      taps: 0, tapsRun: 0, autoTaps: 0, tapEarned: 0,
      owned: {}, ups: {}, ach: {}, perks: {},
      equity: 0, equitySpent: 0, prestiges: 0,
      packets: 0, packetsRun: 0,
      effects: [],            // { kind, until } in game-clock seconds
      clock: 0, runClock: 0,  // seconds of play (all time / this run)
      nextPacket: 75,         // game-clock time of the next traffic spike
      autoAcc: 0, buyAcc: 0,
      bestIncome: 0,
      created: Date.now(), lastTick: Date.now(), runStarted: Date.now(),
      autobuy: true,
      settings: { sfx: 0.8, music: 0.4, haptics: true, notation: 'short' },
    };
  }

  // ---------------- multipliers
  const own = (s, id) => s.owned[id] || 0;
  function genMult(s, id) {
    let m = 1;
    for (let lv = 0; lv < D.TIER_AT.length; lv++) if (s.ups[`g_${id}_${lv}`]) m *= 2;
    return m;
  }
  function count(o) { let n = 0; for (const k in o) if (o[k]) n++; return n; }
  function achBonus(s) {
    let sla = 0;
    for (let i = 0; i < 6; i++) if (s.ups['sla' + i]) sla++;
    return count(s.ach) * (0.01 + 0.005 * sla);
  }
  function equityBonus(s) { return s.equity * (s.perks.compound ? T.compoundPct : T.equityPct); }
  /** Everything that multiplies all income, except temporary effects. */
  function globalMult(s) {
    let m = 1;
    for (const u of D.UPGRADES) if (u.kind === 'global' && s.ups[u.id]) m *= u.mult;
    m *= 1 + achBonus(s);
    m *= 1 + equityBonus(s);
    if (s.perks.brand) m *= 1.25;
    if (s.perks.unicorn) m *= 2;
    return m;
  }
  function effectMult(s) {
    let m = 1;
    for (const e of s.effects) { const fx = D.EFFECTS[e.kind]; if (fx && fx.mult && e.until > s.clock) m *= fx.mult; }
    return m;
  }
  function tapEffectMult(s) {
    let m = 1;
    for (const e of s.effects) { const fx = D.EFFECTS[e.kind]; if (fx && fx.tap && e.until > s.clock) m *= fx.tap; }
    return m;
  }
  /** Income per second of one unit of a hardware type (no temporary effects). */
  function unitRate(s, id) { return D.GEN[id].rate * genMult(s, id) * globalMult(s); }
  /** Income per second. */
  function income(s, withEffects) {
    let base = 0;
    for (const g of D.GENS) { const n = own(s, g.id); if (n) base += n * g.rate * genMult(s, g.id); }
    let total = base * globalMult(s);
    if (withEffects !== false) total *= effectMult(s);
    return total;
  }
  /** Share of income each hardware type provides (for the info line). */
  function genIncome(s, id) { return own(s, id) * unitRate(s, id); }

  /** Value of one tap. Auto taps (intern) skip the Overclocked bonus, or it snowballs. */
  function tapValue(s, auto) {
    let mult = 1, pct = 0;
    for (const u of D.UPGRADES) {
      if (!s.ups[u.id]) continue;
      if (u.kind === 'tapmult') mult *= u.mult; else if (u.kind === 'tappct') pct += u.pct;
    }
    return (mult + income(s, true) * pct) * (auto ? 1 : tapEffectMult(s));
  }

  // ---------------- buying hardware
  function costMult(s) { return (s.perks.bulk ? 0.93 : 1) * (s.perks.licensing ? 0.93 : 1); }
  function genCost(s, id, n) {
    n = n || 1;
    const g = D.GEN[id];
    return g.cost * costMult(s) * Math.pow(GROWTH, own(s, id)) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1);
  }
  function maxAfford(s, id) {
    const g = D.GEN[id];
    const first = g.cost * costMult(s) * Math.pow(GROWTH, own(s, id));
    if (s.money < first) return 0;
    let k = Math.floor(Math.log(s.money * (GROWTH - 1) / first + 1) / Math.log(GROWTH));
    while (k > 0 && genCost(s, id, k) > s.money * (1 + 1e-12)) k--; // float safety
    return isFinite(k) ? Math.max(0, k) : 0;
  }
  /** amount: number or 'max'. Returns how many were bought. */
  function buyGen(s, id, amount) {
    if (!D.GEN[id]) return 0;
    const n = amount === 'max' ? maxAfford(s, id) : Math.floor(amount);
    if (!(n >= 1)) return 0;
    const cost = genCost(s, id, n);
    if (cost > s.money * (1 + 1e-12)) return 0;
    s.money = Math.max(0, s.money - cost);
    s.owned[id] = own(s, id) + n;
    return n;
  }
  /** Hardware rows to show: everything owned, plus the next one to unlock and a mystery one after it. */
  function visibleGens(s) {
    const out = [];
    let hidden = 0;
    for (const g of D.GENS) {
      if (own(s, g.id) > 0) { out.push({ g, state: 'owned' }); continue; }
      const prevOwned = g.index === 0 || own(s, D.GENS[g.index - 1].id) > 0;
      if (hidden === 0 && (prevOwned || s.earnedRun >= g.cost * 0.2)) { out.push({ g, state: 'next' }); hidden++; continue; }
      if (hidden < 2) { out.push({ g, state: 'mystery' }); hidden = 2; }
      break;
    }
    return out;
  }

  // ---------------- upgrades
  function unlocked(s, cond) {
    switch (cond.type) {
      case 'owned': return own(s, cond.gen) >= cond.n;
      case 'earned': return s.earnedRun >= cond.v;
      case 'taps': return s.tapsRun + s.autoTaps >= cond.n || s.taps >= cond.n;
      case 'ach': return count(s.ach) >= cond.n;
      case 'packets': return s.packets >= cond.n;
    }
    return false;
  }
  function availableUpgrades(s) {
    return D.UPGRADES.filter(u => !s.ups[u.id] && unlocked(s, u.unlock)).sort((a, b) => a.cost - b.cost);
  }
  function buyUpgrade(s, id) {
    const u = D.UPG[id];
    if (!u || s.ups[id] || !unlocked(s, u.unlock) || s.money < u.cost) return false;
    s.money -= u.cost;
    s.ups[id] = 1;
    return true;
  }
  /** Buys every affordable upgrade, cheapest first. Returns how many. */
  function buyAllUpgrades(s) {
    let n = 0;
    for (const u of availableUpgrades(s)) { if (u.cost > s.money) break; if (buyUpgrade(s, u.id)) n++; }
    return n;
  }

  // ---------------- taps
  function tap(s, auto) {
    const v = tapValue(s, auto);
    earn(s, v);
    s.tapEarned += v;
    if (auto) s.autoTaps++; else { s.taps++; s.tapsRun++; }
    return v;
  }
  const CAP = 1e300; // keeps every number finite, so saves never turn into null
  function earn(s, v) {
    if (!(v > 0)) return;
    s.money = Math.min(CAP, s.money + v); s.earnedRun = Math.min(CAP, s.earnedRun + v); s.earnedLife = Math.min(CAP, s.earnedLife + v);
  }

  // ---------------- traffic spikes
  function spikeLevel(s) { let n = 0; for (let i = 0; i < 3; i++) if (s.ups['spk' + i]) n++; return n; }
  function spikeFreq(s) { return Math.pow(1.3, spikeLevel(s)) * (s.perks.detector ? 1.25 : 1); }
  function spikeLife(s) { return 12 * Math.pow(1.3, spikeLevel(s)); }
  function nextSpikeDelay(s, rnd) { return (120 + rnd() * 180) / spikeFreq(s); }
  function effectDur(s, kind) { return D.EFFECTS[kind].dur * (s.perks.longtail ? 1.5 : 1); }
  /** Tap on a traffic spike: pick and apply a bonus. Returns { kind, amount }. */
  function catchSpike(s, rnd) {
    const active = new Set(s.effects.filter(e => e.until > s.clock).map(e => e.kind));
    const pool = Object.keys(D.EFFECTS).map(k => [k, D.EFFECTS[k].weight * (active.has(k) ? 0.25 : 1)]);
    let r = rnd() * pool.reduce((a, p) => a + p[1], 0), kind = pool[0][0];
    for (const [k, w] of pool) { if (r < w) { kind = k; break; } r -= w; }
    s.packets++; s.packetsRun++;
    if (kind === 'contract') {
      const amount = Math.min(s.money * 0.15, income(s, false) * 900) + 13;
      earn(s, amount);
      return { kind, amount };
    }
    const until = s.clock + effectDur(s, kind);
    const cur = s.effects.find(e => e.kind === kind);
    if (cur) cur.until = Math.max(cur.until, until); else s.effects.push({ kind, until });
    return { kind, amount: 0 };
  }

  // ---------------- time
  /** Advance the game by dt seconds of active play. */
  function tick(s, dt) {
    if (!(dt > 0)) return;
    s.clock += dt; s.runClock += dt;
    earn(s, income(s, true) * dt);
    if (s.perks.intern) {
      s.autoAcc += dt * (s.perks.senior ? 8 : 2);
      let guard = 0;
      while (s.autoAcc >= 1 && guard++ < 50) { s.autoAcc -= 1; tap(s, true); }
      if (s.autoAcc > 1) s.autoAcc = 1;
    }
    if (s.effects.length) s.effects = s.effects.filter(e => e.until > s.clock);
    if (s.perks.procure && s.autobuy) {
      s.buyAcc += dt;
      if (s.buyAcc >= 1) { s.buyAcc = 0; buyAllUpgrades(s); }
    }
    const inc = income(s, false);
    if (inc > s.bestIncome) s.bestIncome = inc;
  }
  function offlineRate(s) { return s.perks.graveyard ? 1 : s.perks.night ? 0.75 : 0.5; }
  function offlineCap(s) { return (s.perks.weekend ? 24 : 8) * 3600; }
  /** Credit time away (wall clock). Returns null if not long enough to matter. */
  function applyOffline(s, now) {
    if (now < s.lastTick) return null; // clock moved backwards: wait for it to catch up instead of granting time
    const away = (now - s.lastTick) / 1000;
    s.lastTick = now;
    if (away < OFFLINE_MIN) { earn(s, income(s, false) * away); return null; } // short stalls count as play time
    const secs = Math.min(away, offlineCap(s));
    const earned = income(s, false) * secs * offlineRate(s);
    earn(s, earned);
    return { away, secs, earned, capped: away > secs, rate: offlineRate(s) };
  }

  // ---------------- achievements
  function achMet(s, c) {
    switch (c.type) {
      case 'owned': return own(s, c.gen) >= c.n;
      case 'earnedLife': return s.earnedLife >= c.v;
      case 'income': return income(s, false) >= c.v;
      case 'taps': return s.taps >= c.n;
      case 'packets': return s.packets >= c.n;
      case 'prestige': return s.prestiges >= c.n;
      case 'allgens': return D.GENS.every(g => own(s, g.id) > 0);
      case 'upgrades': return count(s.ups) >= c.n;
    }
    return false;
  }
  /** Award any newly met achievements. Returns the new ones. */
  function checkAchievements(s) {
    const out = [];
    for (const a of D.ACH) if (!s.ach[a.id] && achMet(s, a.cond)) { s.ach[a.id] = Date.now(); out.push(a); }
    return out;
  }

  // ---------------- prestige
  function equityFor(life) { return Math.floor(Math.pow(Math.max(0, life) / T.equityScale, T.equityPow) + 1e-9); }
  function equityGain(s) { return Math.max(0, equityFor(s.earnedLife) - s.equity); }
  /** Lifetime earnings needed for the next point of Equity on top of what selling now would give. */
  function nextEquityAt(s) { const n = Math.max(equityFor(s.earnedLife), s.equity) + 1; return Math.pow(n, 1 / T.equityPow) * T.equityScale; }
  function equityFree(s) { return s.equity - s.equitySpent; }
  function sell(s) {
    const gain = equityGain(s);
    if (gain < 1) return 0;
    s.equity += gain;
    s.prestiges++;
    const keep = {};
    if (s.perks.memory) for (const id in s.ups) { const u = D.UPG[id]; if (u && (u.kind === 'tapmult' || u.kind === 'tappct')) keep[id] = 1; }
    s.money = 0; s.earnedRun = 0; s.tapsRun = 0; s.packetsRun = 0; s.runClock = 0;
    s.owned = {}; s.ups = keep; s.effects = []; s.autoAcc = 0; s.runStarted = Date.now();
    startingKit(s);
    return gain;
  }
  function startingKit(s) {
    if (s.perks.starter) s.owned.pi = Math.max(own(s, 'pi'), 10);
    if (s.perks.series) { s.owned.pi = Math.max(own(s, 'pi'), 25); s.owned.laptop = Math.max(own(s, 'laptop'), 25); s.owned.nas = Math.max(own(s, 'nas'), 10); }
  }
  function canBuyPerk(s, id) {
    const p = D.PERK[id];
    return !!p && !s.perks[id] && (!p.req || s.perks[p.req]) && equityFree(s) >= p.cost;
  }
  function buyPerk(s, id) {
    if (!canBuyPerk(s, id)) return false;
    s.equitySpent += D.PERK[id].cost;
    s.perks[id] = 1;
    if (id === 'starter' || id === 'series') startingKit(s);
    return true;
  }

  // ---------------- save / load
  function serialize(s) { return JSON.stringify(s); }
  const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, CAP) : d);
  const own2 = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /** Parse a save, filling gaps from a fresh state and dropping anything malformed. Throws on unreadable input. */
  function deserialize(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1 || typeof d.money !== 'number') throw new Error('bad save');
    const s = newState();
    for (const k of ['money', 'earnedRun', 'earnedLife', 'taps', 'tapsRun', 'autoTaps', 'tapEarned', 'equity', 'equitySpent', 'prestiges', 'packets', 'packetsRun',
      'clock', 'runClock', 'nextPacket', 'autoAcc', 'buyAcc', 'bestIncome', 'created', 'lastTick', 'runStarted']) s[k] = num(d[k], s[k]);
    for (const g of D.GENS) { const n = d.owned && d.owned[g.id]; if (typeof n === 'number' && n >= 1 && isFinite(n)) s.owned[g.id] = Math.floor(n); }
    for (const k of ['ups', 'ach', 'perks']) {
      const src = d[k] && typeof d[k] === 'object' ? d[k] : {};
      const valid = k === 'ups' ? D.UPG : k === 'ach' ? D.ACHI : D.PERK;
      for (const id of Object.keys(src)) if (own2(valid, id) && src[id]) s[k][id] = typeof src[id] === 'number' ? src[id] : 1;
    }
    if (Array.isArray(d.effects)) s.effects = d.effects.filter(e => e && typeof e.kind === 'string' && own2(D.EFFECTS, e.kind) && num(e.until, -1) > s.clock).map(e => ({ kind: e.kind, until: e.until }));
    s.autobuy = d.autobuy !== false;
    if (d.settings && typeof d.settings === 'object') {
      const st = d.settings;
      s.settings.sfx = Math.min(1, num(st.sfx, s.settings.sfx));
      s.settings.music = Math.min(1, num(st.music, s.settings.music));
      s.settings.haptics = st.haptics !== false;
      s.settings.notation = st.notation === 'sci' ? 'sci' : 'short';
    }
    s.equitySpent = Math.min(s.equitySpent, s.equity);
    return s;
  }
  function exportCode(s) {
    const json = serialize(s);
    const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
    return 'SF1:' + b64;
  }
  function importCode(code) {
    code = String(code || '').trim().replace(/\s+/g, '');
    if (!code.startsWith('SF1:')) throw new Error('That is not a Server Farm save code.');
    let json;
    try { json = typeof atob === 'function' ? decodeURIComponent(escape(atob(code.slice(4)))) : Buffer.from(code.slice(4), 'base64').toString('utf8'); } catch (e) { throw new Error('That save code is damaged.'); }
    try { return deserialize(json); } catch (e) { throw new Error('That save code is damaged.'); }
  }

  /** Highest hardware index owned this run (-1 if none). Drives the scene's era. */
  function topTier(s) { let t = -1; for (const g of D.GENS) if (own(s, g.id) > 0) t = g.index; return t; }

  return {
    T, GROWTH, SAVE_KEY, newState, income, unitRate, genIncome, genMult, globalMult, effectMult, tapValue, tap,
    genCost, maxAfford, buyGen, visibleGens, availableUpgrades, buyUpgrade, buyAllUpgrades, unlocked,
    spikeLife, nextSpikeDelay, catchSpike, effectDur, tick, applyOffline, offlineRate, offlineCap,
    checkAchievements, achBonus, equityBonus, equityFor, equityGain, nextEquityAt, equityFree, sell, canBuyPerk, buyPerk,
    serialize, deserialize, exportCode, importCode, topTier, count,
  };
});
