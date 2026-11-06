// Crochet de test (banc de conformite) : lecture du modele du document et selections preparees. Appele seulement en developpement.
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import type { EditorView } from 'prosemirror-view';
import type { ModuleProbe } from '@forgeoffice/core';
import type { WordDocument } from '@forgeoffice/docx';
import { documentFromPM } from '../editor/convert.ts';
import type { UiState } from './types.ts';

interface Sources {
  view: () => EditorView | null;
  meta: () => WordDocument;
  ui: () => UiState;
  setUi: (patch: Partial<UiState>) => void;
}

type Loose = { type?: string; text?: string; props?: unknown; styleId?: string; revision?: unknown; inlines?: Loose[]; blocks?: Loose[]; rows?: { cells: Loose[] }[]; [k: string]: unknown };

/** Fusionne les segments de texte voisins de meme format : deux decoupages equivalents donnent le meme snapshot. */
function mergeRuns(blocks: Loose[]): Loose[] {
  return blocks.map((b) => {
    const out: Loose = { ...b };
    if (b.inlines) {
      const merged: Loose[] = [];
      for (const raw of b.inlines) {
        // « gras: faux » explicite equivaut a l'absence de la propriete pour la comparaison.
        const i: Loose = raw.props && typeof raw.props === 'object' ? { ...raw, props: Object.fromEntries(Object.entries(raw.props).filter(([, v]) => v !== false)) } : raw;
        const prev = merged[merged.length - 1];
        if (prev && prev.type === 'text' && i.type === 'text' && !prev.revision && !i.revision && JSON.stringify([prev.props, prev.styleId]) === JSON.stringify([i.props, i.styleId])) merged[merged.length - 1] = { ...prev, text: `${prev.text}${i.text}` };
        else merged.push(i);
      }
      out.inlines = merged;
    }
    if (b.blocks) out.blocks = mergeRuns(b.blocks);
    if (b.rows) out.rows = b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: mergeRuns(c.blocks ?? []) })) }));
    return out;
  });
}

/** Modele du document sans octets de medias ni horodatages (comparable avant/apres). */
export function wordSnapshot(view: EditorView, meta: WordDocument, ui: UiState): unknown {
  const doc = documentFromPM(view.state.doc, meta);
  const { media, styles, theme: _theme, fonts: _fonts, properties, ...rest } = doc;
  const { modified: _m, lastModifiedBy: _l, ...props } = properties;
  const sel = view.state.selection;
  return {
    ...rest,
    body: mergeRuns(rest.body as unknown as Loose[]),
    properties: props,
    media: Object.fromEntries(Object.entries(media).map(([k, v]) => [k, v.bytes.length])),
    styles: styles.styles.map((s) => s.id),
    text: view.state.doc.textBetween(0, view.state.doc.content.size, '\n', ' '),
    selection: { from: sel.from, to: sel.to, kind: sel.constructor.name, text: view.state.doc.textBetween(sel.from, sel.to, ' ') },
    ui: { view: ui.view, zoom: ui.zoom },
  };
}

const PRESETS = ['plan', 'cellules', 'suivi', 'texte', 'mot', 'paragraphe', 'tout', 'tableau', 'cellule', 'image', 'liste', 'titre'] as const;

function findFirst(view: EditorView, test: (node: import('prosemirror-model').Node, pos: number) => boolean): { node: import('prosemirror-model').Node; pos: number } | null {
  let found: { node: import('prosemirror-model').Node; pos: number } | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (test(node, pos)) found = { node, pos };
    return !found;
  });
  return found;
}

export function wordProbe(src: Sources): ModuleProbe {
  return {
    presets: PRESETS,
    snapshot: () => {
      const view = src.view();
      return view ? wordSnapshot(view, src.meta(), src.ui()) : null;
    },
    select(preset) {
      const view = src.view();
      if (!view) return false;
      const tr = view.state.tr;
      const set = (sel: import('prosemirror-state').Selection): boolean => {
        view.dispatch(tr.setSelection(sel));
        view.focus();
        return true;
      };
      const plain = (node: import('prosemirror-model').Node, pos: number): boolean =>
        node.type.name === 'paragraph' && node.textContent.length > 25 && !node.attrs.styleId?.toString().startsWith('Heading') && view.state.doc.resolve(pos).depth === 0;
      switch (preset) {
        case 'plan':
          src.setUi({ view: 'outline' });
          return true;
        case 'tout':
          return set(TextSelection.create(view.state.doc, 1, view.state.doc.content.size - 1));
        case 'texte':
        case 'mot':
        case 'paragraphe': {
          const p = findFirst(view, plain);
          if (!p) return false;
          const start = p.pos + 1;
          if (preset === 'texte') return set(TextSelection.create(view.state.doc, start, start + Math.min(20, p.node.textContent.length)));
          if (preset === 'mot') return set(TextSelection.create(view.state.doc, start, start + (p.node.textContent.indexOf(' ') > 0 ? p.node.textContent.indexOf(' ') : 5)));
          return set(TextSelection.create(view.state.doc, start + 2));
        }
        case 'titre': {
          const h = findFirst(view, (n) => n.type.name === 'paragraph' && String(n.attrs.styleId ?? '').startsWith('Heading'));
          return h ? set(TextSelection.create(view.state.doc, h.pos + 1, h.pos + 1 + h.node.textContent.length)) : false;
        }
        case 'liste': {
          const l = findFirst(view, (n) => n.type.name === 'paragraph' && Boolean((n.attrs.props as { numbering?: unknown } | undefined)?.numbering));
          return l ? set(TextSelection.create(view.state.doc, l.pos + 1, l.pos + 1 + l.node.textContent.length)) : false;
        }
        case 'suivi': {
          const t = findFirst(view, (n) => n.type.name === 'paragraph' && n.textContent.startsWith('Texte suivi'));
          return t ? set(TextSelection.create(view.state.doc, t.pos + 1, t.pos + 1 + t.node.textContent.length)) : false;
        }
        case 'cellules': {
          const cells: number[] = [];
          let rowIndex = 0;
          view.state.doc.descendants((n, pos) => {
            if (n.type.name === 'table_row') {
              rowIndex++;
              if (rowIndex === 2) {
                n.forEach((_c, off) => cells.push(pos + 1 + off));
                return false;
              }
            }
            return true;
          });
          if (cells.length < 2) return false;
          return set(new CellSelection(view.state.doc.resolve(cells[0] ?? 0), view.state.doc.resolve(cells[1] ?? 0)));
        }
        case 'tableau':
        case 'cellule': {
          const c = findFirst(view, (n) => n.type.name === 'table_cell' || n.type.name === 'table_header');
          if (!c) return false;
          return preset === 'cellule' ? set(new CellSelection(view.state.doc.resolve(c.pos))) : set(TextSelection.create(view.state.doc, c.pos + 2));
        }
        case 'image': {
          const i = findFirst(view, (n) => n.type.name === 'atom' && (n.attrs.data as { type?: string } | undefined)?.type === 'image');
          return i ? set(NodeSelection.create(view.state.doc, i.pos)) : false;
        }
        default:
          return false;
      }
    },
  };
}
