// Disposition des colonnes de la feuille de donnees : largeurs, champs masques, ordre, champs figes (sans DOM, teste).

export interface ColLayout {
  /** Largeur en pixels par nom de champ (absente = largeur automatique). */
  widths: Record<string, number>;
  /** Champs masques. */
  hidden: string[];
  /** Ordre choisi (les champs absents suivent dans l'ordre de la table). */
  order: string[];
  /** Nombre de colonnes affichees figees a gauche. */
  frozen: number;
  /** Hauteur des lignes en pixels (absente = standard). */
  rowHeight?: number;
}

export const EMPTY_LAYOUT: ColLayout = { widths: {}, hidden: [], order: [], frozen: 0 };

export const MIN_WIDTH = 40;
export const MAX_WIDTH = 800;
const clamp = (w: number): number => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));

/** Indices des champs affiches, dans l'ordre d'affichage (masques exclus). */
export function displayOrder(names: readonly string[], layout: ColLayout): number[] {
  const known = layout.order.filter((n) => names.includes(n));
  const rest = names.filter((n) => !known.includes(n));
  return [...known, ...rest].filter((n) => !layout.hidden.includes(n)).map((n) => names.indexOf(n));
}

export const ROW_MIN = 16;
export const ROW_MAX = 120;

/** Hauteur de ligne bornee ; null revient a la hauteur standard. */
export function setRowHeight(layout: ColLayout, height: number | null): ColLayout {
  const next = { ...layout };
  delete next.rowHeight;
  return height === null ? next : { ...next, rowHeight: Math.max(ROW_MIN, Math.min(ROW_MAX, Math.round(height))) };
}

export const setWidth = (layout: ColLayout, name: string, width: number): ColLayout => ({ ...layout, widths: { ...layout.widths, [name]: clamp(width) } });

export function resetWidth(layout: ColLayout, name: string): ColLayout {
  const widths = { ...layout.widths };
  delete widths[name];
  return { ...layout, widths };
}

/** Masque un champ ; le dernier champ affiche ne peut pas etre masque. */
export function hideColumn(layout: ColLayout, names: readonly string[], name: string): ColLayout {
  if (layout.hidden.includes(name) || displayOrder(names, layout).length <= 1) return layout;
  const frozen = Math.min(layout.frozen, displayOrder(names, { ...layout, hidden: [...layout.hidden, name] }).length);
  return { ...layout, hidden: [...layout.hidden, name], frozen };
}

export const showColumn = (layout: ColLayout, name: string): ColLayout => ({ ...layout, hidden: layout.hidden.filter((n) => n !== name) });

export const showAll = (layout: ColLayout): ColLayout => ({ ...layout, hidden: [] });

/** Deplace le champ affiche `from` devant la position `to` (positions dans l'ordre d'affichage actuel). */
export function moveColumn(layout: ColLayout, names: readonly string[], from: number, to: number): ColLayout {
  const shown = displayOrder(names, layout).map((i) => names[i] ?? '');
  const moved = shown[from];
  if (moved === undefined || from === to || from + 1 === to) return layout;
  const without = shown.filter((_, i) => i !== from);
  const at = to > from ? to - 1 : to;
  without.splice(Math.max(0, Math.min(without.length, at)), 0, moved);
  // Les champs masques gardent leur place relative : on les ajoute apres.
  return { ...layout, order: [...without, ...layout.order.filter((n) => !without.includes(n))] };
}

/** Fige les `count` premieres colonnes affichees (0 = tout liberer). */
export const freezeColumns = (layout: ColLayout, names: readonly string[], count: number): ColLayout => ({
  ...layout, frozen: Math.max(0, Math.min(count, displayOrder(names, layout).length)),
});

/** Largeur qui contient l'en-tete et les valeurs (pixels) : 7 px par caractere + marges et fleche de menu. */
export function fitWidth(label: string, values: readonly string[], charPx = 7): number {
  const longest = Math.max(label.length + 3, ...values.map((v) => v.length));
  return clamp(longest * charPx + 16);
}

/** Decalage gauche (px) de chaque colonne figee ; `base` = largeur du selecteur d'enregistrement. */
export function stickyOffsets(widths: readonly number[], frozen: number, base: number): number[] {
  const out: number[] = [];
  let x = base;
  for (let i = 0; i < Math.min(frozen, widths.length); i++) {
    out.push(x);
    x += widths[i] ?? 0;
  }
  return out;
}

/** Colonnes d'une plage rectangulaire de cellules en texte tabule (collage dans Excel / Word). */
export function toTsv(rows: readonly (readonly string[])[]): string {
  const cell = (v: string): string => (/[\t\r\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join('\t')).join('\r\n');
}
