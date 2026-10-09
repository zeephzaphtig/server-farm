/* Game content: hardware tiers, upgrades, perks, achievements, news. Pure data, shared by the game and the node tools. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Data = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------- icons (48x48, flat colors only so they render anywhere they are reused)
  const I = {
    pi: '<rect x="5" y="11" width="36" height="26" rx="3" fill="#1d7a45" stroke="#5be38f" stroke-width="1.5"/><g fill="#e9c46a">' +
      [9, 12, 15, 18, 21, 24, 27, 30, 33].map(x => `<circle cx="${x}" cy="14.5" r="1"/>`).join('') + '</g>' +
      '<rect x="15" y="19" width="12" height="12" rx="1.2" fill="#23262e" stroke="#9aa3b5" stroke-width=".8"/><rect x="18" y="22" width="6" height="6" fill="#3a3f4b"/>' +
      '<rect x="36" y="18" width="9" height="6" rx="1" fill="#c9ced8"/><rect x="36" y="26" width="9" height="6" rx="1" fill="#c9ced8"/><circle cx="9" cy="33" r="1.4" fill="#ff5a5a"/><circle cx="12.5" cy="33" r="1.4" fill="#5bff8f"/>',
    laptop: '<rect x="9" y="9" width="30" height="21" rx="2" fill="#2b3245" stroke="#9fb3d9" stroke-width="1.5"/><rect x="12" y="12" width="24" height="15" fill="#1452c4"/>' +
      '<path d="M14.5 15.5h7M14.5 18.5h12M14.5 21.5h5" stroke="#c8f7ff" stroke-width="1.3" stroke-linecap="round"/><rect x="21" y="21" width="2" height="1.6" fill="#c8f7ff"/>' +
      '<path d="M4 32h40l-3.5 5H7.5z" fill="#5b6478" stroke="#9fb3d9" stroke-width="1"/>',
    nas: '<rect x="10" y="6" width="28" height="36" rx="3" fill="#262b36" stroke="#9aa6b8" stroke-width="1.5"/>' +
      [10.5, 17.5, 24.5, 31.5].map((y, i) => `<rect x="14" y="${y}" width="16" height="5" rx="1" fill="#3d4555"/><circle cx="33.5" cy="${y + 2.5}" r="1.3" fill="${i === 2 ? '#ffb347' : '#5bff8f'}"/>`).join(''),
    tower: '<rect x="13" y="3" width="22" height="42" rx="2.5" fill="#2c303b" stroke="#a6afc2" stroke-width="1.5"/><rect x="16" y="7" width="16" height="4" rx="1" fill="#454b5a"/><rect x="16" y="13" width="16" height="4" rx="1" fill="#454b5a"/>' +
      '<path d="M17 22h14M17 25h14M17 28h14M17 31h14M17 34h14" stroke="#3f4554" stroke-width="1.4"/><circle cx="24" cy="40" r="2" fill="#4fc3ff"/>',
    rack: '<rect x="10" y="2" width="28" height="44" rx="1.5" fill="#171b24" stroke="#8fa0bd" stroke-width="1.5"/>' +
      [5, 10, 15, 20, 25, 30, 35, 40].map((y, i) => `<rect x="13" y="${y}" width="22" height="3.6" rx=".6" fill="#2e3545"/><rect x="${i % 2 ? 30 : 28}" y="${y + 1.1}" width="2" height="1.4" fill="${i % 3 ? '#5bff8f' : '#4fc3ff'}"/>`).join(''),
    room: [3, 17, 31].map(x => `<rect x="${x}" y="9" width="13" height="31" rx="1" fill="#1a1f2b" stroke="#8fa0bd" stroke-width="1.2"/>` +
      [12, 17, 22, 27, 32].map((y, i) => `<rect x="${x + 2}" y="${y}" width="9" height="3" fill="#2e3545"/><rect x="${x + 8.5}" y="${y + 1}" width="1.5" height="1" fill="${(i + x) % 3 ? '#5bff8f' : '#4fc3ff'}"/>`).join('')).join('') +
      '<path d="M1 43h46" stroke="#4a5670" stroke-width="2"/><path d="M8 43v3M20 43v3M32 43v3M44 43v3" stroke="#4a5670" stroke-width="1"/>',
    colo: '<rect x="8" y="6" width="14" height="36" fill="#1a1f2b" stroke="#8fa0bd" stroke-width="1.2"/><rect x="26" y="6" width="14" height="36" fill="#1a1f2b" stroke="#8fa0bd" stroke-width="1.2"/>' +
      [10, 16, 22, 28, 34].map(y => `<rect x="10" y="${y}" width="10" height="3" fill="#2e3545"/><rect x="28" y="${y}" width="10" height="3" fill="#2e3545"/>`).join('') +
      '<rect x="3" y="2" width="42" height="44" rx="1" fill="none" stroke="#c9d3e6" stroke-width="1.5"/><path d="' +
      [9, 15, 21, 27, 33, 39].map(x => `M${x} 2V46`).join('') + [8, 14, 20, 26, 32, 38].map(y => `M3 ${y}H45`).join('') + '" stroke="#c9d3e6" stroke-width=".6" opacity=".55"/>',
    dc: '<rect x="4" y="18" width="40" height="25" fill="#273047" stroke="#9fb3d9" stroke-width="1.4"/><rect x="8" y="11" width="10" height="7" fill="#3a4560"/><rect x="21" y="11" width="10" height="7" fill="#3a4560"/>' +
      '<circle cx="13" cy="14.5" r="2.4" fill="none" stroke="#9fb3d9" stroke-width="1"/><circle cx="26" cy="14.5" r="2.4" fill="none" stroke="#9fb3d9" stroke-width="1"/>' +
      [8, 15, 22, 29, 36].map(x => `<rect x="${x}" y="23" width="5" height="3" fill="#4fe0ff"/><rect x="${x}" y="29" width="5" height="3" fill="#4fe0ff" opacity=".6"/>`).join('') +
      '<rect x="20" y="35" width="8" height="8" fill="#16203a"/><path d="M2 43h44" stroke="#5b6b8a" stroke-width="1.5"/>',
    campus: '<rect x="3" y="24" width="15" height="19" fill="#273047" stroke="#9fb3d9" stroke-width="1.2"/><rect x="18" y="16" width="16" height="27" fill="#2d3754" stroke="#9fb3d9" stroke-width="1.2"/><rect x="34" y="28" width="11" height="15" fill="#273047" stroke="#9fb3d9" stroke-width="1.2"/>' +
      '<path d="M6 28h9M6 32h9M6 36h9M21 20h10M21 24h10M21 28h10M21 32h10M21 36h10M37 32h5M37 36h5" stroke="#4fe0ff" stroke-width="1.6"/>' +
      '<path d="M40 4v20M36 8h8M37 12h6" stroke="#c9d3e6" stroke-width="1.2"/><path d="M1 43h46" stroke="#5b6b8a" stroke-width="1.5"/>',
    cable: '<rect x="2" y="6" width="44" height="38" rx="4" fill="#0d2f57"/><path d="M2 14c6-3 10 3 16 0s10-3 16 0 8 3 12 0" stroke="#5fb8ff" stroke-width="1.6" fill="none"/>' +
      '<path d="M2 22c6-3 10 3 16 0s10-3 16 0 8 3 12 0" stroke="#3d8fe0" stroke-width="1.2" fill="none" opacity=".7"/><path d="M2 40h44" stroke="#8a7a52" stroke-width="3"/>' +
      '<path d="M4 37c8-2 12 1 20-1s14-2 20 0" stroke="#e8f7ff" stroke-width="2.6" fill="none"/><circle cx="12" cy="36.7" r="1.4" fill="#4fffe0"/><circle cx="24" cy="36" r="1.4" fill="#4fffe0"/><circle cx="36" cy="35.9" r="1.4" fill="#4fffe0"/>',
    orbital: '<rect x="19" y="18" width="10" height="12" rx="1.5" fill="#c9d3e6" stroke="#ffffff" stroke-width="1"/><rect x="2" y="19" width="15" height="10" fill="#1f4fae" stroke="#9fc4ff" stroke-width="1"/><rect x="31" y="19" width="15" height="10" fill="#1f4fae" stroke="#9fc4ff" stroke-width="1"/>' +
      '<path d="M7 19v10M12 19v10M2 24h15M36 19v10M41 19v10M31 24h15" stroke="#9fc4ff" stroke-width=".7"/><path d="M17 24h2M29 24h2" stroke="#c9d3e6" stroke-width="1.5"/>' +
      '<path d="M24 18v-6" stroke="#c9d3e6" stroke-width="1.3"/><path d="M19 9a5 5 0 0 0 10 0z" fill="#e8eef9"/><circle cx="24" cy="33" r="1.5" fill="#ff5a5a"/>',
    lunar: '<circle cx="24" cy="30" r="17" fill="#8d93a3"/><circle cx="16" cy="34" r="3.5" fill="#767c8c"/><circle cx="31" cy="38" r="2.5" fill="#767c8c"/><circle cx="33" cy="25" r="2" fill="#767c8c"/>' +
      '<path d="M11 21a9 9 0 0 1 18 0z" fill="#bfefff" opacity=".85" stroke="#ffffff" stroke-width="1"/><rect x="15" y="17" width="3" height="3" fill="#4fe0ff"/><rect x="21" y="15" width="3" height="5" fill="#4fe0ff"/>' +
      '<path d="M34 21V7" stroke="#e8eef9" stroke-width="1.2"/><circle cx="34" cy="6" r="1.6" fill="#ff5a5a"/>',
    swarm: '<circle cx="24" cy="24" r="9" fill="#ffb02e"/><circle cx="24" cy="24" r="6" fill="#ffd36e"/><ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke="#7fd3ff" stroke-width=".8" stroke-dasharray="2 2" transform="rotate(-20 24 24)"/>' +
      '<ellipse cx="24" cy="24" rx="17" ry="17" fill="none" stroke="#7fd3ff" stroke-width=".6" opacity=".6" stroke-dasharray="1.5 2.5"/>' +
      [[4, 29], [43, 18], [12, 8], [37, 41], [8, 42], [41, 6]].map(([x, y]) => `<rect x="${x - 2}" y="${y - 1.2}" width="4" height="2.4" fill="#3b7bff" stroke="#bfe0ff" stroke-width=".5"/>`).join(''),
    quantum: '<ellipse cx="24" cy="24" rx="20" ry="7" fill="none" stroke="#b07bff" stroke-width="1.6"/><ellipse cx="24" cy="24" rx="20" ry="7" fill="none" stroke="#4fe0ff" stroke-width="1.6" transform="rotate(60 24 24)"/>' +
      '<ellipse cx="24" cy="24" rx="20" ry="7" fill="none" stroke="#ff7be0" stroke-width="1.6" transform="rotate(-60 24 24)"/><circle cx="24" cy="24" r="4.5" fill="#ffffff"/><circle cx="24" cy="24" r="7" fill="#b07bff" opacity=".35"/><circle cx="43" cy="22" r="1.8" fill="#4fe0ff"/>',
    brain: '<circle cx="24" cy="24" r="5" fill="#fff1b0"/><circle cx="24" cy="24" r="8.5" fill="none" stroke="#ffb02e" stroke-width="1.6" stroke-dasharray="12 3"/>' +
      '<circle cx="24" cy="24" r="13" fill="none" stroke="#ff7b54" stroke-width="1.8" stroke-dasharray="18 4"/><circle cx="24" cy="24" r="18" fill="none" stroke="#b07bff" stroke-width="2" stroke-dasharray="24 5"/><circle cx="24" cy="24" r="22" fill="none" stroke="#4fe0ff" stroke-width="1.2" stroke-dasharray="6 3" opacity=".7"/>',
    universe: '<circle cx="24" cy="24" r="20" fill="#120a2e" stroke="#c9d3ff" stroke-width="1.6"/><path d="M24 24c0-5 6-7 9-3s-1 11-9 11-12-8-9-15 13-9 18-3" fill="none" stroke="#b07bff" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M24 24c0 5-6 7-9 3s1-11 9-11 12 8 9 15-13 9-18 3" fill="none" stroke="#4fe0ff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><circle cx="24" cy="24" r="2.6" fill="#fff6d0"/>' +
      '<path d="M12 12a16 16 0 0 1 9-5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".55"/><circle cx="34" cy="13" r=".9" fill="#fff"/><circle cx="14" cy="33" r=".9" fill="#fff"/>',
    // non-hardware icons
    tap: '<path d="M18 26V10a3 3 0 0 1 6 0v12l9 2a4 4 0 0 1 3 4.6L34 40a4 4 0 0 1-4 3H22a4 4 0 0 1-3.2-1.6L11 31a3 3 0 0 1 4.6-3.8z" fill="#e8eef9" stroke="#7fd3ff" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 10l-4-3M8 17H3M12 5L10 1" stroke="#ffd24a" stroke-width="2" stroke-linecap="round"/>',
    global: '<rect x="5" y="6" width="38" height="34" rx="4" fill="#16203a" stroke="#7fd3ff" stroke-width="1.5"/><path d="M10 33l8-9 6 5 12-14" fill="none" stroke="#5bff8f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 15h5v5" fill="none" stroke="#5bff8f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    sla: '<path d="M24 3l17 6v12c0 11-7 19-17 24C14 40 7 32 7 21V9z" fill="#16203a" stroke="#ffd24a" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 24l6 6 11-12" fill="none" stroke="#ffd24a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    spike: '<path d="M27 3L10 27h11l-4 18 20-26H26z" fill="#ffd24a" stroke="#fff1b0" stroke-width="1.5" stroke-linejoin="round"/>',
    equity: '<circle cx="24" cy="24" r="19" fill="#16203a" stroke="#ffd24a" stroke-width="2"/><path d="M24 11v26M30 16c-2-2-4-2.5-6-2.5-4 0-6 2-6 4.5 0 6 12 3.5 12 10 0 2.5-2.5 4.5-6.5 4.5-2.5 0-5-1-6.5-2.5" fill="none" stroke="#ffd24a" stroke-width="2.6" stroke-linecap="round"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${I[k]}</svg>`;

  // ---------------- hardware
  const GENS = [
    ['pi', 'Raspberry Pi', 'Raspberry Pis', 15, 0.1, 'A tiny board on your desk. Serves a few requests between reboots.'],
    ['laptop', 'Old Laptop', 'Old Laptops', 100, 1, 'Lid closed, fans screaming. Still counts as a server.'],
    ['nas', 'Home NAS', 'Home NASes', 1100, 8, 'Four drives, one RAID, zero backups.'],
    ['tower', 'Tower Server', 'Tower Servers', 12000, 47, 'Bought at a surplus auction. Weighs about as much as you do.'],
    ['rack', 'Server Rack', 'Server Racks', 130000, 260, '42U of pure ambition and cable spaghetti.'],
    ['room', 'Server Room', 'Server Rooms', 1.4e6, 1400, 'Raised floor, cold air, and a door that beeps at you.'],
    ['colo', 'Colo Cage', 'Colo Cages', 2e7, 7800, 'Your racks in someone else\'s building. Bring your badge.'],
    ['dc', 'Data Center', 'Data Centers', 3.3e8, 44000, 'Diesel generators, mantraps, and a very serious lobby.'],
    ['campus', 'Hyperscale Campus', 'Hyperscale Campuses', 5.1e9, 2.6e5, 'Visible from space. Draws as much power as a small country.'],
    ['cable', 'Subsea Cable', 'Subsea Cables', 7.5e10, 1.6e6, 'Fiber laid across the ocean floor. The sharks are curious.'],
    ['orbital', 'Orbital Node', 'Orbital Nodes', 1e12, 1e7, 'The latency is rough but the view is unbeatable.'],
    ['lunar', 'Lunar Farm', 'Lunar Farms', 1.4e13, 6.5e7, 'Free cooling on the far side of the Moon.'],
    ['swarm', 'Dyson Swarm', 'Dyson Swarms', 1.7e14, 4.3e8, 'Wrap the Sun in collectors. Power is no longer a problem.'],
    ['quantum', 'Quantum Core', 'Quantum Cores', 2.1e15, 2.9e9, 'Answers every request slightly before it is sent.'],
    ['brain', 'Matrioshka Brain', 'Matrioshka Brains', 2.6e16, 2.1e10, 'Nested shells of computronium around a star.'],
    ['universe', 'Pocket Universe', 'Pocket Universes', 3.1e17, 1.5e11, 'A whole simulated universe. Somewhere inside, someone is building a server farm.'],
  ].map(([id, name, plural, cost, rate, desc], i) => ({ id, name, plural, cost, rate, desc, index: i, icon: svg(id) }));
  const GEN = {}; GENS.forEach(g => { GEN[g.id] = g; });

  // ---------------- upgrades
  const UPGRADES = [];
  const TIER_AT = [1, 5, 25, 50, 100, 150, 200, 250, 300];
  const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14];
  const TIER_NAMES = ['Thermal Paste', 'Overclocking', 'RAM Upgrade', 'NVMe Cache', '10 GbE Uplink', 'Liquid Cooling', 'Custom Silicon', 'Photonic Interconnect', 'Reality Patch'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  for (const g of GENS) {
    TIER_AT.forEach((n, lv) => UPGRADES.push({
      id: `g_${g.id}_${lv}`, kind: 'gen', gen: g.id, level: lv, name: `${TIER_NAMES[lv]}`, sub: `${g.name} ${ROMAN[lv]}`,
      desc: `${g.plural} make twice as much.`, cost: g.cost * TIER_COST[lv], unlock: { type: 'owned', gen: g.id, n }, icon: g.icon, badge: ROMAN[lv],
    }));
  }
  [['Mechanical Keyboard', 100, 1], ['Gaming Mouse', 600, 10], ['Macro Pad', 12000, 100]].forEach(([name, cost, taps], i) => UPGRADES.push({
    id: 'tapx' + i, kind: 'tapmult', mult: 2, name, sub: 'Tap power', desc: 'Taps earn twice as much.', cost, unlock: { type: 'taps', n: taps }, icon: svg('tap'), badge: '×2',
  }));
  [['Click Ops', 5e4], ['Bash Alias', 5e6], ['Cron Job', 5e8], ['Ansible Playbook', 5e10], ['Terraform Module', 5e12], ['Container Orchestrator', 5e14],
    ['Self-Healing Cluster', 5e16], ['Neural Autocomplete', 5e18], ['Singularity Shell', 5e20]].forEach(([name, cost], i) => UPGRADES.push({
    id: 'tapp' + i, kind: 'tappct', pct: 0.01, name, sub: 'Tap power', desc: 'Each tap also earns 1% of your income per second.', cost, unlock: { type: 'earned', v: cost / 5 }, icon: svg('tap'), badge: '+1%',
  }));
  [['Monitoring Dashboard', 5e4, 1.1], ['Load Balancer', 1e6, 1.1], ['Content Delivery Network', 2e7, 1.15], ['Caching Layer', 5e8, 1.15], ['Autoscaling', 1e10, 1.2],
    ['Edge Computing', 3e11, 1.2], ['Zero-Downtime Deploys', 1e13, 1.25], ['Predictive Prefetch', 5e14, 1.25], ['Global Anycast', 2e16, 1.3], ['Neural Scheduler', 1e18, 1.3],
    ['Time-Travel Debugger', 5e19, 1.35], ['Infinite Bandwidth', 3e21, 1.4], ['Heat Death Insurance', 2e23, 1.5]].forEach(([name, cost, mult], i) => UPGRADES.push({
    id: 'glob' + i, kind: 'global', mult, name, sub: 'Infrastructure', desc: `All income +${Math.round((mult - 1) * 100)}%.`, cost, unlock: { type: 'earned', v: cost / 5 }, icon: svg('global'), badge: `+${Math.round((mult - 1) * 100)}%`,
  }));
  [['99% SLA', 1e6, 8], ['99.9% SLA', 1e9, 20], ['Four Nines', 1e12, 32], ['Five Nines', 1e15, 44], ['Six Nines', 1e18, 56], ['Seven Nines', 1e21, 68]].forEach(([name, cost, n], i) => UPGRADES.push({
    id: 'sla' + i, kind: 'sla', name, sub: 'Reliability', desc: 'Each achievement gives +0.5% more income.', cost, unlock: { type: 'ach', n }, icon: svg('sla'), badge: 'SLA',
  }));
  [['Traffic Analytics', 7.77e5, 5], ['Viral Marketing', 7.77e8, 20], ['Trend Prediction', 7.77e11, 60]].forEach(([name, cost, n], i) => UPGRADES.push({
    id: 'spk' + i, kind: 'spike', name, sub: 'Traffic spikes', desc: 'Traffic spikes show up 30% more often and stay on screen 30% longer.', cost, unlock: { type: 'packets', n }, icon: svg('spike'), badge: '⚡',
  }));
  const UPG = {}; UPGRADES.forEach(u => { UPG[u.id] = u; });

  // ---------------- prestige perks (bought with Equity)
  const PERKS = [
    { id: 'starter', name: 'Starter Kit', cost: 1, desc: 'Begin every run with 10 Raspberry Pis.' },
    { id: 'night', name: 'Night Shift', cost: 3, desc: 'Offline earnings go from 50% to 75%.' },
    { id: 'detector', name: 'Spike Detector', cost: 5, desc: 'Traffic spikes show up 25% more often.' },
    { id: 'weekend', name: 'Long Weekend', cost: 6, desc: 'Offline earnings build up for 24 hours instead of 8.' },
    { id: 'intern', name: 'Intern', cost: 8, desc: 'Taps the CPU for you twice a second.' },
    { id: 'brand', name: 'Brand Recognition', cost: 12, desc: 'All income +25%.' },
    { id: 'bulk', name: 'Bulk Discount', cost: 18, desc: 'Hardware costs 7% less.' },
    { id: 'graveyard', name: 'Graveyard Shift', cost: 30, desc: 'Offline earnings go up to 100%.', req: 'night' },
    { id: 'longtail', name: 'Long Tail', cost: 40, desc: 'Traffic spike bonuses last 50% longer.' },
    { id: 'series', name: 'Series A', cost: 60, desc: 'Begin every run with 25 Pis, 25 Laptops and 10 NASes.', req: 'starter' },
    { id: 'memory', name: 'Institutional Memory', cost: 90, desc: 'Keep your tap upgrades when you sell.' },
    { id: 'senior', name: 'Senior Engineer', cost: 125, desc: 'The intern got promoted: 8 taps a second.', req: 'intern' },
    { id: 'licensing', name: 'Volume Licensing', cost: 175, desc: 'Hardware costs another 7% less.', req: 'bulk' },
    { id: 'procure', name: 'Procurement Bot', cost: 250, desc: 'Buys upgrades for you as soon as you can afford them (toggle in Upgrades).' },
    { id: 'compound', name: 'Compound Interest', cost: 400, desc: 'Each Equity point gives +6% income instead of +4%.' },
    { id: 'unicorn', name: 'Unicorn Status', cost: 1000, desc: 'All income doubled.' },
  ];
  const PERK = {}; PERKS.forEach(p => { PERK[p.id] = p; });

  // ---------------- achievements
  const ACH = [];
  const FIRST = {
    pi: 'Hello, World', laptop: 'Lid Closed', nas: 'RAID Is Not a Backup', tower: 'Heavy Lifting', rack: 'Cable Management', room: 'Raised Floor',
    colo: 'Bring Your Badge', dc: 'Lights-Out Ops', campus: 'Visible from Space', cable: 'Shark Bait', orbital: 'Low Earth Latency', lunar: 'Far Side Cooling',
    swarm: 'Here Comes the Sun', quantum: 'Superposition', brain: 'Thinking Big', universe: 'Servers All the Way Down',
  };
  for (const g of GENS) {
    ACH.push({ id: `own_${g.id}_1`, name: FIRST[g.id], desc: `Own a ${g.name}.`, cond: { type: 'owned', gen: g.id, n: 1 } });
    ACH.push({ id: `own_${g.id}_50`, name: `${g.name} Fleet`, desc: `Own 50 ${g.plural}.`, cond: { type: 'owned', gen: g.id, n: 50 } });
    ACH.push({ id: `own_${g.id}_100`, name: `${g.plural} by the Hundred`, desc: `Own 100 ${g.plural}.`, cond: { type: 'owned', gen: g.id, n: 100 } });
    ACH.push({ id: `own_${g.id}_200`, name: `${g.plural} Everywhere`, desc: `Own 200 ${g.plural}.`, cond: { type: 'owned', gen: g.id, n: 200 } });
  }
  [[1e3, 'Side Hustle'], [1e6, 'Seven Figures'], [1e9, 'Unicorn Startup'], [1e12, 'Trillion Dollar Club'], [1e15, 'Too Big to Fail'], [1e18, 'Planetary GDP'],
    [1e21, 'Galactic Treasury'], [1e24, 'Post-Scarcity'], [1e27, 'Money Is Just a Number'], [1e30, 'Integer Overflow'], [1e33, 'Heat Death Budget']].forEach(([v, name]) =>
    ACH.push({ id: 'earn_' + Math.round(Math.log10(v)), name, desc: `Earn $${fmtPlain(v)} in total.`, cond: { type: 'earnedLife', v } }));
  [[1, 'First Request'], [100, 'Small Business'], [1e4, 'Startup'], [1e6, 'Scale-Up'], [1e9, 'Enterprise'], [1e12, 'Hyperscaler'], [1e15, 'Planet-Scale'], [1e18, 'Kardashev Type II'], [1e21, 'Kardashev Type III']].forEach(([v, name]) =>
    ACH.push({ id: 'inc_' + Math.round(Math.log10(v)), name, desc: `Make $${fmtPlain(v)} per second.`, cond: { type: 'income', v } }));
  [[100, 'Click Ops'], [1000, 'Repetitive Strain'], [10000, 'Thumb of Steel'], [50000, 'Tap Dancer']].forEach(([n, name]) =>
    ACH.push({ id: 'tap_' + n, name, desc: `Tap the CPU ${n.toLocaleString('en-US')} times.`, cond: { type: 'taps', n } }));
  [[1, 'Spike!'], [7, 'Trend Spotter'], [27, 'Viral Engineer'], [77, 'Algorithm Whisperer'], [200, 'The Feed Is Yours']].forEach(([n, name]) =>
    ACH.push({ id: 'pkt_' + n, name, desc: `Catch ${n} traffic spike${n > 1 ? 's' : ''}.`, cond: { type: 'packets', n } }));
  [[1, 'Exit Strategy'], [3, 'Serial Founder'], [10, 'Startup Factory'], [25, 'Venture Machine']].forEach(([n, name]) =>
    ACH.push({ id: 'ipo_' + n, name, desc: `Sell the company ${n === 1 ? 'once' : n + ' times'}.`, cond: { type: 'prestige', n } }));
  ACH.push({ id: 'fullstack', name: 'Full Stack', desc: 'Own at least one of every kind of hardware.', cond: { type: 'allgens' } });
  [[25, 'Patch Tuesday'], [75, 'Change Management'], [150, 'Continuous Delivery']].forEach(([n, name]) =>
    ACH.push({ id: 'upg_' + n, name, desc: `Buy ${n} upgrades in one run.`, cond: { type: 'upgrades', n } }));
  const ACHI = {}; ACH.forEach(a => { ACHI[a.id] = a; });

  function fmtPlain(v) {
    const names = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];
    const e = Math.floor(Math.log10(v) / 3);
    return e <= 1 ? v.toLocaleString('en-US') : `${Math.round(v / Math.pow(10, e * 3))} ${names[e]}`;
  }

  // ---------------- news ticker. tier = highest hardware index owned (-1 = none yet)
  const NEWS = [
    [-1, 'Local person stares at an old laptop and wonders if it could be a server.'],
    [-1, 'Experts agree: the cloud is just someone else\'s computer.'],
    [-1, 'Area resident discovers port forwarding. Immediately regrets it.'],
    [0, 'Raspberry Pi serves its first web page. Hobbyists weep with joy.'],
    [0, 'Study finds 9 out of 10 Pis live in a drawer. Yours does not.'],
    [0, 'Single-board computer now runs DNS, a media server and a dashboard of dashboards.'],
    [1, 'Old laptop finds new purpose: being a server with its lid closed.'],
    [1, 'Laptop battery swells with pride. Also just swells.'],
    [2, 'Home NAS hits 90% full. Owner buys bigger drives instead of deleting anything.'],
    [2, '"RAID is not a backup," says man who just lost a RAID.'],
    [3, 'Tower server fans audible three houses away. Neighbors file noise complaint.'],
    [3, 'Power bill arrives. Tower server unrepentant.'],
    [4, 'First rack installed. Cable management described as "a work in progress".'],
    [4, 'Rack screws everywhere. None of them the right size.'],
    [5, 'Server room door now requires a badge, a PIN and a good reason.'],
    [5, 'Raised floor hides cables, snacks and one missing intern.'],
    [6, 'Colo staff learn your name. Not in a good way.'],
    [6, 'Remote hands asked to "just jiggle it". It worked.'],
    [7, 'Your data center now has its own substation and a very serious lobby.'],
    [7, 'Diesel generators tested. Local birds relocate.'],
    [7, 'Mantrap holds visiting executive for 45 minutes. Security calls it a success.'],
    [8, 'Hyperscale campus visible from orbit. Astronauts wave.'],
    [8, 'Small town renamed after your campus. Mayor gets free hosting for life.'],
    [9, 'New subsea cable cuts ocean latency to "basically instant".'],
    [9, 'Shark bites fiber cable, reports it "tastes like 400 gigabits".'],
    [10, 'Orbital node sets uptime record. Only goes down during eclipses.'],
    [10, 'Space debris politely asked to route around your satellites.'],
    [11, 'Lunar farm reports perfect cooling. Complains about the commute.'],
    [11, 'The Moon is now 12% server by mass.'],
    [12, 'Dyson swarm complete. The Sun has been asked to work weekends.'],
    [12, 'Astronomers light-years away notice our Sun getting dimmer. Send a complaint.'],
    [13, 'Quantum core answers a query before it was asked. Legal reviews causality.'],
    [13, 'Your servers are both up and down until someone checks the dashboard.'],
    [14, 'Matrioshka brain spends idle cycles writing poetry about load balancers.'],
    [14, 'Computronium shells request a raise. Paid in compute.'],
    [15, 'Pocket universe boots. Inside, a small blue planet invents the single-board computer.'],
    [15, 'Simulated civilization learns it runs on your hardware. Files a support ticket.'],
    [-1, 'Tabs versus spaces debate enters its sixth decade.'],
    [-1, 'Survey: 100% of outages caused by "a small config change".'],
    [-1, 'It\'s always DNS. Experts confirm it is, once again, DNS.'],
    [-1, 'Intern pushes to production on Friday. Weekend cancelled.'],
    [-1, 'Study: blinking LEDs make servers 30% faster. Science disputes this.'],
    [-1, 'Rubber duck promoted to senior engineer.'],
    [-1, 'Have you tried turning it off and on again? Results inconclusive.'],
    [3, 'Sysadmin\'s homelab now more reliable than their employer\'s production.'],
    [5, 'Ticket #4,812 closed: "works on my machine". Customer satisfied anyway.'],
    [8, 'Your status page has a status page.'],
    [10, 'Ping to orbit: 38 ms. Ping to the office printer: timed out.'],
  ];
  const NEWS_SPECIAL = {
    prestige: ['Former founder starts a new company. Investors: "we would be fools not to".', 'Your last exit is now taught in business schools as "a lot of servers".'],
    packet: ['Traffic spike traced to a video of a cat walking across a keyboard.', 'Viral post brings in millions of visitors. Nobody knows why.'],
  };

  const EFFECTS = {
    viral: { name: 'Gone viral', desc: 'Income ×7', mult: 7, dur: 77, weight: 46, color: '#ffd24a' },
    contract: { name: 'Big contract', desc: 'Instant payout', weight: 40, color: '#5bff8f' },
    overclock: { name: 'Overclocked', desc: 'Taps ×77', tap: 77, dur: 20, weight: 10, color: '#4fe0ff' },
    launch: { name: 'Launch day', desc: 'Income ×17', mult: 17, dur: 12, weight: 4, color: '#ff7be0' },
  };

  return { GENS, GEN, UPGRADES, UPG, PERKS, PERK, ACH, ACHI, NEWS, NEWS_SPECIAL, EFFECTS, ICONS: I, svg, TIER_AT };
});
