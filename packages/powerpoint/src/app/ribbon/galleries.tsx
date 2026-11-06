// Galeries partagees par plusieurs onglets : formes, dispositions, organiser, styles rapides, tableau.
import { useState } from 'react';
import { applyLayout, cssColor, SHAPE_GALLERY, type Color, type Fill, type Line } from '@forgeoffice/pptx';
import { Icon, type GalleryItem, type MenuItem } from '@forgeoffice/ui';
import { alignShapes, distributeShapes, flipShapes, groupShapes, reorder, rotateShapes, ungroup, type OrderMove } from '../../canvas/ops.ts';
import type { AlignMode } from '../../canvas/math.ts';
import { addSection, editSlides } from '../deck-ops.ts';
import type { Editor } from '../editor.ts';
import { GalleryGrid, PopupGallery, SmallButton, SmallMenu } from './PopupGallery.tsx';
import { LayoutThumb, ShapeIcon, type TabContext } from './common.tsx';
import { S } from '../../strings.ts';

/** Nom francais d'une forme predefinie. */
export function presetName(preset: string): string {
  for (const cat of SHAPE_GALLERY) for (const [id, name] of cat.shapes) if (id === preset) return name.split(' : ')[0] ?? name;
  return S.shapes.shape;
}

export function ShapesButton({ ctx, size = 'large', label = S.insert.shapes }: { ctx: TabContext; size?: 'large' | 'small'; label?: string }) {
  return (
    <PopupGallery label={label} icon="shapes" size={size} tooltip={S.insert.shapesTip}>
      {(close) => (
        <GalleryGrid
          columns={10}
          sections={SHAPE_GALLERY.map((cat) => ({ title: cat.category, items: cat.shapes.map(([id, name]) => ({ id, label: name, render: <ShapeIcon preset={id} size={22} /> })) }))}
          onPick={(id) => {
            close();
            ctx.app.drawShape(id);
          }}
        />
      )}
    </PopupGallery>
  );
}

/** Galerie des dispositions du masque (Nouvelle diapositive / Disposition). */
export function LayoutsButton({ ctx, mode }: { ctx: TabContext; mode: 'new' | 'apply' }) {
  const { ed } = ctx;
  const master = ed.deck.masters[0];
  const pick = (id: string): void => {
    if (mode === 'new') ed.newSlide(id);
    else {
      const ids = new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
      ed.commit(editSlides(ed.deck, ids, (slide) => applyLayout(ed.deck, slide, id)));
    }
  };
  return (
    <PopupGallery label={mode === 'new' ? S.slides.newSlide : S.slides.layout} icon={mode === 'new' ? 'slide_add' : 'slide_layout'} size={mode === 'new' ? 'large' : 'small'} onClick={mode === 'new' ? () => ed.newSlide() : undefined} tooltip={mode === 'new' ? S.slides.newSlideTip : S.slides.layoutTip}>
      {(close) => (
        <div>
          <GalleryGrid
            columns={3}
            sections={(ed.deck.masters.length ? ed.deck.masters : []).map((m) => ({
              title: m.theme.name,
              items: m.layouts.map((l) => ({
                id: l.id,
                label: l.name,
                render: (
                  <>
                    <LayoutThumb deck={ed.deck} layout={l} width={112} />
                    <span className="pp-popgal__caption">{l.name}</span>
                  </>
                ),
              })),
            }))}
            onPick={(id) => {
              close();
              pick(id);
            }}
          />
          {mode === 'new' && master && (
            <div className="pp-popgal__foot">
              <button type="button" onClick={() => { close(); if (ed.slide) ed.duplicateSlides([ed.slide.id]); }}>
                <Icon name="copy_add" size={16} /> {S.slides.duplicateSelected}
              </button>
            </div>
          )}
        </div>
      )}
    </PopupGallery>
  );
}

/** Grille de choix d'un tableau (Insertion > Tableau). */
export function TableGrid({ onPick, onMore }: { onPick: (rows: number, cols: number) => void; onMore: () => void }) {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  return (
    <div className="pp-tablegrid">
      <div>{hover[0] ? S.insert.tableSize(hover[1], hover[0]) : S.insert.tableInsert}</div>
      <div className="pp-tablegrid__cells" onMouseLeave={() => setHover([0, 0])}>
        {Array.from({ length: 80 }, (_, i) => {
          const r = Math.floor(i / 10) + 1;
          const c = (i % 10) + 1;
          return <span key={i} className={r <= hover[0] && c <= hover[1] ? 'is-on' : ''} onMouseEnter={() => setHover([r, c])} onClick={() => onPick(r, c)} />;
        })}
      </div>
      <div className="pp-popgal__foot">
        <button type="button" onClick={onMore}>
          <Icon name="table_add" size={16} /> {S.insert.tableMore}
        </button>
      </div>
    </div>
  );
}

