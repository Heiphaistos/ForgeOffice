// Onglets Diaporama, Revision, Affichage et Masque des diapositives.
import type { RibbonTab } from '@forgeoffice/ui';
import { standardLayout } from '@forgeoffice/pptx';
import { editMasters, editSlides } from '../deck-ops.ts';
import type { Editor, ViewMode } from '../editor.ts';
import type { TabContext } from './common.tsx';
import { S } from '../../strings.ts';

export function showTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const presenter = ed.services.settings.get('powerpoint.presenter', false);
  return {
    id: 'slideshow',
    label: S.tabs.slideshow,
    keytip: 'Y',
    groups: [
      {
        id: 'start', label: S.show.startGroup, icon: 'slide_play',
        controls: [
          { kind: 'button', id: 'fromStart', label: S.show.fromStart, icon: 'slide_play', size: 'large', tooltip: { title: S.show.fromStart, shortcut: 'F5' }, onClick: () => app.startShow(false) },
          { kind: 'button', id: 'fromCurrent', label: S.show.fromCurrent, icon: 'play', size: 'large', tooltip: { title: S.show.fromCurrent, shortcut: 'Maj+F5' }, onClick: () => app.startShow(true) },
          { kind: 'button', id: 'presenter', label: S.show.presenterView, icon: 'presenter', size: 'large', tooltip: { title: S.show.presenterView, shortcut: 'Alt+F5' }, onClick: () => app.startShow(true, true) },
        ],
      },
      {
        id: 'setup', label: S.show.setup, icon: 'settings',
        controls: [
          {
            kind: 'toggle', id: 'hide', label: S.slides.hide, icon: 'slide_hide', size: 'large', pressed: !!ed.slide?.hidden,
            onToggle: (on) => ed.commit(editSlides(ed.deck, new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []), (s) => {
              if (on) s.hidden = true;
              else delete s.hidden;
            })),
          },
          { kind: 'checkbox', id: 'usePresenter', label: S.show.usePresenter, checked: presenter, onChange: (v) => ed.services.settings.set('powerpoint.presenter', v) },
        ],
      },
    ],
  };
}

export function reviewTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const comments = ed.slide?.comments ?? [];
  const slideWithComments = (dir: 1 | -1): void => {
    const n = ed.deck.slides.length;
    for (let k = 1; k <= n; k++) {
      const s = ed.deck.slides[(ed.slideIndex + dir * k + n) % n];
      if (s?.comments.length) {
        ed.goto(s.id);
        app.pane('comments');
        return;
      }
    }
  };
  return {
    id: 'review',
    label: S.tabs.review,
    keytip: 'R',
    groups: [
      {
        id: 'proofing', label: S.review.proofing, icon: 'text_proofing_tools',
        controls: [
          { kind: 'button', id: 'spell', label: S.review.spelling, icon: 'text_proofing_tools', size: 'large', tooltip: { title: S.review.spelling, description: S.review.spellingTip }, onClick: () => ed.notify(S.review.spellingInfo, 'info') },
          { kind: 'button', id: 'a11y', label: S.review.accessibility, icon: 'accessibility_checkmark', size: 'large', onClick: () => app.pane('accessibility') },
        ],
      },
      {
        id: 'comments', label: S.review.comments, icon: 'comment',
        controls: [
          { kind: 'button', id: 'new', label: S.review.newComment, icon: 'comment_add', size: 'large', onClick: () => app.dialog('comment') },
          { kind: 'button', id: 'delete', label: S.review.deleteComments, icon: 'delete', size: 'small', disabled: !comments.length, onClick: () => ed.slide && ed.commit(editSlides(ed.deck, new Set([ed.slide.id]), (s) => { s.comments = []; })) },
          { kind: 'button', id: 'prev', label: S.review.previous, icon: 'arrow_up', size: 'small', onClick: () => slideWithComments(-1) },
          { kind: 'button', id: 'next', label: S.review.next, icon: 'arrow_down', size: 'small', onClick: () => slideWithComments(1) },
          { kind: 'toggle', id: 'show', label: S.review.showComments, icon: 'comment_multiple', size: 'large', pressed: ed.ui.pane === 'comments', onToggle: (on) => app.pane(on ? 'comments' : null) },
        ],
      },
    ],
  };
}

