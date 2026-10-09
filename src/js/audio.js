/* Synthesized sound (WebAudio, no files) and haptics. Music is a slow lo-fi loop under a soft server-room hum. */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let musicOn = false, nextBar = 0, bar = 0, timer = null, lastTap = 0;
  const vol = { music: 0.4, sfx: 0.8 };
  let haptics = true;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx.state !== 'closed'; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.55; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const running = () => ctx && ctx.state === 'running';

  function setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'sfx') sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    else musicBus.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.2);
  }

  function tone(freq, o) {
    o = o || {};
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || o.decay || 0.2));
    const g = ctx.createGain();
    const a = o.attack || 0.004, dcy = o.decay || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
    let node = osc;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + a + dcy + 0.05);
  }
  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.decay || 0.3));
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack || 0.01) + (o.decay || 0.3));
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random()); src.stop(t + (o.attack || 0.01) + (o.decay || 0.3) + 0.05);
  }

  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  const SFX = {
    tap() {
      const now = ctx.currentTime;
      if (now - lastTap < 0.045) return; // fast tapping: don't stack clicks into noise
      lastTap = now;
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(660 * Math.pow(2, n / 12), { type: 'triangle', gain: 0.07, decay: 0.07 });
      noise({ freq: 5000, gain: 0.025, decay: 0.02, q: 3 });
    },
    buy() { tone(1046, { type: 'square', gain: 0.05, decay: 0.05, filter: 3500 }); tone(1568, { type: 'triangle', gain: 0.12, decay: 0.22, delay: 0.05 }); },
    upgrade() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', gain: 0.1, decay: 0.25, delay: i * 0.045 })); },
    deny() { tone(150, { type: 'sawtooth', gain: 0.08, decay: 0.12, filter: 700 }); },
    tab() { tone(1400, { type: 'triangle', gain: 0.05, decay: 0.03 }); },
    spike() { [1760, 2349, 2637].forEach((f, i) => tone(f, { type: 'sine', gain: 0.05, decay: 0.4, delay: i * 0.07 })); },
    catch() {
      noise({ freq: 1500, to: 6000, gain: 0.12, decay: 0.35, q: 2 });
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'triangle', gain: 0.13, decay: 0.4, delay: i * 0.05 }));
    },
    achieve() { [659, 831, 988, 1319].forEach((f, i) => tone(f, { type: 'square', gain: 0.05, decay: 0.3, delay: i * 0.08, filter: 2600 })); tone(1976, { type: 'sine', gain: 0.07, decay: 0.8, delay: 0.32 }); },
    collect() { for (let i = 0; i < 8; i++) tone(1200 + i * 140, { type: 'triangle', gain: 0.07, decay: 0.12, delay: i * 0.035 }); },
    sell() {
      noise({ freq: 300, to: 4000, gain: 0.25, decay: 1.0, q: 1.5 });
      [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', gain: 0.14, decay: 1.1, delay: 0.3 + i * 0.06 }));
    },
    perk() { [523, 784, 1047].forEach((f, i) => tone(f, { type: 'sine', gain: 0.14, decay: 0.5, delay: i * 0.07 })); },
  };

  // ---- music: Fmaj7 - Em7 - Dm9 - Cmaj7, soft electric-piano plucks over a pad, ~70 bpm
  const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 64], [48, 52, 55, 59]];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const BAR = 3.4;
  function scheduleBar(t, chord) {
    for (const n of chord) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n - 12);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.9); g.gain.setValueAtTime(0.03, t + BAR - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + BAR + 0.5);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + BAR + 0.6);
    }
    // bass on beat 1 and the "and" of 3
    for (const [off, len] of [[0, 1.4], [BAR * 0.625, 0.8]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(chord[0] - 24);
      const g = ctx.createGain(); const tt = t + off;
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.09, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
      o.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + len + 0.05);
    }
    // plucks, swung eighths
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.5) continue;
      const n = chord[Math.floor(Math.random() * chord.length)] + 12;
      const tt = t + i * BAR / 8 + (i % 2 ? BAR / 48 : 0);
      for (const [mul, gain] of [[1, 0.045], [2, 0.012]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n) * mul;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(gain, tt + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.1);
        o.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + 1.2);
      }
    }
    // soft hi-hat ticks like drive activity
    for (let i = 0; i < 8; i++) {
      const tt = t + i * BAR / 8 + (i % 2 ? BAR / 48 : 0);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(i % 2 ? 0.012 : 0.02, tt + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
      src.connect(f); f.connect(g); g.connect(musicBus); src.start(tt, Math.random()); src.stop(tt + 0.06);
    }
  }
  let hum = null;
  function startHum() {
    // server-room fan hum: filtered noise, very quiet
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(musicBus); src.start();
    hum = src;
  }
  function pump() {
    if (!musicOn || !running()) return;
    if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
    while (nextBar < ctx.currentTime + 1.0) { scheduleBar(nextBar, CHORDS[bar % CHORDS.length]); nextBar += BAR; bar++; }
  }
  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    nextBar = ctx.currentTime + 0.1;
    if (!hum) startHum();
    pump();
    timer = setInterval(pump, 400);
  }
  function stopMusic() { musicOn = false; if (timer) clearInterval(timer); timer = null; if (hum) { try { hum.stop(); } catch (e) { /* already stopped */ } hum = null; } }

  // ---- haptics: Capacitor plugin on the phone, vibrate() as a fallback
  function buzz(kind) {
    if (!haptics) return;
    try {
      const H = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Haptics;
      if (H) {
        if (kind === 'success') H.notification({ type: 'SUCCESS' });
        else H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      } else if (root.navigator && root.navigator.vibrate) {
        root.navigator.vibrate(kind === 'success' ? [12, 40, 18] : kind === 'heavy' ? 30 : kind === 'medium' ? 18 : 8);
      }
    } catch (e) { /* haptics are best-effort */ }
  }

  root.Sound = {
    unlock: ensure,
    play(name, arg) { try { if (vol.sfx > 0 && SFX[name] && ensure() && running()) SFX[name](arg); } catch (e) { /* audio is best-effort */ } },
    startMusic, stopMusic, setVolume, buzz,
    setHaptics(on) { haptics = !!on; },
    get musicOn() { return musicOn; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})(this);
