// Barre de titre Office 2024 : application, barre d'acces rapide personnalisable, nom du document, recherche de commandes, boutons de fenetre.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Settings, WindowControls } from '@forgeoffice/core';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S } from '../strings.ts';
import { searchCommands, type CommandEntry } from '../logic/commands.ts';
import { usePersistentState } from '../hooks.ts';
import type { MenuItem } from '../ribbon-types.ts';
import { AppBadge, Switch } from './Controls.tsx';
import { Menu } from './Menu.tsx';
import { Popover } from './Popover.tsx';
import { Tooltip } from './Tooltip.tsx';
import './TitleBar.css';

export interface QuickAccessItem {
  id: string;
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  /** Visible par defaut (sinon proposee dans « Personnaliser »). */
  defaultVisible?: boolean;
}

export type SaveState = 'saved' | 'modified' | 'saving' | null;

export interface TitleBarProps {
  /** Application : sigle, couleur, nom. */
  app: { glyph: string; accent: string; name: string };
  documentName?: string;
  /** Chemin ou emplacement affiche dans le volet du nom. */
  location?: string | null;
  saveState?: SaveState;
  /** Interrupteur « Enregistrement automatique » (absent = masque). */
  autoSave?: { enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean };
  quickAccess?: readonly QuickAccessItem[];
  /** Commandes cherchees par « Rechercher (Alt+Q) » (voir collectCommands). */
  commands?: readonly CommandEntry[];
  searchPlaceholder?: string;
  /** Renommer le document depuis le volet du nom. */
  onRename?: (name: string) => void;
  windowControls?: WindowControls | null;
  settings?: Settings | null;
  /** Zone libre a droite (avant les boutons de fenetre). */
  end?: ReactNode;
}