const ZOOMS = [33, 50, 66, 75, 100, 150, 200, 300, 400];

export function viewTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const ui = ed.ui;
  const view = (v: ViewMode) => () => openView(ed, v);
  return {
    id: 'view',
    label: S.tabs.view,
    keytip: 'W',
    groups: [
      {
        id: 'views', label: S.view.presentationViews, icon: 'slide_text',
        controls: [
          { kind: 'toggle', id: 'normal', label: S.view.normal, icon: 'slide_text', size: 'large', pressed: ui.view === 'normal', onToggle: view('normal') },
          { kind: 'toggle', id: 'outline', label: S.view.outline, icon: 'text_bullet_list_tree', size: 'large', pressed: ui.view === 'outline', onToggle: view('outline') },
          { kind: 'toggle', id: 'sorter', label: S.view.sorter, icon: 'grid', size: 'large', pressed: ui.view === 'sorter', onToggle: view('sorter') },
          { kind: 'toggle', id: 'notesPage', label: S.view.notesPage, icon: 'document_one_page', size: 'large', pressed: ui.view === 'notesPage', onToggle: view('notesPage') },
          { kind: 'toggle', id: 'reading', label: S.view.reading, icon: 'book_open', size: 'large', pressed: ui.view === 'reading', onToggle: view('reading') },
        ],
      },
      {
        id: 'masters', label: S.view.masterViews, icon: 'slide_layout',
        controls: [{ kind: 'toggle', id: 'master', label: S.view.slideMaster, icon: 'slide_layout', size: 'large', pressed: ui.view === 'master', onToggle: (on) => openView(ed, on ? 'master' : 'normal') }],
      },
      {
        id: 'show', label: S.view.show, icon: 'ruler',
        controls: [
          { kind: 'checkbox', id: 'ruler', label: S.view.ruler, checked: ui.ruler, onChange: (v) => ed.setUi({ ruler: v }) },
          { kind: 'checkbox', id: 'grid', label: S.view.gridlines, checked: ui.grid, onChange: (v) => ed.setUi({ grid: v }) },
          { kind: 'checkbox', id: 'guides', label: S.view.guides, checked: ui.guides, onChange: (v) => ed.setUi({ guides: v, guidesX: v && !ui.guidesX.length ? [ed.deck.size.width / 2] : ui.guidesX, guidesY: v && !ui.guidesY.length ? [ed.deck.size.height / 2] : ui.guidesY }) },
          { kind: 'checkbox', id: 'snap', label: S.view.snapToGrid, checked: ui.snapToGrid, onChange: (v) => ed.setUi({ snapToGrid: v }) },
          { kind: 'checkbox', id: 'smart', label: S.view.smartGuides, checked: ui.smartGuides, onChange: (v) => ed.setUi({ smartGuides: v }) },
          { kind: 'toggle', id: 'notes', label: S.view.notes, icon: 'note', size: 'large', pressed: ui.notes, onToggle: (v) => ed.setUi({ notes: v }) },
        ],
      },
      {
        id: 'zoom', label: S.view.zoom, icon: 'zoom_in',
        controls: [
          { kind: 'menu', id: 'zoomMenu', label: S.view.zoom, icon: 'zoom_in', size: 'large', items: ZOOMS.map((z) => ({ id: String(z), label: `${z} %`, checked: !ui.fit && ui.zoom === z, onClick: () => ed.setUi({ zoom: z, fit: false }) })) },
          { kind: 'toggle', id: 'fit', label: S.view.fit, icon: 'zoom_fit', size: 'large', pressed: ui.fit, onToggle: () => ed.setUi({ fit: true }) },
        ],
      },
      {
        id: 'color', label: S.view.colorGroup, icon: 'color',
        controls: [
          { kind: 'toggle', id: 'colorMode', label: S.view.color, icon: 'color', size: 'small', pressed: !ui.grayscale, onToggle: () => ed.setUi({ grayscale: false }) },
          { kind: 'toggle', id: 'gray', label: S.view.grayscale, icon: 'dark_theme', size: 'small', pressed: ui.grayscale, onToggle: () => ed.setUi({ grayscale: true }) },
        ],
      },
    ],
  };
}

