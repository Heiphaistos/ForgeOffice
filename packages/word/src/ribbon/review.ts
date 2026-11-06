// Onglets Revision et Affichage.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { T } from '../strings.ts';
import { languageItems } from '../ui/editorMenu.ts';
import type { Ctl, Markup, ViewMode } from '../app/types.ts';
import { setRunProp } from '../editor/commands.ts';

export function reviewTab(c: Ctl): RibbonTab {
  const { act, ui } = c;
  const cmd = T.cmd;
  const track = c.meta.settings.trackRevisions;
  const markups: [Markup, string][] = [['simple', cmd.markupSimple], ['all', cmd.markupAll], ['none', cmd.markupNone], ['original', cmd.markupOriginal]];
  const langs: MenuItem[] = [['fr-FR', 'Français (France)'], ['en-US', 'Anglais (États-Unis)'], ['en-GB', 'Anglais (Royaume-Uni)'], ['de-DE', 'Allemand'], ['es-ES', 'Espagnol'], ['it-IT', 'Italien']]
    .map(([code, label]) => ({ id: `sel-${code!}`, label: label!, checked: (c.sel.run.lang ?? 'fr-FR') === code, onClick: () => c.run(setRunProp('lang', code)) }));
  return {
    id: 'review', label: T.tabs.review, keytip: 'R',
    groups: [
      {
        id: 'proofing', label: T.groups.proofing, icon: 'text_proofing_tools',
        controls: [
          { kind: 'button', id: 'spelling', label: cmd.spelling, icon: 'text_proofing_tools', size: 'large', onClick: () => c.openDialog('spelling'), tooltip: { title: cmd.spelling, shortcut: 'F7' } },
          { kind: 'button', id: 'wordcount', label: cmd.wordCount, icon: 'text_word_count', onClick: () => c.openDialog('stats') },
          { kind: 'toggle', id: 'advstats', label: cmd.advancedStats, icon: 'data_bar_vertical', pressed: ui.pane === 'stats', onToggle: (v) => c.setUi({ pane: v ? 'stats' : null }), tooltip: { title: cmd.advancedStats, description: T.tips.advancedStats } },
        ],
      },
      { id: 'language', label: T.groups.language, icon: 'translate', controls: [{ kind: 'menu', id: 'lang', label: cmd.language, icon: 'translate', size: 'large', items: [{ id: 'h-para', kind: 'header', label: T.ctx.languageParagraph }, ...languageItems(c), { id: 'h-sel', kind: 'header', label: T.ctx.languageSelection }, ...langs] }] },
      {
        id: 'comments', label: T.groups.comments, icon: 'comment',
        controls: [
          { kind: 'button', id: 'newcomment', label: cmd.newComment, icon: 'comment_add', size: 'large', onClick: act.insertComment },
          { kind: 'button', id: 'prevc', label: cmd.prevComment, icon: 'arrow_up', onClick: () => act.gotoComment(-1) },
          { kind: 'button', id: 'nextc', label: cmd.nextComment, icon: 'arrow_down', onClick: () => act.gotoComment(1) },
          { kind: 'toggle', id: 'showc', label: cmd.showComments, icon: 'comment_multiple', pressed: ui.pane === 'comments', onToggle: (v) => c.setUi({ pane: v ? 'comments' : null }) },
        ],
      },
      {
        id: 'tracking', label: T.groups.tracking, icon: 'document_edit',
        controls: [
          { kind: 'toggle', id: 'track', label: cmd.trackChanges, icon: 'document_edit', size: 'large', pressed: track, onToggle: act.setTrack, tooltip: { title: cmd.trackChanges, shortcut: 'Ctrl+Maj+E', description: T.tips.trackChanges } },
          // Le champ du ruban affiche la valeur : on passe les libelles et on retrouve la cle.
          { kind: 'combo', id: 'markup', label: cmd.markup, value: markups.find(([k]) => k === ui.markup)?.[1] ?? '', width: 150, options: markups.map(([, label]) => ({ value: label })), onChange: (v) => {
            const hit = markups.find(([, label]) => label === v);
            if (hit) c.setUi({ markup: hit[0] });
          } },
        ],
      },
      {
        id: 'changes', label: T.groups.changes, icon: 'checkmark',
        controls: [
          { kind: 'split', id: 'accept', label: cmd.accept, icon: 'checkmark', size: 'large', onClick: () => act.review('accept', false), items: [
            { id: 'one', label: cmd.accept, onClick: () => act.review('accept', false) },
            { id: 'all', label: cmd.acceptAll, onClick: () => act.review('accept', true) },
          ] },
          { kind: 'split', id: 'reject', label: cmd.reject, icon: 'dismiss', size: 'large', onClick: () => act.review('reject', false), items: [
            { id: 'one', label: cmd.reject, onClick: () => act.review('reject', false) },
            { id: 'all', label: cmd.rejectAll, onClick: () => act.review('reject', true) },
          ] },
          { kind: 'button', id: 'prevch', label: cmd.prevChange, icon: 'previous', onClick: () => act.gotoChange(-1) },
          { kind: 'button', id: 'nextch', label: cmd.nextChange, icon: 'next', onClick: () => act.gotoChange(1) },
        ],
      },
      { id: 'compare', label: T.groups.compare, icon: 'document_copy', controls: [{ kind: 'button', id: 'compare', label: cmd.compare, icon: 'document_copy', size: 'large', onClick: () => void act.compareWith(), tooltip: { title: cmd.compare, description: T.tips.compare } }] },
      { id: 'protect', label: T.groups.protect, icon: 'shield_lock', controls: [{ kind: 'toggle', id: 'restrict', label: cmd.restrict, icon: 'shield_lock', size: 'large', pressed: ui.readOnly, onToggle: (v) => c.setUi({ readOnly: v }) }] },
    ],
  };
}

