import { createElement, type ReactNode } from 'react';
// Onglets Conception et Mise en page.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import type { PageMargins, Section } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { insertInline, insertPageBreak, mergeProps, setParagraph } from '../editor/commands.ts';
import {
  applyParagraphSpacing, applyStyleSet, applyTheme, pageColor, readWatermark, setCustomProp, THEME_PRESETS, PAGE_COLOR_PROP, WATERMARK_PROP,
  writeWatermark, type StyleSet,
} from '../features/design.ts';
import { cmLabel, cmToPt, ptToCm } from './shared.ts';

export const PAGE_SIZES: readonly { id: keyof typeof T.sizes; w: number; h: number }[] = [
  { id: 'a4', w: 595.3, h: 841.9 }, { id: 'a5', w: 419.55, h: 595.3 }, { id: 'a3', w: 841.9, h: 1190.55 },
  { id: 'letter', w: 612, h: 792 }, { id: 'legal', w: 612, h: 1008 }, { id: 'executive', w: 522, h: 756 },
];

const M = (top: number, right: number, bottom: number, left: number): Partial<PageMargins> => ({ top, right, bottom, left });
export const MARGIN_PRESETS: readonly { id: keyof typeof T.marginsPresets; m: Partial<PageMargins> }[] = [
  { id: 'normal', m: M(70.85, 70.85, 70.85, 70.85) }, { id: 'narrow', m: M(36, 36, 36, 36) }, { id: 'moderate', m: M(72, 54, 72, 54) },
  { id: 'wide', m: M(72, 144, 72, 144) }, { id: 'mirrored', m: M(72, 72, 72, 90) },
];

export function designTab(c: Ctl): RibbonTab {
  const { meta } = c;
  const th = T.themes;
  const themeNames = th as unknown as Record<string, string>;
  const wm = readWatermark(meta);
  const setWm = (text: string | null): void => c.updateMeta((m) => setCustomProp(m, WATERMARK_PROP, writeWatermark(text ? { text, color: '#C0C0C0', diagonal: true } : null)));
  const sets: [StyleSet, string][] = [['default', th.default], ['classic', th.classic], ['modern', th.modern], ['elegant', th.elegant]];
  const spacing: [string, number, number][] = [[th.default, 8, 1.08], [th.noSpacing, 0, 1], [th.compactSpacing, 4, 1], [th.relaxed, 10, 1.15], [th.doubleSpacing, 8, 2]];
  return {
    id: 'design', label: T.tabs.design, keytip: 'Ç',
    groups: [
      {
        id: 'docformat', label: T.groups.docFormat, icon: 'design_ideas',
        controls: [
          { kind: 'menu', id: 'themes', label: T.cmd.themes, icon: 'design_ideas', size: 'large', items: THEME_PRESETS.map((p): MenuItem => ({
            id: p.id, label: themeNames[p.id] ?? p.id, checked: meta.theme.majorFont === p.majorFont && meta.theme.colors.accent1 === p.colors.accent1,
            adornment: swatches(p.colors.accent1, p.colors.accent2, p.colors.accent3),
            onClick: () => c.updateMeta((m) => applyTheme(m, { colors: p.colors, majorFont: p.majorFont, minorFont: p.minorFont }, themeNames[p.id])),
          })) },
          { kind: 'menu', id: 'stylesets', label: T.groups.styles, icon: 'text_font', size: 'large', items: sets.map(([id, label]) => ({ id, label, onClick: () => c.updateMeta((m) => applyStyleSet(m, id)) })) },
          { kind: 'menu', id: 'colors', label: T.cmd.colors, icon: 'color', items: THEME_PRESETS.map((p) => ({
            id: p.id, label: themeNames[p.id] ?? p.id, adornment: swatches(p.colors.accent1, p.colors.accent2, p.colors.accent3, p.colors.accent4),
            onClick: () => c.updateMeta((m) => applyTheme(m, { colors: p.colors })),
          })) },
          { kind: 'menu', id: 'fonts', label: T.cmd.fonts, icon: 'text_font', items: THEME_PRESETS.map((p) => ({
            id: p.id, label: `${p.majorFont} / ${p.minorFont}`, onClick: () => c.updateMeta((m) => applyTheme(m, { majorFont: p.majorFont, minorFont: p.minorFont })),
          })) },
          { kind: 'menu', id: 'paraspacing', label: T.cmd.paraSpacing, icon: 'text_line_spacing', items: spacing.map(([label, after, line]) => ({
            id: label, label, onClick: () => c.updateMeta((m) => applyParagraphSpacing(m, after, line)),
          })) },
        ],
      },
      {
        id: 'background', label: T.groups.background, icon: 'color_background',
        controls: [
          { kind: 'menu', id: 'watermark', label: T.cmd.watermark, icon: 'text_effects', size: 'large', items: [
            ...Object.entries(T.watermarks).map(([id, text]): MenuItem => ({ id, label: text, checked: wm?.text === text, onClick: () => setWm(text) })),
            { id: 's', kind: 'separator' },
            { id: 'custom', label: T.cmd.customWatermark, onClick: () => c.openDialog('watermark') },
            { id: 'remove', label: T.cmd.removeWatermark, icon: 'delete', onClick: () => setWm(null) },
          ] },
          { kind: 'color', id: 'pagecolor', label: T.cmd.pageColor, icon: 'color_fill', size: 'large', value: pageColor(meta) ?? '#F2F2F2', emptyMode: 'none', onChange: (hex) => c.updateMeta((m) => setCustomProp(m, PAGE_COLOR_PROP, hex)) },
          { kind: 'button', id: 'pageborders', label: T.cmd.pageBorders, icon: 'border_outside', size: 'large', onClick: () => c.openDialog('pageBorder') },
        ],
      },
    ],
  };
}