/** Menu Organiser (ordre, grouper, aligner, faire pivoter, volet Selection). */
export function arrangeItems(ctx: TabContext): MenuItem[] {
  const { ed } = ctx;
  const ids = ed.selection.ids;
  const none = ids.length === 0;
  const order = (move: OrderMove) => () => ed.editShapes((shapes) => reorder(shapes, ids, move), 'order');
  const align = (mode: AlignMode) => () => ed.editShapes((shapes) => alignShapes(shapes, ids, mode, ids.length < 2 ? ed.deck.size : undefined), 'align');
  const groupIds = ed.selectedShapes.filter((x) => x.kind === 'group').map((x) => x.id);
  const group = groupIds.length > 0;
  return [
    { id: 'h1', kind: 'header', label: S.arrange.order },
    { id: 'front', label: S.arrange.front, icon: 'position_forward', disabled: none, onClick: order('front') },
    { id: 'back', label: S.arrange.back, icon: 'position_backward', disabled: none, onClick: order('back') },
    { id: 'forward', label: S.arrange.forward, icon: 'position_forward', disabled: none, onClick: order('forward') },
    { id: 'backward', label: S.arrange.backward, icon: 'position_backward', disabled: none, onClick: order('backward') },
    { id: 'h2', kind: 'header', label: S.arrange.groupHeader },
    {
      id: 'group', label: S.arrange.group, icon: 'group', shortcut: 'Ctrl+G', disabled: ids.length < 2,
      onClick: () => {
        let id: number | null = null;
        ed.editShapes((shapes) => {
          id = groupShapes(shapes, ids, S.canvas.groupName);
        }, 'group');
        if (id !== null) ed.setSelection({ ids: [id] });
      },
    },
    {
      id: 'ungroup', label: S.arrange.ungroup, icon: 'group_return', shortcut: 'Ctrl+Maj+G', disabled: !group,
      onClick: () => {
        let kept: number[] = ids.filter((i) => !groupIds.includes(i));
        ed.editShapes((shapes) => {
          for (const g of groupIds) kept = [...kept, ...ungroup(shapes, g)];
        }, 'ungroup');
        ed.setSelection({ ids: kept });
      },
    },
    { id: 'h3', kind: 'header', label: S.arrange.position },
    {
      id: 'align', label: S.arrange.align, icon: 'align_left', disabled: none,
      items: [
        { id: 'l', label: S.arrange.alignLeft, icon: 'align_left', onClick: align('left') },
        { id: 'c', label: S.arrange.alignCenter, icon: 'align_center_horizontal', onClick: align('center') },
        { id: 'r', label: S.arrange.alignRight, icon: 'align_right', onClick: align('right') },
        { id: 't', label: S.arrange.alignTop, icon: 'align_top', onClick: align('top') },
        { id: 'm', label: S.arrange.alignMiddle, onClick: align('middle') },
        { id: 'b', label: S.arrange.alignBottom, icon: 'align_bottom', onClick: align('bottom') },
        { id: 's', kind: 'separator' },
        { id: 'dh', label: S.arrange.distributeH, disabled: ids.length < 3 && ids.length > 1, onClick: () => ed.editShapes((shapes) => distributeShapes(shapes, ids, 'h', ids.length < 3 ? ed.deck.size : undefined), 'align') },
        { id: 'dv', label: S.arrange.distributeV, disabled: ids.length < 3 && ids.length > 1, onClick: () => ed.editShapes((shapes) => distributeShapes(shapes, ids, 'v', ids.length < 3 ? ed.deck.size : undefined), 'align') },
      ],
    },
    {
      id: 'rotate', label: S.arrange.rotate, icon: 'rotate_right', disabled: none,
      items: [
        { id: 'r90', label: S.arrange.rotateRight, icon: 'rotate_right', onClick: () => ed.editShapes((s) => rotateShapes(s, ids, 90), 'rotate') },
        { id: 'l90', label: S.arrange.rotateLeft, icon: 'rotate_left', onClick: () => ed.editShapes((s) => rotateShapes(s, ids, -90), 'rotate') },
        { id: 'fv', label: S.arrange.flipV, icon: 'flip_vertical', onClick: () => ed.editShapes((s) => flipShapes(s, ids, 'v'), 'flip') },
        { id: 'fh', label: S.arrange.flipH, icon: 'flip_horizontal', onClick: () => ed.editShapes((s) => flipShapes(s, ids, 'h'), 'flip') },
      ],
    },
    { id: 's9', kind: 'separator' },
    { id: 'pane', label: S.arrange.selectionPane, icon: 'layer', onClick: () => ctx.app.pane('selection') },
  ];
}

