// Analyseur HTML tolerant, sans DOM (tests sous Node) : arbre leger, entites, balises implicites.
// Le contenu de script/style/template est ignore ; aucun code n'est jamais execute.

export interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

export type HtmlNode = HtmlElement | string;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'svg', 'math', 'textarea', 'title', 'xmp']);
const BLOCK_CLOSES_P = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'pre', 'hr', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'figure', 'dl', 'address', 'form', 'fieldset', 'main']);

const NAMED: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·',
  euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', deg: '°', plusmn: '±', times: '×', divide: '÷',
  frac12: '½', frac14: '¼', frac34: '¾', sup2: '²', sup3: '³', micro: 'µ', iexcl: '¡', iquest: '¿', shy: '­',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è',
  eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò',
  oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø', oelig: 'œ', ugrave: 'ù', uacute: 'ú', ucirc: 'û',
  uuml: 'ü', yacute: 'ý', yuml: 'ÿ', szlig: 'ß', Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Auml: 'Ä', Ccedil: 'Ç',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Icirc: 'Î', Iuml: 'Ï', Ocirc: 'Ô', Ouml: 'Ö', OElig: 'Œ',
  Ugrave: 'Ù', Ucirc: 'Û', Uuml: 'Ü', Yuml: 'Ÿ', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', check: '✓',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwj: '‍', zwnj: '‌', alpha: 'α', beta: 'β', pi: 'π', infin: '∞',
  ne: '≠', le: '≤', ge: '≥', minus: '−', radic: '√', sum: '∑',
};

export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g, (whole, ref: string) => {
    if (ref.startsWith('#x') || ref.startsWith('#X')) return codePoint(Number.parseInt(ref.slice(2), 16), whole);
    if (ref.startsWith('#')) return codePoint(Number.parseInt(ref.slice(1), 10), whole);
    return NAMED[ref] ?? whole;
  });
}

function codePoint(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return fallback === '&#0;' ? '' : '�';
  if (code >= 0x80 && code <= 0x9f) return new TextDecoder('windows-1252').decode(new Uint8Array([code]));
  return String.fromCodePoint(code);
}

const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Analyse un document ou fragment HTML. Renvoie une racine virtuelle « #root ». */
export function parseHtml(source: string, maxDepth = 256): HtmlElement {
  const root: HtmlElement = { tag: '#root', attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const top = (): HtmlElement => stack[stack.length - 1] ?? root;
  const closeTo = (tag: string): boolean => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i]?.tag === tag) {
        stack.length = i;
        return true;
      }
      // Ne pas traverser une limite de tableau / liste pour fermer un element implicite.
      const t = stack[i]?.tag;
      if ((tag === 'li' && (t === 'ul' || t === 'ol')) || ((tag === 'td' || tag === 'th' || tag === 'tr') && t === 'table')) return false;
    }
    return false;
  };
  let pos = 0;
  const text = source;
  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt < 0) {
      top().children.push(decodeHtmlEntities(text.slice(pos)));
      break;
    }
    if (lt > pos) top().children.push(decodeHtmlEntities(text.slice(pos, lt)));
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      pos = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<!', lt) || text.startsWith('<?', lt)) {
      const end = text.indexOf('>', lt);
      pos = end < 0 ? text.length : end + 1;
      continue;
    }
    const end = text.indexOf('>', lt);
    if (end < 0) {
      top().children.push(decodeHtmlEntities(text.slice(lt)));
      break;
    }
    const raw = text.slice(lt + 1, end);
    pos = end + 1;
    if (raw.startsWith('/')) {
      const tag = raw.slice(1).trim().toLowerCase().split(/\s/)[0] ?? '';
      if (tag === 'p' && !stack.some((e) => e.tag === 'p')) {
        top().children.push({ tag: 'p', attrs: {}, children: [] });
        continue;
      }
      closeTo(tag);
      continue;
    }
    const nameMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9:-]*)/);
    if (!nameMatch) {
      top().children.push(decodeHtmlEntities(`<${raw}>`));
      continue;
    }
    const tag = (nameMatch[1] ?? '').toLowerCase();
    const attrs: Record<string, string> = {};
    for (const m of raw.slice(nameMatch[0].length).matchAll(ATTR_RE)) {
      const key = (m[1] ?? '').toLowerCase();
      if (key && !(key in attrs)) attrs[key] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
    }
    if (RAW.has(tag)) {
      const close = text.toLowerCase().indexOf(`</${tag}`, pos);
      const inner = close < 0 ? '' : text.slice(pos, close);
      const closeEnd = close < 0 ? -1 : text.indexOf('>', close);
      pos = closeEnd < 0 ? text.length : closeEnd + 1;
      if (tag === 'title' || tag === 'textarea') top().children.push({ tag, attrs, children: [decodeHtmlEntities(inner)] });
      continue;
    }
    // Fermetures implicites.
    if (BLOCK_CLOSES_P.has(tag) && stack.some((e) => e.tag === 'p')) closeTo('p');
    if (tag === 'li') closeTo('li');
    if (tag === 'td' || tag === 'th') { closeTo('td') || closeTo('th'); }
    if (tag === 'tr') closeTo('tr');
    if (tag === 'option') closeTo('option');
    if (tag === 'dt' || tag === 'dd') { closeTo('dt') || closeTo('dd'); }
    const element: HtmlElement = { tag, attrs, children: [] };
    top().children.push(element);
    if (!VOID.has(tag) && !raw.endsWith('/') && stack.length < maxDepth) stack.push(element);
  }
  return root;
}

export function findFirst(root: HtmlElement, tag: string): HtmlElement | undefined {
  for (const node of root.children) {
    if (typeof node === 'string') continue;
    if (node.tag === tag) return node;
    const found = findFirst(node, tag);
    if (found) return found;
  }
  return undefined;
}

export function htmlText(node: HtmlNode): string {
  return typeof node === 'string' ? node : node.children.map(htmlText).join('');
}

/** Declarations CSS en ligne (« color: red; font-weight: bold »). */
export function parseStyleAttr(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const key = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).replace(/!important/i, '').trim();
    if (key && value) out[key] = value;
  }
  return out;
}
