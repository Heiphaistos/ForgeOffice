// Signature numerique PDF (adbe.pkcs7.detached) : champ de signature + dictionnaire /Sig avec reserve /Contents,
// /ByteRange calcule sur le fichier enregistre, empreinte puis CMS inseres a la place de la reserve.
// Limite connue : le fichier est reecrit en entier (pas de mise a jour incrementale) ; les signatures deja presentes deviennent invalides.
import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, StandardFonts, type PDFRef } from '@cantoo/pdf-lib';
import { color, n, safe } from '../appearance.ts';
import { geomOf } from '../geom.ts';
import { screenFrame, toPdfRect, type Rect } from '../model.ts';
import { buildSignedData, digest as hashOf, hashForKey, parseCert } from './cms.ts';
import { hex } from './der.ts';
import { parsePkcs12 } from './pkcs12.ts';

export interface SignOptions {
  pfx: Uint8Array;
  password: string;
  reason?: string;
  location?: string;
  /** Page (0-based) et rectangle affiche (normalise) d'une signature visible ; absent = signature invisible. */
  page?: number;
  rect?: Rect;
  now?: Date;
}

/** Octets reserves au CMS (marge pour la variation de taille d'une signature ECDSA). */
const MARGIN = 160;
const BYTERANGE_PLACEHOLDER = 9_999_999_999;

function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  const first = needle[0] ?? 0;
  for (let i = hay.indexOf(first, from); i >= 0; i = hay.indexOf(first, i + 1)) {
    let k = 1;
    while (k < needle.length && hay[i + k] === needle[k]) k++;
    if (k === needle.length) return i;
  }
  return -1;
}

const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** Signe le PDF avec le certificat PKCS#12 ; retourne le nouveau fichier. */
export async function signPdf(bytes: Uint8Array, o: SignOptions): Promise<Uint8Array> {
  const p12 = await parsePkcs12(o.pfx, o.password);
  const hash = hashForKey(p12.key);
  const signer = parseCert(p12.certs[0] as Uint8Array);
  const now = o.now ?? new Date();
  const trial = await buildSignedData({ digest: new Uint8Array(hash === 'SHA-256' ? 32 : hash === 'SHA-384' ? 48 : 64), hash, key: p12.key, certs: p12.certs, signingTime: now });
  const reserve = trial.length + MARGIN;

  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const sig = doc.context.obj({
    Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, BYTERANGE_PLACEHOLDER, BYTERANGE_PLACEHOLDER, BYTERANGE_PLACEHOLDER],
    Contents: PDFHexString.of('0'.repeat(reserve * 2)), M: PDFString.fromDate(now), Name: PDFHexString.fromText(signer.commonName),
    ...(o.reason ? { Reason: PDFHexString.fromText(o.reason) } : {}), ...(o.location ? { Location: PDFHexString.fromText(o.location) } : {}),
  });
  const sigRef = doc.context.register(sig);

  const page = doc.getPage(o.rect ? Math.min(Math.max(o.page ?? 0, 0), doc.getPageCount() - 1) : 0);
  const g = geomOf(page);
  let rect = [0, 0, 0, 0];
  const widget: Record<string, unknown> = { Type: 'Annot', Subtype: 'Widget', FT: 'Sig', F: 132, P: page.ref, V: sigRef };
  if (o.rect) {
    rect = toPdfRect(o.rect, g);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const f = screenFrame(o.rect, g);
    const size = Math.max(6, Math.min(10, f.h / 4));
    const date = now.toLocaleString('fr-FR');
    const lines = [`Signé numériquement par ${signer.commonName}`, `Date : ${date}`, ...(o.reason ? [`Motif : ${o.reason}`] : [])];
    const text = lines.map((l, i) => `BT /Helv ${n(size)} Tf 0 g 3 ${n(f.h - size * (i + 1.3))} Td ${font.encodeText(safe(font, l)).toString()} Tj ET`).join('\n');
    const body = `q ${f.matrix.map(n).join(' ')} cm\n${color('#185ABD', 'RG')} 1 w 0.5 0.5 ${n(f.w - 1)} ${n(f.h - 1)} re S\n${text}\nQ`;
    const stream = doc.context.stream(body, { Type: 'XObject', Subtype: 'Form', BBox: [...rect], Resources: doc.context.obj({ Font: { Helv: font.ref } }) });
    widget.AP = { N: doc.context.register(stream) };
  }
  const form = doc.getForm();
  const taken = new Set(form.getFields().map((f) => f.getName()));
  let k = 1;
  while (taken.has(`Signature${k}`)) k++;
  const widgetRef: PDFRef = doc.context.register(doc.context.obj({ ...widget, Rect: rect, T: PDFString.of(`Signature${k}`) }));
  page.node.addAnnot(widgetRef);
  form.acroForm.addField(widgetRef);
  form.acroForm.dict.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  const out = await doc.save({ useObjectStreams: false });

  const holder = ascii(`<${'0'.repeat(reserve * 2)}>`);
  const start = indexOf(out, holder);
  if (start < 0) throw new Error('Signature : réserve introuvable dans le fichier écrit.');
  const end = start + holder.length;
  const brKey = findBefore(out, ascii('/ByteRange'), start);
  if (brKey < 0) throw new Error('Signature : /ByteRange introuvable.');
  const open = out.indexOf(0x5b, brKey);
  const close = out.indexOf(0x5d, open);
  const range = `[0 ${start} ${end} ${out.length - end}]`;
  const room = close - open + 1;
  if (range.length > room) throw new Error('Signature : /ByteRange trop long.');
  out.set(ascii(range.padEnd(room, ' ')), open);

  const digest = await hashOf(hash, out.subarray(0, start), out.subarray(end));
  const cms = await buildSignedData({ digest, hash, key: p12.key, certs: p12.certs, signingTime: now });
  if (cms.length > reserve) throw new Error('Signature : réserve trop petite.');
  out.set(ascii(hex(cms).toUpperCase().padEnd(reserve * 2, '0')), start + 1);
  return out;
}

/** Derniere occurrence de `needle` avant `before`. */
function findBefore(hay: Uint8Array, needle: Uint8Array, before: number): number {
  for (let i = before - needle.length; i >= 0; i--) {
    let k = 0;
    while (k < needle.length && hay[i + k] === needle[k]) k++;
    if (k === needle.length) return i;
  }
  return -1;
}
