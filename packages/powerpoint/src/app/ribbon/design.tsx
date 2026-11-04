// Onglets Dessin (encre) et Creation (themes, variantes, couleurs, polices, taille, arriere-plan, Concepteur).
import { createBlankDeck, SIZE_NAMES, SLIDE_SIZES, type Deck, type SlideSizePreset } from '@forgeoffice/pptx';
import type { GalleryItem, MenuItem, RibbonTab } from '@forgeoffice/ui';
import { applyDesignTheme, applyFonts, applyPalette, currentThemeId, DESIGN_THEMES, FONT_PAIRS, PALETTES } from '../themes.ts';
import { resizeDeck } from '../deck-ops.ts';
import { DeckThumb, Swatches, type TabContext } from './common.tsx';
import { S } from '../../strings.ts';

const PENS = [
  { id: 'black', color: '#000000', width: 1.5 },
  { id: 'red', color: '#E81123', width: 1.5 },
  { id: 'blue', color: '#0063B1', width: 1.5 },
] as const;

export function drawTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const tool = ed.ui.tool;
  const inkColor = tool.kind === 'ink' ? tool.color : '#000000';
  const inkWidth = tool.kind === 'ink' ? tool.width : 1.5;
  return {
    id: 'draw',
    label: S.tabs.draw,
    keytip: 'JI',
    groups: [
      {
        id: 'tools', label: S.draw.tools, icon: 'pen',
        controls: [
          { kind: 'toggle', id: 'select', label: S.draw.select, icon: 'lasso', size: 'large', pressed: tool.kind === 'select', onToggle: () => ed.setUi({ tool: { kind: 'select' } }) },
          ...PENS.map((p) => ({
            kind: 'toggle' as const, id: `pen-${p.id}`, label: S.draw.pens[p.id], icon: 'pen' as const, size: 'large' as const,
            pressed: tool.kind === 'ink' && !tool.highlighter && tool.color === p.color,
            onToggle: (on: boolean) => ed.setUi({ tool: on ? { kind: 'ink', color: p.color, width: p.width } : { kind: 'select' } }),
          })),
          { kind: 'toggle', id: 'highlighter', label: S.draw.highlighter, icon: 'highlight', size: 'large', pressed: tool.kind === 'ink' && !!tool.highlighter, onToggle: (on) => ed.setUi({ tool: on ? { kind: 'ink', color: '#FFEB00', width: 12, highlighter: true } : { kind: 'select' } }) },
          { kind: 'toggle', id: 'eraser', label: S.draw.eraser, icon: 'eraser', size: 'large', pressed: tool.kind === 'eraser', onToggle: (on) => ed.setUi({ tool: on ? { kind: 'eraser' } : { kind: 'select' } }) },
          { kind: 'color', id: 'inkColor', label: S.draw.color, icon: 'color', size: 'small', value: inkColor, onChange: (c) => ed.setUi({ tool: { kind: 'ink', color: c ?? '#000000', width: inkWidth } }) },
          {
            kind: 'menu', id: 'thickness', label: S.draw.thickness, icon: 'ink_stroke', size: 'small',
            items: [0.5, 1, 1.5, 2.5, 3.5, 5, 8].map((w) => ({ id: String(w), label: `${String(w).replace('.', ',')} pt`, checked: inkWidth === w, onClick: () => ed.setUi({ tool: { kind: 'ink', color: inkColor, width: w, highlighter: tool.kind === 'ink' ? tool.highlighter : false } }) })),
          },
        ],
      },
    ],
  };
}

/** Apercus des themes (presentation vierge a la taille du document), calcules une fois par taille. */
const previewCache = new Map<string, Map<string, Deck>>();
function previewsFor(deck: Deck): Map<string, Deck> {
  const key = `${deck.size.width}x${deck.size.height}`;
  let hit = previewCache.get(key);
  if (!hit) {
    const base = createBlankDeck({ width: deck.size.width, height: deck.size.height }, { titleSlide: false });
    hit = new Map(DESIGN_THEMES.map((t) => [t.id, applyDesignTheme(base, t.id)]));
    previewCache.set(key, hit);
  }
  return hit;
}

