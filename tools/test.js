// Engine and content tests. Run: node tools/test.js
const assert = require('assert');
const D = require('../src/js/data.js');
const E = require('../src/js/engine.js');
const F = require('../src/js/format.js');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; } };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(a), Math.abs(b));

t('content ids are unique', () => {
  for (const list of [D.GENS, D.UPGRADES, D.PERKS, D.ACH]) assert.strictEqual(new Set(list.map(x => x.id)).size, list.length);
});
t('hardware gets pricier and better each tier', () => {
  for (let i = 1; i < D.GENS.length; i++) { assert(D.GENS[i].cost > D.GENS[i - 1].cost * 5); assert(D.GENS[i].rate > D.GENS[i - 1].rate * 4); }
});
t('every upgrade unlock refers to real things', () => {
  for (const u of D.UPGRADES) { assert(u.cost > 0 && isFinite(u.cost)); if (u.unlock.type === 'owned') assert(D.GEN[u.unlock.gen]); }
  for (const p of D.PERKS) if (p.req) assert(D.PERK[p.req]);
  for (const a of D.ACH) if (a.cond.type === 'owned') assert(D.GEN[a.cond.gen]);
});
t('icons are present', () => { for (const g of D.GENS) assert(g.icon.startsWith('<svg') && g.icon.length > 200); });

