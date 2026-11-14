// Une barre d'outils a la maniere de LibreOffice / OpenOffice : boutons a plat dans l'ordre reel de la suite, filets de separation.
// Une commande liee a un controle ForgeOffice (police, couleur, bascule...) se rend avec ce controle ; sinon bouton simple ou grise.
import type { SuiteBarEntry } from '../../logic/suite/build.ts';
import { BAR_ICONS, FALLBACK_ICON, NO_EQUIV } from '../../logic/suite/build.ts';
import { useState, type CSSProperties } from 'react';
import { Icon } from '../../icons/Icon.tsx';
import type { IconName } from '../../icons/generated.ts';
import { Menu } from '../Menu.tsx';
import type { GalleryControl } from '../../ribbon-types.ts';
import { RibbonControlView, type ControlContext } from '../ribbon/RibbonControls.tsx';

/** Repli pour les barres sans releve de la vraie fenetre (OpenOffice) : boutons que la vraie suite fait suivre d'une fleche de liste. Les barres LibreOffice portent `d` (releve exact). */
const CARET = new Set(['AddDirect', 'OpenFromWriter', 'OpenFromCalc', 'OpenFromImpress', 'OpenFromDraw', 'Save', 'Paste', 'Undo', 'Redo', 'InsertTable', 'InsertFieldCtrl', 'CharmapControl', 'BasicShapes', 'LineToolbox', 'ArrowsToolbox', 'ConnectorToolbox', 'SymbolShapes', 'ArrowShapes', 'StarShapes', 'CalloutShapes', 'FlowChartShapes', 'Objects3DToolbox', 'Color', 'CharBackColor', 'DefaultBullet', 'DefaultNumbering', 'SetOutline', 'LineSpacing', 'InsertObjectChart']);
const COMBOS = new Set(['font', 'combo', 'number', 'gallery']);

/** Galerie de styles rendue comme la liste « Style de paragraphe » de la suite : champ + fleche, la galerie s'ouvre en liste. */
function GalleryCombo({ control }: { control: GalleryControl }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = control.items.find((i) => i.id === control.selectedId) ?? control.items[0];
  return (
    <>
      <button type="button" className="fo-suite__combo" aria-haspopup="menu" title={control.label} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <span>{current?.label ?? control.label}</span>
        <Icon name="chevron_down" size={12} />
      </button>
      {anchor && <Menu anchor={anchor} placement="below" label={control.label} onClose={() => setAnchor(null)} items={control.items.map((i) => ({ id: i.id, label: i.label, onClick: () => control.onSelect(i.id) }))} />}
    </>
  );
}

/** Galerie hors liste de styles (formes, lignes...) : bouton a icone + fleche, la galerie s'ouvre en liste. */
function GalleryButton({ control, icon, label }: { control: GalleryControl; icon: IconName; label: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className="fo-suite__btn" aria-haspopup="menu" title={label} aria-label={label} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <Icon name={icon} size={20} />
        <Icon name="chevron_down" size={10} className="fo-suite__caret" />
      </button>
      {anchor && <Menu anchor={anchor} placement="below" label={label} onClose={() => setAnchor(null)} items={control.items.map((i) => ({ id: i.id, label: i.label, onClick: () => control.onSelect(i.id) }))} />}
    </>
  );
}

const hasList = (e: SuiteBarEntry): boolean => e.split ?? CARET.has(e.uno);

export function SuiteToolbar({ entries, label, ctx, vertical = false }: { entries: readonly SuiteBarEntry[]; label: string; ctx: ControlContext; vertical?: boolean }) {
  return (
    <div className={`fo-menubar__toolbar fo-suite__bar${vertical ? ' fo-suite__bar--vertical' : ''}`} role="toolbar" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'}>
      {entries.map((e) => {
        if (e.sep) return <span key={e.key} className="fo-suite__sep" role="separator" aria-orientation="vertical" />;
        const c = e.cmd;
        if (c?.control?.kind === 'gallery') return e.uno === 'StyleApply' ? <span key={e.key} className="fo-suite__ctl fo-suite__ctl--field" data-uno={e.uno}><GalleryCombo control={c.control} /></span> : <span key={e.key} className={`fo-suite__ctl ${hasList(e) ? 'fo-suite__ctl--split' : 'fo-suite__ctl--plain'}`} data-uno={e.uno} style={{ width: e.width ?? (hasList(e) ? 44 : 33) }}><GalleryButton control={c.control} icon={c.icon ?? BAR_ICONS[e.uno] ?? FALLBACK_ICON} label={e.label} /></span>;
        if (c?.control && !c.control.hidden) {
          const field = e.kind ? e.kind === 'f' : COMBOS.has(c.control.kind);
          // Champ chez nous, simple bouton dans la vraie barre (Nombre, Date...) : bouton qui choisit le format de meme nom dans la liste.
          if (e.kind && !field && c.control.kind === 'combo') {
            const ctl = c.control;
            const pick = ctl.options.find((o) => (e.uno.endsWith('Date') ? /date/i : /nombre|number/i).test(o.value));
            return <button key={e.key} type="button" className={`fo-suite__btn${hasList(e) ? ' fo-suite__btn--split' : ''}`} data-uno={e.uno} disabled={!pick} title={e.label} aria-label={e.label} onClick={() => pick && ctl.onChange(pick.value)}><Icon name={c.icon ?? BAR_ICONS[e.uno] ?? FALLBACK_ICON} size={20} />{hasList(e) && <Icon name="chevron_down" size={10} className="fo-suite__caret" />}</button>;
          }
          return <span key={e.key} className={`fo-suite__ctl${field ? ' fo-suite__ctl--field' : hasList(e) ? ' fo-suite__ctl--split' : ' fo-suite__ctl--plain'}`} data-uno={e.uno} style={{ width: e.width ?? (field ? undefined : hasList(e) ? 44 : 33) }}><RibbonControlView control={c.control} mode="icon" ctx={ctx} /></span>;
        }
        const icon = c?.icon ?? BAR_ICONS[e.uno] ?? FALLBACK_ICON;
        return (
          <button
            key={e.key}
            type="button"
            className={`fo-suite__btn${hasList(e) ? ' fo-suite__btn--split' : ''}`}
            style={e.width ? ({ width: e.width, paddingRight: hasList(e) ? e.width - 33 : 0, '--z': `${e.width - 33}px` } as CSSProperties) : undefined}
            data-uno={e.uno}
            disabled={!c || c.disabled}
            title={c ? e.label : `${e.label} — ${NO_EQUIV}`}
            aria-label={e.label}
            onClick={c?.run}
          >
            <Icon name={icon} size={20} />
            {hasList(e) && <Icon name="chevron_down" size={10} className="fo-suite__caret" />}
          </button>
        );
      })}
    </div>
  );
}
