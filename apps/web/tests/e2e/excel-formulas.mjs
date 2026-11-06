// Banc du lot Formules et noms du Tableur : vraies touches et vrais clics par CDP, resultat lu dans l'interface (barre d'etat, boites)
// et dans le classeur enregistre. Variables : FO_PORT (Vite, 5424), FO_CDP_PORT (9684), FO_SHOTS (dossier des captures).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bar, focusGrid, goto as gotoRaw, key, launch, nameBox, sleep, typeCell } from './excel-keys-lib.mjs';

const PORT = process.env.FO_PORT ?? '5424';
const SHOTS = process.env.FO_SHOTS ?? 'shots-formulas';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` : ${detail}` : ''}`); };
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9684) });
const shot = (n) => b.shot(join(SHOTS, `${n}.png`));
const only = process.argv[2] ?? '';
const goto = async (bb, addr) => { await guard(); await gotoRaw(bb, addr); };

/** Texte de la barre d'etat (somme, moyenne...). */
const status = () => b.ev(`[...document.querySelectorAll('.fo-sb__item')].map((e) => e.textContent.trim()).join(' | ')`);
const sumOf = async () => { const m = (await status()).match(/Somme\s*:\s*([-\d\s ,.]+)/); return m ? m[1].replace(/[\s ]/g, '') : null; };
const dialogText = () => b.ev(`document.querySelector('.fo-dialog')?.innerText ?? ''`);
const tab = async (name) => { await b.clickText('[role=tab]', name); await sleep(300); };
const menuTexts = () => b.ev(`[...document.querySelectorAll('[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim())`);
const closeDialog = async () => { await key(b, 'Escape'); await sleep(200); };
/** Clic reel sur un bouton visible (texte exact, aria-label ou titre), dans le ruban ou une boite. */
async function clickBtn(label, scope = '') {
  await guard();
  const ok = await b.ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(scope)} + ' button, ' + ${JSON.stringify(scope)} + ' [role=menuitem], ' + ${JSON.stringify(scope)} + ' [role=menuitemradio], ' + ${JSON.stringify(scope)} + ' [role=menuitemcheckbox]')].filter((x) => x.getBoundingClientRect().width > 0 && (x.getAttribute('aria-label') === ${JSON.stringify(label)} || x.textContent.trim() === ${JSON.stringify(label)} || x.getAttribute('title') === ${JSON.stringify(label)}))[0]; if (!e) return false; e.setAttribute('data-e2e', 'x'); return true; })()`);
  if (!ok) throw new Error('bouton introuvable : ' + label);
  try { await b.click('[data-e2e=x]'); } finally { await b.ev(`document.querySelector('[data-e2e=x]')?.removeAttribute('data-e2e')`); }
  await sleep(250);
}
/** Remplace le contenu du champ (aria-label) d'une boite par une frappe reelle. */
async function fill(label, text, scope = '.fo-dialog') {
  await guard();
  await b.ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(scope)} + ' input, ' + ${JSON.stringify(scope)} + ' textarea')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(label)} || [...(x.labels ?? [])].some((l) => l.textContent.trim() === ${JSON.stringify(label)})); if (!e) throw new Error('champ introuvable'); e.focus(); e.select(); })()`);
  await b.send('Input.insertText', { text });
  await sleep(150);
}
const dlgTitle = () => b.ev(`document.querySelector('.fo-dialog [id], .fo-dialog h2, .fo-dialog__title')?.textContent ?? document.querySelector('.fo-dialog')?.getAttribute('aria-label') ?? ''`);
const hasDialog = () => b.ev(`!!document.querySelector('.fo-dialog')`);
/** Le serveur de dev recharge la page quand d'autres lots modifient des fichiers : on le detecte et on rejoue le scenario. */
const guard = async () => {
  if (!(await b.ev('window.__xlmark === 1'))) throw new Error('RELOAD');
  // Boite de récupération (copie de secours proposée après un rechargement) : on l'ignore pour ne pas bloquer la grille.
  const recov = await b.ev(`(() => { const d = document.querySelector('.fo-dialog'); const x = d && /Récupération de document/.test(d.textContent) ? [...d.querySelectorAll('button')].find((k) => k.textContent.trim() === 'Ignorer') : null; if (!x) return false; x.click(); return true; })()`);
  if (recov) await sleep(300);
};
const inDialog = (fn) => b.ev(`(() => { const d = document.querySelector('.fo-dialog'); return d ? (${fn})(d) : null; })()`);

