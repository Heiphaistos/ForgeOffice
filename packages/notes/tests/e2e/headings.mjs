import { openNotes, docText, setDoc, selection, key, sleep, ok, shot, done } from './notes-lib.mjs';
const b = await openNotes();
const active = async () => (await b.ev(`window.__FO__.snapshot()`)).active;
const lineOfCaret = async () => { const s = await b.ev(`window.__FO__.snapshot()`); const t = s.tabs[s.active].text; return t.slice(0, s.selection.main).split('\n').length; };
try {
  // note cible (onglet « Sans titre 1 ») avec des titres
  await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }))`); await sleep(400);
  await setDoc(b, '# Intro\ntexte\ntexte\n## Deuxième Partie\nsuite\nsuite\n### Fin');
  const targetIdx = await active();
  // retour à l'onglet 0 et lien
  await b.ev(`document.querySelectorAll('.nt-tab')[0].click()`); await sleep(400);
  await setDoc(b, 'Voir [[Sans titre 1#deuxieme partie]] ici');
  await b.ev(`document.querySelector('.cm-content').focus()`);
  await key(b, 'Home'); for (let i = 0; i < 10; i++) await key(b, 'ArrowRight', { wait: 20 });
  await key(b, 'Enter', { ctrl: true }); await sleep(800);
  ok('le lien ouvre la note cible', (await active()) === targetIdx, `${await active()} / ${targetIdx}`);
  ok('le curseur est sur la ligne du titre (4)', (await lineOfCaret()) === 4, String(await lineOfCaret()));
  await shot(b, 'heading-jump');
  // titre introuvable : avis
  await b.ev(`document.querySelectorAll('.nt-tab')[0].click()`); await sleep(300);
  await setDoc(b, 'Voir [[Sans titre 1#inexistant]]');
  await b.ev(`document.querySelector('.cm-content').focus()`);
  await key(b, 'Home'); for (let i = 0; i < 10; i++) await key(b, 'ArrowRight', { wait: 20 });
  await key(b, 'Enter', { ctrl: true }); await sleep(700);
  ok('titre introuvable : avis affiché', (await b.ev(`document.body.innerText`)).includes('Titre introuvable'));
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
