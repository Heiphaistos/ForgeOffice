// Ruban mobile (sans DOM) : bande defilante complete, schema des commandes, indicateurs de defilement, sections de la feuille « Toutes les commandes ».
import type { RibbonControl, RibbonGroup, RibbonTab } from '../ribbon-types.ts';
import { searchCommands, type CommandEntry } from './commands.ts';

/** Controle actionnable (tout sauf separateur et ligne : les lignes sont aplaties). */
export type ActionControl = Exclude<RibbonControl, { kind: 'separator' | 'row' }>;

/** Aplatit les lignes, retire separateurs et controles masques : ce qui reste est exactement ce que la bande doit montrer. */
export function flattenControls(controls: readonly RibbonControl[]): ActionControl[] {
  const out: ActionControl[] = [];
  for (const c of controls) {
    if (c.hidden || c.kind === 'separator') continue;
    if (c.kind === 'row') out.push(...flattenControls(c.controls));
    else out.push(c);
  }
  return out;
}

export interface BandGroup {
  id: string;
  label: string;
  controls: ActionControl[];
  launcher?: RibbonGroup['launcher'];
}

/** Groupes visibles d'un onglet, dans l'ordre, sans groupe vide. */
export function bandGroups(tab: RibbonTab): BandGroup[] {
  const out: BandGroup[] = [];
  for (const g of tab.groups) {
    if (g.hidden) continue;
    const controls = flattenControls(g.controls);
    if (controls.length === 0 && !g.launcher) continue;
    out.push({ id: g.id, label: g.label, controls, launcher: g.launcher });
  }
  return out;
}

/** Identifiant de la cellule du lanceur de dialogue d'un groupe. */
export const launcherId = (groupId: string): string => `${groupId}:launcher`;

export interface SchemaControl {
  id: string;
  kind: string;
  label: string;
  disabled: boolean;
}
export interface SchemaGroup {
  id: string;
  label: string;
  controls: SchemaControl[];
}
export interface SchemaTab {
  id: string;
  label: string;
  contextual: boolean;
  groups: SchemaGroup[];
}

/** Schema serialisable du ruban (onglets visibles) : sert au test de couverture et a l'outil de conformite. */
export function ribbonSchema(tabs: readonly RibbonTab[]): SchemaTab[] {
  return tabs
    .filter((t) => !t.hidden)
    .map((t) => ({
      id: t.id,
      label: t.label,
      contextual: Boolean(t.contextual),
      groups: bandGroups(t).map((g) => ({
        id: g.id,
        label: g.label,
        controls: [
          ...g.controls.map((c) => ({ id: c.id, kind: c.kind, label: c.label, disabled: Boolean(c.disabled) })),
          ...(g.launcher ? [{ id: launcherId(g.id), kind: 'launcher', label: g.launcher.label, disabled: false }] : []),
        ],
      })),
    }));
}

/** Nombre de commandes d'un onglet du schema. */
export const countSchemaControls = (tab: SchemaTab): number => tab.groups.reduce((n, g) => n + g.controls.length, 0);

/** Decalages de calage (px) de chaque groupe, a partir de leurs bords gauches mesures dans la piste. */
export function snapOffsets(lefts: readonly number[], trackLeft: number, scrollLeft: number): number[] {
  return lefts.map((l) => Math.max(0, Math.round(l - trackLeft + scrollLeft)));
}

/** Groupe affiche en tete : le dernier dont le decalage est <= au defilement (+ tolerance). */
export function activeGroup(offsets: readonly number[], scrollLeft: number, tolerance = 24): number {
  let idx = 0;
  offsets.forEach((o, i) => {
    if (o <= scrollLeft + tolerance) idx = i;
  });
  return idx;
}

export interface ScrollEdges {
  more: { start: boolean; end: boolean };
  /** Position et largeur du curseur d'indicateur, en fraction (0..1) de la piste. */
  thumb: { left: number; width: number };
}
/** Ombres de defilement (du contenu existe de chaque cote) et curseur de position. */
export function scrollEdges(scrollLeft: number, clientWidth: number, scrollWidth: number, eps = 2): ScrollEdges {
  if (scrollWidth <= clientWidth + eps || scrollWidth <= 0) return { more: { start: false, end: false }, thumb: { left: 0, width: 1 } };
  const width = Math.max(0.08, clientWidth / scrollWidth);
  const left = Math.min(1 - width, scrollLeft / scrollWidth);
  return { more: { start: scrollLeft > eps, end: scrollLeft + clientWidth < scrollWidth - eps }, thumb: { left: Math.max(0, left), width } };
}

export interface CommandSection {
  title: string;
  entries: CommandEntry[];
}
/**
 * Contenu de la feuille « Toutes les commandes » : sans requete, toutes les commandes groupees par chemin (onglet > groupe) dans
 * l'ordre du ruban ; avec requete, une seule section de resultats classes par pertinence.
 */
export function commandSections(commands: readonly CommandEntry[], query: string, resultLabel = ''): CommandSection[] {
  const q = query.trim();
  if (q) {
    const found = searchCommands(commands, q, commands.length);
    return found.length ? [{ title: resultLabel, entries: found }] : [];
  }
  const sections: CommandSection[] = [];
  const byPath = new Map<string, CommandSection>();
  const seen = new Set<string>();
  for (const e of commands) {
    const key = `${e.path}|${e.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const top = e.path.split(' > ').slice(0, 2).join(' > ');
    let s = byPath.get(top);
    if (!s) {
      s = { title: top, entries: [] };
      byPath.set(top, s);
      sections.push(s);
    }
    s.entries.push(e);
  }
  return sections;
}
