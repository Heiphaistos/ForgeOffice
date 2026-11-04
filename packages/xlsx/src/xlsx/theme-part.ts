// Theme DrawingML (theme1.xml) : couleurs et polices lues ; XML d'origine reecrit tel quel s'il n'a pas change.
import { parseXml, type XmlElement } from '@forgeoffice/opc';
import { officeTheme } from '../constants.ts';
import type { Theme, ThemeColors, ThemeFonts } from '../model.ts';
import { escAttr, kid, str, walk } from './xml-util.ts';

const COLOR_KEYS: readonly (keyof ThemeColors)[] = [
  'dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink',
];

function readThemeColor(node: XmlElement | undefined, fallback: string): string {
  const srgb = kid(node, 'srgbClr');
  if (srgb) return (str(srgb, 'val') ?? fallback).toUpperCase();
  const sys = kid(node, 'sysClr');
  if (sys) return (str(sys, 'lastClr') ?? (str(sys, 'val') === 'window' ? 'FFFFFF' : '000000')).toUpperCase();
  return fallback;
}

function readFonts(node: XmlElement | undefined, fallback: ThemeFonts): ThemeFonts {
  const fonts: ThemeFonts = { latin: str(kid(node, 'latin'), 'typeface') ?? fallback.latin };
  const ea = str(kid(node, 'ea'), 'typeface');
  if (ea) fonts.eastAsian = ea;
  const cs = str(kid(node, 'cs'), 'typeface');
  if (cs) fonts.complexScript = cs;
  return fonts;
}

export function readTheme(xml: string | undefined): Theme {
  const theme = officeTheme();
  if (!xml) return theme;
  const root = parseXml(xml);
  theme.name = str(root, 'name') ?? theme.name;
  const elements = kid(root, 'themeElements');
  const scheme = kid(elements, 'clrScheme');
  if (scheme) {
    theme.colorSchemeName = str(scheme, 'name') ?? theme.colorSchemeName;
    for (const key of COLOR_KEYS) theme.colors[key] = readThemeColor(kid(scheme, key), theme.colors[key]);
  }
  const fontScheme = kid(elements, 'fontScheme');
  if (fontScheme) {
    theme.fontSchemeName = str(fontScheme, 'name') ?? theme.fontSchemeName;
    theme.majorFont = readFonts(walk(fontScheme, 'majorFont'), theme.majorFont);
    theme.minorFont = readFonts(walk(fontScheme, 'minorFont'), theme.minorFont);
  }
  theme.xml = xml;
  return theme;
}

function sameTheme(a: Theme, b: Theme): boolean {
  const strip = (t: Theme): string => JSON.stringify({ ...t, xml: undefined });
  return strip(a) === strip(b);
}

function colorXml(key: keyof ThemeColors, rgb: string): string {
  if (key === 'dk1' && rgb === '000000') return '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>';
  if (key === 'lt1' && rgb === 'FFFFFF') return '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>';
  return `<a:${key}><a:srgbClr val="${escAttr(rgb)}"/></a:${key}>`;
}

function fontXml(tag: string, fonts: ThemeFonts): string {
  return `<a:${tag}><a:latin typeface="${escAttr(fonts.latin)}"/>`
    + `<a:ea typeface="${escAttr(fonts.eastAsian ?? '')}"/><a:cs typeface="${escAttr(fonts.complexScript ?? '')}"/></a:${tag}>`;
}

const FORMAT_SCHEME = '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  + '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>'
  + '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst>'
  + '<a:lnStyleLst><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>'
  + '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>'
  + '<a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst>'
  + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>'
  + '<a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst>'
  + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>'
  + '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs>'
  + '<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme>';

/** XML du theme : l'original s'il correspond toujours au modele, sinon un theme complet regenere. */
export function writeTheme(theme: Theme): string {
  if (theme.xml && sameTheme(readTheme(theme.xml), theme)) return theme.xml;
  const colors = COLOR_KEYS.map((key) => colorXml(key, theme.colors[key])).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
    + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escAttr(theme.name)}">`
    + `<a:themeElements><a:clrScheme name="${escAttr(theme.colorSchemeName)}">${colors}</a:clrScheme>`
    + `<a:fontScheme name="${escAttr(theme.fontSchemeName)}">${fontXml('majorFont', theme.majorFont)}${fontXml('minorFont', theme.minorFont)}</a:fontScheme>`
    + `${FORMAT_SCHEME}</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}
