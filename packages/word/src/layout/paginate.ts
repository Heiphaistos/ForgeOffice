// Pagination calculee (sans DOM) : a partir des hauteurs mesurees des blocs et des lignes, place les sauts de page.
// Coordonnees « naturelles » : flux continu en pixels, sans les espaces inseres par la pagination elle-meme.

export interface FlowLine {
  /** Haut de la ligne (ou de la rangee de tableau). */
  y: number;
  h: number;
  /** Position ProseMirror du debut de la ligne (peut etre calculee a la demande : couteux). */
  readonly pos: number;
  /** Identite stable pendant que le document ne change pas (compare deux jeux d'espaces sans resoudre les positions). */
  key?: string;
  /** Saut de page manuel juste avant cette ligne. */
  forced?: boolean;
}

export interface FlowBlock {
  /** Position ProseMirror avant le bloc. */
  pos: number;
  key?: string;
  top: number;
  bottom: number;
  /** Saut de page avant (saut manuel, « saut de page avant », fin de section precedente). */
  breakBefore?: boolean;
  /** Paragraphe solidaire du suivant (titres). */
  keepNext?: boolean;
  /** Lignes solidaires (ne pas couper le paragraphe). */
  keepLines?: boolean;
  /** Eviter veuves et orphelines (defaut : vrai). */
  widowControl?: boolean;
  /** Contient un saut de page manuel : les lignes sont toujours examinees. */
  hasForced?: boolean;
  /** Section du bloc (geometrie de page propre). */
  section?: number;
  /** Le bloc commence une section qui exige une page paire ou impaire (une page blanche est ajoutee au besoin). */
  parity?: 'even' | 'odd';
  /** Unites de coupure : lignes de paragraphe, rangees de tableau, blocs enfants. Calculees a la demande. */
  lines?: () => FlowLine[];
  /** Nature de la coupure dans le bloc : ligne de texte, rangee de tableau, bloc enfant. */
  split?: 'line' | 'row' | 'child';
}

export interface PageGap {
  /** Position d'insertion de l'espace. */
  pos: number;
  /** Hauteur de l'espace a inserer (pixels). */
  height: number;
  at: 'block' | 'line' | 'row' | 'child';
}

export interface Pagination {
  gaps: PageGap[];
  pageCount: number;
  /** Debut naturel (y) de chaque page. */
  pageStarts: number[];
  /** Section de chaque page (section du bloc qui l'ouvre). */
  pageSections: number[];
  /** Haut de chaque feuille (affichage, relatif a la premiere). */
  pageTops: number[];
}

export interface PageGeometry {
  /** Hauteur utile d'une page (hors marges haute et basse). */
  contentHeight: number;
  /** Distance entre le haut de deux feuilles successives (page + intervalle). */
  stride: number;
  /** Marge haute (px) : le texte de deux pages de marges differentes est decale d'autant. */
  top?: number;
}

/** Note de bas de page ancree dans le flux : sa hauteur est retiree de la zone de texte de la page qui porte l'appel. */
export interface FlowAnchor {
  y: number;
  h: number;
}

/** Espace du filet de separation des notes (px). */
export const NOTE_SEPARATOR = 10;

const EPS = 0.5;

