// Outils communs des compositions du catalogue (sans DOM).
import type { Deck, Fill, Paragraph, RunProps, Shape, SlideSize } from '@forgeoffice/pptx';
import { addShape, addText, hex, MAJOR, MINOR, para, sc, solid, type Box4, type TextOptions } from '../build.ts';
import type { PubDocument } from '../fopub.ts';
import { defaultSettings, type CompositionKind, type PubSettings } from '../model.ts';
import { createPublication } from '../pubdeck.ts';

export function newDoc(size: SlideSize, pages: number, kind: CompositionKind, patch: Partial<PubSettings> = {}): PubDocument {
  return { deck: createPublication(size, pages), pub: defaultSettings(kind, patch) };
}

export function shapesOf(deck: Deck, index: number): Shape[] {
  const slide = deck.slides[index];
  if (!slide) throw new Error(`Page ${index + 1} absente`);
  return slide.shapes;
}

export const title = (size: number, extra: RunProps = {}): RunProps => ({ font: MAJOR, size, bold: true, color: sc('tx2'), ...extra });
export const body = (size = 11, extra: RunProps = {}): RunProps => ({ font: MINOR, size, color: sc('tx1'), ...extra });

/** Texte de remplacement des compositions. */
export const SAMPLE = {
  short: 'Présentez ici votre activité, votre événement ou votre offre en quelques phrases claires.',
  body: "Cliquez dans ce texte pour le remplacer par le vôtre : la mise en forme est conservée. Racontez ce qui rend votre projet unique, donnez les informations pratiques et invitez vos lecteurs à passer à l'action. Les textes trop longs passent automatiquement dans la zone suivante lorsque les zones sont liées.",
  article:
    "Pour remplacer ce texte, cliquez dessus et commencez à taper. Une lettre d'information est un excellent moyen de garder le contact avec vos clients, vos adhérents ou votre équipe. Présentez les nouveautés, les réussites du mois et les prochains rendez-vous. Pensez à un titre accrocheur, à des paragraphes courts et à une image par article. Les intertitres guident le lecteur et rendent la page plus aérée. Si l'article est long, il continue automatiquement dans une autre zone de texte liée, sur la même page ou plus loin dans la publication. Vous pouvez aussi ajouter un encadré, une citation mise en valeur ou un coupon-réponse depuis l'onglet Insertion.",
};

/** Cadre d'image de remplacement : degrade aux couleurs du theme (remplace par « Changer l'image »). */
export function photo(shapes: Shape[], box: Box4, from: Fill = solid(sc('accent1', [{ name: 'lumMod', val: 40000 }, { name: 'lumOff', val: 60000 }])), name = "Cadre d'image"): number {
  const fill: Fill =
    from.type === 'solid'
      ? { type: 'gradient', kind: 'linear', angle: 45, stops: [{ position: 0, color: from.color }, { position: 100, color: sc('accent1') }] }
      : from;
  const shape = addShape(shapes, box, fill, { name });
  shape.description = name;
  addText(shapes, box, [para('Image', body(10, { color: sc('bg1'), italic: true }), { align: 'ctr' })], {}, { anchor: 'ctr', name: `${name} - légende` });
  return shape.id;
}

export function heading(shapes: Shape[], box: Box4, text: string, size: number, extra: RunProps = {}, align: 'l' | 'ctr' | 'r' = 'l', o: TextOptions = {}): void {
  addText(shapes, box, [para(text, title(size, extra), { align })], {}, o);
}

export function lines(shapes: Shape[], box: Box4, texts: string[], run: RunProps, align: 'l' | 'ctr' | 'r' = 'l', o: TextOptions = {}): void {
  addText(shapes, box, texts.map((t) => para(t, run, { align })), {}, o);
}

export const paragraphs = (texts: string[], run: RunProps, spaceAfter = 6): Paragraph[] => texts.map((t) => para(t, run, { spaceAfter: { type: 'pts', value: spaceAfter } }));

export const WHITE = solid(sc('bg1'));
export const ACCENT = (n: 1 | 2 | 3 | 4 | 5 | 6 = 1): Fill => solid(sc(`accent${n}`));
export const DARK = solid(sc('tx2'));
export const PALE = solid(sc('accent1', [{ name: 'lumMod', val: 20000 }, { name: 'lumOff', val: 80000 }]));
export const GREY = solid(hex('F2F2F2'));
