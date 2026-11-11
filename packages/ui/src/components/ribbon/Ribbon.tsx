// Ruban Office 2024 : onglets, groupes, reduction adaptative, ruban replie/simplifie, Info-touches, clavier.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { isAppId, type AppId, type Settings } from '@forgeoffice/core';
import { Icon } from '../../icons/Icon.tsx';
import type { GroupLevel, MenuItem, RibbonControl, RibbonGroup, RibbonLayout, RibbonTab } from '../../ribbon-types.ts';
import { S } from '../../strings.ts';
import { assignKeytips } from '../../logic/keytips.ts';
import { fitGroups } from '../../logic/fit.ts';
import { useElementWidth, usePersistentState } from '../../hooks.ts';
import { ribbonLayoutFor } from '../../logic/touch.ts';
import { useDeviceMode } from '../../touch.ts';
import { ribbonProbe } from '../../probe.ts';
import { LAYOUT_FAMILY, type LayoutId } from '../../logic/layouts.ts';
import { layoutMenuItem, useLayout } from '../../layoutHooks.ts';
import { Menu } from '../Menu.tsx';
import { MenuBarLayout } from '../layouts/MenuBarLayout.tsx';
import { OnlyOfficeDock } from '../layouts/OnlyOfficeDock.tsx';
import { Tooltip } from '../Tooltip.tsx';
import { CommandSheet } from '../CommandSheet.tsx';
import { MobileBand } from './MobileBand.tsx';
import { ribbonSchema } from '../../logic/mobileRibbon.ts';
import { RibbonGroupView } from './RibbonGroup.tsx';
import { KeytipLayer, type KeytipScope } from './KeytipLayer.tsx';
import type { ControlContext } from './RibbonControls.tsx';
import './Ribbon.css';
import '../layouts/layouts.css';

export interface RibbonProps {
  tabs: readonly RibbonTab[];
  /** Onglet actif (controle) ; sinon gere en interne. */
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Onglet « Fichier » : ouvre le Backstage. Absent = pas d'onglet Fichier. */
  onFile?: (page?: string) => void;
  fileLabel?: string;
  /** Zone a droite des onglets (Commentaires, Partager...). */
  end?: ReactNode;
  /** Reglages ou memoriser l'etat replie et la disposition. */
  settings?: Settings | null;
  label?: string;
}

