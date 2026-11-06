// Banc des raccourcis du Tableur, suite : saisie de formule (Ctrl+A, Ctrl+Maj+A), Rechercher suivant, insertion/suppression de cellules, annuler/retablir,
// Format de cellule onglet Police, Atteindre, note/commentaire, somme automatique. Variables : FO_PORT, FO_CDP_PORT, FO_SHOTS.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bar, cellEditor, focusGrid, goto, key, launch, nameBox, sleep, typeCell } from './excel-keys-lib.mjs';

const PORT = process.env.FO_PORT ?? '5422';
const SHOTS = process.env.FO_SHOTS ?? 'shots-keys';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` : ${detail}` : ''}`); };
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9682) });
const shot = (n) => b.shot(join(SHOTS, `${n}.png`));
const hasText = (t) => b.ev(`document.body.innerText.includes(${JSON.stringify(t)})`);
const dialogTitle = () => b.ev(`document.querySelector('[role=dialog] h2, [role=dialog] [class*=title]')?.textContent.trim() ?? null`);

try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${PORT}/?app=excel`);

  // ---- Ctrl+Maj+F : Format de cellule, onglet Police
  await goto(b, 'A1'); await key(b, 'F', { ctrl: true, shift: true }); await sleep(400);
  const title = await dialogTitle();
  const policeTab = await b.ev(`[...document.querySelectorAll('[role=dialog] [role=tab][aria-selected=true], [role=dialog] .is-active')].map((e) => e.textContent.trim()).join('|')`);
  check('K5.3-05 Ctrl+Maj+F : Format de cellule, onglet Police', /Format de cellule/.test(String(title)) && /Police/.test(policeTab), `${title} / ${policeTab}`);
  await shot('ctrl-maj-f-police');
  await key(b, 'Escape'); await focusGrid(b);

  // ---- F5 : Atteindre ; Maj+F2 : note ; Ctrl+Maj+F2 : commentaire
  await key(b, 'F5'); await sleep(300);
  check('K5.1-25 F5 : boite Atteindre', await hasText('Atteindre'));
  await key(b, 'Escape'); await focusGrid(b);
  await key(b, 'F2', { shift: true }); await sleep(300);
  check('K5.3-29 Maj+F2 : boite de note', await hasText('Note') || (await dialogTitle()) !== null, String(await dialogTitle()));
  await key(b, 'Escape'); await focusGrid(b);
  await key(b, 'F2', { ctrl: true, shift: true }); await sleep(300);
  check('K5.3-30 Ctrl+Maj+F2 : nouveau commentaire', /ommentaire/.test(String(await dialogTitle())), String(await dialogTitle()));
  await key(b, 'Escape'); await focusGrid(b);

  // ---- Ctrl+A et Ctrl+Maj+A dans une formule
  await goto(b, 'Z1'); await b.press('=SOMME('); await key(b, 'a', { ctrl: true }); await sleep(400);
  check('K5.2-23 Ctrl+A dans SOMME( : boite Arguments de la fonction', /Insérer une fonction|Arguments|SOMME/.test(String(await dialogTitle())) || await hasText('Insérer une fonction'), String(await dialogTitle()));
  await shot('ctrl-a-arguments');
  await key(b, 'Escape'); await key(b, 'Escape'); await focusGrid(b);
  await goto(b, 'Z2'); await b.press('=SOMME'); await key(b, 'A', { ctrl: true, shift: true });
  check('K5.2-24 Ctrl+Maj+A : noms des arguments inseres', (await cellEditor(b)) === '=SOMME(nombre1;nombre2;...)', await cellEditor(b));
  await key(b, 'Escape'); await focusGrid(b);

  // ---- Somme automatique Alt+=
  await goto(b, 'A1'); for (const t of ['1', '2', '3']) await typeCell(b, t);
  await key(b, '=', { alt: true });
  await goto(b, 'A4');
  check('K5.2-28 Alt+= : somme automatique en A4', (await bar(b)) === '=SOMME(A1:A3)', await bar(b));

  // ---- Annuler / Retablir
  await goto(b, 'C1'); await typeCell(b, 'x'); await goto(b, 'C1');
  await key(b, 'z', { ctrl: true });
  check('K5.2-12 Ctrl+Z : C1 vide', (await bar(b)) === '', await bar(b));
  await key(b, 'Z', { ctrl: true, shift: true });
  check('K5.2-14 Ctrl+Maj+Z : C1 retablie', (await bar(b)) === 'x', await bar(b));

  // ---- Inserer / supprimer des cellules (decalage), Ctrl+Maj++ et Ctrl+-
  await goto(b, 'C2'); await typeCell(b, 'y'); await goto(b, 'C2');
  await key(b, '+', { ctrl: true, shift: true });
  await goto(b, 'C3');
  check('K5.3-17 Ctrl+Maj++ : insertion de cellule, y descend en C3', (await bar(b)) === 'y', await bar(b));
  await goto(b, 'C2'); await key(b, '-', { ctrl: true });
  await goto(b, 'C2');
  check('K5.3-18 Ctrl+- : suppression de cellule, y remonte en C2', (await bar(b)) === 'y', await bar(b));

  // ---- Rechercher suivant
  await goto(b, 'E1'); for (const t of ['chat', 'chien', 'chat noir']) await typeCell(b, t);
  await goto(b, 'E1'); await key(b, 'f', { ctrl: true }); await sleep(300);
  await b.press('chat');
  await b.click('text=Suivant'); await sleep(300);
  await key(b, 'Escape'); await focusGrid(b);
  const first = await nameBox(b);
  await key(b, 'F4', { shift: true });
  const second = await nameBox(b);
  await key(b, 'F4', { shift: true });
  const third = await nameBox(b);
  check('K5.1-27 Maj+F4 : suivant, puis retour au debut', first === 'E3' && second === 'E1' && third === 'E3', `${first} ${second} ${third}`);
  await key(b, 'F4', { ctrl: true, shift: true });
  check('K5.1-27 Ctrl+Maj+F4 : precedent', (await nameBox(b)) === 'E1', await nameBox(b));

  // ---- Alt+Bas sur un en-tete de filtre : menu de filtre
  await goto(b, 'G1'); for (const t of ['Nom']) await typeCell(b, t);
  await goto(b, 'G2'); for (const t of ['b', 'a', 'b']) await typeCell(b, t);
  await goto(b, 'G1:G4'); await key(b, 'L', { ctrl: true, shift: true }); await sleep(300);
  await goto(b, 'G1'); await key(b, 'ArrowDown', { alt: true }); await sleep(400);
  check('K5.2-21 Alt+Bas sur un en-tete filtre : menu de filtre', await hasText('Trier de A à Z') || await hasText('Trier'), '');
  await shot('alt-bas-filtre');
  await key(b, 'Escape'); await focusGrid(b);
  check('aucune erreur console', b.consoleLog.filter((l) => !/favicon|ResizeObserver|\[vite\]/.test(l)).length === 0, b.consoleLog.slice(0, 3).join(' | '));
} finally {
  await b.close();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} verifications reussies`);
process.exit(bad.length ? 1 : 0);
