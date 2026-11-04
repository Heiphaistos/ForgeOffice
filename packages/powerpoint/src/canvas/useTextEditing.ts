// Saisie dans une zone de texte rendue depuis le modele : chaque frappe (beforeinput) est appliquee au modele,
// puis le DOM est redessine et la selection reecrite. Presse-papiers riche interne + texte brut.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import type { Paragraph, TextBody } from '@forgeoffice/pptx';
import {
  comparePos, deleteRange, insertParagraphs, insertText, isCollapsed, nextPos, orderRange, prevPos, sliceBody, splitParagraph, textOfRange, wordBoundary,
  type TextRange,
} from './text.ts';
import { readSelection, writeSelection } from './text-dom.ts';
import type { TextTarget } from './types.ts';

/** Presse-papiers riche du texte (meme application) : reconnu par son texte brut. */
let richClipboard: { plain: string; paragraphs: Paragraph[] } | null = null;

export interface TextEditingOptions {
  target: TextTarget | null;
  /** Corps de texte courant de la cible (copie). */
  body: TextBody | null;
  /** Applique une modification au corps de texte cible ; la fonction renvoie la nouvelle plage. */
  edit: (fn: (body: TextBody, range: TextRange) => TextRange, group?: string) => void;
  setRange: (range: TextRange) => void;
  exit: () => void;
  /** Tab / Maj+Tab : renvoie vrai si traite (cellule suivante, niveau de liste). */
  onTab: (shift: boolean) => boolean;
}

const sameRange = (a: TextRange | null, b: TextRange): boolean => !!a && comparePos(a.start, b.start) === 0 && comparePos(a.end, b.end) === 0;

