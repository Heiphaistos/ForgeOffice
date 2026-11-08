// Banc CDP du module (Chromium sans interface). Prérequis : `node ../../node_modules/vite/bin/vite.js --port 5430 --host 127.0.0.1`
// depuis apps/web. Chaque script : `node packages/<module>/tests/e2e/<script>.mjs` ; captures dans FO_OUT (défaut : dossier temporaire).
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { launch, sleep } from 'file:///D:/Projet/ForgeOffice/apps/web/tests/e2e/harness.mjs';
import { key } from 'file:///D:/Projet/ForgeOffice/apps/web/tests/e2e/excel-keys-lib.mjs';
export { sleep, key };
export const OUT = process.env.FO_OUT ?? tmpdir().split(String.fromCharCode(92)).join('/');
export const BASE = 'http://127.0.0.1:5430';
export async function start(module, fixtureName, fileName) {
  const { buildFixture } = await import('file:///D:/Projet/ForgeOffice/apps/web/tests/conformity/fixtures.ts');
  const b = await launch({ port: 9730 });
  await b.viewport(1500, 950);
  await b.goto(`${BASE}/?app=hub`);
  await b.drop('.hub', fileName, Buffer.from(await buildFixture(fixtureName)));
  await b.waitFor(`document.documentElement.dataset.app === '${module}'`, 20000);
  await sleep(2500);
  return b;
}
export const res = [];
export const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? 'OK   ' : 'ECHEC'} ${n}${d ? ' : ' + d : ''}`); };
export const shot = async (b, name) => { const s = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64')); };
import { spawnSync } from 'node:child_process';
export const killChrome = () => spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=9730' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"]);
export const done = async (b) => { console.log(`${res.filter(Boolean).length}/${res.length}`); console.log(b.consoleLog.slice(0, 8).join('\n')); try { await b.close(); } catch { /* ferme */ } killChrome(); };
