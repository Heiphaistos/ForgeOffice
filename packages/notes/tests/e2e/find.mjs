import { openNotes, docText, setDoc, key, sleep, ok, shot, done } from './notes-lib.mjs';
const b = await openNotes();
const count = () => b.ev(`document.querySelector('.nt-find__count')?.textContent ?? null`);
const field = (sel) => `document.querySelector('.nt-find input[name=${sel}]')`;
const typeIn = async (name, text) => { await b.ev(`${field(name)}.focus(); ${field(name)}.select()`); await b.press(text); await sleep(300); };
const toggle = async (label) => { await b.clickText('.nt-find label', label); await sleep(300); };
try {
  await setDoc(b, 'chat Chat chats\nautre ligne\nun chat et un chat');
  await key(b, 'f', { ctrl: true }); await sleep(500);
  ok('panneau ouvert', await b.ev(`Boolean(document.querySelector('.nt-find'))`));
  await typeIn('search', 'chat');
  ok('sans casse : 5 résultats', (await count()) === '5 résultats', await count());
  await toggle('Respecter la casse');
  ok('avec casse : 4 résultats', (await count()) === '4 résultats', await count());
  await toggle('Mot entier');
  ok('casse + mot entier : 3 résultats', (await count()) === '3 résultats', await count());
  await toggle('Respecter la casse');
  ok('mot entier seul : 4 résultats (Chat compris)', (await count()) === '4 résultats', await count());
  await toggle('Mot entier');
  // Entrée : suivant, compteur « k sur n »
  await b.ev(`${field('search')}.focus()`); await key(b, 'Enter');
  const c1 = await count();
  ok('Entrée sélectionne un résultat : « k sur 5 »', /^\d sur 5$/.test(c1 ?? ''), c1);
  await shot(b, 'find-panel');
  // mode regexp
  await b.ev(`(() => { const s = document.querySelector('.nt-find select'); s.value = 'regexp'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  await typeIn('search', 'ch.t(s)?');
  ok('regexp « ch.t(s)? » : 5 résultats', /5/.test(await count()), await count());
  await typeIn('search', 'ch(');
  ok('regexp invalide signalée', (await count()) === 'Expression invalide', await count());
  // mode normal : \n littéral ; étendu : \n = fin de ligne
  await b.ev(`(() => { const s = document.querySelector('.nt-find select'); s.value = 'extended'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  await typeIn('search', String.raw`chats\nautre`);
  ok('étendu : \n trouve le saut de ligne', (await count()) === '1 résultat' || /1 sur 1/.test(await count()), await count());
  await b.ev(`(() => { const s = document.querySelector('.nt-find select'); s.value = 'normal'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  ok('normal : \n est du texte, aucun résultat', (await count()) === 'Aucun résultat', await count());
  // Dans la sélection
  await b.ev(`(() => { const s = document.querySelector('.nt-find select'); s.value = 'extended'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await typeIn('search', 'chat');
  await b.ev(`window.__FO__.select('ligne')`); await sleep(200); // ligne 3 sélectionnée
  await toggle('Dans la sélection');
  ok('dans la sélection : 2 résultats (ligne 3)', (await count()) === '2 résultats', await count());
  await typeIn('replace', 'X');
  await b.clickText('.nt-find button', 'Tout remplacer'); await sleep(400);
  ok('Tout remplacer limité à la sélection', (await docText(b)) === 'chat Chat chats\nautre ligne\nun X et un X', JSON.stringify(await docText(b)));
  await shot(b, 'find-selection');
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
