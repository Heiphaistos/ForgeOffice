// Outils de base de donnees : Documentation (documentateur imprimable) et Analyse des performances.
import { useEffect, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { analyzeSchema } from '../logic/analyze.ts';
import { S } from '../strings.ts';
import type { Relation, RequeteEnregistree, SchemaTable } from '../types.ts';
import type { ViewProps } from './view-types.ts';

interface Doc {
  tables: SchemaTable[];
  vues?: SchemaTable[];
  requetes?: RequeteEnregistree[];
  relations?: Relation[];
  objets?: { genre: string; nom: string; contenu: unknown }[];
}

function useDoc({ db, ctx }: Pick<ViewProps, 'db' | 'ctx'>): Doc | null {
  const [doc, setDoc] = useState<Doc | null>(null);
  useEffect(() => {
    db.call<Doc>('documenter').then(setDoc, ctx.fail);
  }, [db, ctx]);
  return doc;
}

export function DocView({ db, ctx, register }: ViewProps) {
  const doc = useDoc({ db, ctx });
  useEffect(() => {
    register({ print: () => ctx.services.print() });
  });
  if (!doc) return <div className="acc-empty">{S.ds.loading}</div>;
  const relations = doc.relations ?? [...new Map(doc.tables.flatMap((t) => t.relations).map((r) => [r.nom, r])).values()];
  const queries = doc.requetes ?? (doc.objets ?? []).filter((o) => o.genre === 'requete').map((o) => ({ ...(o.contenu as RequeteEnregistree), nom: o.nom }));
  return (
    <div className="acc-preview fo-scroll">
      <div className="acc-rpage acc-doc">
        <h1>{S.tools.docTitle}</h1>
        {doc.tables.map((t) => (
          <section key={t.nom}>
            <h2><Icon name="table" size={20} /> {t.nom}</h2>
            <p className="acc-muted">{S.tools.records} : {t.nb_lignes}{t.proprietes.description ? ` — ${t.proprietes.description}` : ''}</p>
            <table>
              <thead><tr><th>{S.tools.key}</th><th>{S.tools.fields}</th><th>{S.tools.type}</th><th>{S.tools.size}</th><th>{S.tools.props}</th></tr></thead>
              <tbody>
                {t.champs.map((c) => (
                  <tr key={c.nom}>
                    <td>{c.cle_primaire ? <Icon name="key" size={16} /> : null}</td>
                    <td>{c.nom}</td>
                    <td>{c.libelle_type}</td>
                    <td>{c.proprietes.taille ?? ''}</td>
                    <td>
                      {[c.proprietes.requis ? S.td.required : '', c.proprietes.valide_si ? `${S.td.validation} ${c.proprietes.valide_si}` : '', c.proprietes.valeur_defaut ? `${S.td.default} ${c.proprietes.valeur_defaut}` : '', c.proprietes.indexe && c.proprietes.indexe !== 'non' ? S.td.indexed : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {relations.length > 0 && (
          <section>
            <h2><Icon name="database_link" size={20} /> {S.tools.relations}</h2>
            <ul>
              {relations.map((r) => (
                <li key={r.nom}>
                  {r.table_parent}.{r.champs_parent.join(', ')} → {r.table_enfant}.{r.champs_enfant.join(', ')}
                  {r.integrite ? ` — ${S.rel.integrity}` : ''}
                  {r.suppression === 'cascade' ? ` · ${S.rel.cascadeDelete}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
        {queries.length > 0 && (
          <section>
            <h2><Icon name="database_search" size={20} /> {S.tools.queries}</h2>
            {queries.map((q) => (
              <div key={q.nom} className="acc-doc__query">
                <strong>{q.nom}</strong>
                {q.sql && <pre>{q.sql}</pre>}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

export function AnalysisView({ db, ctx, register }: ViewProps) {
  const doc = useDoc({ db, ctx });
  useEffect(() => {
    register({ print: () => ctx.services.print() });
  });
  if (!doc) return <div className="acc-empty">{S.ds.loading}</div>;
  const relations = doc.relations ?? doc.tables.flatMap((t) => t.relations);
  const items = analyzeSchema(doc.tables, relations);
  return (
    <div className="acc-analysis fo-scroll">
      <h2>{S.tools.analysisTitle}</h2>
      {items.length === 0 ? (
        <p><Icon name="checkmark" size={16} /> {S.tools.noIssue}</p>
      ) : (
        <ul>
          {items.map((t, i) => (
            <li key={i}><Icon name="lightbulb" size={16} /> <span>{t}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
