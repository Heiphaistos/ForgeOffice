// Aides visuelles reglables : guides d'indentation, fins de ligne visibles, historique des modifications (marge).
import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, ViewPlugin, WidgetType, gutter, type DecorationSet } from '@codemirror/view';
import { indentWidth } from '../logic/columns.ts';
import type { Eol } from '../logic/encoding.ts';
import { S } from '../strings.ts';

// --- Guides d'indentation : un fond a traits tous les `tabSize` colonnes sur la largeur du retrait de chaque ligne ---

function guideDecorations(view: EditorView, tabSize: number): DecorationSet {
  const out = [];
  const seen = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      pos = line.to + 1;
      if (seen.has(line.from)) continue;
      seen.add(line.from);
      const width = indentWidth(line.text, tabSize);
      if (width >= tabSize && line.text.trim() !== '') {
        out.push(Decoration.line({ class: 'nt-guided', attributes: { style: `--nt-ind:${width};--nt-step:${tabSize}` } }).range(line.from));
      }
    }
  }
  return Decoration.set(out);
}

export const indentGuides = (tabSize: number): Extension =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = guideDecorations(view, tabSize);
      }
      update(u: { docChanged: boolean; viewportChanged: boolean; view: EditorView }): void {
        if (u.docChanged || u.viewportChanged) this.decorations = guideDecorations(u.view, tabSize);
      }
    },
    { decorations: (v) => v.decorations },
  );

// --- Fins de ligne visibles (CR LF comme dans WinNote) ---

const EOL_MARK: Readonly<Record<Eol, string>> = { crlf: 'CRLF', lf: 'LF', cr: 'CR' };

class EolWidget extends WidgetType {
  readonly text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  override eq(other: EolWidget): boolean {
    return other.text === this.text;
  }
  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'nt-eol';
    el.textContent = this.text;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

export const eolMarks = (eol: Eol): Extension => {
  const widget = Decoration.widget({ widget: new EolWidget(EOL_MARK[eol]), side: 1 });
  const build = (view: EditorView): DecorationSet => {
    const out = [];
    const last = view.state.doc.length;
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        pos = line.to + 1;
        if (line.to < last) out.push(widget.range(line.to));
      }
    }
    return Decoration.set(out, true);
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: { docChanged: boolean; viewportChanged: boolean; view: EditorView }): void {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
};

// --- Historique des modifications : barre orange = non enregistre, verte = enregistre depuis l'ouverture ---

const markSaved = StateEffect.define<null>();
const clearChanges = StateEffect.define<null>();

class ChangeMarker extends GutterMarker {
  readonly saved: boolean;
  constructor(saved: boolean) {
    super();
    this.saved = saved;
  }
  override eq(other: ChangeMarker): boolean {
    return other.saved === this.saved;
  }
  override toDOM(): Node {
    const el = document.createElement('span');
    el.className = `nt-change nt-change--${this.saved ? 'saved' : 'unsaved'}`;
    el.title = this.saved ? S.history.saved : S.history.unsaved;
    return el;
  }
}
const unsaved = new ChangeMarker(false);
const saved = new ChangeMarker(true);

export const changeField = StateField.define<RangeSet<ChangeMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    const cleared = tr.effects.some((e) => e.is(clearChanges));
    if (cleared) return RangeSet.empty;
    const marks = new Map<number, boolean>(); // position de debut de ligne -> enregistre ?
    set.map(tr.changes).between(0, tr.newDoc.length, (from, _to, value) => {
      marks.set(from, (marks.get(from) ?? true) && value.saved);
    });
    if (tr.effects.some((e) => e.is(markSaved))) for (const pos of marks.keys()) marks.set(pos, true);
    if (tr.docChanged) {
      tr.changes.iterChangedRanges((_fa, _ta, fromB, toB) => {
        for (let n = tr.newDoc.lineAt(fromB).number; n <= tr.newDoc.lineAt(toB).number; n++) marks.set(tr.newDoc.line(n).from, false);
      });
    }
    if (marks.size === 0 && set.size === 0) return set;
    return RangeSet.of([...marks].sort((x, y) => x[0] - y[0]).map(([pos, isSaved]) => (isSaved ? saved : unsaved).range(pos)));
  },
});

export const changeHistory: Extension = [
  changeField,
  gutter({ class: 'nt-change-gutter', markers: (v) => v.state.field(changeField), initialSpacer: () => unsaved }),
];

/** Effets a envoyer quand le document est enregistre / relu depuis le disque. */
export const changeEffects = { saved: () => markSaved.of(null), cleared: () => clearChanges.of(null) };

/** Nombre de lignes marquees (non enregistrees, enregistrees) : pour les tests et la barre d'etat. */
export function changeCounts(state: import('@codemirror/state').EditorState): { unsaved: number; saved: number } {
  const set = state.field(changeField, false);
  const out = { unsaved: 0, saved: 0 };
  const iter = set?.iter();
  while (iter?.value) {
    if (iter.value.saved) out.saved++;
    else out.unsaved++;
    iter.next();
  }
  return out;
}