const LEVELS: readonly GroupLevel[] = [0, 1, 2, 3];
/** Touches reservees au premier niveau : Fichier, recherche, barre d'acces rapide. */
const RESERVED_TOP = ['F', 'Q', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function controlSignature(c: RibbonControl): unknown {
  const base = [c.kind, c.id, c.hidden ?? false];
  switch (c.kind) {
    case 'separator':
      return base;
    case 'row':
      return [...base, c.controls.map(controlSignature)];
    case 'gallery':
      return [...base, c.label, c.items.length, c.itemWidth ?? 0];
    case 'combo':
    case 'font':
    case 'number':
      return [...base, c.label, c.width ?? 0];
    case 'button':
    case 'toggle':
    case 'menu':
    case 'split':
    case 'color':
      return [...base, c.label, c.size ?? '', c.iconOnly ?? false, c.icon ?? ''];
    default:
      return [...base, c.label];
  }
}

function tabSignature(tab: RibbonTab | undefined): string {
  if (!tab) return '';
  return JSON.stringify([tab.id, tab.groups.map((g) => [g.id, g.label, g.hidden ?? false, Boolean(g.launcher), g.controls.map(controlSignature)])]);
}

/** Entrees d'info-touches du panneau, dans l'ordre visuel. */
function panelKeytips(groups: readonly RibbonGroup[], levels: readonly GroupLevel[]): Map<string, string> {
  const entries: { id: string; label: string; keytip?: string }[] = [];
  const walk = (c: RibbonControl): void => {
    if (c.hidden || c.kind === 'separator') return;
    if (c.kind === 'row') {
      c.controls.forEach(walk);
      return;
    }
    entries.push({ id: c.id, label: c.label, keytip: c.keytip });
  };
  groups.forEach((g, i) => {
    if (g.hidden) return;
    if (levels[i] === 3) {
      entries.push({ id: `group:${g.id}`, label: g.label, keytip: g.keytip });
      return;
    }
    g.controls.forEach(walk);
    if (g.launcher) entries.push({ id: `launcher:${g.id}`, label: g.launcher.label });
  });
  const keys = assignKeytips(entries);
  return new Map(entries.map((e, i) => [e.id, keys[i] ?? '']));
}

/** Application affichee (posee sur <html> par la coquille) : sert au choix de disposition propre a un module. */
function currentApp(): AppId | null {
  const v = document.documentElement.dataset.app;
  return v && isAppId(v) ? v : null;
}

/** Ruban ou barre de menus selon la disposition choisie : toutes affichent les memes commandes (le meme schema d'onglets). */
export function Ribbon(props: RibbonProps) {
  const { layout, family } = useLayout(props.settings, currentApp());
  if (family === 'menubar') return <MenuBarLayout tabs={props.tabs} onFile={props.onFile} fileLabel={props.fileLabel} end={props.end} settings={props.settings} variant={layout} app={currentApp()} />;
  return <RibbonBody {...props} variant={layout} />;
}

function RibbonBody({ tabs, activeTab, onTabChange, onFile, fileLabel = S.ribbon.file, end, settings, label = S.ribbon.tabsLabel, variant }: RibbonProps & { variant: LayoutId }) {
  if (import.meta.env.DEV) ribbonProbe.tabs = tabs;
  const visibleTabs = useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  const [innerTab, setInnerTab] = useState(() => visibleTabs.find((t) => !t.contextual)?.id ?? visibleTabs[0]?.id ?? '');
  const current = visibleTabs.find((t) => t.id === (activeTab ?? innerTab)) ?? visibleTabs[0];
  const [collapsedPref, setCollapsed] = usePersistentState(settings, 'ui.ribbon.collapsed', false);
  // Familles « ruban » : Office 2024 et Tactile = ruban complet ; les autres = une seule ligne d'icones.
  const layoutPref: RibbonLayout = LAYOUT_FAMILY[variant] === 'ribbon' && (variant === 'office' || variant === 'touch') ? 'classic' : variant === 'dropdown' ? 'classic' : 'simplified';
  const device = useDeviceMode();
  // Telephone en paysage : peu de hauteur, le ruban reste replie (onglets seuls) et s'ouvre en flottant au toucher d'un onglet.
  const collapsed = collapsedPref || device.landscapePhone;
  // Telephone et tablette portrait : ruban simplifie impose ; tablette paysage et bureau : le choix de l'utilisateur (classique par defaut).
  const forcedSimplified = device.form !== 'desktop' && ribbonLayoutFor(device, window.innerWidth) === 'simplified';
  const layout: RibbonLayout = forcedSimplified ? 'simplified' : layoutPref;
  // Telephone et tablette portrait : bande complete (tous les groupes, toutes les commandes) ; sur tablette elle passe a la ligne au lieu de defiler.
  const band = forcedSimplified;
  const [allCommands, setAllCommands] = useState(false);
  const [flyout, setFlyout] = useState(false);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [keytipScope, setKeytipScope] = useState<KeytipScope | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const available = useElementWidth(trackEl);
  const [measured, setMeasured] = useState<Map<string, number[][]>>(() => new Map());

  const selectTab = useCallback(
    (id: string) => {
      setInnerTab(id);
      onTabChange?.(id);
    },
    [onTabChange],
  );

  // Un onglet contextuel qui disparait ramene sur le premier onglet.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === (activeTab ?? innerTab)) && visibleTabs[0]) selectTab(visibleTabs[0].id);
  }, [visibleTabs, activeTab, innerTab, selectTab]);

  // Bande d'onglets defilante (telephone) : l'onglet choisi reste visible.
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('.fo-ribbon__tab.is-selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current?.id, layout]);

  const signature = tabSignature(current);
  const widths = measured.get(signature);
  const levels = useMemo<GroupLevel[]>(() => {
    if (!current) return [];
    if (!widths || available === 0) return current.groups.map(() => 0);
    return fitGroups(widths, available - 4);
  }, [current, widths, available]);

  // Mesure de chaque groupe a chaque niveau (une fois par structure d'onglet).
  useLayoutEffect(() => {
    if (widths || layout !== 'classic' || !measureRef.current) return;
    const groups = [...measureRef.current.querySelectorAll<HTMLElement>('[data-measure-group]')];
    const table: number[][] = current?.groups.map(() => [0, 0, 0, 0]) ?? [];
    for (const el of groups) {
      const g = Number(el.dataset.measureGroup);
      const l = Number(el.dataset.measureLevel);
      const row = table[g];
      if (row) row[l] = el.offsetWidth;
    }
    setMeasured((m) => new Map(m).set(signature, table));
  }, [widths, layout, signature, current]);

  // Les polices chargees tard changent les largeurs : remesurer.
  useEffect(() => {
    void document.fonts?.ready.then(() => setMeasured(new Map()));
  }, []);

  const ctx = useMemo<ControlContext>(
    () => ({
      keytips: current ? panelKeytips(current.groups, layout === 'classic' ? levels : current.groups.map(() => 2)) : new Map(),
      onCommand: () => {
        if (collapsed) setFlyout(false);
      },
    }),
    [current, levels, layout, collapsed],
  );

  // Ctrl+F1 : replier/deplier ; Alt seul ou F10 : Info-touches.
  useEffect(() => {
    let altAlone = false;
    const onDown = (e: KeyboardEvent): void => {
      if (e.key === 'F1' && e.ctrlKey) {
        e.preventDefault();
        setCollapsed(!collapsed);
        setFlyout(false);
        return;
      }
      if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        setKeytipScope((s) => (s ? null : 'top'));
        return;
      }
      altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey;
    };
    const onUp = (e: KeyboardEvent): void => {
      if (e.key === 'Alt' && altAlone) {
        e.preventDefault();
        setKeytipScope((s) => (s ? null : 'top'));
      }
      altAlone = false;
    };
    const reset = (): void => {
      altAlone = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('pointerdown', reset);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('pointerdown', reset);
    };
  }, [collapsed, setCollapsed]);

  // Ruban flottant (replie) : se ferme sur clic exterieur.
  useEffect(() => {
    if (!flyout) return;
    const onPointer = (e: PointerEvent): void => {
      const t = e.target as Element | null;
      if (rootRef.current?.contains(t) || t?.closest('.fo-menu, .fo-popover')) return;
      setFlyout(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [flyout]);

  // Schema declaratif expose au banc de test (?e2e=1) : le test de couverture mobile compare la bande a ce schema, pas au DOM.
  useEffect(() => {
    if (!location.search.includes('e2e=1')) return;
    (window as unknown as { __FO_RIBBON__?: unknown }).__FO_RIBBON__ = { schema: () => ribbonSchema(tabs), active: () => current?.id ?? null };
  });

  const getPanel = useCallback(() => panelRef.current, []);
  const tabKeytips = useMemo(() => assignKeytips(visibleTabs.map((t) => ({ label: t.label, keytip: t.keytip })), RESERVED_TOP), [visibleTabs]);

  const onTabsKey = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const list = [...(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (collapsed) setFlyout(true);
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[data-ribbon-focus]:not(:disabled)')?.focus());
    }
  };

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.target instanceof HTMLInputElement) return;
    const list = [...(panelRef.current?.querySelectorAll<HTMLElement>('[data-ribbon-focus]:not(:disabled)') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  const displayItems: MenuItem[] = [
    layoutMenuItem(settings, variant, forcedSimplified),
    { id: 'sep', kind: 'separator' },
    { id: 'always', label: S.ribbon.alwaysShow, icon: 'pin', checked: !collapsed, onClick: () => { setCollapsed(false); setFlyout(false); } },
    { id: 'tabs', label: S.ribbon.tabsOnly, icon: 'tab', checked: collapsed, onClick: () => { setCollapsed(true); setFlyout(false); } },
  ];

  const showPanel = !collapsed || flyout;
  const contextualSets = [...new Set(visibleTabs.filter((t) => t.contextual).map((t) => t.contextual?.set ?? ''))];

  return (
    <div ref={rootRef} className={`fo-ribbon fo-ribbon--${layout} fo-ribbon--l-${variant}${band ? ` fo-ribbon--band fo-ribbon--band-${device.form}` : ''}${collapsed ? ' is-collapsed' : ''}${flyout ? ' is-flyout' : ''}`}>
      <div className="fo-ribbon__tabrow">
        {variant === 'dropdown' && !band && (
          <>
            {onFile && <button type="button" className="fo-ribbon__tab fo-ribbon__tab--file" onClick={() => onFile()}>{fileLabel}</button>}
            <select className="fo-ribbon__tabselect" aria-label={label} value={current?.id ?? ''} onChange={(e) => selectTab(e.target.value)}>
              {visibleTabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </>
        )}
        <div className={`fo-ribbon__tabs${variant === 'dropdown' && !band ? ' fo-visually-hidden' : ''}`} role="tablist" aria-label={label} onKeyDown={onTabsKey}>
          {onFile && (
            <button type="button" role="tab" aria-selected={false} className="fo-ribbon__tab fo-ribbon__tab--file fo-hc-invert" data-keytip-top="F" tabIndex={-1} onClick={() => onFile()}>
              {fileLabel}
            </button>
          )}
          {visibleTabs.map((tab, i) => {
            const selected = tab.id === current?.id && (showPanel || layout === 'simplified');
            const color = tab.contextual?.color;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`fo-tab-${tab.id}`}
                aria-selected={tab.id === current?.id}
                aria-controls="fo-ribbon-panel"
                tabIndex={tab.id === current?.id ? 0 : -1}
                title={tab.contextual ? `${S.ribbon.contextual} : ${tab.contextual.set}` : undefined}
                className={`fo-ribbon__tab fo-hc-invert${selected ? ' is-selected' : ''}${tab.contextual ? ' is-contextual' : ''}`}
                style={color ? { ['--fo-tab-color' as string]: color } : undefined}
                data-keytip-top={tabKeytips[i]}
                onClick={() => {
                  // Tactile : un appui sur un onglet d'un ruban replie le rouvre pour de bon (le replie force du telephone en paysage reste flottant).
                  if (collapsedPref && device.form !== 'desktop' && !device.landscapePhone) setCollapsed(false);
                  else if (collapsed) setFlyout(!(flyout && tab.id === current?.id));
                  selectTab(tab.id);
                }}
                onDoubleClick={() => {
                  setCollapsed(!collapsed);
                  setFlyout(false);
                }}
              >
                {tab.label}
              </button>
            );
          })}
          {contextualSets.length > 0 && <span className="fo-visually-hidden">{contextualSets.join(', ')}</span>}
        </div>
        {collapsedPref && device.form !== 'desktop' && !device.landscapePhone && (
          <button type="button" className="fo-ribbon__reopen" aria-label={S.ribbon.reopen} onClick={() => { setCollapsed(false); setFlyout(false); }}>
            <Icon name="chevron_down" size={20} />
          </button>
        )}
        {device.form !== 'desktop' && (
          <button type="button" className="fo-ribbon__allcmds" aria-label={S.sheet.allCommands} aria-haspopup="dialog" onClick={() => setAllCommands(true)}>
            <Icon name="search" size={22} />
          </button>
        )}
        {end && <div className="fo-ribbon__end">{end}</div>}
      </div>

      {showPanel && current && (
        <div ref={panelRef} id="fo-ribbon-panel" role="tabpanel" aria-labelledby={`fo-tab-${current.id}`} className="fo-ribbon__panel" onKeyDown={onPanelKey}>
          {band ? (
            <MobileBand tab={current} wrap={device.form === 'tablet'} onCommand={ctx.onCommand} />
          ) : (
            <div ref={setTrackEl} className="fo-ribbon__track fo-scroll">
              {current.groups.map((group, i) => (
                <RibbonGroupView key={group.id} group={group} level={levels[i] ?? 0} ctx={ctx} simplified={layout === 'simplified'} />
              ))}
            </div>
          )}
          <div className="fo-ribbon__corner">
            {!band && (
              <Tooltip content={{ title: S.ribbon.displayOptions }}>
                <button type="button" className="fo-ribbon__cornerbtn" aria-label={S.ribbon.displayOptions} aria-haspopup="menu" onClick={(e) => setOptionsAnchor(e.currentTarget)}>
                  <Icon name="chevron_down" size={16} />
                </button>
              </Tooltip>
            )}
            <Tooltip content={{ title: collapsed ? S.ribbon.expand : S.ribbon.collapse }}>
              <button
                type="button"
                className="fo-ribbon__cornerbtn"
                aria-label={collapsed ? S.ribbon.expand : S.ribbon.collapse}
                onClick={() => {
                  setCollapsed(!collapsed);
                  setFlyout(false);
                }}
              >
                <Icon name={collapsed ? 'pin' : 'chevron_up'} size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Mesure hors ecran des groupes a chaque niveau (reduction adaptative). */}
      {!widths && layout === 'classic' && current && (
        <div ref={measureRef} className="fo-ribbon__measure" aria-hidden inert>
          {current.groups.map((group, g) =>
            LEVELS.map((level) => (
              <div key={`${group.id}-${level}`} data-measure-group={g} data-measure-level={level} className="fo-ribbon__measure-item">
                <RibbonGroupView group={group} level={level} ctx={ctx} />
              </div>
            )),
          )}
        </div>
      )}

      {variant === 'onlyoffice' && !band && <OnlyOfficeDock variant="onlyoffice" tabs={visibleTabs} host={rootRef} settings={settings} />}

      {allCommands && <CommandSheet tabs={visibleTabs} onClose={() => setAllCommands(false)} />}
      {optionsAnchor && <Menu items={displayItems} anchor={optionsAnchor} placement="below" onClose={() => setOptionsAnchor(null)} label={S.ribbon.displayOptions} />}

      {keytipScope && (
        <KeytipLayer
          scope={keytipScope}
          getPanel={getPanel}
          onTopPicked={(el) => {
            el.click();
            if (collapsed) setFlyout(true);
            setKeytipScope('panel');
          }}
          onBack={() => setKeytipScope('top')}
          onExit={() => setKeytipScope(null)}
        />
      )}
      {flyout && <span className="fo-visually-hidden" aria-live="polite">{current?.label}</span>}
    </div>
  );
}
