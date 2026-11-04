// Arbre SVG neutre (sans DOM) et serialisation XML echappee.
export interface SvgNode {
  tag: string;
  attrs: Record<string, string | number>;
  children: Array<SvgNode | string>;
}

export function el(tag: string, attrs: Record<string, string | number> = {}, children: Array<SvgNode | string> = []): SvgNode {
  return { tag, attrs, children };
}

/** Nombre court (2 decimales) pour les attributs et les chemins. */
export const n2 = (v: number): string => String(Math.round(v * 100) / 100);

const NAME = /^[A-Za-z_][\w:.-]*$/;
// Caracteres interdits en XML 1.0 (controle, non-caracteres, demi-paires de substitution isolees).
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function escapeXml(s: string, attr: boolean): string {
  const t = s.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return attr ? t.replace(/"/g, '&quot;') : t;
}

/** Serialise l'arbre en XML ; les noms invalides et les attributs d'evenement (on*) sont ignores. */
export function svgToString(node: SvgNode): string {
  if (!NAME.test(node.tag)) return '';
  let out = `<${node.tag}`;
  for (const [k, v] of Object.entries(node.attrs)) {
    if (!NAME.test(k) || /^on/i.test(k)) continue;
    out += ` ${k}="${typeof v === 'number' ? n2(v) : escapeXml(v, true)}"`;
  }
  if (node.children.length === 0) return `${out}/>`;
  const inner = node.children.map((c) => (typeof c === 'string' ? escapeXml(c, false) : svgToString(c))).join('');
  return `${out}>${inner}</${node.tag}>`;
}
