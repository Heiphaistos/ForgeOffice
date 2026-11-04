// Outils de texte sans DOM.

/** Minuscule sans accents ni espaces superflus : base des recherches insensibles aux accents. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Note de pertinence d'un texte pour une requete (0 = ne correspond pas). Tous les mots doivent etre presents. */
export function matchScore(text: string, query: string): number {
  const hay = fold(text);
  const words = fold(query).split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  let score = 0;
  for (const word of words) {
    const at = hay.indexOf(word);
    if (at < 0) return 0;
    if (at === 0) score += 4;
    else if (hay[at - 1] === ' ' || hay[at - 1] === '-' || hay[at - 1] === "'") score += 3;
    else score += 1;
  }
  if (hay === fold(query)) score += 10;
  return score;
}
