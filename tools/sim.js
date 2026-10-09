// Balance simulator: plays the real engine with a greedy buyer and reports when things happen.
// node tools/sim.js [profile=active|casual] [hours=12]
const D = require('../src/js/data.js');
const E = require('../src/js/engine.js');

const profile = process.argv[2] || 'active';
if (process.env.TUNE) Object.assign(E.T, JSON.parse(process.env.TUNE));
const HOURS = Number(process.argv[3] || 12);
const P = {
  active: { taps: 4, spikes: 1, sessionOn: Infinity, sessionOff: 0 },
  // plays 10 minutes, away 50 minutes, repeat; taps a little, catches half the spikes it sees
  casual: { taps: 1.5, spikes: 0.5, sessionOn: 600, sessionOff: 3000 },
}[profile];

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const fmt = (n) => { if (n < 1000) return n.toFixed(n < 10 ? 2 : 0); const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']; const e = Math.floor(Math.log10(n) / 3); return (n / Math.pow(10, e * 3)).toPrecision(3) + (u[e - 1] || 'e' + e * 3); };
const hms = (t) => `${Math.floor(t / 3600)}h${String(Math.floor(t / 60) % 60).padStart(2, '0')}m`;

const s = E.newState();
s.created = s.lastTick = 0;
let wall = 0;
const firsts = {};
const log = [];
function effIncome() { return E.income(s, false) + (P.taps * (wall % (P.sessionOn + P.sessionOff) < P.sessionOn ? 1 : 0)) * E.tapValue(s) * 0.5; }

function bestBuy() {
  const base = effIncome();
  let best = null;
  const consider = (kind, id, cost, apply, undo) => {
    apply(); const d = effIncome() - base; undo();
    const gain = d > 0 ? d : base * 1e-4 + 1e-9;
    const score = cost / gain + Math.max(0, (cost - s.money) / Math.max(base, 1e-9));
    if (!best || score < best.score) best = { kind, id, cost, score };
  };
  for (const v of E.visibleGens(s)) {
    if (v.state === 'mystery') continue;
    const id = v.g.id;
    consider('gen', id, E.genCost(s, id, 1), () => { s.owned[id] = (s.owned[id] || 0) + 1; }, () => { s.owned[id]--; if (!s.owned[id]) delete s.owned[id]; });
  }
  for (const u of E.availableUpgrades(s).slice(0, 25)) consider('up', u.id, u.cost, () => { s.ups[u.id] = 1; }, () => { delete s.ups[u.id]; });
  return best;
}

let plan = null, nextSpike = 75, runStart = 0, sessions = 0;
const DT = 1;
for (wall = 0; wall < HOURS * 3600; wall += DT) {
  const cyc = P.sessionOn + P.sessionOff;
  const playing = (wall % cyc) < P.sessionOn;
  if (playing) {
    for (let i = 0; i < P.taps; i++) E.tap(s, false);
    if (rnd() < P.taps % 1) E.tap(s, false);
    E.tick(s, DT);
    if (s.clock >= nextSpike) { if (rnd() < P.spikes) E.catchSpike(s, rnd); nextSpike = s.clock + E.nextSpikeDelay(s, rnd); }
  } else {
    // away: offline earnings, credited in one lump when the next session starts
    if ((wall + DT) % cyc === 0) {
      s.lastTick = 0; const r = E.applyOffline(s, P.sessionOff * 1000); sessions++;
      void r;
    }
    continue;
  }
  // buy greedily (re-plan every few seconds or when the target becomes affordable)
  for (let guard = 0; guard < 40; guard++) {
    if (!plan || wall % 5 === 0) plan = bestBuy();
    if (!plan || plan.cost > s.money) break;
    if (plan.kind === 'gen') E.buyGen(s, plan.id, 1); else E.buyUpgrade(s, plan.id);
    plan = bestBuy();
  }
  for (const g of D.GENS) if ((s.owned[g.id] || 0) > 0 && firsts[g.id] === undefined) { firsts[g.id] = wall - runStart; log.push(`${hms(wall)}  first ${g.name.padEnd(18)} income ${fmt(E.income(s, false))}/s`); }
  E.checkAchievements(s);
  // sell when it would at least double Equity (and give 10+)
  const gain = E.equityGain(s);
  if (gain >= Math.max(10, s.equity) && wall % 60 === 0) {
    log.push(`${hms(wall)}  SELL run ${s.prestiges + 1}: +${gain} equity (total ${s.equity + gain}), run took ${hms(wall - runStart)}, income ${fmt(E.income(s, false))}/s, ach ${E.count(s.ach)}`);
    E.sell(s);
    for (const p of D.PERKS) if (E.canBuyPerk(s, p.id)) { E.buyPerk(s, p.id); log.push(`           perk ${p.name}`); }
    for (const k in firsts) delete firsts[k];
    runStart = wall; plan = null;
  }
  if (wall % 3600 === 0 && wall > 0) log.push(`${hms(wall)}  -- bank ${fmt(s.money)} income ${fmt(E.income(s, false))}/s tap ${fmt(E.tapValue(s))} life ${fmt(s.earnedLife)} equity-if-sold ${E.equityFor(s.earnedLife)} ach ${E.count(s.ach)} ups ${E.count(s.ups)}`);
}
console.log(`profile ${profile}, ${HOURS}h\n` + log.join('\n'));
console.log(`end: life ${fmt(s.earnedLife)} equity ${s.equity} prestiges ${s.prestiges} achievements ${E.count(s.ach)}/${D.ACH.length} packets ${s.packets}`);
