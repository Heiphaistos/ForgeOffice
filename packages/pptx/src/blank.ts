// Presentation vierge : theme Office 2024, masque et 11 dispositions standard (noms francais), toute taille.
import type { BodyProps, ListStyle, Paragraph, ParagraphProps, RunProps } from './dml.ts';
import type { AutoShape, Deck, Layout, LayoutType, Master, Placeholder, PlaceholderType } from './model.ts';
import { DEFAULT_COLOR_MAP } from './color.ts';
import { addSlide } from './edit.ts';
import { LAYOUT_NAMES, PLACEHOLDER_NAMES, STRINGS } from './strings.ts';
import { office2024Theme } from './theme.ts';
import { SLIDE_SIZES, sizeFromPreset, type SlideSize, type SlideSizePreset } from './units.ts';

/** Rectangle en EMU dans le repere 16:9 de reference (12192000 x 6858000). */
type RefRect = [number, number, number, number];

const REF_W = 12192000;
const REF_H = 6858000;

interface Scale {
  x: number;
  y: number;
  font: number;
}

function scaleFor(size: SlideSize): Scale {
  const x = size.width / (REF_W / 12700);
  const y = size.height / (REF_H / 12700);
  const mean = Math.sqrt(x * y);
  // Les formats proches de l'ecran gardent les tailles de police d'Office (44 pt pour le titre en 4:3 aussi).
  return { x, y, font: mean >= 0.85 && mean <= 1.2 ? 1 : mean };
}

const fontSize = (pt: number, scale: Scale): number => Math.max(1, Math.round(pt * scale.font * 2) / 2);

const tx1Tint: RunProps['color'] = { type: 'scheme', value: 'tx1', mods: [{ name: 'tint', val: 75000 }] };

function rect(r: RefRect, s: Scale): AutoShape['xfrm'] {
  const round = (v: number): number => Math.round(v * 100) / 100;
  return { x: round((r[0] / 12700) * s.x), y: round((r[1] / 12700) * s.y), width: round((r[2] / 12700) * s.x), height: round((r[3] / 12700) * s.y) };
}

const text = (value: string, level?: number): Paragraph => ({ props: level ? { level } : {}, runs: [{ type: 'text', text: value, props: { lang: 'fr-FR' } }] });

const fieldParagraph = (fieldType: string, value: string, id: string): Paragraph => ({
  props: {},
  runs: [{ type: 'field', fieldType, id, text: value, props: { lang: 'fr-FR' } }],
  endProps: { lang: 'fr-FR' },
});

interface PlaceholderSpec {
  type: PlaceholderType;
  index?: number;
  size?: Placeholder['size'];
  orientation?: Placeholder['orientation'];
  at?: RefRect;
  body?: BodyProps;
  level1?: ParagraphProps;
  paragraphs?: Paragraph[];
}

function placeholderShape(id: number, spec: PlaceholderSpec, s: Scale): AutoShape {
  const placeholder: Placeholder = { type: spec.type };
  if (spec.index !== undefined) placeholder.index = spec.index;
  if (spec.size) placeholder.size = spec.size;
  if (spec.orientation) placeholder.orientation = spec.orientation;
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: `${PLACEHOLDER_NAMES[spec.type]} ${id - 1}`,
    placeholder,
    locks: { noGrp: true },
    geometry: { type: 'preset', preset: 'rect' },
    text: { props: spec.body ?? {}, paragraphs: spec.paragraphs ?? [{ props: {}, runs: [] }] },
  };
  if (spec.at) shape.xfrm = rect(spec.at, s);
  if (spec.level1 && shape.text) shape.text.listStyle = { levels: { 0: spec.level1 } };
  return shape;
}

const promptTitle = (): Paragraph[] => [text(STRINGS.promptTitle)];
const promptBody = (): Paragraph[] => [text(STRINGS.promptBody), ...STRINGS.promptLevels.map((label, i) => text(label, i + 1))];
const promptSubtitle = (): Paragraph[] => [text(STRINGS.promptSubtitle)];

