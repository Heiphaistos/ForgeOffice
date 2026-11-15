// Impression d'un document ouvert dans un onglet isole (mode « tab », cadre iframe) : la page hote est celle qu'imprime
// WebView2, elle ne doit montrer ni la barre d'onglets ni un cadre rogne. PDF Chromium (printToPDF) de la page hote.
// Usage : node apps/web/tests/e2e/print-tab.mjs <pages attendues> (banc sur FO_BASE, voir flows.mjs)
import { launch, sleep } from './harness.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5321';
const expected = Number(process.argv[2] ?? 5);
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9584) });
let code = 0;
try {
  await b.viewport(1280, 800);
  await b.goto(`${BASE}/`, 800);
  await b.ev(`localStorage.setItem('fo-setting:ui.openMode', '"tab"')`);
  await b.goto(`${BASE}/`, 1500);
  await b.ev(`window.print = () => { window.__printed = (window.__printed ?? 0) + 1; }`);
  await b.ev(`[...document.querySelectorAll('button')].find((x) => /Document vierge/i.test(x.textContent))?.click()`);
  await sleep(3000);
  // Texte long dans le cadre (5 pages A4 environ), puis Fichier > Imprimer > Imprimer, tout dans le cadre.
  await b.ev(`(() => { const d = document.querySelector('iframe.fo-tabframe').contentDocument; const pm = d.querySelector('.ProseMirror'); pm.focus(); d.execCommand('insertText', false, ${JSON.stringify(Array.from({ length: 130 }, (_, i) => `Ligne ${i + 1} du document de test`).join('\n'))}); })()`);
  await sleep(1500);
  const inFrame = (js) => b.ev(`(() => { const d = document.querySelector('iframe.fo-tabframe').contentDocument; ${js} })()`);
  await inFrame(`[...d.querySelectorAll('[role=tab], button')].find((x) => x.textContent.trim() === 'Fichier')?.click()`); await sleep(500);
  await inFrame(`[...d.querySelectorAll('.fo-bs__nav-item, [role=menuitem], .fo-menu button')].find((x) => /Imprimer/.test(x.textContent))?.click()`); await sleep(800);
  await inFrame(`d.querySelector('.fo-bs .fo-btn--primary')?.click()`); await sleep(1800);
  const printed = await b.ev('window.__printed ?? 0');
  const pdf = await b.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(pdf.data, 'base64');
  if (process.env.FO_PDF_OUT) (await import('node:fs')).writeFileSync(process.env.FO_PDF_OUT, bytes);
  const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`print() hote appele: ${printed}, pages du PDF hote: ${pages}, attendu: ${expected}`);
  // Fin d'impression (printToPDF declenche aussi afterprint) : tout est revenu en place dans le cadre.
  const back = await b.ev(`!!document.querySelector('iframe.fo-tabframe').contentDocument.querySelector('#root .fo-word-sheet') && !document.querySelector('[data-fo-frame-print]')`);
  console.log(`remise en place apres l'impression: ${back}`);
  if (!(printed === 1 && pages === expected && back)) code = 1;
} finally { await b.close(); }
process.exit(code);
