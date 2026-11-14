// Ruban du module PDF (Office 2024, fonctions d'Acrobat) : Accueil, Commentaire, Modifier, Organiser, Proteger, Outils.
import { useState } from 'react';
import type { ButtonControl, IconName, ToggleControl, MenuItem, RibbonControl, RibbonTab } from '@forgeoffice/ui';
import { INK_COLORS, MARK_COLORS, type FieldKind, type StampKind, type Tool } from './model.ts';
import type { Panel } from './Sidebar.tsx';
import { S } from './strings.ts';

/** Champ « n / N » : saisie du numero de page, Entree valide, Echap/perte de focus restaure. */
function PageField({ current, count, disabled, label, onGo }: { current: number; count: number; disabled: boolean; label: string; onGo(page: number): void }) {
  const [text, setText] = useState(`${current + 1} / ${count}`);
  const commit = (): void => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n) && n >= 1 && n <= count) onGo(n - 1);
    setText(`${current + 1} / ${count}`);
  };
  return (
    <input
      className="fo-rb-pagefield" aria-label={label} title={label} value={text} disabled={disabled}
      onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setText(`${current + 1} / ${count}`); e.currentTarget.blur(); } }}
    />
  );
}

export interface PdfRibbonState {
  hasDoc: boolean;
  editable: boolean;
  /** Raison affichee quand l'edition est impossible. */
  lockedReason: string;
  tool: Tool;
  color: string;
  markColor: string;
  width: number;
  fontSize: number;
  stamp: StampKind;
  field: FieldKind;
  twoPages: boolean;
  /** Defilement continu ou une page (ou paire) a la fois. */
  pageMode: 'continuous' | 'single';
  night: boolean;
  readingMode: boolean;
  speaking: boolean;
  fillForm: boolean;
  hasFields: boolean;
  pendingRedactions: number;
  hasItems: boolean;
  selectedPages: number;
  pageCount: number;
  /** Page courante (0-based) et zoom en %, pour le champ de page et la liste de zoom du profil OnlyOffice. */
  current: number;
  zoom: number;
  /** Volet de gauche ouvert (etat « appuye » des boutons de volet). */
  panel: Panel | null;
  /** Disponibilite des operations natives : null = disponible, sinon raison. */
  nativeReason(operation: string): string | null;
}

export interface PdfRibbonActions {
  setTool(t: Tool): void;
  setOpt(patch: Partial<Pick<PdfRibbonState, 'color' | 'markColor' | 'width' | 'fontSize' | 'stamp' | 'field'>>): void;
  zoom(dir: 1 | -1): void;
  setZoomTo(percent: number): void;
  jumpTo(page: number): void;
  fit(kind: 'width' | 'page'): void;
  rotateView(dir: 1 | -1): void;
  toggleTwoPages(): void;
  setPageMode(mode: 'continuous' | 'single'): void;
  toggleNight(): void;
  toggleSpeech(): void;
  fullScreen(): void;
  go(delta: number): void;
  goToPage(): void;
  viewBack(): void;
  viewForward(): void;
  toggleReadingMode(): void;
  find(): void;
  showPanel(p: Panel): void;
  clearItems(): void;
  toggleFill(): void;
  flatten(): void;
  dialog(kind: 'watermark' | 'numbering' | 'headerFooter' | 'metadata' | 'protect' | 'compress' | 'ocr' | 'split' | 'extract' | 'signature' | 'digitalSign'): void;
  rotatePages(dir: 1 | -1): void;
  deletePages(): void;
  insertBlank(): void;
  insertFile(): void;
  merge(): void;
  applyRedactions(): void;
  redactFind(): void;
  sanitize(): void;
  unprotect(): void;
  pdfa(): void;
  compare(): void;
  exportAs(kind: 'images' | 'text' | 'word'): void;
}

const isOnlyOffice = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';
const ZOOM_STEPS = [50, 75, 100, 125, 150, 175, 200, 300, 400, 500];

const big = (id: string, label: string, icon: IconName, onClick: () => void, disabled = false, description?: string): ButtonControl =>
  ({ kind: 'button', id, label, icon, size: 'large', disabled, tooltip: { title: label, description }, onClick });
