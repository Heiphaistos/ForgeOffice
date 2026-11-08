// Onglet contextuel « SmartArt » : ajouter, promouvoir, abaisser, déplacer, disposition, couleurs, volet Texte.
import type { RibbonTab } from '@forgeoffice/ui';
import { S2 } from '../../strings2.ts';
import { S3 } from '../strings-text.ts';
import type { Editor } from '../editor.ts';
import { insertSmartArt, selectedSmartArt } from '../insert-objects.ts';
import { SMARTART_KINDS, type SmartArtItem, type SmartArtKind } from '../smartart.ts';
import { addItem, moveItem, removeItem, shiftLevel } from '../smartart-ops.ts';
import { currentItem } from '../smartart-cursor.ts';
import type { TabContext } from './common.tsx';

const T = S3.smartArtTab;

function change(ed: Editor, edit: (items: SmartArtItem[], index: number) => SmartArtItem[], kind?: SmartArtKind, accent?: number): void {
  const sa = selectedSmartArt(ed);
  if (!sa) return;
  const items = edit(sa.items, currentItem(sa.items.length));
  if (items.length) insertSmartArt(ed, kind ?? sa.kind, items, sa.shape, accent ?? sa.accent, 'smartart-edit');
}

export function smartArtTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const sa = selectedSmartArt(ed);
  return {
    id: 'smartArt',
    label: T.tab,
    keytip: 'JS',
    contextual: { set: S2.smartart.button, color: '#C43E1C' },
    hidden: !sa,
    groups: [
      {
        id: 'create', label: T.create, icon: 'flow',
        controls: [
          { kind: 'button', id: 'add', label: T.add, icon: 'add', size: 'large', onClick: () => change(ed, (items, i) => addItem(items, i)) },
          { kind: 'button', id: 'remove', label: T.remove, icon: 'delete', size: 'small', disabled: (sa?.items.length ?? 0) < 2, onClick: () => change(ed, (items, i) => removeItem(items, i)) },
          { kind: 'button', id: 'promote', label: T.promote, icon: 'text_indent_decrease_ltr', size: 'small', onClick: () => change(ed, (items, i) => shiftLevel(items, i, -1)) },
          { kind: 'button', id: 'demote', label: T.demote, icon: 'text_indent_increase_ltr', size: 'small', onClick: () => change(ed, (items, i) => shiftLevel(items, i, 1)) },
          { kind: 'button', id: 'up', label: T.up, icon: 'arrow_up', size: 'small', onClick: () => change(ed, (items, i) => moveItem(items, i, -1)) },
          { kind: 'button', id: 'down', label: T.down, icon: 'arrow_down', size: 'small', onClick: () => change(ed, (items, i) => moveItem(items, i, 1)) },
          { kind: 'toggle', id: 'pane', label: T.pane, icon: 'panel_right', size: 'small', pressed: ed.ui.pane === 'smartart', onToggle: (on) => app.pane(on ? 'smartart' : null) },
        ],
      },
      {
        id: 'layouts', label: T.layouts, icon: 'flow',
        controls: [{ kind: 'menu', id: 'layout', label: T.layout, icon: 'flow', size: 'large', items: SMARTART_KINDS.map((k) => ({ id: k, label: S2.smartart.kinds[k], checked: sa?.kind === k, onClick: () => change(ed, (items) => items, k) })) }],
      },
      {
        id: 'styles', label: T.styles, icon: 'color',
        controls: [{ kind: 'menu', id: 'colors', label: T.colors, icon: 'color', size: 'large', items: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `a${n}`, label: `${T.accent} ${n}`, checked: sa?.accent === n, onClick: () => change(ed, (items) => items, undefined, n) })) }],
      },
    ],
  };
}
