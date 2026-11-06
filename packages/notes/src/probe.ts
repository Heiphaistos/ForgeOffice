// Crochet de test (banc de conformite) : onglets, textes, selection et reglages. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import type { Workspace } from './workspace.ts';

export function notesProbe(ws: Workspace, prefs: () => unknown): ModuleProbe {
  return {
    presets: ['mot', 'ligne', 'tout', 'curseur'],
    snapshot() {
      const v = ws.view;
      const sel = v?.state.selection;
      return {
        tabs: ws.tabs.map((t) => ({ ...t, text: ws.text(t.id) })),
        active: ws.tabs.findIndex((t) => t.id === ws.activeId),
        selection: sel ? { ranges: sel.ranges.map((r) => [r.from, r.to]), main: sel.main.head, text: v.state.sliceDoc(sel.main.from, sel.main.to) } : null,
        folder: ws.folder?.name ?? null,
        ui: { prefs: prefs() },
      };
    },
    select(preset) {
      const v = ws.view;
      if (!v) return false;
      const doc = v.state.doc;
      const line = doc.line(Math.min(3, doc.lines));
      const sel =
        preset === 'tout' ? { anchor: 0, head: doc.length }
          : preset === 'ligne' ? { anchor: line.from, head: line.to }
            : preset === 'mot' ? { anchor: line.from, head: Math.min(line.to, line.from + 5) }
              : preset === 'curseur' ? { anchor: line.from + 2 } : null;
      if (!sel) return false;
      v.dispatch({ selection: sel });
      v.focus();
      return true;
    },
  };
}
