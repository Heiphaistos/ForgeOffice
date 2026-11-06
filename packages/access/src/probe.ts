// Crochet de test (banc de conformite) : objets, onglets ouverts et selection du volet. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import type { Tab } from './components/view-types.ts';
import type { InfosBase, ObjetBase } from './types.ts';

export interface AccessSources {
  dbName: string;
  infos: InfosBase | null;
  objects: readonly ObjetBase[];
  tabs: readonly Tab[];
  activeId: string;
  navSel: unknown;
  openFirst: (kind: string) => void;
  view: () => unknown;
}

export function accessProbe(get: () => AccessSources): ModuleProbe {
  return {
    presets: ['table', 'requete', 'formulaire', 'etat'],
    snapshot() {
      const s = get();
      return {
        dbName: s.dbName,
        infos: s.infos,
        objects: s.objects.map((o) => [o.genre, o.nom, o.description]),
        tabs: s.tabs.map((t) => [t.id, t.kind, t.name, t.view, t.isNew ?? false, t.dirty ?? false]),
        active: s.activeId,
        navSel: s.navSel,
        view: s.view(),
      };
    },
    select(preset) {
      get().openFirst(preset);
      return true;
    },
  };
}
