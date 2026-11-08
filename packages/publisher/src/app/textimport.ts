// Insertion d'un fichier texte (.txt, .md, .docx, .rtf, .odt) dans la zone de texte selectionnee, ou dans une nouvelle zone.
import { paragraphsFromText } from '@forgeoffice/pptx';
import { locate } from '@forgeoffice/powerpoint/canvas';
import { S } from '../strings.ts';
import { readTextFile, TEXT_FILE_EXTENSIONS } from '../textfile.ts';
import type { Editor } from './editor.ts';
import { insertTextAtCaret, insertTextBox } from './ops.ts';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Remplace le texte d'une zone par `text` (une ligne = un paragraphe), en gardant la mise en forme de son premier caractere. */
export function fillBox(ed: Editor, shapeId: number, text: string): void {
  ed.editShapes((shapes) => {
    const shape = locate(shapes, shapeId)?.shape;
    if (shape?.kind !== 'shape') return;
    const first = shape.text?.paragraphs[0]?.runs.find((r) => r.type === 'text');
    const body = (shape.text ??= { props: {}, paragraphs: [] });
    body.paragraphs = paragraphsFromText(text, first?.type === 'text' ? first.props : { size: 11, font: '+mn-lt' });
  }, 'textfile');
}

/** Choisit un fichier et pose son texte dans la zone selectionnee (le debordement suit le chainage de zones liees). */
export async function insertTextFile(ed: Editor): Promise<void> {
  const file = await ed.services.openFile([{ name: S.insert.textFileFilter, extensions: [...TEXT_FILE_EXTENSIONS] }]);
  if (!file) return;
  let text: string;
  try {
    text = await readTextFile(file.name, file.bytes);
  } catch (err) {
    ed.notify(`${S.insert.textFileFailed(file.name)} ${errorText(err)}`, 'error');
    return;
  }
  if (!text) {
    ed.notify(S.insert.textFileEmpty(file.name), 'warning');
    return;
  }
  let id = ed.selection.text?.shapeId ?? ed.selection.ids[0];
  const current = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  if (current?.kind !== 'shape' || !current.text) id = insertTextBox(ed);
  if (id !== undefined) fillBox(ed, id, text);
}

/** Colle le texte du presse-papiers sans mise en forme : a la saisie en cours (une ligne) ou dans une nouvelle zone (un paragraphe par ligne). */
export async function pastePlainText(ed: Editor): Promise<void> {
  let text = '';
  try {
    text = (await navigator.clipboard.readText()).replace(/\r\n?/g, '\n').trim();
  } catch (err) {
    ed.notify(`${S.insert.clipboardDenied} ${errorText(err)}`, 'warning');
    return;
  }
  if (!text) return;
  if (ed.selection.text) insertTextAtCaret(ed, text.replace(/\s*\n\s*/g, ' '));
  else fillBox(ed, insertTextBox(ed), text);
}
