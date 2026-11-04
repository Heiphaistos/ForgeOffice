// Analyse lexicale RTF : arbre de groupes, mots de controle, texte (\'hh et \uN decodes).

export interface RtfWord {
  kind: 'word';
  word: string;
  param?: number;
}

export interface RtfText {
  kind: 'text';
  text: string;
}

export interface RtfBinary {
  kind: 'bin';
  bytes: Uint8Array;
}

export interface RtfGroup {
  kind: 'group';
  items: RtfNode[];
}

export type RtfNode = RtfWord | RtfText | RtfBinary | RtfGroup;

/** Profondeur maximale d'imbrication des groupes (au-dela, les accolades sont ignorees). */
const MAX_DEPTH = 256;

function decoderFor(codepage: number): TextDecoder {
  try {
    return new TextDecoder(codepage === 65001 ? 'utf-8' : `windows-${codepage}`);
  } catch {
    return new TextDecoder('windows-1252');
  }
}

const isLetter = (c: number): boolean => (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
const isDigit = (c: number): boolean => c >= 48 && c <= 57;
const latin1 = new TextDecoder('latin1');

/** Construit l'arbre RTF. `unbalanced` est vrai si les accolades ne sont pas equilibrees. */
export function tokenize(bytes: Uint8Array): { root: RtfGroup; unbalanced: boolean } {
  const head = latin1.decode(bytes.subarray(0, 512));
  const cp = Number(head.match(/\\ansicpg(\d+)/)?.[1] ?? 1252);
  const decoder = decoderFor(cp);
  const root: RtfGroup = { kind: 'group', items: [] };
  const stack: RtfGroup[] = [root];
  const ucStack: number[] = [1];
  let skipped = 0;
  let unbalanced = false;
  let pendingBytes: number[] = [];
  let text = '';

  const top = (): RtfGroup => stack[stack.length - 1] ?? root;
  const flushBytes = (): void => {
    if (pendingBytes.length) {
      text += decoder.decode(new Uint8Array(pendingBytes));
      pendingBytes = [];
    }
  };
  const flushText = (): void => {
    flushBytes();
    if (text) {
      const items = top().items;
      const last = items[items.length - 1];
      if (last && last.kind === 'text') last.text += text;
      else items.push({ kind: 'text', text });
      text = '';
    }
  };
  const uc = (): number => ucStack[ucStack.length - 1] ?? 1;

  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const c = bytes[i] ?? 0;
    if (c === 0x7b) {
      flushText();
      skipped = 0;
      if (stack.length < MAX_DEPTH) {
        const group: RtfGroup = { kind: 'group', items: [] };
        top().items.push(group);
        stack.push(group);
        ucStack.push(uc());
      }
      i++;
    } else if (c === 0x7d) {
      flushText();
      skipped = 0;
      if (stack.length > 1) {
        stack.pop();
        ucStack.pop();
      } else {
        unbalanced = true;
      }
      i++;
    } else if (c === 0x5c) {
      const next = bytes[i + 1] ?? 0;
      if (isLetter(next)) {
        let j = i + 1;
        while (j < n && isLetter(bytes[j] ?? 0) && j - i < 40) j++;
        const word = latin1.decode(bytes.subarray(i + 1, j));
        let param: number | undefined;
        let k = j;
        if (bytes[k] === 0x2d || isDigit(bytes[k] ?? 0)) {
          const start = k;
          if (bytes[k] === 0x2d) k++;
          while (k < n && isDigit(bytes[k] ?? 0) && k - start < 11) k++;
          const parsed = Number(latin1.decode(bytes.subarray(start, k)));
          if (Number.isFinite(parsed)) param = parsed;
        }
        if (bytes[k] === 0x20) k++;
        i = k;
        if (word === 'u' && param !== undefined) {
          flushBytes();
          text += String.fromCharCode(param < 0 ? param + 65536 : param & 0xffff);
          skipped = uc();
          continue;
        }
        if (word === 'uc' && param !== undefined) {
          ucStack[ucStack.length - 1] = Math.max(0, Math.min(10, param));
          continue;
        }
        if (word === 'bin' && param !== undefined && param > 0) {
          flushText();
          const len = Math.min(param, n - i);
          top().items.push({ kind: 'bin', bytes: bytes.slice(i, i + len) });
          i += len;
          continue;
        }
        flushText();
        skipped = 0;
        top().items.push(param === undefined ? { kind: 'word', word } : { kind: 'word', word, param });
      } else if (next === 0x27) {
        const hex = latin1.decode(bytes.subarray(i + 2, i + 4));
        i += 4;
        if (skipped > 0) {
          skipped--;
          continue;
        }
        const value = Number.parseInt(hex, 16);
        if (Number.isFinite(value)) pendingBytes.push(value);
      } else if (next === 0x0a || next === 0x0d) {
        flushText();
        top().items.push({ kind: 'word', word: 'par' });
        i += 2;
      } else {
        i += 2;
        const symbol = String.fromCharCode(next);
        if (symbol === '\\' || symbol === '{' || symbol === '}') {
          if (skipped > 0) skipped--;
          else {
            flushBytes();
            text += symbol;
          }
        } else {
          flushText();
          top().items.push({ kind: 'word', word: symbol });
        }
      }
    } else if (c === 0x0d || c === 0x0a) {
      i++;
    } else {
      if (skipped > 0) {
        skipped--;
      } else if (c < 0x80) {
        flushBytes();
        text += String.fromCharCode(c);
      } else {
        pendingBytes.push(c);
      }
      i++;
    }
  }
  flushText();
  if (stack.length > 1) unbalanced = true;
  return { root, unbalanced };
}

/** Texte brut d'un groupe (sans les mots de controle). */
export function groupText(group: RtfGroup): string {
  let out = '';
  for (const item of group.items) {
    if (item.kind === 'text') out += item.text;
    else if (item.kind === 'group') out += groupText(item);
  }
  return out;
}

/** Premier mot de controle d'un groupe (destination), en sautant \*. */
export function destinationOf(group: RtfGroup): { word: string | undefined; ignorable: boolean } {
  let ignorable = false;
  for (const item of group.items) {
    if (item.kind === 'word') {
      if (item.word === '*') {
        ignorable = true;
        continue;
      }
      return { word: item.word, ignorable };
    }
    if (item.kind === 'text' && item.text.trim() === '') continue;
    return { word: undefined, ignorable };
  }
  return { word: undefined, ignorable };
}
