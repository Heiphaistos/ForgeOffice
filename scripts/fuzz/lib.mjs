// Banc de fuzz des importeurs : generation deterministe (graine) de fichiers mutes a partir de vrais fichiers d'exemple.
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { PDFDocument } from '@cantoo/pdf-lib';
import * as D from '../../packages/docx/src/index.ts';
import * as X from '../../packages/xlsx/src/index.ts';
import * as P from '../../packages/pptx/src/index.ts';
import { writeFopub, readFopub } from '../../packages/publisher/src/fopub.ts';
import { blank } from '../../packages/publisher/src/templates/single.ts';
import { addText } from '../../packages/publisher/src/build.ts';
import { analyze } from '../../packages/pdf/src/analyze.ts';
import { opmlToMarkdown } from '../../packages/convert/src/opml.ts';
import { notebookToMarkdown } from '../../packages/convert/src/notebook.ts';
import { parseYaml, parseToml } from '../../packages/convert/src/structured.ts';
import { jsonToWorkbook } from '../../packages/convert/src/sheet-data.ts';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (...parts) => {
  let h = 2166136261;
  for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};

export const enc = (s) => new TextEncoder().encode(s);
export const dec = (b) => new TextDecoder('utf-8').decode(b);
const NUMS = ['1e308', '-1e308', '99999999999999999999', '-1', '0', 'NaN', 'Infinity', '-Infinity', '2147483648', '4294967296', '-2147483649', '1e-320', '0.0000001', '9'.repeat(400), ''];
const UNI = ['\u0000', '\ud800', '\udfff\ud800', '‮', '﻿', '\u{10ffff}', 'à'.repeat(3000), '​'.repeat(5000), '😀'.repeat(2000), '\u0001\u0002\u001f', 'é'.repeat(70000)];

/** Mutations d'octets / structure sur un tampon. */
function byteMutate(b, r) {
  const out = Uint8Array.from(b);
  const n = out.length;
  const pick = (r() * 6) | 0;
  if (!n) return out;
  if (pick === 0) { for (let k = 1 + ((r() * 8) | 0); k > 0; k--) out[(r() * n) | 0] ^= 1 << ((r() * 8) | 0); return out; }
  if (pick === 1) return out.slice(0, (r() * n) | 0);
  if (pick === 2) { const at = (r() * n) | 0; const len = Math.min(n - at, 1 + ((r() * 64) | 0)); out.fill(r() < 0.5 ? 0xff : 0, at, at + len); return out; }
  if (pick === 3) { const at = (r() * n) | 0; const len = Math.min(n - at, 1 + ((r() * 2000) | 0)); const ins = out.slice(at, at + len); const res = new Uint8Array(n + len); res.set(out.slice(0, at)); res.set(ins, at); res.set(out.slice(at), at + len); return res; }
  if (pick === 4) { const at = (r() * n) | 0; const len = Math.min(n - at, 1 + ((r() * 500) | 0)); return Uint8Array.from([...out.slice(0, at), ...out.slice(at + len)]); }
  const at = (r() * n) | 0; // ecrase par des entiers extremes (tailles, compteurs)
  const vals = [0xff, 0x7f, 0x80, 0x00];
  for (let k = 0; k < 4 && at + k < n; k++) out[at + k] = vals[(r() * 4) | 0];
  return out;
}

