// Ruban du Convertisseur (Office 2024) : Accueil (fichiers, format, options, conversion, resultats),
// Outils PDF (traitements par lots repris de ForgePDF), Affichage.
import type { RibbonTab } from '@forgeoffice/ui';
import type { Capabilities } from './native.ts';
import { availability } from './native.ts';
import { formatLabel } from './formats.ts';
import type { ConvertOptions } from './engines.ts';
import { NATIVE_OPERATION, TOOL_LABELS, type PdfTool } from './pdf-batch.ts';
import { S } from './strings.ts';

export interface RibbonState {
  hasJobs: boolean;
  hasWaiting: boolean;
  hasDone: boolean;
  running: boolean;
  allTargets: readonly string[];
  allTarget: string;
  options: ConvertOptions;
  native: boolean;
  caps: Capabilities | null;
  folder: string | null;
  historyOpen: boolean;
  pdfCount: number;
  imageCount: number;
}

export interface RibbonActions {
  addFiles(): void;
  addFolder(): void;
  clear(): void;
  clearDone(): void;
  setAllTarget(t: string): void;
  setOptions(o: Partial<ConvertOptions>): void;
  convertAll(): void;
  stop(): void;
  saveAll(): void;
  pickFolder(): void;
  pdfTool(tool: PdfTool): void;
  imagesToPdf(): void;
  toggleHistory(): void;
}

const TOOL_ICONS: Readonly<Record<PdfTool, import('@forgeoffice/ui').IconName>> = {
  merge: 'merge', rotate: 'arrow_rotate_clockwise', watermark: 'drop', numbering: 'text_number_format',
  compress: 'folder_zip', protect: 'lock_closed', pdfa: 'archive', ocr: 'scan_text',
};

