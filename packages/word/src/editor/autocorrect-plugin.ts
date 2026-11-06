// Greffon de correction automatique : applique `correct` (autocorrect.ts) au caractere tape, dans un seul pas annulable.
import { Plugin } from 'prosemirror-state';
import { capitalizeSentence, correct, listMarker, urlToken, type AutoList, type AutocorrectOptions } from './autocorrect.ts';

/** `getOptions` renvoie null quand la correction automatique est desactivee. */
export function autocorrectPlugin(
  getOptions: () => AutocorrectOptions | null,
  startList?: (spec: AutoList) => void,
  linkAttrs?: (address: string) => Record<string, unknown> | null,
): Plugin {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        const opt = getOptions();
        if (!opt || from !== to) return false;
        const $from = view.state.doc.resolve(from);
        // Pas dans un bloc de code ni hors d'un paragraphe de texte.
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
        const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        // Liste automatique : marqueur (« 1. », « - »...) suivi d'une espace en debut d'un paragraphe qui n'est pas deja une liste.
        if (text === ' ' && startList && $from.parent.type.name === 'paragraph' && !(($from.parent.attrs.props as { numbering?: unknown } | undefined)?.numbering)) {
          const spec = listMarker(before);
          if (spec && $from.parentOffset === before.length) {
            view.dispatch(view.state.tr.delete(from - before.length, from));
            startList(spec);
            return true;
          }
        }
        // Adresse web ou e-mail suivie d'une espace : devient un lien (l'espace reste hors du lien).
        const linkType = view.state.schema.marks.link;
        if (text === ' ' && linkAttrs && linkType) {
          const tok = urlToken(before);
          const attrs = tok ? linkAttrs(tok.address) : null;
          if (tok && attrs) {
            const base = from - before.length;
            const a = base + tok.start;
            const b = base + tok.end;
            if (!view.state.doc.rangeHasMark(a, b, linkType)) {
              const tr = view.state.tr.addMark(a, b, linkType.create(attrs));
              view.dispatch(tr.insertText(' ', from).scrollIntoView());
              return true;
            }
          }
        }
        const fix = correct(before, text, opt) ?? (opt.capitalize ? capitalizeSentence(before, text) : null);
        if (!fix) return false;
        view.dispatch(view.state.tr.insertText(fix.insert, from - fix.remove, to).scrollIntoView());
        return true;
      },
    },
  });
}