export function viewTab(c: Ctl): RibbonTab {
  const { ui } = c;
  const cmd = T.cmd;
  const view = (id: ViewMode, label: string, icon: 'book_open' | 'document_one_page' | 'globe' | 'text_bullet_list_tree' | 'document_text') => ({
    kind: 'toggle' as const, id: `view-${id}`, label, icon, size: 'large' as const, pressed: ui.view === id, onToggle: () => c.setUi({ view: id, multiPage: false }),
  });
  return {
    id: 'view', label: T.tabs.view, keytip: 'A',
    groups: [
      {
        id: 'views', label: T.groups.views, icon: 'document_one_page',
        controls: [
          view('read', cmd.readMode, 'book_open'), view('print', cmd.printLayout, 'document_one_page'), view('web', cmd.webLayout, 'globe'),
          view('outline', cmd.outline, 'text_bullet_list_tree'), view('draft', cmd.draft, 'document_text'),
        ],
      },
      {
        id: 'immersive', label: T.groups.immersive, icon: 'full_screen_maximize',
        controls: [
          { kind: 'toggle', id: 'focus', label: cmd.focus, icon: 'full_screen_maximize', size: 'large', pressed: ui.focus, onToggle: (v) => c.setUi({ focus: v }), tooltip: { title: cmd.focus, description: T.tips.focus } },
          { kind: 'button', id: 'reader', label: cmd.immersiveReader, icon: 'reading_mode_mobile', size: 'large', onClick: () => c.setUi({ view: 'read', readingTimer: true }) },
        ],
      },
      {
        id: 'show', label: T.groups.show, icon: 'eye',
        controls: [
          { kind: 'checkbox', id: 'ruler', label: cmd.ruler, checked: ui.ruler, onChange: (v) => c.setUi({ ruler: v }) },
          { kind: 'checkbox', id: 'grid', label: cmd.gridlines, checked: ui.grid, onChange: (v) => c.setUi({ grid: v }) },
          { kind: 'checkbox', id: 'nav', label: cmd.navPane, checked: ui.nav, onChange: (v) => c.setUi({ nav: v }) },
        ],
      },
      {
        id: 'zoom', label: T.groups.zoom, icon: 'zoom_in',
        controls: [
          { kind: 'menu', id: 'zoom', label: cmd.zoom, icon: 'zoom_in', size: 'large', items: [50, 75, 100, 150, 200].map((z) => ({ id: `z${z}`, label: `${z} %`, checked: ui.zoom === z, onClick: () => c.setUi({ zoom: z }) })) },
          { kind: 'button', id: 'z100', label: cmd.zoom100, icon: 'zoom_fit', onClick: () => c.setUi({ zoom: 100 }) },
          { kind: 'toggle', id: 'onepage', label: cmd.onePage, icon: 'document_one_page', pressed: !ui.multiPage, onToggle: () => c.setUi({ multiPage: false, view: 'print' }) },
          { kind: 'toggle', id: 'multipage', label: cmd.multiPage, icon: 'document_multiple', pressed: ui.multiPage, onToggle: (v) => c.setUi({ multiPage: v, view: 'print' }) },
        ],
      },
      {
        id: 'more', label: T.groups.more, icon: 'sparkle',
        controls: [
          { kind: 'toggle', id: 'timer', label: cmd.readingTimer, icon: 'clock', pressed: ui.readingTimer, onToggle: (v) => c.setUi({ readingTimer: v }), tooltip: { title: cmd.readingTimer, description: T.tips.readingTimer } },
          { kind: 'toggle', id: 'typewriter', label: cmd.typewriter, icon: 'keyboard', pressed: ui.typewriter, onToggle: (v) => c.setUi({ typewriter: v }) },
          { kind: 'button', id: 'md', label: cmd.exportMd, icon: 'arrow_export_ltr', onClick: () => void c.act.exportFile('md') },
          { kind: 'button', id: 'html', label: cmd.exportHtml, icon: 'globe', onClick: () => void c.act.exportFile('html') },
        ],
      },
    ],
  };
}
