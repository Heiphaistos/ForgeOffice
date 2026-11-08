// Onglet Creation de page : Modele, Mise en page (marges, orientation, taille), Disposition (reperes), Modeles de couleurs
// et de polices, Arriere-plan de la page, Pages maitres.
import type { GalleryItem, MenuItem, RibbonTab } from '@forgeoffice/ui';
import { mmToPt, SLIDE_SIZES, type Deck, type Fill, type SlideSize } from '@forgeoffice/pptx';
import { sc } from '../../build.ts';
import { addMasterPage } from '../../pubdeck.ts';
import { applySchemes, COLOR_SCHEMES, FONT_SCHEMES } from '../../schemes.ts';
import { S } from '../../strings.ts';
import type { Editor } from '../editor.ts';
import type { TabContext } from './common.tsx';

const MARGIN_PRESETS: ReadonlyArray<{ id: keyof typeof S.marginNames; mm: number }> = [
  { id: 'narrow', mm: 6.35 }, { id: 'moderate', mm: 12.7 }, { id: 'normal', mm: 19.05 }, { id: 'wide', mm: 25.4 }, { id: 'none', mm: 0 },
];

const SIZE_PRESETS: ReadonlyArray<{ id: keyof typeof S.sizeNames; size: SlideSize }> = [
  { id: 'a4', size: SLIDE_SIZES.a4 }, { id: 'a3', size: SLIDE_SIZES.a3 }, { id: 'a5', size: SLIDE_SIZES.a5 }, { id: 'letter', size: SLIDE_SIZES.letter },
  { id: 'card', size: SLIDE_SIZES.businessCard }, { id: 'postcard', size: { width: mmToPt(148), height: mmToPt(105) } }, { id: 'dl', size: { width: mmToPt(99), height: mmToPt(210) } },
];

/** Change la taille des pages : les objets gardent leur position relative (mise a l'echelle des positions). */
export function resize(ed: Editor, size: SlideSize): void {
  const old = ed.deck.size;
  const kx = size.width / old.width;
  const ky = size.height / old.height;
  const scaleShapes = <T extends { xfrm?: { x: number; y: number; width: number; height: number } }>(list: T[]): T[] =>
    list.map((s) => (s.xfrm ? { ...s, xfrm: { ...s.xfrm, x: s.xfrm.x * kx, y: s.xfrm.y * ky, width: s.xfrm.width * kx, height: s.xfrm.height * ky } } : s));
  const deck: Deck = {
    ...ed.deck,
    size: { ...size, type: 'custom' },
    slides: ed.deck.slides.map((s) => ({ ...s, shapes: scaleShapes(s.shapes) })),
    masters: ed.deck.masters.map((m) => ({ ...m, layouts: m.layouts.map((l) => ({ ...l, shapes: scaleShapes(l.shapes) })) })),
  };
  ed.commit({ deck, pub: { ...ed.pub, guides: { x: ed.pub.guides.x.map((x) => x * kx), y: ed.pub.guides.y.map((y) => y * ky) } } }, 'size');
}

function setBackground(ed: Editor, fill: Fill | null): void {
  const page = ed.page;
  if (!page) return;
  ed.commitDeck({ ...ed.deck, slides: ed.deck.slides.map((s) => (s.id !== page.id ? s : fill ? { ...s, background: { type: 'fill', fill } } : { ...s, background: undefined })) }, 'background');
}

