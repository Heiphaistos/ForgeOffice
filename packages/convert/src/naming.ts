// Noms de sortie saisis par l'utilisateur : validation sans DOM (teste). Le nom saisi est un radical ; l'extension est celle du format cible.

export const MAX_NAME_LENGTH = 120;
/** Noms de peripheriques reserves par Windows (avec ou sans extension). */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/;

export type NameCheck = { ok: true; stem: string } | { ok: false; reason: 'empty' | 'chars' | 'reserved' | 'dot' | 'long' };

/** Verifie un nom saisi. Une extension tapee a la main identique au format cible est retiree (« rapport.pdf » = « rapport »). */
export function checkOutputName(raw: string, target: string): NameCheck {
  let stem = raw.trim();
  const suffix = `.${target}`.toLowerCase();
  if (stem.toLowerCase().endsWith(suffix)) stem = stem.slice(0, -suffix.length).trimEnd();
  if (stem === '') return { ok: false, reason: 'empty' };
  if (FORBIDDEN.test(stem)) return { ok: false, reason: 'chars' };
  if (stem.endsWith('.') || stem.startsWith('.')) return { ok: false, reason: 'dot' };
  if (RESERVED.test(stem.split('.')[0] ?? '')) return { ok: false, reason: 'reserved' };
  if (stem.length > MAX_NAME_LENGTH) return { ok: false, reason: 'long' };
  return { ok: true, stem };
}
