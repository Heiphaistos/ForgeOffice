// Volet « Navigation entre les pages » : miniatures (planches en vis-a-vis), glisser pour deplacer, menu contextuel ;
// en mode page maitre, liste des pages maitres.
import { memo, useState, type DragEvent } from 'react';
import { useContextMenu, type MenuItem } from '@forgeoffice/ui';
import { deckPageBackground, deckPageContext, PageView } from '@forgeoffice/powerpoint/canvas';
import type { Deck, Layout, Slide } from '@forgeoffice/pptx';
import { spreads } from '../guides.ts';
import type { PubSettings } from '../model.ts';
import { pageCss } from '../pagecss.ts';
import { addMasterPage, applyMasterToAll, removeMasterPage } from '../pubdeck.ts';
import { S } from '../strings.ts';
import { pageProps, type Editor } from './editor.ts';
import { addPages, copyPage, deleteCurrentPage, duplicateCurrentPage, hasPageClip, movePageTo, pastePageAfter } from './ops.ts';

const THUMB = 92;

/** Miniature d'une page ; `scope` isole sa feuille de style quand plusieurs publications sont affichees (catalogue). */
export const PageThumb = memo(function PageThumb({ deck, pub, slide, index, width = THUMB, scope = 'v' }: { deck: Deck; pub: PubSettings; slide: Slide; index: number; width?: number; scope?: string }) {
  const scale = width / deck.size.width;
  const props = pageProps(deck, slide, index, pub);
  const cls = `pubt-${scope}-${slide.id}`;
  return (
    <div className="pub-thumb__page" style={{ width, height: deck.size.height * scale }}>
      <PageView width={deck.size.width} height={deck.size.height} {...props} uid={`t${scope}${slide.id}`} scale={scale} className={cls}>
        <style>{pageCss(slide, pub, '#077568', cls, deck.slides.map((s) => s.id))}</style>
      </PageView>
    </div>
  );
});

const MasterThumb = memo(function MasterThumb({ deck, layout }: { deck: Deck; layout: Layout }) {
  const scale = THUMB / deck.size.width;
  return (
    <div className="pub-thumb__page" style={{ width: THUMB, height: deck.size.height * scale }}>
      <PageView width={deck.size.width} height={deck.size.height} background={deckPageBackground(deck, layout)} ctx={deckPageContext(deck, layout)} shapes={layout.shapes} uid={`m${layout.id}`} scale={scale} />
    </div>
  );
});

