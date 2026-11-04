// Pages de l'accueil : Accueil (Bonjour + Nouveau + Recents), Nouveau, Ouvrir, Options.
import { useMemo, useState, type ReactNode } from 'react';
import { MODULES, type AppId, type RecentFile, type Services } from '@forgeoffice/core';
import {
  AppBadge, Button, FileList, Icon, TextField, applyTheme, fold, usePersistentState, THEME_SETTING, isThemeChoice,
  type FileRow, type MenuItem, type ThemeChoice,
} from '@forgeoffice/ui';
import { BLANK_APPS, parentFolder, pinKey, visibleRecents } from './logic.ts';
import { TEMPLATES, type Template, type TemplatePreview } from './templates.ts';
import { S } from './strings.ts';

/** Actions partagees par les pages (fournies par <Hub>). */
export interface HubActions {
  newBlank: (app: AppId) => void;
  newFromTemplate: (t: Template) => void;
  browse: () => void;
  openRecent: (r: RecentFile) => void;
  togglePin: (r: RecentFile) => void;
  showPage: (page: 'new' | 'open') => void;
}

function Thumb({ app, preview }: { app: AppId; preview: TemplatePreview | 'blank' }) {
  const info = MODULES[app];
  let body: ReactNode = null;
  if (preview === 'grid') {
    body = <span className="hub-thumb__grid">{Array.from({ length: 24 }, (_, i) => <span key={i} />)}</span>;
  } else if (preview === 'list') {
    body = <span className="hub-thumb__lines is-list">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</span>;
  } else if (preview !== 'blank') {
    body = <span className={`hub-thumb__lines is-${preview}`}>{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</span>;
  } else if (app === 'powerpoint') {
    body = <span className="hub-thumb__slide"><span /><span /></span>;
  } else if (app === 'excel') {
    body = <span className="hub-thumb__grid is-blank">{Array.from({ length: 24 }, (_, i) => <span key={i} />)}</span>;
  } else if (app === 'access') {
    body = <span className="hub-thumb__table"><span /><span /><span /></span>;
  }
  return (
    <span className={`hub-thumb hub-thumb--${app}`} style={{ ['--hub-app' as string]: info.accent }}>
      {body}
      <span className="hub-thumb__badge"><AppBadge glyph={info.glyph} color={info.accent} size={20} /></span>
    </span>
  );
}

function Tile({ app, label, preview, onClick }: { app: AppId; label: string; preview: TemplatePreview | 'blank'; onClick: () => void }) {
  return (
    <button type="button" className="hub-tile" onClick={onClick} title={label}>
      <Thumb app={app} preview={preview} />
      <span className="hub-tile__label">{label}</span>
      <span className="hub-tile__app">{MODULES[app].name}</span>
    </button>
  );
}

function BlankTiles({ actions }: { actions: HubActions }) {
  return (
    <>
      {BLANK_APPS.map((app) => (
        <Tile key={app} app={app} label={MODULES[app].blankLabel} preview="blank" onClick={() => actions.newBlank(app)} />
      ))}
    </>
  );
}

function TemplateTiles({ actions, limit }: { actions: HubActions; limit?: number }) {
  return (
    <>
      {TEMPLATES.slice(0, limit).map((t) => (
        <Tile key={t.id} app={t.app} label={t.label} preview={t.preview} onClick={() => actions.newFromTemplate(t)} />
      ))}
    </>
  );
}

function Heading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="hub-heading">
      <h1>{children}</h1>
      {actions}
    </div>
  );
}

