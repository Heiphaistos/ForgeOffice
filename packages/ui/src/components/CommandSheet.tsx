// Feuille « Toutes les commandes » (filet de securite mobile) : recherche + liste de TOUTES les commandes du ruban, executables en un toucher.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons/Icon.tsx';
import type { RibbonTab } from '../ribbon-types.ts';
import { collectCommands } from '../logic/commands.ts';
import { commandSections } from '../logic/mobileRibbon.ts';
import { S } from '../strings.ts';

export function CommandSheet({ tabs, onClose }: { tabs: readonly RibbonTab[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => collectCommands(tabs), [tabs]);
  const sections = useMemo(() => commandSections(commands, query, S.sheet.results), [commands, query]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fo-sheet-scrim is-modal" aria-hidden onClick={onClose} />
      <div className="fo-sheet fo-sheet--commands" role="dialog" aria-modal="true" aria-label={S.sheet.allCommands}>
        <div className="fo-sheet__head">
          <h2>{S.sheet.allCommands}</h2>
          <button type="button" className="fo-sheet__close" aria-label={S.sheet.close} onClick={onClose}>
            <Icon name="dismiss" size={20} />
          </button>
        </div>
        <label className="fo-sheet__search">
          <Icon name="search" size={20} />
          <input ref={input} type="search" placeholder={S.sheet.searchCommands} aria-label={S.sheet.searchCommands} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </label>
        <div className="fo-sheet__list fo-scroll" role="list">
          {sections.length === 0 && <p className="fo-sheet__empty">{S.sheet.noCommand}</p>}
          {sections.map((s) => (
            <div key={s.title} role="group" aria-label={s.title}>
              {s.title && <div className="fo-sheet__section">{s.title}</div>}
              {s.entries.map((e) => (
                <button
                  key={`${e.path}|${e.id}`}
                  type="button"
                  className="fo-sheet__cmd"
                  role="listitem"
                  disabled={e.disabled}
                  data-cmd-sheet={e.id}
                  onClick={() => {
                    onClose();
                    e.run();
                  }}
                >
                  {e.icon ? <Icon name={e.icon} size={20} /> : <span className="fo-sheet__noicon" />}
                  <span className="fo-sheet__cmdtext">
                    <span>{e.label}</span>
                    {query.trim() !== '' && <span className="fo-sheet__path">{e.path}</span>}
                  </span>
                  {e.shortcut && <span className="fo-sheet__shortcut">{e.shortcut}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