type Intensity = 'fill' | 'outline' | 'light' | 'intense' | 'subtle';
const SLOTS = ['tx1', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;

function quickStyle(slot: (typeof SLOTS)[number], intensity: Intensity): { fill: Fill; line: Line; text: 'bg1' | 'tx1' | (typeof SLOTS)[number] } {
  const c = (mods?: Array<[string, number]>) => ({ type: 'scheme' as const, value: slot, mods: mods?.map(([name, val]) => ({ name, val })) });
  switch (intensity) {
    case 'outline':
      return { fill: { type: 'solid', color: { type: 'scheme', value: 'bg1' } }, line: { width: 1, fill: { type: 'solid', color: c() } }, text: 'tx1' };
    case 'light':
      return { fill: { type: 'solid', color: c([['lumMod', 20000], ['lumOff', 80000]]) }, line: { width: 1, fill: { type: 'solid', color: c() } }, text: 'tx1' };
    case 'subtle':
      return { fill: { type: 'solid', color: c([['lumMod', 40000], ['lumOff', 60000]]) }, line: { fill: { type: 'none' } }, text: 'tx1' };
    case 'intense':
      return {
        fill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ position: 0, color: c([['lumMod', 110000]]) }, { position: 100, color: c([['shade', 70000]]) }] },
        line: { fill: { type: 'none' } },
        text: 'bg1',
      };
    default:
      return { fill: { type: 'solid', color: c() }, line: { width: 1, fill: { type: 'solid', color: c([['shade', 50000]]) } }, text: 'bg1' };
  }
}

/** Vignettes des styles rapides (7 couleurs x 5 intensites). */
export function quickStyleItems(ed: Editor): GalleryItem[] {
  const intensities: Intensity[] = ['outline', 'fill', 'light', 'subtle', 'intense'];
  return intensities.flatMap((intensity) =>
    SLOTS.map((slot) => {
      const st = quickStyle(slot, intensity);
      const fill = st.fill.type === 'solid' ? cssOf(ed, st.fill.color) : st.fill.type === 'gradient' ? `linear-gradient(${cssOf(ed, st.fill.stops[0]?.color)}, ${cssOf(ed, st.fill.stops[1]?.color)})` : 'transparent';
      const border = st.line.fill?.type === 'solid' ? `1px solid ${cssOf(ed, st.line.fill.color)}` : '1px solid transparent';
      return {
        id: `${slot}:${intensity}`,
        label: `${S.drawing.styleColor[slot]} - ${S.drawing.intensity[intensity]}`,
        render: () => <span style={{ width: 44, height: 28, background: fill, border, color: cssOf(ed, { type: 'scheme', value: st.text }), font: '600 13px var(--fo-font)', display: 'grid', placeItems: 'center', borderRadius: 2, boxSizing: 'border-box' }}>Abc</span>,
      };
    }),
  );
}

export function applyQuickStyle(ed: Editor, id: string): void {
  const [slot, intensity] = id.split(':') as [(typeof SLOTS)[number], Intensity];
  const st = quickStyle(slot, intensity);
  ed.editSelected((shape) => {
    if (shape.kind === 'shape' || shape.kind === 'group') shape.fill = structuredClone(st.fill);
    if (shape.kind === 'shape' || shape.kind === 'connector' || shape.kind === 'picture') shape.line = structuredClone(st.line);
    if (shape.kind !== 'shape' || !shape.text) return;
    for (const p of shape.text.paragraphs) {
      p.runs = p.runs.map((r) => ({ ...r, props: { ...r.props, color: { type: 'scheme', value: st.text } } }));
      p.endProps = { ...(p.endProps ?? {}), color: { type: 'scheme', value: st.text } };
    }
  }, 'style');
}

/** Galerie des formes en ligne (Accueil > Dessin, Format de la forme). */
export function shapeItems(): GalleryItem[] {
  return SHAPE_GALLERY.flatMap((cat) => cat.shapes.map(([id, name]) => ({ id, label: name, render: () => <ShapeIcon preset={id} size={20} /> })));
}

/** Groupe Diapositives : grand bouton Nouvelle diapositive + Disposition, Retablir, Section empiles. */
export function SlidesGroup({ ctx }: { ctx: TabContext }) {
  const { ed } = ctx;
  const ids = new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
  return (
    <span className="pp-rb-slides">
      <LayoutsButton ctx={ctx} mode="new" />
      <span className="pp-rb-stack">
        <LayoutsButton ctx={ctx} mode="apply" />
        <SmallButton label={S.slides.reset} icon="arrow_counterclockwise" tooltip={S.slides.resetTip} onClick={() => ed.commit(editSlides(ed.deck, ids, (s) => applyLayout(ed.deck, s, s.layoutId)))} />
        <SmallMenu
          label={S.slides.section}
          icon="tab"
          items={[
            { id: 'add', label: S.sections.add, icon: 'tab_add', onClick: () => ed.slide && ed.commit(addSection(ed.deck, ed.slide.id, S.sections.untitled)) },
            { id: 'removeAll', label: S.sections.removeAll, icon: 'delete', disabled: !ed.deck.sections.length, onClick: () => ed.commit({ ...ed.deck, sections: [] }) },
          ]}
        />
      </span>
    </span>
  );
}

function cssOf(ed: Editor, color: Color | undefined): string {
  return color ? cssColor(color, ed.ctx.theme, ed.ctx.colorMap) : 'transparent';
}
