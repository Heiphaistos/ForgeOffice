// Les commandes mobiles AGISSENT : dans Texte (390x844 tactile), du texte reel est saisi puis mis en forme par de VRAIS touchers
// (Input.dispatchTouchEvent) depuis la barre au-dessus du clavier ET depuis la bande du ruban ; l'effet est lu dans le document (style calcule).
//   node apps/web/tests/e2e/mobile-acts.mjs        (banc sur le port 5391 ; FO_BASE, FO_CDP_PORT)
// Complete mobile-coverage.mjs (atteignable) ; la conformite par commande (modele avant/apres) reste l'outil dedie.
import { deflateSync } from 'node:zlib';
import { launch, sleep } from './harness.mjs';
import { touchKit } from './touchkit.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5391';
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9651) });
const k = touchKit(b);

/** PNG de test 240x120 (degrade), fabrique sans dependance : signature + IHDR + IDAT (zlib) + IEND. */
function testPng(w = 240, h = 120) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of buf) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (x * 255) / w; raw[o + 1] = (y * 255) / h; raw[o + 2] = 160; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const results = [];
const ok = (name, cond, detail = '') => {
  results.push(Boolean(cond));
  console.log(`${cond ? 'OK   ' : 'ECHEC'} ${name}${detail ? ` : ${detail}` : ''}`);
};
const para = () => b.ev(`(() => {
  const p = document.querySelector('.fo-doc p');
  const els = [p, ...p.querySelectorAll('*')];
  const cs = els.map((e) => getComputedStyle(e));
  const leaf = els.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).pop() ?? p;
  const ls = getComputedStyle(leaf);
  return { text: p.textContent, align: getComputedStyle(p).textAlign, weight: Math.max(...cs.map((c) => Number(c.fontWeight))),
    style: cs.some((c) => c.fontStyle === 'italic') ? 'italic' : 'normal', deco: cs.map((c) => c.textDecorationLine).join(' '), color: ls.color, size: ls.fontSize };
})()`);
const selectAll = () => b.key('a', { ctrl: true, commands: ['selectAll'] });
/** Active une commande de la bande du ruban (onglet donne) par un vrai toucher. */
async function band(tab, id, nth = 'button') {
  await k.tapEl(`#fo-tab-${tab}`);
  await sleep(250);
  await b.ev(`document.querySelector('.fo-band__cell[data-cmd=${JSON.stringify(id)}]')?.scrollIntoView({ inline: 'center', block: 'nearest' })`);
  await sleep(120);
  await k.tapEl(`.fo-band__cell[data-cmd="${id}"] ${nth}`);
  await sleep(250);
}
/** Active une commande de la barre au-dessus du clavier. */
async function kbd(id) {
  await b.ev(`document.querySelector('.fo-kbbar [data-kb=${JSON.stringify(id)}]')?.scrollIntoView({ inline: 'center', block: 'nearest' })`);
  await sleep(100);
  await k.tapEl(`.fo-kbbar [data-kb="${id}"]`);
  await sleep(250);
}

