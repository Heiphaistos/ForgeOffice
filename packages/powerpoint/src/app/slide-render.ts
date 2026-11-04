// Proprietes de rendu d'une diapositive (miniatures, diaporama, impression, export).
import { backgroundShapes, type Deck, type Slide } from '@forgeoffice/pptx';
import { deckPageBackground, deckPageContext } from '../canvas/context.ts';
import type { PageViewProps } from '../canvas/PageView.tsx';

export function slidePageProps(deck: Deck, slide: Slide, index: number, uid: string): PageViewProps {
  const ctx = deckPageContext(deck, slide, { slideNumber: index + (deck.firstSlideNumber ?? 1) });
  return {
    width: deck.size.width,
    height: deck.size.height,
    background: deckPageBackground(deck, slide),
    ctx,
    shapes: slide.shapes,
    underlay: [{ shapes: backgroundShapes(deck, slide), ctx }],
    uid,
  };
}

/** Cache des proprietes par diapositive : une miniature ne se recalcule que si sa diapositive ou le masque changent. */
const cache = new WeakMap<Slide, { masters: Deck['masters']; index: number; size: Deck['size']; media: Deck['media']; props: PageViewProps }>();

export function cachedSlideProps(deck: Deck, slide: Slide, index: number, uid: string): PageViewProps {
  const hit = cache.get(slide);
  if (hit && hit.masters === deck.masters && hit.index === index && hit.size === deck.size && hit.media === deck.media && hit.props.uid === uid) return hit.props;
  const props = slidePageProps(deck, slide, index, uid);
  cache.set(slide, { masters: deck.masters, index, size: deck.size, media: deck.media, props });
  return props;
}
