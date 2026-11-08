// Tabulations a taquets personnalises (gauche, centre, droite, decimal) : la largeur de chaque tabulation est mesuree dans le DOM.
import type { ParagraphProps } from '@forgeoffice/pptx';

export type TabAlign = 'l' | 'ctr' | 'r' | 'dec';

/** Vrai si le paragraphe a des taquets que `tab-size` (intervalle regulier) ne sait pas rendre. */
export function needsTabLayout(p: ParagraphProps): boolean {
  const tabs = p.tabs ?? [];
  return tabs.some((t) => t.align !== 'l') || tabs.length > 1;
}

/** Decoupe un texte aux tabulations : chaque tabulation devient un morceau a part. */
export function splitAtTabs(text: string): Array<{ text: string; tab: boolean }> {
  const out: Array<{ text: string; tab: boolean }> = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\t') {
      if (cur) out.push({ text: cur, tab: false });
      out.push({ text: ch, tab: true });
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push({ text: cur, tab: false });
  return out;
}

export interface Stop {
  /** Position depuis le bord gauche du contenu du paragraphe (points). */
  pos: number;
  align: TabAlign;
}

/** Premier taquet strictement apres `x` ; sinon prochain multiple de l'intervalle par defaut (aligne a gauche). */
export function pickStop(stops: readonly Stop[], x: number, defaultTab: number): Stop {
  const next = [...stops].sort((a, b) => a.pos - b.pos).find((s) => s.pos > x + 0.5);
  if (next) return next;
  const step = defaultTab > 0 ? defaultTab : 72;
  return { pos: (Math.floor(x / step) + 1) * step, align: 'l' };
}

/**
 * Largeur de la tabulation : `x` = debut de la tabulation, `seg` = largeur du texte qui suit jusqu'a la tabulation suivante,
 * `beforeDecimal` = part de ce texte placee avant la virgule (ou le point).
 */
export function tabWidth(stop: Stop, x: number, seg: number, beforeDecimal: number): number {
  const anchor = stop.align === 'l' ? 0 : stop.align === 'ctr' ? seg / 2 : stop.align === 'r' ? seg : beforeDecimal;
  return Math.max(0, stop.pos - x - anchor);
}

/** Largeur (px) du texte entre deux noeuds, et de la partie avant la premiere virgule ou le premier point. */
function measureSegment(para: HTMLElement, tab: HTMLElement, scale: number): { seg: number; dec: number } {
  const kids = Array.from(para.childNodes);
  const from = kids.indexOf(tab) + 1;
  let to = kids.length;
  for (let i = from; i < kids.length; i++) {
    const k = kids[i];
    if (k instanceof HTMLElement && k.hasAttribute('data-tab')) {
      to = i;
      break;
    }
  }
  const nodes = kids.slice(from, to).filter((k) => !(k instanceof HTMLElement && k.hasAttribute('data-end')));
  if (!nodes.length) return { seg: 0, dec: 0 };
  const range = document.createRange();
  range.setStartBefore(nodes[0] as Node);
  range.setEndAfter(nodes[nodes.length - 1] as Node);
  const total = range.getBoundingClientRect();
  let dec = total.width / scale;
  for (const n of nodes) {
    const text = n.firstChild;
    if (!(text instanceof Text)) continue;
    const idx = text.data.search(/[.,]/);
    if (idx < 0) continue;
    const r = document.createRange();
    r.setStartBefore(nodes[0] as Node);
    r.setEnd(text, idx);
    dec = r.getBoundingClientRect().width / scale;
    break;
  }
  return { seg: total.width / scale, dec };
}

/** Pose la largeur de chaque tabulation des paragraphes marques `data-tabs` sous `root`. */
export function layoutTabs(root: HTMLElement): void {
  for (const para of Array.from(root.querySelectorAll<HTMLElement>('[data-tabs]'))) {
    const stops = (JSON.parse(para.getAttribute('data-tabs') ?? '[]') as Stop[]);
    const defaultTab = Number(para.getAttribute('data-deftab') ?? 72);
    const tabs = Array.from(para.querySelectorAll<HTMLElement>(':scope > [data-tab]'));
    for (const t of tabs) t.style.width = '0px';
    const box = para.getBoundingClientRect();
    const scale = para.offsetWidth ? box.width / para.offsetWidth : 1;
    const origin = box.left + parseFloat(getComputedStyle(para).paddingLeft) * scale;
    for (const tab of tabs) {
      const x = (tab.getBoundingClientRect().left - origin) / scale;
      const stop = pickStop(stops, x, defaultTab);
      const { seg, dec } = measureSegment(para, tab, scale);
      tab.style.width = `${tabWidth(stop, x, seg, dec)}px`;
    }
  }
}
