// Crochet de test (banc de conformite) : file d'attente du Convertisseur et reglages. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import type { ConvertOptions } from './engines.ts';
import type { Job } from './queue.ts';

export interface ConvertSources {
  jobs: readonly Job[];
  options: ConvertOptions;
  allTarget: string;
  folder: string | null;
  running: boolean;
  tool: string | null;
  historyOpen: boolean;
  historyCount: number;
  convertAll: () => Promise<void>;
}

export function convertProbe(get: () => ConvertSources): ModuleProbe {
  return {
    presets: ['fichiers', 'termine'],
    snapshot() {
      const s = get();
      return {
        jobs: s.jobs.map((j) => ({
          name: j.name, ext: j.ext, size: j.size, target: j.target, status: j.status, error: j.error,
          outputs: j.outputs.map((o) => [o.name, o.bytes.length]),
        })),
        ui: { options: s.options, allTarget: s.allTarget, folder: s.folder, running: s.running, tool: s.tool, historyOpen: s.historyOpen, historyCount: s.historyCount },
      };
    },
    async select(preset) {
      if (preset === 'fichiers') return get().jobs.length > 0;
      if (preset === 'termine') {
        await get().convertAll();
        await new Promise((r) => setTimeout(r, 300));
        return get().jobs.some((j) => j.status === 'done');
      }
      return false;
    },
  };
}
