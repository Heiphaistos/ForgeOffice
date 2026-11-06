// Banc des raccourcis clavier du Tableur (lot E) : vraies touches par CDP (Alt, Ctrl, Maj), resultat lu dans l'interface puis dans le
// classeur enregistre (Ctrl+S -> xlsx capte, ouvert avec jszip). Variables : FO_PORT (Vite, 5422), FO_CDP_PORT (9682), FO_SHOTS (dossier des captures).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { bar, cellEditor, focusGrid, goto, key, launch, nameBox, sleep, typeCell } from './excel-keys-lib.mjs';

const PORT = process.env.FO_PORT ?? '5422';
const SHOTS = process.env.FO_SHOTS ?? 'shots-keys';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` : ${detail}` : ''}`); };
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9682) });
const shot = (n) => b.shot(join(SHOTS, `${n}.png`));
const statusText = () => b.ev(`[...document.querySelectorAll('*')].find((e) => e.children.length === 0 && ['Prêt', 'Entrer', 'Modifier', 'Pointer', 'Étendre la sélection', 'Ajouter à la sélection'].includes(e.textContent.trim()))?.textContent.trim() ?? null`);
const tabNames = () => b.ev(`[...document.querySelectorAll('.xl-tab')].map((e) => e.textContent.trim())`);
const activeRibbonTab = () => b.ev(`document.querySelector('.fo-ribbon [role=tab][aria-selected=true]')?.textContent.trim() ?? null`);
const menuTexts = () => b.ev(`[...document.querySelectorAll('[role=menuitem]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim())`);

try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${PORT}/?app=excel`);

  // ---- Jeu de donnees
  await goto(b, 'A1'); for (const t of ['1', '2', '3']) await typeCell(b, t);
  await goto(b, 'B1'); await typeCell(b, '=SOMME(A1:A3)');
  await goto(b, 'D1'); for (const t of ['Pomme', 'Poire', 'Pomme']) await typeCell(b, t);
  await goto(b, 'G1'); for (const t of ['Mois', 'Ventes', 'Cout']) { await b.press(t); await key(b, 'Tab'); }
  await goto(b, 'G2'); for (const t of ['Jan', '10', '4']) { await b.press(t); await key(b, 'Tab'); }
  await goto(b, 'G3'); for (const t of ['Fev', '20', '5']) { await b.press(t); await key(b, 'Tab'); }
  await goto(b, 'B1');
  check('donnees saisies', (await bar(b)) === '=SOMME(A1:A3)', await bar(b));

  // ---- Ctrl+9 / Ctrl+Maj+( : lignes
  await goto(b, 'A2'); await key(b, '9', { ctrl: true });
  await goto(b, 'A1'); await key(b, 'ArrowDown');
  check('K5.3-19 Ctrl+9 masque la ligne 2 (Bas depuis A1 -> A3)', (await nameBox(b)) === 'A3', await nameBox(b));
  await shot('ctrl9-ligne-masquee');
  await goto(b, 'A1'); await key(b, 'ArrowDown', { shift: true }); await key(b, 'ArrowDown', { shift: true });
  await key(b, '(', { ctrl: true, shift: true, code: 'Digit9' });
  await goto(b, 'A1'); await key(b, 'ArrowDown');
  check('K5.3-20 Ctrl+Maj+( reaffiche la ligne 2', (await nameBox(b)) === 'A2', await nameBox(b));

  // ---- Ctrl+0 / Ctrl+Maj+) : colonnes
  await goto(b, 'B1'); await key(b, '0', { ctrl: true });
  await goto(b, 'A1'); await key(b, 'ArrowRight');
  check('K5.3-19 Ctrl+0 masque la colonne B (Droite depuis A1 -> C1)', (await nameBox(b)) === 'C1', await nameBox(b));
  await goto(b, 'A1'); await key(b, 'ArrowRight', { shift: true }); await key(b, 'ArrowRight', { shift: true });
  await key(b, ')', { ctrl: true, shift: true, code: 'Digit0' });
  await goto(b, 'A1'); await key(b, 'ArrowRight');
  check('K5.3-20 Ctrl+Maj+) reaffiche la colonne B', (await nameBox(b)) === 'B1', await nameBox(b));

  // ---- Formats de nombre
  await goto(b, 'A1'); await key(b, '%', { ctrl: true, shift: true });
  check('K5.3-10 Ctrl+Maj+% : la cellule affiche 100 %', (await bar(b)) === '100 %', await bar(b));
  await key(b, '~', { ctrl: true, shift: true });
  check('K5.3-08 Ctrl+Maj+~ : retour au format Standard', (await bar(b)) === '1', await bar(b));
  await key(b, '%', { ctrl: true, shift: true });
  await goto(b, 'A2'); await key(b, '#', { ctrl: true, shift: true });
  await goto(b, 'A3'); await key(b, '^', { ctrl: true, shift: true });
  await goto(b, 'H2'); await key(b, '$', { ctrl: true, shift: true });
  await goto(b, 'H3'); await key(b, '!', { ctrl: true, shift: true });
  await goto(b, 'I2'); await key(b, '@', { ctrl: true, shift: true });

  // ---- Gras puis F4 (repeter)
  await goto(b, 'G1'); await key(b, 'g', { ctrl: true });
  await goto(b, 'G2'); await key(b, 'F4');
  await goto(b, 'G3'); await key(b, 'y', { ctrl: true });
  await shot('f4-repeter-gras');

  // ---- Ctrl+' : copie de la formule du dessus
  await goto(b, 'B2'); await key(b, "'", { ctrl: true });
  check("K5.2-17 Ctrl+' : saisie de la formule de B1 dans B2", (await cellEditor(b)) === '=SOMME(A1:A3)', await cellEditor(b));
  await key(b, 'Escape');

  // ---- Alt+Bas : liste de la colonne
  await goto(b, 'D4'); await key(b, 'ArrowDown', { alt: true });
  const items = await menuTexts();
  check('K5.2-20 Alt+Bas : liste distincte et triee de la colonne D', JSON.stringify(items) === JSON.stringify(['Poire', 'Pomme']), JSON.stringify(items));
  await shot('alt-bas-liste');
  await key(b, 'ArrowDown'); await key(b, 'Enter');
  await goto(b, 'D4');
  check('K5.2-20 choisir dans la liste ecrit la valeur en D4', (await bar(b)) === 'Poire', await bar(b));

  // ---- Ctrl+Maj+Entree : formule matricielle sur K1:K3
  await goto(b, 'K1:K3'); await b.press('=A1:A3*2'); await key(b, 'Enter', { ctrl: true, shift: true });
  await goto(b, 'K2');
  check('K5.2-06 Ctrl+Maj+Entree : la formule matricielle est entree (barre de formule de K2)', (await bar(b)) !== null, await bar(b));
  await shot('matricielle');

  // ---- F8 / Maj+F8
  await goto(b, 'M1'); for (const t of ['1', '2', '3']) await typeCell(b, t);
  await goto(b, 'M1'); await key(b, 'F8');
  check("K5.1-24 F8 : mode Etendre la selection dans la barre d'etat", (await statusText()) === 'Étendre la sélection', await statusText());
  await key(b, 'ArrowDown'); await key(b, 'ArrowDown');
  const sum = await b.ev("document.body.innerText.includes('Somme : 6')");
  check('K5.1-24 F8 + Bas x2 : la plage M1:M3 est selectionnee (Somme : 6, 3L x 1C)', sum === true, String(sum));
  await shot('f8-etendre');
  await key(b, 'Escape');
  check('F8 : Echap quitte le mode', (await statusText()) === 'Prêt', await statusText());
  await goto(b, 'O1'); await key(b, 'F8', { shift: true });
  check('K5.1-24 Maj+F8 : mode Ajouter a la selection', (await statusText()) === 'Ajouter à la sélection', await statusText());
  await key(b, 'Escape');

  // ---- Ctrl+Point, Maj+Retour arriere, Ctrl+Retour arriere
  await goto(b, 'M1:M3'); await key(b, '.', { ctrl: true });
  check('K5.1-23 Ctrl+. : la cellule active passe en M3', (await nameBox(b)) === 'M3', await nameBox(b));
  await key(b, 'Backspace', { shift: true });
  check('K5.1-22 Maj+Retour arriere : selection reduite a une cellule', /^M\d$/.test(await nameBox(b)), await nameBox(b));
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 600, y: 400, deltaX: 0, deltaY: 3000 }); await sleep(300);
  await shot('avant-ctrl-retour');
  await key(b, 'Backspace', { ctrl: true });
  await shot('apres-ctrl-retour');

  // ---- Maj+F10 : menu contextuel
  await goto(b, 'C3'); await key(b, 'F10', { shift: true });
  const ctx = await menuTexts();
  check('K5.3-31 Maj+F10 : menu contextuel de la cellule', ctx.length > 5 && ctx.some((t) => /Copier/.test(t)), ctx.slice(0, 4).join(' / '));
  await shot('maj-f10-menu');
  await key(b, 'Escape');
  check('K5.3-31 Echap ferme le menu ouvert au clavier', (await menuTexts()).length === 0, String((await menuTexts()).length));
  await focusGrid(b);

  // ---- Alt+Maj+Droite : grouper les lignes 5 a 6
  await goto(b, 'A5'); await key(b, 'ArrowDown', { shift: true }); await key(b, 'ArrowRight', { alt: true, shift: true });

  // ---- Ctrl+Maj+F3 : noms depuis la selection
  await goto(b, 'G1:I3'); await key(b, 'F3', { ctrl: true, shift: true });
  await sleep(300); await shot('ctrl-maj-f3-dialogue');
  check('K5.2-27 Ctrl+Maj+F3 : boite Creer des noms', await b.ev(`document.body.innerText.includes('Créer des noms à partir de la sélection')`));
  await b.click('text=OK');
  await sleep(300);

  // ---- F3 : coller un nom
  await goto(b, 'P1'); await b.press('='); await key(b, 'F3'); await sleep(300);
  await shot('f3-coller-un-nom');
  const hasList = await b.ev(`document.body.innerText.includes('Ventes')`);
  check('K5.2-25 F3 : liste des noms (Ventes cree par Ctrl+Maj+F3)', hasList);
  await b.click('text=Ventes'); await sleep(300);
  check('K5.2-25 F3 : le nom est insere dans la formule', (await cellEditor(b)) === '=Ventes', await cellEditor(b));
  await key(b, 'Escape'); await focusGrid(b);

  // ---- Ctrl+Maj+T : ligne Total
  await goto(b, 'G1:I3'); await key(b, 'l', { ctrl: true }); await sleep(300);
  await key(b, 'T', { ctrl: true, shift: true }); await sleep(300);
  await shot('ctrl-maj-t-total');

  // ---- F6 : zones
  await focusGrid(b);
  const zone = () => b.ev(`(() => { const a = document.activeElement; return a?.closest('.xl-tabs') ? 'onglets' : a?.closest('.fo-ribbon') ? 'ruban' : a?.closest('.xl-grid') ? 'grille' : 'autre'; })()`);
  const seq = [];
  for (let i = 0; i < 3; i++) { await key(b, 'F6'); seq.push(await zone()); }
  check('K5.1-29 F6 : grille -> onglets -> ruban -> grille', JSON.stringify(seq) === JSON.stringify(['onglets', 'ruban', 'grille']), JSON.stringify(seq));

  // ---- Ctrl+Maj+U : barre de formule developpee
  await focusGrid(b); await key(b, 'u', { ctrl: true, shift: true });
  check('K5.4-18 Ctrl+Maj+U : barre de formule developpee', await b.ev(`Boolean(document.querySelector('.xl-fbar.is-expanded'))`));
  await shot('ctrl-maj-u'); await key(b, 'u', { ctrl: true, shift: true });

  // ---- F11 : feuille de graphique
  await goto(b, 'G1:I3'); await key(b, 'F11'); await sleep(500);
  const tabs = await tabNames();
  check('K5.2-38 F11 : feuille Graph1 creee', tabs.includes('Graph1'), tabs.join(','));
  await shot('f11-graph1');
  await goto(b, 'A1'); await focusGrid(b);

  // ---- Info-touches
  await goto(b, 'A1');
  await key(b, 'Alt', { alt: true }); await sleep(300);
  await shot('infotouches-onglets');
  await key(b, 's'); await sleep(300);
  check('X-05 Alt puis S : onglet Insertion', (await activeRibbonTab()) === 'Insertion', await activeRibbonTab());
  await shot('infotouches-insertion');
  await key(b, 'Escape'); await key(b, 'Escape');
  await focusGrid(b);
  await key(b, 'Alt', { alt: true }); await key(b, 'é', { text: 'é' }); await sleep(300);
  check('X-05 Alt puis E accent aigu : onglet Donnees', (await activeRibbonTab()) === 'Données', await activeRibbonTab());
  await key(b, 'Escape'); await key(b, 'Escape'); await focusGrid(b);
  await key(b, 'Alt', { alt: true }); await key(b, 'n'); await sleep(300);
  check('X-05 Alt puis N : onglet Affichage', (await activeRibbonTab()) === 'Affichage', await activeRibbonTab());
  await shot('infotouches-affichage');
  await key(b, 'Escape'); await key(b, 'Escape'); await focusGrid(b);

  // ---- Enregistrement et lecture du classeur
  await goto(b, 'A1'); await key(b, 's', { ctrl: true }); await sleep(1500);
  let dl = await b.downloads();
  if (!dl.length) { await sleep(1500); dl = await b.downloads(); }
  check('Ctrl+S : classeur telecharge', dl.length > 0);
  if (dl.length) {
    const file = dl[0];
    writeFileSync(join(SHOTS, 'classeur.xlsx'), file.bytes);
    const zip = await JSZip.loadAsync(file.bytes);
    const read = (p) => zip.file(p)?.async('string') ?? Promise.resolve('');
    const sheet1 = await read('xl/worksheets/sheet1.xml');
    const styles = await read('xl/styles.xml');
    const wbxml = await read('xl/workbook.xml');
    const rowTag = (r) => (sheet1.match(new RegExp(`<row r="${r}"[^>]*>`)) ?? [''])[0];
    check('modele : ligne 2 non masquee apres Ctrl+Maj+(', !/hidden="1"/.test(rowTag(2)), rowTag(2));
    check('modele : lignes 5-6 groupees (Alt+Maj+Droite)', /outlineLevel="1"/.test(rowTag(5)) || /outlineLevel="1"/.test(rowTag(6)), `${rowTag(5)} ${rowTag(6)}`);
    check('modele : formule matricielle K1:K3', /t="array"[^>]*ref="K1:K3"|ref="K1:K3"[^>]*t="array"/.test(sheet1), (sheet1.match(/<f[^>]*array[^>]*>/) ?? ['aucune'])[0]);
    const codes = [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((m) => m[2]);
    for (const [name, code] of [['Ctrl+Maj+#', 'dd-mmm-yy'], ['Ctrl+Maj+$', '#,##0.00 [$€-40C]'], ['Ctrl+Maj+@', 'hh:mm']]) {
      check(`modele : format ${name} = ${code}`, codes.includes(code), codes.join(' ; '));
    }
    const builtin = new Set([...styles.matchAll(/<xf numFmtId="(\d+)"/g)].map((m) => m[1]));
    check('modele : formats integres Ctrl+Maj+^ (11 = 0,00E+00), Ctrl+Maj+! (4 = #,##0.00), Ctrl+Maj+% (9 = 0 %)', ['11', '4', '9'].every((i) => builtin.has(i)), [...builtin].join(','));
    check('modele : noms crees (Ventes, Cout, Jan, Fev)', ['Ventes', 'Cout', 'Jan', 'Fev'].every((n) => wbxml.includes(`name="${n}"`)), (wbxml.match(/<definedName[^>]*>/g) ?? []).join(' '));
    const tablesList = Object.keys(zip.files).filter((f) => f.startsWith('xl/tables/'));
    const table = tablesList.length ? await read(tablesList[0]) : '';
    check('modele : tableau avec ligne Total (Ctrl+Maj+T)', /totalsRowCount="1"|totalsRowShown="1"/.test(table), (table.match(/<table [^>]*>/) ?? ['aucun tableau'])[0].slice(0, 200));
    check('modele : feuille Graph1 enregistree', wbxml.includes('name="Graph1"'));
  }
  check('aucune erreur console', b.consoleLog.filter((l) => !/favicon|ResizeObserver|\[vite\]/.test(l)).length === 0, b.consoleLog.slice(0, 3).join(' | '));
} finally {
  await b.close();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} verifications reussies`);
process.exit(bad.length ? 1 : 0);
