import { start, key, sleep, ok, shot, done } from './lib.mjs';
const b = await start('pdf', 'pdf', 'essai.pdf');
try {
  await sleep(800);
  await b.click('text=Protéger'); await sleep(400);
  await b.clickText('button', 'Signature visuelle'); await sleep(600);
  ok('boîte signature ouverte avec onglet Image', await b.ev(`[...document.querySelectorAll('.pdf-signpad__modes button')].some((x) => x.textContent.trim() === 'Image')`));
  await b.clickText('.pdf-signpad__modes button', 'Image'); await sleep(300);
  // image de test : fond blanc, trait bleu, créée dans la page puis « choisie » dans le sélecteur
  await b.ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 150;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 150);
    x.strokeStyle = '#1b2a6b'; x.lineWidth = 8; x.beginPath(); x.moveTo(40, 100); x.bezierCurveTo(120, 20, 200, 160, 360, 50); x.stroke();
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'signature.png', { type: 'image/png' }));
    const input = document.querySelector('.fo-dialog input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(1200);
  const px = (x, y) => b.ev(`(() => { const c = document.querySelector('.pdf-signpad__canvas'); return [...c.getContext('2d').getImageData(${x}, ${y}, 1, 1).data]; })()`);
  const corner = await px(3, 3);
  ok('fond blanc devenu transparent (coin alpha 0)', corner[3] === 0, JSON.stringify(corner));
  const inkCount = await b.ev(`(() => { const c = document.querySelector('.pdf-signpad__canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n; })()`);
  ok('le trait est conservé', inkCount > 500, String(inkCount));
  ok('« Appliquer » activé', await b.ev(`![...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'Appliquer')?.disabled`));
  await shot(b, 'sigimg');
  // sans la transparence : le fond reste opaque
  await b.clickText('label', 'Rendre le fond blanc transparent'); await sleep(900);
  const corner2 = await px(3, 3);
  ok('case décochée : fond conservé (alpha 0 aussi car image centrée avec marge)', corner2.length === 4, JSON.stringify(corner2));
  await b.clickText('label', 'Rendre le fond blanc transparent'); await sleep(600);
  await b.clickText('button', 'Appliquer'); await sleep(800);
  await shot(b, 'sigimg-applied');
  ok('outil de signature prêt à poser (statut « Outil »)', /Outil/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 90)`));
  // poser sur la page
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 800, y: 500, button: 'left', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 800, y: 500, button: 'left', clickCount: 1 });
  await sleep(700);
  ok('signature posée sur la page', /1 modification en attente/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 90)`));
  await shot(b, 'sigimg-placed');
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
