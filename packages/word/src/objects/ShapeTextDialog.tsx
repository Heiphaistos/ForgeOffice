// Boite « Modifier le texte » d'une forme ou d'une zone de texte : une ligne de la boite = un paragraphe.
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import type { Block, Paragraph } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { updateAtom } from '../editor/commands.ts';

const O = X.objects;

const textOf = (blocks: readonly Block[] | undefined): string => (blocks ?? []).map((b) => (b.type === 'paragraph' ? b.inlines.map((i) => (i.type === 'text' ? i.text : '')).join('') : '')).join('\n');
const toBlocks = (text: string): Paragraph[] => text.split('\n').map((line) => ({ type: 'paragraph', props: {}, inlines: line ? [{ type: 'text', text: line, props: {} }] : [] }));

export function ShapeTextDialog({ c, onClose }: { c: Ctl; onClose: () => void }) {
  const shp = c.sel.shape;
  const [text, setText] = useState(textOf(shp?.data.text));
  const ok = (): void => {
    if (shp) c.run(updateAtom(shp.pos, { ...shp.data, text: text.trim() ? toBlocks(text) : undefined }));
    onClose();
  };
  return (
    <Dialog open title={O.editText} onClose={onClose} width={440} actions={[{ label: T.dialogs.ok, primary: true, onClick: ok }, { label: T.dialogs.cancel, onClick: onClose }]}>
      <textarea className="fo-word-textarea" aria-label={O.editText} rows={6} value={text} autoFocus onChange={(e) => setText(e.target.value)} />
    </Dialog>
  );
}

