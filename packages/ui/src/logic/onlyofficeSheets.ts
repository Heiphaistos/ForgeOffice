// Onglets du Tableur, de la Présentation et du PDF dans le profil OnlyOffice : groupes, ordre et tailles relevés sur OnlyOffice Desktop Editors 10.0
// (docs/captures/onlyoffice-ref/10.0/*-onglets-sombre.png). Libellés français d'OnlyOffice ; bouton absent chez nous = bouton grisé.
import type { IconName } from '../icons/generated.ts';
import type { OoGroupSpec } from './onlyofficeLayout.ts';

const L = 'large' as const;
const ph = (label: string, icon: IconName = 'document', size?: 'large' | 'small', caption?: boolean) => ({ ph: label, icon, size, caption });
const chk = (label: string, checked = true) => ph(label, checked ? 'checkbox_checked' : 'checkbox_unchecked', 'small', true);
const big = (id: string, label?: string) => ({ id, label, size: L });
const CLIP = { id: 'clip', slots: ['copy', 'paste', 'cut', 'painter'] } as const;

/** Onglets « Modules complémentaires » et « Outils IA » d'OnlyOffice (modules tiers et IA : boutons présents mais grisés, la suite n'en a pas). */
export const OO_PLUGINS_GROUPS: readonly OoGroupSpec[] = [
  { id: 'plug-mgr', slots: [ph('Gestionnaire de Plugins', 'puzzle_piece'), ph("Modules complémentaires d'arrière-plan", 'puzzle_piece')] },
  { id: 'plug-list', slots: [ph('Photo Editor', 'image_edit'), ph('YouTube', 'video'), ph('Traducteur', 'translate'), ph('Envoyer', 'mail'), ph('Thésaurus', 'book_open'), ph('Code en surbrillance', 'code')] },
];
export const OO_AI_GROUPS: readonly OoGroupSpec[] = [
  { id: 'ai-settings', slots: [ph('Paramètres', 'settings')] },
  { id: 'ai-tools', slots: [ph('Chat IA', 'chat'), ph('Résumer', 'text_quote'), ph('Traduire', 'translate')] },
];