export function useTextEditing({ target, body, edit, setRange, exit, onTab }: TextEditingOptions): { flowRef: { current: HTMLDivElement | null }; flowProps: HTMLAttributes<HTMLDivElement>; flowKey: number } {
  const flowRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ target, body, edit, setRange, exit, onTab });
  latest.current = { target, body, edit, setRange, exit, onTab };
  const [flowKey, setFlowKey] = useState(0);
  const composing = useRef(false);
  const active = target !== null;
  const targetKey = target ? `${target.shapeId}:${target.cell?.row ?? ''}:${target.cell?.col ?? ''}` : '';

  // Selection du modele -> DOM apres chaque rendu.
  useLayoutEffect(() => {
    const root = flowRef.current;
    if (!root || !target || composing.current) return;
    if (root.ownerDocument.activeElement !== root) root.focus({ preventScroll: true });
    if (!sameRange(readSelection(root), target.range)) writeSelection(root, target.range);
  });

  // Selection DOM -> modele (fleches, souris, Ctrl+A).
  useEffect(() => {
    if (!active) return;
    const onChange = (): void => {
      const root = flowRef.current;
      const t = latest.current.target;
      if (!root || !t || composing.current) return;
      const range = readSelection(root);
      if (range && !sameRange(t.range, range)) latest.current.setRange(range);
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [active]);

  // Frappe : beforeinput natif (inputType).
  useEffect(() => {
    const root = flowRef.current;
    if (!root || !active) return;
    const replace = (text: string, group = 'typing'): void =>
      latest.current.edit((body, range) => {
        const at = deleteRange(body, orderRange(range));
        const end = insertText(body, at, text);
        return { start: end, end };
      }, group);
    const remove = (dir: -1 | 1, word: boolean): void =>
      latest.current.edit((body, range) => {
        if (!isCollapsed(range)) {
          const at = deleteRange(body, orderRange(range));
          return { start: at, end: at };
        }
        const pos = range.start;
        const other = word ? wordBoundary(body, pos, dir) : dir < 0 ? prevPos(body, pos) : nextPos(body, pos);
        const at = deleteRange(body, { start: pos, end: other });
        return { start: at, end: at };
      });
    const onBeforeInput = (e: InputEvent): void => {
      if (composing.current) return;
      e.preventDefault();
      switch (e.inputType) {
        case 'insertText':
        case 'insertReplacementText':
          replace(e.data ?? e.dataTransfer?.getData('text/plain') ?? '');
          break;
        case 'insertParagraph':
          latest.current.edit((body, range) => {
            const at = deleteRange(body, orderRange(range));
            const end = splitParagraph(body, at);
            return { start: end, end };
          }, 'typing');
          break;
        case 'insertLineBreak':
          replace('\v');
          break;
        case 'deleteContentBackward':
          remove(-1, false);
          break;
        case 'deleteContentForward':
          remove(1, false);
          break;
        case 'deleteWordBackward':
          remove(-1, true);
          break;
        case 'deleteWordForward':
          remove(1, true);
          break;
        case 'deleteByCut':
        case 'deleteContent':
          replace('', 'cut');
          break;
        case 'insertFromDrop':
          replace(e.dataTransfer?.getData('text/plain') ?? '', 'drop');
          break;
        default:
          break;
      }
    };
    const onCompositionStart = (): void => {
      composing.current = true;
    };
    const onCompositionEnd = (e: CompositionEvent): void => {
      composing.current = false;
      // Le navigateur a modifie le DOM pendant la composition : la zone est reconstruite depuis le modele.
      setFlowKey((k) => k + 1);
      replace(e.data ?? '');
    };
    const onCopy = (e: ClipboardEvent): void => {
      const t = latest.current.target;
      const current = latest.current.body;
      if (!t || !current || isCollapsed(t.range)) return;
      e.preventDefault();
      const plain = textOfRange(current, t.range);
      richClipboard = { plain, paragraphs: sliceBody(current, t.range) };
      e.clipboardData?.setData('text/plain', plain);
      if (e.type === 'cut') {
        latest.current.edit((b, range) => {
          const at = deleteRange(b, orderRange(range));
          return { start: at, end: at };
        }, 'cut');
      }
    };
    const onPaste = (e: ClipboardEvent): void => {
      const plain = e.clipboardData?.getData('text/plain') ?? '';
      if (!plain) return;
      e.preventDefault();
      e.stopPropagation();
      const rich = richClipboard && richClipboard.plain.replace(/\r\n?/g, '\n') === plain.replace(/\r\n?/g, '\n') ? richClipboard.paragraphs : null;
      latest.current.edit((body, range) => {
        const at = deleteRange(body, orderRange(range));
        const end = rich ? insertParagraphs(body, at, rich) : insertText(body, at, plain);
        return { start: end, end };
      }, 'paste');
    };
    root.addEventListener('beforeinput', onBeforeInput);
    root.addEventListener('compositionstart', onCompositionStart);
    root.addEventListener('compositionend', onCompositionEnd);
    root.addEventListener('copy', onCopy);
    root.addEventListener('cut', onCopy);
    root.addEventListener('paste', onPaste);
    return () => {
      root.removeEventListener('beforeinput', onBeforeInput);
      root.removeEventListener('compositionstart', onCompositionStart);
      root.removeEventListener('compositionend', onCompositionEnd);
      root.removeEventListener('copy', onCopy);
      root.removeEventListener('cut', onCopy);
      root.removeEventListener('paste', onPaste);
    };
  }, [active, targetKey, flowKey]);

  const flowProps = useMemo<HTMLAttributes<HTMLDivElement>>(
    () => ({
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: true,
      lang: 'fr',
      role: 'textbox',
      'aria-multiline': true,
      onKeyDown: (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          latest.current.exit();
        } else if (e.key === 'Tab') {
          if (latest.current.onTab(e.shiftKey)) {
            e.preventDefault();
            e.stopPropagation();
          }
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
          e.stopPropagation();
        }
      },
      onPointerDown: (e) => e.stopPropagation(),
      onDoubleClick: (e) => e.stopPropagation(),
    }),
    [],
  );
  return { flowRef, flowProps, flowKey };
}
