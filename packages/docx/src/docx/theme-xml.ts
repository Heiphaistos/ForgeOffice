// Theme DrawingML (theme1.xml) : genere depuis le modele, ou theme d'origine mis a jour (couleurs, polices).
import { child, el, parseXml, serializeXml, type XmlElement } from '@forgeoffice/opc';
import type { Theme, ThemeColorName } from '../model.ts';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const ORDER: readonly ThemeColorName[] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function colorSlot(name: ThemeColorName, hex: string): XmlElement {
  if (name === 'dk1') return el('a:dk1', {}, [el('a:sysClr', { val: 'windowText', lastClr: hex })]);
  if (name === 'lt1') return el('a:lt1', {}, [el('a:sysClr', { val: 'window', lastClr: hex })]);
  return el(`a:${name}`, {}, [el('a:srgbClr', { val: hex })]);
}

const fontGroup = (tag: string, latin: string, eastAsia: string | undefined): XmlElement =>
  el(tag, {}, [el('a:latin', { typeface: latin, panose: '020B0004020202020204' }), el('a:ea', { typeface: eastAsia ?? '' }), el('a:cs', { typeface: '' })]);

const phClr = (mods: XmlElement[] = []): XmlElement => el('a:schemeClr', { val: 'phClr' }, mods);
const solid = (mods: XmlElement[] = []): XmlElement => el('a:solidFill', {}, [phClr(mods)]);
const mod = (name: string, val: number): XmlElement => el(`a:${name}`, { val });

function gradient(stops: [number, XmlElement[]][]): XmlElement {
  return el('a:gradFill', { rotWithShape: '1' }, [
    el('a:gsLst', {}, stops.map(([pos, mods]) => el('a:gs', { pos }, [phClr(mods)]))),
    el('a:lin', { ang: 5400000, scaled: '0' }),
  ]);
}

function line(w: number): XmlElement {
  return el('a:ln', { w, cap: 'flat', cmpd: 'sng', algn: 'ctr' }, [solid(), el('a:prstDash', { val: 'solid' }), el('a:miter', { lim: 800000 })]);
}

function formatScheme(): XmlElement {
  const effect = (): XmlElement => el('a:effectStyle', {}, [el('a:effectLst')]);
  return el('a:fmtScheme', { name: 'Office' }, [
    el('a:fillStyleLst', {}, [
      solid(),
      gradient([[0, [mod('lumMod', 110000), mod('satMod', 105000), mod('tint', 67000)]], [50000, [mod('lumMod', 105000), mod('satMod', 103000), mod('tint', 73000)]], [100000, [mod('lumMod', 105000), mod('satMod', 109000), mod('tint', 81000)]]]),
      gradient([[0, [mod('satMod', 103000), mod('lumMod', 102000), mod('tint', 94000)]], [50000, [mod('satMod', 110000), mod('lumMod', 100000), mod('shade', 100000)]], [100000, [mod('lumMod', 99000), mod('satMod', 120000), mod('shade', 78000)]]]),
    ]),
    el('a:lnStyleLst', {}, [line(12700), line(19050), line(25400)]),
    el('a:effectStyleLst', {}, [effect(), effect(), effect()]),
    el('a:bgFillStyleLst', {}, [
      solid(),
      solid([mod('tint', 95000), mod('satMod', 170000)]),
      gradient([[0, [mod('tint', 93000), mod('satMod', 150000), mod('shade', 98000), mod('lumMod', 102000)]], [50000, [mod('tint', 98000), mod('satMod', 130000), mod('shade', 90000), mod('lumMod', 103000)]], [100000, [mod('shade', 63000), mod('satMod', 120000)]]]),
    ]),
  ]);
}

function generated(theme: Theme): XmlElement {
  return el('a:theme', { 'xmlns:a': A, name: theme.name }, [
    el('a:themeElements', {}, [
      el('a:clrScheme', { name: theme.name }, ORDER.map((n) => colorSlot(n, theme.colors[n]))),
      el('a:fontScheme', { name: theme.name }, [
        fontGroup('a:majorFont', theme.majorFont, theme.majorEastAsia),
        fontGroup('a:minorFont', theme.minorFont, theme.minorEastAsia),
      ]),
      formatScheme(),
    ]),
    el('a:objectDefaults'),
    el('a:extraClrSchemeLst'),
  ]);
}

/** Theme d'origine dont couleurs et polices latines sont alignees sur le modele. */
function patched(theme: Theme, rawXml: string): XmlElement | undefined {
  let root: XmlElement;
  try {
    root = parseXml(rawXml);
  } catch {
    return undefined;
  }
  const elements = child(root, 'a:themeElements');
  const scheme = child(elements, 'a:clrScheme');
  const fonts = child(elements, 'a:fontScheme');
  if (!scheme || !fonts) return undefined;
  scheme.children = ORDER.map((n) => colorSlot(n, theme.colors[n]));
  const setLatin = (group: XmlElement | undefined, typeface: string): void => {
    const latin = child(group, 'a:latin');
    if (latin) latin.attrs['typeface'] = typeface;
  };
  setLatin(child(fonts, 'a:majorFont'), theme.majorFont);
  setLatin(child(fonts, 'a:minorFont'), theme.minorFont);
  return root;
}

export function themeXml(theme: Theme): string {
  return serializeXml((theme.rawXml ? patched(theme, theme.rawXml) : undefined) ?? generated(theme));
}