function RecentFiles({ recents, pins, actions, services, grouped }: { recents: readonly RecentFile[]; pins: readonly string[]; actions: HubActions; services: Services; grouped?: boolean }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'recent' | 'pinned'>('recent');
  const byDate = grouped === true && tab === 'recent' && !query;
  const shown = useMemo(() => visibleRecents(recents, pins, query, tab === 'pinned', fold, !byDate), [recents, pins, query, tab, byDate]);
  const byKey = new Map(shown.map((r) => [pinKey(r), r]));
  const rows: FileRow[] = shown.map((r) => {
    const info = MODULES[r.app];
    return {
      id: pinKey(r), name: r.name, location: parentFolder(r.path) ?? S.thisDevice, date: r.openedAt, pinned: pins.includes(pinKey(r)),
      icon: <AppBadge glyph={info.glyph} color={info.accent} size={24} label={info.name} />,
    };
  });
  const menuFor = (row: FileRow): MenuItem[] => {
    const r = byKey.get(row.id);
    if (!r) return [];
    const items: MenuItem[] = [
      { id: 'open', label: S.openRecent, icon: 'open', onClick: () => actions.openRecent(r) },
      { id: 'pin', label: row.pinned ? S.unpin : S.pin, icon: row.pinned ? 'pin_off' : 'pin', onClick: () => actions.togglePin(r) },
    ];
    if (parentFolder(r.path)) {
      items.push({
        id: 'copy', label: S.copyPath, icon: 'copy',
        onClick: () => void navigator.clipboard.writeText(r.path).then(() => services.notify(S.pathCopied, 'success'), () => services.notify(S.copyPath, 'error')),
      });
    }
    return items;
  };
  const empty = query ? S.noMatch : tab === 'pinned' ? S.noPinned : S.noRecent;
  return (
    <section className="hub-recent">
      <div className="hub-recent__bar">
        <div className="hub-tabs" role="tablist">
          {(['recent', 'pinned'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`hub-tabs__tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
              {t === 'recent' ? S.recent : S.pinned}
            </button>
          ))}
        </div>
        <div className="hub-recent__search">
          <TextField icon="search" placeholder={S.search} aria-label={S.searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
        </div>
      </div>
      <FileList
        rows={rows}
        grouped={byDate}
        emptyText={empty}
        onOpen={(row) => { const r = byKey.get(row.id); if (r) actions.openRecent(r); }}
        onTogglePin={(row) => { const r = byKey.get(row.id); if (r) actions.togglePin(r); }}
        menuFor={menuFor}
      />
    </section>
  );
}

interface PageProps {
  services: Services;
  actions: HubActions;
  recents: readonly RecentFile[];
  pins: readonly string[];
}

export function HomePage({ services, actions, recents, pins, greetingText }: PageProps & { greetingText: string }) {
  return (
    <>
      <Heading>{greetingText}</Heading>
      <section className="hub-section">
        <div className="hub-section__head">
          <h2>{S.newSection}</h2>
          <button type="button" className="hub-link" onClick={() => actions.showPage('new')}>
            {S.moreTemplates} <Icon name="arrow_right" size={16} />
          </button>
        </div>
        <div className="hub-tiles is-row">
          <BlankTiles actions={actions} />
          <TemplateTiles actions={actions} limit={2} />
        </div>
      </section>
      <RecentFiles recents={recents} pins={pins} actions={actions} services={services} />
    </>
  );
}

export function NewPage({ actions }: { actions: HubActions }) {
  return (
    <>
      <Heading>{S.new}</Heading>
      <section className="hub-section">
        <div className="hub-section__head"><h2>{S.blankDocuments}</h2></div>
        <div className="hub-tiles"><BlankTiles actions={actions} /></div>
      </section>
      <section className="hub-section">
        <div className="hub-section__head"><h2>{S.templates}</h2></div>
        <div className="hub-tiles"><TemplateTiles actions={actions} /></div>
      </section>
    </>
  );
}

export function OpenPage({ services, actions, recents, pins }: PageProps) {
  return (
    <>
      <Heading>{S.open}</Heading>
      <div className="hub-browse">
        <button type="button" className="hub-browse__btn" onClick={actions.browse}>
          <Icon name="folder_open" size={32} />
          <span>
            <strong>{S.browse}</strong>
            <span>{S.browseHint}</span>
          </span>
        </button>
      </div>
      <RecentFiles recents={recents} pins={pins} actions={actions} services={services} grouped />
    </>
  );
}

function Updates({ services }: { services: Services }) {
  const updater = services.updater;
  const [state, setState] = useState<{ kind: 'idle' | 'checking' | 'none' | 'error' | 'installError' } | { kind: 'available'; version: string } | { kind: 'installing'; progress: number }>({ kind: 'idle' });
  if (!updater) return null;
  const check = (): void => {
    setState({ kind: 'checking' });
    updater.check().then((info) => setState(info ? { kind: 'available', version: info.version } : { kind: 'none' }), () => setState({ kind: 'error' }));
  };
  const install = (): void => {
    setState({ kind: 'installing', progress: 0 });
    updater.install((progress) => setState({ kind: 'installing', progress })).catch(() => setState({ kind: 'installError' }));
  };
  return (
    <section className="hub-section">
      <div className="hub-section__head"><h2>{S.updates}</h2></div>
      <div className="hub-options__row">
        <Button icon="arrow_sync" onClick={check} disabled={state.kind === 'checking' || state.kind === 'installing'}>{S.checkUpdates}</Button>
        {state.kind === 'checking' && <span>{S.checking}</span>}
        {state.kind === 'none' && <span>{S.upToDate}</span>}
        {state.kind === 'error' && <span className="hub-error">{S.updateFailed}</span>}
        {state.kind === 'installError' && <span className="hub-error">{S.installFailed}</span>}
        {state.kind === 'available' && (
          <>
            <span>{S.updateAvailable(state.version)}</span>
            <Button appearance="primary" icon="arrow_download" onClick={install}>{S.installUpdate}</Button>
          </>
        )}
        {state.kind === 'installing' && <span>{Math.round(state.progress * 100)} %</span>}
      </div>
    </section>
  );
}

export function OptionsPage({ services, onClearRecent }: { services: Services; onClearRecent: () => void }) {
  const [theme, setTheme] = usePersistentState<ThemeChoice>(services.settings, THEME_SETTING, 'system');
  const choose = (t: ThemeChoice): void => {
    setTheme(t);
    applyTheme(t);
  };
  const current = isThemeChoice(theme) ? theme : 'system';
  return (
    <>
      <Heading>{S.options}</Heading>
      <section className="hub-section">
        <div className="hub-section__head"><h2>{S.theme}</h2></div>
        <div className="hub-options__themes" role="radiogroup" aria-label={S.theme}>
          {(['light', 'dark', 'contrast', 'system'] as const).map((t) => (
            <label key={t} className="hub-radio">
              <input type="radio" name="hub-theme" checked={current === t} onChange={() => choose(t)} />
              {S.themes[t]}
            </label>
          ))}
        </div>
      </section>
      <section className="hub-section">
        <div className="hub-section__head"><h2>{S.privacy}</h2></div>
        <Button icon="delete" onClick={onClearRecent}>{S.clearRecent}</Button>
      </section>
      <Updates services={services} />
      <section className="hub-section">
        <div className="hub-section__head"><h2>{S.about}</h2></div>
        <p className="hub-muted">{S.version(services.version)}</p>
        <p className="hub-muted">{S.localApp}</p>
      </section>
    </>
  );
}
