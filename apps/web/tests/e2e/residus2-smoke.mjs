// Fumee : ouvre riche.pptx, exporte en PDF, ecrit le PDF et une capture.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const dir = process.argv[2]; const out = process.argv[3];
const b = await launch({ port: 9631 });
try {
  await b.viewport(1440, 900);
  await b.goto('http://127.0.0.1:5371/?app=hub');
  await b.drop('.hub', 'riche.pptx', readFileSync(`${dir}/riche.pptx`));
  await b.waitFor(`document.documentElement.dataset.app === 'powerpoint'`, 20000);
  await sleep(2500);
  await b.shot(`${out}/edition.png`);
  await b.click('text=Fichier'); await sleep(400);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Exporter'); await sleep(400);
  await b.clickText('button, [role=button]', 'Créer un document PDF'); 
  for (let i = 0; i < 40; i++) { const d = await b.downloads(); if (d.length) { writeFileSync(`${out}/${d[0].name}`, d[0].bytes); console.log('pdf', d[0].name, d[0].bytes.length); break; } await sleep(500); }
  console.log(b.consoleLog.slice(0, 10));
} finally { await b.close(); }