const small = (id: string, label: string, icon: IconName, onClick: () => void, disabled = false, description?: string): ButtonControl =>
  ({ kind: 'button', id, label, icon, size: 'small', disabled, tooltip: { title: label, description }, onClick });

/** Bouton de volet : bascule appuyee quand le volet est ouvert. */
const pane = (s: PdfRibbonState, a: PdfRibbonActions, id: string, p: Panel, label: string, icon: IconName, size: 'large' | 'small', disabled: boolean): ToggleControl =>
  ({ kind: 'toggle', id, label, icon, size, disabled, pressed: s.panel === p, tooltip: { title: label }, onToggle: () => a.showPanel(p) });

const TOOL_ICONS: Readonly<Record<Tool, IconName>> = {
  select: 'cursor', hand: 'hand_left', highlight: 'highlight', underline: 'text_underline', strike: 'text_strikethrough', note: 'note', freetext: 'textbox',
  rect: 'rectangle_landscape', ellipse: 'oval', line: 'line', arrow: 'arrow_up_right', ink: 'inking_tool', stamp: 'approvals_app', signature: 'signature',
  field: 'form', edittext: 'document_edit', redact: 'pen_prohibited',
};

export function pdfTabs(s: PdfRibbonState, a: PdfRibbonActions): RibbonTab[] {
  const noDoc = !s.hasDoc;
  const noEdit = noDoc || !s.editable;
  const toolToggle = (t: Tool, size: 'large' | 'small' = 'large', description?: string): RibbonControl => ({
    kind: 'toggle', id: `tool-${t}`, label: S.tools[t], icon: TOOL_ICONS[t], size, pressed: s.tool === t,
    disabled: t === 'select' || t === 'hand' ? noDoc : noEdit,
    tooltip: { title: S.tools[t], description: !s.editable && t !== 'select' && t !== 'hand' ? s.lockedReason : description ?? (S.tips as Readonly<Record<string, string>>)[t] },
    onToggle: () => a.setTool(s.tool === t ? 'select' : t),
  });
  const native = (id: string, label: string, icon: IconName, op: string, onClick: () => void, description: string): RibbonControl => {
    const reason = s.nativeReason(op);
    return big(id, label, icon, onClick, noEdit || reason !== null, reason ?? description);
  };
  const stampItems: MenuItem[] = (Object.keys(S.stamps) as StampKind[]).map((k) => ({
    id: `stamp-${k}`, label: S.stamps[k], checked: s.stamp === k, onClick: () => { a.setOpt({ stamp: k }); a.setTool('stamp'); },
  }));
  const fieldItems: MenuItem[] = (Object.keys(S.fields) as FieldKind[]).map((k) => ({
    id: `field-${k}`, label: S.fields[k], checked: s.field === k, onClick: () => { a.setOpt({ field: k }); a.setTool('field'); },
  }));
  const pagesDesc = S.pagesSel(s.selectedPages);
  const oo = isOnlyOffice();
  return [
    {
      id: 'home', label: S.tabs.home, groups: [
        { id: 'tools', label: S.groups.tools, controls: [toolToggle('select'), toolToggle('hand')] },
        {
          id: 'view', label: S.groups.view, controls: [
            ...(oo ? [{
              kind: 'combo', id: 'zoom-list', label: S.zoom, value: `${s.zoom}%`, editable: true, width: 56, disabled: noDoc,
              options: ZOOM_STEPS.map((z) => ({ value: `${z}%` })),
              validate: (t: string) => { const n = Number.parseInt(t, 10); return Number.isFinite(n) && n >= 10 && n <= 800 ? `${n}%` : null; },
              onChange: (v: string) => a.setZoomTo(Number.parseInt(v, 10)),
            } as RibbonControl] : [
              small('zoom-in', S.zoomIn, 'zoom_in', () => a.zoom(1), noDoc), small('zoom-out', S.zoomOut, 'zoom_out', () => a.zoom(-1), noDoc),
            ]),
            small('fit-width', S.fitWidth, 'arrow_fit', () => a.fit('width'), noDoc), small('fit-page', S.fitPage, 'page_fit', () => a.fit('page'), noDoc),
            small('rot-left', S.rotateViewLeft, 'rotate_left', () => a.rotateView(-1), noDoc, S.rotateViewTip),
            small('rot-right', S.rotateViewRight, 'rotate_right', () => a.rotateView(1), noDoc, S.rotateViewTip),
            big('full', S.fullScreen, 'full_screen_maximize', a.fullScreen, noDoc),
          ],
        },
        {
          id: 'reading', label: S.reading.group, controls: [
            { kind: 'toggle', id: 'mode-continuous', label: S.reading.continuous, icon: 'document_multiple', size: 'large', pressed: s.pageMode === 'continuous', disabled: noDoc, onToggle: () => a.setPageMode('continuous') },
            { kind: 'toggle', id: 'mode-single', label: S.reading.single, icon: 'document_one_page', size: 'large', pressed: s.pageMode === 'single', disabled: noDoc, onToggle: () => a.setPageMode('single') },
            { kind: 'toggle', id: 'two-pages', label: S.reading.two, icon: 'book_open', size: 'large', pressed: s.twoPages, disabled: noDoc, onToggle: a.toggleTwoPages },
            { kind: 'toggle', id: 'night', label: S.reading.night, icon: 'weather_moon', size: 'large', pressed: s.night, disabled: noDoc, onToggle: a.toggleNight, tooltip: { title: S.reading.night, description: S.reading.nightTip } },
            { kind: 'toggle', id: 'reading-mode', label: S.nav.reading, icon: 'book_open', size: 'large', pressed: s.readingMode, disabled: noDoc, onToggle: a.toggleReadingMode, tooltip: { title: S.nav.reading, description: S.nav.readingTip } },
            { kind: 'toggle', id: 'aloud', label: s.speaking ? S.reading.stop : S.reading.aloud, icon: 'speaker_2', size: 'large', pressed: s.speaking, disabled: noDoc, onToggle: a.toggleSpeech, tooltip: { title: S.reading.aloud, description: S.reading.aloudTip } },
          ],
        },
        {
          id: 'nav', label: S.groups.nav, controls: oo ? [
            {
              kind: 'custom', id: 'page-field', label: S.nav.goTo, render: () => (
                <PageField key={`${s.current}/${s.pageCount}`} current={s.current} count={s.pageCount} disabled={noDoc} label={S.nav.goTo} onGo={a.jumpTo} />
              ),
            },
            small('first-page', S.nav.first, 'previous', () => a.jumpTo(0), noDoc || s.current <= 0),
            small('prev', S.prevPage, 'chevron_left', () => a.go(-1), noDoc || s.current <= 0),
            small('next', S.nextPage, 'chevron_right', () => a.go(1), noDoc || s.current >= s.pageCount - 1),
            small('last-page', S.nav.last, 'next', () => a.jumpTo(s.pageCount - 1), noDoc || s.current >= s.pageCount - 1),
            small('find', S.find, 'search', a.find, noDoc),
            small('view-back', S.nav.back, 'arrow_left', a.viewBack, noDoc), small('view-forward', S.nav.forward, 'arrow_right', a.viewForward, noDoc),
          ] : [
            small('prev', S.prevPage, 'arrow_up', () => a.go(-1), noDoc), small('next', S.nextPage, 'arrow_down', () => a.go(1), noDoc),
            small('find', S.find, 'search', a.find, noDoc),
            small('goto', S.nav.goTo, 'arrow_right', a.goToPage, noDoc), small('view-back', S.nav.back, 'arrow_left', a.viewBack, noDoc), small('view-forward', S.nav.forward, 'arrow_right', a.viewForward, noDoc),
          ],
        },
      ],
    },
    {
      id: 'comment', label: S.tabs.comment, groups: [
        {
          id: 'annotate', label: S.groups.annotate, controls: [
            toolToggle('highlight'),
            {
              kind: 'menu', id: 'mark-color', label: S.color, icon: 'color', size: 'small', iconOnly: true, disabled: noEdit,
              items: MARK_COLORS.map((c, i) => ({ id: c, label: S.markColors[i] ?? c, checked: s.markColor === c, adornment: <span className="pdf-swatch" style={{ background: c }} />, onClick: () => a.setOpt({ markColor: c }) })),
            },
            toolToggle('underline', 'small'), toolToggle('strike', 'small'), toolToggle('note', 'small'), toolToggle('freetext'),
          ],
        },
        {
          id: 'draw', label: S.groups.draw, controls: [
            toolToggle('rect', 'small'), toolToggle('ellipse', 'small'), toolToggle('line', 'small'), toolToggle('arrow', 'small'), toolToggle('ink'),
            {
              kind: 'color', id: 'ink-color', label: S.color, icon: 'color_line', size: 'large', value: s.color, disabled: noEdit, themeColors: INK_COLORS,
              onChange: (c) => a.setOpt({ color: c ?? '#D13438' }),
            },
            { kind: 'number', id: 'ink-width', label: S.thickness, value: s.width, min: 1, max: 20, unit: 'pt', width: 64, disabled: noEdit, onChange: (width) => a.setOpt({ width }) },
            { kind: 'number', id: 'font-size', label: S.fontSize, value: s.fontSize, min: 6, max: 72, unit: 'pt', width: 64, disabled: noEdit, onChange: (fontSize) => a.setOpt({ fontSize }) },
          ],
        },
        {
          id: 'stamps', label: S.groups.stamps, controls: [
            { kind: 'split', id: 'stamp', label: S.tools.stamp, icon: 'approvals_app', size: 'large', disabled: noEdit, onClick: () => a.setTool('stamp'), items: stampItems, tooltip: { title: S.tools.stamp, description: S.tips.stamp } },
            big('signature', S.tools.signature, 'signature', () => a.dialog('signature'), noEdit, S.tips.signature),
          ],
        },
        {
          id: 'comments', label: S.groups.comments, controls: [
            pane(s, a, 'comments-pane', 'comments', S.commentsPane, 'comment_multiple', 'large', noDoc),
            small('clear-items', S.clearItems, 'delete', a.clearItems, noDoc || !s.hasItems),
          ],
        },
      ],
    },
    {
      id: 'edit', label: S.tabs.edit, groups: [
        { id: 'text', label: S.groups.text, controls: [toolToggle('edittext'), toolToggle('freetext')] },
        {
          id: 'form', label: S.groups.form, controls: [
            { kind: 'split', id: 'field', label: S.tools.field, icon: 'form_new', size: 'large', disabled: noEdit, onClick: () => a.setTool('field'), items: fieldItems, tooltip: { title: S.tools.field, description: S.tips.field } },
            { kind: 'toggle', id: 'fill', label: S.fillForm, icon: 'form', size: 'large', pressed: s.fillForm, disabled: noDoc || !s.hasFields, onToggle: a.toggleFill },
            big('flatten', S.flatten, 'document_checkmark', a.flatten, noEdit, S.flattenTip),
          ],
        },
        {
          id: 'stamps-pages', label: S.groups.stampsPages, controls: [
            big('watermark', S.watermark, 'drop', () => a.dialog('watermark'), noEdit), big('numbering', S.numbering, 'text_number_format', () => a.dialog('numbering'), noEdit),
            big('header-footer', S.headerFooter, 'document_header_footer', () => a.dialog('headerFooter'), noEdit),
          ],
        },
        { id: 'props', label: S.groups.props, controls: [big('metadata', S.metadata, 'info', () => a.dialog('metadata'), noEdit)] },
      ],
    },
    {
      id: 'organize', label: S.tabs.organize, groups: [
        {
          id: 'pages', label: S.groups.pages, controls: [
            big('rot-left-p', S.rotateLeft, 'arrow_counterclockwise', () => a.rotatePages(-1), noEdit, pagesDesc),
            big('rot-right-p', S.rotateRight, 'arrow_clockwise', () => a.rotatePages(1), noEdit, pagesDesc),
            big('delete-p', S.deletePages, 'document_dismiss', a.deletePages, noEdit || s.selectedPages >= s.pageCount, pagesDesc),
            big('extract-p', S.extractPages, 'document_arrow_up', () => a.dialog('extract'), noEdit, pagesDesc),
            small('blank-p', S.insertBlank, 'document_one_page_add', a.insertBlank, noEdit),
            small('file-p', S.insertFile, 'document_add', a.insertFile, noEdit),
          ],
        },
        {
          id: 'assemble', label: S.groups.assemble, controls: [
            big('merge', S.merge, 'merge', a.merge, noEdit, S.mergeTip), big('split', S.split, 'document_split_hint', () => a.dialog('split'), noEdit),
          ],
        },
        {
          id: 'panes', label: S.groups.panes, controls: [
            pane(s, a, 'thumbs-pane', 'thumbs', S.thumbnails, 'document_one_page_multiple', 'large', noDoc),
            pane(s, a, 'bookmarks-pane', 'bookmarks', S.bookmarks, 'bookmark', 'large', noDoc),
            pane(s, a, 'attachments-pane', 'attachments', S.panes.attachments, 'attach', 'small', noDoc),
            pane(s, a, 'layers-pane', 'layers', S.panes.layers, 'layer', 'small', noDoc),
            pane(s, a, 'signatures-pane', 'signatures', S.panes.signatures, 'certificate', 'small', noDoc),
          ],
        },
      ],
    },
    {
      id: 'protect', label: S.tabs.protect, groups: [
        {
          id: 'redact', label: S.groups.redact, controls: [
            toolToggle('redact'),
            big('find-redact', S.redactFind.title, 'search', a.redactFind, noEdit, S.redactFind.help),
            big('sanitize', S.sanitize.title, 'eraser', a.sanitize, noEdit, S.sanitize.help),
            big('apply-redact', S.applyRedactions, 'checkmark', a.applyRedactions, noEdit || s.pendingRedactions === 0, S.applyRedactionsTip),
          ],
        },
        {
          id: 'password', label: S.groups.password, controls: [
            big('protect', S.protect, 'lock_closed', () => a.dialog('protect'), noEdit, S.backstage.protectText),
            big('unprotect', S.unprotect, 'lock_open', a.unprotect, noDoc || s.editable),
          ],
        },
        {
          id: 'sign', label: S.groups.sign, controls: [
            big('sign-visual', S.signVisual, 'document_signature', () => a.dialog('signature'), noEdit, S.tips.signature),
            big('sign-digital', S.sign.digital, 'certificate', () => a.dialog('digitalSign'), noEdit, S.sign.digitalTip),
          ],
        },
      ],
    },
    {
      id: 'tools', label: S.tabs.tools, groups: [
        {
          id: 'optimize', label: S.groups.optimize, controls: [
            big('compress', S.compress, 'folder_zip', () => a.dialog('compress'), noEdit, s.nativeReason('compresser') === null ? S.backstage.compressText : S.compressWeb),
            native('pdfa', S.pdfa, 'archive', 'pdf_a', a.pdfa, 'PDF/A-2b'),
            native('ocr', S.ocr, 'scan_text', 'ocr', () => a.dialog('ocr'), ''),
          ],
        },
        { id: 'analyse', label: S.groups.analyse, controls: [big('compare', S.compare, 'split_vertical', a.compare, noDoc)] },
        {
          id: 'export', label: S.groups.export, controls: [
            small('exp-img', S.exportImages, 'image_multiple', () => a.exportAs('images'), noDoc),
            small('exp-txt', S.exportText, 'document_text', () => a.exportAs('text'), noDoc),
            { ...small('exp-word', S.exportWord, 'document_text_extract', () => a.exportAs('word'), noDoc || s.nativeReason('convertir') !== null), tooltip: { title: S.exportWord, description: s.nativeReason('convertir') ?? S.backstage.exportWord } },
          ],
        },
        { id: 'history', label: S.groups.history, controls: [big('history-pane', S.historyPane, 'history', () => a.showPanel('history'), noDoc)] },
      ],
    },
  ];
}