/** Mutations textuelles (XML / texte) : nesting profond, nombres extremes, unicode, troncature, DOCTYPE, duplication. */
function textMutate(s, r) {
  const pick = (r() * 11) | 0;
  const at = (r() * (s.length + 1)) | 0;
  const tags = [...s.matchAll(/<([A-Za-z][\w:.-]*)[ >]/g)];
  const tag = tags.length ? tags[(r() * tags.length) | 0][1] : 'a';
  switch (pick) {
    case 0: return s.slice(0, at);
    case 1: return s.replace(/-?\d+(\.\d+)?/, () => NUMS[(r() * NUMS.length) | 0]);
    case 2: { const k = 1 + ((r() * 4) | 0); let o = s; for (let i = 0; i < k; i++) o = o.replace(/="[^"]*"/, () => `="${NUMS[(r() * NUMS.length) | 0]}"`); return o; }
    case 3: { const depth = [200, 3000, 60000][(r() * 3) | 0]; return s.slice(0, at) + `<${tag}>`.repeat(depth) + s.slice(at); }
    case 4: return s.slice(0, at) + UNI[(r() * UNI.length) | 0] + s.slice(at);
    case 5: return s.replace(/<\/[^>]+>/, '');
    case 6: { const m = tags.length ? s.indexOf('<' + tag) : -1; if (m < 0) return s; const end = s.indexOf('>', m); return s.slice(0, m) + s.slice(m, end + 1).repeat(1 + ((r() * 3000) | 0)) + s.slice(end + 1); }
    case 9: case 10: { // imbrication EQUILIBREE tres profonde ou tres large (XML valide)
      const m = tags.length ? tags[(r() * tags.length) | 0] : null; if (!m) return s;
      const open = s.indexOf('>', m.index) + 1; if (!open) return s;
      const depth = [500, 5000, 100000][(r() * 3) | 0];
      return pick === 9 ? s.slice(0, open) + `<${m[1]}>`.repeat(depth) + `</${m[1]}>`.repeat(depth) + s.slice(open) : s.slice(0, open) + `<${m[1]}/>`.repeat(depth * 5) + s.slice(open);
    }
    case 7: return s.replace(/^(<\?xml[^>]*\?>)?/, '$1<!DOCTYPE x [<!ENTITY a "&b;"><!ENTITY b "&a;">]>');
    default: { const i = (r() * s.length) | 0; return s.slice(0, i) + s.slice(i + ((r() * 200) | 0)); }
  }
}

// --- ZIP brut (permet doublons, `..`, noms enormes, que JSZip refuse d'ecrire) ---
export function rawZip(entries) {
  const parts = []; const central = []; let off = 0;
  for (const { name, data, stored } of entries) {
    const nm = Buffer.from(name, 'utf8'); const raw = Buffer.from(data);
    const body = stored ? raw : zlib.deflateRawSync(raw);
    const crc = zlib.crc32(raw) >>> 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(stored ? 0 : 8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    parts.push(h, nm, body);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(stored ? 0 : 8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm);
    off += h.length + nm.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

async function zipMutate(bytes, r) {
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch { return byteMutate(bytes, r); }
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  if (!names.length) return byteMutate(bytes, r);
  const files = await Promise.all(names.map(async (name) => ({ name, data: await zip.files[name].async('uint8array') })));
  const xmlIdx = files.map((f, i) => (/\.(xml|rels)$/i.test(f.name) ? i : -1)).filter((i) => i >= 0);
  const pick = (r() * 11) | 0;
  const any = () => files[(r() * files.length) | 0];
  const xml = () => files[xmlIdx.length ? xmlIdx[(r() * xmlIdx.length) | 0] : 0];
  switch (pick) {
    case 0: case 1: case 2: case 3: { const f = xml(); f.data = enc(textMutate(dec(f.data), r)); break; }
    case 4: files.splice((r() * files.length) | 0, 1); break; // entree manquante
    case 5: { const f = any(); files.push({ name: f.name, data: enc(dec(f.data) + '<x/>') }); break; } // doublon
    case 6: { const f = any(); f.name = ['../' + f.name, '..\\..\\evil.xml', '/abs/' + f.name, f.name.replace(/\//g, '/./'), 'C:' + f.name][(r() * 5) | 0]; break; }
    case 7: { const f = any(); f.name = 'n'.repeat([300, 60000][(r() * 2) | 0]) + '/' + f.name; break; }
    case 8: { // relation cyclique / autoreferente
      const f = files.find((g) => g.name.endsWith('.rels'));
      if (f) f.data = enc(dec(f.data).replace(/Target="[^"]*"/g, `Target="${f.name.replace(/_rels\/(.*)\.rels$/, '$1') || '.'}"`));
      else { const x = xml(); x.data = enc(textMutate(dec(x.data), r)); }
      break;
    }
    case 9: { const f = any(); f.data = byteMutate(f.data, r); break; }
    default: { const f = xml(); f.data = enc(dec(f.data).replace(/<\/[^>]+>\s*$/, '')); break; }
  }
  if (r() < 0.15) files.push({ name: files[0].name + '.bomb', data: new Uint8Array(r() < 0.5 ? 40 * 1024 * 1024 : 300 * 1024 * 1024) }); // bombe de decompression
  const raw = rawZip(files);
  return r() < 0.1 ? byteMutate(raw, r) : raw;
}

// --- Fichiers d'exemple (comme apps/web/tests/e2e/prepare.ts, un peu plus riches) ---
async function seeds() {
  const md = '# Titre\n\nTexte **gras** *italique* [lien](https://exemple.org) `code`.\n\n- a\n  - b\n1. un\n2. deux\n\n> citation\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x=1\n```\n\n![img](data:image/png;base64,AAAA)\n';
  const doc = D.readMarkdown(md).document;
  const csv = 'Produit;Quantite;Prix\nPommes;10;1,5\nPoires;20;2,25\n"a;""b";=1+1;"multi\nligne"\n';
  const wb = X.readCsv(csv);
  const deck = P.createBlankDeck('standard', { titleSlide: false });
  const s1 = P.addSlide(deck, 'layout1');
  const t0 = s1.shapes[0];
  if (t0 && t0.kind === 'shape') t0.text = { props: {}, paragraphs: P.paragraphsFromText('Diapo titre') };
  P.addTextBox(P.addSlide(deck, 'layout7'), { x: 72, y: 72, width: 300, height: 40 }, 'Seconde diapo');
  const pub = blank('a4');
  addText(pub.deck.slides[0].shapes, [100, 150, 300, 60], 'Publication');
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 300]).drawText('Page PDF', { x: 40, y: 200, size: 24 });
  const html = '<html><head><style>p{color:#f00;margin:1e3px}</style></head><body><h1>T</h1><p style="font-size:12pt">a <b>b</b> <a href="http://x">l</a></p><table><tr><td>1<td>2</table><ul><li>a<li>b</ul><img src="data:image/png;base64,AAAA"></body></html>';
  return {
    docx: [await D.writeDocx(doc)], odt: [await D.writeOdt(doc)], rtf: [D.writeRtf(doc)], html: [enc(html)], md: [enc(md)],
    xlsx: [await X.writeXlsx(wb)], ods: [await X.writeOds(wb)], csv: [enc(csv)],
    pptx: [await P.writePptx(deck)], odp: [await P.writeOdp(deck)], fopub: [await writeFopub(pub)],
    pdf: [await pdf.save()],
    json: [enc('{"a":[1,2,{"b":null}],"c":"x"}')],
    opml: [enc('<?xml version="1.0"?><opml version="2.0"><body><outline text="a"><outline text="b"/></outline></body></opml>')],
    ipynb: [enc('{"cells":[{"cell_type":"markdown","source":["# a"]},{"cell_type":"code","source":["x=1"],"outputs":[]}],"metadata":{}}')],
    yaml: [enc('a: 1\nb:\n  - x\n  - {c: d}\n')], toml: [enc('a = 1\n[t]\nb = "x"\n')],
  };
}

const fx = (p) => new Uint8Array(readFileSync(new URL(`../../packages/${p}`, import.meta.url)));
export async function targets() {
  const S = await seeds();
  // Vrais fichiers de reference des tests (Word 97, Excel 97, PowerPoint 97, ODF, chiffres) en plus des fichiers ecrits par la suite.
  const REAL = {
    docx: ['docx/tests/fixtures/word-fr-styles.docx', 'opc/tests/fixtures/word-agile.docx'], doc: ['docx/tests/fixtures/word97-rich.doc'],
    xlsx: ['xlsx/tests/fixtures/excel-pivots.xlsx', 'opc/tests/fixtures/excel-agile.xlsx'], ods: ['xlsx/tests/fixtures/excel-features.ods'],
    xls: ['xlsx/tests/fixtures/excel-features.xls', 'xlsx/tests/fixtures/excel2024.xls'],
    pptx: ['pptx/tests/fixtures/slides.pptx', 'pptx/tests/fixtures/powerpoint-smartart.pptx'], odp: ['pptx/tests/fixtures/slides.odp'],
    ppt: ['pptx/tests/fixtures/legacy.ppt', 'pptx/tests/fixtures/powerpoint97-format.ppt'],
  };
  for (const [k, list] of Object.entries(REAL)) S[k] = [...(S[k] ?? []), ...list.map(fx)];
  const T = (kind, seed, run) => ({ kind, seeds: S[seed], run });
  return {
    docx: T('zip', 'docx', (b) => D.readDocx(b)),
    odt: T('zip', 'odt', (b) => D.readOdt(b)),
    rtf: T('text', 'rtf', (b) => D.readRtf(b)),
    html: T('text', 'html', (b) => D.readHtml(b)),
    md: T('text', 'md', (b) => D.readMarkdown(b)),
    doc: T('byte', 'doc', (b) => D.readDoc(b)),
    docfmt: T('zip', 'docx', (b) => D.readDocument(b, 'a.docx')),
    xlsx: T('zip', 'xlsx', (b) => X.readXlsx(b)),
    ods: T('zip', 'ods', (b) => X.readOds(b)),
    xls: T('byte', 'xls', (b) => X.readXls(b)),
    csv: T('text', 'csv', (b) => X.readCsv(b)),
    pptx: T('zip', 'pptx', (b) => P.readPptx(b)),
    odp: T('zip', 'odp', (b) => P.readOdp(b)),
    ppt: T('byte', 'ppt', (b) => P.readPpt(b)),
    fopub: T('zip', 'fopub', (b) => readFopub(b)),
    pdflib: T('byte', 'pdf', (b) => analyze(b)),
    pdfjs: T('byte', 'pdf', async (b) => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = pdfjs.getDocument({ data: b.slice(), enableXfa: false, isEvalSupported: false, verbosity: 0 });
      try { const d = await task.promise; const p = await d.getPage(1); await p.getTextContent(); await p.getAnnotations(); await d.getOutline(); } finally { await task.destroy(); }
    }),
    json: T('text', 'json', (b) => jsonToWorkbook(dec(b))),
    opml: T('text', 'opml', (b) => opmlToMarkdown(dec(b))),
    ipynb: T('text', 'ipynb', (b) => notebookToMarkdown(dec(b))),
    yaml: T('text', 'yaml', (b) => parseYaml(dec(b))),
    toml: T('text', 'toml', (b) => parseToml(dec(b))),
  };
}

/** Cas i d'une cible : octets mutes, deterministes. Le cas 0 est le fichier valide (temoin). */
export async function makeCase(t, targetName, seed, i) {
  const r = rng(hash(targetName, seed, i));
  const n0 = t.seeds.length;
  if (i < n0) return t.seeds[i]; // temoins : les fichiers valides non modifies
  let b = t.seeds[i % n0];
  const n = 1 + (r() < 0.2 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    if (t.kind === 'zip' && k === 0 && r() < 0.85) b = await zipMutate(b, r);
    else if (t.kind === 'text' && r() < 0.6) b = enc(textMutate(dec(b), r));
    else b = byteMutate(b, r);
  }
  return b;
}
