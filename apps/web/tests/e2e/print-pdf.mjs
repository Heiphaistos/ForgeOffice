// Impression reelle d'un document Texte long : le PDF produit par Chromium (printToPDF, meme moteur que WebView2)
// doit avoir exactement autant de pages que l'apercu, sans page blanche finale.
// Usage : node apps/web/tests/e2e/print-pdf.mjs <fichier.docx> <pages attendues>   (banc sur FO_BASE, voir flows.mjs)
import { readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5321';
const [file, expected] = [process.argv[2], Number(process.argv[3])];
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9583) });
let code = 0;
try {
  await b.viewport(Number(process.env.VW ?? 1440), Number(process.env.VH ?? 900));
  await b.goto(`${BASE}/?app=word`);
  await b.pick('doc.docx', readFileSync(file));
  await b.click('text=Fichier'); await sleep(350);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Ouvrir'); await sleep(500);
  for (const label of ['Parcourir', 'Ouvrir…']) if (await b.ev(`[...document.querySelectorAll('.fo-bs button')].some((e) => e.textContent.trim() === ${JSON.stringify(label)})`)) { await b.clickText('.fo-bs button', label); break; }
  await sleep(2500);
  // Retient l'appel d'impression (rAF) pour figer la mise en page « pages jointives » le temps de produire le PDF.
  await b.ev(`window.__held = []; const raf = window.requestAnimationFrame.bind(window); window.__raf = raf; window.requestAnimationFrame = (f) => { if (window.__hold) { window.__held.push(f); return 0; } return raf(f); }; window.print = () => { window.__printed = (window.__printed ?? 0) + 1; }; window.__hold = true;`);
  await b.click('text=Fichier'); await sleep(350);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Imprimer'); await sleep(600);
  await b.click('.fo-bs .fo-btn--primary'); await sleep(1200);
  const held = await b.ev('window.__held.length');
  const pdf = await b.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(pdf.data, 'base64');
  const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`rAF retenus: ${held}, pages du PDF: ${pages}, attendu: ${expected}`);
  if (pages !== expected) code = 1;
} finally { await b.close(); }
process.exit(code);
