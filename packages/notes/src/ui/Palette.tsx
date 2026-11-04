// Palette (Ctrl+Maj+P), ouverture rapide (Ctrl+E), recherche dans les fichiers et selecteurs (langage, encodage...).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, matchScore, type IconName } from '@forgeoffice/ui';
import { S } from '../strings.ts';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
  checked?: boolean;
  run: () => void;
}

export interface PaletteProps {
  placeholder: string;
  /** Liste fixe filtree par la saisie... */
  items?: readonly PaletteItem[];
  /** ...ou recherche calculee a chaque saisie (dans les fichiers). */
  search?: (query: string) => readonly PaletteItem[];
  onClose: () => void;
}

const MAX_SHOWN = 200;

export function Palette({ placeholder, items, search, onClose }: PaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    if (search) return query.trim().length < 2 ? [] : search(query).slice(0, MAX_SHOWN);
    const all = items ?? [];
    if (!query.trim()) return all.slice(0, MAX_SHOWN);
    return all
      .map((it) => ({ it, score: Math.max(matchScore(it.label, query), matchScore(`${it.label} ${it.hint ?? ''}`, query) - 1) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SHOWN)
      .map((x) => x.it);
  }, [items, search, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const pick = (it: PaletteItem | undefined): void => {
    if (!it) return;
    onClose();
    it.run();
  };

  const empty = search && query.trim().length < 2 ? S.palette.typeMore : S.palette.none;
  return (
    <div className="nt-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nt-palette" role="dialog" aria-label={S.palette.label}>
        <input
          className="nt-palette__input"
          autoFocus
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls="nt-palette-list"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, shown.length - 1));
            else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
            else if (e.key === 'PageDown') setIndex((i) => Math.min(i + 10, shown.length - 1));
            else if (e.key === 'PageUp') setIndex((i) => Math.max(i - 10, 0));
            else if (e.key === 'Enter') pick(shown[index]);
            else if (e.key === 'Escape') onClose();
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
        />
        <ul className="nt-palette__list fo-scroll" id="nt-palette-list" role="listbox" ref={listRef}>
          {shown.length === 0 && <li className="nt-palette__empty">{empty}</li>}
          {shown.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === index}
              className={`nt-palette__item${i === index ? ' is-active' : ''}`}
              onMouseMove={() => setIndex(i)}
              onClick={() => pick(it)}
            >
              <span className="nt-palette__icon">{it.checked ? <Icon name="checkmark" size={16} /> : it.icon ? <Icon name={it.icon} size={16} /> : null}</span>
              <span className="nt-palette__label">{it.label}</span>
              {it.hint && <span className="nt-palette__hint">{it.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
