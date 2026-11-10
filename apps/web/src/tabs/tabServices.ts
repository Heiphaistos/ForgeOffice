// Decorateurs de `Services` pour les onglets : aucune plateforme n'est modifiee, on enveloppe celle qui existe.
import { moduleForFile, type AppId, type OpenedFile, type Services } from '@forgeoffice/core';
import { savedOpenMode } from '@forgeoffice/ui';

export type OpenTab = (app: AppId, file: OpenedFile | null) => void;

/** « Nouveau » / « Ouvrir » : en mode onglet, le document s'ouvre dans un onglet au lieu d'une fenetre ou de la page courante. */
export function withTabRouting(services: Services, openTab: OpenTab): Services {
  const tabbed = (): boolean => savedOpenMode(services.settings) !== 'window';
  return {
    ...services,
    async openModule(app, path) {
      if (!tabbed()) return services.openModule(app, path);
      openTab(app, path ? await services.readFile(path) : null);
    },
    async openDocument(file) {
      if (!tabbed()) return services.openDocument(file);
      const app = moduleForFile(file.name);
      if (!app) return services.openDocument(file); // la plateforme sait dire pourquoi le format est refuse
      openTab(app, file);
    },
  };
}

export interface TabHooks {
  onTitle(title: string): void;
  onModified(modified: boolean): void;
  onClose(): void;
}

/** Services d'un onglet : titre, indicateur « modifie » et fermeture vont a l'onglet, pas a la fenetre. */
export function forTab(services: Services, hooks: TabHooks, openTab: OpenTab): Services {
  return {
    ...withTabRouting(services, openTab),
    windowControls: null,
    setTitle: hooks.onTitle,
    setModified: hooks.onModified,
    close: hooks.onClose,
  };
}

/** Un fichier venu d'un autre cadre est recopie dans le contexte courant (`instanceof Uint8Array` y serait faux sinon). */
export function localFile(file: OpenedFile | null): OpenedFile | null {
  return file ? { ...file, bytes: new Uint8Array(file.bytes) } : null;
}

/** Services d'un cadre enfant : ceux de l'hote, avec les octets recopies dans les deux sens. */
export function embedServices(host: Services, hostBytes: (b: Uint8Array) => Uint8Array): Services {
  return {
    ...host,
    async openFile(filters) {
      return localFile(await host.openFile(filters));
    },
    async readFile(path) {
      return localFile(await host.readFile(path)) as OpenedFile;
    },
    saveFile(bytes, name, filters, path) {
      return host.saveFile(hostBytes(bytes), name, filters, path);
    },
    openDocument(file) {
      return host.openDocument({ ...file, bytes: hostBytes(file.bytes) });
    },
  };
}
