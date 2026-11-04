// Statistiques du document.

export interface TextStats {
  lines: number;
  words: number;
  chars: number;
  charsNoSpaces: number;
  paragraphs: number;
  utf8Bytes: number;
  readingMinutes: number;
}

export function textStats(text: string): TextStats {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
  return {
    lines: text === '' ? 1 : text.split('\n').length,
    words,
    chars: [...text].length,
    charsNoSpaces: [...text.replace(/\s/g, '')].length,
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim() !== '').length,
    utf8Bytes: new TextEncoder().encode(text).length,
    readingMinutes: Math.max(1, Math.round(words / 220)),
  };
}
