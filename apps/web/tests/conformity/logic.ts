// Logique pure du banc de conformite : difference de snapshots, classification d'une commande, agregats. Testee par node:test.

export type Verdict =
  | 'EFFET_DOCUMENT' | 'EFFET_UI' | 'AUCUN_EFFET' | 'ERREUR' | 'DESACTIVEE' | 'EXIGE_PLATEFORME' | 'INACCESSIBLE' | 'NON_TESTE' | 'SANS_OBJET';

/** JSON a cles triees : deux modeles equivalents donnent la meme chaine. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    if (v instanceof Uint8Array) return `bytes(${v.length})`;
    return v;
  });
}

/** Chemins qui different entre deux snapshots (au plus `limit`). */
export function diffPaths(a: unknown, b: unknown, limit = 8, path = '$', out: string[] = []): string[] {
  if (out.length >= limit) return out;
  if (stable(a) === stable(b)) return out;
  const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object';
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    if (a.length !== b.length) out.push(`${path}.length ${a.length}->${b.length}`);
    for (let i = 0; i < n && out.length < limit; i++) diffPaths(a[i], b[i], limit, `${path}[${i}]`, out);
    return out;
  }
  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (out.length >= limit) break;
      diffPaths(a[k], b[k], limit, `${path}.${k}`, out);
    }
    return out;
  }
  out.push(`${path}: ${stable(a)?.slice(0, 60)} -> ${stable(b)?.slice(0, 60)}`);
  return out;
}

/** Forme canonique : une valeur absente, `false`, `null` ou un conteneur vide sont equivalents (une bascule rendue a « faux » = jamais appliquee). */
export function canon(v: unknown): unknown {
  if (Array.isArray(v)) {
    const items = v.map(canon);
    return items.every((x) => x === undefined) ? undefined : items;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, canon(x)] as const).filter(([, x]) => x !== undefined);
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
  }
  return v === false || v === null || v === undefined ? undefined : v;
}

/** Differences entre deux snapshots apres normalisation (`canon`) : sert au controle « deux executions = etat initial ». */
export const diffSemantic = (a: unknown, b: unknown, limit = 8): string[] => diffPaths(canon(a), canon(b), limit);

/** Snapshot separe en modele de document et etat d'interface (cle `ui`). */
export function splitSnapshot(snap: unknown): [unknown, unknown] {
  if (snap && typeof snap === 'object' && !Array.isArray(snap) && 'ui' in snap) {
    const { ui, ...rest } = snap as Record<string, unknown>;
    return [rest, ui];
  }
  return [snap, undefined];
}

export interface UiLike {
  dialogs: string[];
  popups: string[];
  toasts: string[];
  pressed: Record<string, string>;
  outside: Record<string, string>;
  tab: string;
  platform: Record<string, number>;
}

export interface UiDiff {
  dialogOpened: boolean;
  popupOpened: boolean;
  toast: string | null;
  pressedChanged: string[];
  outsideChanged: boolean;
  /** Regions de l'interface modifiees (les plus profondes). */
  regions: string[];
  platform: string[];
}

export function diffUi(before: UiLike, after: UiLike): UiDiff {
  const pressedChanged = Object.keys({ ...before.pressed, ...after.pressed }).filter((k) => before.pressed[k] !== after.pressed[k]);
  const changed = Object.keys({ ...before.outside, ...after.outside }).filter((k) => before.outside[k] !== after.outside[k]);
  // Les plus profondes seulement : une region parente change des qu'une fille change.
  const regions = changed.filter((k) => !changed.some((o) => o !== k && o.startsWith(`${k}>`)));
  const platform = Object.keys(after.platform).filter((k) => (after.platform[k] ?? 0) > (before.platform[k] ?? 0));
  return {
    dialogOpened: after.dialogs.some((d) => !before.dialogs.includes(d)) || after.dialogs.length > before.dialogs.length,
    popupOpened: after.popups.length > before.popups.length || after.popups.some((p) => !before.popups.includes(p)),
    toast: after.toasts.find((t) => !before.toasts.includes(t)) ?? null,
    pressedChanged,
    outsideChanged: regions.length > 0,
    regions,
    platform,
  };
}

export interface Observation {
  /** Etat du controle avant le clic. */
  disabled: boolean;
  /** Le controle a ete trouve dans le DOM et clique. */
  reached: boolean;
  /** Erreurs JS / rejets / console.error survenus pendant la commande. */
  errors: string[];
  docChanged: boolean;
  ui: UiDiff;
  /** Commandes qui n'ont pas d'effet voulu a cet endroit (annuler sans historique...). */
  expectDisabled?: boolean;
  /** Controle sans action dans le schema. */
  noHandler?: boolean;
  /** Controle de rendu libre ou hors perimetre. */
  untestable?: boolean;
  /** L'etat de l'interface du modele (cle `ui` du snapshot : outil arme, vue, volet, reglages) a change. */
  stateChanged?: boolean;
  /** Entree deja active (vue courante, zoom courant...) : aucun changement attendu. */
  alreadyActive?: boolean;
}

