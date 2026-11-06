// Onglet Mise en page du ruban : themes, mise en page (marges, orientation, taille, zone d'impression, sauts, titres), mise a l'echelle
// (largeur, hauteur, echelle), options de la feuille. Le lanceur ouvre la boite Mise en page.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { fitOf, fitPatch, MARGIN_PRESETS, marginPresetOf, marginsOf, PAPER_SIZES, paperLabel } from '../logic/pagesetup.ts';
import { lastMargins } from '../ui/page-setup/last-margins.ts';
import type { PsTab } from '../ui/page-setup/types.ts';
import { PS, RB } from '../strings/index.ts';
import type { RibbonEnv } from './env.ts';

const THEMES = ['office', 'office2013', 'green', 'blue', 'red', 'gray'] as const;
const PRESET_LABEL = { normal: RB.marginsNormal, wide: RB.marginsWide, narrow: RB.marginsNarrow } as const;

const fitOptions = [{ value: '0', label: PS.auto }, ...Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: PS.pagesN(i + 1) })), { value: 'more', label: PS.morePages }];

export function layoutTab(e: RibbonEnv): RibbonTab {
  const ps = e.sheet.pageSetup;
  const openBox = (tab: PsTab): void => e.ctx.open({ kind: 'pageSetup', tab });
  const current = marginPresetOf(ps.margins);
  const last = lastMargins();
  const fit = fitOf(ps);
  const fitMenu = (dim: 'w' | 'h', label: string) => {
    const cur = ps.fitToPage ? fit[dim] : 0;
    return {
      kind: 'menu' as const, id: dim === 'w' ? 'fitw' : 'fith', label: `${label} : ${cur === 0 ? PS.auto : PS.pagesN(cur)}`, icon: dim === 'w' ? ('arrow_autofit_width' as const) : ('arrow_autofit_height' as const),
      items: [
        ...fitOptions.filter((o) => o.value !== 'more').map((o) => ({ id: `f${o.value}`, label: o.label, checked: cur === Number(o.value), onClick: () => e.cmd.pageSetup(fitPatch(ps, dim, Number(o.value))) })),
        { id: 'more', label: PS.morePages, onClick: () => openBox('page') },
      ] as MenuItem[],
    };
  };
  const marginItems: MenuItem[] = [
    ...MARGIN_PRESETS.map((p) => ({ id: p.id, label: PRESET_LABEL[p.id], checked: current === p.id, onClick: () => e.cmd.pageSetup({ margins: marginsOf(p) }) })),
    ...(last ? [{ id: 'last', label: PS.lastMargins, checked: current === null && JSON.stringify(ps.margins) === JSON.stringify(last), onClick: () => e.cmd.pageSetup({ margins: { ...last } }) }] : []),
    { id: 'custom', label: PS.customMargins, onClick: () => openBox('margins') },
  ];
  return {
    id: 'layout', label: RB.tabs.layout, keytip: 'P',
    groups: [
      { id: 'themes', label: RB.g.themes, icon: 'color', controls: [
        { kind: 'menu', id: 'colors', label: RB.themesColors, icon: 'color', size: 'large', items: THEMES.map((t) => ({ id: t, label: RB.themeNames[t] ?? t, onClick: () => e.themeColors(t) })) },
      ] },
      { id: 'page', label: RB.g.pageSetup, icon: 'document_margins', launcher: { label: PS.title, onClick: () => openBox('page') }, controls: [
        { kind: 'menu', id: 'margins', label: RB.margins, icon: 'document_margins', size: 'large', items: marginItems },
        { kind: 'menu', id: 'orient', label: RB.orientationPage, icon: 'document_landscape', size: 'large', items: [
          { id: 'p', label: RB.portrait, checked: ps.orientation !== 'landscape', onClick: () => e.cmd.pageSetup({ orientation: 'portrait' }) },
          { id: 'l', label: RB.landscape, checked: ps.orientation === 'landscape', onClick: () => e.cmd.pageSetup({ orientation: 'landscape' }) },
        ] },
        { kind: 'menu', id: 'size', label: RB.pageSize, icon: 'document', size: 'large', items: [
          ...PAPER_SIZES.map((p) => ({ id: `p${p.id}`, label: paperLabel(p), checked: (ps.paperSize ?? 9) === p.id, onClick: () => e.cmd.pageSetup({ paperSize: p.id }) })),
          { id: 'more', label: PS.moreSizes, onClick: () => openBox('page') },
        ] },
        { kind: 'menu', id: 'area', label: RB.printArea, icon: 'print', size: 'large', items: [
          { id: 'set', label: RB.setPrintArea, onClick: () => e.printArea(true) },
          { id: 'add', label: PS.addToArea, disabled: !ps.printArea?.length, onClick: () => e.printArea('add') },
          { id: 'clear', label: RB.clearPrintArea, disabled: !ps.printArea?.length, onClick: () => e.printArea(false) },
        ] },
        { kind: 'menu', id: 'breaks', label: RB.breaks, icon: 'document_page_break', size: 'large', items: [
          { id: 'ins', label: RB.insertBreak, onClick: () => e.pageBreak('insert') },
          { id: 'rem', label: RB.removeBreak, onClick: () => e.pageBreak('remove') },
          { id: 'reset', label: RB.resetBreaks, disabled: !ps.rowBreaks.length && !ps.colBreaks.length, onClick: () => e.pageBreak('reset') },
        ] },
        { kind: 'button', id: 'titles', label: RB.printTitles, icon: 'table_freeze_row', size: 'large', onClick: () => openBox('sheet') },
      ] },
      { id: 'scale', label: RB.g.scale, icon: 'page_fit', controls: [
        fitMenu('w', PS.width),
        fitMenu('h', PS.height),
        { kind: 'number', id: 'scale', label: RB.scale, value: ps.scale ?? 100, min: 10, max: 400, step: 5, unit: '%', width: 64, disabled: !!ps.fitToPage, onChange: (v) => e.cmd.pageSetup({ scale: v, fitToPage: false }) },
      ] },
      { id: 'opts', label: RB.g.sheetOptions, icon: 'grid', controls: [
        { kind: 'checkbox', id: 'gv', label: `${RB.gridlines} : ${RB.viewOpt}`, checked: e.sheet.view.showGridLines, onChange: (v) => e.cmd.view({ showGridLines: v }) },
        { kind: 'checkbox', id: 'gp', label: `${RB.gridlines} : ${RB.printOpt}`, checked: !!ps.printGridLines, onChange: (v) => e.cmd.pageSetup({ printGridLines: v }) },
        { kind: 'checkbox', id: 'hv', label: `${RB.headings} : ${RB.viewOpt}`, checked: e.sheet.view.showHeaders, onChange: (v) => e.cmd.view({ showHeaders: v }) },
        { kind: 'checkbox', id: 'hp', label: `${RB.headings} : ${RB.printOpt}`, checked: !!ps.printHeadings, onChange: (v) => e.cmd.pageSetup({ printHeadings: v }) },
      ] },
    ],
  };
}
