// Blocs de construction (onglet Insertion) : titres, encadres, coupons, calendriers, accents. Sans DOM.
import { addTable, type Shape, type Slide } from '@forgeoffice/pptx';
import { addLine, addShape, addText, MAJOR, MINOR, NO_FILL, para, sc, solid, type Box4 } from './build.ts';
import { MONTHS, WEEKDAYS, monthGrid } from './calendar.ts';
import type { Rect } from './geom.ts';

export type BlockGroup = 'headings' | 'sidebars' | 'coupons' | 'calendars' | 'accents';

export interface BlockDef {
  id: string;
  group: BlockGroup;
  /** Taille naturelle (pt). */
  width: number;
  height: number;
  /** Ajoute les formes dans le cadre ; renvoie les identifiants crees. */
  build: (shapes: Shape[], at: Rect, minId: number) => number[];
}

const tx = (size: number, extra = {}) => ({ font: MINOR, size, color: sc('tx1'), lang: 'fr-FR', ...extra });
const hd = (size: number, extra = {}) => ({ font: MAJOR, size, bold: true, color: sc('tx2'), lang: 'fr-FR', ...extra });
const box = (r: Rect, dx = 0, dy = 0, w = r.width, h = r.height): Box4 => [r.x + dx, r.y + dy, w, h];

function collect(shapes: Shape[], add: () => void): number[] {
  const before = new Set(shapes.map((s) => s.id));
  add();
  return shapes.filter((s) => !before.has(s.id)).map((s) => s.id);
}

export interface BlockText {
  heading: string;
  sub: string;
  sidebar: string;
  sidebarText: string;
  coupon: string;
  couponText: string;
  couponCut: string;
  quote: string;
}

