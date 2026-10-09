/* Boot, main loop, input, saving, offline earnings, Android lifecycle. */
(function (root) {
  'use strict';
  const D = root.Data, E = root.Engine, F = root.Fmt, UI = root.UI, Scene = root.Scene, Sound = root.Sound;
  const hero = document.getElementById('hero');
  const KEY = E.SAVE_KEY;

  // ---------------- load
  let S;
  try { const raw = root.localStorage && root.localStorage.getItem(KEY); S = raw ? E.deserialize(raw) : E.newState(); }
  catch (e) { S = E.newState(); }
  function applySettings() {
    F.setNotation(S.settings.notation);
    Sound.setVolume('sfx', S.settings.sfx);
    Sound.setVolume('music', S.settings.music);
    Sound.setHaptics(S.settings.haptics);
  }
  applySettings();

  function save() {
    S.lastTick = Date.now();
    try { root.localStorage && root.localStorage.setItem(KEY, E.serialize(S)); } catch (e) { /* storage full or blocked */ }
  }

  // ---------------- actions the UI calls
  const actions = {
    buyGen(id, amt, btn) {
      const n = E.buyGen(S, id, amt);
      if (n > 0) { Sound.play('buy'); Sound.buzz('light'); UI.flash(btn); afterChange(); }
      else { Sound.play('deny'); }
    },
    buyUpgrade(id, btn) {
      if (E.buyUpgrade(S, id)) { Sound.play('upgrade'); Sound.buzz('medium'); UI.toast('Installed ' + D.UPG[id].name, D.UPG[id].desc, D.UPG[id].icon); afterChange(); }
      else { Sound.play('deny'); if (btn) UI.flash(btn); }
    },
    buyAllUpgrades() {
      const n = E.buyAllUpgrades(S);
      if (n) { Sound.play('upgrade'); Sound.buzz('medium'); UI.toast(`Installed ${n} upgrade${n > 1 ? 's' : ''}`); afterChange(); } else Sound.play('deny');
    },
    buyPerk(id) {
      if (E.buyPerk(S, id)) { Sound.play('perk'); Sound.buzz('success'); UI.toast(D.PERK[id].name, D.PERK[id].desc, D.svg('equity')); afterChange(); }
      else Sound.play('deny');
    },
    sell() {
      const gain = E.sell(S);
      if (!gain) return;
      Sound.play('sell'); Sound.buzz('heavy');
      UI.toast(`Sold for +${F.num(gain)} Equity`, 'Fresh start. Everything earns more now.', D.svg('equity'));
      afterChange(); save();
    },
    replace(ns) { S = ns; applySettings(); UI.setState(S); save(); },
    save,
  };
  function afterChange() { checkAch(); UI.update(); }

  // ---------------- achievements
  function checkAch() {
    const got = E.checkAchievements(S);
    if (!got.length) return;
    Sound.play('achieve'); Sound.buzz('success');
    if (got.length > 2) UI.toast(`${got.length} achievements unlocked`, `+${got.length}% income or more`, D.svg('sla'));
    else for (const a of got) UI.toast(a.name, a.desc, D.svg('sla'));
  }

  // ---------------- input on the scene
  function local(e) { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  hero.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    const [x, y] = local(e);
    if (Scene.hitSpike(x, y)) { catchSpike(); return; }
    if (Scene.hitChip(x, y)) {
      const v = E.tap(S, false);
      const boosted = S.effects.some(fx => fx.until > S.clock);
      Scene.tapFx(x, y, '+' + F.money(v), boosted ? '#ffd24a' : '#ffffff', false);
      Sound.play('tap'); Sound.buzz('light');
      hintCheck();
    }
  });
  function catchSpike() {
    const p = Scene.popSpike();
    const r = E.catchSpike(S, Math.random);
    const fx = D.EFFECTS[r.kind];
    Sound.play('catch'); Sound.buzz('heavy');
    if (r.kind === 'contract') { UI.toast('Big contract!', `+${F.money(r.amount)}`, D.svg('spike')); Scene.floatText(p.x, p.y, '+' + F.money(r.amount), '#5bff8f', 26); }
    else { UI.toast(fx.name + '!', `${fx.desc} for ${Math.round(E.effectDur(S, r.kind))} seconds`, D.svg('spike')); Scene.floatText(p.x, p.y, fx.desc, fx.color, 24); }
    checkAch(); UI.update();
  }

  // ---------------- first-run hints
  let hintEl = null;
  function hintCheck() {
    let text = null;
    if (S.taps < 3 && !S.owned.pi) text = 'Tap the chip';
    else if (!S.owned.pi && S.prestiges === 0) text = S.money >= 15 ? 'Buy a Raspberry Pi below' : 'Keep tapping';
    if (!text) { if (hintEl) { hintEl.remove(); hintEl = null; } return; }
    if (!hintEl) { hintEl = document.createElement('div'); hintEl.id = 'hint'; hero.appendChild(hintEl); }
    if (hintEl.textContent !== text) hintEl.textContent = text;
    const c = Scene.chip;
    hintEl.style.top = Math.max(6, c.y - c.s * 0.62 - 40) + 'px';
  }

  // ---------------- layout
  function layout() {
    const r = hero.getBoundingClientRect();
    Scene.resize(r.width, r.height);
    UI.drawLCD(true);
    hintCheck();
  }
  root.addEventListener('resize', layout);

  // ---------------- time away
  function resume() {
    const r = E.applyOffline(S, Date.now());
    if (r && r.earned > 0 && r.away >= 60) UI.showOffline(r);
    checkAch(); UI.update();
  }
  function pause() { save(); Sound.suspend(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else { Sound.resume(); resume(); } });
  root.addEventListener('pagehide', save);
  root.addEventListener('beforeunload', save);

  const cap = root.Capacitor, App = cap && cap.Plugins && cap.Plugins.App;
  if (App && App.addListener) {
    App.addListener('backButton', () => {
      if (UI.back()) { Sound.play('tab'); return; }
      save();
      if (App.minimizeApp) App.minimizeApp(); else App.exitApp();
    });
    App.addListener('pause', pause);
    App.addListener('resume', () => { Sound.resume(); resume(); });
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') UI.back();
    if (e.key === ' ' && !UI.modalOpen && e.target === document.body) { const c = Scene.chip; hero.dispatchEvent(new PointerEvent('pointerdown', { clientX: hero.getBoundingClientRect().left + c.x, clientY: hero.getBoundingClientRect().top + c.y })); e.preventDefault(); }
  });

  // audio may only start after a real gesture; keep trying until it sticks
  let musicStarted = false;
  const gesture = () => { if (!Sound.unlock()) return; if (!musicStarted && S.settings.music > 0) { musicStarted = true; Sound.startMusic(); } };
  for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']) root.addEventListener(ev, gesture, true);

  // ---------------- loop
  let last = performance.now(), uiAcc = 0, achAcc = 0, saveAcc = 0, logged = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (err) { if (logged++ < 5) console.error(err); }
  }
  function step(now) {
    let dt = (now - last) / 1000;
    last = now;
    // the app was frozen in the background without telling us: count it as time away
    if (Date.now() - S.lastTick > 5000) { resume(); dt = 0; }
    dt = Math.min(0.25, Math.max(0, dt));
    E.tick(S, dt);
    S.lastTick = Date.now();
    if (S.clock >= S.nextPacket) {
      if (!Scene.spike) { Scene.spawnSpike(E.spikeLife(S)); Sound.play('spike'); Sound.buzz('light'); }
      S.nextPacket = S.clock + E.spikeLife(S) + E.nextSpikeDelay(S, Math.random);
    }
    const boost = S.effects.find(e => e.until > S.clock && D.EFFECTS[e.kind].mult);
    Scene.frame({ tier: E.topTier(S), owned: S.owned, income: E.income(S, true), boost: boost ? D.EFFECTS[boost.kind].color : null }, now, dt);
    UI.updateTicker(dt);
    uiAcc += dt; achAcc += dt; saveAcc += dt;
    if (uiAcc >= 0.12) { uiAcc = 0; UI.update(); }
    if (achAcc >= 0.5) { achAcc = 0; checkAch(); hintCheck(); }
    if (saveAcc >= 10) { saveAcc = 0; save(); }
  }

  // ---------------- boot
  Scene.init(document.getElementById('scene'));
  UI.init(S, actions);
  layout();
  const away = E.applyOffline(S, Date.now());
  checkAch();
  UI.update();
  if (away && away.earned > 0 && away.away >= 60) UI.showOffline(away);
  else if (S.clock < 1 && S.prestiges === 0) UI.showHelp();
  root.Main = { get state() { return S; }, save, actions };
  requestAnimationFrame(frame);
})(this);