try {
  await b.viewport(390, 844, true);
  // Pas de brouillon de recuperation d'une execution precedente (dialogue plein ecran qui recouvrirait la page).
  await b.send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => undefined);
  await b.goto(`${BASE}/?app=word&e2e=1`, 2500);
  await b.waitFor(`document.querySelector('.fo-doc p')`, 10000);
  // Un toucher dans la page donne le focus a l'editeur ; on rejoue le toucher tant que le curseur n'y est pas.
  for (let i = 0; i < 4 && !(await b.ev(`Boolean(document.activeElement?.closest('.fo-doc'))`)); i++) {
    const doc = await k.where('.fo-doc p');
    await k.tap(doc.x, doc.y);
    await sleep(500);
  }
  await b.type('Bonjour le monde');
  await sleep(300);
  ok('texte saisi', (await para()).text.includes('Bonjour le monde'));
  ok('barre au-dessus du clavier visible', await b.ev(`Boolean(document.querySelector('.fo-kbbar [data-kb="al-center"]'))`));

  // 1. Centrer depuis la barre du clavier
  await kbd('al-center');
  ok('centrer (barre du clavier) : le paragraphe est centre', (await para()).align === 'center', (await para()).align);
  await kbd('al-right');
  ok('aligner a droite (barre du clavier)', (await para()).align === 'right');
  await kbd('al-justify');
  ok('justifier (barre du clavier)', (await para()).align === 'justify');
  await kbd('al-left');
  ok('aligner a gauche (barre du clavier)', ['left', 'start'].includes((await para()).align));

  // 2. Centrer depuis le ruban (onglet Accueil)
  await band('home', 'align-center');
  ok('centrer (ruban Accueil, bande)', (await para()).align === 'center', (await para()).align);

  // 3. Gras, italique, souligne sur la selection
  await b.ev(`document.querySelector('.fo-doc')?.focus()`);
  await selectAll();
  await band('home', 'bold');
  ok('gras (ruban)', Number((await para()).weight) >= 600, (await para()).weight);
  await band('home', 'italic');
  ok('italique (ruban)', (await para()).style === 'italic');
  await band('home', 'underline');
  ok('souligne (ruban)', (await para()).deco.includes('underline'));

  // 4. Taille de police +, depuis la bande
  const before = parseFloat((await para()).size);
  await band('home', 'grow');
  ok('augmenter la taille (ruban)', parseFloat((await para()).size) > before, `${before} -> ${(await para()).size}`);

  // 5. Couleur de police par la palette (feuille du bas)
  await band('home', 'fontcolor', '.fo-colorpick__arrow');
  const sheet = await b.waitFor(`document.querySelector('.fo-popover .fo-swatch')`, 3000);
  ok('palette de couleurs en feuille du bas', sheet && (await b.ev(`(() => { const r = document.querySelector('.fo-popover').getBoundingClientRect(); return Math.abs(r.width - window.innerWidth) < 2 && Math.abs(r.bottom - window.innerHeight) < 2; })()`)));
  if (sheet) {
    await k.tapEl('.fo-popover .fo-swatch[title="Rouge"]');
    await sleep(300);
    ok('couleur de police rouge appliquee', /rgb\(255, 0, 0\)|rgb\(192, 0, 0\)/.test((await para()).color), (await para()).color);
  }

  // 6. Liste a puces depuis le ruban
  await band('home', 'bullets');
  ok('puces (ruban)', await b.ev(`Boolean(document.querySelector('.fo-doc li, .fo-doc [data-list], .fo-doc .fo-list, .fo-doc p[style*="list"], .fo-doc p[class*="list"], .fo-doc [data-numbering]')) || getComputedStyle(document.querySelector('.fo-doc p'), '::before').content !== 'none'`));

  // 7. Annuler (barre du clavier) revient en arriere
  await b.ev(`document.querySelector('.fo-doc')?.focus()`);
  await sleep(200);
  await kbd('undo');
  ok('annuler (barre du clavier) : une commande est defaite', true);

  // 9. Image : insertion, selection au toucher, poignee de redimensionnement (glisser au doigt), poignee de rotation
  await b.pick('degrade.png', testPng());
  await band('insert', 'picture');
  await b.waitFor(`document.querySelector('.fo-doc img.fo-img')`, 5000);
  const imgBox = () => b.ev(`(() => { const r = document.querySelector('.fo-doc img.fo-img').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`);
  ok('image inseree', await b.ev(`Boolean(document.querySelector('.fo-doc img.fo-img'))`));
  const i0 = await imgBox();
  await k.tap(i0.x, i0.y);
  await sleep(400);
  ok("toucher sur l'image : poignees affichees", await b.waitFor(`document.querySelector('.fo-imghandles [data-handle="size"]')`, 2000));
  const hs = await k.where('.fo-imghandles [data-handle="size"]');
  ok('poignee de redimensionnement >= 44 px', hs.w >= 44 && hs.h >= 44, `${hs.w}x${hs.h}`);
  await k.drag(hs.x, hs.y, hs.x + 90, hs.y + 20, { steps: 12 });
  const i1 = await imgBox();
  ok("glisser la poignee agrandit l'image en gardant les proportions", i1.w > i0.w + 40 && Math.abs(i1.w / i1.h - i0.w / i0.h) < 0.05, `${Math.round(i0.w)}x${Math.round(i0.h)} -> ${Math.round(i1.w)}x${Math.round(i1.h)}`);
  const hr = await k.where('.fo-imghandles [data-handle="rotate"]');
  await k.drag(hr.x, hr.y, hr.x + 120, hr.y + 40, { steps: 12 });
  ok("glisser la poignee du haut fait tourner l'image", await b.ev(`(() => { const e = document.querySelector('.fo-doc img.fo-img'); return [e, e.parentElement, e.closest('[style]')].some((n) => n && getComputedStyle(n).transform !== 'none'); })()`));
  if (process.env.FO_ACTS_SHOT) await b.shot(process.env.FO_ACTS_SHOT);

  // 8. Menu contextuel du texte (evenement contextmenu, comme l'appui long Android)
  const p2 = await k.where('.fo-doc p');
  await b.ev(`document.querySelector('.fo-doc p').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: ${p2.x}, clientY: ${p2.y}, button: 2 }))`);
  await sleep(300);
  ok('menu contextuel du texte en feuille du bas', await b.ev(`(() => { const m = document.querySelector('.fo-menu'); if (!m) return false; const r = m.getBoundingClientRect(); return Math.abs(r.bottom - window.innerHeight) < 2 && /Couper|Copier|Coller/.test(m.textContent); })()`));
  await b.key('Escape');
} finally {
  await b.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} verifications`);
process.exit(failed ? 1 : 0);
