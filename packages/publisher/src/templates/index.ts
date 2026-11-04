// Catalogue des compositions (ecran Nouveau) : toutes sont construites par code.
import type { PubDocument } from '../fopub.ts';
import type { CompositionKind } from '../model.ts';
import { calendar, greetingCard, newsletter, trifold } from './multi.ts';
import { banner, blank, businessCard, businessCards10, certificate, flyer, invitation, labels, menu, poster } from './single.ts';

export interface CatalogEntry {
  kind: CompositionKind;
  build: () => PubDocument;
}

export const CATALOG: readonly CatalogEntry[] = [
  { kind: 'flyer', build: flyer },
  { kind: 'poster', build: poster },
  { kind: 'businessCard', build: businessCard },
  { kind: 'businessCards10', build: businessCards10 },
  { kind: 'greetingCard', build: greetingCard },
  { kind: 'invitation', build: invitation },
  { kind: 'trifold', build: trifold },
  { kind: 'newsletter', build: newsletter },
  { kind: 'menu', build: menu },
  { kind: 'certificate', build: certificate },
  { kind: 'labels', build: labels },
  { kind: 'calendar', build: () => calendar() },
  { kind: 'banner', build: banner },
];

export { blank, type BlankFormat } from './single.ts';
