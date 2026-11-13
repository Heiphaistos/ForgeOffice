// Propose des alias : pour chaque entree de menu non branchee, les commandes du catalogue au libelle le plus proche.
import { readFileSync } from 'node:fs';
import { makeBinder } from '../../packages/ui/src/logic/suite/bind.ts';
import { LIBREOFFICE_DATA } from '../../packages/ui/src/logic/suite/libreoffice.generated.ts';
const app = process.argv[2];
const docs = new URL('../../docs/conformite/', import.meta.url);
const cat = JSON.parse(readFileSync(new URL(app + '.json', docs), 'utf8')).commandes.filter((c) => !c.type.endsWith('-option') && !c.type.endsWith('-pick')).map((c) => ({ ref: c.id, label: c.label, run: () => {} }));
const binder = makeBinder(cat);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
const stop = new Set(['de', 'la', 'le', 'les', 'des', 'du', 'un', 'une', 'et', 'en', 'a', 'au', 'aux', 'd', 'l']);
const toks = (s) => new Set(fold(s).split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)));
const leaves = (items, out) => { for (const i of items) { if (i.i) leaves(i.i, out); else if (!i.sep && i.l) out.push(i); } };
const out = []; for (const m of LIBREOFFICE_DATA[app].menu) leaves(m.i ?? [], out);
const seen = new Set();
for (const i of out) {
  if (seen.has(i.u) || binder.find(i.u ?? '', i.l)) continue; seen.add(i.u);
  const a = toks(i.l); if (!a.size) continue;
  const best = cat.map((c) => { const b = toks(c.label); let n = 0; for (const w of a) if (b.has(w)) n++; return [n / Math.max(a.size, b.size, 1), c]; }).filter(([s]) => s >= 0.5).sort((x, y) => y[0] - x[0]).slice(0, 2);
  if (best.length) console.log(`${i.u} (${i.l}) => ${best.map(([s, c]) => `${c.ref} [${c.label}] ${s.toFixed(2)}`).join(' ; ')}`);
}