function swatches(...colors: string[]): ReactNode {
  return createElement('span', { className: 'fo-word-swatches' }, colors.map((col) => createElement('span', { key: col, style: { background: `#${col}` } })));
}

export function layoutTab(c: Ctl): RibbonTab {
  const s = c.section;
  const p = c.sel.para;
  const cmd = T.cmd;
  const set = (patch: Partial<Section>): void => c.act.setSection(patch);
  const sameMargins = (m: Partial<PageMargins>): boolean => Math.abs((m.left ?? 0) - s.margins.left) < 1 && Math.abs((m.top ?? 0) - s.margins.top) < 1;
  const columns = (count: number, widths?: { width: number; space: number }[]): Partial<Section> => ({ columns: { count, space: 35.4, equalWidth: !widths, separator: s.columns.separator, widths } });
  const textWidth = s.pageWidth - s.margins.left - s.margins.right;
  return {
    id: 'layout', label: T.tabs.layout, keytip: 'P',
    groups: [
      {
        id: 'pagesetup', label: T.groups.pageSetup, icon: 'document_margins', launcher: { label: T.dialogs.pageSetup, onClick: () => c.openDialog('pageSetup') },
        controls: [
          { kind: 'menu', id: 'margins', label: cmd.margins, icon: 'document_margins', size: 'large', items: [
            ...MARGIN_PRESETS.map((mp): MenuItem => ({
              id: mp.id, label: `${T.marginsPresets[mp.id]} — ${cmLabel(mp.m.top ?? 0)} / ${cmLabel(mp.m.left ?? 0)} cm`, checked: sameMargins(mp.m),
              onClick: () => set({ margins: { ...s.margins, ...mp.m } }),
            })),
            { id: 's', kind: 'separator' },
            { id: 'custom', label: cmd.customMargins, onClick: () => c.openDialog('pageSetup') },
          ] },
          { kind: 'menu', id: 'orientation', label: cmd.orientation, icon: 'orientation', size: 'large', items: [
            { id: 'portrait', label: cmd.portrait, icon: 'document', checked: s.orientation === 'portrait', onClick: () => s.orientation !== 'portrait' && set({ orientation: 'portrait', pageWidth: s.pageHeight, pageHeight: s.pageWidth }) },
            { id: 'landscape', label: cmd.landscape, icon: 'document_landscape', checked: s.orientation === 'landscape', onClick: () => s.orientation !== 'landscape' && set({ orientation: 'landscape', pageWidth: s.pageHeight, pageHeight: s.pageWidth }) },
          ] },
          { kind: 'menu', id: 'size', label: cmd.pageSize, icon: 'page_fit', size: 'large', items: PAGE_SIZES.map((ps) => {
            const [w, h] = s.orientation === 'landscape' ? [ps.h, ps.w] : [ps.w, ps.h];
            return { id: ps.id, label: `${T.sizes[ps.id]} — ${cmLabel(ps.w)} x ${cmLabel(ps.h)} cm`, checked: Math.abs(s.pageWidth - w) < 2 && Math.abs(s.pageHeight - h) < 2, onClick: () => set({ pageWidth: w, pageHeight: h }) };
          }) },
          { kind: 'menu', id: 'columns', label: cmd.columns, icon: 'text_column_two_left', size: 'large', items: [
            { id: 'c1', label: T.columnsPresets.one, checked: s.columns.count === 1, onClick: () => set(columns(1)) },
            { id: 'c2', label: T.columnsPresets.two, checked: s.columns.count === 2 && s.columns.equalWidth, onClick: () => set(columns(2)) },
            { id: 'c3', label: T.columnsPresets.three, checked: s.columns.count === 3, onClick: () => set(columns(3)) },
            { id: 'cl', label: T.columnsPresets.left, onClick: () => set(columns(2, [{ width: (textWidth - 35.4) / 3, space: 35.4 }, { width: ((textWidth - 35.4) * 2) / 3, space: 0 }])) },
            { id: 'cr', label: T.columnsPresets.right, onClick: () => set(columns(2, [{ width: ((textWidth - 35.4) * 2) / 3, space: 35.4 }, { width: (textWidth - 35.4) / 3, space: 0 }])) },
            { id: 's', kind: 'separator' },
            { id: 'line', label: T.dialogs.columnsLine, checked: s.columns.separator, onClick: () => set({ columns: { ...s.columns, separator: !s.columns.separator } }) },
          ] },
          { kind: 'menu', id: 'breaks', label: cmd.breaks, icon: 'document_page_break', items: [
            { id: 'page', label: cmd.pageBreak, shortcut: 'Ctrl+Entrée', onClick: () => c.run(insertPageBreak) },
            { id: 'column', label: cmd.columnBreak, shortcut: 'Ctrl+Maj+Entrée', onClick: () => c.run(insertInline({ type: 'break', kind: 'column' })) },
            { id: 's', kind: 'separator' },
            { id: 'next', label: cmd.sectionNext, onClick: () => c.act.setSection({ breakType: 'nextPage', extra: undefined }) },
            { id: 'cont', label: cmd.sectionContinuous, onClick: () => c.act.setSection({ breakType: 'continuous', extra: undefined }) },
            { id: 'even', label: cmd.sectionEven, onClick: () => c.act.setSection({ breakType: 'evenPage', extra: undefined }) },
            { id: 'odd', label: cmd.sectionOdd, onClick: () => c.act.setSection({ breakType: 'oddPage', extra: undefined }) },
          ] },
          { kind: 'menu', id: 'linenumbers', label: cmd.lineNumbers, icon: 'text_number_list_ltr', items: [
            { id: 'opts', label: X.lineNo.menu, onClick: () => c.openDialog('lineNumbers') },
            { id: 'none', label: cmd.lineNumbersNone, checked: !s.lineNumbering, onClick: () => set({ lineNumbering: undefined }) },
            { id: 'cont', label: cmd.lineNumbersContinuous, checked: s.lineNumbering?.restart === 'continuous', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'continuous' } }) },
            { id: 'page', label: cmd.lineNumbersPage, checked: s.lineNumbering?.restart === 'newPage', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'newPage' } }) },
          ] },
          { kind: 'toggle', id: 'hyphen', label: cmd.hyphenation, icon: 'text_wrap', pressed: c.meta.settings.autoHyphenation, onToggle: (v) => c.updateMeta((m) => ({ ...m, settings: { ...m.settings, autoHyphenation: v } })) },
        ],
      },
      {
        id: 'paragraph', label: T.groups.paragraph, icon: 'text_paragraph', launcher: { label: T.dialogs.paragraph, onClick: () => c.openDialog('paragraph') },
        controls: [
          { kind: 'number', id: 'indleft', label: cmd.indentLeft, value: ptToCm(p.indentLeft ?? 0), min: -10, max: 30, step: 0.1, unit: 'cm', width: 64, onChange: (v) => c.run(setParagraph({ props: { indentLeft: cmToPt(v) || undefined } })) },
          { kind: 'number', id: 'indright', label: cmd.indentRight, value: ptToCm(p.indentRight ?? 0), min: -10, max: 30, step: 0.1, unit: 'cm', width: 64, onChange: (v) => c.run(setParagraph({ props: { indentRight: cmToPt(v) || undefined } })) },
          { kind: 'number', id: 'before', label: cmd.spaceBefore, value: p.spacingBefore ?? 0, min: 0, max: 1584, step: 6, unit: 'pt', width: 64, onChange: (v) => c.run(setParagraph({ props: (pp) => mergeProps(pp, { spacingBefore: v }) })) },
          { kind: 'number', id: 'after', label: cmd.spaceAfter, value: p.spacingAfter ?? 0, min: 0, max: 1584, step: 6, unit: 'pt', width: 64, onChange: (v) => c.run(setParagraph({ props: (pp) => mergeProps(pp, { spacingAfter: v }) })) },
        ],
      },
    ],
  };
}