t('cost of n units equals the sum of single purchases', () => {
  const s = E.newState();
  s.money = 1e12;
  const bulk = E.genCost(s, 'tower', 37);
  let sum = 0;
  for (let i = 0; i < 37; i++) { sum += E.genCost(s, 'tower', 1); s.owned.tower = (s.owned.tower || 0) + 1; }
  assert(near(bulk, sum, 1e-9), `${bulk} vs ${sum}`);
});
t('max affordable matches brute force and never overspends', () => {
  for (const money of [0, 14, 15, 1000, 123456, 9.87e9, 3.3e20]) {
    for (const id of ['pi', 'rack', 'brain']) {
      const s = E.newState(); s.money = money; s.owned[id] = 7;
      let k = 0; while (E.genCost(s, id, k + 1) <= money) k++;
      assert.strictEqual(E.maxAfford(s, id), k, `${id} at ${money}`);
      const got = E.buyGen(s, id, 'max');
      assert.strictEqual(got, k); assert(s.money >= 0);
    }
  }
});
t('cannot buy what you cannot afford', () => {
  const s = E.newState(); s.money = 14;
  assert.strictEqual(E.buyGen(s, 'pi', 1), 0); assert.strictEqual(s.money, 14);
  assert.strictEqual(E.buyUpgrade(s, 'tapx0'), false);
});
t('tier upgrades double that hardware', () => {
  const s = E.newState(); s.owned.pi = 10; s.money = 1e9;
  const before = E.income(s);
  assert(E.buyUpgrade(s, 'g_pi_0'));
  assert(near(E.income(s), before * 2));
});
t('upgrades only show once unlocked', () => {
  const s = E.newState();
  assert(!E.availableUpgrades(s).some(u => u.id === 'g_rack_0'));
  s.owned.rack = 1;
  assert(E.availableUpgrades(s).some(u => u.id === 'g_rack_0'));
});
t('taps earn and count', () => {
  const s = E.newState();
  assert.strictEqual(E.tap(s), 1); assert.strictEqual(s.money, 1); assert.strictEqual(s.taps, 1);
  s.money = 1e6; s.taps = 5; E.buyUpgrade(s, 'tapx0');
  assert.strictEqual(E.tapValue(s), 2);
});
t('spikes apply bonuses and expire', () => {
  const s = E.newState(); s.owned.laptop = 10;
  const base = E.income(s);
  let i = 0; const seq = [0.0]; // first weight bucket = viral
  E.catchSpike(s, () => seq[i++ % seq.length]);
  assert(near(E.income(s), base * 7));
  E.tick(s, 200);
  assert.strictEqual(s.effects.length, 0);
  assert(near(E.income(s), base));
});
t('contract pays out at most 15 minutes of income or 15% of the bank', () => {
  const s = E.newState(); s.owned.laptop = 10; s.money = 1e9;
  const r = E.catchSpike(s, () => 0.6); // lands in the contract bucket
  assert.strictEqual(r.kind, 'contract');
  assert(near(r.amount, Math.min(1e9 * 0.15, E.income(s, false) * 900) + 13));
});
t('offline earnings: rate, minimum and cap', () => {
  const s = E.newState(); s.owned.laptop = 10;
  const inc = E.income(s);
  s.lastTick = 0;
  assert.strictEqual(E.applyOffline(s, 10 * 1000), null);
  s.lastTick = 0;
  const r = E.applyOffline(s, 3600 * 1000);
  assert(near(r.earned, inc * 3600 * 0.5));
  s.lastTick = 0;
  const r2 = E.applyOffline(s, 100 * 3600 * 1000);
  assert(r2.capped && near(r2.secs, 8 * 3600));
  s.lastTick = 1e12; assert.strictEqual(E.applyOffline(s, 0), null); // clock went backwards
});
t('selling resets the run and keeps equity, perks and achievements', () => {
  const s = E.newState();
  s.earnedLife = s.earnedRun = 1e13; s.money = 5e12; s.owned.dc = 3; s.ups.g_dc_0 = 1; s.ach.own_pi_1 = 1; s.perks.memory = 1; s.ups.tapx0 = 1;
  const gain = E.sell(s);
  assert.strictEqual(gain, E.equityFor(1e13)); assert(gain >= 10);
  assert.strictEqual(s.money, 0); assert.deepStrictEqual(s.owned, {}); assert(!s.ups.g_dc_0); assert(s.ups.tapx0); assert(s.ach.own_pi_1);
  assert.strictEqual(E.sell(s), 0); // nothing new to gain
  assert(near(E.globalMult(s), (1 + E.achBonus(s)) * (1 + gain * E.T.equityPct)));
});
t('equity formula is monotonic and next threshold is consistent', () => {
  let prev = 0;
  for (let e = 6; e < 40; e += 0.5) { const v = E.equityFor(Math.pow(10, e)); assert(v >= prev); prev = v; }
  const s = E.newState(); s.earnedLife = 5e14;
  assert.strictEqual(E.equityFor(E.nextEquityAt(s) * 1.0000001), E.equityFor(s.earnedLife) + 1);
});
t('perks: cost, requirement, starting kit', () => {
  const s = E.newState(); s.equity = 100;
  assert(!E.buyPerk(s, 'graveyard')); // needs night shift
  assert(E.buyPerk(s, 'night')); assert(E.buyPerk(s, 'graveyard'));
  assert(E.buyPerk(s, 'starter')); assert.strictEqual(s.owned.pi, 10);
  assert.strictEqual(E.equityFree(s), 100 - 3 - 30 - 1);
  assert(!E.buyPerk(s, 'unicorn'));
});
t('achievements award once', () => {
  const s = E.newState(); s.owned.pi = 1;
  const a = E.checkAchievements(s);
  assert(a.some(x => x.id === 'own_pi_1'));
  assert(!E.checkAchievements(s).some(x => x.id === 'own_pi_1'));
});
t('save round trip and junk handling', () => {
  const s = E.newState(); s.money = 123.5; s.owned.rack = 4; s.ups.g_pi_0 = 1; s.ach.own_pi_1 = 7; s.perks.brand = 1; s.equity = 3; s.equitySpent = 2;
  s.effects.push({ kind: 'viral', until: 99 }); s.clock = 5; s.settings.notation = 'sci';
  const r = E.deserialize(E.serialize(s));
  for (const k of ['money', 'equity', 'equitySpent', 'clock']) assert.strictEqual(r[k], s[k]);
  assert.deepStrictEqual(r.owned, s.owned); assert.deepStrictEqual(r.ups, s.ups); assert.deepStrictEqual(r.perks, s.perks); assert.strictEqual(r.effects.length, 1);
  assert.strictEqual(r.settings.notation, 'sci');
  const junk = E.deserialize(JSON.stringify({ money: 'lots', owned: { pi: -5, nope: 3, rack: 2.7 }, ups: { fake: 1 }, perks: { brand: 1 }, equity: -1, equitySpent: 9, effects: [{ kind: 'bogus' }] }));
  assert.strictEqual(junk.money, 0); assert.deepStrictEqual(junk.owned, { rack: 2 }); assert.deepStrictEqual(junk.ups, {}); assert.strictEqual(junk.equity, 0); assert.strictEqual(junk.equitySpent, 0); assert.strictEqual(junk.effects.length, 0);
  assert.throws(() => E.deserialize('not json'));
  const code = E.exportCode(s); assert(code.startsWith('SF1:'));
  assert.strictEqual(E.importCode(code).money, 123.5);
  assert.throws(() => E.importCode('SF1:@@@'));
  assert.throws(() => E.importCode('hello'));
});
t('number formatting', () => {
  const cases = [[0, '0'], [0.1, '0.1'], [1.5, '1.5'], [15, '15'], [99.99, '99.9'], [999.9, '999'], [1000, '1.00K'], [1234567, '1.23M'], [999999, '999K'], [12.5e9, '12.5B'], [1e15, '1.00Qa'], [-2500, '-2.50K'], [Infinity, 'MAX']];
  for (const [v, want] of cases) assert.strictEqual(F.num(v), want, `${v} -> ${F.num(v)}`);
  F.setNotation('sci'); assert.strictEqual(F.num(1234567), '1.23e6'); F.setNotation('short');
  assert.strictEqual(F.num(1e120).includes('e'), true);
  assert.strictEqual(F.time(3725), '1h 2m'); assert.strictEqual(F.time(90000), '1d 1h'); assert.strictEqual(F.time(42), '42s');
});
t('a long simulated game stays finite and reaches every tier', () => {
  const s = E.newState();
  let top = -1, r = 1; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let sec = 0; sec < 3600 * 40; sec++) {
    E.tap(s); E.tap(s); E.tick(s, 1);
    if (sec % 150 === 0) E.catchSpike(s, rnd);
    if (sec % 3 === 0) {
      E.buyAllUpgrades(s);
      for (let i = D.GENS.length - 1; i >= 0; i--) { const v = E.visibleGens(s).find(x => x.g.id === D.GENS[i].id); if (v && v.state !== 'mystery') E.buyGen(s, D.GENS[i].id, 'max'); }
    }
    E.checkAchievements(s);
    top = Math.max(top, E.topTier(s));
    if (E.equityGain(s) >= Math.max(10, s.equity)) { E.sell(s); for (const p of D.PERKS) E.buyPerk(s, p.id); }
    for (const k of ['money', 'earnedLife']) assert(isFinite(s[k]) && s[k] >= 0, k + ' broke at ' + sec);
  }
  assert(s.prestiges >= 2, 'prestiges ' + s.prestiges);
  assert(top >= 9, 'top tier ' + top);
});
console.log(process.exitCode ? 'TESTS FAILED' : `all ${n} tests passed`);
