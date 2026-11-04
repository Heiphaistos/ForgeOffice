// Signets (marge + surlignage de ligne) et liens cliquables ([[note]], adresses web) de l'editeur.
import { RangeSet, StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, MatchDecorator, ViewPlugin, gutter, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { linkAt, type LinkTarget } from '../logic/links.ts';
import { S } from '../strings.ts';

// --- Signets ---

const toggleMark = StateEffect.define<number>({ map: (pos, mapping) => mapping.mapPos(pos) });
const clearMarks = StateEffect.define<null>();

class BookmarkMarker extends GutterMarker {
  override toDOM(): Node {
    const el = document.createElement('span');
    el.className = 'cm-bookmark-dot';
    return el;
  }
}
const marker = new BookmarkMarker();
const lineMark = Decoration.line({ class: 'cm-bookmarked' });

const bookmarks = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    let next = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(clearMarks)) next = RangeSet.empty;
      else if (e.is(toggleMark)) {
        let found = false;
        next.between(e.value, e.value, () => {
          found = true;
        });
        next = found ? next.update({ filter: (from) => from !== e.value }) : next.update({ add: [marker.range(e.value)] });
      }
    }
    return next;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (set) => {
      const ranges: Range<Decoration>[] = [];
      const iter = set.iter();
      while (iter.value) {
        ranges.push(lineMark.range(iter.from));
        iter.next();
      }
      return Decoration.set(ranges);
    }),
});

export const bookmarkExtension = [
  bookmarks,
  gutter({
    class: 'cm-bookmark-gutter',
    markers: (v) => v.state.field(bookmarks),
    initialSpacer: () => marker,
    domEventHandlers: {
      mousedown(view, line) {
        view.dispatch({ effects: toggleMark.of(line.from) });
        return true;
      },
    },
  }),
];

export function toggleBookmark(view: EditorView): void {
  const pos = view.state.doc.lineAt(view.state.selection.main.head).from;
  view.dispatch({ effects: toggleMark.of(pos) });
}

export function clearBookmarks(view: EditorView): void {
  view.dispatch({ effects: clearMarks.of(null) });
}

export function bookmarkLines(state: EditorState): number[] {
  const out: number[] = [];
  const iter = state.field(bookmarks, false)?.iter();
  while (iter?.value) {
    out.push(iter.from);
    iter.next();
  }
  return out;
}

/** Va au signet suivant (ou precedent), en boucle. */
export function stepBookmark(view: EditorView, forward: boolean): boolean {
  const list = bookmarkLines(view.state);
  if (list.length === 0) return false;
  const here = view.state.doc.lineAt(view.state.selection.main.head).from;
  const target = forward ? (list.find((p) => p > here) ?? list[0]) : ([...list].reverse().find((p) => p < here) ?? list[list.length - 1]);
  if (target === undefined) return false;
  view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
  return true;
}

// --- Liens ---

const linkMatcher = new MatchDecorator({
  regexp: /\[\[[^[\]\n]+?\]\]|(?:https?:\/\/|mailto:)[^\s<>"'()]+/g,
  decoration: (m) => Decoration.mark({ class: m[0].startsWith('[[') ? 'cm-wikilink' : 'cm-urllink', attributes: { title: S.linkHint } }),
});

const linkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = linkMatcher.createDeco(view);
    }
    update(u: ViewUpdate): void {
      this.decorations = linkMatcher.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Lien sous une position du document. */
export function linkAtPos(state: EditorState, pos: number): LinkTarget | null {
  const line = state.doc.lineAt(pos);
  return linkAt(line.text, pos - line.from);
}

/** Ctrl+clic sur un lien : `open` est appele, le clic n'ajoute pas de curseur. */
export function linkExtension(open: (link: LinkTarget) => void) {
  return [
    linkHighlighter,
    EditorView.domEventHandlers({
      mousedown(e, view) {
        if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return false;
        const target = e.target instanceof Element ? e.target.closest('.cm-wikilink, .cm-urllink') : null;
        if (!target) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        const link = pos === null ? null : linkAtPos(view.state, pos);
        if (!link) return false;
        e.preventDefault();
        open(link);
        return true;
      },
    }),
  ];
}
