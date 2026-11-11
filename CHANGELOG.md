# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les numéros suivent `X.Y.Z` ; le tag Git `vX.Y.Z` doit être identique à la version de `package.json`, `apps/desktop/package.json`, `tauri.conf.json` et `Cargo.toml` (vérifié par la release).

## [0.3.3] - 2026-11-11

### Ajouté

- **Disposition OnlyOffice complète** : en plus de l'en-tête coloré par application (bleu Texte, vert Tableur, orange Présentation, rouge PDF...), barre latérale gauche (Rechercher, Commentaires, Navigation) et barre latérale droite avec panneau « Paramètres » qui reprend les groupes du ruban (police, paragraphe, styles, alignement, nombre...). À la sélection d'une image, d'une forme ou d'un tableau, le panneau correspondant s'ouvre tout seul, comme dans OnlyOffice. Mêmes commandes que le ruban (aucune fonction en moins) ; les barres se masquent dans une fenêtre étroite (moins de 900 px). Fonctionne dans tous les modules à ruban.

## [0.3.2] - 2026-11-11

### Corrigé

- **Accueil avec la barre d'onglets** : la colonne des applications ne déborde plus (ni ascenseur, ni libellés coupés) dans une fenêtre peu haute.

### Tests

- Banc de conformité du module Texte régénéré : 610 commandes, 0 défaut, 100 % fonctionnelles (contextes « forme » et « grille de tableau » ajoutés, réglages du stylo de bordure reconnus, document de test enrichi d'une forme flottante).

## [0.3.1] - 2026-11-11

### Corrigé

- **Onglets de documents** : la barre d'onglets affiche maintenant les boutons Réduire, Agrandir et Fermer de la fenêtre quand un onglet autre que l'Accueil est actif (ils manquaient, la fenêtre ne pouvait plus être fermée ni réduite à la souris), et sert de zone de déplacement de la fenêtre.
- Vérifié dans l'application Tauri réelle : onglet isolé, saisie dans l'éditeur, confirmation à la fermeture d'un document modifié, fermeture sans processus restant.

## [0.3.0] - 2026-11-10

### Ajouté

- **Dispositions de l'interface** : 10 présentations au choix pour toute la suite (Texte, Tableur, Présentation, Publication, Notes, PDF, Base, Convertisseur, Accueil) avec exactement les mêmes commandes : Office 2024 (ruban), Office simplifié, OnlyOffice, LibreOffice, OpenOffice, Menus classiques (type Office 2003), Ruban compact, Menus + barre d'outils (type Google Docs), Ruban à sélecteur d'onglets, Tactile. Réglage global dans Fichier > Options, avec exception possible par module, et changement en direct par le menu « Disposition de l'interface » (menu d'options d'affichage du ruban ou barre de menus).
- **Ouverture en onglets** : un nouveau document ou fichier peut s'ouvrir dans un onglet de la même fenêtre, comme un navigateur (Word, Excel, Bloc-notes côte à côte). Deux méthodes au choix dans Fichier > Options : onglet isolé (une page par onglet, sans conflit entre documents) ou onglet dans la même page (plus léger). La fenêtre dédiée reste le comportement par défaut.

## [0.2.5] - 2026-11-08

### Corrigé

- **Linux (Arch)** : le paquet `.pkg.tar.zst` ne répète plus les types MIME dans le fichier `.desktop` (59 entrées dont des doublons, 35 maintenant) et n'installe plus de dossiers d'icônes vides.

## [0.2.4] - 2026-11-08

### Corrigé

- **Word** : « Lire à partir du curseur » ne faisait rien quand le curseur était en fin de document ; la lecture repart maintenant du début.

## [0.2.3] - 2026-11-08

### Ajouté

- **Linux** : paquet Arch Linux (`forgeoffice-X.Y.Z-1-x86_64.pkg.tar.zst`) compilé sous Arch et joint à la release (`pacman -U`).
- **Word** : volet « Lecture à voix haute » (lire depuis le curseur ou la sélection, pause, vitesse, voix) et dictée quand le navigateur l'offre.
- **Tableur** : Fichier > Informations > « Gérer le classeur » : historique des 5 dernières versions du classeur et restauration d'une version.
- **Présentation** : animation par paragraphe (découper / regrouper l'animation d'une zone de texte, lecture paragraphe par paragraphe dans le diaporama).
- **Convertisseur** : diaporama (pptx, odp…) vers PDF vectoriel avec le moteur de la Présentation (texte réel, formes, images, tableaux).
- **Présentation** : galerie d'animations : le survol d'une vignette joue l'effet sur un petit carré ; vue du masque et des dispositions : icône (image, graphique, tableau, média, SmartArt) au centre des espaces réservés de contenu.
- **Présentation** : SmartArt : disposition Cycle en plus de liste, processus et hiérarchie ; onglet contextuel SmartArt (ajouter, supprimer, promouvoir, abaisser, déplacer une forme, changer de disposition, couleurs d'accentuation) et volet Texte qui met le graphique à jour pendant la saisie ; les SmartArt restent des formes groupées (pas de modèle `dgm` OOXML).
- **PDF** : raccourcis d'affichage (Ctrl++/Ctrl+-/Ctrl+0/1/2, Ctrl+molette, Début/Fin, F3 et Maj+F3 entre les résultats), « Aller à la page » (Ctrl+Maj+N), mode lecture (Ctrl+H), vue précédente et suivante (Alt+flèches).
- **PDF** : boîte Imprimer avec choix des pages (tout, page affichée, miniatures sélectionnées, plage) ; question Enregistrer / Ne pas enregistrer / Annuler avant d'ouvrir un autre fichier ou de fermer avec des modifications en attente.
- **PDF** : recherche « Mot entier » ; volet Commentaires filtrable (texte, type, auteur) et triable (page, auteur, type, date).
- **PDF** : Propriétés du document : taille, version, format de page, dates, PDF balisé, langue du document (/Lang) et affichage du titre (DisplayDocTitle) modifiables.
- **PDF** : Protéger > « Caviarder par recherche » (texte libre ou données courantes : e-mail, téléphone, IBAN, carte bancaire, numéro de sécurité sociale, date, avec contrôles de validité) et « Caviarder le texte sélectionné » dans le menu du clic droit ; les zones sont marquées en une seule étape annulable.
- **PDF** : Protéger > « Supprimer les informations masquées » (métadonnées, scripts, fichiers joints, commentaires, signets) : les objets retirés sont aussi effacés des octets du fichier.
- **PDF** : signature visuelle à partir d'une image PNG ou JPEG (fond blanc rendu transparent).
- **PDF** : « Combiner des fichiers » : plusieurs PDF d'un coup, ordre réglable (le document ouvert en fait partie), pages comptées avant la fusion.
- **Bloc-notes** : les liens [[note#titre]] sautent au titre (dans l'éditeur et dans l'aperçu) ; avis si le titre n'existe pas.
- **Bloc-notes** : panneau Rechercher / Remplacer maison : modes Normal, Étendu (\n \t) et Expression régulière, mot entier, « Dans la sélection » (y compris Tout remplacer) et compteur de résultats.
- **Bloc-notes** : mise en forme Markdown (gras Ctrl+B, italique Ctrl+I, barré, code, lien Ctrl+K, titres 1 à 3, listes à puces, numérotée, de tâches, citation) ; « Étendre la sélection » passe à Alt+Maj+→.
- **Bloc-notes** : onglets épinglables (regroupés à gauche, épargnés par les fermetures groupées), « Fermer les onglets à gauche » et « … non modifiés ».
- **Bloc-notes** : « Plus de lignes » (supprimer les lignes vides, doublons consécutifs, tri par nombre ou par longueur, mélange, numérotation, espaces en début de ligne, insérer une ligne au-dessus ou en dessous) et casses camelCase, PascalCase, snake_case, kebab-case.
- **Bloc-notes** : options (désactivées par défaut) de fermeture automatique des parenthèses et guillemets et de complétion des mots du document.
- **Présentation** : sélecteur de couleur complet (« Autres couleurs… » du volet Format) : spectre saturation/valeur et teinte, valeurs RVB, TSL et hexadécimale, pipette (API EyeDropper quand le navigateur l'offre).
- **Présentation** : « Format de l'élément de graphique » dans le volet Format (zone de graphique, zone de traçage, titre, légende, axes, séries : remplissage, contour, taille, gras et couleur du texte).
- **Présentation** : graphiques : courbes de tendance (linéaire, exponentielle, logarithmique, polynomiale, puissance, moyenne mobile, équation et R² si demandés dans le fichier) tracées au canvas, barres d'erreur (erreur standard, pourcentage, écart type, valeur fixe) tracées avec capuchons ; menu « Ajouter un élément de graphique » ; lues et écrites dans le .pptx (`ChartSeries.errorBars`).
- **Présentation** : registre unique des raccourcis clavier (la gestion des touches et la liste consultable en dérivent) : liste avec recherche (Ctrl+/ ou Options) ; Ctrl+G ne déclenche plus un raccourci avec AltGr ; les info-touches Alt existantes sont vérifiées.
- **Présentation** : Fichier > Options : nom d'utilisateur, affichage à l'ouverture (règle, quadrillage, repères, volets), vérification (orthographe, langue appliquées à la saisie), copie de récupération (délai ou désactivée), diaporama, accès à la liste des raccourcis.
- **Base de données** : feuille de données : menu du clic droit sur un intitulé de colonne (tri, Filtres de texte / numériques / de dates, copier la colonne, largeur du champ, ajuster, masquer, afficher les champs, figer, supprimer) ; largeur réglable en glissant le bord de l'intitulé (double-clic = ajuster) ; largeur, champs masqués, ordre et champs figés mémorisés par objet.
- **Base de données** : feuille de données : réordonner les colonnes en glissant leur intitulé, figer les premiers champs (restent visibles au défilement horizontal), menu du sélecteur de ligne (nouvel enregistrement, copier, supprimer, hauteur de ligne).
- **Base de données** : feuille de données : sélection de plage (Maj+clic, Maj+flèches, sélecteur de ligne, intitulé de colonne, Ctrl+A) et copie en texte tabulé collable dans Excel ou Word.
- **Base de données** : filtres personnalisés (égal, différent, commence par, se termine par, contient, ne contient pas, inférieur, supérieur, entre, vide) avec contrôle de la valeur saisie selon le type du champ.
- **Base de données** : volet de navigation : menu du fond et des en-têtes de groupe (regrouper par type ou liste plate, trier par nom ou date de modification, réduire/développer tous les groupes) et « Masquer dans ce groupe » / « Afficher les objets masqués ».
- **Base de données** : Générateur d'expression (Ctrl+F2 ou clic droit « Générer… ») dans les cellules Champ et Critères de la grille de requête : champs des tables, fonctions réellement prises en charge par le moteur, opérateurs, constantes, contrôle des parenthèses, guillemets, crochets et dates.
- **Convertisseur** : sorties Word avec macros / modèle (docm, dotx, dotm), classeur avec macros / modèle (xlsm, xltx, xltm), présentation avec macros / modèle / diaporama (pptm, potm, ppsm) et OpenDocument (odp) ; entrées ott, dot, xhtml, text, pps, pot.
- **Convertisseur** : classeurs et CSV vers JSON, HTML et Markdown avec les types conservés (nombres, booléens, dates ISO, plusieurs feuilles), et JSON (tableau d'objets ou objet de tableaux) vers Excel, OpenDocument, CSV, TSV, dans le navigateur comme au bureau.
- **Convertisseur** : option « Une feuille par fichier » : un CSV ou TSV par feuille visible du classeur, enregistrés ensemble en ZIP.
- **Convertisseur** : fichiers Word, Excel et PowerPoint protégés par mot de passe : le champ de mot de passe s'affiche dans la liste, la conversion repart seule après saisie, et un mauvais mot de passe est signalé.
- **Convertisseur** : notebooks Jupyter (.ipynb) vers Word, OpenDocument, HTML, Markdown, RTF et texte (cellules Markdown, code en blocs, sorties texte, images PNG/JPEG).
- **Présentation** : audio et vidéo : onglet contextuel « Lecture » (aperçu dans l'éditeur, volume, démarrage au clic ou automatique, boucle, masquer pendant le diaporama), appliqué dans le diaporama (volume, lecture automatique, boucle, masquage) et écrit dans le .pptx (extension ForgeOffice du média : le p:timing standard des médias n'est pas généré).
- **Présentation** : éléments de graphique : titres des axes, axes affichés/masqués, étiquettes de données (valeur, catégorie, les deux, pourcentage) avec leur position, quadrillage principal/secondaire horizontal et vertical.
- **Présentation** : menu du clic droit pendant le diaporama (suivant/précédent, atteindre une diapositive, options du pointeur : flèche, stylet, surligneur, laser, gomme, effacer l'encre ; écran noir/blanc ; arrêter) à la place du recul d'une diapositive.
- **Présentation** : diaporamas personnalisés : boîte de création (diapositives choisies, ordre, répétitions), menu Diaporama > Diaporama personnalisé pour les lire, choix dans « Configurer le diaporama » ; écrits dans le .pptx (p:custShowLst) et relus ; format : `Deck.customShows`.
- **Publication** : champ image du publipostage (Publipostage > Champ image : lie l'image sélectionnée à un champ ; Associer les images (ZIP) ; à la fusion l'image est remplacée par celle dont le nom est la valeur du champ, avertissement pour les images introuvables).
- **Présentation** : les paramètres du diaporama (type, boucle, sans animation, plage, minutages) sont écrits dans le .pptx (p:showPr de presProps.xml) et relus à l'ouverture ; format : `Deck.show`.
- **Publication** : boîte Format, remplissage en dégradé linéaire (deux couleurs, angle, transparence) ou en motif (9 motifs, premier plan et arrière-plan) ; les remplissages d'image ou de dégradé de chemin existants sont conservés.
- **Présentation** : puces image (Puces et numéros > Image > Choisir une image…).
- **Publication** : tons directs (Création de page > Tons directs : nom, couleur d'écran, remplacement CMJN) ; dans le PDF imprimeur en CMJN, les aplats d'un ton direct prennent exactement sa valeur CMJN ; liste des tons utilisés dans le LISEZ-MOI du Pack and Go. Limite : pas de plaque d'encre séparée (le PDF imprimeur est une image).
- **Présentation** : tabulations à taquets centrés, à droite et décimaux (rendu mesuré au canvas, taquets irréguliers compris ; choix de l'alignement dans la boîte Paragraphe).
- **Publication** : zone de travail et pages voisines : « Mettre dans la zone de travail » (objet à gauche de la page, visible mais non imprimé), « Replacer dans la page », « Envoyer à la page précédente / suivante » (menu de l'objet ; une zone liée à un article n'est pas déplacée).
- **Présentation** : masques et dispositions : « Insérer un espace réservé » (contenu, texte, image, graphique, tableau, SmartArt, média : indice libre, nom, boîte centrée, texte d'invite), « Renommer l'espace réservé », bascule « Conserver » de la disposition ; la suppression d'un espace réservé se fait par Suppr.
- **Publication** : fusion de catalogue (Publipostage > Terminer et fusionner > Fusion de catalogue) : les objets sélectionnés forment une cellule répétée en grille (colonnes, lignes, écarts), plusieurs enregistrements par page, le reste de la page est conservé.
- **Présentation** : animations : boîte « Options d'effet » (direction, démarrage, déclencheur, délai, durée, répétition, retour arrière automatique ; Animations > Options d'effet > Plus d'options et menu du volet), « Reproduire l'animation », menu de l'élément du volet Animation (démarrer au clic/avec/après, options, supprimer), catalogue étendu (16 entrées, 16 sorties, 9 trajectoires) et 8 transitions de plus (Losange, Plus, Roue, Secteur, Bandes, Commutateur, Fenêtre, Grande roue).
- **Publication** : styles de texte « basés sur » un autre style (héritage, boucles refusées) et import des styles d'un autre fichier .fopub (même nom remplacé, liens de base conservés) dans le volet Styles.
- **Publication** : indications de suite entre zones liées (« Suite page n » en pied, « Suite de la page n » en tête, option dans Création de page, visibles aussi dans les miniatures et les exports) et bouton « Rompre le lien » (ciseaux) à côté de la flèche de la zone sélectionnée.
- **Présentation** : « Configurer le diaporama… » (onglet Diaporama) : type (orateur ou kiosque), boucle jusqu'à Échap, sans animation ni transition, plage de diapositives, avancement manuel ou aux minutages ; réglages gardés dans l'application (pas encore écrits dans le fichier).
- **Présentation** : « Modifier les points » (menu d'une forme et ruban Format de la forme) : noeuds et poignées de Bézier par-dessus la forme, déplacement des points et des poignées (point lisse/symétrique conservé, Alt = libre), ajout d'un point en cliquant le contour, Suppr, menu du point (angle/lisse/symétrique, ouvrir/fermer le tracé, segment droit/courbe) ; une forme prédéfinie devient une forme libre et son cadre s'ajuste à la sortie.
- **Publication** : boîte Format, onglet Disposition : « Centrer horizontalement / verticalement sur la page ».
- **Présentation** : Fusionner les formes (ruban Format de la forme et menu d'objet avec deux formes ou plus) : Union, Combiner, Intersection, Soustraire ; le résultat est une forme libre qui garde le formatage de la première forme sélectionnée (la fragmentation n'est pas faite).
- **Publication** : onglet « Image » de la boîte Format de l'image (luminosité, contraste, transparence, nuances de gris).
- **Publication** : clic droit dans une zone de texte en saisie : menu complet (presse-papiers, lien, Police, Paragraphe, Format de l'objet, ordre, rotation) ; Maj+clic droit garde le menu orthographique du navigateur.
- **Publication** : clic droit sur un repère de règle : « Supprimer le repère » (un seul), « Position du repère… » (valeur exacte en cm), « Verrouiller les repères ».
- **Publication** : bibliothèque personnelle de blocs (Insertion > Blocs de construction > Ma bibliothèque) : enregistrer la sélection sous un nom, l'insérer dans n'importe quelle publication, la supprimer ; les images ne sont pas enregistrées.
- **Présentation** : « Taille et position… » : échelle de la hauteur et de la largeur en % ; menu des vignettes : « Enregistrer la diapositive en tant qu'image… » (PNG 1920x1080 de la diapositive cliquée).
- **Présentation** : mini-barre flottante enrichie : sur le texte (police, taille, gras/italique/souligné, couleurs, puces, numérotation, alignements, reproduire la mise en forme) elle apparaît dès qu'une sélection est faite, et au clic droit sur une forme (styles, remplissage, contour, effets), une image (styles, rogner, bordure, changer), un tableau (styles, trame, bordures, insertion/suppression) ou un graphique.
- **Publication** : publipostage étendu : champs composés « Bloc d'adresse » (civilité, prénom, nom, adresse, code postal, ville, pays ; lignes vides omises) et « Ligne de salutation », et bouton « Vérifier les erreurs » (champ inconnu, champ en double, valeurs vides par enregistrement).
- **Présentation** : volet Format complet : Remplissage (uni, dégradé avec type/angle/arrêts ajoutables et transparence, image ou texture étirée/mosaïque, motif), Trait (couleur, transparence, épaisseur, tirets, extrémités, jointures, trait composé, flèches de début et de fin), Effets paramétrables (ombre, lueur, réflexion, bords adoucis), Options de texte (remplissage, contour, ombre, lueur du texte).
- **Publication** : Fichier > Exporter > Pack and Go : un ZIP pour l'imprimeur (PDF imprimeur, publication .fopub, images, LISEZ-MOI avec dimensions, fond perdu et polices utilisées).
- **Publication** : Fichier > Exporter > « PDF vectoriel (texte sélectionnable) » (moteur PDF de la Présentation ; texte réel, formes en vecteur ; limites : polices standard du PDF, habillage du texte non reproduit, pas de fonds perdus ni de traits de coupe, le PDF imprimeur reste la référence).
- **Publication** : boîte « Format de la forme / de la zone de texte / de l'image » à onglets (Couleurs et traits avec transparence et tirets, Taille avec rapport verrouillé, Disposition avec position exacte et habillage, Zone de texte avec marges et alignement vertical, Texte de remplacement), ouverte par le menu de l'objet ou le lanceur du groupe Taille.
- **Tableur** : tri par couleur de cellule depuis le menu de filtre d’une colonne (la couleur choisie passe en premier).
- **Présentation** : menu d'un objet : Modifier / Ouvrir / Copier / Supprimer le lien hypertexte (la boîte Lien reprend l'adresse existante), Changer l'image…, Modifier le type de graphique.
- **Tableur** : graphiques à barres : histogramme empilé 100 %, barres empilées et barres empilées 100 % (insertion et « Modifier le type »).
- **Publication** : styles de texte nommés enregistrés dans le fichier (Accueil > Styles > Gérer les styles : créer d'après la sélection, appliquer, mettre à jour, renommer, supprimer) ; ils apparaissent dans la galerie des styles.
- **Présentation** : menu contextuel du texte en édition (Couper, Copier, Coller, Police, Paragraphe, Puces et numéros, Lien) ; le menu natif du navigateur (corrections orthographiques) reste accessible par Maj + clic droit (option de canvas `spell.nativeMenuWithShift`, sans effet sur Publication).
- **Tableur** : graphiques : « Ajouter un élément graphique » (titres d’axes horizontal/vertical, courbe de tendance linéaire tracée), « Modifier le titre » du graphique, titres d’axes affichés dans le rendu.
- **Publication** : bouton Coller avec menu « Coller en texte seul » (à la saisie en cours, ou dans une nouvelle zone avec un paragraphe par ligne).
- **Présentation** : boîte « Puces et numéros… » (menus Puces/Numérotation et menu d'un objet) : symbole (galerie + caractère libre), numérotation, « commencer par », couleur et taille de la puce ; correction : un symbole d'une police nommée « … Symbol » n'était plus remplacé par une puce ronde.
- **Publication** : Remplir et Ajuster une image dans son cadre (onglet Format d'image et menu de l'image).
- **Tableur** : galerie « Formes » (rectangle, arrondi, ovale, triangle, losange, flèche, étoile, ligne) et « Zone de texte » dans l’onglet Insertion, tracé vectoriel et saisie du texte par double-clic.
- **Publication** : Fichier > Options (correcteur et langue, délai de la copie de récupération ou jamais, règles, limites, magnétisme, verrouillage des repères).
- **Présentation** : tabulations : la touche Tab insère une tabulation au milieu d'un texte (début de paragraphe : change toujours le niveau), rendu des tabulations dans le canvas (intervalle régulier ; taquets alignés à gauche seulement), section Tabulations de la boîte Paragraphe (intervalle par défaut, taquets personnalisés).
- **Publication** : boîtes Police (Ctrl+T, lanceur du groupe Police), Paragraphe (lanceur) et Taille et position (menu de l'objet : largeur/hauteur en cm avec rapport verrouillé, rotation, position exacte), qui réutilisent les modèles de la Présentation.
- **Présentation** : tableau : boîte « Bordures et trame… » (côtés extérieurs/intérieurs/haut/bas/gauche/droite, trait, tirets, épaisseur, couleur, trame ; l'arête partagée est aussi posée sur la cellule voisine) et menu Sélectionner > Tableau / Colonne / Ligne dans le menu contextuel.
- **Tableur** : bouton « Options de recopie incrémentée » après une recopie (Copier les cellules, Incrémenter la série, Recopier uniquement la mise en forme, Recopier sans mise en forme).
- **Présentation** : « Enregistrer en tant qu'image… » dans le menu d'un objet : les objets sélectionnés sont enregistrés en PNG transparent (3x, rotation comprise).
- **Publication** : Insertion > Texte > « Insérer un fichier texte… » (.txt, .md, .docx, .rtf, .odt) : le texte remplace celui de la zone sélectionnée ou crée une nouvelle zone ; le débordement suit les zones liées.
- **Présentation** : boîte « Taille et position… » (menu d'un objet et volet Format) : hauteur, largeur, rotation, position, verrouillage du rapport hauteur/largeur mémorisé dans l'objet.
- **Tableur** : import « À partir d’un fichier texte/CSV » avec assistant (encodage détecté, ligne de départ, délimiteur ou largeur fixe, format des colonnes) vers une nouvelle feuille.
- **Publication** : menu des pages maîtres : « Appliquer à toutes les pages » et « Renommer la page maître… ».
- **Présentation** : menu contextuel d'un tableau (Lignes et colonnes > Insérer au-dessus/en dessous/à gauche/à droite, Supprimer des lignes ou colonnes, Fusionner / Fractionner les cellules, Uniformiser lignes et colonnes ; le clic droit vise la cellule cliquée) et Avancer / Reculer dans le menu d'un objet.
- **Publication** : menu contextuel des règles (Verrouiller les repères, Effacer les repères, Masquer les règles) et option « Verrouiller les repères » dans Création de page > Repères.
- **Tableur** : menu de filtre de colonne avec les filtres nommés (Égal, Différent, Supérieur…, Entre…, Commence par, Se termine par, Contient, Ne contient pas…) et boîte « 10 premiers » (Premiers/Derniers, éléments ou %).
- **Présentation** : boîtes Police (Ctrl+T, Ctrl+Maj+F, lanceur du groupe Police, menu contextuel : police, style, taille, couleur, soulignement, barré/double, exposant/indice avec décalage, petites majuscules/majuscules, ombre, espacement) et Paragraphe (lanceur du groupe, menu contextuel : alignement, retrait avant le texte, première ligne/suspendu, espacement avant/après, interligne multiple ou exact).
- **Publication** : menu contextuel d'un tableau (Insérer ligne/colonne, Supprimer ligne/colonne/tableau, Fusionner / Fractionner les cellules) ; supprimer une ligne ou une colonne réduit aussi le cadre du tableau.
- **Publication** : couper / copier / coller une page (menu du volet des pages), menu de la page vide (insérer, coller une page, zoom, atteindre la page, format de la page), menu d'objet complété (grouper, dissocier, faire pivoter) ; F5 Atteindre la page, F7 vérificateur de conception, Ctrl+Maj+G/R grouper/dissocier, Ctrl+Maj+F/B premier plan/arrière-plan, Ctrl+Maj+C/V copier/coller la mise en forme.
- **Texte** : raccourcis clavier français comme Word FR (Ctrl+Maj+G/D aligner à gauche/à droite, Alt+Ctrl+C/V reproduire/coller la mise en forme, Alt+Ctrl+B/F note de bas de page/de fin, Alt+Maj+H heure, Ctrl+Maj+Espace espace insécable), F4 / Ctrl+Y répètent la dernière mise en forme ; jeu anglais conservé en option dans Fichier > Options > Raccourcis clavier.
- **Texte** : Ctrl+Maj+E (suivi), Ctrl+8 (marques), F9 (mettre à jour les champs), Ctrl+Alt+P/O/N (page, plan, brouillon), Alt+Maj+↑/↓ (déplacer le paragraphe), Alt+Maj+←/→ (niveau de titre) ; info-touches alignées sur Word FR (Insertion S, Conception Ç, Références É, Publipostage G, Affichage N).
- **Texte** : tableaux — boîte « Propriétés du tableau » (onglets Tableau, Ligne, Colonne, Cellule, Texte de remplacement), taille de la cellule (hauteur de ligne, largeur de colonne), Ajustement automatique, Uniformiser lignes/colonnes, Sélectionner (cellule, colonne, ligne, tableau), Fractionner le tableau, Convertir en texte, Convertir le texte en tableau ; largeur, alignement, titre et disposition du tableau désormais rendus à l'écran.
- **Texte** : boîte « Tabulations » (position, alignement gauche/centré/droite/décimal/barre, points de suite, Définir/Effacer/Effacer tout, tabulation par défaut), ouverte depuis la boîte Paragraphe.
- **Texte** : boîte « Zoom » (200 %, 100 %, 75 %, largeur de page, pleine page, plusieurs pages, pourcentage libre), bouton « Zoom… » de l'onglet Affichage.
- **Texte** : « Atteindre » étendu (F5) : page, titre, signet, commentaire, note de bas de page, note de fin, tableau, image, avec liste des éléments et boutons Précédent / Suivant.
- **Texte** : boîte « Table des matières personnalisée » (numéros de page, alignement à droite, caractère de suite points/tirets/trait/aucun, liens, niveaux 1 à 9), préremplie depuis la table existante et mise à jour avec les mêmes options.
- **Texte** : boîte Mise en page, section « En-têtes et pieds de page » : première page différente et pages paires/impaires différentes.
- **Texte** : tableaux — groupe « Création de bordures » (style, épaisseur et couleur du trait, menu Bordures : toutes, extérieures, intérieures, haut, bas, gauche, droite, horizontale/verticale intérieure, aucune) et menu « Alignement du texte » à 9 positions.
- **Texte** : volet Styles complet (aperçu des styles, Nouveau style, Modifier le style avec police, paragraphe, style de base, style suivant et galerie, Supprimer, Mettre à jour d’après la sélection, Effacer tout).
tableau croisé dynamique : double-clic sur une valeur ou un total pour afficher ses lignes sources dans une nouvelle feuille « Détail ».
- **Texte** : boîte « Grammaire et orthographe » complète (mots suspects du document avec suggestions, Changer, Changer tout, Ignorer, Ignorer tout, Ajouter au dictionnaire personnel, langue de vérification) ; « Ignorer tout » et « Ajouter au dictionnaire » aussi dans le menu contextuel d’un mot.
graphiques : position des étiquettes de données des barres (au centre, extrémité intérieure/extérieure) dans « Ajouter un élément graphique ».
- **Texte** : volet Navigation avancé : onglets Titres et Pages, monter / descendre, hausser / abaisser une section (avec ses sous-titres), glisser-déposer des titres pour réorganiser le document.
graphiques : nuage de points avec lignes droites et marqueurs ; les nuages de points dont les X sont du texte utilisent 1, 2, 3… (ils s’affichaient vides).
- **Texte** : Rechercher et remplacer : menus « Spécial » (tabulation, espace insécable, traits d’union, texte trouvé) pour la recherche et le remplacement.
- **Texte** : boîte Police : effets Ombre, Contour, Relief, Gravé, échelle et position verticale du texte.
- **Texte** : boîte « Bordures et trame » (paragraphe : côtés, style, épaisseur, couleur, trame de fond), accessible depuis le menu Bordures de l’onglet Accueil.
- **Texte** : volet « Vérifications » (Révision > Volet de vérification) : liste des modifications suivies avec type, auteur et texte, filtre par relecteur, Accepter / Refuser par modification, Tout accepter / Tout refuser, décompte des insertions et suppressions.
- **Texte** : menu contextuel de tableau complété : Sélectionner, Ajustement automatique, Fractionner le tableau, Convertir en texte, Propriétés du tableau.
plan : boutons +/- de repli/dépli dans la marge des numéros de ligne et boutons de niveau 1, 2, 3 dans le coin (lignes).
- **Texte** : boîte « Numéros de ligne » (début, pas de comptage, redémarrage continu / chaque page / chaque section) ; le « Début à » est désormais respecté par la numérotation affichée.
- **Texte** : « Atteindre » : types Champ, Équation et Section en plus des précédents.
révision : Précédent / Suivant entre commentaires et notes, Supprimer la note, Afficher toutes les notes (bulles permanentes).
barre d’état : clic droit pour choisir les calculs de la sélection (Moyenne, Nombre, Nb numérique, Min, Max, Somme), choix mémorisé.
menu contextuel des objets (graphique, forme, image) : Modifier le titre / le texte, Mettre au premier plan, Avancer, Reculer, Mettre en arrière-plan, Supprimer.
- **Texte** : objets flottants : formes et zones de texte ancrées (habillage carré, serré, devant, derrière, haut et bas), onglet contextuel « Format de forme » (forme, remplissage, contour, position, habillage, avancer/reculer, taille, modifier le texte), déplacement à la souris par la poignée ✥ avec décalages d’ancrage, aller-retour .docx vérifié.
onglet contextuel « Format de forme » : remplissage, contour, épaisseur, couleur et taille du texte, rotation à 90°.
graphiques : double-clic sur le titre ou sur un titre d’axe pour modifier son texte.
- **Texte** : boîte « Notes de bas de page et de fin » (format du numéro et premier numéro, appliqués à l’affichage et enregistrés dans le .docx : w:footnotePr / w:endnotePr).
Fichier > Options > Avancé : sens de déplacement de la sélection après Entrée (bas, droite, haut, gauche, aucun), mémorisé.
tableaux : liste déroulante de fonction (Somme, Moyenne, Nombre, Chiffres, Max, Min, Écartype, Var, Aucune) sur chaque cellule de la ligne Total.
- **Texte** : boîte « Définir une nouvelle liste à plusieurs niveaux » (format, gabarit du numéro, début, retraits des 9 niveaux) ; case « Bordure du texte » dans la boîte Police.
graphiques : « Sélectionner des données » (ruban et menu contextuel) pour modifier, ajouter ou supprimer des séries (nom, valeurs, catégories) avec contrôle des plages.
- **Texte** : protection du document avec mot de passe (lecture seule ou suivi des modifications obligatoire) : empreinte SHA-512 salée écrite dans le .docx (w:documentProtection), vérifiée avec le vrai Word (bon mot de passe accepté, mauvais refusé) ; le mot de passe n’est plus perdu à l’enregistrement d’un document protégé.
- **Texte** : grammaire de base du français dans la boîte « Grammaire et orthographe » : espaces en trop, espace avant une virgule, espace manquant après la virgule, espace insécable avant ; : ! ?, mots répétés, majuscule de début de phrase ; Corriger / Tout corriger. Les accords et la conjugaison ne sont pas vérifiés.
- **Texte** : 8 thèmes de plus dans Conception > Thèmes (Aurore, Océan, Forêt, Sable, Lavande, Braise, Graphite, Menthe), applicables aux couleurs, aux polices ou aux deux ; les noms français s’affichent aussi dans les menus Couleurs et Polices.
- **Texte** : Rechercher et remplacer : liste « Format » (gras, italique, souligné, barré, surligné), avec ou sans texte à chercher (recherche du seul texte en gras, par exemple).
courbes empilées et aires empilées (insertion et « Modifier le type »).
menu contextuel de la cellule : « Insérer… » et « Supprimer… » ouvrent les boîtes de décalage.
- **Texte** : menu contextuel de la règle (Mise en page, Paragraphe, Tabulations, Effacer toutes les tabulations, Masquer la règle).
- **Texte** : inspecteur de style dans le volet Styles (style de paragraphe, mise en forme directe du paragraphe, style de caractère, mise en forme directe du texte, en français).
objets flottants : 8 poignées de redimensionnement (coins et côtés, bord opposé fixe).
Données > Analyse de scénarios > Valeur cible (recherche de la valeur d’une cellule pour atteindre un résultat, avec validation).
Données > Consolider (somme, nombre, moyenne, max, min ; par position ou par étiquettes de ligne/colonne ; plusieurs références, y compris d’autres feuilles).
- **Texte** : 12 géométries de formes de plus (triangle, losange, pentagone, hexagone, 4 flèches pleines, 2 étoiles, 2 bulles) dans Insertion > Formes et Format de forme ; rotation des formes (enregistrée dans le .docx, a:xfrm rot) ; menu contextuel de forme (habillage, position, ordre, rotation, texte, suppression) ; volet Sélection (liste des formes, zones de texte et images, ordre d’empilement).
- **Texte** : boîte « Notes de bas de page et de fin » : conversion de toutes les notes de bas de page en notes de fin et inversement (appels et contenus).
Données > Avancé : filtre par zone de critères (ET entre colonnes, OU entre lignes, comparateurs et jokers), sur place ou copie vers un autre emplacement, enregistrements uniques.
- **Texte** : boîte Police : couleur de soulignement (portée par le texte dans le modèle, enregistrée dans le .docx) et crénage à partir d’une taille.
volet Commentaires : modification du texte d’un commentaire en place (Enregistrer / Annuler).
- **Texte** : protection « Commentaires seulement » (document non modifiable, commentaires autorisés), en plus de Lecture seule et Suivi obligatoire.
Fichier > Options > Avancé : décimales fixes à la saisie des nombres.
- **Texte** : Rechercher et remplacer : marque de paragraphe ^p (recherche à cheval sur deux paragraphes, remplacement qui joint les paragraphes).
- **Texte** : volet Navigation, onglet Pages : miniatures réelles des pages (clic = aller à la page).
- **Texte** : boîte « Options de suivi » (couleur et style des insertions, couleur des suppressions), mémorisée sur l’ordinateur.
plan des colonnes : boutons +/- au-dessus des en-têtes de colonnes (repli/dépli), boutons de niveau communs aux lignes et colonnes.
Analyse rapide : bouton sous une sélection de plusieurs cellules et Ctrl+Q (mise en forme, graphiques, totaux, tableau).
- **Texte** : menu de la barre d’état (clic droit) : afficher ou masquer le numéro de page, le nombre de mots, la vérification, la langue, le suivi et le minuteur de lecture (mémorisé) ; le composant StatusBar de packages/ui accepte un gestionnaire facultatif onContextMenu (rétrocompatible).
Fichier > Informations : propriétés du document modifiables (titre, auteur, sujet, mots clés, catégorie, société), enregistrées dans le fichier.
graphiques : type Radar avec marqueurs (axes par catégorie, anneaux de graduation, un polygone par série).
tableau croisé dynamique : menu contextuel (Actualiser, Afficher les détails, liste de champs).
- **Texte** : boîte Mise en page : alignement vertical de la page (haut, centré, bas) avec rendu de pagination (le contenu de chaque page est décalé, mesuré) et début de section (nouvelle page, continu, page paire, page impaire avec page blanche de parité), enregistrés dans le .docx (w:vAlign, w:type).
- **Texte** : volet Styles : Importer des styles… (depuis un .docx ou .dotx : ajout et remplacement, listes retirées) et Exporter les styles… (document .docx d’échange), formes polygonales dessinées en SVG (contour non coupé).
formes : rotation libre à la souris par la poignée verte (Maj : pas de 15°), objet sélectionné toujours au premier plan.
graphiques : courbes lissées avec marqueurs et radar plein.
- **Texte** : protection « Remplissage de formulaires » : seuls les contrôles de contenu (bloc et en ligne) restent modifiables ; formes polygonales dessinées en SVG ; Modifier le style : boutons Format : Tabulations… et Format : Bordure… (taquets et cadre hérités par les paragraphes du style).
Fichier > Options : pages Général (nom d’utilisateur, auteur des nouvelles notes) et Enregistrement (intervalle de la copie de récupération).
- **Texte** : Rechercher et remplacer : caractères génériques de Word (? * [a-z] [!a-z] < > @ {n,m} groupes et \1 au remplacement), « Dans la sélection seulement », ^p dans le remplacement (coupe le paragraphe).
Données > Grouper > Plan automatique : groupes de lignes déduits des formules SOMME / SOUS.TOTAL.
- **Texte** (corrigé) : Gras/Italique… sur une sélection lisent l'état du premier caractère sélectionné, plus celui du caractère précédent.
- **Tableur** : déplacer une plage en glissant sa bordure (curseur de déplacement, contour pointillé), copier avec Ctrl+glisser.
- **Tableur** : assistant Convertir en 3 étapes (délimité ou largeur fixe avec sauts de colonne cliquables, séparateurs multiples, identificateur de texte, format Standard/Texte/Ignorer par colonne, destination).

### Corrigé

- **Présentation** : mini-barre : les galeries (styles de forme, styles de tableau) deviennent des menus compacts au lieu d'une rangée de vignettes.
- **Présentation** : Annuler après un changement de taille dans une zone de texte à ajustement automatique revient enfin en arrière (l'ajustement de la forme est fusionné dans l'étape d'annulation au lieu de s'y ajouter ; `History.amend` dans `@forgeoffice/core`).
- **Publication** : la boîte « Insérer des pages » prenait l'ancienne valeur quand on validait par Entrée.

## [0.2.2] - 2026-11-06

### Ajouté

- **Tableur** : bouton « Format… » des règles de mise en forme conditionnelle : la boîte « Format de cellule » à 4 onglets (Nombre, Police, Bordure, Remplissage) ; les bordures d'une règle sont maintenant dessinées dans la grille.
- **Texte** : correction des deux majuscules initiales (`BOnjour` → `Bonjour`), avec respect des marques (`IPhone`, `IPad`…) et des sigles ; réglée avec la majuscule de début de phrase dans Fichier > Options > Vérification.


## [0.2.1] - 2026-11-06

### Ajouté

- **Publication** : export « PDF imprimeur en CMJN » (Fichier > Exporter). Option : le PDF habituel reste en RVB. Conversion simple sans profil ICC, fonds perdus et traits de coupe conservés.

- **Tableur** : gestionnaire de règles de mise en forme conditionnelle complet : règles de la feuille ou de la sélection triées par priorité, description en français, Monter / Descendre, « Arrêter si vrai », plage « S'applique à » modifiable, Modifier et Supprimer ; jeux d'icônes avec leur nom français.

- **Tableur** : boîte « Créer un tableau » (plage des données et case « en-têtes ») ouverte par Ctrl+L, Insertion > Tableau et « Mettre sous forme de tableau ».

- **Tableur** : boîtes « Insérer des cellules » et « Supprimer des cellules » (décaler vers la droite / le bas / la gauche / le haut, ligne ou colonne entière) ouvertes par Ctrl+Maj++, Ctrl+- et les menus Insérer / Supprimer du ruban.

- **Tableur** : « Protéger la feuille » propose la liste « Autoriser tous les utilisateurs de cette feuille de calcul à » (13 cases) et la protection la respecte : mise en forme des cellules, des colonnes et des lignes, insertion et suppression de lignes ou de colonnes, tri, filtre automatique.

- **Tableur** : boîte « Déplacer ou copier… » dans le menu d'un onglet de feuille (position « avant la feuille », case « Créer une copie »).

- **Tableur** : « Rechercher et remplacer » cherche dans la feuille ou dans tout le classeur (« Dans : Feuille / Classeur »), la liste des résultats indique la feuille, « Suivant » ouvre la feuille du résultat et « Remplacer tout » agit sur toutes les feuilles trouvées.

- **Tableur** : Collage spécial complet : Formules et formats de nombres, Commentaires et notes, Validation, Largeurs de colonnes (en plus des options existantes).

- **Tableur** : « Nouvelle règle » de mise en forme conditionnelle avec les six types d'Excel (d'après la valeur : nuances à 2 ou 3 couleurs, barres de données, jeux d'icônes ; valeurs, texte, vides, erreurs ; plus ou moins élevées ; moyenne ; uniques ou doublons ; formule), paramètres min / milieu / max et format personnalisé (couleurs, gras, italique, souligné) avec aperçu. La même boîte sert à modifier une règle.

- **Texte** : correction automatique à la frappe (typographie française) : espace insécable avant `;` `!` `?` (fine) et `:`, guillemets « » avec espaces insécables, apostrophe courbe, `(c)` `(r)` `(tm)` `...` `-->` `1/2` remplacés par `©` `®` `™` `…` `→` `½`. Désactivable dans Fichier > Options > Vérification.

- **Texte** : listes automatiques : `1. ` ou `1) ` en début de paragraphe démarre une liste numérotée (repart de 1), `- `, `* ` ou `• ` une liste à puces.

- **Texte** : majuscule en début de phrase (après `. ! ? …` et en début de paragraphe), avec exceptions pour les abréviations (`etc.`, `M.`, `cf.`…), les numéros de liste et les mots comme `iPhone`. Désactivable dans Fichier > Options > Vérification.

- **Texte** : les adresses web (`https://…`, `www.…`) et les e-mails deviennent des liens quand on tape l'espace qui suit (ponctuation finale exclue).

- **Tableur** : « Validation des données » complète : trois onglets (Options, Message de saisie, Alerte d'erreur), type Heure, « Ignorer si vide », liste déroulante dans la cellule, style d'alerte Arrêt / Avertissement / Information avec titre et message.

- **Tableur** : filtre automatique personnalisé : deux conditions reliées par Et / Ou (est égal à, différent de, supérieur / inférieur (ou égal), commence par, se termine par, contient et leurs négations), relu à la réouverture du menu.

- **Tableur** : liens hypertexte : info-bulle (saisie et affichage au survol), adresse sans schéma complétée (`https://` ou `mailto:`), style « Lien hypertexte » (bleu souligné) sur un nouveau lien, « Ouvrir le lien hypertexte » et « Supprimer le lien » dans le menu de la cellule.

- **Tableur** : double-clic sur la poignée de recopie (petit carré en bas à droite de la sélection) : recopie vers le bas jusqu'à la fin des données de la colonne voisine.

### Corrigé

- **Tableur** : Collage spécial « Tout sauf la bordure » gardait la bordure de la source (il se comportait comme « Tout ») et « Valeurs et formats de nombres » copiait tout le format de la source.
- **Texte** : Entrée sur une puce ou un numéro vide arrête la liste et rend aussi le paragraphe à son style normal (le retrait de « Paragraphe de liste » restait).
- **Tableur** : avec une validation en style « Avertissement » ou « Information », la saisie invalide était acceptée sans rien dire : la remarque (titre et message) s'affiche maintenant ; « afficher une alerte » décoché désactive le contrôle ; le message de saisie ne s'affiche que s'il est activé.
- **Tableur** : le double-clic ne fonctionnait pas dans la grille (le navigateur donne toujours 0 comme nombre de clics sur un événement pointeur) : double-clic sur une cellule pour la modifier et sur le bord d'un en-tête de colonne ou de ligne pour ajuster sa taille.
- **Tableur** : une nouvelle règle de mise en forme conditionnelle devient la plus prioritaire (comme dans Excel) au lieu de passer en dernier.
- **Présentation** : « Dissocier » fonctionne quand un groupe fait partie d'une sélection de plusieurs objets ; les cases « Utiliser le mode Présentateur » et « Utiliser les minutages » se rafraîchissent aussitôt.

## [0.2.0] - 2026-11-05

### Ajouté

- **Mobile complet** : ruban en bande à défilement avec feuilles du bas, « Toutes les commandes » (recherche), barres clavier construites depuis le ruban, mini-barre de sélection, menus contextuels par long appui, poignées d'image tactiles ; 689 commandes atteignables au toucher sur téléphone (test de couverture `mobile-coverage.mjs`).
- **Mise à jour intégrée sur Android** : flux signé (même clé que le bureau, vérifié sur Android 7 et plus), APK de la bonne architecture contrôlé (taille, SHA-256, paquet, version, clé de signature) puis installé par le système ; vérification au démarrage puis toutes les 6 h, bouton Accueil > Options > Rechercher une mise à jour. L'autorisation « applications inconnues » est demandée une seule fois ; les mises à jour suivantes se font sans confirmation à partir d'Android 12.
- **Tableur** : Format de cellule à 6 onglets, une centaine de raccourcis Excel (français), mise en page à 4 onglets avec impression et aperçu, noms, tableaux structurés, calcul itératif, espion, nouvelles fonctions.
- **PDF** : annotations du fichier modifiables, signature numérique, rotation et texte, menus contextuels.
- **Présentation** : export PDF vectoriel, présentateur en deux fenêtres, habillage de plusieurs objets, rognage.
- **Banc de conformité** : teste chaque commande du ruban de chaque application par de vrais clics (`docs/CONFORMITE.md`).

### Corrigé

- Base de données : un formulaire « Feuille de données » figeait la page (boucle d'enregistrement) ; « Atteindre > Dernier » ne se plaçait pas sur le dernier enregistrement.
- Texte : largeur, hauteur, rotation et retournement d'une image ne s'appliquaient jamais ; Échap ne fermait pas certaines boîtes de dialogue (ni dans les autres applications) ; la mini-barre flottante recouvrait les menus et palettes ouverts.
- PDF : « Supprimer les ajouts » restait actif sans rien à supprimer ; basculer « deux pages » changeait la page courante.
- Publication : « niveaux de gris » laissait un résidu dans le document ; la boîte « Destinataires » ne se fermait pas avec Échap.
- Crash au démarrage de Publication sur Android (hook React conditionnel).

### Changé

- Android : permissions `INTERNET` et `REQUEST_INSTALL_PACKAGES` ajoutées pour la seule mise à jour intégrée ; la page n'a toujours aucun accès réseau.

## [0.1.0] - 2026-11-04

Première version publique : toute la suite est écrite et testée. Installeurs Windows 64 et 32 bits (NSIS, MSI, portable) construits, signés (Authenticode auto-signé + minisign) et testés en vrai ; APK Android signés testés sur émulateur ; Linux, macOS et iOS non construits (voir `docs/ROADMAP.md`).

### Ajouté

- **Texte** (équivalent Word) : éditeur ProseMirror avec pagination calculée, ruban complet (Accueil, Insertion, Dessin, Conception, Mise en page, Références, Publipostage, Révision, Affichage), styles, listes, tableaux avec fusions, images, notes, table des matières, suivi des modifications, commentaires, modes Lecture / Plan / Plusieurs pages / Focus, statistiques avancées, comparaison, publipostage CSV, filigrane, récupération après plantage. Formats `.docx` `.docm` `.dotx` `.dotm` `.odt` `.rtf` `.html` `.md` `.txt` et lecture du `.doc` 97-2003.
- **Tableur** (équivalent Excel) : grille virtualisée de 1 048 576 × 16 384 cellules, moteur de 489 fonctions avec noms français, tableaux croisés dynamiques, graphiques, mise en forme conditionnelle, validation, tris et filtres, tableaux, volets figés, protection, presse-papiers compatible Excel. Formats `.xlsx` `.xlsm` `.xltx` `.ods` `.csv` `.tsv` et lecture du `.xls` (BIFF8).
- **Présentation** (équivalent PowerPoint) : 11 dispositions, 8 thèmes, 187 formes, 10 types de graphiques, 26 transitions dont la Morphose, 28 animations, Concepteur, masque des diapositives, diaporama avec mode Présentateur, trieuse, export PDF / PNG / JPEG. Formats `.pptx` `.pptm` `.potx` `.potm` `.ppsx` `.ppsm` et lecture de `.ppt` et `.odp`.
- **Publication** (équivalent Publisher) : format `.fopub`, 13 compositions, zones de texte chaînées, habillage, lettrines, pages maîtres, repères, publipostage CSV, vérificateur de conception, export PDF prêt pour l'imprimeur (fonds perdus, traits de coupe, imposition).
- **Base de données** (équivalent Access) : moteur SQLite (`crates/forge-base`, 74 tests), feuille de données, créateur de requêtes graphique, relations avec intégrité référentielle, formulaires, états, macros, import CSV et classeur.
- **PDF** : lecteur pdf.js, annotations, formulaires, caviardage réel, chiffrement AES-256, compression, filigrane, numérotation, signets, recherche, comparaison, signature visuelle.
- **Bloc-notes** : réécriture complète de WinNote sur CodeMirror 6 (101 fonctions inventoriées : 90 livrées, 6 adaptées, 5 non livrées dont 3 sans objet).
- **Convertisseur** : conversions par lots (documents, classeurs, présentations, images, données, sous-titres, archives, audio) et outils PDF, moteur Rust `crates/forge-convert` (57 tests).
- **Accueil** : Nouveau, Ouvrir, récents et épinglés, modèles, thème clair / sombre / contraste élevé.
- **Coquille Tauri 2** (Windows 64 et 32 bits, Linux, macOS, Android) : une fenêtre par document, instance unique, journal avec rotation, écriture atomique, registre d'autorisations de chemins, CSP stricte, mode portable (`portable.flag`), mise à jour automatique signée minisign (installeurs et portable), 59 associations de fichiers.
- **Livraison** : workflows GitHub `ci.yml` (types, 1 152 tests TypeScript, tests Rust sur Ubuntu et Windows) et `release.yml` (NSIS, MSI, portable, AppImage, deb, rpm, dmg, apk, `latest.json` signé, `SHA256SUMS`, release en brouillon) ; scripts `make-latest-json.mjs` et `third-party-notices.mjs`.
- **Documentation** : README, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DECISIONS-A-PRENDRE.md`, `docs/MOBILE.md`, `docs/PACKAGING.md`, `THIRD_PARTY_NOTICES.md` généré, une centaine de captures.

### Connu

- Licence : PolyForm Noncommercial 1.0.0 (voir `LICENSE`). Aucune dépendance GPL n'est liée (la lecture EPUB est écrite en interne) ; il ne reste que du MPL-2.0 (voir `THIRD_PARTY_NOTICES.md`).
- Polices libres embarquées (Carlito, Liberation, Selawik). Installeurs Windows signés avec un certificat auto-signé : SmartScreen avertit tant que sa racine n'est pas installée. APK Android signé ; non essayé sur un appareil réel. macOS non construit ni notarisé.
- Limites fonctionnelles par application : `docs/ROADMAP.md`.