export function designTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const previews = previewsFor(ed.deck);
  const themeId = currentThemeId(ed.deck);
  const theme = DESIGN_THEMES.find((t) => t.id === themeId) ?? DESIGN_THEMES[0];
  const themeItems: GalleryItem[] = DESIGN_THEMES.map((t) => ({ id: t.id, label: t.name, render: () => <DeckThumb deck={previews.get(t.id) as Deck} width={96} /> }));
  const variantItems: GalleryItem[] = (theme?.variants ?? []).map((paletteId, i) => {
    const pal = PALETTES.find((p) => p.id === paletteId);
    return { id: String(i), label: pal?.name ?? paletteId, render: () => <Swatches colors={(pal?.colors.slice(2, 8) ?? []).map((c) => `#${c}`)} size={12} /> };
  });
  const sizeItems: MenuItem[] = [
    ...(['widescreen', 'standard'] as SlideSizePreset[]).map((p) => ({ id: p, label: SIZE_NAMES[p], checked: Math.abs(ed.deck.size.width - SLIDE_SIZES[p].width) < 1 && Math.abs(ed.deck.size.height - SLIDE_SIZES[p].height) < 1, onClick: () => ed.commit(resizeDeck(ed.deck, { ...SLIDE_SIZES[p] }, 'fit')) })),
    { id: 's', kind: 'separator' },
    { id: 'custom', label: S.design.customSize, icon: 'slide_size', onClick: () => app.dialog('slideSize') },
  ];
  return {
    id: 'design',
    label: S.tabs.design,
    keytip: 'G',
    groups: [
      {
        id: 'themes', label: S.design.themes, icon: 'design_ideas',
        controls: [{ kind: 'gallery', id: 'themeGallery', label: S.design.themes, items: themeItems, selectedId: themeId, itemWidth: 104, columns: 4, onSelect: (id) => ed.commit(applyDesignTheme(ed.deck, id)) }],
      },
      {
        id: 'variants', label: S.design.variants, icon: 'color',
        controls: [
          { kind: 'gallery', id: 'variantGallery', label: S.design.variants, items: variantItems, itemWidth: 84, columns: 4, onSelect: (id) => ed.commit(applyDesignTheme(ed.deck, themeId, Number(id))) },
          {
            kind: 'menu', id: 'colors', label: S.design.colors, icon: 'color', size: 'small',
            items: PALETTES.map((p) => ({ id: p.id, label: p.name, adornment: <Swatches colors={p.colors.slice(2, 8).map((c) => `#${c}`)} size={8} />, onClick: () => ed.commit(applyPalette(ed.deck, p.id)) })),
          },
          {
            kind: 'menu', id: 'fonts', label: S.design.fonts, icon: 'text_font', size: 'small',
            items: FONT_PAIRS.map((f) => ({ id: f.id, label: `${f.major} / ${f.minor}`, checked: ed.ctx.theme.fonts.major.latin === f.major && ed.ctx.theme.fonts.minor.latin === f.minor, onClick: () => ed.commit(applyFonts(ed.deck, f.id)) })),
          },
          { kind: 'button', id: 'bgStyles', label: S.design.backgroundStyles, icon: 'color_background', size: 'small', onClick: () => app.dialog('background') },
        ],
      },
      {
        id: 'customize', label: S.design.customize, icon: 'slide_size',
        controls: [
          { kind: 'menu', id: 'size', label: S.design.slideSize, icon: 'slide_size', size: 'large', items: sizeItems },
          { kind: 'button', id: 'bg', label: S.design.formatBackground, icon: 'color_background', size: 'large', onClick: () => app.dialog('background') },
        ],
      },
      {
        id: 'designer', label: S.design.designer, icon: 'design_ideas',
        controls: [{ kind: 'toggle', id: 'designerPane', label: S.design.designIdeas, icon: 'design_ideas', size: 'large', pressed: ed.ui.pane === 'designer', tooltip: { title: S.design.designIdeas, description: S.design.designIdeasTip }, onToggle: (on) => app.pane(on ? 'designer' : null) }],
      },
    ],
  };
}