export function designTab({ ed, app }: TabContext): RibbonTab {
  const { deck, pub } = ed;
  const portrait = deck.size.height >= deck.size.width;
  const marginItems: MenuItem[] = [
    ...MARGIN_PRESETS.map((p) => ({ id: p.id, label: S.marginNames[p.id], checked: Math.abs(pub.margins.top - mmToPt(p.mm)) < 0.5, onClick: () => { const v = mmToPt(p.mm); ed.commitPub({ ...pub, margins: { top: v, bottom: v, inside: v, outside: v } }, 'margins'); } })),
    { id: 's', kind: 'separator' },
    { id: 'custom', label: S.cmd.marginGuides, onClick: () => ed.setUi({ dialog: 'guides' }) },
  ];
  const sizeItems: MenuItem[] = [
    ...SIZE_PRESETS.map((p) => ({ id: p.id, label: S.sizeNames[p.id], onClick: () => resize(ed, portrait === p.size.height >= p.size.width ? p.size : { ...p.size, width: p.size.height, height: p.size.width }) })),
    { id: 's', kind: 'separator' },
    { id: 'custom', label: S.file.customSize, onClick: () => ed.setUi({ dialog: 'pageSetup' }) },
  ];
  const colorItems: GalleryItem[] = COLOR_SCHEMES.map((c) => ({
    id: c.id, label: c.name,
    render: () => (
      <span className="pub-scheme">
        {c.colors.slice(4).map((hex, i) => <span key={i} style={{ background: `#${hex}` }} />)}
        <em>{c.name}</em>
      </span>
    ),
  }));
  const fontItems: MenuItem[] = FONT_SCHEMES.map((f) => ({ id: f.id, label: `${f.name} — ${f.major} / ${f.minor}`, checked: pub.fontScheme === f.id, onClick: () => ed.commit({ deck: applySchemes(deck, undefined, f), pub: { ...pub, fontScheme: f.id } }, 'fonts') }));
  const tint = (n: number): Fill => ({ type: 'solid', color: sc('accent1', [{ name: 'lumMod', val: 100000 - n * 1000 }, { name: 'lumOff', val: n * 1000 }]) });
  const backgroundItems: MenuItem[] = [
    { id: 'none', label: S.cmd.noBackground, onClick: () => setBackground(ed, null) },
    { id: 'h', kind: 'header', label: S.cmd.background },
    ...[20, 40, 60, 80].map((n) => ({ id: `t${n}`, label: S.backgroundNames.tint(100 - n), adornment: <span className="pub-swatch" style={{ background: `color-mix(in srgb, var(--pub-accent) ${100 - n}%, white)` }} />, onClick: () => setBackground(ed, tint(n)) })),
    { id: 'grad', label: S.backgroundNames.gradient, onClick: () => setBackground(ed, { type: 'gradient', kind: 'linear', angle: 90, stops: [{ position: 0, color: sc('bg1') }, { position: 100, color: sc('accent1', [{ name: 'lumMod', val: 40000 }, { name: 'lumOff', val: 60000 }]) }] }) },
    { id: 'dark', label: S.backgroundNames.dark, onClick: () => setBackground(ed, { type: 'solid', color: sc('tx2') }) },
    { id: 's', kind: 'separator' },
    { id: 'more', label: S.cmd.moreBackgrounds, onClick: () => ed.setUi({ dialog: 'background' }) },
  ];
  const layouts = deck.masters[0]?.layouts ?? [];
  const masterItems: MenuItem[] = [
    ...layouts.map((l) => ({ id: l.id, label: l.name, checked: ed.page?.layoutId === l.id, onClick: () => ed.commitDeck({ ...deck, slides: deck.slides.map((s) => (s.id === ed.page?.id ? { ...s, layoutId: l.id, showMasterShapes: true } : s)) }) })),
    { id: 'none', label: S.cmd.ignoreMaster, checked: ed.page?.showMasterShapes === false, onClick: () => ed.commitDeck({ ...deck, slides: deck.slides.map((s) => (s.id === ed.page?.id ? { ...s, showMasterShapes: s.showMasterShapes === false } : s)) }) },
    { id: 's', kind: 'separator' },
    { id: 'edit', label: S.cmd.editMaster, icon: 'slide_layout', onClick: () => ed.setUi({ view: 'master', masterId: ed.page?.layoutId ?? null }) },
    { id: 'new', label: S.cmd.newMaster, icon: 'add', onClick: () => { const d = structuredClone(deck); const l = addMasterPage(d); ed.commitDeck(d); if (l) ed.setUi({ view: 'master', masterId: l.id }); } },
  ];
  return {
    id: 'design',
    label: S.tabs.design,
    keytip: 'G',
    groups: [
      { id: 'template', label: S.groups.template, icon: 'book_template', controls: [{ kind: 'button', id: 'change', label: S.cmd.changeTemplate, icon: 'book_template', size: 'large', onClick: () => app.backstage('new') }] },
      {
        id: 'setup', label: S.groups.setup, icon: 'document_margins', controls: [
          { kind: 'menu', id: 'margins', label: S.cmd.margins, icon: 'document_margins', size: 'large', items: marginItems },
          {
            kind: 'menu', id: 'orientation', label: S.cmd.orientation, icon: 'orientation', size: 'large', items: [
              { id: 'p', label: S.cmd.portrait, icon: 'document', checked: portrait, onClick: () => !portrait && resize(ed, { width: deck.size.height, height: deck.size.width }) },
              { id: 'l', label: S.cmd.landscape, icon: 'document_landscape', checked: !portrait, onClick: () => portrait && resize(ed, { width: deck.size.height, height: deck.size.width }) },
            ],
          },
          { kind: 'menu', id: 'size', label: S.cmd.size, icon: 'slide_size', size: 'large', items: sizeItems },
        ],
      },
      {
        id: 'layout', label: S.groups.layout, icon: 'grid', controls: [
          {
            kind: 'menu', id: 'guides', label: S.cmd.guides, icon: 'grid', size: 'large', items: [
              { id: 'one', label: S.guidePresets.one, onClick: () => ed.commitPub({ ...pub, columns: { count: 1, gap: pub.columns.gap }, rows: { count: 1, gap: pub.rows.gap } }, 'guides') },
              { id: 'two', label: S.guidePresets.two, onClick: () => ed.commitPub({ ...pub, columns: { count: 2, gap: 18 } }, 'guides') },
              { id: 'three', label: S.guidePresets.three, onClick: () => ed.commitPub({ ...pub, columns: { count: 3, gap: 18 } }, 'guides') },
              { id: 'grid', label: S.guidePresets.grid, onClick: () => ed.commitPub({ ...pub, columns: { count: 3, gap: 14.4 }, rows: { count: 3, gap: 14.4 } }, 'guides') },
              { id: 's', kind: 'separator' },
              { id: 'addH', label: S.cmd.addH, onClick: () => ed.commitPub({ ...pub, guides: { ...pub.guides, y: [...pub.guides.y, deck.size.height / 2] } }, 'guides') },
              { id: 'addV', label: S.cmd.addV, onClick: () => ed.commitPub({ ...pub, guides: { ...pub.guides, x: [...pub.guides.x, deck.size.width / 2] } }, 'guides') },
              { id: 'lock', label: S.cmd.lockGuides, checked: ed.ui.guidesLocked, onClick: () => ed.setUi({ guidesLocked: !ed.ui.guidesLocked }) },
              { id: 'clear', label: S.cmd.clearGuides, onClick: () => ed.commitPub({ ...pub, guides: { x: [], y: [] } }, 'guides') },
              { id: 's2', kind: 'separator' },
              { id: 'dialog', label: S.cmd.marginGuides, onClick: () => ed.setUi({ dialog: 'guides' }) },
            ],
          },
          { kind: 'button', id: 'spots', label: S.cmd.spots, icon: 'color', onClick: () => ed.setUi({ dialog: 'spots' }) },
          { kind: 'checkbox', id: 'continued', label: S.cmd.continued, checked: pub.continued, onChange: (v) => ed.commitPub({ ...pub, continued: v }, 'continued') },
          { kind: 'checkbox', id: 'facing', label: S.cmd.facing, checked: pub.facing, onChange: (v) => { ed.commitPub({ ...pub, facing: v }, 'facing'); ed.setUi({ twoPage: v }); } },
          { kind: 'number', id: 'bleed', label: S.cmd.bleed, value: Math.round((pub.bleed / 72) * 25.4 * 10) / 10, min: 0, max: 10, step: 0.5, unit: S.dialogs.mm, width: 64, onChange: (v) => ed.commitPub({ ...pub, bleed: mmToPt(v) }, 'bleed') },
        ],
      },
      {
        id: 'schemes', label: S.groups.schemes, icon: 'color', controls: [
          { kind: 'gallery', id: 'colors', label: S.cmd.colorSchemes, icon: 'color', itemWidth: 96, columns: 3, items: colorItems, selectedId: pub.colorScheme, onSelect: (id) => { const c = COLOR_SCHEMES.find((x) => x.id === id); if (c) ed.commit({ deck: applySchemes(deck, c), pub: { ...pub, colorScheme: c.id } }, 'colors'); } },
          { kind: 'menu', id: 'fonts', label: S.cmd.fontSchemes, icon: 'text_font', size: 'large', items: fontItems },
        ],
      },
      { id: 'background', label: S.groups.background, icon: 'color_background', controls: [{ kind: 'menu', id: 'bg', label: S.cmd.background, icon: 'color_background', size: 'large', items: backgroundItems }] },
      { id: 'master', label: S.groups.master, icon: 'slide_layout', controls: [{ kind: 'menu', id: 'masters', label: S.cmd.masterPages, icon: 'slide_layout', size: 'large', items: masterItems }] },
    ],
  };
}
