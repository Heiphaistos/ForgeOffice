// Menu du clic droit pendant le diaporama : navigation, atteindre une diapositive, pointeur, écran noir/blanc, fin.
import type { Deck } from '@forgeoffice/pptx';
import { slideTitle } from '@forgeoffice/pptx';
import type { MenuItem } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';

export type ShowTool = 'arrow' | 'pen' | 'highlighter' | 'laser' | 'eraser';

export interface ShowMenuContext {
  deck: Deck;
  order: readonly number[];
  pos: number;
  tool: ShowTool;
  blank: 'black' | 'white' | null;
  hasInk: boolean;
  next: () => void;
  back: () => void;
  goTo: (pos: number) => void;
  setTool: (tool: ShowTool) => void;
  setBlank: (blank: 'black' | 'white' | null) => void;
  clearInk: () => void;
  end: () => void;
}

export function showMenuItems(c: ShowMenuContext): MenuItem[] {
  const M = S3.showMenu;
  const toolItem = (id: ShowTool, label: string): MenuItem => ({ id, label, checked: c.tool === id, onClick: () => c.setTool(id) });
  return [
    { id: 'next', label: S.show.next, icon: 'arrow_right', disabled: c.pos >= c.order.length - 1, onClick: c.next },
    { id: 'prev', label: S.show.previous, icon: 'arrow_left', disabled: c.pos <= 0, onClick: c.back },
    {
      id: 'goto', label: M.goTo, icon: 'slide_play',
      items: c.order.map((index, p) => {
        const slide = c.deck.slides[index];
        return { id: `g${p}`, label: `${index + 1}. ${(slide && slideTitle(slide)) || S.dialogs.slideN(index + 1)}`, checked: p === c.pos, onClick: () => c.goTo(p) };
      }),
    },
    { id: 's1', kind: 'separator' },
    {
      id: 'pointer', label: M.pointer, icon: 'pen',
      items: [
        toolItem('arrow', M.arrow),
        toolItem('pen', M.pen),
        toolItem('highlighter', M.highlighter),
        toolItem('laser', M.laser),
        toolItem('eraser', M.eraser),
        { id: 'sp', kind: 'separator' },
        { id: 'clear', label: M.clearInk, disabled: !c.hasInk, onClick: c.clearInk },
      ],
    },
    {
      id: 'screen', label: M.screen, icon: 'desktop',
      items: [
        { id: 'black', label: M.black, checked: c.blank === 'black', onClick: () => c.setBlank(c.blank === 'black' ? null : 'black') },
        { id: 'white', label: M.white, checked: c.blank === 'white', onClick: () => c.setBlank(c.blank === 'white' ? null : 'white') },
      ],
    },
    { id: 's2', kind: 'separator' },
    { id: 'end', label: S.show.endShow, icon: 'dismiss', onClick: c.end },
  ];
}
