// Application Base de donnees (equivalent Access 2024) : barre de titre, ruban, Backstage, volet de navigation,
// onglets d'objets, barre d'etat. Moteur : forge-base via la coquille native, ou base de demonstration en memoire.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULES, type ModuleProps, type OpenedFile, type RecentFile } from '@forgeoffice/core';
import { Backstage, DocumentTabs, Icon, Ribbon, StatusBar, TitleBar, collectCommands, type QuickAccessItem } from '@forgeoffice/ui';
import { api, life, nativeDb, type Db } from './db.ts';
import { demoDb } from './demo-db.ts';
import { applyTemplate, exportData, exportTo, importFile } from './exchange.ts';
import { TEMPLATES, type TemplateDef } from './logic/templates.ts';
import { uniqueName } from './logic/values.ts';
import { backstagePages } from './BackstagePages.tsx';
import { buildRibbon, VIEWS_BY_KIND, VIEW_ICON, VIEW_LABEL, type RibbonActions } from './ribbon.tsx';
import { S, errorText } from './strings.ts';
import type { BaseOuverte, EtapeMacro, InfosBase, Json, Maquette, ObjetBase } from './types.ts';
import { AskDialog, ImportDialog, type Ask, type ImportChoice } from './components/Dialogs.tsx';
import { KIND_ICON, NavPane, kindOf, type NavSelection, type ObjKind } from './components/NavPane.tsx';
import { NoNative } from './components/NoNative.tsx';
import { ObjectView } from './components/ObjectView.tsx';
import type { AppCtx, Tab, View, ViewApi } from './components/view-types.ts';
import './access.css';

const info = MODULES.access;
const DB_FILTERS = [{ name: S.ext.filterDb, extensions: ['fodb', 'sqlite', 'db'] }];
const DEFAULT_VIEW: Record<ObjKind, View> = { table: 'datasheet', requete: 'datasheet', formulaire: 'form', etat: 'preview', macro: 'design' };

function apiSignature(a: ViewApi | undefined): string {
  return JSON.stringify(a ?? null, (_k, v: unknown) => (typeof v === 'function' ? 1 : v));
}

function blankMaquette(source: string, report: boolean): Maquette {
  const keys = report ? ['entete_etat', 'entete_page', 'detail', 'pied_page', 'pied_etat'] : ['entete', 'detail', 'pied'];
  return { version: 1, source, titre: source, sections: Object.fromEntries(keys.map((k) => [k, { controles: [] }])) };
}

