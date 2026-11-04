// Verification de la conception (sans DOM) : texte debordant, images en basse resolution, objets hors de la page,
// polices absentes, zones de texte vides.
import { deckTheme, resolveThemeFont, type Deck, type Shape } from '@forgeoffice/pptx';
import { shapeKey } from './model.ts';

export type IssueKind = 'overflow' | 'lowres' | 'offpage' | 'font' | 'emptyBox';

export interface Issue {
  kind: IssueKind;
  /** Identifiant de la page (diapositive) et indice (0 = page 1). */
  page: number;
  pageIndex: number;
  shapeId: number;
  shapeName: string;
  /** Resolution effective (ppp) ou nom de police. */
  detail?: string;
}

/** Taille en pixels d'une image PNG, JPEG ou GIF (lecture de l'en-tete). */
export function imagePixels(bytes: Uint8Array): { width: number; height: number } | null {
  const u32 = (i: number): number => ((bytes[i] ?? 0) << 24 | (bytes[i + 1] ?? 0) << 16 | (bytes[i + 2] ?? 0) << 8 | (bytes[i + 3] ?? 0)) >>> 0;
  const u16 = (i: number): number => ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { width: u32(16), height: u32(20) };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { width: (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8), height: (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1] ?? 0;
      const len = u16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: u16(i + 7), height: u16(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

/** Seuil d'Office pour l'impression : en dessous de 150 ppp l'image parait floue. */
export const MIN_PRINT_DPI = 150;

export interface CheckOptions {
  /** Zones dont le texte deborde (cles `page:forme`). */
  overflow: ReadonlySet<string>;
  /** Police disponible sur le poste ? */
  fontAvailable: (name: string) => boolean;
  /** Fond perdu : un objet qui deborde de la page dans cette limite est voulu. */
  bleed: number;
  /** Zones d'un article (une zone de suite vide n'est pas une erreur). */
  chained?: ReadonlySet<string>;
}

function walk(shapes: readonly Shape[], visit: (s: Shape) => void): void {
  for (const s of shapes) {
    visit(s);
    if (s.kind === 'group') walk(s.children, visit);
  }
}

function fontsOf(shape: Shape): string[] {
  const out: string[] = [];
  const bodies = shape.kind === 'shape' ? [shape.text] : shape.kind === 'table' ? shape.table.rows.flatMap((r) => r.cells.map((c) => c.text)) : [];
  for (const b of bodies) for (const p of b?.paragraphs ?? []) for (const r of p.runs) if (r.props.font) out.push(r.props.font);
  return out;
}

export function checkDesign(deck: Deck, options: CheckOptions): Issue[] {
  const theme = deckTheme(deck);
  const issues: Issue[] = [];
  const fontsSeen = new Set<string>();
  const { width, height } = deck.size;
  deck.slides.forEach((slide, pageIndex) => {
    const base = { page: slide.id, pageIndex };
    walk(slide.shapes, (s) => {
      const item = { ...base, shapeId: s.id, shapeName: s.name };
      if (options.overflow.has(shapeKey(slide.id, s.id))) issues.push({ kind: 'overflow', ...item });
      const x = s.xfrm;
      if (x && !s.hidden) {
        const out = x.x + x.width <= 0 || x.y + x.height <= 0 || x.x >= width || x.y >= height;
        const b = options.bleed + 0.5;
        const beyond = x.x < -b || x.y < -b || x.x + x.width > width + b || x.y + x.height > height + b;
        if (out || beyond) issues.push({ kind: 'offpage', ...item });
      }
      if (s.kind === 'picture' && x) {
        const media = deck.media[s.mediaId];
        const px = media && imagePixels(media.bytes);
        if (px && !s.svgMediaId) {
          const crop = s.crop ?? { left: 0, right: 0, top: 0, bottom: 0 };
          const visibleW = px.width * (1 - (crop.left + crop.right) / 100);
          const visibleH = px.height * (1 - (crop.top + crop.bottom) / 100);
          const dpi = Math.min(visibleW / (x.width / 72), visibleH / (x.height / 72));
          if (dpi < MIN_PRINT_DPI) issues.push({ kind: 'lowres', ...item, detail: String(Math.round(dpi)) });
        }
      }
      if (s.kind === 'shape' && s.textBox && !s.text?.paragraphs.some((p) => p.runs.some((r) => r.type !== 'text' || r.text.trim() !== ''))) {
        if (!options.chained?.has(shapeKey(slide.id, s.id))) issues.push({ kind: 'emptyBox', ...item });
      }
      for (const raw of fontsOf(s)) {
        const font = resolveThemeFont(raw, theme) ?? raw;
        if (fontsSeen.has(font)) continue;
        fontsSeen.add(font);
        if (!options.fontAvailable(font)) issues.push({ kind: 'font', ...item, detail: font });
      }
    });
  });
  return issues;
}
