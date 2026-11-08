// Panneau Rechercher / Remplacer du Bloc-notes (remplace celui de CodeMirror) : modes Normal, Étendu (\n \t) et Expression régulière,
// casse, mot entier, « Dans la sélection », compteur de résultats. Il garde les classes et noms de champs du panneau d'origine
// (`.cm-search`, `name=search`, `name=replace`) : les commandes qui ciblent ces champs continuent de fonctionner.
import { SearchQuery, closeSearchPanel, findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, selectMatches, setSearchQuery } from '@codemirror/search';
import type { EditorView, Panel, ViewUpdate } from '@codemirror/view';
import { FIND } from '../strings.ts';

export type FindMode = 'normal' | 'extended' | 'regexp';

const MAX_COUNT = 9999;

/** Nombre de résultats (plafonné) et rang du résultat sélectionné (0 si aucun). */
export function countMatches(view: EditorView, query: SearchQuery): { total: number; current: number } {
  const sel = view.state.selection.main;
  let total = 0;
  let current = 0;
  if (!query.valid) return { total, current };
  const cursor = query.getCursor(view.state);
  for (let r = cursor.next(); !r.done && total < MAX_COUNT; r = cursor.next()) {
    total++;
    if (r.value.from === sel.from && r.value.to === sel.to) current = total;
  }
  return { total, current };
}

export function createFindPanel(view: EditorView): Panel {
  const initial = getSearchQuery(view.state);
  let mode: FindMode = initial.regexp ? 'regexp' : 'extended';
  let scope: { from: number; to: number } | null = null;

  const dom = document.createElement('div');
  dom.className = 'cm-search nt-find';
  dom.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    } else if (e.key === 'Enter' && e.target === searchField) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(view);
    } else if (e.key === 'Enter' && e.target === replaceField) {
      e.preventDefault();
      replaceNext(view);
    }
  });

  const input = (name: string, placeholder: string): HTMLInputElement => {
    const el = document.createElement('input');
    el.name = name;
    el.placeholder = placeholder;
    el.setAttribute('aria-label', placeholder);
    el.className = 'cm-textfield';
    el.addEventListener('input', commit);
    return el;
  };
  const button = (label: string, run: () => void, title = label): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.name = label;
    el.textContent = label;
    el.title = title;
    el.className = 'cm-button';
    el.addEventListener('click', run);
    return el;
  };
  const check = (label: string, onChange: (on: boolean) => void): { label: HTMLLabelElement; box: HTMLInputElement } => {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => onChange(box.checked));
    const el = document.createElement('label');
    el.append(box, ` ${label}`);
    return { label: el, box };
  };

  const searchField = input('search', FIND.search);
  searchField.setAttribute('main-field', 'true');
  const replaceField = input('replace', FIND.replace);
  searchField.value = initial.search;
  replaceField.value = initial.replace;

  const select = document.createElement('select');
  select.className = 'cm-textfield';
  select.setAttribute('aria-label', FIND.mode);
  for (const m of ['normal', 'extended', 'regexp'] as const) select.add(new Option(FIND.modes[m], m, false, m === mode));
  select.addEventListener('change', () => {
    mode = select.value as FindMode;
    commit();
  });
  const matchCase = check(FIND.matchCase, commit);
  const wholeWord = check(FIND.wholeWord, commit);
  const inSelection = check(FIND.inSelection, (on) => {
    const sel = view.state.selection.main;
    scope = on && !sel.empty ? { from: sel.from, to: sel.to } : null;
    inSelection.box.checked = scope !== null;
    commit();
  });
  matchCase.box.checked = initial.caseSensitive;
  wholeWord.box.checked = initial.wholeWord;
  const counter = document.createElement('span');
  counter.className = 'nt-find__count';
  counter.setAttribute('role', 'status');

  // `SearchQuery.eq` ignore `literal` : le mode Normal double donc les antislashs (CodeMirror les ramène à un seul) au lieu de s'en servir.
  let committing = false;
  function commit(): void {
    const query = new SearchQuery({
      search: mode === 'normal' ? searchField.value.replaceAll('\\', '\\\\') : searchField.value,
      replace: replaceField.value,
      caseSensitive: matchCase.box.checked,
      wholeWord: wholeWord.box.checked,
      regexp: mode === 'regexp',
      test: scope ? (_m, _s, from, to) => scope !== null && from >= scope.from && to <= scope.to : undefined,
    });
    committing = true;
    try {
      view.dispatch({ effects: setSearchQuery.of(query) });
    } finally {
      committing = false;
    }
  }

  function refreshCount(): void {
    const query = getSearchQuery(view.state);
    if (searchField.value === '') counter.textContent = '';
    else if (!query.valid) counter.textContent = FIND.invalid;
    else {
      const { total, current } = countMatches(view, query);
      counter.textContent = total === 0 ? FIND.none : current > 0 ? FIND.rank(current, total >= MAX_COUNT ? `${MAX_COUNT}+` : String(total)) : FIND.total(total >= MAX_COUNT ? `${MAX_COUNT}+` : String(total));
    }
  }

  const row1 = document.createElement('div');
  row1.className = 'nt-find__row';
  row1.append(searchField, button(FIND.previous, () => findPrevious(view)), button(FIND.next, () => findNext(view)), button(FIND.selectAll, () => selectMatches(view)), counter);
  const row2 = document.createElement('div');
  row2.className = 'nt-find__row';
  row2.append(replaceField, button(FIND.replaceOne, () => replaceNext(view)), button(FIND.replaceAll, () => replaceAll(view)));
  const row3 = document.createElement('div');
  row3.className = 'nt-find__row';
  const close = button('×', () => { closeSearchPanel(view); view.focus(); }, FIND.close);
  close.name = 'close';
  close.setAttribute('aria-label', FIND.close);
  row3.append(select, matchCase.label, wholeWord.label, inSelection.label, close);
  dom.append(row1, row2, row3);
  refreshCount();

  return {
    dom,
    top: true,
    mount() {
      searchField.select();
    },
    update(u: ViewUpdate) {
      if (scope && u.docChanged) scope = { from: u.changes.mapPos(scope.from, -1), to: u.changes.mapPos(scope.to, 1) };
      for (const tr of u.transactions) {
        for (const e of tr.effects) {
          if (!committing && e.is(setSearchQuery) && e.value.search !== searchField.value) searchField.value = e.value.search;
        }
      }
      refreshCount();
    },
  };
}
