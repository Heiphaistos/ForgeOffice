// Caractères génériques de Word (Rechercher et remplacer) traduits en expressions régulières.
//   ?  un caractère      *  une chaîne      [a-z] [!a-z]  classe      <  début de mot      >  fin de mot
//   @  un ou plusieurs du précédent      {n} {n,} {n,m}  répétitions      (…) groupe et \1 renvoi      \x  caractère littéral
const WORD = '\\p{L}\\p{N}_';
const SYNTAX = /[.*+?^${}()|[\]\\/-]/;

const literal = (c: string): string => (SYNTAX.test(c) ? `\\${c}` : c);

/** Expression régulière (source, à utiliser avec l'indicateur `u`) d'un motif à caractères génériques ; null si le motif est invalide. */
export function wildcardToRegex(pattern: string): string | null {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '\\') {
      const n = pattern[++i];
      if (n === undefined) return null;
      out += /[1-9]/.test(n) ? `\\${n}` : literal(n);
    } else if (c === '?') out += '.';
    else if (c === '*') out += '.*?';
    else if (c === '<') out += `(?<![${WORD}])`;
    else if (c === '>') out += `(?![${WORD}])`;
    else if (c === '@') out += '+';
    else if (c === '[') {
      const end = pattern.indexOf(']', i + 2);
      if (end < 0) return null;
      let body = pattern.slice(i + 1, end);
      const negate = body.startsWith('!');
      if (negate) body = body.slice(1);
      out += `[${negate ? '^' : ''}${body.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')}]`;
      i = end;
    } else if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end < 0 || !/^\{\d+(,\d*)?$/.test(pattern.slice(i, end))) return null;
      out += pattern.slice(i, end + 1);
      i = end;
    } else if (c === '(' || c === ')') out += c;
    else if (c === '^') {
      const n = pattern[i + 1];
      if (n === 't') { out += '\\t'; i++; } else if (n === 's') { out += ' '; i++; } else if (n === '^') { out += '\\^'; i++; } else out += '\\^';
    } else out += literal(c);
  }
  try {
    new RegExp(out, 'u');
    return out;
  } catch {
    return null;
  }
}

/** Remplacement à caractères génériques : \1 .. \9 deviennent des références de groupe, ^& le texte trouvé. */
export function wildcardReplacement(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '\\' && /[1-9]/.test(text[i + 1] ?? '')) out += `$${text[++i]}`;
    else if (c === '\\' && text[i + 1] === '\\') { out += '\\'; i++; } else if (c === '^' && text[i + 1] === '&') { out += '$&'; i++; } else if (c === '$') out += '$$';
    else out += c;
  }
  return out;
}