/** Calcule les sauts de page. Les blocs plus hauts qu'une page et indivisibles debordent (comme une image geante dans Word). */
export function paginate(blocks: readonly FlowBlock[], geoms: PageGeometry | readonly PageGeometry[], anchors: readonly FlowAnchor[] = []): Pagination {
  const geomList: readonly PageGeometry[] = Array.isArray(geoms) ? geoms : [geoms as PageGeometry];
  const geomOf = (section: number | undefined): PageGeometry => geomList[Math.min(section ?? 0, geomList.length - 1)]!;
  let cur = geomOf(blocks[0]?.section);
  let H = Math.max(10, cur.contentHeight);
  const gaps: PageGap[] = [];
  const pageStarts = [0];
  const pageSections = [blocks[0]?.section ?? 0];
  const pageTops = [0];
  let start = 0;
  const newPage = (y: number, src: { readonly pos: number; key?: string }, at: PageGap['at'], b: FlowBlock, parity = false): void => {
    const section = b.section ?? pageSections[pageSections.length - 1] ?? 0;
    const next = geomOf(section);
    let height = Math.max(0, cur.stride - (y - start) + ((next.top ?? 0) - (cur.top ?? 0)));
    let top = pageTops[pageTops.length - 1]! + cur.stride;
    // Section en pages paires / impaires : une page blanche est inseree si la parite ne convient pas.
    if (parity && b.parity && ((pageStarts.length + 1) % 2 === 1) !== (b.parity === 'odd')) {
      height += next.stride;
      pageStarts.push(y);
      pageSections.push(section);
      pageTops.push(top);
      top += next.stride;
    }
    const gap: PageGap = { get pos(): number { return src.pos; }, height, at };
    if (src.key) gapKey.set(gap, src.key);
    gaps.push(gap);
    start = y;
    cur = next;
    H = Math.max(10, cur.contentHeight);
    pageStarts.push(y);
    pageSections.push(section);
    pageTops.push(top);
  };
  // Hauteur reservee en bas de page aux notes dont l'appel est entre `start` et `bottom`.
  const reserve = (bottom: number): number => {
    let sum = 0;
    for (const a of anchors) if (a.y >= start - EPS && a.y < bottom) sum += a.h;
    return sum ? sum + NOTE_SEPARATOR : 0;
  };
  const fits = (bottom: number): boolean => bottom - start + reserve(bottom) <= H + EPS;
  const firstLineBottom = (b: FlowBlock): number => {
    const first = b.keepLines ? undefined : b.lines?.()[0];
    return first ? first.y + first.h : b.bottom;
  };

  blocks.forEach((b, i) => {
    if (b.breakBefore && b.top > start + EPS) newPage(b.top, b, 'block', b, true);
    const next = blocks[i + 1];
    // Solidaire du suivant : si le debut du bloc suivant ne tient plus, le bloc passe avec lui.
    if (b.keepNext && next && !next.breakBefore && fits(b.bottom) && !fits(firstLineBottom(next)) && b.top > start + EPS && firstLineBottom(next) - b.top <= H) {
      newPage(b.top, b, 'block', b);
    }
    if (fits(b.bottom) && !b.hasForced) return;
    const lines = b.lines?.() ?? [];
    if (!lines.length) {
      if (b.top > start + EPS) newPage(b.top, b, 'block', b);
      return;
    }
    if (b.keepLines && !b.hasForced && b.bottom - b.top <= H) {
      if (b.top > start + EPS) newPage(b.top, b, 'block', b);
      return;
    }
    const widow = b.widowControl !== false && b.split === 'line';
    for (let k = 0; k < lines.length; k++) {
      const line = lines[k]!;
      const over = line.y + line.h - start + reserve(line.y + line.h) > H + EPS;
      if (!(over || line.forced) || line.y <= start + EPS) continue;
      let at = k;
      if (!line.forced && widow) {
        // Orpheline : une seule ligne resterait en bas de page -> tout le paragraphe passe a la page suivante.
        if (k === 1) at = 0;
        // Veuve : une seule ligne passerait seule en haut de page -> on en emporte une de plus.
        else if (k === lines.length - 1 && k >= 2 && lines[k - 1]!.y > start + EPS) at = k - 1;
      }
      if (at === 0 && b.top > start + EPS) newPage(b.top, b, 'block', b);
      else if (at === 0) newPage(line.y, line, b.split ?? 'line', b);
      else newPage(lines[at]!.y, lines[at]!, b.split ?? 'line', b);
      // Lignes deja emportees par la coupure : on reprend apres elles.
      k = Math.max(k, at);
    }
  });
  return { gaps, pageCount: pageStarts.length, pageStarts, pageSections, pageTops };
}

/** Page (0..n-1) d'une ordonnee naturelle. */
export function pageOf(p: Pagination, y: number): number {
  let page = 0;
  for (let i = 0; i < p.pageStarts.length; i++) if (p.pageStarts[i]! <= y + EPS) page = i;
  return page;
}

/** Egalite de deux jeux d'espaces (pour ne redessiner que si la pagination change). */
const gapKey = new WeakMap<PageGap, string>();

/** Espaces sous forme d'objets simples (positions resolues), a poser dans l'editeur ; l'identite est conservee pour sameGaps. */
export function materialize(gaps: readonly PageGap[]): PageGap[] {
  return gaps.map((g) => {
    const copy: PageGap = { pos: g.pos, height: g.height, at: g.at };
    const key = gapKey.get(g);
    if (key) gapKey.set(copy, key);
    return copy;
  });
}

export function sameGaps(a: readonly PageGap[], b: readonly PageGap[]): boolean {
  return a.length === b.length && a.every((x, i) => {
    const y = b[i]!;
    if (x.at !== y.at || Math.abs(x.height - y.height) >= 1) return false;
    const kx = gapKey.get(x);
    return kx !== undefined && kx === gapKey.get(y) ? true : x.pos === y.pos;
  });
}

/** Geometrie de page en pixels CSS (96 ppp) a partir des dimensions Word en points. */
export function pageGeometry(page: { height: number; marginTop: number; marginBottom: number }, gapPx: number): PageGeometry & { pageHeight: number } {
  const px = (pt: number): number => (pt * 4) / 3;
  const pageHeight = px(page.height);
  return { pageHeight, contentHeight: px(page.height - page.marginTop - page.marginBottom), stride: pageHeight + gapPx, top: px(page.marginTop) };
}
