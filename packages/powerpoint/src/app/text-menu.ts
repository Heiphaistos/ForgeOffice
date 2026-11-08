// Menu contextuel du texte en édition : presse-papiers du texte, Police, Paragraphe, Puces, Lien.
import type { MenuItem } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';

const FLOW = '[data-text-flow][contenteditable="true"]';

/** Rend le focus a la zone de saisie (le menu l'a pris) puis lance la commande d'edition du navigateur. */
function onFlow(run: (flow: HTMLElement) => void): void {
  const flow = document.querySelector<HTMLElement>(FLOW);
  if (!flow) return;
  flow.focus({ preventScroll: true });
  run(flow);
}

async function pasteText(): Promise<void> {
  const text = await navigator.clipboard?.readText().catch(() => '');
  if (!text) return;
  // Evenement de collage synthetique : l'editeur de texte le traite comme un Ctrl+V (texte riche interne reconnu).
  const data = new DataTransfer();
  data.setData('text/plain', text);
  onFlow((flow) => flow.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })));
}

export function textMenuItems(ed: Editor, setUi: Editor['setUi']): MenuItem[] {
  const collapsed = (() => {
    const r = ed.selection.text?.range;
    return !r || (r.start.p === r.end.p && r.start.o === r.end.o);
  })();
  return [
    { id: 'cut', label: S.common.cut, icon: 'cut', shortcut: 'Ctrl+X', disabled: collapsed, onClick: () => onFlow(() => document.execCommand('cut')) },
    { id: 'copy', label: S.common.copy, icon: 'copy', shortcut: 'Ctrl+C', disabled: collapsed, onClick: () => onFlow(() => document.execCommand('copy')) },
    { id: 'paste', label: S.common.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: () => void pasteText() },
    { id: 's1', kind: 'separator' },
    { id: 'font', label: `${S3.font.title}…`, icon: 'text_font', shortcut: 'Ctrl+T', onClick: () => setUi({ dialog: 'font' }) },
    { id: 'para', label: `${S3.paragraph.title}…`, icon: 'text_paragraph', onClick: () => setUi({ dialog: 'paragraph' }) },
    { id: 'bullets', label: S3.bullets.menu, icon: 'text_bullet_list_ltr', onClick: () => setUi({ dialog: 'bullets' }) },
    { id: 's2', kind: 'separator' },
    { id: 'link', label: S.insert.link, icon: 'link', shortcut: 'Ctrl+K', onClick: () => setUi({ dialog: 'link' }) },
    { id: 's3', kind: 'separator' },
    { id: 'spell', label: S3.textMenu.spellHint, icon: 'text_proofing_tools', disabled: true },
  ];
}
