// Paramètres du diaporama (boîte « Configurer le diaporama ») : type, boucle, sans animation, plage, avancement.
import type { CustomShow, ShowProps, Slide } from '@forgeoffice/pptx';
import { showOrder } from './playback.ts';

export interface ShowSettings {
  /** Presente par un orateur (defaut) ou kiosque (boucle, avance seul aux minutages). */
  mode: 'speaker' | 'kiosk';
  loop: boolean;
  noAnimation: boolean;
  /** Plage de diapositives (numeros a partir de 1) ; 0 = toutes. */
  from: number;
  to: number;
  /** Avancer manuellement : ignore les minutages. */
  manual: boolean;
  /** Diaporama personnalise joue a la place de la plage. */
  customShowId?: number;
}

export const DEFAULT_SHOW: ShowSettings = { mode: 'speaker', loop: false, noAnimation: false, from: 0, to: 0, manual: false };

/** Reglages effectifs : le kiosque boucle toujours et suit les minutages. */
export function effectiveShow(s: ShowSettings): ShowSettings {
  return s.mode === 'kiosk' ? { ...s, loop: true, manual: false } : s;
}

/** Indices des diapositives jouees : celles du diaporama personnalise (ordre et repetitions compris), sinon les visibles de la plage. */
export function showOrderFor(slides: readonly Slide[], s: ShowSettings, customShows: readonly CustomShow[] = []): number[] {
  const custom = s.customShowId === undefined ? undefined : customShows.find((c) => c.id === s.customShowId);
  if (custom) {
    const order = custom.slideIds.map((id) => slides.findIndex((x) => x.id === id)).filter((i) => i >= 0);
    if (order.length) return order;
  }
  const visible = showOrder(slides);
  const from = s.from > 0 ? s.from - 1 : 0;
  const to = s.to > 0 ? s.to - 1 : slides.length - 1;
  const inRange = visible.filter((i) => i >= from && i <= to);
  return inRange.length ? inRange : visible;
}

/** Reglages de l'application depuis les parametres du fichier (p:showPr). */
export function fromShowProps(p: ShowProps | undefined): ShowSettings {
  if (!p) return DEFAULT_SHOW;
  return { mode: p.mode === 'kiosk' ? 'kiosk' : 'speaker', loop: !!p.loop, noAnimation: !!p.noAnimation, from: p.from ?? 0, to: p.to ?? 0, manual: !!p.manual, ...(p.customShowId !== undefined ? { customShowId: p.customShowId } : {}) };
}

/** Parametres du fichier ; undefined quand tout est aux valeurs par defaut (rien a ecrire). */
export function toShowProps(s: ShowSettings): ShowProps | undefined {
  if (s.mode === 'speaker' && !s.loop && !s.noAnimation && !s.manual && !s.from && !s.to && s.customShowId === undefined) return undefined;
  const out: ShowProps = { mode: s.mode };
  if (s.loop || s.mode === 'kiosk') out.loop = true;
  if (s.noAnimation) out.noAnimation = true;
  if (s.manual && s.mode !== 'kiosk') out.manual = true;
  if (s.from) out.from = s.from;
  if (s.to) out.to = s.to;
  if (s.customShowId !== undefined) out.customShowId = s.customShowId;
  return out;
}
