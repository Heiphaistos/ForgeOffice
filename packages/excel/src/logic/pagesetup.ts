// Mise en page (sans DOM, testee) : tailles de papier Excel, codes d'en-tete/pied de page (&P, &N, &D...) avec leur forme
// affichee en francais (&[Page]...), listes predefinies, texte des plages (zone d'impression, titres a imprimer).
import { MAX_COLS, MAX_ROWS, columnIndex, columnName, parseRange, rangeName, type CellRange, type PageSetup } from '@forgeoffice/xlsx';

// ---------------------------------------------------------------- Papier

export interface PaperSize {
  /** Code Excel (`pageSetup@paperSize`). */
  id: number;
  label: string;
  /** Dimensions en millimetres, portrait. */
  w: number;
  h: number;
}

export const PAPER_SIZES: readonly PaperSize[] = [
  { id: 1, label: 'Lettre', w: 215.9, h: 279.4 },
  { id: 3, label: 'Tabloïd', w: 279.4, h: 431.8 },
  { id: 5, label: 'Légal', w: 215.9, h: 355.6 },
  { id: 6, label: 'Relevé', w: 139.7, h: 215.9 },
  { id: 7, label: 'Exécutif', w: 184.2, h: 266.7 },
  { id: 8, label: 'A3', w: 297, h: 420 },
  { id: 9, label: 'A4', w: 210, h: 297 },
  { id: 11, label: 'A5', w: 148, h: 210 },
  { id: 12, label: 'B4 (JIS)', w: 250, h: 353 },
  { id: 13, label: 'B5 (JIS)', w: 182, h: 257 },
  { id: 14, label: 'Folio', w: 215.9, h: 330.2 },
  { id: 15, label: 'Quarto', w: 215, h: 275 },
  { id: 16, label: '25,4 x 35,56 cm', w: 254, h: 355.6 },
  { id: 20, label: 'Enveloppe n° 10', w: 104.8, h: 241.3 },
  { id: 27, label: 'Enveloppe DL', w: 110, h: 220 },
  { id: 28, label: 'Enveloppe C5', w: 162, h: 229 },
  { id: 30, label: 'Enveloppe C4', w: 229, h: 324 },
  { id: 34, label: 'Enveloppe B5', w: 176, h: 250 },
  { id: 66, label: 'A2', w: 420, h: 594 },
  { id: 70, label: 'A6', w: 105, h: 148 },
];

const A4 = PAPER_SIZES.find((p) => p.id === 9) as PaperSize;
export const paperById = (id: number | undefined): PaperSize => PAPER_SIZES.find((p) => p.id === id) ?? A4;
const cm = (mm: number): string => String(Math.round(mm) / 10).replace('.', ',');
export const paperLabel = (p: PaperSize): string => `${p.label} (${cm(p.w)} x ${cm(p.h)} cm)`;

/** Taille de la page en pixels (96 ppp), orientation comprise. */
export function pageDims(ps: Pick<PageSetup, 'paperSize' | 'orientation'>): { w: number; h: number } {
  const p = paperById(ps.paperSize);
  const w = Math.round((p.w / 25.4) * 96);
  const h = Math.round((p.h / 25.4) * 96);
  return ps.orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

// ---------------------------------------------------------------- Marges predefinies

export interface MarginPreset { id: 'normal' | 'wide' | 'narrow'; left: number; top: number; header: number }
export const MARGIN_PRESETS: readonly MarginPreset[] = [
  { id: 'normal', left: 0.7, top: 0.75, header: 0.3 },
  { id: 'wide', left: 1, top: 1, header: 0.5 },
  { id: 'narrow', left: 0.25, top: 0.75, header: 0.3 },
];
export const marginsOf = (m: MarginPreset): PageSetup['margins'] => ({ left: m.left, right: m.left, top: m.top, bottom: m.top, header: m.header, footer: m.header });
const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
export function marginPresetOf(m: PageSetup['margins']): MarginPreset['id'] | null {
  for (const p of MARGIN_PRESETS) {
    const v = marginsOf(p);
    if (same(m.left, v.left) && same(m.right, v.right) && same(m.top, v.top) && same(m.bottom, v.bottom) && same(m.header, v.header) && same(m.footer, v.footer)) return p.id;
  }
  return null;
}

// ---------------------------------------------------------------- En-tetes et pieds de page

/** Valeurs des champs d'un en-tete / pied de page. */
export interface HfContext {
  page: number;
  pages: number;
  now: Date;
  file: string;
  path: string;
  sheet: string;
}

export interface HfRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: 'single' | 'double';
  strike?: boolean;
  sup?: boolean;
  sub?: boolean;
  /** Points. */
  size?: number;
  font?: string;
  /** RRGGBB. */
  color?: string;
}

export interface HfSections { left: HfRun[]; center: HfRun[]; right: HfRun[] }

const pad2 = (n: number): string => String(n).padStart(2, '0');
export const hfDate = (d: Date): string => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const hfTime = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function fieldText(code: string, c: HfContext): string {
  switch (code) {
    case 'P': return String(c.page);
    case 'N': return String(c.pages);
    case 'D': return hfDate(c.now);
    case 'T': return hfTime(c.now);
    case 'F': return c.file;
    case 'Z': return c.path;
    case 'A': return c.sheet;
    default: return '';
  }
}

