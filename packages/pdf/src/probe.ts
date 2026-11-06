// Crochet de test (banc de conformite) : etat du document PDF (octets, elements en attente, champs) et selections preparees.
import type { ModuleProbe } from '@forgeoffice/core';
import type { FieldInfo } from './forms.ts';
import type { DocState } from './model.ts';

export interface PdfSources {
  state: DocState | null;
  name: string | null;
  pages: number;
  fields: FieldInfo[];
  current: number;
  selectedPages: ReadonlySet<number>;
  zoom: number;
  tool: string;
  twoPages: boolean;
  viewRotation: number;
  query: string;
  opts: Record<string, unknown>;
  fullscreen: boolean;
  setCurrent: (i: number) => void;
  setSelectedPages: (s: Set<number>) => void;
}

function hash(bytes: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ (bytes[i] ?? 0), 16777619) >>> 0;
  return `${bytes.length}:${h}`;
}

const plain = (v: unknown): unknown => {
  if (v instanceof Uint8Array) return `bytes(${v.length})`;
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

export function pdfProbe(get: () => PdfSources): ModuleProbe {
  return {
    presets: ['page', 'pages', 'derniere'],
    snapshot() {
      const s = get();
      return {
        name: s.name,
        bytes: s.state ? hash(s.state.bytes) : null,
        items: plain(s.state?.items ?? []),
        values: s.state?.values ?? {},
        log: s.state?.log ?? [],
        pages: s.pages,
        fields: s.fields,
        current: s.current,
        selectedPages: [...s.selectedPages].sort(),
        ui: { zoom: s.zoom, tool: s.tool, twoPages: s.twoPages, rotation: s.viewRotation, query: s.query, opts: s.opts, fullscreen: s.fullscreen },
      };
    },
    select(preset) {
      const s = get();
      if (preset === 'page') {
        s.setCurrent(0);
        s.setSelectedPages(new Set([0]));
        return true;
      }
      if (preset === 'pages') {
        s.setSelectedPages(new Set([0, 1]));
        return s.pages > 1;
      }
      if (preset === 'derniere') {
        s.setCurrent(s.pages - 1);
        s.setSelectedPages(new Set([s.pages - 1]));
        return true;
      }
      return false;
    },
  };
}