export function PagesPane({ ed }: { ed: Editor }) {
  const { deck, pub, ui } = ed;
  const context = useContextMenu();
  const [dropAt, setDropAt] = useState<number | null>(null);

  if (ui.view === 'master') {
    const layouts = deck.masters[0]?.layouts ?? [];
    const current = ed.ref.kind === 'master' ? ed.ref.layoutId : '';
    const masterMenu = (layout: Layout): MenuItem[] => [
      { id: 'new', label: S.cmd.newMaster, icon: 'add', onClick: () => { const d = structuredClone(deck); const l = addMasterPage(d); ed.commitDeck(d); if (l) ed.setUi({ masterId: l.id }); } },
      { id: 'dup', label: S.cmd.duplicatePage, icon: 'copy', onClick: () => { const d = structuredClone(deck); const l = addMasterPage(d, layout.id); ed.commitDeck(d); if (l) ed.setUi({ masterId: l.id }); } },
      { id: 'all', label: S.cmd.applyMasterAll, icon: 'slide_layout', onClick: () => { const d = structuredClone(deck); if (applyMasterToAll(d, layout.id)) ed.commitDeck(d); } },
      { id: 'ren', label: S.cmd.renameMaster, icon: 'edit', onClick: () => { ed.setUi({ masterId: layout.id, dialog: 'renameMaster' }); } },
      { id: 'del', label: S.cmd.deleteMaster, icon: 'delete', disabled: layouts.length < 2, onClick: () => { const d = structuredClone(deck); if (removeMasterPage(d, layout.id)) { ed.commitDeck(d); ed.setUi({ masterId: null }); } } },
    ];
    return (
      <aside className="pub-pages" aria-label={S.pages.masterPane}>
        <div className="pub-pages__title">{S.pages.masterPane}</div>
        <div className="pub-pages__list fo-scroll">
          {layouts.map((l) => (
            <button key={l.id} type="button" className={`pub-thumb${l.id === current ? ' is-active' : ''}`} onClick={() => { ed.setUi({ masterId: l.id }); ed.setSelection({ ids: [] }); }} onContextMenu={(e) => context.open(e, masterMenu(l))}>
              <MasterThumb deck={deck} layout={l} />
              <span className="pub-thumb__label">{l.name.replace(/^Page maître /, '')}</span>
              <span className="pub-thumb__uses">{S.pages.uses(deck.slides.filter((sl) => sl.layoutId === l.id).length)}</span>
            </button>
          ))}
        </div>
        {context.menu}
      </aside>
    );
  }

  const pageMenu = (index: number): MenuItem[] => {
    const slide = deck.slides[index];
    const layouts = deck.masters[0]?.layouts ?? [];
    return [
      { id: 'after', label: S.pages.insertAfter, icon: 'document_add', onClick: () => addPages(ed, 1, false, index) },
      { id: 'many', label: S.cmd.insertPages, icon: 'document_multiple', onClick: () => { ed.goto(index); ed.setUi({ dialog: 'insertPages' }); } },
      { id: 'dup', label: S.cmd.duplicatePage, icon: 'copy', onClick: () => slide && duplicateCurrentPage(ed, slide.id) },
      { id: 'cutp', label: S.cmd.cutPage, icon: 'cut', disabled: deck.slides.length < 2, onClick: () => slide && copyPage(ed, slide.id, true) },
      { id: 'copyp', label: S.cmd.copyPage, icon: 'copy', onClick: () => slide && copyPage(ed, slide.id, false) },
      { id: 'pastep', label: S.cmd.pastePage, icon: 'clipboard_paste', disabled: !hasPageClip(), onClick: () => pastePageAfter(ed, index) },
      { id: 'goto', label: S.cmd.goToPage, icon: 'arrow_right', onClick: () => ed.setUi({ dialog: 'goToPage' }) },
      { id: 'del', label: S.cmd.deletePage, icon: 'delete', disabled: deck.slides.length < 2, onClick: () => slide && deleteCurrentPage(ed, [slide.id]) },
      { id: 's', kind: 'separator' },
      {
        id: 'master', label: S.cmd.applyMaster, icon: 'slide_layout', items: [
          ...layouts.map((l) => ({ id: l.id, label: l.name, checked: slide?.layoutId === l.id, onClick: () => ed.commitDeck({ ...deck, slides: deck.slides.map((x) => (x === slide ? { ...x, layoutId: l.id, showMasterShapes: true } : x)) }) })),
          { id: 'none', label: S.cmd.ignoreMaster, checked: slide?.showMasterShapes === false, onClick: () => ed.commitDeck({ ...deck, slides: deck.slides.map((x) => (x === slide ? { ...x, showMasterShapes: x.showMasterShapes === false } : x)) }) },
        ],
      },
    ];
  };

  const onDrop = (e: DragEvent, to: number): void => {
    e.preventDefault();
    setDropAt(null);
    const id = Number(e.dataTransfer.getData('application/x-pub-page'));
    const from = deck.slides.findIndex((s) => s.id === id);
    if (from < 0) return;
    movePageTo(ed, id, from < to ? to - 1 : to);
  };

  return (
    <aside className="pub-pages" aria-label={S.pages.pane}>
      <div className="pub-pages__title">{S.pages.pane}</div>
      <div className="pub-pages__list fo-scroll" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, deck.slides.length)}>
        {spreads(deck.slides.length, pub.facing).map((spread) => (
          <div key={spread.join('-')} className={`pub-spreadthumb${spread.length === 1 && spread[0] === 0 && pub.facing ? ' is-first' : ''}`}>
            {spread.map((i) => {
              const slide = deck.slides[i];
              if (!slide) return null;
              return (
                <button
                  key={slide.id}
                  type="button"
                  draggable
                  className={`pub-thumb${i === ed.pageIndex && ui.view === 'normal' ? ' is-active' : ''}${dropAt === i ? ' is-drop' : ''}`}
                  onClick={() => ed.goto(i)}
                  onContextMenu={(e) => context.open(e, pageMenu(i))}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-pub-page', String(slide.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropAt(i);
                  }}
                  onDragLeave={() => setDropAt(null)}
                  onDrop={(e) => {
                    e.stopPropagation();
                    onDrop(e, i);
                  }}
                  aria-label={S.pages.page(i + 1)}
                  aria-current={i === ed.pageIndex ? 'page' : undefined}
                >
                  <PageThumb deck={deck} pub={pub} slide={slide} index={i} width={pub.facing ? 60 : THUMB} />
                  <span className="pub-thumb__label">{i + 1}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {context.menu}
    </aside>
  );
}
