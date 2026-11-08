import { openNotes, docText, setDoc, palette, key, sleep, ok, shot, done } from './notes-lib.mjs';
const b = await openNotes();
try {
  await setDoc(b, '');
  await b.ev(`document.querySelector('.cm-content').focus()`);
  await b.press('f('); 
  ok('sans option : « ( » reste seule', (await docText(b)) === 'f(', JSON.stringify(await docText(b)));
  await palette(b, 'Fermeture automatique');
  await setDoc(b, '');
  await b.ev(`document.querySelector('.cm-content').focus()`);
  await b.press('f(a, [b'); await sleep(200);
  ok('( et [ fermés automatiquement', (await docText(b)) === 'f(a, [b])', JSON.stringify(await docText(b)));
  await b.press(']'); await b.press(')');
  ok('frapper la fermante saute par-dessus', (await docText(b)) === 'f(a, [b])', JSON.stringify(await docText(b)));
  await b.press('"x'); await sleep(200);
  ok('guillemet fermé', (await docText(b)) === 'f(a, [b])"x"', JSON.stringify(await docText(b)));
  await key(b, 'Backspace'); await key(b, 'Backspace'); 
  ok('Retour arrière supprime la paire', (await docText(b)) === 'f(a, [b])', JSON.stringify(await docText(b)));
  // apostrophe française après un mot : pas de paire
  await setDoc(b, ''); await b.ev(`document.querySelector('.cm-content').focus()`);
  await b.press("l'ami");
  ok('apostrophe : pas de paire', (await docText(b)) === "l'ami", JSON.stringify(await docText(b)));
  // complétion
  await palette(b, 'Complétion des mots');
  await setDoc(b, 'bonjour bonsoir\n'); await b.ev(`document.querySelector('.cm-content').focus()`);
  await b.ev(`window.__FO__.select('tout')`); await key(b, 'End', { ctrl: true });
  await b.press('bonj'); await sleep(900);
  const tip = await b.ev(`document.querySelector('.cm-tooltip-autocomplete')?.textContent ?? ''`);
  ok('liste de complétion avec « bonjour »', tip.includes('bonjour'), tip);
  await shot(b, 'typing-complete');
  await key(b, 'Enter'); await sleep(300);
  ok('Entrée accepte la complétion', (await docText(b)).trimEnd().endsWith('bonjour bonsoir\nbonjour') , JSON.stringify(await docText(b)));
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
