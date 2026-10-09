// Run in CI after `npx cap add android`: portrait lock, fullscreen activity, version numbers.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'android');
const manifest = path.join(root, 'app/src/main/AndroidManifest.xml');
let m = fs.readFileSync(manifest, 'utf8');
if (!m.includes('screenOrientation')) {
  m = m.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
}
fs.writeFileSync(manifest, m);
if (!m.includes('android:screenOrientation="portrait"')) { console.error('could not lock orientation'); process.exit(1); }

const javaDir = path.join(root, 'app/src/main/java/com/rob/serverfarm');
fs.mkdirSync(javaDir, { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', 'android-overrides/MainActivity.java'), path.join(javaDir, 'MainActivity.java'));

const gradle = path.join(root, 'app/build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
const code = Number(process.env.VERSION_CODE || 1);
const name = process.env.VERSION_NAME || '1.0.0';
g = g.replace(/versionCode \d+/, 'versionCode ' + code).replace(/versionName "[^"]*"/, 'versionName "' + name + '"');
fs.writeFileSync(gradle, g);
console.log('android patched: versionCode', code, 'versionName', name);