const DATE_FIELD = '{8B3D2A61-0F1B-4F5C-9E2B-4D7C1A2B3C01}';
const NUMBER_FIELD = '{8B3D2A61-0F1B-4F5C-9E2B-4D7C1A2B3C02}';

function footerSpecs(dateIndex: number, footerIndex: number, numberIndex: number, s: Scale, withGeometry: boolean): PlaceholderSpec[] {
  const today = new Date();
  const date = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const small = (align: ParagraphProps['align']): ParagraphProps => ({ align, defaultRun: { size: fontSize(12, s), color: tx1Tint } });
  return [
    { type: 'dt', size: 'half', index: dateIndex, at: withGeometry ? [838200, 6356350, 2743200, 365125] : undefined, body: withGeometry ? { anchor: 'ctr' } : undefined, level1: withGeometry ? small('l') : undefined, paragraphs: [fieldParagraph('datetimeFigureOut', date, DATE_FIELD)] },
    { type: 'ftr', size: 'quarter', index: footerIndex, at: withGeometry ? [4038600, 6356350, 4114800, 365125] : undefined, body: withGeometry ? { anchor: 'ctr' } : undefined, level1: withGeometry ? small('ctr') : undefined },
    { type: 'sldNum', size: 'quarter', index: numberIndex, at: withGeometry ? [8610600, 6356350, 2743200, 365125] : undefined, body: withGeometry ? { anchor: 'ctr' } : undefined, level1: withGeometry ? small('r') : undefined, paragraphs: [fieldParagraph('slidenum', STRINGS.slideNumberField, NUMBER_FIELD)] },
  ];
}

const TITLE: RefRect = [838200, 365125, 10515600, 1325563];
const BODY: RefRect = [838200, 1825625, 10515600, 4351338];

function layoutSpecs(type: LayoutType, s: Scale): PlaceholderSpec[] {
  const big = (pt: number, extra: ParagraphProps = {}): ParagraphProps => ({ ...extra, defaultRun: { ...(extra.defaultRun ?? {}), size: fontSize(pt, s) } });
  const noBullet = (pt: number, extra: ParagraphProps = {}): ParagraphProps => big(pt, { marginLeft: 0, indent: 0, bullet: { type: 'none' }, ...extra });
  const title: PlaceholderSpec = { type: 'title', paragraphs: promptTitle() };
  const body = (index: number, at?: RefRect, size?: Placeholder['size']): PlaceholderSpec => ({ type: 'obj', index, at, size, paragraphs: promptBody() });
  switch (type) {
    case 'title':
      return [
        { type: 'ctrTitle', at: [1524000, 1122363, 9144000, 2387600], body: { anchor: 'b' }, level1: big(60, { align: 'ctr' }), paragraphs: promptTitle() },
        { type: 'subTitle', index: 1, at: [1524000, 3602038, 9144000, 1655762], level1: noBullet(24, { align: 'ctr' }), paragraphs: promptSubtitle() },
      ];
    case 'obj':
      return [title, body(1)];
    case 'secHead':
      return [
        { type: 'title', at: [831850, 1709738, 10515600, 2852737], body: { anchor: 'b' }, level1: big(60), paragraphs: promptTitle() },
        { type: 'body', index: 1, at: [831850, 4589463, 10515600, 1500187], level1: noBullet(24, { defaultRun: { color: tx1Tint } }), paragraphs: [text(STRINGS.promptBody)] },
      ];
    case 'twoObj':
      return [title, body(1, [838200, 1825625, 5181600, 4351338], 'half'), body(2, [6172200, 1825625, 5181600, 4351338], 'half')];
    case 'twoTxTwoObj':
      return [
        { type: 'title', at: [839788, 365125, 10515600, 1325563], paragraphs: promptTitle() },
        { type: 'body', index: 1, at: [839788, 1681163, 5157787, 823912], body: { anchor: 'b' }, level1: noBullet(24, { defaultRun: { bold: true } }), paragraphs: [text(STRINGS.promptBody)] },
        body(2, [839788, 2505075, 5157787, 3684588], 'half'),
        { type: 'body', index: 3, size: 'quarter', at: [6172200, 1681163, 5183188, 823912], body: { anchor: 'b' }, level1: noBullet(24, { defaultRun: { bold: true } }), paragraphs: [text(STRINGS.promptBody)] },
        body(4, [6172200, 2505075, 5183188, 3684588], 'quarter'),
      ];
    case 'titleOnly':
      return [title];
    case 'blank':
      return [];
    case 'objTx':
    case 'picTx': {
      const caption: PlaceholderSpec = { type: 'body', index: 2, size: 'half', at: [839788, 2057400, 3932237, 3811588], level1: noBullet(16), paragraphs: [text(STRINGS.promptBody)] };
      const main: PlaceholderSpec =
        type === 'picTx'
          ? { type: 'pic', index: 1, at: [5183188, 987425, 6172200, 4873625], level1: noBullet(32), paragraphs: [text(STRINGS.promptPicture)] }
          : { ...body(1, [5183188, 987425, 6172200, 4873625]), level1: big(32) };
      return [{ type: 'title', at: [839788, 457200, 3932237, 1600200], body: { anchor: 'b' }, level1: big(32), paragraphs: promptTitle() }, main, caption];
    }
    case 'vertTx':
      return [title, { type: 'body', index: 1, orientation: 'vert', body: { vertical: 'eaVert' }, paragraphs: promptBody() }];
    case 'vertTitleAndTx':
      return [
        { type: 'title', orientation: 'vert', at: [8724900, 365125, 2628900, 5811838], body: { vertical: 'eaVert' }, paragraphs: promptTitle() },
        { type: 'body', index: 1, orientation: 'vert', at: [838200, 365125, 7734300, 5811838], body: { vertical: 'eaVert' }, paragraphs: promptBody() },
      ];
    default:
      return [title, body(1)];
  }
}