export function blockCatalog(t: BlockText, year: number, month: number): BlockDef[] {
  return [
    {
      id: 'heading-bar', group: 'headings', width: 420, height: 70,
      build: (s, r, m) => collect(s, () => {
        addShape(s, box(r, 0, 0, 8, r.height), solid(sc('accent1')), { minId: m });
        addText(s, box(r, 16, 0, r.width - 16, r.height * 0.62), [para(t.heading, hd(26))], {}, { minId: m, anchor: 'b' });
        addText(s, box(r, 16, r.height * 0.62, r.width - 16, r.height * 0.38), [para(t.sub, tx(12, { color: sc('accent1'), italic: true }))], {}, { minId: m });
      }),
    },
    {
      id: 'heading-band', group: 'headings', width: 420, height: 56,
      build: (s, r, m) => collect(s, () => {
        addText(s, box(r), [para(t.heading.toUpperCase(), hd(22, { color: sc('bg1'), spacing: 1.5 }), { align: 'ctr' })], {}, { minId: m, anchor: 'ctr', fill: solid(sc('tx2')) });
      }),
    },
    {
      id: 'heading-rule', group: 'headings', width: 420, height: 60,
      build: (s, r, m) => collect(s, () => {
        addText(s, box(r, 0, 0, r.width, r.height - 8), [para(t.heading, hd(24, { color: sc('accent1') }))], {}, { minId: m, anchor: 'b' });
        addLine(s, r.x, r.y + r.height - 4, r.x + r.width, r.y + r.height - 4, sc('accent2'), 2, undefined, m);
      }),
    },
    {
      id: 'sidebar-tint', group: 'sidebars', width: 180, height: 220,
      build: (s, r, m) => collect(s, () => {
        addText(s, box(r), [para(t.sidebar, hd(14, { color: sc('accent1') }), { spaceAfter: { type: 'pts', value: 6 } }), para(t.sidebarText, tx(10.5))], {}, { minId: m, fill: solid(sc('accent1', [{ name: 'lumMod', val: 20000 }, { name: 'lumOff', val: 80000 }])), insets: { left: 12, top: 12, right: 12, bottom: 12 } });
      }),
    },
    {
      id: 'sidebar-frame', group: 'sidebars', width: 180, height: 200,
      build: (s, r, m) => collect(s, () => {
        addText(s, box(r), [para(t.sidebar, hd(14), { spaceAfter: { type: 'pts', value: 6 } }), para(t.sidebarText, tx(10.5))], {}, { minId: m, line: { fill: solid(sc('accent1')), width: 1.5 }, insets: { left: 12, top: 12, right: 12, bottom: 12 } });
      }),
    },
    {
      id: 'pull-quote', group: 'sidebars', width: 260, height: 110,
      build: (s, r, m) => collect(s, () => {
        addLine(s, r.x, r.y, r.x + r.width, r.y, sc('accent1'), 2, undefined, m);
        addText(s, box(r, 0, 6, r.width, r.height - 12), [para(t.quote, tx(16, { italic: true, color: sc('accent1') }), { align: 'ctr' })], {}, { minId: m, anchor: 'ctr' });
        addLine(s, r.x, r.y + r.height, r.x + r.width, r.y + r.height, sc('accent1'), 2, undefined, m);
      }),
    },
    {
      id: 'coupon-dashed', group: 'coupons', width: 300, height: 130,
      build: (s, r, m) => collect(s, () => {
        addShape(s, box(r), NO_FILL, { line: { fill: solid(sc('tx2')), width: 1.25, dash: 'dash' }, minId: m, name: 'Coupon' });
        addText(s, box(r, 12, 10, r.width - 24, r.height - 20), [para(t.coupon, hd(16, { color: sc('accent1') }), { align: 'ctr' }), para(t.couponText, hd(20), { align: 'ctr' }), para(t.couponCut, tx(8.5, { color: sc('tx2') }), { align: 'ctr', spaceBefore: { type: 'pts', value: 6 } })], {}, { minId: m, anchor: 'ctr' });
      }),
    },
    {
      id: 'coupon-ticket', group: 'coupons', width: 300, height: 120,
      build: (s, r, m) => collect(s, () => {
        addShape(s, box(r), solid(sc('accent2')), { preset: 'plaque', minId: m, name: 'Bon' });
        addText(s, box(r, 16, 8, r.width - 32, r.height - 16), [para(t.couponText, hd(20, { color: sc('bg1') }), { align: 'ctr' }), para(t.couponCut, tx(8.5, { color: sc('bg1') }), { align: 'ctr' })], {}, { minId: m, anchor: 'ctr' });
      }),
    },
    {
      id: 'calendar-month', group: 'calendars', width: 260, height: 210,
      build: (s, r, m) => collect(s, () => {
        addText(s, box(r, 0, 0, r.width, 30), [para(`${MONTHS[month]} ${year}`, hd(16, { color: sc('accent1') }), { align: 'ctr' })], {}, { minId: m, anchor: 'ctr' });
        const weeks = monthGrid(year, month);
        const values = [[...WEEKDAYS].map((d) => d.slice(0, 2)), ...weeks.map((w) => w.map((d) => (d === null ? '' : String(d))))];
        const table = addTable({ shapes: s } as Slide, values.length, 7, { x: r.x, y: r.y + 34, width: r.width, height: r.height - 34 }, values);
        if (table.id < m) table.id = Math.max(m, ...s.map((x) => x.id + 1));
        for (const row of table.table.rows) for (const cell of row.cells) for (const p of cell.text.paragraphs) {
          p.props = { ...p.props, align: 'ctr' };
          for (const run of p.runs) run.props = { ...run.props, size: 9 };
        }
      }),
    },
    {
      id: 'accent-dots', group: 'accents', width: 420, height: 14,
      build: (s, r, m) => collect(s, () => {
        addLine(s, r.x, r.y + r.height / 2, r.x + r.width, r.y + r.height / 2, sc('accent1'), 1, undefined, m);
        for (const f of [0.5 - 0.04, 0.5, 0.5 + 0.04]) addShape(s, [r.x + r.width * f - 4, r.y + r.height / 2 - 4, 8, 8], solid(sc('accent2')), { preset: 'ellipse', minId: m });
      }),
    },
    {
      id: 'accent-frame', group: 'accents', width: 300, height: 200,
      build: (s, r, m) => collect(s, () => {
        addShape(s, box(r), NO_FILL, { line: { fill: solid(sc('accent1')), width: 3, compound: 'dbl' }, minId: m, name: 'Bordure' });
      }),
    },
  ];
}
