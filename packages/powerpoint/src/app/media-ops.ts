// Lecture des médias (audio et vidéo) : propriétés, aperçu dans l'éditeur.
import type { MediaPlayback, MediaShape } from '@forgeoffice/pptx';
import { probeCounters } from './probe-counters.ts';
import { mediaUrl } from '../canvas/context.ts';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';

export const VOLUME_CHOICES: ReadonlyArray<readonly ['mute' | 'low' | 'medium' | 'high', number]> = [['mute', 0], ['low', 25], ['medium', 60], ['high', 100]];

/** Fusionne un changement et retire les valeurs par defaut (100 %, au clic, sans boucle, visible). */
export function patchPlayback(current: MediaPlayback | undefined, patch: Partial<MediaPlayback>): MediaPlayback | undefined {
  const merged: MediaPlayback = { ...current, ...patch };
  if (merged.volume === undefined || merged.volume >= 100) delete merged.volume;
  if (!merged.auto) delete merged.auto;
  if (!merged.loop) delete merged.loop;
  if (!merged.hideInShow) delete merged.hideInShow;
  return Object.keys(merged).length ? merged : undefined;
}

/** Libelle du volume : le choix le plus proche. */
export function volumeChoice(volume: number | undefined): 'mute' | 'low' | 'medium' | 'high' {
  const v = volume ?? 100;
  return VOLUME_CHOICES.reduce((best, c) => (Math.abs(c[1] - v) < Math.abs(best[1] - v) ? c : best))[0];
}

export function selectedMedia(ed: Editor): MediaShape | undefined {
  const s = ed.selectedShapes.find((x) => x.kind === 'media');
  return s?.kind === 'media' ? s : undefined;
}

export function setPlayback(ed: Editor, patch: Partial<MediaPlayback>): void {
  ed.editSelected((s) => {
    if (s.kind !== 'media') return;
    const next = patchPlayback(s.playback, patch);
    if (next) s.playback = next;
    else delete s.playback;
  }, 'media-playback');
}

// Apercu dans l'editeur : un element media par forme, hors de la page (le son se lit, la video n'est pas montree).
const previews = new Map<number, HTMLMediaElement>();

export function isPreviewing(id: number): boolean {
  const el = previews.get(id);
  return !!el && !el.paused;
}

export function togglePreview(ed: Editor, shape: MediaShape): void {
  const existing = previews.get(shape.id);
  if (existing && !existing.paused) {
    existing.pause();
    existing.currentTime = 0;
    ed.setUi({});
    return;
  }
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) probeCounters.previews += 1;
  const url = shape.mediaId ? mediaUrl(ed.deck.media[shape.mediaId]) : undefined;
  if (!url) return;
  const el = existing ?? new Audio(url);
  el.volume = Math.max(0, Math.min(1, (shape.playback?.volume ?? 100) / 100));
  el.loop = !!shape.playback?.loop;
  el.onended = () => ed.setUi({});
  previews.set(shape.id, el);
  void el.play().then(() => ed.setUi({})).catch(() => ed.notify(S3.media.playbackError, 'error'));
}