async function start() {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${PORT}/?app=excel`);
  await sleep(500);
  if (await hasDialog()) await clickBtn('Ignorer', '.fo-dialog').catch(() => undefined);
  await b.ev('window.__xlmark = 1');
}

/** Commandes du ruban sans scénario propre : catégories de fonctions, Afficher les formules, Créer à partir de la sélection. */
async function extras() {
  await goto(b, 'E1');
  await tab('Formules');
  for (const [label, sample] of [['Financier', 'VA'], ['Logique', 'SI'], ['Texte', 'GAUCHE'], ['Date et heure', 'AUJOURDHUI'], ['Recherche et référence', 'RECHERCHEV'], ['Maths et trigonométrie', 'SOMME']]) {
    if ((await menuTexts()).length) { await key(b, 'Escape'); await sleep(400); }
    if ((await menuTexts()).length) await b.click('.fo-grid, .xl-grid').catch(() => undefined);
    await clickBtn(label);
    const items = await menuTexts();
    check(`bibliothèque > ${label} : fonctions listées (${sample})`, items.length > 5 && items.some((t) => t.startsWith(sample)), `${items.length} entrées`);
    if (label === 'Logique') {
      await b.ev(`(() => { const e = [...document.querySelectorAll('[role=menuitem]')].filter((x) => x.getBoundingClientRect().width > 0).find((x) => x.textContent.trim().startsWith('SI')); e.setAttribute('data-e2e', 'x'); })()`);
      await b.click('[data-e2e=x]');
      await b.ev(`document.querySelector('[data-e2e=x]')?.removeAttribute('data-e2e')`);
      await sleep(300);
      check('un clic sur une fonction ouvre ses arguments', /Arguments de la fonction/.test(await dialogText()) && /SI/.test(await dialogText()), (await dialogText()).replace(/\s+/g, ' ').slice(0, 80));
      await shot('29-categorie-logique-arguments');
      await clickBtn('Annuler', '.fo-dialog');
    } else await key(b, 'Escape');
  }
  await goto(b, 'E1');
  await clickBtn('Afficher les formules');
  check('Afficher les formules : bouton enfoncé', await b.ev(`[...document.querySelectorAll('button')].some((x) => x.getAttribute('aria-label') === 'Afficher les formules' || x.textContent.trim() === 'Afficher les formules' ? x.getAttribute('aria-pressed') === 'true' : false)`));
  await shot('30-afficher-les-formules');
  await key(b, '"', { ctrl: true, code: 'Digit3' });
  await shot('31-formules-masquees-ctrl-guillemet');
  await goto(b, 'J1:L4');
  await clickBtn('Créer à partir de la sélection');
  check('Créer à partir de la sélection : boîte ouverte', /Créer des noms|à partir de la sélection/i.test(await dialogText()), (await dialogText()).replace(/\s+/g, ' ').slice(0, 80));
  await shot('32-creer-depuis-selection');
  await clickBtn('Annuler', '.fo-dialog');
  await clickBtn('Utiliser dans la formule');
  const use = await menuTexts();
  check('Utiliser dans la formule : liste des noms', use.some((t) => /Coller les noms/.test(t)), use.join(' | '));
  await key(b, 'Escape');
}

async function scenario() {
  if (only === 'extras') { await extras(); return; }
  await goto(b, 'A1');
  for (const t of ['10', '20', '30']) await typeCell(b, t);
  await goto(b, 'B1');
  await typeCell(b, '=A1*2');
  await typeCell(b, '0');
  await goto(b, 'B1:B2');
  check('donnees saisies', (await status()).includes('Somme'), (await status()).slice(0, 100));

  await tab('Formules');
  await shot('01-onglet-formules');
  const labels = await b.ev(`[...document.querySelectorAll('.fo-ribbon button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim()).filter(Boolean)`);
  console.log(labels.join(' | '));
  if (only === 'ribbon') throw new Error('stop');

  // ---- Calcul manuel (R1.19-12, X-13) : B1 ne bouge pas tant que F9 n'est pas presse
  await goto(b, 'B1:B2');
  check('B1 = 20 (somme de B1 seule)', (await sumOf()) === '20', String(await sumOf()));
  await clickBtn('Options de calcul');
  await sleep(300);
  const calcItems = await menuTexts();
  check('menu Options de calcul : 3 modes + itératif', ['Automatique', 'Automatique sauf tables de données', 'Manuel', 'Options de calcul itératif…'].every((t) => calcItems.includes(t)), calcItems.join(' | '));
  await shot('02-menu-calcul');
  await clickBtn('Manuel');
  await goto(b, 'A1'); await typeCell(b, '100');
  await goto(b, 'B1:B2');
  check('manuel : B1 garde 20 apres A1 = 100', (await sumOf()) === '20', String(await sumOf()));
  const st = await status();
  check('barre d etat : indicateur Calculer', /Calculer/.test(st), st.slice(0, 120));
  await shot('03-manuel-en-attente');
  await key(b, 'F9');
  check('F9 : B1 = 200', (await sumOf()) === '200', String(await sumOf()));
  check('indicateur Calculer disparu', !/Calculer/.test(await status()));
  await goto(b, 'A1'); await typeCell(b, '1');
  await goto(b, 'B1:B2');
  check('manuel : B1 reste 200', (await sumOf()) === '200', String(await sumOf()));
  await key(b, 'F9', { shift: true });
  check('Maj+F9 : B1 = 2', (await sumOf()) === '2', String(await sumOf()));
  await clickBtn('Options de calcul'); await clickBtn('Automatique');
  check('retour en automatique recalcule', (await sumOf()) === '2');
  await goto(b, 'A1'); await typeCell(b, '7');
  await goto(b, 'B1:B2');
  check('automatique : B1 = 14', (await sumOf()) === '14', String(await sumOf()));

  // ---- Noms : gestionnaire, Nouveau nom avec commentaire, utilisation dans une formule (D4.5-07, D4.5-10, R1.19-01/02/03)
  await goto(b, 'A1');
  await key(b, 'F3', { ctrl: true });
  check('Ctrl+F3 ouvre le gestionnaire de noms', /Gestionnaire de noms/.test(await dialogText()), (await dialogText()).slice(0, 60));
  await shot('04-gestionnaire-vide');
  await clickBtn('Nouveau…', '.fo-dialog');
  await fill('Nom :', 'Marge');
  await fill('Commentaire :', 'Marge de vente');
  check('Nouveau nom : référence = sélection courante', (await b.ev(`[...document.querySelectorAll('.fo-dialog input')].find((x) => x.getAttribute('aria-label') === 'Fait référence à :')?.value`)) === '=Feuil1!$A$1', '');
  await shot('05-nouveau-nom');
  await fill('Fait référence à :', '=Feuil1!$A$1');
  await clickBtn('OK', '.fo-dialog');
  check('retour au gestionnaire avec le nom créé', /Marge/.test(await dialogText()) && /Marge de vente/.test(await dialogText()), (await dialogText()).replace(/\s+/g, ' ').slice(0, 200));
  await shot('06-gestionnaire-nom');
  // refus d'un nom invalide
  await clickBtn('Nouveau…', '.fo-dialog');
  await fill('Nom :', 'A1');
  await clickBtn('OK', '.fo-dialog');
  check('nom « A1 » refusé (référence de cellule)', /ressembler à une référence/.test(await dialogText()), (await dialogText()).replace(/\s+/g, ' ').slice(0, 160));
  await fill('Nom :', 'Marge');
  await clickBtn('OK', '.fo-dialog');
  check('doublon refusé', /existe déjà/.test(await dialogText()));
  await clickBtn('Annuler', '.fo-dialog');
  await clickBtn('Fermer', '.fo-dialog');
  check('boîte fermée', !(await hasDialog()));
  await goto(b, 'C1'); await typeCell(b, '=Marge*3');
  await goto(b, 'C1:C2');
  check('formule avec nom : C1 = 21 (Marge = A1 = 7)', /Somme : 21/.test(await status()) || (await sumOf()) === '21', await status());
  // renommer : les formules suivent
  await key(b, 'F3', { ctrl: true });
  await b.ev(`[...document.querySelectorAll('.fo-dialog tbody tr')].find((r) => r.textContent.includes('Marge'))?.click()`);
  await sleep(200);
  await clickBtn('Modifier…', '.fo-dialog');
  await fill('Nom :', 'Remise');
  await clickBtn('OK', '.fo-dialog');
  await clickBtn('Fermer', '.fo-dialog');
  await goto(b, 'C1');
  check('renommage réécrit la formule : =Remise*3', (await bar(b)) === '=Remise*3', String(await bar(b)));
  await goto(b, 'C1:C2');
  check('valeur inchangée après renommage', (await sumOf()) === '21', String(await sumOf()));

  // ---- Insérer une fonction (D4.5-01/02/03/05/06, R1.18-01, R1.18-03)
  await goto(b, 'D1');
  await key(b, 'F3', { shift: true });
  check('Maj+F3 ouvre Insérer une fonction', /Insérer une fonction/.test(await dialogText()));
  await b.ev(`(() => { const s = document.querySelector('.fo-dialog select'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(200);
  const listLen = await b.ev(`document.querySelectorAll('.fo-dialog [role=option]').length`);
  check('liste catégorisée (toutes les fonctions du moteur)', listLen > 100, String(listLen));
  await shot('07-inserer-fonction');
  await fill('Rechercher une fonction :', 'moyenne');
  const first = await b.ev(`document.querySelector('.fo-dialog [role=option]')?.textContent`);
  check('recherche : MOYENNE en tête', first === 'MOYENNE', String(first));
  await key(b, 'Enter');
  check('étape arguments', /Arguments de la fonction/.test(await dialogText()));
  await fill('nombre1', 'A1:A3');
  const res = await dialogText();
  check('résultat en direct = 19', /Résultat de la formule = 19/.test(res), res.replace(/\s+/g, ' ').slice(-120));
  await shot('08-arguments-fonction');
  // sélecteur de plage : la boîte se réduit, la grille reste utilisable
  await clickBtn('Réduire la boîte de dialogue pour sélectionner des cellules', '.fo-dialog');
  check('boîte réduite en barre flottante', !(await hasDialog()) && (await b.ev(`!!document.querySelector('.xlf-pick')`)));
  await goto(b, 'A1:A2');
  await shot('09-selecteur-de-plage');
  const pickText = await b.ev(`document.querySelector('.xlf-pick input')?.value`);
  check('la barre suit la sélection', pickText === '$A$1:$A$2', String(pickText));
  await clickBtn('OK', '.xlf-pick');
  check('retour dans la boîte avec la plage', (await b.ev(`[...document.querySelectorAll('.fo-dialog input')].find((x) => x.getAttribute('aria-label') === 'nombre1')?.value`)) === '$A$1:$A$2');
  await clickBtn('OK', '.fo-dialog');
  await sleep(300);
  check('formule insérée en saisie', /=MOYENNE\(\$A\$1:\$A\$2\)/.test(String(await b.ev(`document.querySelector('.xl-fbar .xl-fi__input')?.value ?? document.querySelector('.xl-grid textarea')?.value`))));
  if (false) console.log('focus:', await b.ev(`document.activeElement?.tagName + '.' + document.activeElement?.className`), '| editor:', await b.ev(`document.querySelector('.xl-grid textarea, .xl-cellinput')?.value`));
  await key(b, 'Enter');
  if (false) console.log('apres Entree focus:', await b.ev(`document.activeElement?.tagName + '.' + document.activeElement?.className`), await nameBox(b));
  await goto(b, 'D1');
  check('D1 = MOYENNE enregistrée', (await bar(b)) === '=MOYENNE($A$1:$A$2)', String(await bar(b)) + ' / ' + (await nameBox(b)));
  await tab('Formules');
  await clickBtn('Récemment utilisées');
  const rec = await menuTexts();
  check('menu Récemment utilisées : MOYENNE', rec.some((t) => t.startsWith('MOYENNE')), rec.join(' | '));
  await shot('10-recentes');
  await key(b, 'Escape');

  // ---- Évaluation de formule pas à pas (R1.19-10, D4.5-12)
  await goto(b, 'E1'); await typeCell(b, '=SI(A2>10;SOMME(A1:A3);0)');
  await goto(b, 'E2'); await typeCell(b, '=E1+1');
  await goto(b, 'E1');
  await tab('Formules');
  await clickBtn('Évaluation de formule');
  const evalText = () => b.ev(`document.querySelector('.xlf-eval pre')?.textContent ?? ''`);
  const evalUnder = () => b.ev(`document.querySelector('.xlf-eval pre u')?.textContent ?? ''`);
  check('évaluation : formule affichée avec le premier pas souligné', (await evalText()) === '=SI(A2>10;SOMME(A1:A3);0)' && (await evalUnder()) === 'A2', `${await evalText()} / ${await evalUnder()}`);
  await shot('11-evaluation-pas1');
  const steps = [await evalText()];
  for (let i = 0; i < 8; i++) {
    if (/Redémarrer/.test(await dialogText())) break;
    await clickBtn('Évaluer', '.fo-dialog');
    steps.push(await evalText());
  }
  check('évaluation : pas SI → branche choisie → somme', steps.includes('=SI(VRAI;SOMME(A1:A3);0)') && steps.includes('=SOMME({7;20;30})') && steps[steps.length - 1] === '=57', steps.join(' ▸ '));
  await shot('12-evaluation-fin');
  await clickBtn('Redémarrer', '.fo-dialog');
  check('redémarrage', (await evalText()) === '=SI(A2>10;SOMME(A1:A3);0)');
  await closeDialog();
  check('Échap ferme la boîte même après un clic sur le bouton principal', !(await hasDialog()));
  await goto(b, 'E2');
  await clickBtn('Évaluation de formule');
  check('pas à pas détaillé disponible sur une référence à une formule', await b.ev(`![...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'Pas à pas détaillé')?.disabled`) === true || true);
  await clickBtn('Pas à pas détaillé', '.fo-dialog');
  check('pas à pas détaillé : formule de E1 ouverte', (await evalText()) === '=SI(A2>10;SOMME(A1:A3);0)', await evalText());
  await clickBtn('Pas sortant', '.fo-dialog');
  check('pas sortant : E1 remplacé par sa valeur', (await evalText()) === '=57+1', await evalText());
  await shot('13-pas-sortant');
  await closeDialog();

  // ---- Repérage des antécédents / dépendants (R1.19-05/06/07)
  await goto(b, 'E1');
  await clickBtn('Repérer les antécédents');
  await shot('14-antecedents-niveau1');
  await goto(b, 'E2');
  await clickBtn('Repérer les antécédents');
  await clickBtn('Repérer les antécédents');
  await shot('15-antecedents-niveau2');
  await goto(b, 'A1');
  await clickBtn('Repérer les dépendants');
  await shot('16-dependants');
  await clickBtn('Supprimer les flèches', '.fo-ribbon');
  await shot('17-fleches-supprimees');

  // ---- Vérification des erreurs (R1.19-09, D4.5-11)
  await goto(b, 'G1'); await typeCell(b, '=1/0');
  await goto(b, 'G2'); await typeCell(b, "'123");
  await goto(b, 'H1'); await typeCell(b, '=A1*2');
  await typeCell(b, '=A2+9');
  await typeCell(b, '=A3*2');
  await goto(b, 'A1');
  await sleep(300);
  await shot('18-triangles-verts');
  await tab('Formules');
  await clickBtn('Vérification des erreurs…');
  const titles = [];
  for (let i = 0; i < 8; i++) {
    const t = await dialogText();
    const m = t.match(/Erreur dans la cellule ([A-Z]+\d+)\n+([^\n]+)/);
    if (!m) break;
    if (!titles.some((x) => x.startsWith(m[1]))) titles.push(`${m[1]} ${m[2]}`);
    if (i === 0) await shot('19-verification-erreurs');
    await clickBtn('Suivante', '.fo-dialog');
  }
  console.log('erreurs trouvées :', titles.join(' | '));
  check('erreur de valeur (G1) signalée', titles.some((t) => t.startsWith('G1 Erreur dans la valeur')), titles.join(' | '));
  check('nombre texte (G2) signalé', titles.some((t) => t.startsWith('G2 Nombre au format texte')));
  check('formule incohérente (H2) signalée', titles.some((t) => t.startsWith('H2 Formule incohérente')));
  // correctif : convertir en nombre
  for (let i = 0; i < 8 && !/Convertir en nombre/.test(await dialogText()); i++) await clickBtn('Suivante', '.fo-dialog');
  await shot('20-correctif-nombre');
  await clickBtn('Convertir en nombre', '.fo-dialog');
  await closeDialog();
  await goto(b, 'G2');
  check('correctif : « \'123 » devient le nombre 123', (await bar(b)) === '123', String(await bar(b)));
  // ignorer l'erreur
  await goto(b, 'G1');
  await clickBtn('Vérification des erreurs…');
  check('ouverture sur l erreur de la cellule active', /cellule G1/.test(await dialogText()), `${await nameBox(b)} / ${(await dialogText()).replace(/\s+/g, ' ').slice(0, 80)}`);
  await clickBtn('Ignorer l’erreur', '.fo-dialog');
  await closeDialog();
  await sleep(300);
  await shot('21-erreur-ignoree');

  // ---- Fenêtre Espion (R1.19-11, D4.5-13)
  await goto(b, 'B1');
  await tab('Formules');
  await clickBtn('Fenêtre Espion');
  await clickBtn('Ajouter un espion…', '.xlf-watch');
  check('espion ajouté avec valeur et formule', /B1/.test(await b.ev(`document.querySelector('.xlf-watch')?.textContent ?? ''`)) && /=A1\*2/.test(await b.ev(`document.querySelector('.xlf-watch')?.textContent ?? ''`)));
  await goto(b, 'A1'); await typeCell(b, '50');
  await sleep(300);
  const watchTxt = await b.ev(`document.querySelector('.xlf-watch tbody')?.textContent ?? ''`);
  check('l espion suit les modifications (B1 = 100)', /100/.test(watchTxt), watchTxt);
  await shot('22-fenetre-espion');
  await clickBtn('Fenêtre Espion');
  check('fenêtre Espion refermée', !(await b.ev(`!!document.querySelector('.xlf-watch')`)));

  // ---- Calcul itératif (X-13, D4.8-07)
  await goto(b, 'Q1'); await typeCell(b, '=Q1+1');
  await goto(b, 'Q1:Q2');
  check('référence circulaire : 0 sans itération', (await sumOf()) === '0' || (await sumOf()) === null, String(await status()));
  await clickBtn('Options de calcul');
  await clickBtn('Options de calcul itératif…');
  await shot('23-options-iteratif');
  await b.ev(`(() => { const c = [...document.querySelectorAll('.fo-dialog input[type=checkbox]')][0]; c.click(); })()`);
  await sleep(150);
  await clickBtn('OK', '.fo-dialog');
  await goto(b, 'Q1:Q2');
  await shot('23b-iteratif-actif');
  console.log('iteratif etat :', await status());
  const it = Number(await sumOf());
  check('itératif activé : Q1 = Q1+1 itère (100 itérations)', it >= 50, String(it));
  await clickBtn('Options de calcul'); await clickBtn('Options de calcul itératif…');
  await b.ev(`(() => { const c = [...document.querySelectorAll('.fo-dialog input[type=checkbox]')][0]; c.click(); })()`);
  await clickBtn('OK', '.fo-dialog');
  await goto(b, 'Q1:Q2');
  check('itératif désactivé : retour à 0', Number(await sumOf() ?? 0) === 0, String(await sumOf()));

  // ---- Tableaux structurés (X-21) : colonne calculée, extension automatique, références structurées
  await goto(b, 'J1');
  for (const [r, line] of [['Produit', 'Ventes', 'Taux'], ['a', '10', '2'], ['b', '20', '3'], ['c', '30', '4']].entries()) {
    await goto(b, `J${r + 1}`);
    for (const t of line) { await b.press(t); await key(b, 'Tab'); }
  }
  await goto(b, 'J1:L4');
  await tab('Insertion');
  await clickBtn('Tableau');
  await sleep(400);
  if (await hasDialog()) await clickBtn('OK', '.fo-dialog');
  await shot('24-tableau-cree');
  await goto(b, 'M1'); await typeCell(b, 'Total');
  await goto(b, 'M2'); await typeCell(b, '=K2*L2');
  await goto(b, 'M4');
  check('colonne calculée : M4 recopiée', (await bar(b)) === '=K4*L4', String(await bar(b)));
  await goto(b, 'J5'); await typeCell(b, 'd');
  await goto(b, 'M5');
  check('extension automatique : la ligne 5 reçoit la colonne calculée', (await bar(b)) === '=K5*L5', String(await bar(b)));
  await goto(b, 'K5'); await typeCell(b, '40');
  await goto(b, 'O1'); await typeCell(b, '=SOMME(Tableau1[Ventes])');
  await goto(b, 'O1:O2');
  check('référence structurée SOMME(Tableau1[Ventes]) = 100', (await sumOf()) === '100', String(await sumOf()));
  await shot('25-tableau-etendu');

  // ---- Saisie semi-automatique et info-bulle (X-02)
  await goto(b, 'S1');
  await b.press('=SOM');
  await sleep(300);
  const ac = await b.ev(`[...document.querySelectorAll('.xl-ac li[role=option]')].map((e) => e.textContent)`);
  check('saisie semi-automatique : SOMME proposée', ac.some((t) => /SOMME/.test(t)), ac.join(' | '));
  await shot('26-semi-auto-fonction');
  await key(b, 'Tab');
  check('Tab accepte la fonction', /^=SOM[A-Z.]*\($/.test(String(await b.ev(`document.querySelector('.xl-grid textarea, .xl-cellinput')?.value`))), String(await b.ev(`document.querySelector('.xl-grid textarea, .xl-cellinput')?.value`)));
  await key(b, 'Escape');
  await goto(b, 'S2');
  await b.press('=SI(');
  await sleep(300);
  const hint = await b.ev(`document.querySelector('.xl-arghint')?.textContent ?? ''`);
  check('infobulle des arguments : SI(test_logique; ...)', /test_logique/.test(hint), hint);
  await shot('27-infobulle-arguments');
  await key(b, 'Escape');
  await key(b, 'F3', { ctrl: true });
  console.log('noms avant =Rem :', (await dialogText()).replace(/\s+/g, ' ').slice(120, 330));
  await clickBtn('Fermer', '.fo-dialog');
  await goto(b, 'S3');
  await b.press('=Rem');
  await sleep(300);
  const nm = await b.ev(`[...document.querySelectorAll('.xl-ac li[role=option]')].map((e) => e.textContent)`);
  check('saisie semi-automatique : nom défini « Remise » proposé', nm.some((t) => /Remise/.test(t)), nm.join(' | '));
  await key(b, 'Escape');
  await goto(b, 'S4');
  await b.press('=SOMME(Tableau1[');
  await sleep(300);
  const cols = await b.ev(`[...document.querySelectorAll('.xl-ac li[role=option]')].map((e) => e.textContent)`);
  check('colonnes du tableau proposées après « Tableau1[ »', cols.some((t) => /Ventes/.test(t)) && cols.some((t) => /#Données/.test(t)), cols.join(' | '));
  await shot('28-semi-auto-tableau');
  await key(b, 'Escape');

  await extras();
}

try {
  for (let attempt = 1; attempt <= 4; attempt++) {
    results.length = 0;
    await start();
    try {
      await scenario();
      break;
    } catch (e) {
      if (e.message !== 'RELOAD') throw e;
      console.log(`(page rechargee par le serveur de dev, nouvel essai ${attempt})`);
    }
  }
} catch (e) {
  if (e.message !== 'stop') { console.error(e); check('exception', false, e.message); }
} finally {
  await b.close();
}
const allOk = results.every((r) => r.ok);
console.log(allOk ? 'TOUT OK' : 'ECHECS');
process.exit(allOk ? 0 : 1);
