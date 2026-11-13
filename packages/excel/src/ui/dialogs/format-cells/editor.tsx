// Boite « Format de cellule » : six onglets d'Excel. `FormatTabs` est reutilisable (mise en forme conditionnelle, styles).
import { useState } from 'react';
import { Dialog, isOnlyOffice } from '@forgeoffice/ui';
import { applyEdits, isEmpty } from '../../../logic/format-edits.ts';
import { fitRows } from '../../../logic/rowfit.ts';
import { NUM_CATEGORIES, type NumCategory } from '../../../logic/numfmt-ui.ts';
import { FC } from '../../../strings/index.ts';
import type { DialogEnv } from '../../registry.ts';
import { AlignTab } from './alignement.tsx';
import { BorderTab } from './bordure.tsx';
import { FontTab } from './police.tsx';
import { NumberTab } from './nombre.tsx';
import { ProtectionTab } from './protection.tsx';
import { FillTab } from './remplissage.tsx';
import { canvasMeasure } from './measure.ts';
import { ALL_TABS, useFormatCtx, type FormatCtx, type TabId } from './state.ts';
import './format-cells.css';

/** Barre d'onglets + onglet actif, pour n'importe quel conteneur (boite, volet). */
export function FormatTabs({ f, tabs = ALL_TABS, initial, category, compact }: { f: FormatCtx; tabs?: readonly TabId[]; initial?: TabId; category?: NumCategory; compact?: boolean }) {
  const [page, setPage] = useState<TabId>(initial && tabs.includes(initial) ? initial : (tabs[0] ?? 'number'));
  return (
    <div className="xl-fc">
      {!compact && <div className="xl-tabsbar" role="tablist">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={page === k} className={page === k ? 'is-active' : ''} onClick={() => setPage(k)}>{FC.tabs[k]}</button>
        ))}
      </div>}
      <div className="xl-fc-page" role="tabpanel">
        {page === 'number' && <NumberTab f={f} compact={compact} {...(category ? { category } : {})} />}
        {page === 'align' && <AlignTab f={f} />}
        {page === 'font' && <FontTab f={f} />}
        {page === 'border' && <BorderTab f={f} />}
        {page === 'fill' && <FillTab f={f} />}
        {page === 'protection' && <ProtectionTab f={f} />}
      </div>
      {f.state.mixed.size > 0 && <p className="xl-fc-mixed">{FC.mixed}</p>}
    </div>
  );
}

export function FormatCellsDialog({ x, tab, category }: { x: DialogEnv; tab?: string; category?: string }) {
  const { active } = x.sel;
  const f = useFormatCtx(x.store.wb, x.si, x.sel.ranges, active, x.value(active.row, active.col));
  const initial = ALL_TABS.find((t) => t === tab);
  const cat = NUM_CATEGORIES.find((c) => c === category);
  const apply = (): void => {
    if (!isEmpty(f.edits) && x.guard()) {
      const ranges = [...x.sel.ranges];
      x.store.commit((d) => {
        applyEdits(d, x.si, ranges, f.edits);
        // Renvoi a la ligne, orientation, retrait, police ou taille : les lignes sans hauteur imposee s'ajustent au contenu.
        if (['wrap', 'rotation', 'indent', 'size', 'fontName'].some((k) => k in f.edits)) fitRows(d, x.si, ranges, canvasMeasure(), x.value);
      });
      if (f.edits.numFmt !== undefined) x.widen?.();
    }
    x.close();
  };
  // Profil OnlyOffice : Ctrl+1 ouvre « Format de nombre » (categorie en liste, champs empiles) ; les autres onglets restent dans « Format de cellule ».
  if (isOnlyOffice() && (!initial || initial === 'number')) {
    return (
      <Dialog open title="Format de nombre" onClose={x.close} onConfirm={apply} width={340}>
        <FormatTabs f={f} tabs={['number']} compact {...(cat ? { category: cat } : {})} />
      </Dialog>
    );
  }
  return (
    <Dialog open title={FC.title} onClose={x.close} onConfirm={apply} width={640}>
      <FormatTabs f={f} {...(initial ? { initial } : {})} {...(cat ? { category: cat } : {})} />
    </Dialog>
  );
}
