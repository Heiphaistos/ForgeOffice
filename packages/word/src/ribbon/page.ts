import { createElement, type ReactNode } from 'react';
// Onglets Conception et Mise en page.
import { isOnlyOffice, type MenuItem, type RibbonTab } from '@forgeoffice/ui';
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

// Profil OnlyOffice : memes entrees que ses menus (nom en gras + detail sur deux lignes), memes valeurs.
const CM = 28.3465;
const ooCm = (v: number): string => `${Number(v.toFixed(2))} cm`;
const OO_MARGINS: readonly { id: string; label: string; top: number; bottom: number; left: number; right: number }[] = [
  { id: 'oo-normal', label: 'Normal', top: 2, bottom: 2, left: 3, right: 1.5 },
  { id: 'oo-narrow', label: 'Étroit', top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 },
  { id: 'oo-moderate', label: 'Modéré', top: 2.54, bottom: 2.54, left: 1.91, right: 1.91 },
  { id: 'oo-wide', label: 'Large', top: 2.54, bottom: 2.54, left: 5.08, right: 5.08 },
];
const OO_SIZES: readonly [string, number, number][] = [
  ['US Letter', 215.9, 279.4], ['US Legal', 215.9, 355.6], ['A4', 210, 297], ['A5', 148, 210], ['B5', 176, 250], ['Envelope #10', 104.8, 241.3],
  ['Envelope DL', 110, 220], ['Tabloid', 279.4, 431.8], ['A3', 297, 420], ['Tabloid Oversize', 296.9, 457.2], ['ROC 16K', 196.8, 273],
  ['Envelope Choukei 3', 120, 235], ['Super B/A3', 305, 487],
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
          { kind: 'menu', id: 'margins', label: cmd.margins, icon: 'document_margins', size: 'large', items: isOnlyOffice() ? [
            ...OO_MARGINS.map((mp): MenuItem => ({
              id: mp.id, label: mp.label, description: `En haut : ${ooCm(mp.top)}	En bas : ${ooCm(mp.bottom)}
À gauche : ${ooCm(mp.left)}	À droite : ${ooCm(mp.right)}`,
              checked: [[mp.top, s.margins.top], [mp.bottom, s.margins.bottom], [mp.left, s.margins.left], [mp.right, s.margins.right]].every(([cmv, pt]) => Math.abs(cmv! * CM - pt!) < 1),
              onClick: () => set({ margins: { ...s.margins, top: mp.top * CM, bottom: mp.bottom * CM, left: mp.left * CM, right: mp.right * CM } }),
            })),
            { id: 's', kind: 'separator' },
            { id: 'custom', label: 'Marges personnalisées', onClick: () => c.openDialog('pageSetup') },
          ] : [
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
          { kind: 'menu', id: 'size', label: cmd.pageSize, icon: 'page_fit', size: 'large', items: isOnlyOffice() ? OO_SIZES.map(([name, wmm, hmm]): MenuItem => {
            const [w, h] = s.orientation === 'landscape' ? [hmm, wmm] : [wmm, hmm];
            const k = CM / 10;
            return { id: `oo-${name}`, label: name, description: `${ooCm(wmm / 10)} x ${ooCm(hmm / 10)}`, checked: Math.abs(s.pageWidth - w * k) < 2 && Math.abs(s.pageHeight - h * k) < 2, onClick: () => set({ pageWidth: w * k, pageHeight: h * k }) };
          }) : PAGE_SIZES.map((ps) => {
            const [w, h] = s.orientation === 'landscape' ? [ps.h, ps.w] : [ps.w, ps.h];
            return { id: ps.id, label: `${T.sizes[ps.id]} — ${cmLabel(ps.w)} x ${cmLabel(ps.h)} cm`, checked: Math.abs(s.pageWidth - w) < 2 && Math.abs(s.pageHeight - h) < 2, onClick: () => set({ pageWidth: w, pageHeight: h }) };
          }) },
          { kind: 'menu', id: 'columns', label: cmd.columns, icon: 'text_column_two_left', size: 'large', items: [
            { id: 'c1', label: T.columnsPresets.one, checked: s.columns.count === 1, onClick: () => set(columns(1)) },
            { id: 'c2', label: T.columnsPresets.two, checked: s.columns.count === 2 && s.columns.equalWidth, onClick: () => set(columns(2)) },
            { id: 'c3', label: T.columnsPresets.three, checked: s.columns.count === 3, onClick: () => set(columns(3)) },
            { id: 'cl', label: isOnlyOffice() ? 'À gauche' : T.columnsPresets.left, onClick: () => set(columns(2, [{ width: (textWidth - 35.4) / 3, space: 35.4 }, { width: ((textWidth - 35.4) * 2) / 3, space: 0 }])) },
            { id: 'cr', label: isOnlyOffice() ? 'À droite' : T.columnsPresets.right, onClick: () => set(columns(2, [{ width: ((textWidth - 35.4) * 2) / 3, space: 35.4 }, { width: (textWidth - 35.4) / 3, space: 0 }])) },
            { id: 's', kind: 'separator' },
            ...(isOnlyOffice() ? [{ id: 'ccustom', label: 'Colonnes personnalisées', onClick: () => c.openDialog('pageSetupAll') }] : []),
            { id: 'line', label: T.dialogs.columnsLine, checked: s.columns.separator, onClick: () => set({ columns: { ...s.columns, separator: !s.columns.separator } }) },
          ] },
          { kind: 'menu', id: 'breaks', label: cmd.breaks, icon: 'document_page_break', items: isOnlyOffice() ? [
            { id: 'page', label: 'Insérer un saut de page', onClick: () => c.run(insertPageBreak) },
            { id: 'column', label: 'Insérer un saut de colonne', onClick: () => c.run(insertInline({ type: 'break', kind: 'column' })) },
            { id: 'section', label: 'Insérer saut de section', items: [
              { id: 'next', label: 'Page suivante', onClick: () => c.act.setSection({ breakType: 'nextPage', extra: undefined }) },
              { id: 'cont', label: 'Page continue', onClick: () => c.act.setSection({ breakType: 'continuous', extra: undefined }) },
              { id: 'even', label: 'Page paire', onClick: () => c.act.setSection({ breakType: 'evenPage', extra: undefined }) },
              { id: 'odd', label: 'Page impaire', onClick: () => c.act.setSection({ breakType: 'oddPage', extra: undefined }) },
            ] },
          ] : [
            { id: 'page', label: cmd.pageBreak, shortcut: 'Ctrl+Entrée', onClick: () => c.run(insertPageBreak) },
            { id: 'column', label: cmd.columnBreak, shortcut: 'Ctrl+Maj+Entrée', onClick: () => c.run(insertInline({ type: 'break', kind: 'column' })) },
            { id: 's', kind: 'separator' },
            { id: 'next', label: cmd.sectionNext, onClick: () => c.act.setSection({ breakType: 'nextPage', extra: undefined }) },
            { id: 'cont', label: cmd.sectionContinuous, onClick: () => c.act.setSection({ breakType: 'continuous', extra: undefined }) },
            { id: 'even', label: cmd.sectionEven, onClick: () => c.act.setSection({ breakType: 'evenPage', extra: undefined }) },
            { id: 'odd', label: cmd.sectionOdd, onClick: () => c.act.setSection({ breakType: 'oddPage', extra: undefined }) },
          ] },
          { kind: 'menu', id: 'linenumbers', label: cmd.lineNumbers, icon: 'text_number_list_ltr', items: isOnlyOffice() ? [
            { id: 'none', label: 'Aucun', checked: !s.lineNumbering, onClick: () => set({ lineNumbering: undefined }) },
            { id: 'cont', label: 'Continue', checked: s.lineNumbering?.restart === 'continuous', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'continuous' } }) },
            { id: 'page', label: 'Redémarrer à chaque page', checked: s.lineNumbering?.restart === 'newPage', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'newPage' } }) },
            { id: 'section', label: 'Redémarrer à chaque section', checked: s.lineNumbering?.restart === 'newSection', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'newSection' } }) },
            { id: 'suppress', label: 'Supprimer pour le paragraphe actif', checked: p.suppressLineNumbers === true, onClick: () => c.run(setParagraph({ props: { suppressLineNumbers: p.suppressLineNumbers ? undefined : true } })) },
            { id: 's', kind: 'separator' },
            { id: 'opts', label: 'Options de numérotation de ligne', onClick: () => c.openDialog('lineNumbers') },
          ] : [
            { id: 'opts', label: X.lineNo.menu, onClick: () => c.openDialog('lineNumbers') },
            { id: 'none', label: cmd.lineNumbersNone, checked: !s.lineNumbering, onClick: () => set({ lineNumbering: undefined }) },
            { id: 'cont', label: cmd.lineNumbersContinuous, checked: s.lineNumbering?.restart === 'continuous', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'continuous' } }) },
            { id: 'page', label: cmd.lineNumbersPage, checked: s.lineNumbering?.restart === 'newPage', onClick: () => set({ lineNumbering: { countBy: 1, start: 1, restart: 'newPage' } }) },
          ] },
          isOnlyOffice()
            ? { kind: 'menu', id: 'hyphen', label: cmd.hyphenation, icon: 'text_wrap', items: [
              { id: 'none', label: 'Aucun', checked: !c.meta.settings.autoHyphenation, onClick: () => c.updateMeta((m) => ({ ...m, settings: { ...m.settings, autoHyphenation: false } })) },
              { id: 'auto', label: 'Automatique', checked: c.meta.settings.autoHyphenation, onClick: () => c.updateMeta((m) => ({ ...m, settings: { ...m.settings, autoHyphenation: true } })) },
              { id: 's', kind: 'separator' },
              { id: 'opts', label: 'Options de coupure', disabled: true, tooltip: 'Pas encore disponible dans ForgeOffice' },
            ] }
            : { kind: 'toggle', id: 'hyphen', label: cmd.hyphenation, icon: 'text_wrap', pressed: c.meta.settings.autoHyphenation, onToggle: (v) => c.updateMeta((m) => ({ ...m, settings: { ...m.settings, autoHyphenation: v } })) },
        ],
      },
      {
        id: 'paragraph', label: T.groups.paragraph, icon: 'text_paragraph', launcher: { label: T.dialogs.paragraph, onClick: () => c.openDialog('paragraph') },
        controls: [
          { kind: 'number', id: 'indleft', caption: true, label: isOnlyOffice() ? 'Retrait gauche' : cmd.indentLeft, value: ptToCm(p.indentLeft ?? 0), min: -10, max: 30, step: 0.1, unit: 'cm', width: 64, onChange: (v) => c.run(setParagraph({ props: { indentLeft: cmToPt(v) || undefined } })) },
          // Retrait de premiere ligne : champ « Special » du panneau Parametres du profil OnlyOffice (masque dans le ruban).
          { kind: 'number', id: 'indfirst', label: 'Retrait de première ligne', hidden: true, value: ptToCm(p.indentFirstLine ?? 0), min: -10, max: 30, step: 0.1, unit: 'cm', width: 64, onChange: (v) => c.run(setParagraph({ props: { indentFirstLine: cmToPt(v) || undefined } })) },
          // Interligne du panneau Parametres OnlyOffice : type (Au moins / Exactement / Multiple) + valeur ; masques dans le ruban.
          { kind: 'combo', id: 'lsrule', label: 'Interligne', hidden: true, width: 86, value: p.lineSpacing?.rule === 'exact' ? 'Exactement' : p.lineSpacing?.rule === 'atLeast' ? 'Au moins' : 'Multiple', options: [{ value: 'Au moins' }, { value: 'Exactement' }, { value: 'Multiple' }],
            onChange: (v) => c.run(setParagraph({ props: { lineSpacing: v === 'Multiple' ? { rule: 'auto', value: 1 } : { rule: v === 'Exactement' ? 'exact' : 'atLeast', value: p.lineSpacing?.rule && p.lineSpacing.rule !== 'auto' ? p.lineSpacing.value : 12 } } })) },
          { kind: 'number', id: 'lsvalue', label: 'Valeur de l’interligne', hidden: true, value: p.lineSpacing?.rule && p.lineSpacing.rule !== 'auto' ? ptToCm(p.lineSpacing.value) : (p.lineSpacing?.value ?? 1), min: 0, max: 132, step: p.lineSpacing?.rule && p.lineSpacing.rule !== 'auto' ? 0.1 : 0.05, unit: p.lineSpacing?.rule && p.lineSpacing.rule !== 'auto' ? 'cm' : undefined, width: 64,
            onChange: (v) => c.run(setParagraph({ props: { lineSpacing: p.lineSpacing?.rule && p.lineSpacing.rule !== 'auto' ? { rule: p.lineSpacing.rule, value: cmToPt(v) } : { rule: 'auto', value: v } } })) },
          { kind: 'number', id: 'indright', caption: true, label: isOnlyOffice() ? 'Retrait droit' : cmd.indentRight, value: ptToCm(p.indentRight ?? 0), min: -10, max: 30, step: 0.1, unit: 'cm', width: 64, onChange: (v) => c.run(setParagraph({ props: { indentRight: cmToPt(v) || undefined } })) },
          { kind: 'number', id: 'before', caption: true, label: cmd.spaceBefore, value: isOnlyOffice() ? ptToCm(p.spacingBefore ?? 0) : (p.spacingBefore ?? 0), min: 0, max: isOnlyOffice() ? 55 : 1584, step: isOnlyOffice() ? 0.1 : 6, unit: isOnlyOffice() ? 'cm' : 'pt', width: 64, onChange: (v) => c.run(setParagraph({ props: (pp) => mergeProps(pp, { spacingBefore: isOnlyOffice() ? cmToPt(v) : v }) })) },
          { kind: 'number', id: 'after', caption: true, label: cmd.spaceAfter, value: isOnlyOffice() ? ptToCm(p.spacingAfter ?? 0) : (p.spacingAfter ?? 0), min: 0, max: isOnlyOffice() ? 55 : 1584, step: isOnlyOffice() ? 0.1 : 6, unit: isOnlyOffice() ? 'cm' : 'pt', width: 64, onChange: (v) => c.run(setParagraph({ props: (pp) => mergeProps(pp, { spacingAfter: isOnlyOffice() ? cmToPt(v) : v }) })) },
        ],
      },
    ],
  };
}
