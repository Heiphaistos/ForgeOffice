// Profil OnlyOffice : « Tableau - Paramètres avancés » (captures docs/captures/onlyoffice-ref/10.0/dlg-tableau-avance-*.png).
// Six pages comme l'application ; ce que ForgeOffice sait faire est branche (largeur, alignement, largeur de colonne, texte de remplacement),
// le reste est grise. Les reglages de ligne propres a la suite restent sous « Options de ForgeOffice ».
import { useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import type { TableCellProps, TableProps, TableRowProps } from '@forgeoffice/docx';
import type { Node as PMNode } from 'prosemirror-model';
import type { Ctl } from '../app/types.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { setCellProps, setColumnWidth, setRowProps, setTableProps, tableRect } from '../tables/commands.ts';
import { Select } from './common.tsx';

const TABS = ['Tableau', 'Cellule', 'Bordures et arrière-plan', 'Position du tableau', 'Habillage du texte', 'Texte de remplacement'] as const;
const OFF = 3; // « Position du tableau » : grise (le tableau est toujours dans le texte)
const cm = (pt: number): number => Number(ptToCm(pt).toFixed(2));

function current(c: Ctl): { table: PMNode; row: PMNode | null; cell: PMNode | null; col: number } | null {
  const state = c.state();
  const r = state && tableRect(state);
  if (!r) return null;
  const cellPos = r.map.map[r.top * r.map.width + r.left]!;
  return { table: r.table, row: r.table.maybeChild(r.top), cell: r.table.nodeAt(cellPos), col: r.left };
}

const Box = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) => (
  <label className="fo-oo-chk"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />{label}</label>
);