export interface Classification {
  verdict: Verdict;
  detail: string;
  /** Verdict a confirmer dans un autre contexte (selection) avant d'etre retenu. */
  retry: boolean;
}

export function classify(o: Observation): Classification {
  if (o.untestable) return { verdict: 'NON_TESTE', detail: 'controle de rendu libre', retry: false };
  if (o.errors.length > 0) return { verdict: 'ERREUR', detail: o.errors.slice(0, 3).join(' | '), retry: false };
  if (!o.reached) return { verdict: 'INACCESSIBLE', detail: o.noHandler ? 'sans action et introuvable dans le DOM' : 'controle introuvable dans le DOM malgre le contexte', retry: true };
  if (o.disabled) return o.expectDisabled ? { verdict: 'DESACTIVEE', detail: 'desactivee (attendu dans ce contexte)', retry: false } : { verdict: 'DESACTIVEE', detail: 'desactivee alors que le contexte etait prepare', retry: true };
  if (o.docChanged) return { verdict: 'EFFET_DOCUMENT', detail: '', retry: false };
  const u = o.ui;
  if (u.dialogOpened) return { verdict: 'EFFET_UI', detail: 'boite de dialogue', retry: false };
  if (u.popupOpened) return { verdict: 'EFFET_UI', detail: 'menu / liste / palette', retry: false };
  if (u.toast) return { verdict: 'EFFET_UI', detail: `notification : ${u.toast}`, retry: false };
  if (u.platform.length > 0) return { verdict: 'EXIGE_PLATEFORME', detail: u.platform.join(', '), retry: false };
  if (u.pressedChanged.length > 0 || u.outsideChanged) return { verdict: 'EFFET_UI', detail: u.pressedChanged.length ? 'etat de bascule' : `interface modifiee : ${u.regions.slice(0, 3).join(' ; ')}`, retry: false };
  if (o.stateChanged) return { verdict: 'EFFET_UI', detail: "état de l'interface (outil, vue, volet, réglage)", retry: false };
  if (o.alreadyActive) return { verdict: 'SANS_OBJET', detail: 'entrée déjà active : aucun changement attendu', retry: false };
  if (o.noHandler) return { verdict: 'AUCUN_EFFET', detail: 'element sans action dans le schema', retry: false };
  return { verdict: 'AUCUN_EFFET', detail: 'ni document, ni interface, ni plateforme', retry: true };
}

export interface Row {
  id: string;
  path: string[];
  label: string;
  type: string;
  verdict: Verdict;
  detail: string;
  context?: string;
  toggleBack?: boolean;
  cancelOk?: boolean;
  expectation?: string;
  dialog?: string;
  dialogEffect?: boolean;
  diff?: string[];
  tab: string;
  capture?: string;
}

export const VERDICTS: readonly Verdict[] = ['EFFET_DOCUMENT', 'EFFET_UI', 'AUCUN_EFFET', 'ERREUR', 'DESACTIVEE', 'EXIGE_PLATEFORME', 'INACCESSIBLE', 'NON_TESTE', 'SANS_OBJET'];

export function tally(rows: readonly Row[]): Record<Verdict, number> {
  const t = Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;
  for (const r of rows) t[r.verdict]++;
  return t;
}

/** Commande testee et fonctionnelle (effet constate ou plateforme requise, sans defaut associe). */
export function isWorking(r: Row): boolean {
  if (r.verdict === 'EFFET_DOCUMENT' || r.verdict === 'EFFET_UI') return r.toggleBack !== false && r.cancelOk !== false && r.expectation === undefined;
  return r.verdict === 'EXIGE_PLATEFORME' || r.verdict === 'SANS_OBJET' || isExpectedDisabled(r);
}

/** Desactivee dans le contexte prepare, et declaree normale par la configuration du module. */
export const isExpectedDisabled = (r: Row): boolean => r.verdict === 'DESACTIVEE' && r.detail.includes('attendu');

/** Taux de commandes fonctionnelles sur les commandes testables (NON_TESTE et EXIGE_PLATEFORME exclus du denominateur). */
export function workingRate(rows: readonly Row[]): number {
  const testable = rows.filter((r) => r.verdict !== 'NON_TESTE' && r.verdict !== 'EXIGE_PLATEFORME' && r.verdict !== 'SANS_OBJET' && !isExpectedDisabled(r));
  if (testable.length === 0) return 1;
  return testable.filter(isWorking).length / testable.length;
}

/** Defauts : tout ce qui n'est pas fonctionnel ni hors perimetre. */
export function defects(rows: readonly Row[]): Row[] {
  return rows.filter((r) => !isWorking(r) && r.verdict !== 'NON_TESTE' && !isExpectedDisabled(r));
}
