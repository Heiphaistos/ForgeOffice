// Document de test du Bloc-notes : texte multi-lignes avec code Markdown, liste, lien interne et doublons.
export async function notesFixture(): Promise<Uint8Array> {
  const text = [
    '# Bloc-notes de conformité',
    '',
    'Bonjour le monde, première ligne de texte.',
    'Ligne en double',
    'Ligne en double',
    '',
    '- point un',
    '- point deux',
    '',
    '```js',
    'function salut() { return "ForgeOffice"; }',
    '```',
    '',
    'Voir [[Idées]] et https://exemple.fr pour la suite.',
    'zèbre',
    'abricot',
    '',
  ].join('\n');
  return new TextEncoder().encode(text);
}
