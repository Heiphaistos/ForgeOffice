// Indentation par langage (comme WinNote) : « Automatique » suit les habitudes du langage, ou largeur / tabulation imposee.

export type IndentChoice = 'auto' | '2' | '4' | '8' | 'tab';
export const INDENT_CHOICES: readonly IndentChoice[] = ['auto', '2', '4', '8', 'tab'];

export interface IndentStyle {
  /** Largeur d'un niveau (et d'une tabulation affichee). */
  size: number;
  /** Vrai : une tabulation par niveau ; faux : `size` espaces. */
  tabs: boolean;
}

const TWO = new Set([
  'JavaScript', 'TypeScript', 'JSX', 'TSX', 'JSON', 'YAML', 'HTML', 'XML', 'CSS', 'SCSS', 'Sass', 'Less', 'Ruby', 'Dart', 'Lua', 'Shell', 'TOML', 'Markdown',
  'Vue', 'Svelte', 'Angular Template', 'Elixir', 'Clojure', 'Haskell', 'OCaml',
]);
const FOUR_TABS = new Set(['Go', 'Makefile']);
const FOUR_SPACES = new Set([
  'Python', 'Rust', 'C#', 'Java', 'Kotlin', 'Swift', 'Objective-C', 'C', 'C++', 'Zig', 'Solidity', 'Protobuf', 'GDScript', 'Nim', 'PowerShell', 'SQL', 'PHP', 'Scala', 'Perl',
]);

/** Style habituel d'un langage ; texte brut et langages inconnus : tabulations (largeur `fallback`, la reglage de largeur de l'utilisateur). */
export function languageIndent(language: string, fallback = 4): IndentStyle {
  if (TWO.has(language)) return { size: 2, tabs: false };
  if (FOUR_TABS.has(language)) return { size: 4, tabs: true };
  if (FOUR_SPACES.has(language)) return { size: 4, tabs: false };
  return { size: fallback, tabs: true };
}

export function indentStyle(choice: IndentChoice, language: string, fallback = 4): IndentStyle {
  switch (choice) {
    case 'auto': return languageIndent(language, fallback);
    case 'tab': return { size: languageIndent(language, fallback).size, tabs: true };
    default: return { size: Number(choice), tabs: false };
  }
}

/** Texte insere par la touche Tab sans selection : une tabulation, ou les espaces qui menent au taquet suivant. */
export function tabInsertion(style: IndentStyle, column: number): string {
  return style.tabs ? '\t' : ' '.repeat(style.size - (column % style.size));
}
