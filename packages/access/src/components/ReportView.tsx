// Etats : apercu avant impression (pages, regroupement, totaux de groupe et general) et mode Page/Creation.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { evalReportExpression, groupLabel, groupRows, paginate, reportLines, type ReportLine } from '../logic/report.ts';
import { displayValue } from '../logic/values.ts';
import { S } from '../strings.ts';
import type { Controle, Json, Maquette } from '../types.ts';
import { DesignCanvas, sectionHeight, type CanvasSel } from './DesignCanvas.tsx';
import { useMaquette, useRecords } from './FormView.tsx';
import type { ViewProps } from './view-types.ts';

const SECTIONS = ['entete_etat', 'entete_page', 'detail', 'pied_page', 'pied_etat'] as const;
const MARGIN = 48;

export function ReportView({ db, tab, ctx, register }: ViewProps) {
  const [m, setM] = useMaquette({ db, tab, ctx }, 'etat');
  const [serial, setSerial] = useState(0);
  const rec = useRecords({ db, ctx }, m?.source, serial);
  const [sel, setSel] = useState<CanvasSel | null>(null);
  const [dirty, setDirty] = useState(Boolean(tab.isNew));
  const design = tab.view === 'layout' || tab.view === 'design';
  const landscape = m?.orientation === 'paysage';
  const group = m?.regroupements?.[0]?.champ ?? null;

  useEffect(() => {
    if (dirty !== Boolean(tab.dirty)) ctx.patchTab(tab.id, { dirty });
  }, [dirty, tab.dirty, tab.id, ctx]);

  const change = (next: Maquette): void => {
    setM(next);
    setDirty(true);
  };

  const save = useCallback(async () => {
    if (!m) return;
    try {
      let nom = tab.name;
      if (tab.isNew) {
        const v = await ctx.prompt(S.dlg.saveAs, S.dlg.saveAsLabel(S.kinds.etat ?? ''), tab.name);
        if (!v) return;
        nom = v;
      }
      await db.call('enregistrer_objet', { genre: 'etat', nom, contenu: m, description: null });
      ctx.patchTab(tab.id, { name: nom, isNew: false, seed: undefined });
      setDirty(false);
      ctx.notify(S.reports.saved(nom), 'success');
      await ctx.refreshObjects();
    } catch (err) {
      ctx.fail(err);
    }
  }, [m, tab, ctx, db]);

  const setGroupBy = useCallback(async (field: string | null) => {
    if (!m) return;
    try {
      const next = await db.call<Maquette>('etat_instantane', { source: m.source, regroupement: field });
      change({ ...next, titre: m.titre, orientation: m.orientation });
    } catch (err) {
      ctx.fail(err);
    }
  }, [m, db, ctx]);

  useEffect(() => {
    register({
      save: db.readOnly ? undefined : () => void save(),
      print: () => ctx.services.print(),
      groupFields: rec?.columns ?? [],
      groupBy: group,
      setGroupBy: (f) => void setGroupBy(f),
      landscape,
      setLandscape: (on) => m && change({ ...m, orientation: on ? 'paysage' : 'portrait' }),
      refresh: () => setSerial((s) => s + 1),
    });
  });

  const pages = useMemo(() => {
    if (!m || !rec) return [];
    const rowH = Math.max(20, ...(m.sections.detail?.controles ?? []).map((c) => c.y + c.hauteur + 4));
    const pageH = landscape ? 794 : 1123;
    const fixed = sectionHeight(m, 'entete_page') + sectionHeight(m, 'pied_page') + MARGIN * 2;
    const perPage = Math.max(4, Math.floor((pageH - fixed - sectionHeight(m, 'entete_etat')) / rowH));
    return paginate(reportLines(groupRows(rec.columns, rec.rows, group), group !== null), perPage);
  }, [m, rec, group, landscape]);

  if (!m) return <div className="acc-empty">{S.ds.loading}</div>;

  if (design) {
    return (
      <div className="acc-formdesign" tabIndex={0}>
        <div className="acc-formdesign__scroll fo-scroll">
          <DesignCanvas maquette={m} sections={SECTIONS.filter((k) => m.sections[k])} selected={sel} onSelect={setSel} onChange={change} labels={false} width={landscape ? 1040 : 760} />
          <p className="acc-muted">{S.forms.dragHint}</p>
        </div>
      </div>
    );
  }

  const cols = rec?.columns ?? [];
  const today = new Date();
  const types = Object.fromEntries([...(rec?.rules ?? new Map())].map(([k, r]) => [k, r.type]));
  const detailCtls = m.sections.detail?.controles ?? [];
  const detailH = Math.max(20, ...detailCtls.map((c) => c.y + c.hauteur + 4));
  const value = (row: Json[], c: Controle): string => {
    if (c.champ) return displayValue(row[cols.indexOf(c.champ)] ?? null, rec?.rules.get(c.champ)?.type ?? null);
    return evalReportExpression(c.source ?? '', { columns: cols, rows: [row], page: 0, pages: 0, today });
  };
  const band = (controles: readonly Controle[], text: (c: Controle) => string, height: number, cls: string) => (
    <div className={`acc-rband ${cls}`} style={{ height }}>
      {controles.map((c, i) => (
        <div key={i} className={`acc-rctl${c.style === 'titre' ? ' is-title' : ''}${c.aligne_droite || (cls === 'is-phead' && detailCtls[i]?.aligne_droite) ? ' is-num' : ''}${c.type === 'case_a_cocher' || (cls === 'is-phead' && detailCtls[i]?.type === 'case_a_cocher') ? ' is-center' : ''}`} style={{ left: c.x, top: c.y, width: c.largeur, height: c.hauteur }}>
          {text(c)}
        </div>
      ))}
    </div>
  );
  const totalsBand = (rows: Json[][], label: string, cls: string, page: number) => {
    const ctls = m.sections.pied_etat?.controles ?? [];
    return (
      <div className={`acc-rband ${cls}`} style={{ height: 28 }}>
        <div className="acc-rctl is-total-label" style={{ left: 8, top: 4, width: 140, height: 20 }}>{label}</div>
        {ctls.map((c, i) => (
          <div key={i} className="acc-rctl is-num is-total" style={{ left: c.x, top: c.y, width: c.largeur, height: c.hauteur }}>
            {evalReportExpression(c.source ?? c.texte ?? '', { columns: cols, rows, page, pages: pages.length, today, types })}
          </div>
        ))}
      </div>
    );
  };
  const line = (l: ReportLine, i: number, page: number) => {
    if (l.kind === 'group') return <div key={i} className="acc-rgroup">{group} : {groupLabel(l.key)}</div>;
    if (l.kind === 'groupFooter') return <div key={i}>{totalsBand(l.rows, S.reports.total, 'is-gfoot', page)}</div>;
    return <div key={i}>{band(detailCtls, (c) => value(l.row, c), detailH, 'is-detail')}</div>;
  };

  return (
    <div className="acc-preview fo-scroll">
      {pages.map((p, pi) => (
        <div key={pi} className={`acc-rpage${landscape ? ' is-landscape' : ''}`}>
          {pi === 0 && band(m.sections.entete_etat?.controles ?? [], (c) => c.texte ?? evalReportExpression(c.source ?? '', { columns: cols, rows: rec?.rows ?? [], page: 1, pages: pages.length, today }), sectionHeight(m, 'entete_etat'), 'is-rhead')}
          {band(m.sections.entete_page?.controles ?? [], (c) => c.texte ?? '', sectionHeight(m, 'entete_page'), 'is-phead')}
          {p.map((l, i) => line(l, i, pi + 1))}
          {pi === pages.length - 1 && (m.sections.pied_etat?.controles.length ?? 0) > 0 && totalsBand(rec?.rows ?? [], S.reports.grandTotal, 'is-rfoot', pi + 1)}
          <div className="acc-rpage__foot">
            {band(m.sections.pied_page?.controles ?? [], (c) => c.texte ?? evalReportExpression(c.source ?? '', { columns: cols, rows: [], page: pi + 1, pages: pages.length, today }), sectionHeight(m, 'pied_page'), 'is-pfoot')}
          </div>
        </div>
      ))}
    </div>
  );
}