type RunStyle = Omit<HfRun, 'text'>;

/** Decoupe un texte de codes Excel (« &LGauche&CCentre&RDroite ») en trois sections de segments mis en forme. */
export function parseHeaderFooter(raw: string, c: HfContext): HfSections {
  const out: HfSections = { left: [], center: [], right: [] };
  let section: keyof HfSections = 'center';
  let st: RunStyle = {};
  let buf = '';
  const flush = (): void => {
    if (buf) out[section].push({ text: buf, ...st });
    buf = '';
  };
  const restyle = (fn: (s: RunStyle) => void): void => {
    flush();
    const next = { ...st };
    fn(next);
    st = next;
  };
  const toggle = (key: 'bold' | 'italic' | 'strike' | 'sup' | 'sub'): void => restyle((s) => {
    if (s[key]) delete s[key];
    else s[key] = true;
  });
  const line = (kind: 'single' | 'double'): void => restyle((s) => {
    if (s.underline === kind) delete s.underline;
    else s.underline = kind;
  });
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] as string;
    if (ch !== '&') {
      buf += ch;
      continue;
    }
    const code = raw[++i];
    if (code === undefined) break;
    if (code === '&') buf += '&';
    else if (code === 'L') { flush(); section = 'left'; }
    else if (code === 'C') { flush(); section = 'center'; }
    else if (code === 'R') { flush(); section = 'right'; }
    else if ('PNDTFZA'.includes(code)) buf += fieldText(code, c);
    else if (code === 'B') toggle('bold');
    else if (code === 'I') toggle('italic');
    else if (code === 'S') toggle('strike');
    else if (code === 'X') toggle('sup');
    else if (code === 'Y') toggle('sub');
    else if (code === 'U') line('single');
    else if (code === 'E') line('double');
    else if (code === '"') {
      const end = raw.indexOf('"', i + 1);
      const spec = end < 0 ? raw.slice(i + 1) : raw.slice(i + 1, end);
      i = end < 0 ? raw.length : end;
      const [name, style = ''] = spec.split(',');
      const s = style.toLowerCase();
      restyle((n) => {
        if (name && name !== '-') n.font = name.trim();
        if (/gras|bold/.test(s)) n.bold = true;
        else if (/normal|regular|standard/.test(s)) delete n.bold;
        if (/ital/.test(s)) n.italic = true;
        else if (/normal|regular|standard|gras|bold/.test(s)) delete n.italic;
      });
    } else if (code === 'K') {
      const hex = raw.slice(i + 1, i + 7);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        restyle((n) => { n.color = hex.toUpperCase(); });
        i += 6;
      }
    } else if (code >= '0' && code <= '9') {
      let n = code;
      while (i + 1 < raw.length && /[0-9]/.test(raw[i + 1] as string) && n.length < 3) n += raw[++i];
      restyle((s) => { s.size = Math.min(409, Math.max(1, Number(n))); });
    }
    // &G (image) et codes inconnus : ignores
  }
  flush();
  return out;
}

/** Texte brut (sans mise en forme) d'un en-tete, pour les listes et tests. */
export function hfPlain(raw: string, c: HfContext): string {
  const s = parseHeaderFooter(raw, c);
  return [s.left, s.center, s.right].map((runs) => runs.map((r) => r.text).join('')).filter(Boolean).join(' | ');
}

/** Codes enregistres <-> forme affichee dans la boite (boutons « Insérer le numéro de page », etc.). */
export const HF_FIELDS: readonly { code: string; display: string }[] = [
  { code: 'P', display: 'Page' },
  { code: 'N', display: 'Pages' },
  { code: 'D', display: 'Date' },
  { code: 'T', display: 'Heure' },
  { code: 'Z', display: 'Chemin d’accès' },
  { code: 'F', display: 'Fichier' },
  { code: 'A', display: 'Onglet' },
];

/** `&P` -> `&[Page]` (les autres codes et « && » restent tels quels). */
export function hfToDisplay(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] as string;
    if (ch !== '&') {
      out += ch;
      continue;
    }
    const code = raw[i + 1];
    const field = HF_FIELDS.find((f) => f.code === code);
    if (field) out += `&[${field.display}]`;
    else out += code === undefined ? '&' : `&${code}`;
    i++;
  }
  return out;
}

/** `&[Page]` -> `&P`. */
export function hfFromDisplay(text: string): string {
  return text.replace(/&\[([^\]]*)\]/g, (m, name: string) => {
    const field = HF_FIELDS.find((f) => f.display.toLowerCase() === name.trim().toLowerCase());
    return field ? `&${field.code}` : m;
  });
}

