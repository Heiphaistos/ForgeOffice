// Sections du panneau « Proprietes » de Calc en disposition LibreOffice : Style, Caractere, Format numerique, Alignement, Apparence de cellule
// (titres de la vraie barre laterale), alimentees par les commandes du ruban (references `groupe.controle`).
import type { RibbonControl, RibbonGroup, RibbonTab } from '../../ribbon-types.ts';
import { RibbonControlView, type ControlContext } from '../ribbon/RibbonControls.tsx';

const SECTIONS: ReadonlyArray<{ id: string; label: string; refs: readonly string[] }> = [
  { id: 'lo-style', label: 'Style', refs: ['styles.cellStyles'] },
  { id: 'lo-char', label: 'Caractère', refs: ['font.fontname', 'font.fontsize', 'font.bold', 'font.italic', 'font.underline', 'font.fontcolor', 'font.grow', 'font.shrink'] },
  { id: 'lo-num', label: 'Format numérique', refs: ['number.numfmt', 'number.currency', 'number.percent', 'number.comma', 'number.decInc', 'number.decDec'] },
  { id: 'lo-align', label: 'Alignement', refs: ['align.left', 'align.center', 'align.right', 'align.top', 'align.middle', 'align.bottom', 'align.indDec', 'align.indInc', 'align.orient', 'align.wrap', 'align.merge'] },
  { id: 'lo-look', label: 'Apparence de cellule', refs: ['font.fill', 'font.borders'] },
];

/** La galerie de styles devient une liste deroulante (« Par defaut » ...), comme dans la vraie barre laterale. */
const asCombo = (c: RibbonControl): RibbonControl => (c.kind === 'gallery'
  ? { kind: 'combo', id: c.id, label: c.label, width: 180, value: (c.items.find((i) => i.id === (c.selectedId ?? c.items[0]?.id)) ?? c.items[0])?.label ?? '', options: c.items.map((i) => ({ value: i.id, label: i.label })), onChange: c.onSelect }
  : c);

/** « Apparence de cellule » : Arriere-plan (controle + pastille ; vide : le ruban ne connait que la derniere couleur choisie, pas celle de la cellule), puis bordures et pastilles de trait / couleur de bordure (grisees : le ruban regle le trait dans son menu). */
function lookControls(byRef: Map<string, RibbonControl>, ctx: ControlContext): RibbonControl[] {
  const fill = byRef.get('font.fill');
  const borders = byRef.get('font.borders');
  if (!fill && !borders) return [];
  return [{
    kind: 'custom', id: 'lo-look', label: 'Apparence de cellule',
    render: () => (
      <div className="fo-lo-look">
        {fill && <><span>Arrière-plan :</span><span className="fo-lo-look__ctl"><RibbonControlView control={fill} mode="small" ctx={ctx} /><span className="fo-lo-chip" /></span></>}
        {borders && <><span>Bordures :</span><span className="fo-lo-look__ctl"><RibbonControlView control={borders} mode="small" ctx={ctx} /><span className="fo-lo-chip fo-lo-chip--line" /><span className="fo-lo-chip fo-lo-chip--sq" /></span></>}
      </div>
    ),
  }];
}

const flat = (cs: readonly RibbonControl[]): RibbonControl[] => cs.flatMap((c) => (c.kind === 'row' ? flat(c.controls) : [c]));

/** Sections « a la LibreOffice » du premier onglet ; une section sans commande disponible est omise. */
export function calcSections(main: RibbonTab | undefined, ctx: ControlContext): RibbonGroup[] {
  if (!main) return [];
  const byRef = new Map<string, RibbonControl>();
  for (const g of main.groups) for (const c of flat(g.controls)) if (!c.hidden) byRef.set(`${g.id}.${c.id}`, c);
  return SECTIONS.map((s) => ({ id: s.id, label: s.label, controls: s.id === 'lo-look' ? lookControls(byRef, ctx) : s.refs.map((r) => byRef.get(r)).filter((c): c is RibbonControl => !!c).map(asCombo) })).filter((g) => g.controls.length > 0);
}