/** Change de mode d'affichage (le mode Masque ouvre la disposition de la diapositive courante). */
export function openView(ed: Editor, view: ViewMode): void {
  if (view === 'master') {
    const layoutId = ed.slide?.layoutId;
    const masterIndex = Math.max(0, ed.deck.masters.findIndex((m) => m.layouts.some((l) => l.id === layoutId)));
    ed.setUi({ view, masterPage: layoutId ? { kind: 'layout', masterIndex, layoutId } : { kind: 'master', masterIndex: 0 }, ribbonTab: 'master' });
  } else ed.setUi((u) => ({ view, masterPage: null, ribbonTab: u.ribbonTab === 'master' ? 'home' : u.ribbonTab }));
  ed.setSelection({ ids: [] });
}

export function masterTab(ctx: TabContext): RibbonTab {
  const { ed, app } = ctx;
  const ref = ed.ui.masterPage;
  const master = ref ? ed.deck.masters[ref.masterIndex] : undefined;
  const layout = ref?.kind === 'layout' ? master?.layouts.find((l) => l.id === ref.layoutId) : undefined;
  const used = new Set(ed.deck.slides.map((s) => s.layoutId));
  return {
    id: 'master',
    label: S.view.slideMaster,
    keytip: 'M',
    hidden: ed.ui.view !== 'master',
    groups: [
      {
        id: 'edit', label: S.master.editMaster, icon: 'slide_layout',
        controls: [
          {
            kind: 'button', id: 'insertLayout', label: S.master.insertLayout, icon: 'slide_add', size: 'large',
            onClick: () => {
              if (!ref) return;
              const id = `layout${Date.now().toString(36)}`;
              ed.commit(editMasters(ed.deck, (masters) => {
                const m = masters[ref.masterIndex];
                if (!m) return;
                const l = standardLayout('titleOnly', id, ed.deck.size);
                l.name = S.master.customLayout;
                l.type = 'cust';
                m.layouts.push(l);
              }));
              ed.setUi({ masterPage: { kind: 'layout', masterIndex: ref.masterIndex, layoutId: id } });
            },
          },
          {
            kind: 'button', id: 'deleteLayout', label: S.master.deleteLayout, icon: 'delete', size: 'small', disabled: !layout || used.has(layout.id) || (master?.layouts.length ?? 0) < 2,
            onClick: () => {
              if (!ref || !layout) return;
              ed.commit(editMasters(ed.deck, (masters) => {
                const m = masters[ref.masterIndex];
                if (m) m.layouts = m.layouts.filter((l) => l.id !== layout.id);
              }));
              ed.setUi({ masterPage: { kind: 'master', masterIndex: ref.masterIndex } });
            },
          },
          { kind: 'button', id: 'renameLayout', label: S.master.rename, icon: 'rename', size: 'small', disabled: !layout, onClick: () => app.dialog('sectionName') },
        ],
      },
      {
        id: 'layoutGroup', label: S.master.masterLayout, icon: 'slide_layout',
        controls: [
          {
            kind: 'checkbox', id: 'masterShapes', label: S.master.hideBackgroundGraphics, checked: layout?.showMasterShapes === false, disabled: !layout,
            onChange: (v) => ref && layout && ed.commit(editMasters(ed.deck, (masters) => {
              const l = masters[ref.masterIndex]?.layouts.find((x) => x.id === layout.id);
              if (l) l.showMasterShapes = v ? false : undefined;
            })),
          },
          { kind: 'button', id: 'background', label: S.design.formatBackground, icon: 'color_background', size: 'large', onClick: () => app.dialog('background') },
        ],
      },
      {
        id: 'close', label: S.master.close, icon: 'dismiss',
        controls: [{ kind: 'button', id: 'closeMaster', label: S.master.closeView, icon: 'dismiss', size: 'large', onClick: () => openView(ed, 'normal') }],
      },
    ],
  };
}
