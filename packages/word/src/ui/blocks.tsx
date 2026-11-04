// Rendu statique de blocs (en-tetes, pieds de page, notes) et petit editeur pour les modifier.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { DOMSerializer, type Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Block } from '@forgeoffice/docx';
import { blocksFromPM, documentToPM } from '../editor/convert.ts';
import { setRunProp } from '../editor/commands.ts';

export interface StaticBlocksProps {
  schema: Schema;
  blocks: readonly Block[];
  className?: string;
  /** Valeurs des champs PAGE / NUMPAGES et numero de note affiches. */
  page?: string;
  pages?: string;
  noteNumber?: string;
  onDoubleClick?: () => void;
  /** En-tetes et pieds : tabulations = colonnes gauche / centre / droite (taquets du style En-tete). */
  tabGrid?: boolean;
}

const TAB = String.fromCharCode(9);

/** Paragraphe a 1 ou 2 tabulations -> trois colonnes (gauche, centre, droite), comme les taquets du style En-tete de Word. */
function tabColumns(p: HTMLElement): void {
  const parts: DocumentFragment[] = [];
  for (let i = 0; i < 2; i++) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let found: Text | null = null;
    let at = -1;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const k = (n.textContent ?? '').indexOf(TAB);
      if (k >= 0) {
        found = n as Text;
        at = k;
        break;
      }
    }
    if (!found) break;
    const range = document.createRange();
    range.setStart(p, 0);
    range.setEnd(found, at);
    parts.push(range.extractContents());
    found.deleteData(0, 1);
  }
  if (!parts.length) return;
  const rest = document.createRange();
  rest.selectNodeContents(p);
  parts.push(rest.extractContents());
  p.style.display = 'grid';
  p.style.gridTemplateColumns = '1fr 1fr 1fr';
  parts.forEach((frag, i) => {
    const cell = document.createElement('span');
    cell.style.textAlign = ['left', 'center', 'right'][i] ?? 'left';
    cell.style.gridColumn = String(i + 1);
    cell.append(frag);
    p.append(cell);
  });
}

/** Blocs rendus avec le meme schema que l'editeur (styles du document appliques par la feuille de styles). */
export function StaticBlocks({ schema, blocks, className, page, pages, noteNumber, onDoubleClick, tabGrid }: StaticBlocksProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frag = DOMSerializer.fromSchema(schema).serializeFragment(documentToPM(schema, { body: [...blocks] }).content);
    el.replaceChildren(frag);
    for (const f of el.querySelectorAll<HTMLElement>('.fo-fld')) {
      if (f.dataset.code === 'PAGE' && page) f.textContent = page;
      if ((f.dataset.code === 'NUMPAGES' || f.dataset.code === 'SECTIONPAGES') && pages) f.textContent = pages;
    }
    if (noteNumber) for (const m of el.querySelectorAll('.fo-notemark')) m.textContent = noteNumber;
    if (tabGrid) for (const p of el.querySelectorAll<HTMLElement>('p')) tabColumns(p);
  }, [schema, blocks, page, pages, noteNumber, tabGrid]);
  return <div ref={ref} className={className} onDoubleClick={onDoubleClick} />;
}

export interface MiniEditorProps {
  schema: Schema;
  blocks: readonly Block[];
  onChange: (blocks: Block[]) => void;
  onExit?: () => void;
  className?: string;
  autoFocus?: boolean;
  label: string;
}

/** Editeur reduit (en-tete, pied de page, note) : memes marques et paragraphes que le corps. */
export function MiniEditor({ schema, blocks, onChange, onExit, className, autoFocus, label }: MiniEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => {
    if (!ref.current) return;
    const bold = (state: EditorState, dispatch?: EditorView['dispatch']): boolean => {
      const on = (state.storedMarks ?? state.selection.$from.marks()).some((m) => m.type.name === 'rp_bold' && m.attrs.v);
      return setRunProp('bold', !on)(state, dispatch);
    };
    const view = new EditorView(ref.current, {
      state: EditorState.create({
        doc: documentToPM(schema, { body: [...blocks] }),
        plugins: [history(), keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-b': bold, 'Mod-g': bold, Escape: () => { exit.current?.(); return true; } }), keymap(baseKeymap)],
      }),
      attributes: { class: 'fo-doc fo-mini', 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' },
      dispatchTransaction(tr) {
        view.updateState(view.state.apply(tr));
        if (tr.docChanged) change.current(blocksFromPM(view.state.doc));
      },
    });
    if (autoFocus) view.focus();
    return () => view.destroy();
    // Le contenu initial n'est lu qu'au montage : l'editeur garde ensuite son propre etat.
  }, [schema]);
  return <div ref={ref} className={className} />;
}
