import { openNotes, docText, setDoc, selection, palette, key, sleep, ok, shot, done } from './notes-lib.mjs';
const b = await openNotes();
const sel = async () => (await selection(b))?.text;
try {
  await setDoc(b, 'un mot ici\nligne deux\nligne trois');
  await b.ev(`window.__FO__.select('mot')`); await sleep(200); // 5 premiers caractères de la ligne 3 : « ligne »
  await b.ev(`document.querySelector('.cm-content').focus()`);
  await key(b, 'b', { ctrl: true });
  let t = await docText(b);
  ok('Ctrl+B : gras', t.split('\n')[2] === '**ligne** trois', JSON.stringify(t));
  ok('la sélection suit le texte', (await sel()) === 'ligne', await sel());
  await key(b, 'i', { ctrl: true });
  t = await docText(b);
  ok('Ctrl+I : italique en plus du gras', t.split('\n')[2] === '***ligne*** trois', JSON.stringify(t));
  await key(b, 'b', { ctrl: true });
  t = await docText(b);
  ok('Ctrl+B retire le gras seulement', t.split('\n')[2] === '*ligne* trois', JSON.stringify(t));
  await key(b, 'i', { ctrl: true });
  ok('Ctrl+I retire l\'italique', (await docText(b)).split('\n')[2] === 'ligne trois', JSON.stringify(await docText(b)));
  await key(b, 'k', { ctrl: true });
  t = await docText(b);
  ok('Ctrl+K : lien avec l\'adresse sélectionnée', t.split('\n')[2] === '[ligne](https://) trois' && (await sel()) === 'https://', JSON.stringify(t) + ' | ' + (await sel()));
  // listes : tout sélectionner puis puces
  await b.ev(`window.__FO__.select('tout')`);
  await palette(b, 'Liste à puces');
  t = await docText(b);
  ok('Liste à puces sur toutes les lignes', t.split('\n').every((l) => l.startsWith('- ')), JSON.stringify(t));
  await palette(b, 'Liste numérotée');
  ok('Liste numérotée remplace les puces', (await docText(b)).startsWith('1. un mot ici\n2. ligne deux\n3. '), JSON.stringify(await docText(b)));
  await palette(b, 'Liste numérotée');
  ok('une seconde fois : retirée', (await docText(b)).startsWith('un mot ici\nligne deux\n'), JSON.stringify(await docText(b)));
  await palette(b, 'Titre 2');
  ok('Titre 2 sur chaque ligne', (await docText(b)).split('\n').every((l) => l.startsWith('## ')), JSON.stringify(await docText(b)));
  await shot(b, 'md-format');
  await b.click('text=Édition'); await sleep(500);
  await shot(b, 'md-ribbon');
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
