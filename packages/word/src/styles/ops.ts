// Operations pures sur les styles du document (modifier, supprimer, noms uniques).
import type { Style, WordDocument } from '@forgeoffice/docx';
import { styleDisplayName } from '@forgeoffice/docx';

/** Remplace un style (champs fusionnes) ; un champ `undefined` du patch est retire. */
export function updateStyle(meta: WordDocument, id: string, patch: Partial<Style>): WordDocument {
  return { ...meta, styles: { ...meta.styles, styles: meta.styles.styles.map((s) => (s.id === id ? { ...s, ...patch } : s)) } };
}

/** Seuls les styles crees par l'utilisateur se suppriment (comme Word : les styles integres se masquent). */
export const canDelete = (s: Style): boolean => s.custom === true && !s.isDefault;

/** Supprime un style ; ceux qui en dependent heritent de son parent. */
export function removeStyle(meta: WordDocument, id: string): WordDocument {
  const gone = meta.styles.styles.find((s) => s.id === id);
  if (!gone || !canDelete(gone)) return meta;
  const styles = meta.styles.styles.filter((s) => s.id !== id).map((s) => {
    const next = { ...s };
    if (s.basedOn === id) next.basedOn = gone.basedOn;
    if (s.next === id) next.next = s.id;
    return next;
  });
  return { ...meta, styles: { ...meta.styles, styles } };
}

/** Vrai si un autre style porte deja ce nom d'affichage. */
export function nameTaken(meta: WordDocument, name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase();
  return meta.styles.styles.some((s) => s.id !== exceptId && styleDisplayName(s).toLowerCase() === key);
}
