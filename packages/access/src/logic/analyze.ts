// Analyseur de tables (equivalent simplifie de « Analyser les performances » d'Access).
import { S } from '../strings.ts';
import type { Relation, SchemaTable } from '../types.ts';

/** Suggestions de conception, dans l'ordre des tables. */
export function analyzeSchema(tables: readonly SchemaTable[], relations: readonly Relation[]): string[] {
  const out: string[] = [];
  for (const t of tables.filter((x) => !x.est_vue)) {
    if (t.cle_primaire.length === 0) out.push(S.tools.noKey(t.nom));
    const linked = relations.some((r) => r.table_parent === t.nom || r.table_enfant === t.nom);
    if (!linked && tables.length > 1) out.push(S.tools.unrelated(t.nom));
    if (t.champs.length > 30) out.push(S.tools.manyFields(t.nom, t.champs.length));
    for (const c of t.champs) {
      if (c.type === 'texte_court' && (c.proprietes.taille ?? 255) >= 255 && !c.cle_primaire) out.push(S.tools.wideText(t.nom, c.nom));
    }
    for (const r of relations.filter((x) => x.table_enfant === t.nom)) {
      for (const f of r.champs_enfant) {
        const c = t.champs.find((x) => x.nom === f);
        const indexed = t.index.some((i) => i.champs[0]?.nom === f);
        if (c && !c.cle_primaire && !indexed && (c.proprietes.indexe ?? 'non') === 'non') out.push(S.tools.fkNotIndexed(t.nom, f));
      }
    }
  }
  return out;
}
