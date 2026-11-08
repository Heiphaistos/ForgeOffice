// Paramètres du diaporama (p:showPr de presProps.xml) : type, boucle, animations, minutages, plage de diapositives.
import { attr, child, el, isElement, numAttr, type XmlElement } from '@forgeoffice/opc';
import type { ShowProps } from './model.ts';

const flag = (node: XmlElement, name: string): boolean | undefined => {
  const v = attr(node, name);
  return v === undefined ? undefined : v === '1' || v === 'true';
};

/** Lit p:showPr ; undefined si le fichier n'en a pas. */
export function readShowProps(presProps: XmlElement | undefined): ShowProps | undefined {
  const show = child(presProps, 'p:showPr');
  if (!show) return undefined;
  const out: ShowProps = { mode: child(show, 'p:kiosk') ? 'kiosk' : child(show, 'p:browse') ? 'browse' : 'speaker' };
  if (flag(show, 'loop')) out.loop = true;
  if (flag(show, 'showAnimation') === false) out.noAnimation = true;
  if (flag(show, 'useTimings') === false) out.manual = true;
  if (flag(show, 'showNarration') === false) out.noNarration = true;
  const custom = numAttr(child(show, 'p:custShow'), 'id');
  if (custom !== undefined) out.customShowId = custom;
  const range = child(show, 'p:sldRg');
  if (range) {
    const from = numAttr(range, 'st');
    const to = numAttr(range, 'end');
    if (from) out.from = from;
    if (to && to < 9999) out.to = to;
  }
  return out;
}

/** Remplace p:showPr dans une copie de presProps ; les autres enfants (stylos, couleurs recentes, extensions) sont conserves. */
export function applyShowProps(presProps: XmlElement, show: ShowProps): void {
  const old = child(presProps, 'p:showPr');
  const kids: XmlElement[] = [show.mode === 'kiosk' ? el('p:kiosk') : show.mode === 'browse' ? el('p:browse') : el('p:present')];
  kids.push(show.customShowId !== undefined ? el('p:custShow', { id: show.customShowId }) : show.from || show.to ? el('p:sldRg', { st: show.from ?? 1, end: show.to ?? 9999 }) : el('p:sldAll'));
  for (const keep of old?.children ?? []) {
    if (isElement(keep) && keep.name !== 'p:present' && keep.name !== 'p:browse' && keep.name !== 'p:kiosk' && keep.name !== 'p:sldAll' && keep.name !== 'p:sldRg' && keep.name !== 'p:custShow') kids.push(keep);
  }
  const node = el('p:showPr', { loop: show.loop ? '1' : undefined, showNarration: show.noNarration ? '0' : '1', showAnimation: show.noAnimation ? '0' : undefined, useTimings: show.manual ? '0' : undefined }, kids);
  const rest = presProps.children.filter((c) => !(isElement(c) && c.name === 'p:showPr'));
  // Ordre du schema : htmlPubPr, webPr, prnPr, showPr, clrMru, extLst.
  const after = rest.findIndex((c) => isElement(c) && (c.name === 'p:clrMru' || c.name === 'p:extLst'));
  const at = after < 0 ? rest.length : after;
  presProps.children = [...rest.slice(0, at), node, ...rest.slice(at)];
}
