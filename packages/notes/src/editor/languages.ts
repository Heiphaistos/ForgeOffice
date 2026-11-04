// Coloration syntaxique : tous les langages de @codemirror/language-data + ceux de WinNote qui y manquent.
import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language';
import { languages as DATA } from '@codemirror/language-data';
import { S } from '../strings.ts';

const legacy = (load: () => Promise<StreamParser<unknown>>) => async (): Promise<LanguageSupport> => new LanguageSupport(StreamLanguage.define(await load()));

const EXTRA: readonly LanguageDescription[] = [
  // Markdown avec coloration des blocs de code de tous les langages.
  LanguageDescription.of({
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mkd', 'mdx'],
    load: async () => {
      const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown');
      return markdown({ base: markdownLanguage, codeLanguages: DATA });
    },
  }),
  LanguageDescription.of({ name: 'Batch', extensions: ['bat', 'cmd'], load: legacy(async () => (await import('./modes.ts')).batch) }),
  LanguageDescription.of({ name: 'Makefile', extensions: ['mk', 'mak'], filename: /^(?:GNU)?makefile$/i, load: legacy(async () => (await import('./modes.ts')).makefile) }),
  LanguageDescription.of({ name: 'Nim', extensions: ['nim', 'nims'], load: legacy(async () => (await import('./modes.ts')).nim) }),
  LanguageDescription.of({ name: 'Zig', extensions: ['zig'], load: legacy(async () => (await import('./modes.ts')).zig) }),
  LanguageDescription.of({ name: 'Solidity', extensions: ['sol'], load: legacy(async () => (await import('./modes.ts')).solidity) }),
  LanguageDescription.of({
    name: 'GLSL / HLSL',
    extensions: ['glsl', 'frag', 'vert', 'comp', 'hlsl', 'fx', 'shader'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/clike')).shader),
  }),
  LanguageDescription.of({
    name: 'GDScript',
    extensions: ['gd'],
    load: async () => (await import('@codemirror/lang-python')).python(),
  }),
  LanguageDescription.of({
    name: 'INI / Config',
    extensions: ['ini', 'inf', 'env', 'editorconfig', 'gitconfig', 'desktop', 'cfg', 'conf', 'properties'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/properties')).properties),
  }),
];

const EXTRA_NAMES = new Set(EXTRA.map((l) => l.name));

/** Tous les langages proposes (WinNote d'abord pour Markdown et INI, puis language-data). */
export const LANGUAGES: readonly LanguageDescription[] = [...EXTRA, ...DATA.filter((l) => !EXTRA_NAMES.has(l.name))];

/** Extensions de WinNote que language-data rattache mal ou pas du tout. */
const ALIASES: Readonly<Record<string, string>> = {
  txt: '', log: '', text: '',
  jsonc: 'JSON', json5: 'JSON', geojson: 'JSON', webmanifest: 'JSON',
  sty: 'LaTeX', cls: 'LaTeX', bib: 'LaTeX',
  asm: 'Gas', nasm: 'Gas', inc: 'Gas',
  bas: 'VBScript', vba: 'VBScript',
  svelte: 'HTML', xhtml: 'HTML', asp: 'HTML', aspx: 'HTML',
  xslt: 'XML', xaml: 'XML', csproj: 'XML', vcxproj: 'XML', props: 'XML', targets: 'XML', plist: 'XML', rss: 'XML', atom: 'XML', manifest: 'XML',
  pyi: 'Python', zsh: 'Shell', profile: 'Shell', bashrc: 'Shell',
  rake: 'Ruby', gemspec: 'Ruby', ru: 'Ruby', rmd: 'R', lhs: 'Haskell', f03: 'Fortran', tk: 'Tcl', di: 'D',
  pp: 'Pascal', dpr: 'Pascal', lpr: 'Pascal', cu: 'C++', h: 'C++',
};

export function languageByName(name: string | null): LanguageDescription | null {
  if (!name) return null;
  return LANGUAGES.find((l) => l.name === name) ?? null;
}

/** Langage d'un fichier d'apres son nom ; null = texte brut. */
export function languageForFile(fileName: string): LanguageDescription | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (ext in ALIASES) return languageByName(ALIASES[ext] ?? '');
  return LanguageDescription.matchFilename(LANGUAGES, base);
}

/** Noms pour le selecteur de langage, texte brut en tete. */
export function languageNames(): string[] {
  const names = LANGUAGES.map((l) => l.name).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  return [S.plainText, ...names];
}
