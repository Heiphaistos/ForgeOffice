// Raccourcis pendant la saisie d'une cellule (ou de la barre de formule) : Entree, Tab, Echap, F2, F4, fleches en mode Entrer,
// Ctrl+Maj+Entree (matricielle), Ctrl+A (arguments de fonction), F3 (coller un nom), Alt+Entree (saut de ligne).
import { currentEnterDirection, enterDelta } from '../logic/options.ts';
import { argumentAt, findRefs, functionInfo } from '../logic/formula-ui.ts';
import { toggleFormulaBar } from './keys-zones.ts';
import { registerShortcuts, type ShortcutDef } from './registry.ts';

const ARROWS = [['ArrowUp', -1, 0], ['ArrowDown', 1, 0], ['ArrowLeft', 0, -1], ['ArrowRight', 0, 1]] as const;

registerShortcuts<'entry'>([
  {
    id: 'entry.newline', context: 'entry', combo: '~Ctrl+~Shift+Alt+Enter', priority: 10,
    run: (k) => {
      const el = k.textarea;
      if (!el) return false;
      const pos = el.selectionStart;
      const text = `${k.edit.text.slice(0, pos)}\n${k.edit.text.slice(el.selectionEnd)}`;
      k.setEdit({ ...k.edit, text, caret: pos + 1, mode: 'edit' });
      requestAnimationFrame(() => el.setSelectionRange(pos + 1, pos + 1));
    },
  },
  // Ctrl+Maj+Entree : valide en formule matricielle sur la selection (priorite sur Entree qui ignore Maj/Ctrl).
  { id: 'entry.array', context: 'entry', combo: 'Ctrl+Shift+Enter', priority: 20, run: (k) => void k.commit(0, 0, false, true) },
  { id: 'entry.enter', context: 'entry', combo: '~Ctrl+~Shift+~Alt+Enter', run: (k, e) => { const [dr, dc] = enterDelta(currentEnterDirection(), e.shiftKey); void k.commit(dr, dc, e.ctrlKey); } },
  { id: 'entry.tab', context: 'entry', combo: '~Ctrl+~Shift+~Alt+Tab', run: (k, e) => void k.commit(0, e.shiftKey ? -1 : 1) },
  { id: 'entry.cancel', context: 'entry', combo: '~Ctrl+~Shift+~Alt+Escape', run: (k) => k.cancel() },
  { id: 'entry.f4', context: 'entry', combo: 'F4', run: (k) => k.cycleAbsolute() },
  { id: 'entry.f2', context: 'entry', combo: '~Ctrl+~Shift+~Alt+F2', run: (k) => k.setEdit({ ...k.edit, mode: k.edit.mode === 'enter' ? 'edit' : 'enter' }) },
  // Ctrl+A dans une formule, curseur dans une fonction : boite Arguments de la fonction (sinon : tout selectionner, comportement du champ).
  {
    id: 'entry.fnArgs', context: 'entry', combo: 'Ctrl+~Alt+a',
    run: (k) => {
      const at = k.edit.text.startsWith('=') ? argumentAt(k.edit.text, k.edit.caret) : null;
      const info = at ? functionInfo(at.fn) : undefined;
      if (!info) return false;
      k.open({ kind: 'fnWizard', fn: info.name });
    },
  },
  { id: 'entry.expandBar', context: 'entry', combo: 'Ctrl+Shift+~Alt+u', run: () => toggleFormulaBar() },
  // Ctrl+Maj+A apres un nom de fonction : insere ses arguments « (nombre1;nombre2;...) ».
  {
    id: 'entry.argNames', context: 'entry', combo: 'Ctrl+Shift+~Alt+a',
    run: (k) => {
      const { text, caret } = k.edit;
      const typed = text.startsWith('=') ? /([A-Za-zÀ-ÿ][A-Za-z0-9.À-ÿ]*)$/.exec(text.slice(0, caret)) : null;
      const info = typed?.[1] ? functionInfo(typed[1]) : undefined;
      if (!info || text[caret] === '(') return false;
      const insert = `(${info.args.map((a) => a.replace(/^\[|\]$/g, '')).join(';')})`;
      k.setEdit({ ...k.edit, text: text.slice(0, caret) + insert + text.slice(caret), caret: caret + insert.length, mode: 'edit', point: null });
    },
  },
  // F3 : coller un nom defini dans la formule en cours.
  { id: 'entry.pasteName', context: 'entry', combo: 'F3', run: (k) => k.open({ kind: 'keysPasteName' }) },
  ...ARROWS.map(([key, dr, dc]): ShortcutDef<'entry'> => ({
    id: `entry.arrow.${key}`, context: 'entry', combo: `~Ctrl+~Shift+~Alt+${key}`,
    when: (k) => k.edit.mode === 'enter',
    run: (k) => {
      const { edit } = k;
      if (k.pointing && edit.sheet === k.si) {
        const base = edit.point ? findRefs(edit.text).find((r) => r.start === edit.point?.start)?.range : undefined;
        const from = base ? { row: base.r1, col: base.c1 } : { row: edit.row, col: edit.col };
        const row = Math.max(0, from.row + dr);
        const col = Math.max(0, from.col + dc);
        k.onPoint({ r1: row, c1: col, r2: row, c2: col });
      } else k.commit(dr, dc);
    },
  })),
]);
