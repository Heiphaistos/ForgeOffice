// Onglets References et Publipostage.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';

export function referencesTab(c: Ctl): RibbonTab {
  const { act } = c;
  const cmd = T.cmd;
  const levels: MenuItem[] = [
    { id: 'l0', label: cmd.toBody, checked: c.sel.para.outlineLevel === undefined || c.sel.para.outlineLevel >= 9, onClick: () => act.applyStyle('Normal') },
    ...[1, 2, 3].map((n): MenuItem => ({ id: `l${n}`, label: T.dialogs.level(n), checked: c.sel.para.outlineLevel === n - 1, onClick: () => act.applyStyle(`Heading${n}`) })),
  ];
  return {
    id: 'references', label: T.tabs.references, keytip: 'S',
    groups: [
      {
        id: 'toc', label: T.groups.toc, icon: 'text_bullet_list_tree',
        controls: [
          { kind: 'split', id: 'toc', label: cmd.toc, icon: 'text_bullet_list_tree', size: 'large', onClick: act.insertToc, items: [
            { id: 'auto1', label: T.toc.auto1, onClick: act.insertToc },
            { id: 'remove', label: cmd.removeToc, icon: 'delete', onClick: act.removeToc },
          ] },
          { kind: 'menu', id: 'addtext', label: cmd.addText, icon: 'add', items: levels },
          { kind: 'button', id: 'updatetoc', label: cmd.updateToc, icon: 'arrow_sync', onClick: act.updateToc },
        ],
      },
      {
        id: 'notes', label: T.groups.footnotes, icon: 'note',
        controls: [
          { kind: 'button', id: 'footnote', label: cmd.footnote, icon: 'note', size: 'large', onClick: () => act.insertNote('footnote'), tooltip: { title: cmd.footnote, shortcut: 'Ctrl+Alt+F' } },
          { kind: 'button', id: 'endnote', label: cmd.endnote, icon: 'document_text', onClick: () => act.insertNote('endnote'), tooltip: { title: cmd.endnote, shortcut: 'Ctrl+Alt+D' } },
          { kind: 'button', id: 'shownotes', label: cmd.showNotes, icon: 'note', onClick: () => c.setUi({ pane: c.ui.pane === 'notes' ? null : 'notes' }) },
        ],
      },
      {
        id: 'citations', label: T.groups.citations, icon: 'book_open',
        controls: [
          { kind: 'button', id: 'citation', label: cmd.citation, icon: 'text_quote', size: 'large', onClick: () => c.openDialog('citation') },
          { kind: 'button', id: 'bibliography', label: cmd.bibliography, icon: 'library', onClick: () => c.openDialog('citation') },
        ],
      },
      {
        id: 'captions', label: T.groups.captions, icon: 'image',
        controls: [
          { kind: 'button', id: 'caption', label: cmd.caption, icon: 'text_description', size: 'large', onClick: () => c.openDialog('caption') },
          { kind: 'button', id: 'crossref', label: cmd.crossRef, icon: 'link_square', onClick: () => c.openDialog('crossref') },
          { kind: 'button', id: 'updatefields', label: cmd.updateFields, icon: 'arrow_sync', onClick: act.updateFields },
        ],
      },
      {
        id: 'index', label: T.groups.index, icon: 'list',
        controls: [
          { kind: 'button', id: 'mark', label: cmd.markEntry, icon: 'bookmark', size: 'large', onClick: () => c.openDialog('index') },
          { kind: 'button', id: 'insertindex', label: cmd.insertIndex, icon: 'list', onClick: () => c.openDialog('index') },
        ],
      },
    ],
  };
}

export function mailingsTab(c: Ctl): RibbonTab {
  const { act, csv, ui } = c;
  const cmd = T.cmd;
  const n = csv?.rows.length ?? 0;
  const fields: MenuItem[] = csv?.headers.length
    ? csv.headers.map((h) => ({ id: `f-${h}`, label: h, onClick: () => act.insertMergeField(h) }))
    : [{ id: 'none', label: T.dialogs.mergeEmpty, disabled: true }];
  return {
    id: 'mailings', label: T.tabs.mailings, keytip: 'M',
    groups: [
      {
        id: 'start', label: T.groups.start, icon: 'mail',
        controls: [{ kind: 'menu', id: 'recipients', label: cmd.startMerge, icon: 'people', size: 'large', items: [{ id: 'csv', label: cmd.useCsv, icon: 'folder_open', onClick: () => void act.loadCsv() }] }],
      },
      {
        id: 'fields', label: T.groups.fields, icon: 'text_field',
        controls: [{ kind: 'menu', id: 'mergefield', label: cmd.mergeField, icon: 'text_field', size: 'large', disabled: !csv, items: fields }],
      },
      {
        id: 'preview', label: T.groups.preview, icon: 'eye',
        controls: [
          { kind: 'toggle', id: 'previewres', label: cmd.previewResults, icon: 'eye', size: 'large', disabled: !n, pressed: ui.mergeRecord >= 0, onToggle: (v) => act.setMergeRecord(v ? 0 : -1) },
          { kind: 'button', id: 'prev', label: cmd.prevRecord, icon: 'previous', iconOnly: true, disabled: ui.mergeRecord <= 0, onClick: () => act.setMergeRecord(ui.mergeRecord - 1) },
          { kind: 'custom', id: 'record', label: cmd.previewResults, render: () => ui.mergeRecord >= 0 ? T.dialogs.mergeRecord(ui.mergeRecord + 1, n) : '' },
          { kind: 'button', id: 'next', label: cmd.nextRecord, icon: 'next', iconOnly: true, disabled: ui.mergeRecord < 0 || ui.mergeRecord >= n - 1, onClick: () => act.setMergeRecord(ui.mergeRecord + 1) },
        ],
      },
      {
        id: 'finish', label: T.groups.finish, icon: 'checkmark',
        controls: [{ kind: 'button', id: 'finish', label: cmd.finishMerge, icon: 'document_multiple', size: 'large', disabled: !n, onClick: act.finishMerge, tooltip: { title: cmd.finishMerge, description: T.tips.merge } }],
      },
    ],
  };
}

