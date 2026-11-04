// Liste deroulante modifiable (police, taille, style...) : saisie libre validee, filtre, clavier, apercu des options.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { ComboOption } from '../ribbon-types.ts';
import { fold } from '../logic/text.ts';
import { Popover } from './Popover.tsx';
import './ComboBox.css';

export interface ComboBoxProps {
  label: string;
  value: string;
  options: readonly ComboOption[];
  onChange: (value: string) => void;
  editable?: boolean;
  /** Normalise une saisie libre ; null = refusee (la valeur precedente revient). */
  validate?: (text: string) => string | null;
  width?: number;
  disabled?: boolean;
  keytip?: string;
  /** Style applique au texte du champ (ex. la police courante). */
  inputStyle?: CSSProperties;
  /** Filtre la liste pendant la saisie (defaut : true si modifiable). */
  filter?: boolean;
  /** Hauteur max de la liste. */
  listHeight?: number;
}

export function ComboBox({ label, value, options, onChange, editable = false, validate, width = 120, disabled, keytip, inputStyle, filter, listHeight = 360 }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    setText(value);
    setTyped(false);
  }, [value]);

  const shown = useMemo(() => {
    const doFilter = filter ?? editable;
    if (!doFilter || !typed || !text) return options;
    const q = fold(text);
    const starts = options.filter((o) => fold(o.label ?? o.value).startsWith(q));
    return starts.length > 0 ? starts : options.filter((o) => fold(o.label ?? o.value).includes(q));
  }, [options, text, typed, filter, editable]);

  const commit = (raw: string): void => {
    const exact = options.find((o) => fold(o.label ?? o.value) === fold(raw));
    const next = exact ? exact.value : validate ? validate(raw) : editable ? raw.trim() : null;
    setOpen(false);
    setTyped(false);
    if (next === null || next === '') {
      setText(value);
      return;
    }
    setText(next);
    if (next !== value) onChange(next);
  };

  const choose = (opt: ComboOption): void => {
    setOpen(false);
    setTyped(false);
    setText(opt.value);
    if (opt.value !== value) onChange(opt.value);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const index = active >= 0 ? active : shown.findIndex((o) => o.value === value);
    document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, shown, value, listId]);

  let lastGroup: string | undefined;
  return (
    <div ref={boxRef} className={`fo-combo${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`} style={{ width }}>
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete={editable ? 'list' : 'none'}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        data-keytip={keytip}
        data-ribbon-focus
        readOnly={!editable}
        disabled={disabled}
        value={text}
        style={inputStyle}
        onFocus={(e) => e.currentTarget.select()}
        onClick={() => {
          if (!editable) setOpen((o) => !o);
        }}
        onChange={(e) => {
          setText(e.currentTarget.value);
          setTyped(true);
          setOpen(true);
          setActive(0);
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && (boxRef.current?.contains(next) || (next as Element).closest?.('.fo-combo__list'))) return;
          if (typed) commit(text);
          else setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
              return;
            }
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            setActive((a) => Math.min(shown.length - 1, Math.max(0, a + dir)));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const opt = open && active >= 0 ? shown[active] : undefined;
            if (opt && (!typed || active > 0 || fold(opt.label ?? opt.value).startsWith(fold(text)))) choose(opt);
            else commit(text);
          } else if (e.key === 'Escape') {
            if (open || typed) {
              e.stopPropagation();
              setOpen(false);
              setTyped(false);
              setText(value);
            }
          } else if (e.key === 'Tab' && typed) {
            commit(text);
          }
        }}
      />
      <button type="button" tabIndex={-1} className="fo-combo__arrow" aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}>
        <Icon name="chevron_down" size={12} />
      </button>
      {open && boxRef.current && (
        <Popover anchor={boxRef.current} onClose={() => setOpen(false)} role="presentation" autoFocus={false} className="fo-combo__list" style={{ minWidth: width, maxHeight: listHeight }}>
          <div id={listId} role="listbox" aria-label={label}>
            {shown.map((opt, i) => {
              const header = opt.group && opt.group !== lastGroup ? opt.group : null;
              lastGroup = opt.group;
              return (
                <div key={`${opt.group ?? ''}-${opt.value}-${i}`}>
                  {header && <div className="fo-combo__group">{header}</div>}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={opt.value === value}
                    className={`fo-combo__option${i === active ? ' is-active' : ''}${opt.value === value ? ' is-selected' : ''}`}
                    style={opt.style}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(opt)}
                  >
                    {opt.label ?? opt.value}
                  </div>
                </div>
              );
            })}
          </div>
        </Popover>
      )}
    </div>
  );
}