export function App({ services, file }: ModuleProps) {
  const native = services.native;
  const [demo, setDemo] = useState(false);
  const [db, setDb] = useState<Db | null>(null);
  const [dbName, setDbName] = useState('');
  const [infos, setInfos] = useState<InfosBase | null>(null);
  const [objects, setObjects] = useState<ObjetBase[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState('');
  const [navSel, setNavSel] = useState<NavSelection | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [backstage, setBackstage] = useState<string | null>(native ? 'home' : null);
  const [ribbonTab, setRibbonTab] = useState('home');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [importing, setImporting] = useState<{ kind: 'excel' | 'text'; file: OpenedFile } | null>(null);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [, setApiTick] = useState(0);
  const apis = useRef(new Map<string, ViewApi>());
  const registers = useRef(new Map<string, (a: ViewApi) => void>());
  const serial = useRef(0);
  const state = useRef({ db, objects, tabs, activeId, navSel });
  state.current = { db, objects, tabs, activeId, navSel };

  const notify = useCallback((m: string, kind: Parameters<typeof services.notify>[1] = 'info') => services.notify(m, kind), [services]);
  const fail = useCallback((err: unknown) => services.notify(errorText(err), 'error'), [services]);

  const refreshObjects = useCallback(async () => {
    const d = state.current.db;
    if (!d) return;
    try {
      setObjects(await api.objects(d));
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const openTab = useCallback((t: Omit<Tab, 'id'>) => {
    const id = `t${++serial.current}`;
    setTabs((ts) => [...ts, { ...t, id }]);
    setActiveId(id);
    setBackstage(null);
  }, []);

  const patchTab = useCallback((id: string, patch: Partial<Tab>) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);

  const confirm = useCallback((message: string, title = info.name) => new Promise<boolean>((resolve) => setAsk({ kind: 'confirm', title, message, resolve })), []);
  const prompt = useCallback((title: string, label: string, initial: string) => new Promise<string | null>((resolve) => setAsk({ kind: 'prompt', title, label, initial, resolve })), []);

  const closeTab = useCallback(async (id: string) => {
    const t = state.current.tabs.find((x) => x.id === id);
    if (t?.dirty && !(await confirm(S.dlg.closeUnsaved(t.name)))) return;
    apis.current.delete(id);
    registers.current.delete(id);
    setTabs((ts) => {
      const i = ts.findIndex((x) => x.id === id);
      const next = ts.filter((x) => x.id !== id);
      if (state.current.activeId === id) setActiveId(next[Math.min(i, next.length - 1)]?.id ?? '');
      return next;
    });
  }, [confirm]);

  const runMacro = useCallback(async (nom: string) => {
    const d = state.current.db;
    if (!d) return;
    try {
      playMacroRef.current(await d.call<EtapeMacro[]>('executer_macro', { nom }));
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const open = useCallback((kind: ObjKind, name: string, view?: View) => {
    if (kind === 'macro' && !view) {
      void runMacro(name);
      return;
    }
    const existing = state.current.tabs.find((t) => t.kind === kind && t.name === name);
    if (existing) {
      setActiveId(existing.id);
      if (view && view !== existing.view) patchTab(existing.id, { view });
      setBackstage(null);
      return;
    }
    openTab({ kind, name, view: view ?? DEFAULT_VIEW[kind] });
  }, [openTab, patchTab, runMacro]);

  const playMacroRef = useRef<(a: readonly EtapeMacro[]) => void>(() => undefined);
  playMacroRef.current = (actions) => {
    for (const a of actions) {
      const nom = a.arguments?.nom ?? '';
      switch (a.action) {
        case 'ouvrir_table': open('table', nom); break;
        case 'ouvrir_requete': case 'executer_requete': open('requete', nom); break;
        case 'ouvrir_formulaire': open('formulaire', nom); break;
        case 'ouvrir_etat': open('etat', nom); break;
        case 'zone_message': notify(a.arguments?.message ?? ''); break;
        case 'fermer_fenetre': void closeTab(state.current.activeId); break;
        case 'imprimer': services.print(); break;
        case 'actualiser': void refreshObjects(); break;
        default: notify(S.err.macroAction(S.macro.actions[a.action] ?? a.action), 'warning');
      }
    }
  };

  const ctx: AppCtx = useMemo(() => ({
    services,
    get objects() {
      return state.current.objects;
    },
    get selected() {
      return state.current.navSel;
    },
    notify,
    fail,
    refreshObjects,
    open,
    openTab,
    closeTab: (id: string) => void closeTab(id),
    patchTab,
    confirm,
    prompt,
    playMacro: (a: readonly EtapeMacro[]) => playMacroRef.current(a),
  }), [services, notify, fail, refreshObjects, open, openTab, closeTab, patchTab, confirm, prompt]);

  const registerFor = useCallback((id: string) => {
    let fn = registers.current.get(id);
    if (!fn) {
      fn = (a: ViewApi) => {
        const prev = apis.current.get(id);
        apis.current.set(id, a);
        if (apiSignature(prev) !== apiSignature(a)) setApiTick((t) => t + 1);
      };
      registers.current.set(id, fn);
    }
    return fn;
  }, []);

  // ------------------------------------------------------------------ Cycle de vie de la base
  const adopt = useCallback(async (d: Db, name: string, inf: InfosBase | null) => {
    apis.current.clear();
    registers.current.clear();
    setTabs([]);
    setActiveId('');
    setNavSel(null);
    setDb(d);
    state.current.db = d;
    setDbName(name.replace(/\.(fodb|sqlite|db)$/i, ''));
    setInfos(inf);
    setBackstage(null);
    setObjects(await api.objects(d));
  }, []);

  const adoptNative = useCallback(async (b: BaseOuverte) => {
    if (!native) return;
    await adopt(nativeDb(native, b.infos.lecture_seule), b.nom, b.infos);
    await services.addRecent({ app: 'access', name: b.nom, path: b.chemin }).catch(() => undefined);
    if (b.infos.lecture_seule) notify(S.readOnly, 'warning');
  }, [native, adopt, services, notify]);

  const openPath = useCallback(async (path: string) => {
    if (!native) return;
    try {
      await adoptNative(await life.open(native, path));
    } catch (err) {
      fail(err);
    }
  }, [native, adoptNative, fail]);

  useEffect(() => {
    if (!native) return;
    services.recentFiles().then((r) => setRecents(r.filter((x) => x.app === 'access')), () => undefined);
  }, [native, services, backstage]);

  useEffect(() => {
    if (!file || !native) return;
    if (file.path) void openPath(file.path);
    else notify(S.err.noPath, 'error');
  }, [file, native, openPath, notify]);

  useEffect(() => {
    services.setModified(tabs.some((t) => t.dirty));
  }, [tabs, services]);

  const create = useCallback(async (template: TemplateDef | null) => {
    if (!native) {
      notify(S.bs.nativeOnly, 'info');
      return;
    }
    try {
      const b = await life.create(native);
      if (!b) return;
      await adoptNative(b);
      const d = state.current.db;
      if (!d) return;
      if (template) {
        await applyTemplate(d, template);
        await refreshObjects();
        open('table', template.main);
      } else {
        await d.call('creer_table', { definition: { nom: 'Table1', champs: [{ nom: 'N°', type: 'numero_auto', cle_primaire: true }] } });
        await refreshObjects();
        open('table', 'Table1');
      }
    } catch (err) {
      fail(err);
    }
  }, [native, adoptNative, refreshObjects, open, fail, notify]);

  const closeDb = useCallback(async () => {
    if (native && !demo) await life.close(native).catch(fail);
    apis.current.clear();
    setTabs([]);
    setActiveId('');
    setDb(null);
    setObjects([]);
    setInfos(null);
    setDbName('');
    if (demo) setDemo(false);
    setBackstage(native ? 'home' : null);
  }, [native, demo, fail]);

  // ------------------------------------------------------------------ Commandes
  const active = tabs.find((t) => t.id === activeId) ?? null;
  const takenNames = (): string[] => state.current.objects.map((o) => o.nom).concat(state.current.tabs.map((t) => t.name));

  const sourceForNew = (): string | null => {
    const s = state.current.navSel;
    if (s && (s.kind === 'table' || s.kind === 'requete')) return s.name;
    const t = state.current.tabs.find((x) => x.id === state.current.activeId);
    return t && (t.kind === 'table' || t.kind === 'requete') ? t.name : null;
  };

  const exportTarget = (): { kind: 'table' | 'requete'; name: string } | null => {
    const t = state.current.tabs.find((x) => x.id === state.current.activeId);
    if (t && (t.kind === 'table' || t.kind === 'requete') && !t.isNew) return { kind: t.kind, name: t.name };
    const s = state.current.navSel;
    return s && (s.kind === 'table' || s.kind === 'requete') ? { kind: s.kind, name: s.name } : null;
  };

  const doExport = async (kind: 'excel' | 'text' | 'html', target = exportTarget()): Promise<void> => {
    if (!db || !target) {
      notify(S.ext.pickObject, 'warning');
      return;
    }
    try {
      if (await exportTo(services, await exportData(db, target.kind, target.name), kind)) notify(S.ext.exported(target.name), 'success');
    } catch (err) {
      fail(err);
    }
  };

  const doImport = async (c: ImportChoice): Promise<void> => {
    const job = importing;
    setImporting(null);
    if (!db || !job) return;
    try {
      const r = await importFile(db, job.file, job.kind, c);
      notify(S.ext.report(r.lignes_importees, r.table, r.nb_erreurs), r.nb_erreurs ? 'warning' : 'success');
      await refreshObjects();
      const existing = state.current.tabs.find((t) => t.kind === 'table' && t.name === r.table);
      if (existing) void closeTab(existing.id).then(() => open('table', r.table));
      else open('table', r.table);
    } catch (err) {
      fail(err);
    }
  };

  const instant = async (kind: 'formulaire' | 'etat', view: View, disposition = 'simple'): Promise<void> => {
    const source = sourceForNew();
    if (!db || !source) {
      notify(S.forms.pickSource, 'warning');
      return;
    }
    try {
      const seed = kind === 'formulaire'
        ? await db.call<Json>('formulaire_instantane', { source, disposition })
        : await db.call<Json>('etat_instantane', { source, regroupement: null });
      openTab({ kind, name: uniqueName(`${source}1`, takenNames()), view, isNew: true, seed, source });
    } catch (err) {
      fail(err);
    }
  };

  const actions: RibbonActions = {
    setView: (v) => active && patchTab(active.id, { view: v }),
    newTable: async () => {
      if (!db) return;
      const nom = uniqueName('Table1', takenNames());
      try {
        await db.call('creer_table', { definition: { nom, champs: [{ nom: 'N°', type: 'numero_auto', cle_primaire: true }] } });
        await refreshObjects();
        open('table', nom);
      } catch (err) {
        fail(err);
      }
    },
    newTableDesign: () => openTab({ kind: 'table', name: uniqueName('Table1', takenNames()), view: 'design', isNew: true }),
    newQuery: () => openTab({ kind: 'requete', name: uniqueName('Requête1', takenNames()), view: 'design', isNew: true }),
    instantForm: (disposition, view = 'layout') => void instant('formulaire', view, disposition),
    formDesign: () => openTab({ kind: 'formulaire', name: uniqueName(S.forms.newForm, takenNames()), view: 'design', isNew: true, seed: blankMaquette(sourceForNew() ?? '', false) as unknown as Json }),
    instantReport: (view = 'layout') => void instant('etat', view),
    reportDesign: () => openTab({ kind: 'etat', name: uniqueName(S.reports.newReport, takenNames()), view: 'design', isNew: true, seed: blankMaquette(sourceForNew() ?? '', true) as unknown as Json }),
    newMacro: () => openTab({ kind: 'macro', name: uniqueName(S.macro.newMacro, takenNames()), view: 'design', isNew: true, seed: { actions: [] } }),
    template: async (t) => {
      if (!db) return;
      try {
        await applyTemplate(db, t);
        await refreshObjects();
        open('table', t.main);
      } catch (err) {
        fail(err);
      }
    },
    importFile: async (kind) => {
      const f = await services.openFile(kind === 'excel' ? [{ name: S.ext.filterExcel, extensions: ['xlsx', 'xls', 'ods'] }] : [{ name: S.ext.filterText, extensions: ['csv', 'txt', 'tsv'] }]).catch((err: unknown) => {
        fail(err);
        return null;
      });
      if (f) setImporting({ kind, file: f });
    },
    exportAs: (kind) => void doExport(kind),
    relations: () => {
      const t = state.current.tabs.find((x) => x.kind === 'relations');
      if (t) setActiveId(t.id);
      else openTab({ kind: 'relations', name: S.views.relations, view: 'design' });
    },
    documenter: () => openTab({ kind: 'doc', name: S.views.doc, view: 'preview' }),
    analyze: () => openTab({ kind: 'analysis', name: S.views.analysis, view: 'preview' }),
    compact: async () => {
      if (!db) return;
      try {
        const r = await db.call<{ taille_avant: number; taille_apres: number }>('compacter');
        const ko = (n: number): string => `${Math.max(1, Math.round(n / 1024))} Ko`;
        notify(S.tools.compacted(ko(r.taille_avant), ko(r.taille_apres)), 'success');
        setInfos(await db.call<InfosBase>('infos'));
      } catch (err) {
        fail(err);
      }
    },
    integrity: async () => {
      if (!db) return;
      try {
        const r = await db.call<{ ok: boolean; problemes: string[]; orphelins: unknown[] }>('verifier_integrite');
        notify(r.ok ? S.tools.integrityOk : S.tools.integrityKo(r.problemes.length + r.orphelins.length), r.ok ? 'success' : 'warning');
      } catch (err) {
        fail(err);
      }
    },
    closeTab: () => active && void closeTab(active.id),
  };

  const currentApi = active ? apis.current.get(active.id) : undefined;
  const ribbon = buildRibbon({ tab: active, api: currentApi, hasDb: db !== null, readOnly: db?.readOnly ?? true, templates: TEMPLATES, actions });
  const commands = collectCommands(ribbon);

  // Onglet contextuel : il s'affiche des qu'un objet le demande (comme Access) ; retour a Accueil s'il disparait.
  const contextualId = ribbon.find((t) => t.contextual)?.id;
  const lastContext = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (contextualId !== lastContext.current) {
      if (contextualId && active && (active.view === 'design' || active.view === 'layout' || active.view === 'preview' || active.kind === 'relations')) setRibbonTab(contextualId);
      else if (!ribbon.some((t) => t.id === ribbonTab)) setRibbonTab('home');
      lastContext.current = contextualId;
    }
  }, [contextualId, ribbon, ribbonTab, active]);

  // Titre systeme (barre des taches) : nom de la base, comme les autres applications.
  useEffect(() => {
    if (db) services.setTitle(`${dbName} - ${info.name}`);
  }, [db, dbName, services]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const a = apis.current.get(state.current.activeId);
        (a?.save ?? a?.saveRecord)?.();
      } else if (e.key === 'F11') {
        e.preventDefault();
        setNavCollapsed((v) => !v);
      } else if (e.ctrlKey && e.key === 'F4' && state.current.activeId) {
        e.preventDefault();
        void closeTab(state.current.activeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeTab]);

  // ------------------------------------------------------------------ Volet : renommer, supprimer, copier
  const rename = async (s: NavSelection): Promise<void> => {
    if (!db) return;
    const nom = await prompt(S.dlg.rename, S.dlg.newName, s.name);
    if (!nom || nom === s.name) return;
    try {
      if (s.kind === 'table') await db.call('renommer_table', { ancien: s.name, nouveau: nom });
      else if (s.kind === 'requete') await db.call('renommer_requete', { ancien: s.name, nouveau: nom });
      else await db.call('renommer_objet', { genre: s.kind, ancien: s.name, nouveau: nom });
      setTabs((ts) => ts.map((t) => (t.kind === s.kind && t.name === s.name ? { ...t, name: nom } : t)));
      setNavSel({ kind: s.kind, name: nom });
      await refreshObjects();
    } catch (err) {
      fail(err);
    }
  };
  const remove = async (s: NavSelection): Promise<void> => {
    if (!db || !(await confirm(S.dlg.deleteConfirm(s.name)))) return;
    try {
      if (s.kind === 'table') await db.call('supprimer_table', { table: s.name, avec_relations: true });
      else if (s.kind === 'requete') await db.call('supprimer_requete', { nom: s.name });
      else await db.call('supprimer_objet', { genre: s.kind, nom: s.name });
      setTabs((ts) => ts.filter((t) => !(t.kind === s.kind && t.name === s.name)));
      setNavSel(null);
      notify(S.dlg.deleted(s.name), 'success');
      await refreshObjects();
    } catch (err) {
      fail(err);
    }
  };
  const copy = async (s: NavSelection): Promise<void> => {
    if (!db) return;
    const nom = await prompt(S.nav.copy, S.dlg.newName, uniqueName(S.dlg.copyOf(s.name).slice(0, 60), takenNames()));
    if (!nom) return;
    try {
      if (s.kind === 'table') await db.call('copier_table', { source: s.name, destination: nom, avec_donnees: true });
      else if (s.kind === 'requete') {
        const q = await api.query(db, s.name);
        await db.call('enregistrer_requete', { requete: { ...q, nom } });
      } else {
        const o = await db.call<{ contenu: Json }>('lire_objet', { genre: s.kind, nom: s.name });
        await db.call('enregistrer_objet', { genre: s.kind, nom, contenu: o.contenu, description: null });
      }
      await refreshObjects();
    } catch (err) {
      fail(err);
    }
  };

  // ------------------------------------------------------------------ Rendu
  if (!native && !demo) {
    return <NoNative services={services} onDemo={() => { setDemo(true); void adopt(demoDb(), S.demoName, null); }} />;
  }

  const pages = backstagePages({
    native: native !== null,
    hasDb: db !== null,
    dbName,
    infos,
    recents,
    newBlank: () => void create(null),
    template: (t) => void create(t),
    browse: async () => {
      const f = await services.openFile(DB_FILTERS).catch((err: unknown) => {
        fail(err);
        return null;
      });
      if (f?.path) await openPath(f.path);
      else if (f) notify(S.err.noPath, 'error');
    },
    openRecent: (r) => void openPath(r.path),
    saveAs: async () => {
      if (!native) return;
      const b = await life.copy(native, true, `${dbName}.fodb`).catch((err: unknown) => {
        fail(err);
        return null;
      });
      if (b) await adoptNative(b);
    },
    backup: async () => {
      if (!native) return;
      const b = await life.copy(native, false, `${dbName}_${new Date().toISOString().slice(0, 10)}.fodb`).catch((err: unknown) => {
        fail(err);
        return null;
      });
      if (b) {
        notify(`${S.bs.backup} : ${b.chemin}`, 'success');
        setBackstage(null);
      }
    },
    compact: () => void actions.compact(),
    integrity: () => void actions.integrity(),
    print: () => {
      setBackstage(null);
      window.setTimeout(() => services.print(), 50);
    },
    closeDb: () => void closeDb(),
  });

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.cmd.save, icon: 'save', shortcut: 'Ctrl+S', disabled: !(currentApi?.save ?? currentApi?.saveRecord), onClick: () => (currentApi?.save ?? currentApi?.saveRecord)?.() },
    { id: 'print', label: S.cmd.print, icon: 'print', defaultVisible: false, onClick: () => services.print() },
  ];
  const views = active ? (VIEWS_BY_KIND[active.kind] ?? []) : [];
  const statusLeft = [{ id: 'mode', label: active ? (VIEW_LABEL[active.view] ?? '') : S.status.ready }];
  if (demo) statusLeft.push({ id: 'demo', label: S.status.demo });
  else if (db?.readOnly) statusLeft.push({ id: 'ro', label: S.status.readOnly });

  return (
    <div className="acc" data-app="access">
      <TitleBar
        app={info}
        documentName={db ? `${dbName} : ${info.name}` : undefined}
        location={infos?.chemin ?? null}
        saveState={tabs.some((t) => t.dirty) ? 'modified' : db ? 'saved' : null}
        quickAccess={quickAccess}
        commands={commands}
        windowControls={services.windowControls}
        settings={services.settings}
      />
      <Ribbon tabs={ribbon} activeTab={ribbonTab} onTabChange={setRibbonTab} onFile={() => setBackstage('home')} settings={services.settings} />
      {demo && (
        <div className="acc-msgbar" role="status">
          <Icon name="info" size={16} />
          <strong>{S.demoBar}</strong>
          <span>{S.demoBarText}</span>
        </div>
      )}
      <div className="acc-body">
        {db && (
          <NavPane
            objects={objects}
            selected={navSel}
            collapsed={navCollapsed}
            readOnly={db.readOnly}
            onToggle={() => setNavCollapsed((v) => !v)}
            onSelect={setNavSel}
            onOpen={(s, v) => open(s.kind, s.name, v)}
            onRename={(s) => void rename(s)}
            onDelete={(s) => void remove(s)}
            onCopy={(s) => void copy(s)}
            onExport={(s) => (s.kind === 'table' || s.kind === 'requete') && void doExport('excel', { kind: s.kind, name: s.name })}
          />
        )}
        <main className="acc-main">
          {db && tabs.length > 0 ? (
            <>
              <DocumentTabs
                tabs={tabs.map((t) => ({ id: t.id, label: t.name, modified: t.dirty, icon: t.kind in KIND_ICON ? KIND_ICON[t.kind as ObjKind] : t.kind === 'relations' ? 'database_link' : 'document_search' }))}
                activeId={activeId}
                onSelect={setActiveId}
                onClose={(id) => void closeTab(id)}
              />
              {tabs.map((t) => (
                <section key={t.id} className="acc-view" hidden={t.id !== activeId}>
                  <ObjectView db={db} tab={t} ctx={ctx} register={registerFor(t.id)} />
                </section>
              ))}
            </>
          ) : (
            <div className="acc-workspace">
              {!db && (
                <div className="acc-nodb">
                  <Icon name="database" size={48} color={info.accent} />
                  <h2>{S.noDb}</h2>
                  <p>{S.noDbHint}</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <StatusBar
        left={statusLeft}
        right={[{ id: 'num', label: S.status.numLock }]}
        views={views.map((v) => ({ id: v, label: VIEW_LABEL[v], icon: VIEW_ICON[v] }))}
        activeView={active?.view}
        onViewChange={(v) => active && patchTab(active.id, { view: v as View })}
      />
      <Backstage open={backstage !== null} appName={info.name} pages={pages} activePage={backstage ?? 'home'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <AskDialog ask={ask} onDone={() => setAsk(null)} />
      {importing && (
        <ImportDialog
          kind={importing.kind === 'excel' ? S.cmd.importExcel : S.cmd.importText}
          fileName={importing.file.name}
          tables={objects.filter((o) => kindOf(o) === 'table' && o.genre === 'table').map((o) => o.nom)}
          onImport={(c) => void doImport(c)}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  );
}
