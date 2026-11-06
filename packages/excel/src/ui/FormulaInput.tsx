// Champ de saisie partage par la barre de formule et l'editeur dans la cellule : references colorees,
// saisie semi-automatique des fonctions (Tab) et info-bulle des arguments.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { argLabel, argumentAt, completions, findRefs, functionInfo, wordAtCaret, type FnInfo } from '../logic/formula-ui.ts';
import { columnCompletions, columnContext, nameCompletions, type NameCompletion } from '../logic/formulas/completion.ts';
import { useCompletionSource } from './formulas/completion-context.ts';

/** Entree de la liste de saisie semi-automatique : une fonction, un nom defini, un tableau ou une colonne de tableau. */
type Suggestion = { type: 'fn'; fn: FnInfo } | { type: 'name'; item: NameCompletion };

export interface FormulaInputHandle {
  focus: () => void;
  setCaret: (pos: number) => void;
  caret: () => number;
  element: () => HTMLTextAreaElement | null;
}

export interface FormulaInputProps {
  value: string;
  onChange: (text: string, caret: number) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCaret?: (caret: number) => void;
  onFocus?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel: string;
  /** Afficher les aides (completion, arguments) sous le champ. */
  assist: boolean;
  multiline?: boolean;
  onFunctionHelp?: (fn: FnInfo) => void;
}

const suggestionHelp = (s: Suggestion | undefined): string => (s ? (s.type === 'fn' ? s.fn.description : s.item.description) : '');

function Mirror({ text }: { text: string }) {
  const refs = findRefs(text);
  const parts: ReactNode[] = [];
  let pos = 0;
  refs.forEach((r, i) => {
    if (r.start > pos) parts.push(<span key={`t${i}`}>{text.slice(pos, r.start)}</span>);
    parts.push(<span key={`r${i}`} style={{ color: r.color }}>{text.slice(r.start, r.end)}</span>);
    pos = r.end;
  });
  parts.push(<span key="end">{`${text.slice(pos)}​`}</span>);
  return <>{parts}</>;
}

export const FormulaInput = forwardRef<FormulaInputHandle, FormulaInputProps>(function FormulaInput(p, ref) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const mirror = useRef<HTMLDivElement | null>(null);
  const [caret, setCaretState] = useState(p.value.length);
  const [pick, setPick] = useState(0);
  const [closed, setClosed] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    setCaret: (pos: number) => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaretState(pos);
    },
    caret: () => area.current?.selectionStart ?? p.value.length,
    element: () => area.current,
  }), [p.value.length]);

  const source = useCompletionSource();
  const word = p.assist && !closed ? wordAtCaret(p.value, caret) : null;
  const column = p.assist && !closed ? columnContext(p.value, caret) : null;
  const list = useMemo((): Suggestion[] => {
    if (column) return columnCompletions(column.table, column.prefix, source).map((item) => ({ type: 'name', item }));
    if (!word) return [];
    // Les noms ne se perdent pas derriere douze fonctions : au plus quatre noms, le reste de la liste aux fonctions.
    const names = nameCompletions(word.word, source, 4);
    return [...completions(word.word, 12 - names.length).map((fn): Suggestion => ({ type: 'fn', fn })), ...names.map((item): Suggestion => ({ type: 'name', item }))];
  }, [word?.word, word?.start, column?.table, column?.prefix, source]);
  const arg = p.assist ? argumentAt(p.value, caret) : null;
  const argInfo = arg ? functionInfo(arg.fn) : undefined;

  const accept = (s: Suggestion): void => {
    const start = column ? column.start : word?.start;
    if (start === undefined) return;
    const before = p.value.slice(0, start);
    const after = p.value.slice(caret);
    const insert = s.type === 'fn' ? `${s.fn.name}(` : s.item.kind === 'column' ? `${s.item.text}]` : s.item.text;
    const text = `${before}${insert}${after}`;
    const pos = before.length + insert.length;
    p.onChange(text, pos);
    requestAnimationFrame(() => {
      area.current?.setSelectionRange(pos, pos);
      setCaretState(pos);
    });
  };

  const track = (): void => {
    const pos = area.current?.selectionStart ?? 0;
    setCaretState(pos);
    p.onCaret?.(pos);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (list.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPick((k) => (k + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const choice = list[pick] ?? list[0];
        if (choice) accept(choice);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setClosed(true);
        return;
      }
    }
    if (e.key === 'F1' && argInfo) {
      e.preventDefault();
      p.onFunctionHelp?.(argInfo);
      return;
    }
    p.onKeyDown?.(e);
  };

  const hint = argInfo ? argLabel(argInfo, arg?.index ?? 0) : null;

  return (
    <div className={`xl-fi ${p.className ?? ''}`} style={p.style}>
      <div ref={mirror} className="xl-fi__mirror" aria-hidden>
        <Mirror text={p.value} />
      </div>
      <textarea
        ref={area}
        className="xl-fi__input"
        value={p.value}
        spellCheck={false}
        aria-label={p.ariaLabel}
        rows={1}
        onFocus={p.onFocus}
        onChange={(e) => {
          setClosed(false);
          setPick(0);
          const pos = e.target.selectionStart;
          setCaretState(pos);
          p.onChange(e.target.value, pos);
        }}
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={onKeyDown}
        onKeyUp={track}
        onClick={track}
        onSelect={track}
      />
      {p.assist && list.length > 0 && (
        <ul className="xl-ac" role="listbox">
          {list.map((f, i) => (
            <li
              key={f.type === 'fn' ? f.fn.name : `${f.item.kind}:${f.item.text}`}
              role="option"
              aria-selected={i === pick}
              className={i === pick ? 'is-active' : ''}
              onPointerDown={(e) => {
                e.preventDefault();
                accept(f);
              }}
              onPointerEnter={() => setPick(i)}
            >
              <span className="xl-ac__fx">{f.type === 'fn' ? 'fx' : f.item.kind === 'table' ? 'tab' : f.item.kind === 'column' ? 'col' : f.item.kind === 'special' ? '#' : 'nom'}</span>
              <span>{f.type === 'fn' ? f.fn.name : f.item.text}</span>
            </li>
          ))}
          {suggestionHelp(list[pick]) && <li className="xl-ac__desc" aria-hidden>{suggestionHelp(list[pick])}</li>}
        </ul>
      )}
      {p.assist && list.length === 0 && hint && argInfo && (
        <div className="xl-arghint" role="tooltip">
          <button type="button" className="xl-arghint__fn" onPointerDown={(e) => { e.preventDefault(); p.onFunctionHelp?.(argInfo); }}>{argInfo.name}</button>(
          {hint.parts.map((a, i) => (
            <span key={`${a}${i}`}>
              {i > 0 ? '; ' : ''}
              <span className={i === hint.current ? 'is-current' : ''}>{a}</span>
            </span>
          ))}
          )
        </div>
      )}
    </div>
  );
});
