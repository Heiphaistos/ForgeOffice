// Modeles de l'accueil : de vrais fichiers generes (HTML pour Texte, CSV pour Tableur, Markdown pour Bloc-notes),
// ouverts par services.openDocument comme n'importe quel fichier. Contenu de document, pas texte d'interface.
import type { AppId, OpenedFile } from '@forgeoffice/core';

export type TemplatePreview = 'letter' | 'report' | 'grid' | 'list';

export interface Template {
  id: string;
  app: AppId;
  label: string;
  preview: TemplatePreview;
  fileName: string;
  content: () => string;
}

const html = (title: string, body: string): string =>
  `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head><body>\n${body}\n</body></html>\n`;

function today(): string {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'letter', app: 'word', label: 'Lettre', preview: 'letter', fileName: 'Lettre.html',
    content: () => html('Lettre', [
      '<p>Prénom Nom<br>Adresse<br>Code postal Ville</p>',
      '<p style="text-align:right">Destinataire<br>Adresse<br>Code postal Ville</p>',
      `<p style="text-align:right">Fait à Ville, le ${today()}</p>`,
      '<p><strong>Objet :</strong> objet de la lettre</p>',
      '<p>Madame, Monsieur,</p>',
      '<p>Rédigez ici le corps de votre lettre.</p>',
      '<p>Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.</p>',
      '<p>Signature</p>',
    ].join('\n')),
  },
  {
    id: 'minutes', app: 'word', label: 'Compte rendu de réunion', preview: 'report', fileName: 'Compte rendu de réunion.html',
    content: () => html('Compte rendu de réunion', [
      '<h1>Compte rendu de réunion</h1>',
      `<p><strong>Date :</strong> ${today()}<br><strong>Participants :</strong> <br><strong>Rédacteur :</strong> </p>`,
      '<h2>Ordre du jour</h2>', '<ol><li>Point 1</li><li>Point 2</li><li>Questions diverses</li></ol>',
      '<h2>Décisions</h2>', '<ul><li>Décision</li></ul>',
      '<h2>Actions</h2>',
      '<table><thead><tr><th>Action</th><th>Responsable</th><th>Échéance</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr></tbody></table>',
    ].join('\n')),
  },
  {
    id: 'budget', app: 'excel', label: 'Budget mensuel', preview: 'grid', fileName: 'Budget mensuel.csv',
    content: () => [
      'Poste,Prévu,Réel,Écart',
      'Logement,800,800,0',
      'Alimentation,400,0,400',
      'Transport,150,0,150',
      'Énergie,120,0,120',
      'Loisirs,100,0,100',
      'Épargne,200,0,200',
    ].join('\r\n') + '\r\n',
  },
  {
    id: 'planning', app: 'excel', label: 'Planning de la semaine', preview: 'grid', fileName: 'Planning de la semaine.csv',
    content: () => ['Heure,Lundi,Mardi,Mercredi,Jeudi,Vendredi', ...['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((h) => `${h},,,,,`)].join('\r\n') + '\r\n',
  },
  {
    id: 'todo', app: 'notes', label: 'Liste de tâches', preview: 'list', fileName: 'Liste de tâches.md',
    content: () => `# Liste de tâches\n\n_${today()}_\n\n## À faire\n\n- [ ] Première tâche\n- [ ] Deuxième tâche\n\n## Terminé\n\n- [x] Créer la liste\n`,
  },
];

/** Fichier pret a ouvrir pour un modele (UTF-8, BOM pour le CSV afin que les accents survivent partout). */
export function templateFile(t: Template): OpenedFile {
  const text = t.content();
  const bytes = new TextEncoder().encode(t.fileName.endsWith('.csv') ? `\uFEFF${text}` : text);
  return { name: t.fileName, path: null, bytes };
}
