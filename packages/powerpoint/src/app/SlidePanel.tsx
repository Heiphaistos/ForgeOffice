// Volet des miniatures (mode Normal) et Trieuse de diapositives : sections, glisser-deposer pour reordonner,
// selection multiple (Ctrl / Maj), menu contextuel, clavier.
import { memo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import type { Deck, Section, Slide } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { addSection, moveSection, moveSlides, removeSection, editSlides } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { cachedSlideProps } from './slide-render.ts';
import { transitionDuration } from './playback.ts';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import './SlidePanel.css';

const Thumb = memo(function Thumb({ deck, slide, index, width }: { deck: Deck; slide: Slide; index: number; width: number }) {
  const scale = width / deck.size.width;
  return (
    <div className="pp-thumb__page" style={{ width, height: deck.size.height * scale }}>
      <PageView {...cachedSlideProps(deck, slide, index, `t${slide.id}`)} scale={scale} />
    </div>
  );
});

export interface SlideListProps {
  ed: Editor;
  mode: 'panel' | 'sorter';
  /** Largeur d'une miniature (px). */
  width: number;
  onRenameSection: (section: Section) => void;
  /** Commandes du presse-papiers et de disposition (cut-slides, copy-slides, paste, layout:<id>). */
  onCommand: (command: string) => void;
}

export function SlideList({ ed, mode, width, onRenameSection, onCommand }: SlideListProps) {
  const { deck } = ed;
  const [drop, setDrop] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const context = useContextMenu();
  const selected = ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : [];

  const select = (e: MouseEvent, slide: Slide): void => {
    const index = deck.slides.indexOf(slide);
    if (e.shiftKey && ed.slide) {
      const a = Math.min(index, ed.slideIndex);
      const b = Math.max(index, ed.slideIndex);
      ed.setSelectedSlides(deck.slides.slice(a, b + 1).map((s) => s.id));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      ed.setSelectedSlides(selected.includes(slide.id) ? selected.filter((id) => id !== slide.id) : [...selected, slide.id]);
      return;
    }
    ed.goto(slide.id);
    if (mode === 'sorter' && e.detail === 2) ed.setUi({ view: 'normal' });
  };

  const slideMenu = (slide: Slide): MenuItem[] => {
    const ids = selected.includes(slide.id) ? selected : [slide.id];
    return [
      { id: 'cut', label: S.common.cut, icon: 'cut', shortcut: 'Ctrl+X', onClick: () => onCommand('cut-slides') },
      { id: 'copy', label: S.common.copy, icon: 'copy', shortcut: 'Ctrl+C', onClick: () => onCommand('copy-slides') },
      { id: 'paste', label: S.common.paste, icon: 'clipboard_paste', shortcut: 'Ctrl+V', onClick: () => onCommand('paste') },
      { id: 's1', kind: 'separator' },
      { id: 'new', label: S.slides.newSlide, icon: 'slide_add', shortcut: 'Ctrl+M', onClick: () => ed.newSlide(undefined, slide.id) },
      { id: 'dup', label: S.slides.duplicate, icon: 'copy_add', shortcut: 'Ctrl+D', onClick: () => ed.duplicateSlides(ids) },
      { id: 'del', label: S.slides.delete, icon: 'delete', onClick: () => ed.deleteSlides(ids) },
      { id: 's2', kind: 'separator' },
      { id: 'section', label: S.sections.add, icon: 'tab_add', onClick: () => ed.commit(addSection(deck, slide.id, S.sections.untitled)) },
      { id: 'layout', label: S.slides.layout, icon: 'slide_layout', items: (deck.masters[0]?.layouts ?? []).map((l) => ({ id: l.id, label: l.name, checked: slide.layoutId === l.id, onClick: () => onCommand(`layout:${l.id}`) })) },
      { id: 'saveImg', label: S3.image.slideMenu, icon: 'image', onClick: () => onCommand(`save-image:${slide.id}`) },
      { id: 'hide', label: slide.hidden ? S.slides.show : S.slides.hide, icon: 'slide_hide', onClick: () => ed.commit(editSlides(deck, new Set(ids), (s) => { s.hidden = !slide.hidden || undefined; if (!s.hidden) delete s.hidden; })) },
    ];
  };

  const sectionMenu = (section: Section, index: number): MenuItem[] => [
    { id: 'rename', label: S.sections.rename, icon: 'rename', onClick: () => onRenameSection(section) },
    { id: 'remove', label: S.sections.remove, icon: 'delete', onClick: () => ed.commit(removeSection(deck, section.id)) },
    { id: 'removeAll', label: S.sections.removeWithSlides, onClick: () => ed.commit(removeSection(deck, section.id, true)) },
    { id: 's', kind: 'separator' },
    { id: 'up', label: S.sections.up, icon: 'arrow_up', disabled: index === 0, onClick: () => ed.commit(moveSection(deck, section.id, -1)) },
    { id: 'down', label: S.sections.down, icon: 'arrow_down', disabled: index === deck.sections.length - 1, onClick: () => ed.commit(moveSection(deck, section.id, 1)) },
  ];

  const onDragStart = (e: DragEvent, slide: Slide): void => {
    const ids = selected.includes(slide.id) ? selected : [slide.id];
    e.dataTransfer.setData('application/x-forgeoffice-slides', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const indexAt = (e: DragEvent, slide: Slide): number => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = mode === 'sorter' ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
    return deck.slides.indexOf(slide) + (after ? 1 : 0);
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-forgeoffice-slides');
    const at = drop;
    setDrop(null);
    if (!raw || at === null) return;
    const ids = (JSON.parse(raw) as unknown[]).filter((v): v is number => typeof v === 'number');
    ed.commit(moveSlides(deck, ids, at));
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const i = ed.slideIndex;
    const step = mode === 'sorter' ? 1 : 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = deck.slides[Math.min(deck.slides.length - 1, i + step)];
      if (next) ed.goto(next.id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = deck.slides[Math.max(0, i - step)];
      if (prev) ed.goto(prev.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      ed.deleteSlides(selected);
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      ed.newSlide();
    } else if (e.key === 'Home' || e.key === 'End') {
      const target = e.key === 'Home' ? deck.slides[0] : deck.slides[deck.slides.length - 1];
      if (target) ed.goto(target.id);
    }
  };

  const sectionOfSlide = new Map<number, Section>();
  for (const section of deck.sections) for (const id of section.slideIds) sectionOfSlide.set(id, section);
  let number = deck.firstSlideNumber ?? 1;

  return (
    <div className={`pp-slides is-${mode}`} tabIndex={0} onKeyDown={onKeyDown} role="listbox" aria-label={S.slides.listLabel} aria-multiselectable onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
      {deck.slides.map((slide, i) => {
        const section = sectionOfSlide.get(slide.id);
        const first = section && section.slideIds[0] === slide.id;
        const sectionIndex = section ? deck.sections.indexOf(section) : -1;
        const hiddenBySection = section && collapsed.has(section.id) && !first;
        const n = number++;
        const isCurrent = ed.slide?.id === slide.id;
        const isSelected = selected.includes(slide.id);
        return (
          <div key={slide.id} className="pp-slides__item">
            {first && section && (
              <div
                className="pp-section"
                onContextMenu={(e) => context.open(e, sectionMenu(section, sectionIndex))}
                onDoubleClick={() => onRenameSection(section)}
              >
                <button
                  type="button"
                  className="pp-section__toggle"
                  aria-label={collapsed.has(section.id) ? S.sections.expand : S.sections.collapse}
                  onClick={() => setCollapsed((c) => {
                    const next = new Set(c);
                    if (next.has(section.id)) next.delete(section.id);
                    else next.add(section.id);
                    return next;
                  })}
                >
                  <Icon name={collapsed.has(section.id) ? 'chevron_right' : 'chevron_down'} size={12} />
                </button>
                <span className="pp-section__name">{section.name}</span>
                <span className="pp-section__count">{S.sections.count(section.slideIds.length)}</span>
              </div>
            )}
            {!hiddenBySection && !(section && collapsed.has(section.id)) && (
              <div
                className={`pp-thumb${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}${slide.hidden ? ' is-hidden' : ''}`}
                role="option"
                aria-selected={isSelected}
                draggable
                onDragStart={(e) => onDragStart(e, slide)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrop(indexAt(e, slide));
                }}
                onClick={(e) => select(e, slide)}
                onContextMenu={(e) => {
                  if (!selected.includes(slide.id)) ed.goto(slide.id);
                  context.open(e, slideMenu(slide));
                }}
              >
                {drop === i && <div className={`pp-drop is-before`} />}
                {drop === i + 1 && i === deck.slides.length - 1 && <div className="pp-drop is-after" />}
                <div className="pp-thumb__side">
                  <span className="pp-thumb__num">{n}</span>
                  {slide.transition && transitionDuration(slide.transition) > 0 && <Icon name="slide_transition" size={12} />}
                  {slide.animations.length > 0 && <Icon name="sparkle" size={12} />}
                  {slide.comments.length > 0 && <Icon name="comment" size={12} />}
                </div>
                <div className="pp-thumb__frame">
                  <Thumb deck={deck} slide={slide} index={i} width={width} />
                  {slide.hidden && <span className="pp-thumb__hidden" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {context.menu}
    </div>
  );
}
