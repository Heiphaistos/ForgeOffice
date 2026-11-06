// Menu contextuel d'un onglet de feuille : segments enregistres dans le registre (contexte « sheetTab »).
import { STANDARD_COLORS, type MenuItem } from '@forgeoffice/ui';
import { registerMenu } from './registry.ts';
import { S } from '../strings/index.ts';

registerMenu({
  id: 'sheetTab.sheets', context: 'sheetTab', order: 100,
  items: (e, { sheetIndex: i = 0 }): MenuItem[] => [
    { id: 'ins', label: S.sheetMenu.insert, icon: 'add', onClick: e.onAdd },
    { id: 'del', label: S.sheetMenu.delete, icon: 'delete', disabled: e.visibleCount <= 1, onClick: () => e.onDelete(i) },
    { id: 'ren', label: S.sheetMenu.rename, icon: 'rename', onClick: () => e.startRename(i) },
    { id: 'left', label: S.sheetMenu.moveLeft, icon: 'arrow_left', disabled: i === 0, onClick: () => e.onMove(i, i - 1) },
    { id: 'right', label: S.sheetMenu.moveRight, icon: 'arrow_right', disabled: i >= e.sheetCount - 1, onClick: () => e.onMove(i, i + 1) },
    { id: 'dup', label: S.sheetMenu.duplicate, icon: 'copy', onClick: () => e.onDuplicate(i) },
  ],
});
registerMenu({
  id: 'sheetTab.look', context: 'sheetTab', order: 200,
  items: (e, { sheetIndex: i = 0 }): MenuItem[] => [
    {
      id: 'color', label: S.sheetMenu.tabColor, icon: 'color_fill',
      items: [
        { id: 'none', label: S.sheetMenu.noColor, onClick: () => e.onColor(i, null) },
        ...STANDARD_COLORS.map((c) => ({ id: c.color, label: c.label, adornment: <span className="xl-swatch" style={{ background: c.color }} />, onClick: () => e.onColor(i, c.color.replace('#', '')) })),
      ],
    },
    { id: 'hide', label: S.sheetMenu.hide, icon: 'eye_off', disabled: e.visibleCount <= 1, onClick: () => e.onHide(i) },
    { id: 'unhide', label: S.sheetMenu.unhide, icon: 'eye', disabled: e.hiddenCount === 0, onClick: e.onUnhide },
  ],
});
registerMenu({
  id: 'sheetTab.protect', context: 'sheetTab', order: 300,
  items: (e): MenuItem[] => [{ id: 'protect', label: S.sheetMenu.protect, icon: 'shield_lock', onClick: e.onProtect }],
});
