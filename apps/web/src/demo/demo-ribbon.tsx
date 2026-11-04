// Schema du ruban de demonstration (facon Texte / Word) : tous les types de controles du systeme de design.
import type { CSSProperties } from 'react';
import { FONT_SIZE_OPTIONS, nextFontSize, validateFontSize, type GalleryItem, type MenuItem, type RibbonTab, type ThemeChoice } from '@forgeoffice/ui';

export interface DemoState {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string | null;
  highlight: string | null;
  align: 'left' | 'center' | 'right' | 'justify';
  style: string;
  ruler: boolean;
  grid: boolean;
  navPane: boolean;
  spaceBefore: number;
  tableSelected: boolean;
  theme: ThemeChoice;
}

export const INITIAL_STATE: DemoState = {
  font: 'Aptos', size: 11, bold: false, italic: false, underline: false, strike: false, color: null, highlight: null,
  align: 'left', style: 'normal', ruler: true, grid: false, navPane: false, spaceBefore: 0, tableSelected: true, theme: 'light',
};

export const STYLE_PRESETS: Readonly<Record<string, { label: string; css: CSSProperties }>> = {
  normal: { label: 'Normal', css: { fontSize: 15 } },
  nospace: { label: 'Sans interligne', css: { fontSize: 15, lineHeight: 1 } },
  h1: { label: 'Titre 1', css: { fontSize: 22, color: '#0F4761', fontFamily: '"Aptos Display", var(--fo-font)' } },
  h2: { label: 'Titre 2', css: { fontSize: 18, color: '#0F4761', fontFamily: '"Aptos Display", var(--fo-font)' } },
  title: { label: 'Titre', css: { fontSize: 30, letterSpacing: '-0.5px', fontFamily: '"Aptos Display", var(--fo-font)' } },
  subtitle: { label: 'Sous-titre', css: { fontSize: 16, color: '#595959', letterSpacing: '0.5px' } },
  emphasis: { label: 'Accentuation', css: { fontSize: 15, fontStyle: 'italic', color: '#404040' } },
  quote: { label: 'Citation', css: { fontSize: 15, fontStyle: 'italic', textAlign: 'center', color: '#404040' } },
  strong: { label: 'Élevé', css: { fontSize: 15, fontWeight: 700 } },
};

export interface DemoActions {
  set: (patch: Partial<DemoState>) => void;
  preview: (style: string | null) => void;
  notify: (message: string) => void;
  openDialog: (id: 'font' | 'paragraph' | 'about') => void;
}

const STYLE_ITEMS: GalleryItem[] = Object.entries(STYLE_PRESETS).map(([id, p]) => ({
  id, label: p.label, sample: 'AaBbCcDd', style: { ...p.css, fontSize: Math.min(18, Number(p.css.fontSize ?? 14)) },
}));

