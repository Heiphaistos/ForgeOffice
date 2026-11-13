import { readFileSync } from 'node:fs';
import { makeBinder } from '../../packages/ui/src/logic/suite/bind.ts';
import { LIBREOFFICE_DATA } from '../../packages/ui/src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../../packages/ui/src/logic/suite/openoffice.generated.ts';
const app = process.argv[2] ?? 'word';
const suite = process.argv[3] === 'oo' ? OPENOFFICE_DATA : LIBREOFFICE_DATA;
const docs = new URL('../../docs/conformite/', import.meta.url);
const cat = JSON.parse(readFileSync(new URL(app + '.json', docs), 'utf8')).commandes.filter((c) => !c.type.endsWith('-option') && !c.type.endsWith('-pick')).map((c) => ({ ref: c.id, label: c.label, run: () => {} }));
// commandes de l'application (fichier, fenetre, aide) : lues dans SuiteLayout.tsx pour compter comme branchees
const hostSrc = readFileSync(new URL('../../packages/ui/src/components/layouts/SuiteLayout.tsx', import.meta.url), 'utf8');
const hostBlock = hostSrc.slice(hostSrc.indexOf('const cmds'), hostSrc.indexOf('if (!onFile)'));
const host = Object.fromEntries([...hostBlock.matchAll(/([A-Z][A-Za-z]+):/g)].map((m) => [m[1], () => {}]));
const binder = makeBinder(cat, host);
const leaves = (items, top, out) => { for (const i of items) { if (i.i) leaves(i.i, top, out); else if (!i.sep && i.l) out.push([top, i]); } };
const out = []; for (const m of suite[app].menu) leaves(m.i ?? [], m.l, out);
const un = out.filter(([, i]) => !binder.find(i.u ?? '', i.l));
console.log(app, 'menus', out.length, 'non branches', un.length, 'branches', Math.round((100 * (out.length - un.length)) / out.length) + ' %');
if (process.argv[4] === 'list') for (const [t, i] of un) console.log(t, '|', i.u, '|', i.l);
if (process.argv[4] === 'cat') for (const c of cat) console.log(c.ref, '|', c.label);
