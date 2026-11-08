// Generateur d'expressions (Ctrl+F2) : zone d'expression, liste de categories (champs, fonctions, operateurs, constantes),
// liste d'elements a inserer par double-clic ; controle de la syntaxe avant validation.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { catalog, checkExpression, insertAt, type CatalogItem, type FieldSource } from '../logic/expression-catalog.ts';
import { E } from '../strings-expr.ts';

interface Props {
  open: boolean;
  /** Intitule de la cible (« Critère », « Champ »). */
  target: string;
  initial: string;
  sources: readonly FieldSource[];
  onCancel: () => void;
  onApply: (expression: string) => void;
}

export function ExpressionBuilder({ open, target, initial, sources, onCancel, onApply }: Props) {
  const [text, setText] = useState(initial);
  const [category, setCategory] = useState(0);
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const caret = useRef(initial.length);
  const categories = useMemo(() => catalog(sources), [sources]);
  const items = categories[category]?.items ?? [];
  const error = checkExpression(text);

  useEffect(() => {
    if (open) {
      setText(initial);
      caret.current = initial.length;
      setCategory(0);
      setPicked(null);
    }
  }, [open, initial]);

  const insert = (item: CatalogItem): void => {
    const next = insertAt(text, area.current?.selectionStart ?? caret.current, item);
    setText(next.text);
    caret.current = next.caret;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <Dialog
      open={open}
      title={E.title}
      description={E.description(target)}
      width={640}
      onClose={onCancel}
      actions={[
        { label: E.ok, primary: true, disabled: error !== null, onClick: () => onApply(text.trim()) },
        { label: E.cancel, onClick: onCancel },
      ]}
    >
      <div className="acc-expr">
        <textarea
          ref={area}
          className="acc-expr__text"
          value={text}
          rows={4}
          spellCheck={false}
          aria-label={E.expression}
          aria-invalid={error !== null}
          data-autofocus
          onChange={(e) => { setText(e.currentTarget.value); caret.current = e.currentTarget.selectionStart; }}
          onSelect={(e) => { caret.current = e.currentTarget.selectionStart; }}
        />
        <p className={`acc-expr__status${error ? ' is-error' : ''}`} role="status">{error ?? E.valid}</p>
        <div className="acc-expr__lists">
          <ul className="acc-expr__list" aria-label={E.categories}>
            {categories.map((c, i) => (
              <li key={c.id}>
                <button type="button" className={i === category ? 'is-on' : undefined} onClick={() => { setCategory(i); setPicked(null); }}>{c.label}</button>
              </li>
            ))}
          </ul>
          <ul className="acc-expr__list" aria-label={E.items}>
            {items.map((it) => (
              <li key={it.label}>
                <button type="button" className={it === picked ? 'is-on' : undefined} onClick={() => setPicked(it)} onDoubleClick={() => insert(it)}>{it.label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="acc-expr__foot">
          <span className="acc-muted">{picked?.hint ?? E.hint}</span>
          <button type="button" className="acc-expr__paste" disabled={picked === null} onClick={() => picked && insert(picked)}>{E.paste}</button>
        </div>
      </div>
    </Dialog>
  );
}
