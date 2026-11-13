// Insertion en colonne : modele {n} (compteur) ou {n:depart,pas}, et indentation visible (guides).

/** Texte a inserer sur la ligne `i` (0 = premiere) : `{n}` = compteur (depart 1), `{n:depart,pas}` = compteur regle. */
export function columnText(spec: string, i: number): string {
  let out = '';
  let rest = spec;
  for (;;) {
    const p = rest.indexOf('{n');
    if (p < 0) return out + rest;
    out += rest.slice(0, p);
    const after = rest.slice(p + 2);
    const end = after.indexOf('}');
    if (end < 0) return out + rest.slice(p);
    const args = after.startsWith(':') ? after.slice(1, end).split(',').map((x) => Number.parseInt(x.trim(), 10)) : [];
    const start = Number.isFinite(args[0]) ? (args[0] as number) : 1;
    const step = Number.isFinite(args[1]) ? (args[1] as number) : 1;
    out += String(start + step * i);
    rest = after.slice(end + 1);
  }
}

/** Insere `spec` a la colonne `col` (en caracteres) de chaque ligne ; les lignes plus courtes sont completees par des espaces. */
export function columnInsert(lines: readonly string[], col: number, spec: string): string[] {
  return lines.map((line, i) => {
    const padded = line.length < col ? line + ' '.repeat(col - line.length) : line;
    return padded.slice(0, col) + columnText(spec, i) + padded.slice(col);
  });
}

/** Largeur en colonnes du retrait d'une ligne (tabulation = prochain taquet). */
export function indentWidth(line: string, tabSize: number): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width++;
    else if (ch === '\t') width += tabSize - (width % tabSize);
    else break;
  }
  return width;
}