/** Onglets complets du ruban de demonstration. */
export function demoTabs(st: DemoState, a: DemoActions): RibbonTab[] {
  const say = (what: string) => () => a.notify(what);
  const pasteItems: MenuItem[] = [
    { id: 'h', kind: 'header', label: 'Options de collage :' },
    { id: 'keep', label: 'Conserver la mise en forme source', icon: 'clipboard_paste', shortcut: 'K', onClick: say('Collage avec mise en forme source') },
    { id: 'merge', label: 'Fusionner la mise en forme', icon: 'paint_brush', shortcut: 'M', onClick: say('Collage fusionné') },
    { id: 'text', label: 'Conserver uniquement le texte', icon: 'text_t', shortcut: 'T', onClick: say('Collage du texte seul') },
    { id: 's', kind: 'separator' },
    { id: 'special', label: 'Collage spécial…', shortcut: 'Ctrl+Alt+V', onClick: say('Collage spécial') },
    { id: 'default', label: 'Définir le collage par défaut…', onClick: say('Options de collage') },
  ];
  const caseItems: MenuItem[] = [
    { id: 'sentence', label: 'Majuscule en début de phrase.', onClick: say('Casse : phrase') },
    { id: 'lower', label: 'minuscules', onClick: say('Casse : minuscules') },
    { id: 'upper', label: 'MAJUSCULES', onClick: say('Casse : majuscules') },
    { id: 'title', label: 'Majuscule En Début De Mot', onClick: say('Casse : titre') },
    { id: 'toggle', label: 'iNVERSER lA cASSE', onClick: say('Casse inversée') },
  ];
  const bulletItems: MenuItem[] = [
    { id: 'h', kind: 'header', label: 'Bibliothèque de puces' },
    { id: 'dot', label: '●  Puce ronde', onClick: say('Puce ronde') },
    { id: 'square', label: '■  Puce carrée', onClick: say('Puce carrée') },
    { id: 'arrow', label: '➤  Flèche', onClick: say('Puce flèche') },
    { id: 'check', label: '✔  Coche', onClick: say('Puce coche') },
    { id: 's', kind: 'separator' },
    { id: 'level', label: 'Changer le niveau de liste', items: [1, 2, 3, 4, 5].map((n) => ({ id: `l${n}`, label: `Niveau ${n}`, onClick: say(`Niveau ${n}`) })) },
    { id: 'define', label: 'Définir une nouvelle puce…', onClick: say('Nouvelle puce') },
  ];
  const spacingItems: MenuItem[] = ['1,0', '1,15', '1,5', '2,0', '2,5', '3,0'].map((v) => ({ id: v, label: v, onClick: say(`Interligne ${v}`) }));

  const home: RibbonTab = {
    id: 'home', label: 'Accueil', keytip: 'L',
    groups: [
      {
        id: 'clipboard', label: 'Presse-papiers', icon: 'clipboard_paste',
        launcher: { label: 'Presse-papiers Office', onClick: say('Volet Presse-papiers') },
        controls: [
          { kind: 'split', id: 'paste', label: 'Coller', icon: 'clipboard_paste', size: 'large', onClick: say('Coller'), items: pasteItems, tooltip: { title: 'Coller', shortcut: 'Ctrl+V', description: 'Ajoutez le contenu du Presse-papiers à votre document.' } },
          { kind: 'button', id: 'cut', label: 'Couper', icon: 'cut', onClick: say('Couper'), tooltip: { title: 'Couper', shortcut: 'Ctrl+X', description: 'Supprimez la sélection et placez-la dans le Presse-papiers.' } },
          { kind: 'button', id: 'copy', label: 'Copier', icon: 'copy', onClick: say('Copier'), tooltip: { title: 'Copier', shortcut: 'Ctrl+C' } },
          { kind: 'button', id: 'painter', label: 'Reproduire la mise en forme', icon: 'paint_brush', iconOnly: false, onClick: say('Reproduire la mise en forme'), tooltip: { title: 'Reproduire la mise en forme', shortcut: 'Ctrl+Maj+C', description: 'Appliquez la même apparence à un autre contenu.' } },
        ],
      },
      {
        id: 'font', label: 'Police', icon: 'text_font',
        launcher: { label: 'Paramètres de police', onClick: () => a.openDialog('font') },
        controls: [
          { kind: 'row', id: 'font-row1', controls: [
            { kind: 'font', id: 'fontname', label: 'Police', value: st.font, width: 136, onChange: (font) => a.set({ font }), tooltip: { title: 'Police', shortcut: 'Ctrl+Maj+F', description: 'Choisissez une nouvelle police pour le texte.' } },
            { kind: 'combo', id: 'fontsize', label: 'Taille de police', value: String(st.size), options: FONT_SIZE_OPTIONS, editable: true, width: 52, validate: validateFontSize, onChange: (v) => a.set({ size: Number(v) }), tooltip: { title: 'Taille de police', shortcut: 'Ctrl+Maj+P' } },
            { kind: 'button', id: 'grow', label: 'Augmenter la taille de police', icon: 'text_font_size', iconOnly: true, onClick: () => a.set({ size: nextFontSize(st.size, 1) }), tooltip: { title: 'Augmenter la taille de police', shortcut: 'Ctrl+>' } },
            { kind: 'button', id: 'shrink', label: 'Réduire la taille de police', icon: 'text_font', iconOnly: true, onClick: () => a.set({ size: nextFontSize(st.size, -1) }), tooltip: { title: 'Réduire la taille de police', shortcut: 'Ctrl+<' } },
            { kind: 'menu', id: 'case', label: 'Modifier la casse', icon: 'text_change_case', iconOnly: true, items: caseItems },
            { kind: 'button', id: 'clear', label: 'Effacer toute la mise en forme', icon: 'text_clear_formatting', iconOnly: true, onClick: () => a.set({ bold: false, italic: false, underline: false, strike: false, color: null, highlight: null, style: 'normal' }) },
          ] },
          { kind: 'row', id: 'font-row2', controls: [
            { kind: 'toggle', id: 'bold', label: 'Gras', icon: 'text_bold', iconOnly: true, pressed: st.bold, onToggle: (bold) => a.set({ bold }), tooltip: { title: 'Gras', shortcut: 'Ctrl+G', description: 'Mettez le texte en gras.' } },
            { kind: 'toggle', id: 'italic', label: 'Italique', icon: 'text_italic', iconOnly: true, pressed: st.italic, onToggle: (italic) => a.set({ italic }), tooltip: { title: 'Italique', shortcut: 'Ctrl+I' } },
            { kind: 'toggle', id: 'underline', label: 'Souligné', icon: 'text_underline', iconOnly: true, pressed: st.underline, onToggle: (underline) => a.set({ underline }), tooltip: { title: 'Souligné', shortcut: 'Ctrl+U' } },
            { kind: 'toggle', id: 'strike', label: 'Barré', icon: 'text_strikethrough', iconOnly: true, pressed: st.strike, onToggle: (strike) => a.set({ strike }) },
            { kind: 'button', id: 'sub', label: 'Indice', icon: 'text_subscript', iconOnly: true, onClick: say('Indice'), tooltip: { title: 'Indice', shortcut: 'Ctrl+=' } },
            { kind: 'button', id: 'sup', label: 'Exposant', icon: 'text_superscript', iconOnly: true, onClick: say('Exposant'), tooltip: { title: 'Exposant', shortcut: 'Ctrl+Maj++' } },
            { kind: 'button', id: 'effects', label: 'Effets de texte', icon: 'text_effects', iconOnly: true, onClick: say('Effets de texte') },
            { kind: 'color', id: 'highlight', label: "Couleur de surbrillance du texte", icon: 'highlight', iconOnly: true, value: st.highlight ?? '#FFFF00', emptyMode: 'none', onChange: (highlight) => a.set({ highlight }) },
            { kind: 'color', id: 'fontcolor', label: 'Couleur de police', icon: 'text_color', iconOnly: true, value: st.color ?? '#C00000', onChange: (color) => a.set({ color }) },
          ] },
        ],
      },
      {
        id: 'paragraph', label: 'Paragraphe', icon: 'text_paragraph',
        launcher: { label: 'Paramètres de paragraphe', onClick: () => a.openDialog('paragraph') },
        controls: [
          { kind: 'row', id: 'p-row1', controls: [
            { kind: 'split', id: 'bullets', label: 'Puces', icon: 'text_bullet_list_ltr', iconOnly: true, onClick: say('Puces'), items: bulletItems },
            { kind: 'split', id: 'numbering', label: 'Numérotation', icon: 'text_number_list_ltr', iconOnly: true, onClick: say('Numérotation'), items: [{ id: '1', label: '1. 2. 3.', onClick: say('Numérotation 1.') }, { id: 'a', label: 'a) b) c)', onClick: say('Numérotation a)') }, { id: 'I', label: 'I. II. III.', onClick: say('Numérotation romaine') }] },
            { kind: 'button', id: 'multilevel', label: 'Liste à plusieurs niveaux', icon: 'text_bullet_list_tree', iconOnly: true, onClick: say('Liste à plusieurs niveaux') },
            { kind: 'button', id: 'outdent', label: 'Diminuer le retrait', icon: 'text_indent_decrease_ltr', iconOnly: true, onClick: say('Diminuer le retrait') },
            { kind: 'button', id: 'indent', label: 'Augmenter le retrait', icon: 'text_indent_increase_ltr', iconOnly: true, onClick: say('Augmenter le retrait') },
            { kind: 'button', id: 'sort', label: 'Trier', icon: 'text_sort_ascending', iconOnly: true, onClick: say('Trier') },
            { kind: 'toggle', id: 'marks', label: 'Afficher tout', icon: 'text_paragraph', iconOnly: true, pressed: false, onToggle: say('Marques de paragraphe'), tooltip: { title: 'Afficher tout', shortcut: 'Ctrl+*' } },
          ] },
          { kind: 'row', id: 'p-row2', controls: [
            { kind: 'toggle', id: 'left', label: 'Aligner à gauche', icon: 'text_align_left', iconOnly: true, pressed: st.align === 'left', onToggle: () => a.set({ align: 'left' }), tooltip: { title: 'Aligner à gauche', shortcut: 'Ctrl+Maj+G' } },
            { kind: 'toggle', id: 'center', label: 'Centrer', icon: 'text_align_center', iconOnly: true, pressed: st.align === 'center', onToggle: () => a.set({ align: 'center' }), tooltip: { title: 'Centrer', shortcut: 'Ctrl+E' } },
            { kind: 'toggle', id: 'right', label: 'Aligner à droite', icon: 'text_align_right', iconOnly: true, pressed: st.align === 'right', onToggle: () => a.set({ align: 'right' }), tooltip: { title: 'Aligner à droite', shortcut: 'Ctrl+Maj+D' } },
            { kind: 'toggle', id: 'justify', label: 'Justifier', icon: 'text_align_justify', iconOnly: true, pressed: st.align === 'justify', onToggle: () => a.set({ align: 'justify' }), tooltip: { title: 'Justifier', shortcut: 'Ctrl+J' } },
            { kind: 'menu', id: 'spacing', label: 'Interligne et espacement de paragraphe', icon: 'text_line_spacing', iconOnly: true, items: spacingItems },
            { kind: 'color', id: 'shading', label: 'Trame de fond', icon: 'paint_bucket', iconOnly: true, value: null, emptyMode: 'none', onChange: say('Trame de fond') },
            { kind: 'menu', id: 'borders', label: 'Bordures', icon: 'border_bottom', iconOnly: true, items: [
              { id: 'bottom', label: 'Bordure inférieure', icon: 'border_bottom', onClick: say('Bordure inférieure') },
              { id: 'none', label: 'Aucune bordure', icon: 'border_none', onClick: say('Aucune bordure') },
              { id: 'all', label: 'Toutes les bordures', icon: 'border_all', onClick: say('Toutes les bordures') },
              { id: 'outside', label: 'Bordures extérieures', icon: 'border_outside', onClick: say('Bordures extérieures') },
            ] },
          ] },
        ],
      },
      {
        id: 'styles', label: 'Styles', icon: 'text_header_1',
        launcher: { label: 'Volet Styles', onClick: say('Volet Styles') },
        controls: [
          { kind: 'gallery', id: 'stylegallery', label: 'Styles', icon: 'text_header_1', items: STYLE_ITEMS, selectedId: st.style, itemWidth: 76, columns: 5,
            onSelect: (style) => a.set({ style }), onPreview: (s) => a.preview(s), onPreviewEnd: () => a.preview(null),
            footer: [{ id: 'create', label: 'Créer un style', icon: 'add', onClick: say('Créer un style') }, { id: 'clear', label: 'Effacer la mise en forme', icon: 'text_clear_formatting', onClick: () => a.set({ style: 'normal' }) }, { id: 'apply', label: 'Appliquer les styles…', icon: 'text_description', onClick: say('Appliquer les styles') }] },
        ],
      },
      {
        id: 'editing', label: 'Modification', icon: 'search',
        controls: [
          { kind: 'split', id: 'find', label: 'Rechercher', icon: 'search', onClick: say('Rechercher'), items: [{ id: 'find', label: 'Rechercher', icon: 'search', shortcut: 'Ctrl+F', onClick: say('Rechercher') }, { id: 'adv', label: 'Recherche avancée…', onClick: say('Recherche avancée') }, { id: 'goto', label: 'Atteindre…', shortcut: 'Ctrl+B', onClick: say('Atteindre') }] },
          { kind: 'button', id: 'replace', label: 'Remplacer', icon: 'document_search', onClick: say('Remplacer'), tooltip: { title: 'Remplacer', shortcut: 'Ctrl+H' } },
          { kind: 'menu', id: 'select', label: 'Sélectionner', icon: 'select_all_on', items: [{ id: 'all', label: 'Sélectionner tout', icon: 'select_all_on', shortcut: 'Ctrl+A', onClick: say('Tout sélectionner') }, { id: 'obj', label: 'Sélectionner les objets', onClick: say('Sélection des objets') }] },
        ],
      },
      {
        id: 'voice', label: 'Voix', icon: 'mic',
        controls: [{ kind: 'button', id: 'dictate', label: 'Dicter', icon: 'mic', size: 'large', onClick: say('Dictée') }],
      },
      {
        id: 'assist', label: 'Assistance', icon: 'sparkle',
        controls: [{ kind: 'button', id: 'editor', label: 'Éditeur', icon: 'text_proofing_tools', size: 'large', onClick: say('Éditeur'), tooltip: { title: 'Éditeur', description: 'Vérifiez orthographe, grammaire et style.' } }],
      },
    ],
  };

  const insert: RibbonTab = {
    id: 'insert', label: 'Insertion', keytip: 'N',
    groups: [
      { id: 'pages', label: 'Pages', icon: 'document_one_page', controls: [
        { kind: 'menu', id: 'cover', label: 'Page de garde', icon: 'document_one_page', items: [{ id: 'a', label: 'Austin', onClick: say('Page de garde Austin') }, { id: 'b', label: 'Bandeau', onClick: say('Page de garde Bandeau') }] },
        { kind: 'button', id: 'blank', label: 'Page vierge', icon: 'document_add', onClick: say('Page vierge') },
        { kind: 'button', id: 'break', label: 'Saut de page', icon: 'document_page_break', onClick: say('Saut de page'), tooltip: { title: 'Saut de page', shortcut: 'Ctrl+Entrée' } },
      ] },
      { id: 'tables', label: 'Tableaux', icon: 'table', controls: [{ kind: 'menu', id: 'table', label: 'Tableau', icon: 'table', size: 'large', items: [{ id: 'ins', label: 'Insérer un tableau…', icon: 'table_add', onClick: say('Insérer un tableau') }, { id: 'draw', label: 'Dessiner un tableau', icon: 'pen', onClick: say('Dessiner un tableau') }, { id: 'conv', label: 'Convertir le texte en tableau…', onClick: say('Convertir en tableau') }, { id: 'xl', label: 'Feuille de calcul Tableur', onClick: say('Feuille de calcul') }] }] },
      { id: 'illus', label: 'Illustrations', icon: 'image', controls: [
        { kind: 'menu', id: 'pictures', label: 'Images', icon: 'image', size: 'large', items: [{ id: 'device', label: 'Cet appareil…', icon: 'desktop', onClick: say('Image depuis cet appareil') }, { id: 'stock', label: 'Images de banque…', icon: 'image_add', onClick: say('Images de banque') }] },
        { kind: 'menu', id: 'shapes', label: 'Formes', icon: 'shapes', size: 'large', items: [{ id: 'rect', label: 'Rectangle', onClick: say('Rectangle') }, { id: 'oval', label: 'Ellipse', onClick: say('Ellipse') }, { id: 'arrow', label: 'Flèche', onClick: say('Flèche') }] },
        { kind: 'button', id: 'icons', label: 'Icônes', icon: 'emoji', size: 'large', onClick: say('Icônes') },
        { kind: 'button', id: '3d', label: 'Modèles 3D', icon: 'cube', size: 'large', onClick: say('Modèles 3D') },
        { kind: 'button', id: 'smartart', label: 'SmartArt', icon: 'board', onClick: say('SmartArt') },
        { kind: 'button', id: 'chart', label: 'Graphique', icon: 'data_bar_vertical', onClick: say('Graphique') },
        { kind: 'button', id: 'screenshot', label: "Capture d'écran", icon: 'window_new', onClick: say("Capture d'écran") },
      ] },
      { id: 'media', label: 'Média', icon: 'video', controls: [{ kind: 'button', id: 'video', label: 'Vidéos en ligne', icon: 'video', size: 'large', onClick: say('Vidéo') }] },
      { id: 'links', label: 'Liens', icon: 'link', controls: [
        { kind: 'button', id: 'link', label: 'Lien', icon: 'link', size: 'large', onClick: say('Lien'), tooltip: { title: 'Lien', shortcut: 'Ctrl+K' } },
        { kind: 'button', id: 'bookmark', label: 'Signet', icon: 'bookmark', onClick: say('Signet') },
        { kind: 'button', id: 'xref', label: 'Renvoi', icon: 'link_square', onClick: say('Renvoi') },
      ] },
      { id: 'comments', label: 'Commentaires', icon: 'comment_add', controls: [{ kind: 'button', id: 'comment', label: 'Commentaire', icon: 'comment_add', size: 'large', onClick: say('Commentaire'), tooltip: { title: 'Nouveau commentaire', shortcut: 'Ctrl+Alt+M' } }] },
      { id: 'hf', label: 'En-tête et pied de page', icon: 'document_header_footer', controls: [
        { kind: 'menu', id: 'header', label: 'En-tête', icon: 'document_header', items: [{ id: 'e', label: 'Vide', onClick: say('En-tête vide') }] },
        { kind: 'menu', id: 'footer', label: 'Pied de page', icon: 'document_footer', items: [{ id: 'e', label: 'Vide', onClick: say('Pied de page vide') }] },
        { kind: 'menu', id: 'pagenum', label: 'Numéro de page', icon: 'document_page_number', items: [{ id: 't', label: 'Haut de page', onClick: say('Numéro en haut') }, { id: 'b', label: 'Bas de page', onClick: say('Numéro en bas') }] },
      ] },
      { id: 'text', label: 'Texte', icon: 'textbox', controls: [
        { kind: 'button', id: 'textbox', label: 'Zone de texte', icon: 'textbox', size: 'large', onClick: say('Zone de texte') },
        { kind: 'button', id: 'wordart', label: 'WordArt', icon: 'text_effects', onClick: say('WordArt') },
        { kind: 'button', id: 'dropcap', label: 'Lettrine', icon: 'text_case_title', onClick: say('Lettrine') },
        { kind: 'button', id: 'date', label: 'Date et heure', icon: 'calendar_date', onClick: say('Date et heure') },
      ] },
      { id: 'symbols', label: 'Symboles', icon: 'math_symbols', controls: [
        { kind: 'button', id: 'equation', label: 'Équation', icon: 'math_formula', size: 'large', onClick: say('Équation') },
        { kind: 'button', id: 'symbol', label: 'Symbole', icon: 'symbols', size: 'large', onClick: say('Symbole') },
      ] },
    ],
  };

  const layout: RibbonTab = {
    id: 'layout', label: 'Mise en page', keytip: 'P',
    groups: [
      { id: 'setup', label: 'Mise en page', icon: 'document_margins', launcher: { label: 'Mise en page', onClick: say('Boîte Mise en page') }, controls: [
        { kind: 'menu', id: 'margins', label: 'Marges', icon: 'document_margins', size: 'large', items: [{ id: 'n', label: 'Normales', description: 'Haut : 2,5 cm  Bas : 2,5 cm', onClick: say('Marges normales') }, { id: 'e', label: 'Étroites', description: 'Haut : 1,27 cm  Bas : 1,27 cm', onClick: say('Marges étroites') }] },
        { kind: 'menu', id: 'orient', label: 'Orientation', icon: 'orientation', size: 'large', items: [{ id: 'p', label: 'Portrait', onClick: say('Portrait') }, { id: 'l', label: 'Paysage', onClick: say('Paysage') }] },
        { kind: 'menu', id: 'size', label: 'Taille', icon: 'document', size: 'large', items: [{ id: 'a4', label: 'A4', description: '21 cm x 29,7 cm', onClick: say('A4') }, { id: 'letter', label: 'Lettre US', onClick: say('Lettre') }] },
        { kind: 'menu', id: 'columns', label: 'Colonnes', icon: 'text_column_two_left', size: 'large', items: [{ id: '1', label: 'Une', onClick: say('Une colonne') }, { id: '2', label: 'Deux', onClick: say('Deux colonnes') }] },
      ] },
      { id: 'para', label: 'Paragraphe', icon: 'text_paragraph', controls: [
        { kind: 'number', id: 'before', label: 'Avant :', value: st.spaceBefore, min: 0, max: 1584, step: 6, unit: 'pt', width: 76, onChange: (spaceBefore) => a.set({ spaceBefore }) },
        { kind: 'number', id: 'after', label: 'Après :', value: 8, min: 0, max: 1584, step: 6, unit: 'pt', width: 76, onChange: say('Espacement après') },
        { kind: 'number', id: 'indentl', label: 'Gauche :', value: 0, min: -42, max: 55, step: 0.1, unit: 'cm', width: 76, onChange: say('Retrait gauche') },
      ] },
      { id: 'arrange', label: 'Organiser', icon: 'layer', controls: [
        { kind: 'button', id: 'position', label: 'Position', icon: 'position_forward', size: 'large', onClick: say('Position') },
        { kind: 'button', id: 'wrap', label: 'Habillage', icon: 'text_wrap', size: 'large', onClick: say('Habillage') },
        { kind: 'button', id: 'forward', label: 'Avancer', icon: 'position_forward', onClick: say('Avancer') },
        { kind: 'button', id: 'backward', label: 'Reculer', icon: 'position_backward', onClick: say('Reculer') },
        { kind: 'button', id: 'align', label: 'Aligner', icon: 'align_left', onClick: say('Aligner') },
        { kind: 'button', id: 'group', label: 'Grouper', icon: 'group', onClick: say('Grouper') },
        { kind: 'button', id: 'rotate', label: 'Rotation', icon: 'rotate_right', onClick: say('Rotation') },
      ] },
    ],
  };

  const review: RibbonTab = {
    id: 'review', label: 'Révision', keytip: 'R',
    groups: [
      { id: 'proof', label: 'Vérification', icon: 'text_proofing_tools', controls: [
        { kind: 'button', id: 'editor2', label: 'Éditeur', icon: 'text_proofing_tools', size: 'large', onClick: say('Éditeur'), tooltip: { title: 'Éditeur', shortcut: 'F7' } },
        { kind: 'button', id: 'thesaurus', label: 'Dictionnaire des synonymes', icon: 'book_letter', onClick: say('Synonymes'), tooltip: { title: 'Dictionnaire des synonymes', shortcut: 'Maj+F7' } },
        { kind: 'button', id: 'count', label: 'Statistiques', icon: 'text_word_count', onClick: say('Statistiques') },
      ] },
      { id: 'access', label: 'Accessibilité', icon: 'accessibility_checkmark', controls: [{ kind: 'button', id: 'a11y', label: "Vérifier l'accessibilité", icon: 'accessibility_checkmark', size: 'large', onClick: say('Vérification accessibilité') }] },
      { id: 'lang', label: 'Langue', icon: 'translate', controls: [{ kind: 'button', id: 'translate', label: 'Traduire', icon: 'translate', size: 'large', onClick: say('Traduire') }] },
      { id: 'comments', label: 'Commentaires', icon: 'comment_multiple', controls: [
        { kind: 'button', id: 'newc', label: 'Nouveau commentaire', icon: 'comment_add', size: 'large', onClick: say('Nouveau commentaire') },
        { kind: 'button', id: 'delc', label: 'Supprimer', icon: 'delete', onClick: say('Supprimer le commentaire') },
        { kind: 'button', id: 'prevc', label: 'Précédent', icon: 'previous', onClick: say('Commentaire précédent') },
        { kind: 'button', id: 'nextc', label: 'Suivant', icon: 'next', onClick: say('Commentaire suivant') },
      ] },
      { id: 'track', label: 'Suivi', icon: 'document_edit', controls: [
        { kind: 'toggle', id: 'trackc', label: 'Suivi des modifications', icon: 'document_edit', size: 'large', pressed: false, onToggle: say('Suivi des modifications'), tooltip: { title: 'Suivi des modifications', shortcut: 'Ctrl+Maj+E' } },
      ] },
      { id: 'protect', label: 'Protéger', icon: 'lock_closed', controls: [{ kind: 'button', id: 'restrict', label: 'Restreindre la modification', icon: 'document_lock', size: 'large', onClick: say('Restreindre') }] },
    ],
  };

  const view: RibbonTab = {
    id: 'view', label: 'Affichage', keytip: 'A',
    groups: [
      { id: 'views', label: 'Affichages', icon: 'document_one_page', controls: [
        { kind: 'button', id: 'read', label: 'Mode Lecture', icon: 'book_open', size: 'large', onClick: say('Mode Lecture') },
        { kind: 'button', id: 'print', label: 'Page', icon: 'document_one_page', size: 'large', onClick: say('Affichage Page') },
        { kind: 'button', id: 'web', label: 'Web', icon: 'globe', size: 'large', onClick: say('Affichage Web') },
      ] },
      { id: 'show', label: 'Afficher', icon: 'eye', controls: [
        { kind: 'checkbox', id: 'ruler', label: 'Règle', checked: st.ruler, onChange: (ruler) => a.set({ ruler }) },
        { kind: 'checkbox', id: 'grid', label: 'Quadrillage', checked: st.grid, onChange: (grid) => a.set({ grid }) },
        { kind: 'checkbox', id: 'nav', label: 'Volet de navigation', checked: st.navPane, onChange: (navPane) => a.set({ navPane }) },
      ] },
      { id: 'zoom', label: 'Zoom', icon: 'zoom_in', controls: [
        { kind: 'button', id: 'zoomdlg', label: 'Zoom', icon: 'zoom_in', size: 'large', onClick: say('Zoom') },
        { kind: 'button', id: 'z100', label: '100 %', icon: 'zoom_fit', size: 'large', onClick: say('Zoom 100 %') },
      ] },
      { id: 'theme', label: 'Thème', icon: 'dark_theme', controls: [
        { kind: 'toggle', id: 'light', label: 'Clair', icon: 'weather_sunny', pressed: st.theme === 'light', onToggle: () => a.set({ theme: 'light' }) },
        { kind: 'toggle', id: 'dark', label: 'Sombre', icon: 'weather_moon', pressed: st.theme === 'dark', onToggle: () => a.set({ theme: 'dark' }) },
        { kind: 'toggle', id: 'contrast', label: 'Contraste élevé', icon: 'dark_theme', pressed: st.theme === 'contrast', onToggle: () => a.set({ theme: 'contrast' }) },
      ] },
      { id: 'window', label: 'Fenêtre', icon: 'window', controls: [
        { kind: 'button', id: 'newwin', label: 'Nouvelle fenêtre', icon: 'window_new', size: 'large', onClick: say('Nouvelle fenêtre') },
        { kind: 'button', id: 'about', label: 'À propos', icon: 'info', size: 'large', onClick: () => a.openDialog('about') },
      ] },
    ],
  };

  const tableDesign: RibbonTab = {
    id: 'tdesign', label: 'Création de tableau', hidden: !st.tableSelected, contextual: { set: 'Outils de tableau', color: '#C43E1C' },
    groups: [
      { id: 'topts', label: 'Options de style de tableau', icon: 'table_settings', controls: [
        { kind: 'checkbox', id: 'hdr', label: "Ligne d'en-tête", checked: true, onChange: say("Ligne d'en-tête") },
        { kind: 'checkbox', id: 'tot', label: 'Ligne Total', checked: false, onChange: say('Ligne Total') },
        { kind: 'checkbox', id: 'band', label: 'Lignes à bandes', checked: true, onChange: say('Lignes à bandes') },
      ] },
      { id: 'tstyles', label: 'Styles de tableau', icon: 'table', controls: [
        { kind: 'gallery', id: 'tgal', label: 'Styles de tableau', icon: 'table', itemWidth: 64, items: ['Grille', 'Clair', 'Moyen', 'Foncé', 'Accent 1', 'Accent 2'].map((label, i) => ({ id: `t${i}`, label, render: () => <span className="demo-tstyle" style={{ ['--demo-h' as string]: ['#404040', '#9E9E9E', '#156082', '#0E2841', '#E97132', '#196B24'][i] }} /> })), onSelect: say('Style de tableau') },
        { kind: 'color', id: 'tshade', label: 'Trame de fond', icon: 'paint_bucket', size: 'large', value: '#156082', emptyMode: 'none', onChange: say('Trame') },
      ] },
    ],
  };
  const tableLayout: RibbonTab = {
    id: 'tlayout', label: 'Disposition', hidden: !st.tableSelected, contextual: { set: 'Outils de tableau', color: '#C43E1C' },
    groups: [
      { id: 'rows', label: 'Lignes et colonnes', icon: 'table_insert_row', controls: [
        { kind: 'menu', id: 'del', label: 'Supprimer', icon: 'table_delete_row', size: 'large', items: [{ id: 'c', label: 'Supprimer des cellules…', onClick: say('Supprimer des cellules') }, { id: 'r', label: 'Supprimer les lignes', icon: 'table_delete_row', onClick: say('Supprimer lignes') }, { id: 'k', label: 'Supprimer les colonnes', icon: 'table_delete_column', onClick: say('Supprimer colonnes') }] },
        { kind: 'button', id: 'above', label: 'Insérer au-dessus', icon: 'table_insert_row', size: 'large', onClick: say('Insérer au-dessus') },
        { kind: 'button', id: 'below', label: 'Insérer en dessous', icon: 'table_insert_row', onClick: say('Insérer en dessous') },
        { kind: 'button', id: 'lcol', label: 'Insérer à gauche', icon: 'table_insert_column', onClick: say('Insérer à gauche') },
        { kind: 'button', id: 'rcol', label: 'Insérer à droite', icon: 'table_insert_column', onClick: say('Insérer à droite') },
      ] },
      { id: 'merge', label: 'Fusionner', icon: 'table_cells_merge', controls: [
        { kind: 'button', id: 'mergec', label: 'Fusionner les cellules', icon: 'table_cells_merge', onClick: say('Fusionner') },
        { kind: 'button', id: 'splitc', label: 'Fractionner les cellules', icon: 'table_cells_split', onClick: say('Fractionner') },
        { kind: 'button', id: 'splitt', label: 'Fractionner le tableau', icon: 'table_split', onClick: say('Fractionner le tableau') },
      ] },
    ],
  };

  const draw: RibbonTab = {
    id: 'draw', label: 'Dessin', keytip: 'JI',
    groups: [
      { id: 'tools', label: 'Outils de dessin', icon: 'pen', controls: [
        { kind: 'button', id: 'select', label: 'Sélectionner', icon: 'lasso', size: 'large', onClick: say('Sélection') },
        { kind: 'button', id: 'pen', label: 'Stylet', icon: 'pen', size: 'large', onClick: say('Stylet') },
        { kind: 'button', id: 'eraser', label: 'Gomme', icon: 'eraser', size: 'large', onClick: say('Gomme') },
        { kind: 'color', id: 'inkcolor', label: "Couleur d'encre", icon: 'ink_stroke', size: 'large', value: '#C00000', onChange: say("Couleur d'encre") },
      ] },
      { id: 'convert', label: 'Convertir', icon: 'shapes', controls: [{ kind: 'button', id: 'ink2shape', label: 'Encre en forme', icon: 'draw_shape', size: 'large', onClick: say('Encre en forme') }] },
    ],
  };

  return [home, insert, draw, layout, review, view, tableDesign, tableLayout];
}
