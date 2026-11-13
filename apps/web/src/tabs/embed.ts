// Services d'un cadre d'onglet isole (iframe) : ceux de la page hote, avec les octets recopies d'un contexte JavaScript a l'autre.
// Un tampon cree dans le cadre n'est pas `instanceof Uint8Array` pour la page hote (et inversement) : sans copie, la coquille
// native ne reconnaitrait pas le binaire et le serialiserait en JSON (des millions d'entrees pour un gros fichier).
import type { OpenedFile, Services } from '@forgeoffice/core';

/** Un fichier venu d'un autre cadre est recopie dans le contexte courant (`instanceof Uint8Array` y serait faux sinon). */
export function localFile(file: OpenedFile | null): OpenedFile | null {
  return file ? { ...file, bytes: new Uint8Array(file.bytes) } : null;
}

const tag = (value: unknown): string => Object.prototype.toString.call(value);

/** Tampon binaire (de n'importe quel contexte) ? */
export function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return tag(value) === '[object ArrayBuffer]' || ArrayBuffer.isView(value);
}

/** Copie un tampon binaire dans le contexte donne ; autres valeurs inchangees. */
export function recopy(value: unknown, make: (bytes: Uint8Array) => Uint8Array): unknown {
  if (tag(value) === '[object ArrayBuffer]') return make(new Uint8Array(value as ArrayBuffer)).buffer;
  if (ArrayBuffer.isView(value)) return make(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return value;
}

/** Services d'un cadre enfant : ceux de l'hote, avec les octets recopies dans les deux sens. */
export function embedServices(host: Services, hostBytes: (b: Uint8Array) => Uint8Array): Services {
  const native = host.native;
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
    // Moteurs natifs (PDF, conversions, bases) : arguments binaires vers l'hote, reponses binaires vers le cadre.
    native: native
      ? {
          async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
            const sent = isBinary(args) ? (recopy(args, hostBytes) as never) : args;
            return recopy(await native.invoke<T>(command, sent), (b) => new Uint8Array(b)) as T;
          },
        }
      : null,
  };
}
