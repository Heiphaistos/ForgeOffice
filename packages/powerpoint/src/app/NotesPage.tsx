// Page de commentaires (impression, export, mode Page de commentaires) : diapositive en haut, notes en dessous.
import type { Deck, Slide } from '@forgeoffice/pptx';
import { notesText } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { slidePageProps } from './slide-render.ts';
import { S } from '../strings.ts';

export function NotesPage({ deck, slide, index }: { deck: Deck; slide: Slide; index: number }) {
  const page = deck.notesSize;
  const margin = page.width * 0.12;
  const thumbWidth = page.width - margin * 2;
  const scale = thumbWidth / deck.size.width;
  const thumbHeight = deck.size.height * scale;
  const notes = notesText(slide);
  return (
    <div style={{ position: 'relative', width: page.width, height: page.height, background: '#fff', fontFamily: 'Aptos, "Segoe UI", Calibri, sans-serif', color: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: margin, top: page.height * 0.07, width: thumbWidth, height: thumbHeight, outline: '0.75px solid #000' }}>
        <PageView {...slidePageProps(deck, slide, index, `np${slide.id}`)} scale={scale} />
      </div>
      <div style={{ position: 'absolute', left: margin, top: page.height * 0.07 + thumbHeight + 24, width: thumbWidth, bottom: page.height * 0.08, fontSize: 12, lineHeight: 1.35, whiteSpace: 'pre-wrap', overflow: 'hidden' }}>{notes}</div>
      <div style={{ position: 'absolute', right: margin, bottom: page.height * 0.03, fontSize: 9, color: '#595959' }}>{S.file.pageNumber(index + 1)}</div>
    </div>
  );
}
