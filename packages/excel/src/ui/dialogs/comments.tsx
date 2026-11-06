// Nouveau commentaire : saisie du texte dans une boite de dialogue (window.prompt est absent de plusieurs webviews).
import { useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import type { DialogEnv, DialogHostApi } from '../registry.ts';
import { S } from '../../strings/index.ts';

export function NewCommentDialog({ x, host }: { x: DialogEnv; host: DialogHostApi }) {
  const [text, setText] = useState('');
  const apply = (): void => {
    const body = text.trim();
    if (body) {
      const a = x.sel.active;
      x.store.commit((d) => {
        const s = d.sheet(x.si);
        s.threadedComments = [...s.threadedComments, { id: `{${crypto.randomUUID().toUpperCase()}}`, ref: { row: a.row, col: a.col }, personId: 'local', text: body, date: new Date().toISOString(), replies: [] }];
      });
      host.setUi({ commentsPane: true });
    }
    x.close();
  };
  return (
    <Dialog open title={S.newComment} onClose={x.close} onConfirm={apply} width={380}>
      <textarea className="xl-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label={S.newComment} data-autofocus />
    </Dialog>
  );
}
