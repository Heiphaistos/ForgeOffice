// Genere docs/conformite/lo-sans-equivalent.md : pour chaque application et chaque suite imitee, les entrees de menu que ForgeOffice ne sait pas executer
// (restent grisees, info-bulle « Pas d'équivalent dans ForgeOffice »). Usage : node scripts/lo-extract/_doc.mjs > docs/conformite/lo-sans-equivalent.md
import { readFileSync } from 'node:fs';
import { makeBinder } from '../../packages/ui/src/logic/suite/bind.ts';
import { LIBREOFFICE_DATA } from '../../packages/ui/src/logic/suite/libreoffice.generated.ts';
import { OPENOFFICE_DATA } from '../../packages/ui/src/logic/suite/openoffice.generated.ts';
const docs = new URL('../../docs/conformite/', import.meta.url);
const hostSrc = readFileSync(new URL('../../packages/ui/src/components/layouts/SuiteLayout.tsx', import.meta.url), 'utf8');
const host = Object.fromEntries([...hostSrc.slice(hostSrc.indexOf('const cmds'), hostSrc.indexOf('if (!onFile)')).matchAll(/([A-Z][A-Za-z]+):/g)].map((m) => [m[1], () => {}]));
const NAMES = { word: 'Writer', excel: 'Calc', powerpoint: 'Impress', publisher: 'Draw' };
console.log('# Commandes de LibreOffice / OpenOffice sans équivalent dans ForgeOffice\n\nGénéré par `scripts/lo-extract/_doc.mjs`. Ces entrées de menu existent dans la vraie suite, sont reproduites à l\'identique (libellé, place, raccourci) et restent **grisées** avec l\'info-bulle « Pas d\'équivalent dans ForgeOffice » : le moteur de ForgeOffice n\'a pas la fonction (formulaires et contrôles, macros et Basic, objets OLE, filtres d\'image, Fontwork, saisie japonaise/chinoise, signatures numériques, envoi par courriel, versions, bases de données...). Toute entrée dont le moteur a un équivalent est branchée.\n');
for (const [kind, suite] of [['LibreOffice', LIBREOFFICE_DATA], ['OpenOffice', OPENOFFICE_DATA]]) {
  for (const app of Object.keys(NAMES)) {
    const cat = JSON.parse(readFileSync(new URL(app + '.json', docs), 'utf8')).commandes.filter((c) => !c.type.endsWith('-option') && !c.type.endsWith('-pick')).map((c) => ({ ref: c.id, label: c.label, run: () => {} }));
    const binder = makeBinder(cat, host);
    const leaves = (items, top, out) => { for (const i of items) { if (i.i) leaves(i.i, top, out); else if (!i.sep && i.l) out.push([top, i]); } };
    const all = []; for (const m of suite[app].menu) leaves(m.i ?? [], m.l, all);
    const un = all.filter(([, i]) => !binder.find(i.u ?? '', i.l));
    const by = new Map(); for (const [t, i] of un) by.set(t, [...(by.get(t) ?? []), i.l.replace(/%PRODUCTNAME/, kind)]);
    console.log(`## ${kind} ${NAMES[app]} : ${all.length - un.length} / ${all.length} entrées branchées (${Math.round((100 * (all.length - un.length)) / all.length)} %)\n`);
    for (const [t, l] of by) console.log(`- **${t}** (${l.length}) : ${l.join(' ; ')}`);
    console.log('');
  }
}