export const EXCEL_LAYOUT: Readonly<Record<string, readonly OoGroupSpec[]>> = {
  plugins: OO_PLUGINS_GROUPS,
  ai: OO_AI_GROUPS,
  home: [
    CLIP,
    { id: 'font', slots: [['fontname', 'fontsize', 'grow', 'shrink'], ['bold', 'italic', 'underline', 'borders', 'fill', 'fontcolor']] },
    { id: 'align', slots: [['top', 'middle', 'bottom', 'wrap', 'orient'], ['left', 'center', 'right', 'indDec', 'indInc', 'merge']] },
    { id: 'sum', slots: [['autosum', 'fillm'], ['clear']] },
    { id: 'sort', slots: [['sortfilter'], ['find']] },
    { id: 'number', slots: [['numfmt'], ['currency', 'percent', 'comma', 'decInc', 'decDec']] },
    { id: 'cells', slots: [['insert', 'delete'], ['cf']] },
    { id: 'fmt', slots: [big('format', 'Format')] },
    { id: 'styles', slots: ['cellStyles'] },
  ],
  insert: [
    { id: 'tables', slots: [big('pivot', 'Tableau croisé dynamique'), big('table', 'Tableau')] },
    { id: 'illus', slots: [big('image', 'Image'), big('shapes', 'Forme'), ph('SmartArt', 'data_treemap')] },
    { id: 'charts', slots: [big('recommended', 'Graphique recommandé'), big('col', 'Graphique'), big('spline', 'Graphique sparkline')] },
    { id: 'links', slots: [big('comment', 'Commentaire'), big('link', 'Lien'), ph('Segment', 'filter')] },
    { id: 'text', slots: [{ ph: 'Zone de texte', icon: 'textbox', use: 'oo-textbox' }, ph('Text Art', 'text_effects'), { ph: 'En-tête/Pied de page', icon: 'document_header_footer', use: 'hf' }] },
    { id: 'symbols', slots: [ph('Équation', 'calculator'), big('symbol', 'Symbole')] },
  ],
  draw: [{ id: 'pens', slots: [ph('Sélectionner', 'edit'), ph('Stylet vert', 'edit'), ph('Stylet rouge', 'edit'), ph('Surligneur', 'edit'), ph('Gomme', 'eraser')] }],
  layout: [
    { id: 'page', slots: [big('margins', 'Marges'), big('page:orient', 'Orientation'), big('page:size', 'Taille'), big('area', "Zone d'impression"), big('breaks', 'Sauts de page'), { ph: 'En-tête/Pied de page', icon: 'document_header_footer', use: 'hf' }, big('fitw', "Mettre à l'échelle"), big('titles', 'Titres à imprimer'), ph('Feuille de droite à gauche', 'document_landscape')] },
    { id: 'print', slots: [[{ id: 'gp', label: 'Imprimer le quadrillage' }], [{ id: 'hp', label: 'Imprimer les en-têtes' }]] },
    { id: 'arrange', slots: [ph("Déplacer vers l'avant", 'layer'), ph("Envoyer vers l'arrière", 'layer'), ph('Aligner', 'align_left'), ph('Groupe', 'group'), ph('Combiner les formes', 'merge')] },
    { id: 'theme', slots: [big('colors', 'Couleurs')] },
  ],
  formulas: [
    { id: 'fn', slots: [big('insfn', 'Fonction'), big('autosum', 'Somme automatique'), big('recent', 'Récemment utilisés'), big('fin', 'Financier'), big('log', 'Logique'), big('txt', 'Texte et données'), big('date', 'Date et heure'), big('look', 'Recherche et référence'), big('math', 'Maths et trigonométrie'), big('more', 'Plus de fonctions')] },
    { id: 'names', slots: [big('mgr', 'Plages nommées')] },
    { id: 'audit', slots: [[{ id: 'prec', label: 'Tracer les précédents', caption: true }, { id: 'rm', label: 'Supprimer les flèches', caption: true }], [{ id: 'dep', label: 'Tracer les dépendants', caption: true }, { id: 'show', label: 'Afficher les formules', caption: true }]] },
    { id: 'watch', slots: [big('watch', 'Fenêtre Espions')] },
    { id: 'calc', slots: [big('opts', 'Calcul')] },
  ],
  data: [
    { id: 'get', slots: [big('csv', 'Obtenir les données'), ph('Liens externes', 'link')] },
    { id: 'sort', slots: [['sort:filter', 'asc'], ['sort:clear', 'desc'], big('sort', 'Tri personnalisé')] },
    { id: 'tools', slots: [big('ttc', 'Texte en colonnes'), big('dup', 'Supprimer les doublons'), big('val', 'Validation des données')] },
    { id: 'whatif', slots: [big('whatif', 'Valeur cible'), ph('Solveur', 'settings')] },
    { id: 'outline', slots: [big('group', 'Grouper'), big('ungroup', 'Dissocier')] },
  ],
  review: [{ id: 'comments', slots: [big('new', 'Ajouter un commentaire'), big('del', 'Supprimer'), ph('Résoudre', 'checkmark')] }],
  'oo-protect': [
    { id: 'enc', slots: [ph('Chiffrer', 'lock_closed', 'large'), ph('Signature', 'signature')] },
    { id: 'prot', slots: [big('pb', 'Protéger le classeur'), big('ps', 'Protéger la feuille de calcul')] },
    { id: 'cell', slots: [[ph('Cellule verrouillée', 'checkbox_checked', 'small'), ph('Formules masquées', 'checkbox_unchecked', 'small')]] },
  ],
  view: [
    // Releve sur OnlyOffice 10.0 (Tableur > Affichage) : gestionnaire de vues, Nouveau/Fermer empiles, 2 vues en icones, echelle, theme, volets, cases.
    { id: 'views', slots: [{ ph: 'Gestionnaire de vues', icon: 'eye', iconOnly: true }, [ph('Nouveau', 'eye', 'small', true), ph('Fermer', 'eye_off', 'small', true)], { id: 'normal', size: L, iconOnly: true }, { id: 'break', size: L, iconOnly: true }] },
    { id: 'zoom', slots: [big('zoom', "Changer l'échelle")] },
    { id: 'theme', slots: [{ ph: "Thème de l'interface", icon: 'dark_theme', iconOnly: true }, { ph: 'Luminosité du document', icon: 'weather_sunny', iconOnly: true }] },
    { id: 'win', slots: [big('freeze', 'Figer les volets')] },
    { id: 'show', slots: [['fbar', 'grid'], ['heads', chk('Afficher les zéros')]] },
    { id: 'bars', slots: [[chk("Toujours afficher la barre d'outils"), chk('Panneau gauche')], [chk("Combiner la barre de la feuille et la barre d'état"), chk('Panneau droit')]] },
  ],
};

