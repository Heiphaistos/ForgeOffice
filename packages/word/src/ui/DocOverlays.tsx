// Calques au-dessus du document : point d'insertion et poignees de l'objet selectionne.
import type { EditorView } from 'prosemirror-view';
import type { WordDocument } from '@forgeoffice/docx';
import type { Ctl } from '../app/types.ts';
import { pageColor } from '../features/design.ts';
import { wrapPatch } from '../editor/images.ts';
import { moveFloatingImage } from '../editor/images-dom.ts';
import { updateAtom } from '../editor/commands.ts';
import { CaretOverlay } from './CaretOverlay.tsx';
import { ImageOverlay } from './ImageOverlay.tsx';

export function DocOverlays({ ctl, view, meta, pagesRef }: { ctl: Ctl; view: EditorView | null; meta: WordDocument; pagesRef: { current: HTMLElement | null } }) {
  const img = ctl.sel.image;
  return (
    <>
      <CaretOverlay view={view} pagesRef={pagesRef} prefs={ctl.ui.caret} background={pageColor(meta)} accent="#185ABD" />
      {img && (
        <ImageOverlay view={view} image={img} pagesRef={pagesRef}
          onSize={(size) => ctl.run(updateAtom(img.pos, { ...img.data, ...size }))}
          onRotate={(deg) => ctl.run(updateAtom(img.pos, { ...img.data, rotation: deg || undefined }))}
          onWrap={(mode) => ctl.run(updateAtom(img.pos, { ...img.data, ...wrapPatch(img.data, mode) }))}
          onMove={(x, y) => { if (view) moveFloatingImage(view, img.pos, img.data, x, y); }} />
      )}
    </>
  );
}
