// Arbre SVG neutre (graphiques) vers elements React.
import { createElement, type ReactNode } from 'react';
import type { SvgNode } from '../chart/index.ts';

const camel = (name: string): string => (name.startsWith('data-') || name.startsWith('aria-') ? name : name.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase()));

export function svgNodeToReact(node: SvgNode | string, key?: number): ReactNode {
  if (typeof node === 'string') return node;
  const props: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(node.attrs)) {
    if (/^on/i.test(name)) continue;
    props[name === 'class' ? 'className' : name === 'xlink:href' ? 'href' : camel(name)] = value;
  }
  if (key !== undefined) props.key = key;
  return createElement(node.tag, props, ...node.children.map((c, i) => svgNodeToReact(c, i)));
}