function CommandSearch({ commands, placeholder }: { commands: readonly CommandEntry[]; placeholder: string }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => (query.trim() ? searchCommands(commands, query) : []), [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (entry: CommandEntry | undefined): void => {
    if (!entry || entry.disabled) return;
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    entry.run();
  };

  return (
    <div ref={boxRef} className={`fo-tb__search${open && query ? ' is-open' : ''}`} data-keytip-top="Q">
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={S.titleBar.searchLabel}
        aria-expanded={open && results.length > 0}
        aria-controls="fo-tb-results"
        aria-activedescendant={open && results[active] ? `fo-tb-r-${active}` : undefined}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(results[active]);
          } else if (e.key === 'Escape') {
            setQuery('');
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      {open && query.trim() !== '' && boxRef.current && (
        <Popover anchor={boxRef.current} onClose={() => setOpen(false)} autoFocus={false} role="presentation" className="fo-tb__results" style={{ width: boxRef.current.offsetWidth }}>
          <div className="fo-tb__results-title">{S.titleBar.results}</div>
          <div id="fo-tb-results" role="listbox" aria-label={S.titleBar.results}>
            {results.length === 0 && <div className="fo-tb__noresult">{S.titleBar.noResult}</div>}
            {results.map((r, i) => (
              <div
                key={`${r.id}-${r.path}`}
                id={`fo-tb-r-${i}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={r.disabled || undefined}
                className={`fo-tb__result${i === active ? ' is-active' : ''}${r.disabled ? ' is-disabled' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(r)}
              >
                <span className="fo-tb__result-icon">{r.icon && <Icon name={r.icon} size={20} />}</span>
                <span className="fo-tb__result-text">
                  <span>{r.label}</span>
                  <span className="fo-tb__result-path">{r.path}</span>
                </span>
                {r.shortcut && <span className="fo-tb__result-key">{r.shortcut}</span>}
              </div>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}

function DocumentName({ name, location, saveState, onRename }: { name: string; location?: string | null; saveState: SaveState; onRename?: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLButtonElement>(null);
  const state = saveState === 'saved' ? S.titleBar.saved : saveState === 'modified' ? S.titleBar.modified : saveState === 'saving' ? S.titleBar.saving : null;
  const commit = (): void => {
    const next = draft.trim();
    if (next && next !== name) onRename?.(next);
    setOpen(false);
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="fo-tb__doc"
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(name);
          setOpen((o) => !o);
        }}
      >
        <span className="fo-tb__docname">{name}</span>
        {state && <span className="fo-tb__state">{`• ${state}`}</span>}
        <Icon name="chevron_down" size={12} />
      </button>
      {open && ref.current && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} label={S.titleBar.fileName} className="fo-tb__docpanel">
          <label className="fo-tb__doclabel" htmlFor="fo-tb-name">
            {S.titleBar.fileName}
          </label>
          <input
            id="fo-tb-name"
            className="fo-tb__docinput"
            value={draft}
            readOnly={!onRename}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
            onBlur={() => {
              if (onRename) commit();
            }}
          />
          <div className="fo-tb__doclabel">{S.titleBar.location}</div>
          <div className="fo-tb__docpath">
            <Icon name="folder" size={16} />
            <span>{location ?? S.titleBar.notSaved}</span>
          </div>
        </Popover>
      )}
    </>
  );
}

export function WindowButtons({ controls }: { controls: WindowControls }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let alive = true;
    const sync = (): void => {
      void controls.isMaximized().then((m) => {
        if (alive) setMaximized(m);
      });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => {
      alive = false;
      window.removeEventListener('resize', sync);
    };
  }, [controls]);
  return (
    <div className="fo-tb__window">
      <button type="button" className="fo-tb__winbtn" aria-label={S.titleBar.minimize} title={S.titleBar.minimize} onClick={() => controls.minimize()}>
        <Icon name="subtract" size={16} />
      </button>
      <button type="button" className="fo-tb__winbtn" aria-label={maximized ? S.titleBar.restore : S.titleBar.maximize} title={maximized ? S.titleBar.restore : S.titleBar.maximize} onClick={() => controls.toggleMaximize()}>
        <Icon name={maximized ? 'square_multiple' : 'square'} size={16} />
      </button>
      <button type="button" className="fo-tb__winbtn fo-tb__winbtn--close" aria-label={S.titleBar.close} title={S.titleBar.close} onClick={() => controls.close()}>
        <Icon name="dismiss" size={16} />
      </button>
    </div>
  );
}

export function TitleBar({ app, documentName, location, saveState = null, autoSave, quickAccess = [], commands = [], searchPlaceholder = S.titleBar.search, onRename, windowControls, settings, end }: TitleBarProps) {
  const defaults = quickAccess.filter((q) => q.defaultVisible !== false).map((q) => q.id);
  const [visibleIds, setVisibleIds] = usePersistentState<string[]>(settings, 'ui.qat.visible', defaults);
  const [showAutoSave, setShowAutoSave] = usePersistentState(settings, 'ui.qat.autosave', true);
  const [customize, setCustomize] = useState<HTMLElement | null>(null);
  const shown = quickAccess.filter((q) => visibleIds.includes(q.id));

  const menu: MenuItem[] = [
    { id: 'h', kind: 'header', label: S.titleBar.customizeHeader },
    ...(autoSave ? [{ id: 'autosave', label: S.titleBar.autoSave, checked: showAutoSave, onClick: () => setShowAutoSave(!showAutoSave) }] : []),
    ...quickAccess.map<MenuItem>((q) => ({
      id: q.id,
      label: q.label,
      checked: visibleIds.includes(q.id),
      onClick: () => setVisibleIds(visibleIds.includes(q.id) ? visibleIds.filter((v) => v !== q.id) : [...visibleIds, q.id]),
    })),
  ];

  return (
    <header className="fo-tb" data-tauri-drag-region onDoubleClick={(e) => {
      if (windowControls && e.target === e.currentTarget) windowControls.toggleMaximize();
    }}>
      <div className="fo-tb__left" data-tauri-drag-region>
        <AppBadge glyph={app.glyph} color={app.accent} size={22} label={app.name} />
        {autoSave && showAutoSave && (
          <Switch
            className="fo-tb__autosave"
            label={S.titleBar.autoSave}
            stateLabel={autoSave.enabled ? S.titleBar.autoSaveOn : S.titleBar.autoSaveOff}
            checked={autoSave.enabled}
            disabled={autoSave.disabled}
            onChange={autoSave.onChange}
          />
        )}
        <div className="fo-tb__qat" role="toolbar" aria-label={S.titleBar.customizeHeader}>
          {shown.map((q, i) => (
            <Tooltip key={q.id} content={{ title: q.label, shortcut: q.shortcut }}>
              <button type="button" className="fo-tb__qatbtn" aria-label={q.label} disabled={q.disabled} data-keytip-top={i < 9 ? String(i + 1) : undefined} onClick={q.onClick}>
                <Icon name={q.icon} size={20} />
              </button>
            </Tooltip>
          ))}
          {(quickAccess.length > 0 || autoSave) && (
            <Tooltip content={{ title: S.titleBar.customize }}>
              <button type="button" className="fo-tb__qatbtn fo-tb__qatmore" aria-label={S.titleBar.customize} aria-haspopup="menu" onClick={(e) => setCustomize(e.currentTarget)}>
                <Icon name="chevron_down" size={12} />
              </button>
            </Tooltip>
          )}
        </div>
        {documentName === undefined && <span className="fo-tb__appname" data-tauri-drag-region>{app.name}</span>}
      </div>
      <div className="fo-tb__center" data-tauri-drag-region>
        {documentName !== undefined && <DocumentName name={documentName} location={location} saveState={saveState} onRename={onRename} />}
        <CommandSearch commands={commands} placeholder={searchPlaceholder} />
      </div>
      <div className="fo-tb__right" data-tauri-drag-region>
        {end}
        {windowControls && <WindowButtons controls={windowControls} />}
      </div>
      {customize && <Menu items={menu} anchor={customize} onClose={() => setCustomize(null)} label={S.titleBar.customize} />}
    </header>
  );
}
