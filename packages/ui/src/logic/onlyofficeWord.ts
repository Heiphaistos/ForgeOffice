// Onglets du Texte (Document Editor) dans le profil OnlyOffice : groupes, ordre et tailles relevés sur OnlyOffice Desktop Editors 10.0
// (captures de sa fenêtre, docs/captures/onlyoffice-ref/10.0/word-onglets-sombre.png). Libellés français d'OnlyOffice.
import type { IconName } from '../icons/generated.ts';
import type { OoGroupSpec } from './onlyofficeLayout.ts';
import { OO_AI_GROUPS, OO_PLUGINS_GROUPS } from './onlyofficeSheets.ts';

const L = 'large' as const;
const ph = (label: string, icon: IconName = 'document', size?: 'large' | 'small', caption?: boolean) => ({ ph: label, icon, size, caption });

export const WORD_LAYOUT: Readonly<Record<string, readonly OoGroupSpec[]>> = {
  home: [
    { id: 'clip', slots: ['copy', 'paste', 'cut', 'painter'] },
    {
      id: 'font',
      slots: [
        ['fontname', 'fontsize', 'grow', 'shrink', 'case'],
        ['bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'highlight', 'fontcolor', 'clear'],
      ],
    },
    {
      id: 'para',
      slots: [
        ['bullets', 'numbering', 'multilevel', 'outdent', 'indent', 'spacing', 'sort'],
        ['align-left', 'align-center', 'align-right', 'align-justify', 'marks', 'shading', 'borders'],
      ],
    },
    { id: 'styles', slots: ['styles'] },
    { id: 'edit', slots: [['replace', 'find'], ['select']] },
  ],
  insert: [
    { id: 'pages', slots: [{ id: 'blank', label: 'Page vide', size: L }, { id: 'break', label: 'Sauts', size: L }] },
    { id: 'tables', slots: [{ id: 'table', label: 'Tableau', size: L }] },
    {
      id: 'illus',
      slots: [{ id: 'picture', label: 'Image', size: L }, { id: 'shapes', label: 'Forme', size: L }, ph('SmartArt', 'data_treemap'), ph('Graphique', 'chart_multiple')],
    },
    { id: 'links', slots: [{ id: 'comment', label: 'Commentaire', size: L }, { id: 'link', label: 'Lien', size: L }] },
    { id: 'hf', slots: [{ id: 'header', label: 'En-tête et pied de page', size: L }, { id: 'pagenum', label: 'Numéro de page', size: L }] },
    {
      id: 'text',
      slots: [{ id: 'textbox', label: 'Zone de texte', size: L }, ph('Text Art', 'text_effects'), ph('Lettrine', 'text_t'), { id: 'date', label: 'Date et heure', size: L }, ph("Texte à partir d'un fichier", 'document_text_extract'), { id: 'field', label: 'Champ', size: L }],
    },
    { id: 'symbols', slots: [{ id: 'equation', label: 'Équation', size: L }, { id: 'symbol', label: 'Symbole', size: L }] },
    { id: 'cc', slots: [ph('Contrôles de contenu', 'textbox')] },
  ],
  draw: [
    { id: 'pens', slots: [ph('Sélectionner', 'edit'), { id: 'pen-green', label: '', size: L }, { id: 'pen-red', label: '', size: L }, { id: 'pen-hl', label: '', size: L }, ph('Gomme', 'eraser')] },
  ],
  layout: [
    {
      id: 'page',
      slots: [{ id: 'margins', size: L }, { id: 'orientation', size: L }, { id: 'size', size: L }, { id: 'columns', size: L }, { id: 'breaks', label: 'Sauts', size: L }, { id: 'linenumbers', size: L }, { id: 'hyphen', label: 'Coupure de mots', size: L }],
    },
    { id: 'indent', slots: [['indleft', 'before'], ['indright', 'after']] },
    {
      id: 'arrange',
      slots: [ph('Habillage', 'text_wrap'), ph("Déplacer vers l'avant", 'layer'), ph('Reculer', 'layer'), ph('Aligner', 'align_left'), ph('Grouper', 'group'), ph('Combiner les formes', 'merge')],
    },
    { id: 'bg', slots: [{ id: 'watermark', size: L }, { id: 'pagecolor', size: L }] },
  ],
  references: [
    { id: 'toc', slots: [{ id: 'toc', label: 'Table des matières', size: L }, [{ id: 'addtext', label: 'Ajouter du texte', caption: true }], [{ id: 'updatetoc', label: 'Mettre à jour la table', caption: true }]] },
    { id: 'notes', slots: [{ id: 'footnote', label: 'Note de bas de page', size: L }] },
    { id: 'links', slots: [{ id: 'insert.links:link', label: 'Lien', size: L }, { id: 'bookmark', label: 'Signet', size: L }] },
    { id: 'caption', slots: [{ id: 'caption', label: 'Légende', size: L }, { id: 'captions:crossref', label: 'Renvoi', size: L }] },
    { id: 'tof', slots: [[ph('Table des figures', 'document_bullet_list', 'small', true)], [ph('Mettre à jour la table', 'arrow_clockwise', 'small', true)]] },
  ],
  review: [
    { id: 'comments', slots: [{ id: 'newcomment', label: 'Ajouter un commentaire', size: L }, ph('Supprimer', 'delete'), ph('Résoudre', 'checkmark')] },
    { id: 'track', slots: [{ id: 'track', label: 'Suivi des modifications', size: L }, { id: 'markup', label: "Mode d'affichage", size: L }] },
    { id: 'changes', slots: [{ id: 'prevch', label: 'Précédente', size: L }, { id: 'nextch', label: 'Suivante', size: L }, { id: 'accept', label: 'Accepter', size: L }, { id: 'reject', label: 'Rejeter', size: L }] },
    { id: 'compare', slots: [{ id: 'compare', label: 'Comparer', size: L }, ph('Combiner', 'merge')] },
  ],
  'oo-protect': [
    { id: 'enc', slots: [{ id: 'protectpw', label: 'Chiffrer', size: L, icon: 'lock_closed' }, ph('Signature', 'signature')] },
    { id: 'prot', slots: [{ id: 'restrict', label: 'Protéger le document', size: L }] },
  ],
  view: [
    { id: 'nav', slots: [{ id: 'nav', label: 'Navigation', size: L }] },
    { id: 'zoom', slots: [['zoom', { id: 'onepage', label: 'Ajuster à la page' }], [{ id: 'z100', label: 'Zoom à 100 %' }, ph('Ajuster à la largeur', 'arrow_autofit_width', 'small')], [{ id: 'multipage', label: 'Plusieurs pages' }]] },
    { id: 'theme', slots: [ph("Thème de l'interface", 'color_background'), ph('Thème du document', 'paint_bucket')] },
    { id: 'show', slots: [[ph("Toujours afficher la barre d'outils", 'checkbox_checked', 'small'), ph('Panneau gauche', 'checkbox_checked', 'small')], [ph("Barre d'état", 'checkbox_checked', 'small'), ph('Panneau droit', 'checkbox_checked', 'small')]] },
    { id: 'rulers', slots: [{ id: 'ruler', label: 'Règles' }] },
  ],
  plugins: OO_PLUGINS_GROUPS,
  ai: OO_AI_GROUPS,
};
