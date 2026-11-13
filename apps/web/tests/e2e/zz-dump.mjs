import { launch } from './harness.mjs';
import { writeFileSync } from 'node:fs';
const b = await launch({ port: 9731 });
const out = {};
try {
  await b.viewport(1440, 900);
  await b.goto('http://127.0.0.1:5392/', 600);
  for (const app of ['word','excel','powerpoint','pdf']) {
    await b.goto(`http://127.0.0.1:5392/?app=${app}&e2e=1`, 1500);
    out[app] = JSON.parse(await b.ev(`JSON.stringify(window.__FO_RIBBON__.schema())`));
  }
} finally { await b.close(); }
writeFileSync('D:/Temp/oo-ref/schema.json', JSON.stringify(out));
const flat = (cs) => cs.flatMap((c) => c.kind === 'row' ? flat(c.controls) : [c]);
for (const [app, tabs] of Object.entries(out)) { console.log('==', app); for (const t of tabs) { console.log(' #', t.id); for (const g of t.groups) console.log('   ', g.id + ': ' + flat(g.controls).map((c) => c.id + '[' + c.kind[0] + ']' + c.label).join(' | ')); } }
