// Pagination calculee (sans DOM) : a partir des hauteurs mesurees des blocs et des lignes, place les sauts de page.
// Coordonnees « naturelles » : flux continu en pixels, sans les espaces inseres par la pagination elle-meme.

export interface FlowLine {
  /** Haut de la ligne (ou de la rangee de tableau). */
  y: number;
  h: number;
  /** Position ProseMirror du debut de la ligne. */
  pos: number;
  /** Saut de page manuel juste avant cette ligne. */
  forced?: boolean;
}

export interface FlowBlock {
  /** Position ProseMirror avant le bloc. */
  pos: number;
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
}

export interface PageGeometry {
  /** Hauteur utile d'une page (hors marges haute et basse). */
  contentHeight: number;
  /** Distance entre le haut de deux zones de texte successives (page + intervalle). */
  stride: number;
}

const EPS = 0.5;

/** Calcule les sauts de page. Les blocs plus hauts qu'une page et indivisibles debordent (comme une image geante dans Word). */
export function paginate(blocks: readonly FlowBlock[], g: PageGeometry): Pagination {
  const H = Math.max(10, g.contentHeight);
  const gaps: PageGap[] = [];
  const pageStarts = [0];
  let start = 0;
  const newPage = (y: number, pos: number, at: PageGap['at']): void => {
    gaps.push({ pos, height: Math.max(0, g.stride - (y - start)), at });
    start = y;
    pageStarts.push(y);
  };
  const fits = (bottom: number): boolean => bottom - start <= H + EPS;
  const firstLineBottom = (b: FlowBlock): number => {
    const first = b.keepLines ? undefined : b.lines?.()[0];
    return first ? first.y + first.h : b.bottom;
  };

  blocks.forEach((b, i) => {
    if (b.breakBefore && b.top > start + EPS) newPage(b.top, b.pos, 'block');
    const next = blocks[i + 1];
    // Solidaire du suivant : si le debut du bloc suivant ne tient plus, le bloc passe avec lui.
    if (b.keepNext && next && !next.breakBefore && fits(b.bottom) && !fits(firstLineBottom(next)) && b.top > start + EPS && firstLineBottom(next) - b.top <= H) {
      newPage(b.top, b.pos, 'block');
    }
    if (fits(b.bottom) && !b.hasForced) return;
    const lines = b.lines?.() ?? [];
    if (!lines.length) {
      if (b.top > start + EPS) newPage(b.top, b.pos, 'block');
      return;
    }
    if (b.keepLines && !b.hasForced && b.bottom - b.top <= H) {
      if (b.top > start + EPS) newPage(b.top, b.pos, 'block');
      return;
    }
    const widow = b.widowControl !== false && b.split === 'line';
    for (let k = 0; k < lines.length; k++) {
      const line = lines[k]!;
      const over = line.y + line.h - start > H + EPS;
      if (!(over || line.forced) || line.y <= start + EPS) continue;
      let at = k;
      if (!line.forced && widow) {
        // Orpheline : une seule ligne resterait en bas de page -> tout le paragraphe passe a la page suivante.
        if (k === 1) at = 0;
        // Veuve : une seule ligne passerait seule en haut de page -> on en emporte une de plus.
        else if (k === lines.length - 1 && k >= 2 && lines[k - 1]!.y > start + EPS) at = k - 1;
      }
      if (at === 0 && b.top > start + EPS) newPage(b.top, b.pos, 'block');
      else if (at === 0) newPage(line.y, line.pos, b.split ?? 'line');
      else newPage(lines[at]!.y, lines[at]!.pos, b.split ?? 'line');
      // Lignes deja emportees par la coupure : on reprend apres elles.
      k = Math.max(k, at);
    }
  });
  return { gaps, pageCount: pageStarts.length, pageStarts };
}

/** Page (0..n-1) d'une ordonnee naturelle. */
export function pageOf(p: Pagination, y: number): number {
  let page = 0;
  for (let i = 0; i < p.pageStarts.length; i++) if (p.pageStarts[i]! <= y + EPS) page = i;
  return page;
}

/** Egalite de deux jeux d'espaces (pour ne redessiner que si la pagination change). */
export function sameGaps(a: readonly PageGap[], b: readonly PageGap[]): boolean {
  return a.length === b.length && a.every((x, i) => {
    const y = b[i]!;
    return x.pos === y.pos && x.at === y.at && Math.abs(x.height - y.height) < 1;
  });
}

/** Geometrie de page en pixels CSS (96 ppp) a partir des dimensions Word en points. */
export function pageGeometry(page: { height: number; marginTop: number; marginBottom: number }, gapPx: number): PageGeometry & { pageHeight: number } {
  const px = (pt: number): number => (pt * 4) / 3;
  const pageHeight = px(page.height);
  return { pageHeight, contentHeight: px(page.height - page.marginTop - page.marginBottom), stride: pageHeight + gapPx };
}
