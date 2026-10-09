# Server Farm

An idle game for Android. Tap the chip, buy a Raspberry Pi, and grow a server farm through racks, data centers, subsea cables and orbital nodes up to a Dyson swarm and a pocket universe.

- 16 kinds of hardware, 178 upgrades, 101 achievements
- Traffic spikes: tap the golden bolt for income ×7, taps ×77, or a big contract payout
- Offline earnings while the app is closed
- Sell the company for Equity (+4% income per point, forever) and spend it on 16 board perks
- Five scenes that change as you grow: desk, server room, data hall, orbit, deep space
- All art and sound is generated in code

## Download

Every push to `main` runs the tests, builds a signed APK on GitHub Actions and publishes it as a release (`ServerFarm.apk`). Open it on the phone and allow installs from that source when Android asks. Installing a newer build over an older one keeps the save.

## Development

Plain HTML5 canvas and JavaScript in `src/`, no build step. Android wraps it with Capacitor.

```
python3 -m http.server --directory src   # play in a browser at http://localhost:8000
node tools/test.js                        # engine tests
node tools/sim.js active 24               # balance simulator (profiles: active, casual)
python3 tools/make_icons.py               # regenerate icons and splash
```

`src/js/engine.js` holds every rule (income, costs, spikes, prestige, offline, saves) with no DOM, so the tests and the simulator run the same code as the phone. Tuning knobs for prestige are in `Engine.T`.

`build/release.keystore` signs the APK (alias `farm`, password `farm-release`). Keep it: Android only installs updates signed with the same key.
