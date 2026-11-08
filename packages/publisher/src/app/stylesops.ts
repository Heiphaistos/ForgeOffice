// Application d'un style de texte nomme a la selection.
import { resolveStyle, runPatchOf, type NamedStyle } from '../styles.ts';
import type { Editor } from './editor.ts';
import { applyParagraph, applyRun } from './ops.ts';

export function applyStyle(ed: Editor, style: NamedStyle): void {
  const resolved = resolveStyle(ed.pub.styles, style);
  applyRun(ed, runPatchOf(resolved), 'style');
  applyParagraph(ed, resolved.para, 'style');
}
