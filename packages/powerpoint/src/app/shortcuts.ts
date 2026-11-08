// Registre unique des raccourcis clavier de la Présentation : la gestion des touches et la liste consultable s'appuient dessus.

export type ShortcutId =
  | 'save' | 'saveAs' | 'undo' | 'redo' | 'open' | 'print' | 'newSlide' | 'find' | 'replace'
  | 'font' | 'link' | 'bold' | 'italic' | 'underline' | 'center' | 'left' | 'right' | 'justify' | 'grow' | 'shrink'
  | 'copyFormat' | 'pasteFormat' | 'startShow' | 'startFromCurrent' | 'presenterShow' | 'shortcuts';

export type ShortcutGroup = 'file' | 'edit' | 'text' | 'show';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ShortcutContext {
  /** Du texte est en edition ou des objets sont selectionnes. */
  hasTarget: boolean;
  /** Du texte est en edition. */
  hasText: boolean;
}

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  /** Notation affichee. */
  keys: string;
  match: (e: KeyLike, ctx: ShortcutContext) => boolean;
}

const ctrl = (e: KeyLike): boolean => e.ctrlKey || e.metaKey;
const k = (e: KeyLike): string => e.key.toLowerCase();
/** Ctrl + lettre, sans Maj ni Alt. */
const plain = (letter: string) => (e: KeyLike): boolean => ctrl(e) && !e.shiftKey && !e.altKey && k(e) === letter;

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'save', group: 'file', keys: 'Ctrl+S', match: plain('s') },
  { id: 'saveAs', group: 'file', keys: 'Ctrl+Maj+S', match: (e) => ctrl(e) && e.shiftKey && k(e) === 's' },
  { id: 'open', group: 'file', keys: 'Ctrl+O', match: plain('o') },
  { id: 'print', group: 'file', keys: 'Ctrl+P', match: plain('p') },
  { id: 'undo', group: 'edit', keys: 'Ctrl+Z', match: plain('z') },
  { id: 'redo', group: 'edit', keys: 'Ctrl+Y ou Ctrl+Maj+Z', match: (e) => ctrl(e) && !e.altKey && (k(e) === 'y' || (e.shiftKey && k(e) === 'z')) },
  { id: 'newSlide', group: 'edit', keys: 'Ctrl+M', match: plain('m') },
  { id: 'find', group: 'edit', keys: 'Ctrl+F', match: plain('f') },
  { id: 'replace', group: 'edit', keys: 'Ctrl+H', match: plain('h') },
  { id: 'link', group: 'edit', keys: 'Ctrl+K', match: (e, c) => c.hasTarget && plain('k')(e) },
  { id: 'copyFormat', group: 'edit', keys: 'Ctrl+Maj+C', match: (e) => ctrl(e) && e.shiftKey && k(e) === 'c' },
  { id: 'pasteFormat', group: 'edit', keys: 'Ctrl+Maj+V', match: (e) => ctrl(e) && e.shiftKey && k(e) === 'v' },
  { id: 'shortcuts', group: 'edit', keys: 'Ctrl+/', match: (e) => ctrl(e) && !e.altKey && e.key === '/' },
  { id: 'font', group: 'text', keys: 'Ctrl+T ou Ctrl+Maj+F', match: (e, c) => c.hasTarget && ctrl(e) && !e.altKey && ((k(e) === 't' && !e.shiftKey) || (k(e) === 'f' && e.shiftKey)) },
  // Ctrl+B partout ; Ctrl+G (Gras en francais) seulement dans un texte : sur un objet il groupe.
  { id: 'bold', group: 'text', keys: 'Ctrl+B ou Ctrl+G', match: (e, c) => ctrl(e) && !e.shiftKey && !e.altKey && ((k(e) === 'b' && c.hasTarget) || (k(e) === 'g' && c.hasText)) },
  { id: 'italic', group: 'text', keys: 'Ctrl+I', match: (e, c) => c.hasTarget && plain('i')(e) },
  { id: 'underline', group: 'text', keys: 'Ctrl+U', match: (e, c) => c.hasTarget && plain('u')(e) },
  { id: 'center', group: 'text', keys: 'Ctrl+E', match: (e, c) => c.hasTarget && plain('e')(e) },
  { id: 'left', group: 'text', keys: 'Ctrl+L', match: (e, c) => c.hasTarget && plain('l')(e) },
  { id: 'right', group: 'text', keys: 'Ctrl+R', match: (e, c) => c.hasTarget && plain('r')(e) },
  { id: 'justify', group: 'text', keys: 'Ctrl+J', match: (e, c) => c.hasTarget && plain('j')(e) },
  { id: 'grow', group: 'text', keys: 'Ctrl+Maj+> ou Ctrl+]', match: (e, c) => c.hasTarget && ctrl(e) && (e.key === ']' || e.key === '>' || (e.shiftKey && e.key === '.')) },
  { id: 'shrink', group: 'text', keys: 'Ctrl+Maj+< ou Ctrl+[', match: (e, c) => c.hasTarget && ctrl(e) && (e.key === '[' || e.key === '<' || (e.shiftKey && e.key === ',')) },
  { id: 'startShow', group: 'show', keys: 'F5', match: (e) => e.key === 'F5' && !e.shiftKey && !e.altKey && !ctrl(e) },
  { id: 'startFromCurrent', group: 'show', keys: 'Maj+F5', match: (e) => e.key === 'F5' && e.shiftKey && !e.altKey },
  { id: 'presenterShow', group: 'show', keys: 'Alt+F5', match: (e) => e.key === 'F5' && e.altKey },
];

/** Raccourci correspondant a la touche pressee (le premier de la liste), selon le contexte. */
export function matchShortcut(e: KeyLike, ctx: ShortcutContext): Shortcut | undefined {
  return SHORTCUTS.find((s) => s.match(e, ctx));
}

/**
 * Raccourcis traites ailleurs (zone de texte, canvas, diaporama) : documentes ici pour la liste consultable.
 * Chaque entree (touches, libelle) est tenue a jour avec le code qui les traite.
 */
export const OTHER_SHORTCUTS: ReadonlyArray<{ group: ShortcutGroup; keys: string; label: string }> = [
  { group: 'edit', keys: 'Suppr', label: 'Supprimer les objets sélectionnés' },
  { group: 'edit', keys: 'Flèches', label: 'Déplacer les objets (Ctrl : pas fin, Maj : agrandir)' },
  { group: 'edit', keys: 'Ctrl+D', label: 'Dupliquer les objets' },
  { group: 'edit', keys: 'Ctrl+A', label: 'Tout sélectionner' },
  { group: 'edit', keys: 'Échap', label: 'Quitter la saisie ou l’outil en cours' },
  { group: 'text', keys: 'Tab', label: 'Insérer une tabulation (début de paragraphe : niveau suivant)' },
  { group: 'text', keys: 'Maj+Tab', label: 'Niveau précédent' },
  { group: 'show', keys: 'Espace, Entrée, N, →', label: 'Diapositive ou effet suivant' },
  { group: 'show', keys: 'P, Retour arrière, ←', label: 'Diapositive précédente' },
  { group: 'show', keys: 'B, W', label: 'Écran noir, écran blanc' },
  { group: 'show', keys: 'Ctrl+P, Ctrl+I, Ctrl+L, Ctrl+A', label: 'Stylet, surligneur, pointeur laser, flèche' },
  { group: 'show', keys: 'G', label: 'Afficher toutes les diapositives' },
  { group: 'show', keys: 'Échap', label: 'Arrêter le diaporama' },
];
