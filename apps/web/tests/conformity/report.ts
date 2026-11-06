// Rapports de conformite (Markdown) a partir des lignes de resultat. Pur : teste par node:test.
import { VERDICTS, defects, isWorking, tally, workingRate, type Row, type Verdict } from './logic.ts';

export const MODULE_NAMES: Record<string, string> = {
  word: 'Texte', excel: 'Tableur', powerpoint: 'Présentation', publisher: 'Publication', notes: 'Bloc-notes', pdf: 'PDF', convert: 'Convertisseur', access: 'Base de données',
};

const pct = (x: number): string => `${(x * 100).toFixed(1).replace('.', ',')} %`;

/** Pourquoi la ligne est consideree comme un defaut. */
export function problem(r: Row): string {
  const parts: string[] = [];
  if (r.verdict !== 'EFFET_DOCUMENT' && r.verdict !== 'EFFET_UI') parts.push(r.verdict);
  if (r.expectation) parts.push(`valeur attendue absente : ${r.expectation}`);
  if (r.toggleBack === false) parts.push('la bascule ne revient pas a l\'etat initial');
  if (r.cancelOk === false) parts.push('Echap / Annuler casse l\'etat');
  return parts.join(' ; ');
}

function repro(module: string, r: Row): string {
  const where = r.path.join(' > ');
  return `Ouvrir « ?app=${module} » avec le document de test, préparer la sélection « ${r.context ?? '-'} », cliquer ${where}.`;
}

export function moduleReport(module: string, rows: readonly Row[], meta: { seconds: number; mobile: boolean }): string {
  const t = tally(rows);
  const bad = defects(rows);
  const lines: string[] = [];
  lines.push(`# Conformité : ${MODULE_NAMES[module] ?? module}${meta.mobile ? ' (mobile 390x844, toucher)' : ''}`, '');
  lines.push(`Commandes testées : **${rows.length}** en ${Math.round(meta.seconds)} s. Taux de commandes fonctionnelles : **${pct(workingRate(rows))}** `
    + '(EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).', '');
  lines.push('| Classe | Nombre |', '|---|---|');
  for (const v of VERDICTS) lines.push(`| ${v} | ${t[v]} |`);
  lines.push('', `Défauts à corriger : **${bad.length}** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).`, '');
  const tabs = [...new Set(bad.map((r) => r.tab))];
  for (const tab of tabs) {
    const list = bad.filter((r) => r.tab === tab);
    lines.push(`## Onglet ${list[0]?.path[0] ?? tab} (${list.length})`, '');
    for (const r of list) {
      lines.push(`- **${r.path.slice(1).join(' > ')}** (\`${r.id}\`, ${r.type}) : ${problem(r)}`);
      if (r.detail) lines.push(`  - ${r.detail}`);
      lines.push(`  - Reproduire : ${repro(module, r)}`);
      if (r.capture) lines.push(`  - Capture : \`captures/${module}/${r.capture}\``);
    }
    lines.push('');
  }
  const ui = rows.filter((r) => r.dialog);
  if (ui.length) {
    lines.push(`## Boîtes de dialogue exercées (${ui.length})`, '');
    lines.push('| Commande | Boîte | Effet sur le document après validation |', '|---|---|---|');
    for (const r of ui) lines.push(`| ${r.path.slice(1).join(' > ')} | ${r.dialog} | ${r.dialogEffect ? 'oui' : 'non'} |`);
    lines.push('');
  }
  const plat = rows.filter((r) => r.verdict === 'EXIGE_PLATEFORME');
  if (plat.length) {
    lines.push(`## Exige la plateforme (${plat.length}, non compté comme échec)`, '');
    for (const r of plat) lines.push(`- ${r.path.join(' > ')} : ${r.detail}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function summaryReport(modules: Record<string, { rows: Row[]; seconds: number }>, mobile: boolean): string {
  const lines: string[] = ['# Conformité des commandes : résumé' + (mobile ? ' (mobile)' : ''), ''];
  lines.push('| Module | Testées | EFFET_DOCUMENT | EFFET_UI | AUCUN_EFFET | ERREUR | DESACTIVEE | EXIGE_PLATEFORME | INACCESSIBLE | NON_TESTE | SANS_OBJET | Défauts | Taux fonctionnel |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  let total = 0; let ok = 0; let denom = 0;
  for (const [m, { rows }] of Object.entries(modules)) {
    const t = tally(rows);
    const testable = rows.filter((r) => r.verdict !== 'NON_TESTE' && r.verdict !== 'EXIGE_PLATEFORME' && r.verdict !== 'SANS_OBJET');
    total += rows.length; denom += testable.length; ok += testable.filter(isWorking).length;
    lines.push(`| ${MODULE_NAMES[m] ?? m} | ${rows.length} | ${t.EFFET_DOCUMENT} | ${t.EFFET_UI} | ${t.AUCUN_EFFET} | ${t.ERREUR} | ${t.DESACTIVEE} | ${t.EXIGE_PLATEFORME} | ${t.INACCESSIBLE} | ${t.NON_TESTE} | ${t.SANS_OBJET} | ${defects(rows).length} | ${pct(workingRate(rows))} |`);
  }
  lines.push('', `Total : ${total} commandes, taux fonctionnel global ${pct(denom ? ok / denom : 1)}.`, '');
  lines.push('Détail par module : `<module>.md` et `<module>.json`. Définition des classes et mode d\'emploi : `docs/CONFORMITE.md`.', '');
  return lines.join('\n');
}

export function topDefects(rows: readonly Row[], n: number): Row[] {
  const rank: Record<Verdict, number> = { ERREUR: 0, INACCESSIBLE: 1, AUCUN_EFFET: 2, DESACTIVEE: 3, EFFET_DOCUMENT: 4, EFFET_UI: 4, EXIGE_PLATEFORME: 5, NON_TESTE: 6, SANS_OBJET: 6 };
  return [...defects(rows)].sort((a, b) => rank[a.verdict] - rank[b.verdict]).slice(0, n);
}
