// Documents de test riches, fabriques par code avec les paquets de formats. Un fichier par module (fixtures-<module>.ts).
export async function buildFixture(app: string): Promise<Uint8Array> {
  switch (app) {
    case 'word':
      return (await import('./fixtures-word.ts')).wordFixture();
    case 'excel':
      return (await import('./fixtures-excel.ts')).excelFixture();
    case 'powerpoint':
      return (await import('./fixtures-powerpoint.ts')).powerpointFixture();
    case 'publisher':
      return (await import('./fixtures-publisher.ts')).publisherFixture();
    case 'notes':
      return (await import('./fixtures-notes.ts')).notesFixture();
    case 'pdf':
      return (await import('./fixtures-pdf.ts')).pdfFixture();
    case 'convert':
      return (await import('./fixtures-notes.ts')).notesFixture();
    default:
      throw new Error(`pas de document de test pour ${app}`);
  }
}

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

/** Fichiers deposes en plus du document de test (Convertisseur : plusieurs types). */
export async function extraFiles(app: string): Promise<{ name: string; bytes: Uint8Array }[]> {
  if (app !== 'convert') return [];
  const text = (t: string): Uint8Array => new TextEncoder().encode(t);
  return [
    { name: 'tableau.csv', bytes: text(['Produit;Quantité;Prix', 'Pomme;3;1,20', 'Poire;5;2,10', ''].join(String.fromCharCode(10)))},
    { name: 'rapport.docx', bytes: await (await import('./fixtures-word.ts')).wordFixture() },
    { name: 'classeur.xlsx', bytes: await (await import('./fixtures-excel.ts')).excelFixture() },
    { name: 'document.pdf', bytes: await (await import('./fixtures-pdf.ts')).pdfFixture() },
    { name: 'document2.pdf', bytes: await (await import('./fixtures-pdf.ts')).pdfFixture() },
    { name: 'image.png', bytes: PNG },
  ];
}