export const STANDARD_LAYOUTS: readonly LayoutType[] = ['title', 'obj', 'secHead', 'twoObj', 'twoTxTwoObj', 'titleOnly', 'blank', 'objTx', 'picTx', 'vertTx', 'vertTitleAndTx'];

/** Construit une disposition standard pour la taille donnee. */
export function standardLayout(type: LayoutType, id: string, size: SlideSize): Layout {
  const s = scaleFor(size);
  const specs = [...layoutSpecs(type, s), ...footerSpecs(10, 11, 12, s, false)];
  return {
    id,
    name: LAYOUT_NAMES[type] ?? type,
    type,
    preserve: true,
    shapes: specs.map((spec, i) => placeholderShape(i + 2, spec, s)),
  };
}

function level(marginEmu: number, sizePt: number, s: Scale, before: number): ParagraphProps {
  return {
    marginLeft: (marginEmu / 12700) * s.x,
    indent: (-228600 / 12700) * s.x,
    align: 'l',
    defaultTabSize: (914400 / 12700) * s.x,
    rtl: false,
    eastAsianLineBreak: true,
    latinLineBreak: false,
    hangingPunctuation: true,
    lineSpacing: { type: 'pct', value: 90 },
    spaceBefore: { type: 'pts', value: before },
    bulletFont: 'Arial',
    bullet: { type: 'char', char: '•' },
    defaultRun: { size: fontSize(sizePt, s), kern: 12, color: { type: 'scheme', value: 'tx1' }, font: '+mn-lt', eastAsianFont: '+mn-ea', complexFont: '+mn-cs' },
  };
}

function plainLevels(s: Scale): ListStyle {
  const style: ListStyle = { def: { defaultRun: { lang: 'fr-FR' } }, levels: {} };
  for (let i = 0; i < 9; i++) {
    style.levels[i] = {
      marginLeft: ((457200 * i) / 12700) * s.x,
      align: 'l',
      defaultTabSize: (914400 / 12700) * s.x,
      rtl: false,
      eastAsianLineBreak: true,
      latinLineBreak: false,
      hangingPunctuation: true,
      defaultRun: { size: fontSize(18, s), kern: 12, color: { type: 'scheme', value: 'tx1' }, font: '+mn-lt', eastAsianFont: '+mn-ea', complexFont: '+mn-cs' },
    };
  }
  return style;
}

