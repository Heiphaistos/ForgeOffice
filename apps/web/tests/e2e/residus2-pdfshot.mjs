// Rend une page d'un PDF avec pdf.js (servi par le banc) dans le navigateur et la capture : node residus2-pdfshot.mjs fichier.pdf page sortie.png
import { readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [file, pageNo = '1', shot] = process.argv.slice(2);
const b = await launch({ port: 9631 });
try {
  await b.viewport(1280, 760);
  await b.goto('http://127.0.0.1:5371/?app=hub');
  const b64 = readFileSync(file).toString('base64');
  const r = await b.ev(`(async () => {
    const pdfjs = await import('/@fs/D:/Projet/ForgeOffice/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/@fs/D:/Projet/ForgeOffice/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs';
    const data = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(${Number(pageNo)});
    const vp = page.getViewport({ scale: 1280 / page.getViewport({ scale: 1 }).width });
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#888';
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(c);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const t = await page.getTextContent();
    return { pages: doc.numPages, text: t.items.map((i) => i.str).join('|').slice(0, 400) };
  })()`);
  console.log(JSON.stringify(r));
  await sleep(300);
  await b.shot(shot);
} finally { await b.close(); }
