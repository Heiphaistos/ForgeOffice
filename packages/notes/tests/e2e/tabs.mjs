import { openNotes, docText, setDoc, key, sleep, ok, shot, done } from './notes-lib.mjs';
const b = await openNotes();
const names = () => b.ev(`[...document.querySelectorAll('.nt-tab')].map((t) => (t.classList.contains('is-pinned') ? '*' : '') + t.querySelector('.nt-tab__label').textContent)`);
const rightClick = async (i) => {
  const r = await b.ev(`(() => { const t = document.querySelectorAll('.nt-tab')[${i}].getBoundingClientRect(); return { x: t.x + t.width / 2, y: t.y + t.height / 2 }; })()`);
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'right', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'right', clickCount: 1 });
  await sleep(400);
};
try {
  // 4 onglets : essai.md + 3 nouveaux
  for (let i = 0; i < 3; i++) { await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }))`); await sleep(300); }
  console.log(JSON.stringify(await names()));
  const n0 = (await names()).length;
  ok('au moins 4 onglets', n0 >= 4, String(n0));
  // épingler le 3e onglet
  await rightClick(2);
  await shot(b, 'tabs-menu');
  await b.clickText('[role=menuitem], button', "Épingler l'onglet"); await sleep(400);
  const n1 = await names();
  ok('onglet épinglé passé à gauche', n1[0]?.startsWith('*'), JSON.stringify(n1));
  ok('onglet épinglé sans bouton de fermeture', await b.ev(`!document.querySelector('.nt-tab.is-pinned .nt-tab__close')`));
  // fermer les autres : l'épinglé reste
  await rightClick(n0 - 1);
  await b.clickText('[role=menuitem], button', 'Fermer les autres onglets'); await sleep(800);
  const n2 = await names();
  ok('« Fermer les autres » épargne l\'onglet épinglé', n2.length === 2 && n2.some((x) => x.startsWith('*')), JSON.stringify(n2));
  await shot(b, 'tabs-after');
  // désépingler
  await rightClick(0);
  await b.clickText('[role=menuitem], button', "Désépingler l'onglet"); await sleep(400);
  ok('désépinglé', !(await names()).some((x) => x.startsWith('*')), JSON.stringify(await names()));
  // palette
  await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))`); await sleep(300);
  await b.press("Épingler l'onglet"); await sleep(300); await key(b, 'Enter'); await sleep(400);
  ok('palette : épingler', (await names()).some((x) => x.startsWith('*')), JSON.stringify(await names()));
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