export const POWERPOINT_LAYOUT: Readonly<Record<string, readonly OoGroupSpec[]>> = {
  plugins: OO_PLUGINS_GROUPS,
  ai: OO_AI_GROUPS,
  home: [
    CLIP,
    { id: 'slides', slots: [big('slidesGroup', 'Ajouter une diapositive')] },
    { id: 'font', slots: [['font', 'size', 'grow', 'shrink', 'case'], ['bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'highlight', 'color', 'clear']] },
    { id: 'para', slots: [['bullets', 'numbering', 'outdent', 'indent', 'lineSpacing'], ['alignLeft', 'alignCenter', 'alignRight', 'justify', 'columns']] },
    { id: 'ins', slots: [big('insert.text:textbox', 'Zone de texte'), big('picture', 'Image')] },
    { id: 'shapes', slots: ['shapes'] },
    { id: 'arrange', slots: [['arrange', 'fill'], ['outline', 'drawing:effects']] },
    { id: 'edit', slots: [['replace', 'find'], ['select']] },
  ],
  insert: [
    { id: 'slides', slots: [big('newSlide', 'Ajouter une diapositive')] },
    { id: 'table', slots: [big('table', 'Tableau')] },
    { id: 'img', slots: [big('picture', 'Image'), 'illustrations:shapes'] },
    { id: 'chart', slots: [big('smartart', 'SmartArt'), big('chart', 'Graphique')] },
    { id: 'links', slots: [big('comment', 'Commentaire'), big('link', 'Lien')] },
    { id: 'text', slots: [big('textbox', 'Zone de texte'), big('wordart', 'Text Art'), big('hf', 'En-tête/Pied de page'), big('date', 'Date et heure'), big('number', 'Numéro de diapositive')] },
    { id: 'sym', slots: [big('equation', 'Équation'), big('symbol', 'Symbole')] },
    { id: 'media', slots: [big('audio', 'Audio'), big('video', 'vidéo')] },
  ],
  draw: [{ id: 'pens', slots: ['tools:select', { id: 'pen-black', label: '', size: L }, { id: 'pen-red', label: '', size: L }, { id: 'highlighter', label: '', size: L }, { id: 'pen-blue', label: '', size: L }, big('eraser', 'Gomme')] }],
  design: [
    { id: 'slides', slots: [big('slidesGroup', 'Ajouter une diapositive')] },
    { id: 'themes', slots: ['themeGallery'] },
    { id: 'colors', slots: [big('colors', 'Couleurs'), big('customize:size', 'Taille de la diapositive')] },
  ],
  transitions: [
    { id: 'gallery', slots: ['transitions', big('gallery:options', 'Options')] },
    { id: 'timing', slots: [['transitions.timing:duration', ph('Aperçu', 'eye', 'small')], ['onClick', 'afterValue']] },
    { id: 'all', slots: [{ id: 'applyAll', label: 'Appliquer à toutes les diapositives', size: 'small' }] },
  ],
  animations: [
    { id: 'effects', slots: ['animation:effects', big('animation:options', 'Options'), big('add', 'Ajouter une animation'), big('animations.preview:preview', 'Aperçu')] },
    { id: 'timing', slots: [['start', 'animations.timing:duration'], ['trigger', 'delay']] },
    { id: 'order', slots: [['earlier'], ['later']] },
    { id: 'pane', slots: [big('pane', 'Volet Animation')] },
  ],
  review: [{ id: 'comments', slots: [big('new', 'Ajouter un commentaire'), big('delete', 'Supprimer'), ph('Résoudre', 'checkmark')] }],
  'oo-protect': [{ id: 'enc', slots: [ph('Chiffrer', 'lock_closed'), ph('Signature', 'signature')] }],
  view: [
    { id: 'views', slots: ['normal', 'views:outline', 'sorter', 'notesPage'] },
    { id: 'zoom', slots: [['zoomMenu', 'fit']] },
    { id: 'theme', slots: [{ ph: "Thème de l'interface", icon: 'dark_theme', iconOnly: true }] },
    { id: 'show', slots: [['notes', 'ruler'], 'grid'] },
    // Cases d'OnlyOffice 10.0 (Presentation > Affichage) : barre d'outils, barre d'etat, panneaux (affichees, sans effet chez nous).
    { id: 'bars', slots: [[chk("Toujours afficher la barre d'outils"), chk('Panneau gauche')], [chk("Barre d'état"), chk('Panneau droit')]] },
  ],
};

/** PDF : OnlyOffice garde « Modifier PDF / Main / Selectionner » a gauche de chaque onglet. */
const PDF_PRE: readonly OoGroupSpec[] = [
  { id: 'clip', slots: [[ph('Copier', 'copy', 'small'), ph('Couper', 'cut', 'small')], [ph('Coller', 'clipboard_paste', 'small'), ph('Tout sélectionner', 'select_all_on', 'small')]] },
  { id: 'edit', slots: [ph('Modifier PDF', 'edit')] },
  { id: 'tools', slots: [{ id: 'tool-hand', label: 'Main', size: L }, { id: 'tool-select', label: 'Sélectionner', size: L }] },
];

export const PDF_LAYOUT: Readonly<Record<string, readonly OoGroupSpec[]>> = {
  plugins: OO_PLUGINS_GROUPS,
  ai: OO_AI_GROUPS,
  home: [
    ...PDF_PRE.slice(0, 1),
    PDF_PRE[1]!,
    PDF_PRE[2]!,
    { id: 'nav', slots: [['page-field'], ['first-page', 'prev', 'next', 'last-page']] },
    { id: 'zoom', slots: [['zoom-list', { id: 'fit-page', label: 'Ajuster à la page', caption: true }], [{ id: 'fit-width', label: 'Ajuster à la largeur', caption: true }]] },
    { id: 'rot', slots: [{ id: 'rot-right', label: 'Faire pivoter la page', size: L }] },
  ],
  comment: [
    ...PDF_PRE,
    { id: 'notes', slots: [{ id: 'annotate:tool-note', label: 'Commentaire', size: L }, { id: 'annotate:tool-freetext', label: 'Commentaire texte', size: L }] },
    { id: 'marks', slots: [['tool-highlight', 'mark-color'], ['tool-underline', 'tool-strike']] },
    { id: 'pens', slots: [{ id: 'tool-ink', label: '', size: L }, ph('Gomme', 'eraser')] },
    { id: 'sign', slots: [{ id: 'signature', label: 'Signature', size: L }, { id: 'stamp', label: 'Tampon', size: L }, { id: 'tool-rect', label: '', size: L }] },
    { id: 'show', slots: [{ id: 'comments-pane', label: 'Afficher les commentaires' }] },
  ],
  review: [
    ...PDF_PRE,
    { id: 'comments', slots: [{ id: 'annotate:tool-note', label: 'Ajouter un commentaire', size: L }, { id: 'clear-items', label: 'Supprimer', size: L }] },
  ],
  view: [
    ...PDF_PRE,
    { id: 'titles', slots: [ph('Titres', 'text_paragraph')] },
    { id: 'zoom', slots: [['zoom-list', { id: 'fit-page', label: 'Ajuster à la page', caption: true }], [{ id: 'fit-width', label: 'Ajuster à la largeur', caption: true }]] },
    { id: 'theme', slots: [ph("Thème de l'interface", 'color_background'), ph('Basculer le fond du document', 'paint_bucket')] },
    { id: 'show', slots: [[ph("Toujours afficher la barre d'outils", 'checkbox_checked', 'small'), ph('Panneau gauche', 'checkbox_checked', 'small')], [ph("Barre d'état", 'checkbox_checked', 'small'), ph('Panneau droit', 'checkbox_checked', 'small')]] },
    { id: 'macros', slots: [ph('Macros', 'code')] },
  ],
};
