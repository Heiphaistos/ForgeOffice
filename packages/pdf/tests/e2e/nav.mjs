import { killChrome, start, key, sleep, ok, shot, done } from './lib.mjs';
killChrome(); const b = await start('pdf', 'pdf', 'essai.pdf');
const status = () => b.ev(`document.querySelector('.fo-sb')?.textContent ?? document.body.textContent.match(/Page \d+ sur \d+/)?.[0]`);
const zoom = () => b.ev(`(document.querySelector(".fo-sb")?.textContent.match(/([0-9]+)[^0-9]*%/)||[])[1]`);
try {
  ok('document ouvert', await b.waitFor(`document.querySelector('.pdf-page')`, 15000));
  await sleep(1000);
  const z0 = Number(await zoom());
  await key(b, '=', { ctrl: true });
  const z1 = Number(await zoom());
  ok('Ctrl+= agrandit', z1 > z0, `${z0} -> ${z1}`);
  await key(b, '-', { ctrl: true }); await key(b, '-', { ctrl: true });
  const z2 = Number(await zoom());
  ok('Ctrl+- réduit', z2 < z1, `${z2}`);
  await key(b, '1', { ctrl: true });
  ok('Ctrl+1 = 100 %', Number(await zoom()) === 100, await zoom());
  await key(b, '0', { ctrl: true });
  const zp = Number(await zoom());
  ok('Ctrl+0 page entière', zp !== 100 && zp > 0, `${zp}`);
  await key(b, '2', { ctrl: true });
  const zw = Number(await zoom());
  ok('Ctrl+2 largeur', zw > 0 && zw !== zp, `${zw}`);
  // Ctrl + molette
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 800, y: 500, deltaX: 0, deltaY: -120, modifiers: 2 });
  await sleep(300);
  const zwh = Number(await zoom());
  ok('Ctrl+molette agrandit', zwh > zw, `${zw} -> ${zwh}`);
  await key(b, '1', { ctrl: true });
  // Fin / Début
  await b.ev(`document.querySelector('.pdf-viewer').focus()`);
  await key(b, 'End'); await sleep(900);
  ok('Fin : page 3', /Page 3 sur 3/.test(await status()), await status());
  await key(b, 'Home'); await sleep(900);
  ok('Début : page 1', /Page 1 sur 3/.test(await status()), await status());
  // Alt+Gauche : retour à la page 3 ?? -> historique : 0 -> 2 -> 0 ; back = page 2 (idx) 
  await key(b, 'ArrowLeft', { alt: true }); await sleep(900);
  ok('Alt+Gauche : vue précédente (page 3)', /Page 3 sur 3/.test(await status()), await status());
  await key(b, 'ArrowRight', { alt: true }); await sleep(900);
  ok('Alt+Droite : vue suivante (page 1)', /Page 1 sur 3/.test(await status()), await status());
  // Aller à la page
  await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', ctrlKey: true, shiftKey: true, bubbles: true }))`); await sleep(400);
  ok('Ctrl+Maj+N ouvre Aller à la page', await b.waitFor(`document.querySelector('.fo-dialog')?.textContent.includes('Aller à la page')`, 3000));
  await shot(b, 'nav-goto');
  await b.press('2');
  // le champ contient "1" : remplacer
  await b.ev(`(() => { const i = document.querySelector('.fo-dialog input'); i.select(); })()`);
  await b.press('2');
  await key(b, 'Enter'); await sleep(1000);
  ok('Aller à la page 2', /Page 2 sur 3/.test(await status()), await status());
  ok('boîte fermée', await b.ev(`!document.querySelector('.fo-dialog')`));
  // saisie invalide
  await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', ctrlKey: true, shiftKey: true, bubbles: true }))`); await sleep(400);
  await b.ev(`(() => { const i = document.querySelector('.fo-dialog input'); i.select(); })()`);
  await b.press('9');
  const dis = await b.ev(`[...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'Aller')?.disabled`);
  ok('page 9 refusée (bouton Aller grisé)', dis === true);
  await shot(b, 'nav-goto-invalid');
  await key(b, 'Escape');
  // Mode lecture
  await key(b, 'h', { ctrl: true });
  await sleep(500);
  ok('Ctrl+H : ruban et volet masqués', await b.ev(`!document.querySelector('.fo-ribbon') && !document.querySelector('.pdf-side')`));
  await shot(b, 'nav-reading');
  await key(b, 'Escape'); await sleep(400);
  ok('Échap : ruban de retour', await b.ev(`Boolean(document.querySelector('.fo-ribbon'))`));
  await shot(b, 'nav-normal');
} catch (e) { console.log('ERREUR', e); }
done(b);
process.exit(0);
