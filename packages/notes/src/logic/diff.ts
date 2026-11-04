// Comparaison ligne a ligne de deux textes (plus longue sous-suite commune).

export interface DiffRow {
  kind: 'same' | 'add' | 'del';
  /** Numero de ligne (1 = premiere) dans le texte de gauche / de droite, null si absente. */
  left: number | null;
  right: number | null;
  text: string;
}

/** Au-dela de ce produit de tailles, la partie centrale est montree en bloc supprime + ajoute. */
const MAX_CELLS = 16_000_000;

export function diffLines(a: readonly string[], b: readonly string[]): DiffRow[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const rows: DiffRow[] = [];
  for (let i = 0; i < start; i++) rows.push({ kind: 'same', left: i + 1, right: i + 1, text: a[i] ?? '' });
  const n = endA - start;
  const m = endB - start;
  if (n * m > MAX_CELLS) {
    // ponytail: pas de Myers O(ND) ; un tres gros ecart s'affiche en bloc, suffisant pour des notes.
    for (let i = start; i < endA; i++) rows.push({ kind: 'del', left: i + 1, right: null, text: a[i] ?? '' });
    for (let j = start; j < endB; j++) rows.push({ kind: 'add', left: null, right: j + 1, text: b[j] ?? '' });
  } else {
    const w = m + 1;
    const lcs = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * w + j] = a[start + i] === b[start + j] ? (lcs[(i + 1) * w + j + 1] ?? 0) + 1 : Math.max(lcs[(i + 1) * w + j] ?? 0, lcs[i * w + j + 1] ?? 0);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        rows.push({ kind: 'same', left: start + i + 1, right: start + j + 1, text: a[start + i] ?? '' });
        i++;
        j++;
      } else if (i < n && (j >= m || (lcs[(i + 1) * w + j] ?? 0) >= (lcs[i * w + j + 1] ?? 0))) {
        rows.push({ kind: 'del', left: start + i + 1, right: null, text: a[start + i] ?? '' });
        i++;
      } else {
        rows.push({ kind: 'add', left: null, right: start + j + 1, text: b[start + j] ?? '' });
        j++;
      }
    }
  }
  for (let k = 0; endA + k < a.length; k++) rows.push({ kind: 'same', left: endA + k + 1, right: endB + k + 1, text: a[endA + k] ?? '' });
  return rows;
}
