// Volet Texte du SmartArt : une ligne par élément (Tab = niveau suivant), le graphique suit la saisie.
import { useEffect, useState } from 'react';
import { S2 } from '../strings2.ts';
import type { Editor } from './editor.ts';
import { insertSmartArt, selectedSmartArt } from './insert-objects.ts';
import { itemsToText, parseItems } from './smartart.ts';
import { setSmartArtCursor } from './smartart-cursor.ts';

export function SmartArtPane({ ed }: { ed: Editor }) {
  const sa = selectedSmartArt(ed);
  const modelText = sa ? itemsToText(sa.items) : '';
  const [text, setText] = useState(modelText);
  // Changement extérieur (onglet SmartArt, autre SmartArt) : le texte local suit le modèle ; la frappe normalisée ne le remet pas en cause.
  useEffect(() => {
    if (itemsToText(parseItems(text)) !== modelText) setText(modelText);
  }, [modelText]);
  if (!sa) return <p className="pp-muted">{S2.smartart.panePlaceholder}</p>;
  const apply = (value: string): void => {
    setText(value);
    const items = parseItems(value);
    if (items.length) insertSmartArt(ed, sa.kind, items, sa.shape, sa.accent, 'smartart-text');
  };
  const cursor = (el: HTMLTextAreaElement): void => setSmartArtCursor(el.value.slice(0, el.selectionStart).split('\n').length - 1);
  return (
    <textarea
      className="pp-textarea"
      rows={14}
      aria-label={S2.smartart.items}
      value={text}
      data-testid="smartart-pane-text"
      onChange={(e) => apply(e.target.value)}
      onKeyUp={(e) => cursor(e.currentTarget)}
      onClick={(e) => cursor(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const el = e.currentTarget;
        const at = el.selectionStart;
        apply(`${text.slice(0, at)}\t${text.slice(el.selectionEnd)}`);
        window.setTimeout(() => el.setSelectionRange(at + 1, at + 1));
      }}
    />
  );
}