export function OoTablePropsDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const cur = current(c);
  const tp = (cur?.table.attrs.props ?? {}) as TableProps;
  const rp = (cur?.row?.attrs.props ?? {}) as TableRowProps;
  const cp = (cur?.cell?.attrs.props ?? {}) as TableCellProps;
  const grid = (cur?.table.attrs.grid ?? []) as number[];
  const [tab, setTab] = useState(0);
  const [wOn, setWOn] = useState(tp.width !== undefined && tp.width.type !== 'auto');
  const [wPct, setWPct] = useState(tp.width?.type === 'pct');
  const [wVal, setWVal] = useState(tp.width?.type === 'pct' ? tp.width.value : cm(tp.width?.type === 'pt' ? tp.width.value : grid.reduce((a, b) => a + b, 0)));
  const [align, setAlign] = useState<NonNullable<TableProps['alignment']>>(tp.alignment ?? 'left');
  const [colW, setColW] = useState(cm(grid[cur?.col ?? 0] ?? 0));
  const [vAlign, setVAlign] = useState<NonNullable<TableCellProps['verticalAlign']>>(cp.verticalAlign ?? 'top');
  const [hRule, setHRule] = useState<NonNullable<TableRowProps['height']>['rule']>(rp.height?.rule ?? 'auto');
  const [hVal, setHVal] = useState(cm(rp.height?.value ?? 0.5 * 28.35));
  const [cantSplit, setCantSplit] = useState(!!rp.cantSplit);
  const [header, setHeader] = useState(!!rp.header);
  const dm = tp.cellMargins ?? {};
  const [tm, setTm] = useState({ t: cm(dm.top ?? 0), l: cm(dm.left ?? 5.4), b: cm(dm.bottom ?? 0), r: cm(dm.right ?? 5.4) });
  const [spOn, setSpOn] = useState(!!tp.cellSpacing);
  const [spVal, setSpVal] = useState(cm(tp.cellSpacing ?? 1.4));
  const [cellDefault, setCellDefault] = useState(!cp.margins);
  const [cmg, setCmg] = useState({ t: cm(cp.margins?.top ?? dm.top ?? 0), l: cm(cp.margins?.left ?? dm.left ?? 5.4), b: cm(cp.margins?.bottom ?? dm.bottom ?? 0), r: cm(cp.margins?.right ?? dm.right ?? 5.4) });
  const [title, setTitle] = useState(tp.caption ?? '');
  const [desc, setDesc] = useState(tp.description ?? '');
  const buttons = (ok: () => void, disabled = false) => [{ label: 'OK', primary: true, onClick: ok, disabled }, { label: 'Annuler', onClick: onClose }];
  if (!cur) {
    return <Dialog open title="Tableau - Paramètres avancés" onClose={onClose} width={360} actions={[{ label: 'OK', primary: true, onClick: onClose }]}><p>Placez le curseur dans un tableau.</p></Dialog>;
  }
  const ok = (): void => {
    const width = !wOn ? { value: 0, type: 'auto' as const } : wPct ? { value: wVal, type: 'pct' as const } : { value: cmToPt(wVal), type: 'pt' as const };
    c.run(setTableProps({
      width, alignment: align === 'left' ? undefined : align, caption: title || undefined, description: desc || undefined,
      cellMargins: { top: cmToPt(tm.t), left: cmToPt(tm.l), bottom: cmToPt(tm.b), right: cmToPt(tm.r) }, cellSpacing: spOn ? cmToPt(spVal) : undefined,
    }));
    c.run(setRowProps({ height: hRule === 'auto' ? undefined : { value: cmToPt(hVal), rule: hRule }, cantSplit: cantSplit || undefined, header: header || undefined }));
    if (colW > 0 && Math.abs(colW - cm(grid[cur.col] ?? 0)) > 0.005) c.run(setColumnWidth(cmToPt(colW)));
    c.run(setCellProps({ verticalAlign: vAlign === 'top' ? undefined : vAlign, margins: cellDefault ? undefined : { top: cmToPt(cmg.t), left: cmToPt(cmg.l), bottom: cmToPt(cmg.b), right: cmToPt(cmg.r) } }));
    onClose();
  };
  const marginFields = (v: { t: number; l: number; b: number; r: number }, set: (n: { t: number; l: number; b: number; r: number }) => void, disabled = false): React.ReactNode => (
    <div className="fo-oo-dlgtabs__grid">
      {([['En haut', 't'], ['À gauche', 'l'], ['En bas', 'b'], ['À droite', 'r']] as const).map(([label, k]) => (
        <label key={k}>{label}<NumberField value={v[k]} min={0} max={5} step={0.1} unit="cm" width={86} label={label} disabled={disabled} onChange={(n) => set({ ...v, [k]: n })} /></label>
      ))}
    </div>
  );
  return (
    <Dialog open title="Tableau - Paramètres avancés" onClose={onClose} onConfirm={ok} width={528} actions={buttons(ok)}>
      <div className="fo-oo-dlgtabs" style={{ height: 430 }}>
        <div className="fo-oo-dlgtabs__list" role="tablist" aria-orientation="vertical">
          {TABS.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={tab === i} disabled={i === OFF} className="fo-oo-dlgtabs__tab" onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <div className="fo-oo-dlgtabs__page" role="tabpanel">
          {tab === 0 && (
            <>
              <h4>Taille du tableau</h4>
              <div className="fo-oo-wline">
                <input type="checkbox" aria-label="Largeur imposée" checked={wOn} onChange={(e) => setWOn(e.target.checked)} />
                <label>Largeur<NumberField value={wVal} min={0} max={wPct ? 100 : 55} step={wPct ? 5 : 0.5} unit={wPct ? '%' : 'cm'} width={110} label="Largeur" disabled={!wOn} onChange={setWVal} /></label>
                <label>Mesure en<Select value={wPct ? 'pct' : 'cm'} label="Mesure en" options={[['cm', 'Centimètre'], ['pct', 'Pour cent']]} onChange={(v) => setWPct(v === 'pct')} /></label>
              </div>
              <Box label="Redimensionner automatiquement pour ajuster au contenu" checked disabled />
              <h4>Marges des cellules par défaut</h4>
              {marginFields(tm, setTm)}
              <h4>Options</h4>
              <div className="fo-oo-wline"><input type="checkbox" aria-label="Espacement entre les cellules" checked={spOn} onChange={(e) => setSpOn(e.target.checked)} /><label>Espacement entre les cellules<NumberField value={spVal} min={0} max={5} step={0.1} unit="cm" width={110} label="Espacement entre les cellules" disabled={!spOn} onChange={setSpVal} /></label></div>
              <h4>Options de ForgeOffice : ligne</h4>
              <div className="fo-oo-dlgtabs__grid">
                <label>Hauteur<Select value={hRule} label="Hauteur" options={[['auto', 'Automatique'], ['atLeast', 'Au moins'], ['exact', 'Exactement']]} onChange={setHRule} /></label>
                <label>Valeur<NumberField value={hVal} min={0.1} max={55} step={0.1} unit="cm" width={86} label="Hauteur de ligne" disabled={hRule === 'auto'} onChange={setHVal} /></label>
              </div>
              <Box label="Ne pas couper la ligne entre deux pages" checked={cantSplit} onChange={setCantSplit} />
              <Box label="Répéter en haut de chaque page en tant que ligne d’en-tête" checked={header} onChange={setHeader} />
            </>
          )}
          {tab === 1 && (
            <>
              <h4>Taille de la cellule</h4>
              <div className="fo-oo-wline">
                <input type="checkbox" aria-label="Largeur préférée" checked disabled />
                <label>Largeur préférée<NumberField value={colW} min={0.1} max={55} step={0.1} unit="cm" width={110} label="Largeur préférée" onChange={setColW} /></label>
                <label>Mesure en<Select value="cm" label="Mesure en" options={[['cm', 'Centimètre']]} onChange={() => undefined} /></label>
              </div>
              <h4>Marges de la cellule</h4>
              <Box label="Utiliser marges par défaut" checked={cellDefault} onChange={setCellDefault} />
              {marginFields(cellDefault ? tm : cmg, setCmg, cellDefault)}
              <h4>Options de la cellule</h4>
              <Box label="Habillage du texte" checked disabled />
              <label>Alignement vertical (ForgeOffice)<Select value={vAlign} label="Alignement vertical" options={[['top', 'Haut'], ['center', 'Centré'], ['bottom', 'Bas']]} onChange={setVAlign} /></label>
            </>
          )}
          {tab === 2 && (
            <>
              <p>Les bordures et l’arrière-plan se règlent par la boîte Bordures de la suite ou le panneau Paramètres du tableau.</p>
              <button type="button" className="fo-btn fo-oo-ctl" onClick={() => { onClose(); c.openDialog('borders'); }}>Ouvrir la boîte Bordures</button>
            </>
          )}
          {tab === 4 && (
            <>
              <h4>Style d’habillage</h4>
              <div className="fo-oo-wline"><button type="button" className="fo-oo-ctl" aria-pressed disabled>Tableau aligné</button><button type="button" className="fo-oo-ctl" disabled>Tableau flottant</button></div>
              <h4>Alignement</h4>
              <div className="fo-oo-wline">
                {([['left', 'À gauche'], ['center', 'Au centre'], ['right', 'À droite']] as const).map(([v, l]) => (
                  <button key={v} type="button" className="fo-oo-ctl" aria-pressed={align === v} onClick={() => setAlign(v)}>{l}</button>
                ))}
                <label>Retrait à gauche<NumberField value={0} unit="cm" width={86} label="Retrait à gauche" disabled onChange={() => undefined} /></label>
              </div>
            </>
          )}
          {tab === 5 && (
            <>
              <label>Titre<input type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label>
              <label>Description<textarea rows={6} value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} /></label>
              <p>La représentation textuelle des informations sur l’objet visuel, qui sera lue aux personnes avec des déficiences cognitives ou visuelles pour les aider à mieux comprendre le contenu de l’image, de la forme, du graphique ou du tableau.</p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