/** Styles de texte du masque Office (titre 44 pt, corps 28/24/20/18 pt, puces •). */
export function standardTextStyles(size: SlideSize): Master['textStyles'] {
  const s = scaleFor(size);
  const title: ListStyle = {
    levels: {
      0: {
        align: 'l',
        defaultTabSize: (914400 / 12700) * s.x,
        rtl: false,
        eastAsianLineBreak: true,
        latinLineBreak: false,
        hangingPunctuation: true,
        lineSpacing: { type: 'pct', value: 90 },
        spaceBefore: { type: 'pct', value: 0 },
        bullet: { type: 'none' },
        defaultRun: { size: fontSize(44, s), kern: 12, color: { type: 'scheme', value: 'tx1' }, font: '+mj-lt', eastAsianFont: '+mj-ea', complexFont: '+mj-cs' },
      },
    },
  };
  const sizes = [28, 24, 20, 18, 18, 18, 18, 18, 18];
  const body: ListStyle = { levels: {} };
  sizes.forEach((pt, i) => {
    body.levels[i] = level(228600 + 457200 * i, pt, s, i === 0 ? 10 : 5);
  });
  return { title, body, other: plainLevels(s) };
}

/** Masque Office complet : titre, corps, date, pied de page, numero, 11 dispositions. */
export function standardMaster(size: SlideSize): Master {
  const s = scaleFor(size);
  const specs: PlaceholderSpec[] = [
    { type: 'title', at: TITLE, body: { vertical: 'horz', insets: { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 }, rtlColumns: false, anchor: 'ctr', autofit: { type: 'normal' } }, paragraphs: promptTitle() },
    { type: 'body', index: 1, at: BODY, body: { vertical: 'horz', insets: { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 }, rtlColumns: false, autofit: { type: 'normal' } }, paragraphs: promptBody() },
    ...footerSpecs(2, 3, 4, s, true),
  ];
  return {
    id: 'master1',
    name: STRINGS.masterName,
    theme: office2024Theme(),
    background: { type: 'ref', index: 1001, color: { type: 'scheme', value: 'bg1' } },
    shapes: specs.map((spec, i) => placeholderShape(i + 2, spec, s)),
    colorMap: { ...DEFAULT_COLOR_MAP },
    textStyles: standardTextStyles(size),
    layouts: STANDARD_LAYOUTS.map((type, i) => standardLayout(type, `layout${i + 1}`, size)),
  };
}

export interface BlankDeckOptions {
  /** Ajoute une diapositive de titre (comme « Nouvelle presentation » d'Office). Vrai par defaut. */
  titleSlide?: boolean;
  /** Orientation forcee pour un format predefini. */
  orientation?: 'portrait' | 'landscape';
}

/** Presentation vierge pour un format predefini (16:9 par defaut) ou une taille libre en points. */
export function createBlankDeck(size: SlideSize | SlideSizePreset = 'widescreen', options: BlankDeckOptions = {}): Deck {
  const slideSize = typeof size === 'string' ? sizeFromPreset(size, options.orientation) : { ...size };
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const s = scaleFor(slideSize);
  const deck: Deck = {
    properties: { title: '', creator: STRINGS.defaultAuthor, lastModifiedBy: STRINGS.defaultAuthor, created: now, modified: now, revision: '1', application: STRINGS.application },
    size: slideSize,
    notesSize: { width: 540, height: 720 },
    masters: [standardMaster(slideSize)],
    slides: [],
    media: {},
    defaultTextStyle: plainLevels(s),
    sections: [],
    format: 'pptx',
    preserved: {},
  };
  if (options.titleSlide !== false) addSlide(deck, 'layout1');
  return deck;
}

export { SLIDE_SIZES };