export function convertTabs(s: RibbonState, a: RibbonActions): RibbonTab[] {
  const toolButton = (tool: PdfTool) => {
    const op = NATIVE_OPERATION[tool];
    const avail = op ? availability(s.caps, op) : { ok: true, reason: '' };
    const needs = tool === 'merge' ? 2 : 1;
    return {
      kind: 'button' as const, id: `pdf-${tool}`, label: TOOL_LABELS[tool], icon: TOOL_ICONS[tool], size: 'large' as const,
      disabled: !avail.ok || s.pdfCount < needs || s.running,
      tooltip: { title: TOOL_LABELS[tool], description: avail.ok ? (tool === 'merge' ? S.mergeTip : `${TOOL_LABELS[tool]} : ${S.needPdf}`) : avail.reason },
      onClick: () => a.pdfTool(tool),
    };
  };
  const fidelity = availability(s.caps, 'office_haute_fidelite');
  return [
    {
      id: 'home', label: S.tabs.home, groups: [
        {
          id: 'add', label: S.groups.add, controls: [
            { kind: 'button', id: 'add', label: S.add, icon: 'document_add', size: 'large', tooltip: { title: S.add, description: S.addTip, shortcut: 'Ctrl+O' }, onClick: a.addFiles },
            { kind: 'button', id: 'folder', label: S.addFolder, icon: 'folder_add', size: 'large', tooltip: { title: S.addFolder, description: S.addFolderTip }, onClick: a.addFolder },
            { kind: 'button', id: 'clear-done', label: S.clearDone, icon: 'document_checkmark', size: 'small', disabled: !s.hasDone || s.running, onClick: a.clearDone },
            { kind: 'button', id: 'clear', label: S.clear, icon: 'delete', size: 'small', disabled: !s.hasJobs || s.running, onClick: a.clear },
          ],
        },
        {
          id: 'target', label: S.groups.target, controls: [
            {
              kind: 'combo', id: 'all-target', label: S.allTo, width: 210, value: s.allTarget, disabled: s.allTargets.length === 0 || s.running,
              tooltip: { title: S.allTo, description: S.allToTip },
              options: s.allTargets.map((t) => ({ value: t, label: formatLabel(t) })), onChange: a.setAllTarget,
            },
          ],
        },
        {
          id: 'options', label: S.groups.options, controls: [
            { kind: 'number', id: 'quality', label: S.quality, value: s.options.quality, min: 1, max: 100, step: 5, unit: '%', width: 70, onChange: (quality) => a.setOptions({ quality }) },
            {
              kind: 'row', id: 'size', controls: [
                { kind: 'number', id: 'width', label: S.width, value: s.options.width ?? 0, min: 0, max: 20000, step: 10, unit: S.px, width: 70, onChange: (v) => a.setOptions({ width: v > 0 ? v : null }) },
                { kind: 'number', id: 'height', label: S.height, value: s.options.height ?? 0, min: 0, max: 20000, step: 10, unit: S.px, width: 70, onChange: (v) => a.setOptions({ height: v > 0 ? v : null }) },
              ],
            },
            {
              kind: 'combo', id: 'rotation', label: S.rotation, width: 70, value: String(s.options.rotation),
              options: ['0', '90', '180', '270'].map((v) => ({ value: v, label: `${v}°` })),
              onChange: (v) => a.setOptions({ rotation: v === '90' ? 90 : v === '180' ? 180 : v === '270' ? 270 : 0 }),
            },
            {
              kind: 'checkbox', id: 'fidelity', label: S.highFidelity, checked: s.options.highFidelity, disabled: !fidelity.ok,
              tooltip: { title: S.highFidelity, description: fidelity.ok ? S.highFidelityTip : fidelity.reason }, onChange: (highFidelity) => a.setOptions({ highFidelity }),
            },
          ],
        },
        {
          id: 'run', label: S.groups.run, controls: [
            { kind: 'button', id: 'convert', label: S.convertAll, icon: 'convert_range', size: 'large', disabled: !s.hasWaiting || s.running, tooltip: { title: S.convertAll, description: S.convertAllTip, shortcut: 'F5' }, onClick: a.convertAll },
            { kind: 'button', id: 'stop', label: S.stop, icon: 'stop', size: 'large', disabled: !s.running, tooltip: { title: S.stop, description: S.stopTip }, onClick: a.stop },
          ],
        },
        {
          id: 'results', label: S.groups.results, controls: [
            { kind: 'button', id: 'save-all', label: S.saveAll, icon: 'folder_zip', size: 'large', disabled: !s.hasDone, tooltip: { title: S.saveAll, description: S.saveAllTip }, onClick: a.saveAll },
            {
              kind: 'button', id: 'pick-folder', label: S.folder, icon: 'folder_open', size: 'large', hidden: !s.native,
              tooltip: { title: S.folder, description: s.folder ?? S.folderTip }, onClick: a.pickFolder,
            },
          ],
        },
      ],
    },
    {
      id: 'pdf', label: S.tabs.pdf, groups: [
        { id: 'assemble', label: S.groups.pdfAssemble, controls: [
          toolButton('merge'),
          { kind: 'button', id: 'img-pdf', label: S.imagesToPdf, icon: 'image_multiple', size: 'large', disabled: s.imageCount < 1 || s.running, tooltip: { title: S.imagesToPdf, description: S.imagesToPdfTip }, onClick: a.imagesToPdf },
        ] },
        { id: 'transform', label: S.groups.pdfTransform, controls: [toolButton('rotate'), toolButton('watermark'), toolButton('numbering'), toolButton('compress')] },
        { id: 'protect', label: S.groups.pdfProtect, controls: [toolButton('protect')] },
        { id: 'archive', label: S.groups.pdfArchive, controls: [toolButton('pdfa'), toolButton('ocr')] },
      ],
    },
    {
      id: 'view', label: S.tabs.view, groups: [
        { id: 'panes', label: S.groups.panes, controls: [
          { kind: 'toggle', id: 'history', label: S.history, icon: 'history', size: 'large', pressed: s.historyOpen, onToggle: a.toggleHistory },
        ] },
      ],
    },
  ];
}
