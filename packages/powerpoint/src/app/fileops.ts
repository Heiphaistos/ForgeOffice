// Fichier : ouverture, enregistrement (pptx, pptm, potx, ppsx...), export PDF et images, recuperation.
import { createElement, type ReactNode } from 'react';
import { MODULES, sharedRecovery } from '@forgeoffice/core';
import { openPresentation, writePptx, type Deck, type DeckFormat } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { NotesPage } from './NotesPage.tsx';
import { imagesToPdf, rasterize } from './raster.ts';
import { slidePageProps } from './slide-render.ts';
import type { Editor } from './editor.ts';
import { S } from '../strings.ts';
import { S2 } from '../strings2.ts';
import { vectorPdf } from './pdf-export.ts';

export const FORMAT_FILTERS: Readonly<Record<DeckFormat, { name: string; extensions: readonly string[] }>> = {
  pptx: { name: S.file.formats.pptx, extensions: ['pptx'] },
  pptm: { name: S.file.formats.pptm, extensions: ['pptm'] },
  potx: { name: S.file.formats.potx, extensions: ['potx'] },
  potm: { name: S.file.formats.potm, extensions: ['potm'] },
  ppsx: { name: S.file.formats.ppsx, extensions: ['ppsx'] },
  ppsm: { name: S.file.formats.ppsm, extensions: ['ppsm'] },
};

export const OPEN_FILTERS = [{ name: S.file.openFilter, extensions: ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'ppt', 'pps', 'pot', 'odp'] }] as const;

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const baseName = (name: string): string => name.replace(/\.[^.]+$/, '');

/** Format d'enregistrement d'apres l'extension (les formats en lecture seule deviennent .pptx). */
export function formatOf(name: string): DeckFormat {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return (['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm'] as const).find((f) => f === ext) ?? 'pptx';
}

export async function readDeck(bytes: Uint8Array): Promise<Deck> {
  return openPresentation(bytes);
}

/** Enregistrer (format = celui du fichier) ou Enregistrer sous (`format` impose, nouveau chemin). */
export async function saveDeck(ed: Editor, format?: DeckFormat): Promise<boolean> {
  const target = format ?? formatOf(ed.file.name);
  const sameFile = !format || target === formatOf(ed.file.name);
  const name = `${baseName(ed.file.name)}.${target}`;
  try {
    const deck: Deck = { ...ed.deck, properties: { ...ed.deck.properties, modified: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), lastModifiedBy: ed.deck.properties.lastModifiedBy } };
    if (target.endsWith('m') && !deck.macros) ed.notify(S.file.noMacros, 'info');
    const bytes = await writePptx(deck, { format: target });
    const saved = await ed.services.saveFile(bytes, name, [FORMAT_FILTERS[target]], sameFile && !format ? ed.file.path : null);
    if (!saved) return false;
    ed.setFile({ name: saved.name, path: saved.path });
    ed.ds.markSaved();
    ed.services.setTitle(`${saved.name} - ${MODULES.powerpoint.name}`);
    if (saved.path) await ed.services.addRecent({ app: 'powerpoint', name: saved.name, path: saved.path });
    await sharedRecovery('powerpoint').clear().catch(() => undefined);
    ed.notify(S.file.saved(saved.name), 'success');
    return true;
  } catch (err) {
    ed.notify(`${S.file.saveFailed} ${errorText(err)}`, 'error');
    return false;
  }
}

/** Copie de recuperation (appelee periodiquement quand la presentation est modifiee). */
export async function backup(ed: Editor): Promise<void> {
  const bytes = await writePptx(ed.deck, { format: 'pptx' });
  await sharedRecovery('powerpoint').save({ name: ed.file.name, path: ed.file.path, bytes });
}

/** Pages a rasteriser : diapositives (masquees comprises si demande), ou pages de commentaires. */
function pagesFor(ed: Editor, notes: boolean, only?: number): ReactNode[] {
  const slides = ed.deck.slides.filter((s, i) => (only === undefined ? !s.hidden : i === only));
  return slides.map((slide) => {
    const index = ed.deck.slides.indexOf(slide);
    if (notes) return createElement(NotesPage, { deck: ed.deck, slide, index });
    return createElement(PageView, { ...slidePageProps(ed.deck, slide, index, `x${slide.id}`) });
  });
}

/** Exporte en PDF : diapositives en vectoriel (texte selectionnable), pages de commentaires en images. */
export async function exportPdf(ed: Editor, notes = false): Promise<void> {
  const size = notes ? ed.deck.notesSize : ed.deck.size;
  const title = ed.deck.properties.title || baseName(ed.file.name);
  try {
    ed.notify(S.file.exporting, 'info');
    let pdf: Uint8Array;
    let message: string | null = null;
    if (notes) {
      const images = await rasterize(pagesFor(ed, notes), ed.deck, { width: size.width, height: size.height, scale: 2, type: 'image/jpeg' });
      pdf = await imagesToPdf(images, size.width, size.height, title);
    } else {
      const result = await vectorPdf(ed.deck, title);
      pdf = result.bytes;
      message = result.lossyText ? S2.pdf.lossy : null;
    }
    const saved = await ed.services.saveFile(pdf, `${baseName(ed.file.name)}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }], null);
    if (saved) ed.notify(message ?? S.file.exported(saved.name), message ? 'info' : 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}

/** Exporte les diapositives en images PNG ou JPEG (toutes ou la diapositive courante). */
export async function exportImages(ed: Editor, type: 'png' | 'jpeg', current: boolean, only = ed.slideIndex): Promise<void> {
  const size = ed.deck.size;
  try {
    const images = await rasterize(pagesFor(ed, false, current ? only : undefined), ed.deck, { width: size.width, height: size.height, scale: 2, type: type === 'png' ? 'image/png' : 'image/jpeg' });
    const indices = current ? [only] : ed.deck.slides.map((s, i) => (s.hidden ? -1 : i)).filter((i) => i >= 0);
    for (let i = 0; i < images.length; i++) {
      const blob = images[i] as Blob;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await ed.services.saveFile(bytes, `${baseName(ed.file.name)} - ${S.file.slideWord} ${(indices[i] ?? i) + 1}.${type === 'png' ? 'png' : 'jpg'}`, [{ name: type.toUpperCase(), extensions: [type === 'png' ? 'png' : 'jpg'] }], null);
    }
    ed.notify(S.file.exported(`${images.length} ${S.file.images}`), 'success');
  } catch (err) {
    ed.notify(`${S.file.exportFailed} ${errorText(err)}`, 'error');
  }
}

export { errorText };