/** Trois zones <-> chaine de codes (« &L...&C...&R... »). */
export function hfJoin(left: string, center: string, right: string): string {
  return `${left ? `&L${left}` : ''}${center ? `&C${center}` : ''}${right ? `&R${right}` : ''}`;
}
export function hfSplit(raw: string | undefined): { left: string; center: string; right: string } {
  const parts = { left: '', center: '', right: '' };
  let cur: keyof typeof parts = 'center';
  const src = raw ?? '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (ch === '&') {
      const code = src[i + 1];
      if (code === 'L' || code === 'C' || code === 'R') {
        cur = code === 'L' ? 'left' : code === 'C' ? 'center' : 'right';
        i++;
        continue;
      }
      if (code !== undefined) {
        parts[cur] += `&${code}`;
        i++;
        continue;
      }
    }
    parts[cur] += ch;
  }
  return parts;
}

/** En-tetes / pieds predefinis de la boite (codes enregistres). */
export const HF_PRESETS: readonly { id: string; label: string; raw: string }[] = [
  { id: 'none', label: '(aucun)', raw: '' },
  { id: 'page', label: 'Page 1', raw: '&CPage &P' },
  { id: 'pageOf', label: 'Page 1 sur ?', raw: '&CPage &P sur &N' },
  { id: 'sheet', label: 'Nom de l’onglet', raw: '&C&A' },
  { id: 'file', label: 'Nom du fichier', raw: '&C&F' },
  { id: 'confidential', label: 'Confidentiel, date, page', raw: '&LConfidentiel&C&D&RPage &P' },
  { id: 'fileSheet', label: 'Fichier, onglet, page', raw: '&L&F&C&A&RPage &P' },
  { id: 'path', label: 'Chemin d’accès et fichier', raw: '&C&Z&F' },
  { id: 'dateTime', label: 'Date et heure', raw: '&L&D&R&T' },
];

// ---------------------------------------------------------------- Plages de la boite Feuille

/** « A1:D12;F1:G5 » -> plages (separateurs « ; » ou « , »). Renvoie `null` si une partie est invalide, `[]` si vide. */
export function parsePrintAreaText(text: string): CellRange[] | null {
  const out: CellRange[] = [];
  for (const part of text.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
    const ref = part.includes('!') ? part.slice(part.lastIndexOf('!') + 1) : part;
    const r = parseRange(ref.replace(/\$/g, ''));
    if (!r) return null;
    out.push(r);
  }
  return out;
}
export const printAreaText = (areas: readonly CellRange[] | undefined): string => (areas ?? []).map((r) => rangeName(r, true)).join(';');

const lastPart = (text: string): string => {
  const t = text.trim();
  return (t.includes('!') ? t.slice(t.lastIndexOf('!') + 1) : t).replace(/\$/g, '');
};

/** « $1:$3 » ou « 2 » -> lignes a repeter ; `null` si invalide, `undefined` si vide. */
export function parseTitleRows(text: string): { first: number; last: number } | null | undefined {
  const t = lastPart(text);
  if (!t) return undefined;
  const m = t.match(/^(\d+)(?::(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]) - 1;
  const b = Number(m[2] ?? m[1]) - 1;
  if (a < 0 || b < 0 || a >= MAX_ROWS || b >= MAX_ROWS) return null;
  return { first: Math.min(a, b), last: Math.max(a, b) };
}
export const titleRowsText = (t: { first: number; last: number } | undefined): string => (t ? `$${t.first + 1}:$${t.last + 1}` : '');

/** « $A:$B » ou « C » -> colonnes a repeter. */
export function parseTitleCols(text: string): { first: number; last: number } | null | undefined {
  const t = lastPart(text).toUpperCase();
  if (!t) return undefined;
  const m = t.match(/^([A-Z]{1,3})(?::([A-Z]{1,3}))?$/);
  if (!m) return null;
  const a = columnIndex(m[1] as string);
  const b = columnIndex((m[2] ?? m[1]) as string);
  if (a >= MAX_COLS || b >= MAX_COLS) return null;
  return { first: Math.min(a, b), last: Math.max(a, b) };
}
export const titleColsText = (t: { first: number; last: number } | undefined): string => (t ? `$${columnName(t.first)}:$${columnName(t.last)}` : '');

// ---------------------------------------------------------------- Ajustement

/** Valeurs d'ajustement lues avec les defauts Excel (absent = 1 page, 0 = automatique). */
export const fitOf = (ps: Pick<PageSetup, 'fitToWidth' | 'fitToHeight'>): { w: number; h: number } => ({ w: ps.fitToWidth ?? 1, h: ps.fitToHeight ?? 1 });

/** Modification de Largeur (`w`) ou Hauteur (`h`) du groupe Mise a l'echelle : 0 = automatique ; les deux a 0 = ajustement desactive. */
export function fitPatch(ps: Pick<PageSetup, 'fitToPage' | 'fitToWidth' | 'fitToHeight'>, dim: 'w' | 'h', n: number): Pick<PageSetup, 'fitToPage' | 'fitToWidth' | 'fitToHeight'> {
  const cur = ps.fitToPage ? fitOf(ps) : { w: 0, h: 0 };
  const next = { ...cur, [dim]: n };
  if (next.w === 0 && next.h === 0) return { fitToPage: false };
  return { fitToPage: true, fitToWidth: next.w, fitToHeight: next.h };
}
