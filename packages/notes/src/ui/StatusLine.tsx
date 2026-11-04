// Barre d'etat : ligne, colonne, selection, caracteres | langage, fins de ligne, encodage, zoom.
import { useSyncExternalStore } from 'react';
import { StatusBar, type StatusItem } from '@forgeoffice/ui';
import type { PaletteMode } from '../commands.ts';
import type { Workspace } from '../workspace.ts';
import { S } from '../strings.ts';

export interface StatusLineProps {
  ws: Workspace;
  zoom: number;
  onZoom: (zoom: number) => void;
  onPick: (mode: PaletteMode) => void;
}

export function StatusLine({ ws, zoom, onZoom, onPick }: StatusLineProps) {
  const c = useSyncExternalStore(ws.subscribeCursor, ws.getCursor);
  const tab = ws.active;
  const left: StatusItem[] = [{ id: 'pos', label: S.status.position(c.line, c.col), onClick: () => onPick('commands') }];
  if (c.selChars > 0) left.push({ id: 'sel', label: S.status.selection(c.selChars, c.ranges) });
  left.push({ id: 'chars', label: S.status.chars(c.chars) });
  if (tab?.readOnly) left.push({ id: 'ro', label: S.readOnly, icon: 'lock_closed' });
  const right: StatusItem[] = tab
    ? [
        { id: 'lang', label: ws.languageName(tab), title: S.status.languageTitle, onClick: () => onPick('language') },
        { id: 'eol', label: S.eols[tab.eol], title: S.status.eolTitle, onClick: () => onPick('eol') },
        { id: 'enc', label: S.encodings[tab.encoding], title: S.status.encodingTitle, onClick: () => onPick('encoding') },
      ]
    : [];
  return <StatusBar left={left} right={right} zoom={zoom} onZoomChange={onZoom} />;
}
