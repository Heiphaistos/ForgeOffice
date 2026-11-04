// Genere packages/ui/src/icons/generated.ts a partir de packages/ui/icons.json.
// Source : @fluentui/svg-icons (Fluent UI System Icons, licence MIT, Microsoft).
// Usage : node packages/ui/scripts/extract-icons.mjs   (echoue si un nom est introuvable)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(here, '..');
const repoRoot = resolve(uiRoot, '..', '..');
const iconsDir = join(repoRoot, 'node_modules', '@fluentui', 'svg-icons', 'icons');
const outFile = join(uiRoot, 'src', 'icons', 'generated.ts');

const VARIANTS = [
  ['20', 'regular'],
  ['20', 'filled'],
  ['24', 'regular'],
  ['24', 'filled'],
];

/** Extrait les attributs d="..." d'un SVG Fluent (une ou plusieurs balises <path>). */
function pathsOf(svg) {
  const paths = [];
  for (const match of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) paths.push(match[1]);
  if (/<(circle|rect|ellipse|polygon|g)\b/.test(svg)) throw new Error('forme SVG non geree');
  return paths.join('|');
}

const list = JSON.parse(readFileSync(join(uiRoot, 'icons.json'), 'utf8')).icons;
const names = [...new Set(list)].sort();
const missing = [];
const lines = [];
for (const name of names) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Nom d'icone invalide : ${name}`);
  const data = VARIANTS.map(([size, style]) => {
    const file = join(iconsDir, `${name}_${size}_${style}.svg`);
    return existsSync(file) ? pathsOf(readFileSync(file, 'utf8')) : '';
  });
  if (data.every((d) => d === '')) {
    missing.push(name);
    continue;
  }
  lines.push(`  ${name}: [${data.map((d) => JSON.stringify(d)).join(', ')}],`);
}

if (missing.length > 0) {
  console.error(`Icones introuvables dans @fluentui/svg-icons : ${missing.join(', ')}`);
  process.exit(1);
}

const kept = names.filter((n) => !missing.includes(n));
const out = `// GENERE par packages/ui/scripts/extract-icons.mjs a partir de packages/ui/icons.json : ne pas modifier.
// Fluent UI System Icons (c) Microsoft Corporation, licence MIT (voir THIRD_PARTY_NOTICES.md).
// Chaque icone : [20 regular, 20 filled, 24 regular, 24 filled] ; chemins SVG separes par « | » ; '' = absente.

export type IconName =
${kept.map((n) => `  | '${n}'`).join('\n')};

export const ICON_DATA: Readonly<Record<IconName, readonly [string, string, string, string]>> = {
${lines.join('\n')}
};
`;
writeFileSync(outFile, out);
console.log(`${kept.length} icones ecrites dans ${outFile}`);
