import { start, key, sleep, ok, shot, done } from './lib.mjs';
const b = await start('pdf', 'pdf', 'essai.pdf');
try {
  await sleep(1500);
  // sélectionner « courant » par double-clic réel sur le texte de la page 1
  const pos = await b.ev(`(() => { const s = [...document.querySelectorAll('.pdf-page [class*=text] span, .pdf-textlayer span, .textLayer span')].find((x) => x.textContent.includes('texte courant')); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x + r.width * 0.45, y: r.y + r.height / 2 }; })()`);
  console.log(JSON.stringify(pos));
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
  for (const n of [1, 2]) { await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: n }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: n }); }
  await sleep(400);
  console.log('sel:', await b.ev(`getSelection().toString()`));
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'right', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'right', clickCount: 1 });
  await sleep(500);
  await shot(b, 'ctx-redact-menu');
  const items = await b.ev(`[...document.querySelectorAll('[role=menuitem]')].map((x) => x.textContent.trim())`);
  console.log(JSON.stringify(items));
  ok('menu contextuel : « Caviarder le texte sélectionné »', items.includes('Caviarder le texte sélectionné'));
  await b.clickText('[role=menuitem]', 'Caviarder le texte sélectionné'); await sleep(700);
  ok('une zone de caviardage marquée', /1 modification en attente/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 80)`));
  await shot(b, 'ctx-redact-marked');
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
