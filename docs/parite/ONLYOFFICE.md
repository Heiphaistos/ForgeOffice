# Audit de parité ForgeOffice / ONLYOFFICE Docs 8-9 (2026-11-05)

Périmètre : ce que ONLYOFFICE a EN PLUS de Microsoft Office ou fait différemment. Les fonctions déjà couvertes par les audits
Microsoft Office (WORD.md, EXCEL.md, POWERPOINT.md, PUBLISHER.md, ACCESS.md) sont rappelées en une ligne quand l'interface ONLYOFFICE les expose,
sans refaire leur détail. Aucune ligne de code ONLYOFFICE (AGPL) n'a été copiée : seuls les NOMS de commandes et d'options ont été relevés.

## Sources et méthode

- Vérité-terrain : `D:\Projet\ForgeOffice-etude\src\web-apps\apps\{documenteditor,spreadsheeteditor,presentationeditor,pdfeditor,visioeditor}` (vues `app/view/*.js`,
  localisation `main/locale/fr.json` pour les noms français exacts, `spreadsheeteditor/main/resources/formula-lang/fr.json` pour les fonctions)
  et `D:\Projet\ForgeOffice-etude\src\sdkjs` (groupes `cFormulaFunctionGroup` du moteur de tableur : 492 fonctions distinctes relevées par script).
- Liste des plugins officiels : dépôt public `ONLYOFFICE/onlyoffice.github.io` (dossier `sdkjs-plugins/content`, consulté le 2026-11-05).
- État de ForgeOffice : lecture des `STATUS.md` de `packages/{word,excel,powerpoint,publisher,pdf,formulas,docx,convert}`, des fichiers `strings.ts` (liste des commandes réellement câblées)
  et recherches ciblées dans `packages/*/src` ; le moteur de formules a été interrogé directement (`listFunctions()` : 505 fonctions).
- ATTENTION : aucun code n'a été exécuté dans le banc pour cet audit. Le statut « Présent mais à vérifier » veut dire : le code existe (fichier cité) mais le comportement
  n'a pas été recoupé avec celui d'ONLYOFFICE ; ce n'est jamais un « OK » prouvé.

## Légende

| Statut | Sens |
|---|---|
| Absent | Aucune trace dans le code (recherche par mot-clé et lecture des chaînes d'interface). |
| Partiel | Une partie existe (modèle lu/écrit sans interface, version simplifiée, un seul des modes). Le manque est précisé. |
| Présent mais à vérifier | Code présent, non recoupé ici avec ONLYOFFICE. |

Priorités : **P1** attendu par un utilisateur de bureautique (parité de base, manque bloquant) · **P2** utile, différenciant · **P3** rare ou purement ONLYOFFICE.
« Équivalent MS Office » : oui / non / nom de la commande ; **★** = fonction UNIQUE d'ONLYOFFICE (aucun équivalent dans Microsoft Office 2024/365).
Les fonctions de serveur (coédition en direct, chat, historique serveur) sont marquées **HPL** = hors périmètre local, avec l'équivalent local proposé.

## Synthèse chiffrée (lignes numérotées de ce document)

| Éditeur / domaine | Lignes | Présent mais à vérifier | Partiel | Absent | % Présent | % Partiel | % Absent |
|---|---|---|---|---|---|---|---|
| Commun (interface, Fichier, outils transverses) | 60 | 16 | 17 | 27 | 26 % | 28 % | 45 % |
| Éditeur de documents (Texte) | 149 | 64 | 44 | 41 | 42 % | 29 % | 27 % |
| Éditeur de feuilles de calcul (Tableur), hors fonctions | 90 | 47 | 22 | 21 | 52 % | 24 % | 23 % |
| Éditeur de présentations (Présentation) | 37 | 25 | 8 | 4 | 67 % | 21 % | 10 % |
| Éditeur PDF | 30 | 18 | 9 | 3 | 60 % | 30 % | 10 % |
| Éditeur de diagrammes (visionneuse) | 7 | 0 | 0 | 7 | 0 % | 0 % | 100 % |
| Plugins officiels | 27 | 4 | 4 | 19 | 14 % | 14 % | 70 % |
| Formats de fichier | 26 | 8 | 11 | 7 | 30 % | 42 % | 26 % |
| Collaboration serveur (HPL) | 10 | 0 | 0 | 10 | 0 % | 0 % | 100 % |
| Annexe A : fonctions de tableur (492) | 492 | 481 | 0 | 11 | 97 % | 0 % | 2 % |
| **Total** | **928** | **663** | **115** | **150** | 71 % | 12 % | 16 % |
| Total hors annexe des fonctions | 436 | 182 | 115 | 139 | 41 % | 26 % | 31 % |

Les lignes « HPL » (collaboration serveur) sont comptées Absent. Aucun statut « OK » n'est utilisé : rien n'a été exécuté dans ce travail. Les pourcentages sont arrondis à l'entier inférieur.


---

## 1. Commun aux éditeurs (interface, Fichier, paramètres, outils transverses)

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| COM-001 | Ruban à onglets (Fichier, Accueil, Insertion... Plugins) | oui (ruban) | Présent mais à vérifier | `packages/ui` (Ribbon, Backstage) | P1 |
| COM-002 | Barre d'outils compacte / « Toujours afficher la barre d'outils » | oui (Réduire le ruban) | Partiel | ruban réductible non relevé dans `ui/src/ribbon-types.ts` | P3 |
| COM-003 | Barre d'accès rapide personnalisable (Personnaliser l'accès rapide) | oui | Partiel | `T.qat` fixe dans `word/src/strings.ts` (Enregistrer, Annuler, Rétablir, Imprimer, Nouveau, Ouvrir, Focus) ; pas de dialogue de personnalisation | P2 |
| COM-004 | Raccourcis clavier PERSONNALISABLES (dialogue Raccourcis clavier, 294 actions listées, éditeur de touche, restauration) | Word seulement (Personnaliser le clavier) ; non pour Excel/PowerPoint ★ | Absent | aucun dialogue ; raccourcis en dur (`excel/src/ui/keys.ts`) | P2 |
| COM-005 | Thèmes d'interface (Classique clair, Clair, Sombre, Contraste sombre, « Identique au système ») | oui (thème Office) | Présent mais à vérifier | `ui/src/theme.ts` : light / dark / contrast / system | P1 |
| COM-006 | Mode « Document sombre » indépendant du thème (fond de page noir) | non ★ | Absent | thème appliqué à l'interface, pas de bascule de la page | P3 |
| COM-007 | Style d'onglet : Remplissage / Ligne ; couleur de la barre d'outils pour les onglets | non ★ | Absent | — | P3 |
| COM-008 | Unité de mesure (centimètre, point, pouce) | oui (Options Avancé) | Absent | aucune chaîne « Unité de mesure » | P2 |
| COM-009 | Valeur de zoom par défaut (Ajuster à la page / à la largeur / %) | oui | Partiel | zoom présent, pas de réglage du défaut | P3 |
| COM-010 | Interface RTL (droite-gauche) et direction de feuille par défaut | oui | Partiel | `strings.ts` mentionne la direction du texte (1-3 occurrences par module) ; pas d'interface RTL | P3 |
| COM-011 | Prise en charge du lecteur d'écran (réglage) | oui (Narrateur / Accessibilité) | Absent | aucun réglage | P2 |
| COM-012 | Navigation clavier du ruban par Alt (conseils de touches, hints) | oui (KeyTips) | Présent mais à vérifier | Alt+Q recherche (`word`), conseils de touches non recoupés | P2 |
| COM-013 | Hinting des polices (Natif / Windows / OS X) | non ★ | Absent | — | P3 |
| COM-014 | Enregistrement automatique (Désactivé, 1/5/10/30/60 min) + « Sauvegarder les informations de récupération » | oui (Enregistrement auto, Récupération) | Partiel | récupération toutes les 30 s dans tous les modules (STATUS) ; intervalle non réglable | P2 |
| COM-015 | « Enregistrer des versions intermédiaires » (ForceSave serveur) | non ★ | Absent | HPL | P3 |
| COM-016 | Mode de coédition Rapide / Strict | oui (Enregistrement auto) | Absent | HPL : équivalent local = verrou de fichier + rechargement si modifié sur disque | P3 |
| COM-017 | Afficher/masquer les modifications des co-auteurs (Rien, Aperçu, Survol) | partiel | Absent | HPL | P3 |
| COM-018 | Recherche : barre de recherche flottante (Ctrl+F) + panneau gauche Rechercher/Remplacer (casse, mot entier, surbrillance, résultats) | oui (Volet Navigation) | Présent mais à vérifier | `word/src/editor/find.ts` (casse, mot entier, accents, regex, $1) | P1 |
| COM-019 | Panneau de commentaires gauche (liste, filtre auteur/état, résolu, réponses, @mentions) | oui | Présent mais à vérifier | commentaires fil/réponses/résolu : Word + Excel + PowerPoint (STATUS) ; filtre par auteur et @mentions non relevés | P1 |
| COM-020 | Mentions @utilisateur dans les commentaires (notification) | oui | Absent | HPL partiel : équivalent local = nom de l'auteur dans le fil | P3 |
| COM-021 | Chat de document | Teams (hors Office) | Absent | HPL | P3 |
| COM-022 | Historique des versions (liste, restauration, comparaison de révisions) | oui (Historique des versions OneDrive) | Absent | HPL ; équivalent local = copies datées dans un dossier `.versions` à côté du fichier + « Comparer » (`word/src/features/compare.ts`) | P2 |
| COM-023 | Droits d'accès / Partage (dialogue Droits d'accès) | oui | Absent | HPL ; équivalent local = bouton Partager (copie du fichier / lien de fichier / envoi) | P3 |
| COM-024 | Fichier > Info (propriétés : titre, auteur, sujet, tags, statistiques, propriétés personnalisées « Ajouter une propriété ») | oui (Informations) | Partiel | Backstage Informations existe (STATUS word/excel) ; propriétés personnalisées typées non relevées | P2 |
| COM-025 | Fichier > Télécharger comme / Enregistrer une copie sous (liste de formats) | oui (Enregistrer sous) | Présent mais à vérifier | Backstage `Enregistrer sous` (docx, docm, dotx, dotm, odt, rtf...) | P1 |
| COM-026 | Fichier > Renommer, Ouvrir l'emplacement du fichier | oui | Présent mais à vérifier | barre de titre / Backstage | P2 |
| COM-027 | Fichier > Ouvrir récent / Nouveau (modèles) | oui | Présent mais à vérifier | `addRecent`, Backstage Nouveau/Accueil | P1 |
| COM-028 | Fichier > Aide, Proposer une fonctionnalité, Passer en mode mobile | oui (Aide) | Partiel | pas d'aide intégrée relevée | P3 |
| COM-029 | Impression avec aperçu (panneau : taille, marges, orientation, pages, recto-verso, en-têtes, mise à l'échelle) | oui | Présent mais à vérifier | Backstage Imprimer (Word, Excel, PowerPoint) | P1 |
| COM-030 | Impression rapide (bouton) | oui | Présent mais à vérifier | `T.qat.print` | P2 |
| COM-031 | Correction automatique : Autocorrection de texte (liste Remplacer/Par), AutoMaths, fonctions reconnues, majuscule début de phrase, exceptions par langue, guillemets droits -> typographiques, tirets, listes auto, hyperliens auto | oui (Options de correction automatique) | Absent | aucun module `autocorrect` ; seul l'attribut `spellcheck` du navigateur | P1 |
| COM-032 | Vérification orthographique : langue du document, dictionnaire personnel, ignorer MAJUSCULES / mots à chiffres | oui | Partiel | correcteur du navigateur (`word/src/features/spelling.ts`) ; pas de dictionnaire propre ni de grammaire | P1 |
| COM-033 | Langue du texte (barre d'état) | oui | Présent mais à vérifier | `word/src/editor/lang.ts`, `T.cmd.language` | P1 |
| COM-034 | Macros JavaScript (éditeur Monaco, Exécuter, Démarrage automatique, Fonctions personnalisées, Déboguer) | VBA ; non pour JS ★ | Absent | aucun moteur de macros | P2 |
| COM-035 | Enregistrement d'une macro (Enregistrer / Pause / Reprendre / Arrêter, onglet Affichage) | oui (Enregistrer une macro) | Absent | — | P2 |
| COM-036 | Conversion de macros VBA vers JS (« Convertir de VBA ») | non ★ | Absent | IA requise | P3 |
| COM-037 | Création de macro à partir d'une description (IA) | non (Copilot) ★ | Absent | voir PLG | P3 |
| COM-038 | Réglages macros : Désactiver tout / Afficher la notification / Activer tout | oui (Centre de gestion) | Absent | sans objet tant qu'aucune macro | P2 |
| COM-039 | Gestionnaire de plugins (Modules complémentaires, Démarrer/Arrêter, plugins d'arrière-plan, panneau de plugin) | oui (Compléments) | Absent | aucun hôte de plugin ; `core/src` n'expose pas d'API de greffon | P1 |
| COM-040 | Signature numérique OOXML (zone de signature, signer invisible, panneau Paramètres de signature, demander une signature) | oui (Ligne de signature) | Absent | aucune signature OOXML ; PDF seulement (`pdf/src/sign/`) | P2 |
| COM-041 | Chiffrement avec mot de passe (Ajouter / Modifier / Supprimer le mot de passe) | oui (Chiffrer avec un mot de passe) | Partiel | OUVERTURE d'un .docx chiffré (`docx/src/formats.ts`, `opc`) ; écriture chiffrée absente ; PDF : AES-256 oui | P1 |
| COM-042 | Marquer comme final | oui | Présent mais à vérifier | `T.backstage.markFinal` (Word) | P3 |
| COM-043 | Importer des données depuis fichier local / URL / XML | Obtenir des données | Partiel | CSV oui (`xlsx/src/csv.ts`) ; URL et XML : voir SSE | P2 |
| COM-044 | Liens externes (Fichier > Liens externes : mettre à jour, changer la source, ouvrir, rompre) | oui (Modifier les liens) | Absent | aucune chaîne ; formules `[Classeur]` non résolues | P2 |
| COM-045 | Couleurs : palette thème + couleurs standard + « Plus de couleurs » (HSB, hexa, RVB) + récentes + pipette | oui | Présent mais à vérifier | `ui/src/components` (sélecteurs de couleur) ; pipette non relevée | P1 |
| COM-046 | Symboles : dialogue Symbole (police, plage Unicode, récents, raccourci, remplacement automatique) | oui | Présent mais à vérifier | `T.dialogs.symbolTitle`, `symLatin` | P1 |
| COM-047 | Presse-papiers : bouton Options de collage | oui | Présent mais à vérifier | `T.cmd.pasteOptions` | P1 |
| COM-048 | Outil Main / Sélection (barre d'état et onglet Affichage) | non dans Word/PowerPoint ★ (existe dans Acrobat) | Partiel | outil Main sur PDF (`pdf/src/ribbon.tsx`) ; absent dans Texte et Présentation | P3 |
| COM-049 | Zoom : % + Ajuster à la page / largeur + boutons + / - | oui | Présent mais à vérifier | barre d'état de chaque module | P1 |
| COM-050 | Éditeur d'images externe (« Modifier l'image » ouvre l'éditeur Photo) | non ★ | Absent | voir PLG photoeditor | P3 |
| COM-051 | Éditeur de graphique (fenêtre Modifier le graphique : sélectionner des données, type, assistant) | oui (Modifier les données) | Partiel | Excel : modification de graphique ; Word : aucun graphique inséré | P1 |
| COM-052 | Feuille de calcul incorporée (OLE : « Insérer une feuille de calcul » dans Texte, Présentation, PDF) | oui (Tableur Excel incorporé) | Absent | pas d'objet tableur incorporé | P2 |
| COM-053 | Modifier la source de données du publipostage dans un éditeur | oui | Absent | CSV lu une seule fois (`word/src/features/merge.ts`) | P2 |
| COM-054 | Text Art (WordArt) + panneau Paramètres de Text Art | oui (WordArt) | Partiel | PowerPoint : commande Text Art (`powerpoint/src/app/insert.ts`) ; Texte et Tableur : absent | P2 |
| COM-055 | Combiner les formes (Union, Combiner, Fragmenter, Entrecroiser, Soustraire) | oui (Fusionner les formes) | Absent | aucune opération booléenne de formes dans `powerpoint/src` | P2 |
| COM-056 | Formes : ombre personnalisée (couleur, flou, distance, angle), reflet, rotation 3D | oui | Partiel | effets de forme dans PowerPoint (STATUS) ; dialogue d'ombre détaillé non relevé | P2 |
| COM-057 | Équations : éditeur de formules (structures : fractions, radicaux, intégrales, matrices ; conversion Unicode / LaTeX) | oui (Équation, LaTeX) | Partiel | saisie linéaire réduite `powerpoint/src/app/equation.ts` (SVG) ; Word : équation texte + OMML préenregistré (`word/src/dialogs/text.tsx`) ; ni barre de structures ni éditeur OMML | P1 |
| COM-058 | SmartArt (159 dispositions : liste, processus, cycle, hiérarchie, relation, matrice, pyramide, images) | oui | Partiel | 3 familles (liste, processus, hiérarchie) : `powerpoint/src/app/smartart.ts` ; lecture/écriture `pptx/src/smartart.ts` ; autres modules : atome conservé | P2 |
| COM-059 | Tableau : styles, dessiner un tableau, effacer, formule de cellule (=SUM(ABOVE)), convertir texte <-> tableau | oui | Partiel | conversions texte/tableau présentes (`T.cmd.toText`, `drawTable`) ; formule de cellule et gomme de tableau absentes | P2 |
| COM-060 | Insertion depuis stockage / URL (image, document) | partiel | Absent | HPL ; équivalent local = depuis fichier ou presse-papiers | P3 |

---

## 2. Éditeur de documents (documenteditor) face à Texte (`packages/word`)

Références ForgeOffice : `packages/word/STATUS.md`, `packages/word/src/strings.ts` (liste des commandes câblées), `packages/docx`.
Rappel : le détail de l'équivalence Word est dans WORD.md ; ici on liste ce que l'interface ONLYOFFICE expose.

### 2.1 Onglet Accueil

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-001 | Presse-papiers : Copier, Couper, Coller, Copier le style, Effacer le style | oui | Présent mais à vérifier | `T.cmd.paste/cut/copy/painter/clearFormat` | P1 |
| DE-002 | Police, Taille, Augmenter/Diminuer la taille | oui | Présent mais à vérifier | `T.cmd.font/size/grow/shrink` | P1 |
| DE-003 | Gras, Italique, Souligné, Barré, Exposant, Indice | oui | Présent mais à vérifier | `T.cmd.bold...sup` | P1 |
| DE-004 | Couleur de police (dont « Automatique ») et Couleur de surlignage (« Pas de surbrillance ») | oui | Présent mais à vérifier | `T.cmd.fontColor`, `highlight` | P1 |
| DE-005 | Modifier la casse (Majuscule en début de phrase, minuscule, MAJUSCULES, Chaque Mot, iNVERSER) | oui | Présent mais à vérifier | `T.cmd.caseSentence...caseToggle` | P1 |
| DE-006 | Puces (rondes, vides, carrées, étoiles, flèches, coches, losanges, tirets, Image comme puce, Symbole comme puce), bibliothèque + puces du document + récentes | oui | Partiel | puces de bibliothèque oui (`bulletLibrary`) ; puce image et puce symbole non relevées | P2 |
| DE-007 | Numérotation (1. 1) a. A. i. I. et formats non latins), « Définir la valeur de numérotation », Recommencer, Continuer | oui | Partiel | numérotation + `restartNumbering` ; valeur de départ personnalisée non relevée | P2 |
| DE-008 | Liste multiniveau (articles, chapitres, titres numérotés, symboles, divers), « Paramètres de la liste » (niveau par niveau : format, retrait, police) | oui (Liste à plusieurs niveaux, Définir une nouvelle liste) | Partiel | liste à plusieurs niveaux (`multilevel`) ; éditeur de définition par niveau absent | P2 |
| DE-009 | Retrait : augmenter/réduire ; « Changer le niveau de liste » | oui | Présent mais à vérifier | `outdent/indent` | P1 |
| DE-010 | Interligne et options (simple, 1,15, 1,5, 2, au moins, exactement, multiple), Ajouter/Supprimer l'espace avant/après | oui | Présent mais à vérifier | `lineSpacing`, `addSpaceBefore`, `removeSpaceAfter`, `lineSpacingOptions` | P1 |
| DE-011 | Alignement gauche / centre / droite / justifié | oui | Présent mais à vérifier | `alignLeft...justify` | P1 |
| DE-012 | Direction du texte (gauche à droite / droite à gauche) du paragraphe | oui | Absent | aucune commande de direction de paragraphe | P2 |
| DE-013 | Trier (liste/paragraphes) | oui | Présent mais à vérifier | `T.cmd.sort` | P2 |
| DE-014 | Afficher les caractères non imprimables (Afficher tout) | oui | Présent mais à vérifier | `T.cmd.showMarks` | P1 |
| DE-015 | Ombrage de paragraphe (Trame de fond) + Bordures (11 boutons) | oui | Présent mais à vérifier | `shading`, `borders` | P1 |
| DE-016 | Galerie de styles (Normal, Sans espacement, Titre 1-9, Titre, Sous-titre, Citation, Citation intense, Liste paragraphe, Lien...) | oui | Présent mais à vérifier | `styles.gallery`, CSS des styles (`editor/css.ts`) | P1 |
| DE-017 | Nouveau style à partir de la sélection, Mettre à jour selon la sélection, Supprimer le style, Restaurer les styles par défaut | oui (Créer un style, Mettre à jour) | Partiel | `createStyle` ; mise à jour / restauration non relevées | P2 |
| DE-018 | Jeu de couleurs (Modifier le jeu de couleurs : 22+ jeux nommés) | oui (Couleurs du thème) | Présent mais à vérifier | `T.cmd.colors`, `features/design.ts` | P2 |
| DE-019 | Rechercher / Remplacer (barre, panneau), Tout sélectionner | oui | Présent mais à vérifier | `editor/find.ts` | P1 |
| DE-020 | Menu « Texte à partir d'un fichier » (Insérer le texte d'un document local / stockage / URL) | oui (Insérer > Texte à partir d'un fichier) | Absent | aucune commande | P3 |

### 2.2 Onglet Insertion

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-030 | Page vide / Page de garde | oui | Présent mais à vérifier | `blankPage`, `coverPage` (`T.cover`) | P1 |
| DE-031 | Sauts : page, colonne, section (page suivante, continue, page paire, page impaire) | oui | Présent mais à vérifier | `pageBreak`, `columnBreak`, `sectionNext/Continuous/Even/Odd` | P1 |
| DE-032 | Tableau : grille d'insertion, Insertion personnalisée, Dessiner un tableau, Effacer le tableau, Insérer une feuille de calcul, Convertir texte en tableau | oui | Partiel | insertion + conversion oui ; dessiner/effacer/feuille incorporée absents | P1 |
| DE-033 | Image : depuis un fichier, de l'espace de stockage, d'une URL | oui | Partiel | fichier oui (20 Mo max) ; URL absente (volontaire, données hostiles) | P1 |
| DE-034 | Forme : bibliothèque (≈ 190 formes, flèches, légendes, organigramme, étoiles) | oui | Partiel | `T.cmd.shapes` : jeu réduit dans Texte (`shapeRect`) ; PowerPoint 187 formes ECMA | P1 |
| DE-035 | Graphique : 20+ types (colonnes, barres, lignes, secteurs, aires, nuages, boursier, radar, combiné) avec classeur de données | oui | Absent | aucun graphique dans Texte (`docx` lit le graphique comme élément brut) ; moteur existe dans `excel`/`pptx` (chart-read/write) | P1 |
| DE-036 | SmartArt | oui | Partiel | atome conservé à l'ouverture, pas de création | P2 |
| DE-037 | Zone de texte horizontale / verticale | oui | Présent mais à vérifier | `textBox` | P1 |
| DE-038 | Text Art | oui (WordArt) | Absent | — | P3 |
| DE-039 | Équation (≈ 140 structures : fractions, scripts, radicaux, intégrales, grands opérateurs, crochets, fonctions, accents, limites, opérateurs, matrices) | oui | Partiel | 5 équations prédéfinies + saisie texte ; pas de structures | P1 |
| DE-040 | Symbole (dialogue) et symboles rapides (©, ®, ™, °, ±, ≠, ∞, α, β, π, Δ, √, €, ¥...) | oui | Présent mais à vérifier | `symbol`, `moreSymbols` | P1 |
| DE-041 | Contrôles de contenu : texte riche, texte brut, image, zone de liste déroulante, liste déroulante, date, case à cocher | oui (Contrôles de contenu du développeur) | Partiel | le modèle `ContentControlProps` (`docx/src/docx/read-body.ts`) conserve les `w:sdt` à l'aller-retour ; aucune commande d'insertion ni édition | P1 |
| DE-042 | Paramètres du contrôle de contenu (titre, tag, couleur, apparence boîte/balises/aucune, verrouillage suppression/édition, espace réservé, liste de valeurs, format de date + langue, symbole coché/décoché, supprimer le contrôle à la modification du contenu) | oui (Propriétés du contrôle) | Absent | — | P1 |
| DE-043 | Paramètres de surbrillance des contrôles (couleur) | oui | Absent | — | P3 |
| DE-044 | En-tête / Pied de page (Modifier, Supprimer), numéro de page (haut, bas, à la position actuelle), nombre de pages | oui | Présent mais à vérifier | `header/footer/pageNumber`, `headerFooter` | P1 |
| DE-045 | Lettrine (Lettrine dans le texte / dans la marge, paramètres avancés : police, lignes, distance) | oui | Partiel | modèle (`docx/src/docx/read-props.ts` : `dropCap`) lu/écrit ; aucune commande de l'éditeur Texte (Publisher en a une) | P2 |
| DE-046 | Lien hypertexte (adresse, bulle, texte), Signet, Renvoi | oui | Présent mais à vérifier | `link`, `bookmark`, `crossRef` | P1 |
| DE-047 | Date et heure (format + langue, mise à jour automatique) | oui | Présent mais à vérifier | `T.cmd.date`, champs DATE/TIME | P1 |
| DE-048 | Commentaire (Ajouter) | oui | Présent mais à vérifier | `comment` | P1 |
| DE-049 | Note de bas de page / de fin (menu : insérer, paramètres, supprimer toutes, convertir) | oui | Présent mais à vérifier | `footnote`, `endnote` ; notes de fin dans le volet seulement (STATUS) | P1 |
| DE-050 | Champ (menu Champ : Page, Pages, Date, Auteur, Titre...) | oui (Composants QuickPart) | Présent mais à vérifier | `insertField`, `fieldNames` | P2 |
| DE-051 | Insérer un code QR / code-barres (plugin insertQR) | non ★ | Absent | voir PLG | P3 |

### 2.3 Onglet Mise en page et mise en forme des objets

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-060 | Marges (Normal, Étroit, Modéré, Large, Personnalisées + dernières personnalisées) | oui | Présent mais à vérifier | `marginsPresets`, `customMargins` | P1 |
| DE-061 | Orientation (Portrait, Paysage) | oui | Présent mais à vérifier | `portrait/landscape` | P1 |
| DE-062 | Taille de page (Lettre, A4, A5, A3, B4... + personnalisée) | oui | Présent mais à vérifier | `T.sizes` : 6 formats ; B4/B5/enveloppes non listés | P1 |
| DE-063 | Colonnes (Une, Deux, Trois, À gauche, À droite, Personnalisées avec largeurs/espacement/séparateur) | oui | Présent mais à vérifier | `columnsPresets`, `columnsSpace` | P1 |
| DE-064 | Numéros de ligne (Aucun, Continu, Recommencer à chaque page / section, Supprimer pour le paragraphe, Options) | oui | Présent mais à vérifier | `lineNumbers*` (`layout/flow.ts`) | P2 |
| DE-065 | Coupure de mots (Aucune, Automatique, Manuelle, Options : zone de césure, limite de traits d'union, mots en majuscules) | oui | Partiel | `T.cmd.hyphenation` ; options détaillées non relevées | P3 |
| DE-066 | Couleur de la page | oui | Partiel | stockée en propriété personnalisée, invisible dans Word (STATUS) | P2 |
| DE-067 | Filigrane (texte : confidentiel, brouillon, urgent... ; image ; personnalisé : police, taille, couleur, diagonal/horizontal, semi-transparent) | oui | Partiel | `T.watermarks` + `docx/src/docx/watermark.ts` ; image en filigrane non relevée | P2 |
| DE-068 | Numérotation des pages : « Commencer à » / continuer / recommencer à chaque section | oui (Format des numéros de page) | Partiel | `docx` lit les sections ; dialogue dédié absent | P2 |
| DE-069 | Aligner, Grouper/Dissocier, Avancer/Reculer (premier plan / arrière-plan), Habillage (aligné, carré, rapproché, au travers, haut et bas, devant, derrière) | oui | Partiel | habillage : approximé par flottement CSS, pas de positionnement absolu (STATUS) ; groupes absents dans Texte | P1 |
| DE-070 | Bordures de page | oui | Présent mais à vérifier | `T.cmd.pageBorders` | P2 |
| DE-071 | Aligner les objets sur la marge / la page / les objets sélectionnés, distribuer | oui | Absent | pas de multi-sélection d'objets dans Texte | P2 |
| DE-072 | Combiner les formes dans Texte | oui | Absent | voir COM-055 | P3 |
| DE-073 | Position avancée de l'image / forme (alignement, positions absolues relatives à page/marge/colonne/paragraphe, flottement avec le texte, chevauchement, texte alternatif) | oui (Disposition > Position) | Absent | « positionnement absolu absent » (STATUS word) | P1 |
| DE-074 | Rogner l'image : rogner, remplir, ajuster, rogner à la forme | oui | Partiel | taille dans l'onglet Format ; rognage graphique non relevé | P2 |
| DE-075 | Remplacer l'image (depuis fichier / URL / stockage) | oui (Modifier l'image) | Partiel | suppression + réinsertion (`deletePicture`) | P3 |
| DE-076 | Image : effets (ombre, reflet, bords adoucis, luminosité/contraste, recolorier), rotation 90°, retournement | oui | Partiel | rotation, retournement, bordure oui ; effets non relevés | P2 |
| DE-077 | Enregistrer l'image sous (menu contextuel) | oui | Absent | — | P3 |
| DE-078 | Remplissage d'une forme : couleur, dégradé (linéaire/radial, points), image/texture (bois, granit, cuir, tissu, papier...), motif | oui | Partiel | formes de Texte rudimentaires (`shapeRect`) ; remplissages complets dans PowerPoint | P2 |

### 2.4 Onglet Références

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-090 | Table des matières : tables automatiques, table manuelle, paramètres (niveaux 1-9, numéros de page, alignement à droite, points de suite, hyperliens, styles de titres, table à partir des plans) | oui | Présent mais à vérifier | `features/toc.ts`, `T.toc` (auto 1 / auto 2) ; table manuelle et styles personnalisés non relevés | P1 |
| DE-091 | Mettre à jour la table (toute la table / numéros de page seulement), Supprimer la table, « Ajouter du texte » (niveau) , « Ne pas afficher dans la table des matières » | oui | Présent mais à vérifier | `updateToc`, `removeToc`, `addText` ; « pages seulement » absent | P1 |
| DE-092 | Notes : Insérer note de bas de page / de fin ; Paramètres des notes (emplacement bas de page / sous le texte, colonnes, format du numéro, début, numérotation continue / chaque page / chaque section, repère personnalisé) ; Convertir toutes les notes ; Passer aux notes ; Supprimer toutes les notes | oui | Partiel | insertion + note suivante (`nextNote`) ; paramètres, conversion et basculement absents ; zone du texte non réduite (STATUS) | P2 |
| DE-093 | Signet (dialogue : nom, Ajouter, Atteindre, Supprimer, tri par nom/position, signets masqués) | oui | Présent mais à vérifier | `T.dialogs.bookmarkName` | P1 |
| DE-094 | Renvoi (types : Élément numéroté, Titre, Signet, Note de bas de page, Note de fin, Équation, Figure, Tableau ; insérer en tant que : texte, numéro de page, haut/bas, paragraphe, hyperlien, « Séparer par ») | oui | Partiel | `crossRefType`, `crossRefHeading` ; types limités (titre, signet) | P2 |
| DE-095 | Légende (étiquette Figure / Tableau / Équation / personnalisée, numérotation, chapitre, position au-dessus / en dessous, exclure l'étiquette) | oui | Présent mais à vérifier | `T.dialogs.captionTitle` | P2 |
| DE-096 | Table des figures (par légende, par style, options, mise à jour, remplacement) | oui (Table des illustrations) | Présent mais à vérifier | `tableOfFigures` | P2 |
| DE-097 | Hyperlien (dialogue : lien externe, emplacement dans le document, texte, info-bulle) | oui | Présent mais à vérifier | `link`, `removeLink` | P1 |
| DE-098 | Citations / bibliographie via plugins Zotero et Mendeley (ONLYOFFICE n'a pas de gestionnaire intégré) | oui (Citations et bibliographie intégrées) | Présent mais à vérifier | `citation`, `manageSources`, `bibliography` : ForgeOffice a l'équivalent Word natif, ce qui rend les plugins inutiles pour l'usage de base | P2 |
| DE-099 | Index (marquer l'entrée, insérer l'index) | oui | Présent mais à vérifier | `markEntry`, `insertIndex` (ONLYOFFICE n'a pas d'index natif ★ : ForgeOffice en a plus) | P3 |

### 2.5 Onglet Formulaires (formulaires remplissables, ★ famille ONLYOFFICE : DOCXF / OFORM)

Voir aussi les sections PDF (7) : ONLYOFFICE 9 crée et remplit les mêmes champs dans un PDF.

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-110 | Champ de texte : en ligne ou à taille fixe ; limite de caractères ; peigne de caractères (cases réparties) ; ajuster automatiquement ; multiligne | Contrôle de contenu texte / champ texte hérité ; peigne ★ | Absent | aucun champ de formulaire dans Texte | P1 |
| DE-111 | Zone de liste déroulante (combo : saisie libre + liste) | Contrôle de contenu « Zone de liste déroulante » | Absent | — | P1 |
| DE-112 | Liste déroulante (valeurs imposées) | Contrôle de contenu « Liste déroulante » | Absent | — | P1 |
| DE-113 | Case à cocher (symbole coché/décoché personnalisable) | oui | Absent | — | P1 |
| DE-114 | Bouton radio (groupes par « clé de groupe ») | non ★ (Word : cases d'option de formulaire hérité ActiveX) | Absent | — | P1 |
| DE-115 | Champ image (mise à l'échelle toujours / jamais / trop grande / trop petite, verrouiller les proportions, position) | Contrôle de contenu Image | Absent | — | P2 |
| DE-116 | Champs préformatés : Adresse e-mail, Numéro de téléphone, Code postal, Carte de crédit, Date et heure (format + langue) | non ★ | Absent | — | P2 |
| DE-117 | Champ complexe (zone mêlant texte, image et champs) | non ★ | Absent | — | P3 |
| DE-118 | Signature (champ de signature dans le formulaire) | Ligne de signature | Absent | — | P3 |
| DE-119 | Paramètres de champ (panneau de droite) : clé, étiquette (tag), conseil (info-bulle), obligatoire, espace réservé, couleur de bordure, couleur d'arrière-plan, verrouiller, « Champs connectés » (valeurs liées), valeur par défaut, options de valeur (ajouter / supprimer / monter / descendre) | partiel (propriétés de contrôle) | Absent | — | P1 |
| DE-120 | Formats de saisie : Aucun, Chiffres, Lettres, Masque arbitraire, Expression régulière + symboles autorisés | non ★ | Absent | — | P2 |
| DE-121 | Gérer les rôles des destinataires (ajouter, modifier, ordre de remplissage, couleur par rôle ; « Tout le monde ») | non ★ | Absent | HPL partiel : le rôle devient une étiquette locale, sans serveur | P2 |
| DE-122 | Surbrillance des champs (couleur / pas de surbrillance) | non ★ | Absent | — | P3 |
| DE-123 | Aperçu du formulaire (mode remplissage) + Champ suivant / précédent + Effacer tous les champs | non ★ | Absent | — | P1 |
| DE-124 | Remplir et envoyer (Envoyer le formulaire) / Remplissage par plusieurs destinataires | non ★ | Absent | HPL ; équivalent local = enregistrer le formulaire rempli puis l'envoyer par messagerie / dossier partagé | P3 |
| DE-125 | Enregistrer sous PDF (formulaire rempli ou modèle) / Télécharger au format PDF | PDF (Fichier > Exporter) | Partiel | module PDF crée des champs AcroForm (`pdf/src/forms.ts`) ; pas de passerelle Texte -> PDF avec champs | P1 |
| DE-126 | Marquer comme final / Formulaire protégé (verrou après signature) | oui | Absent | `markFinal` existe pour le document, pas pour un formulaire | P3 |
| DE-127 | Mode « remplissage seul » : protection du document autorisant uniquement le remplissage des formulaires | oui (Restreindre la modification > Remplissage de formulaires) | Absent | `restrict` = lecture seule seulement | P1 |
| DE-128 | Format DOCXF (modèle de formulaire) et OFORM (formulaire à remplir) | non ★ | Absent | aucun des deux formats | P2 |

### 2.6 Onglets Collaboration / Révision, Protection, Dessiner, Affichage

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-140 | Suivi des modifications (ON/OFF pour moi, pour tous) | oui | Présent mais à vérifier | `editor/track.ts` ; « pour tous » = HPL | P1 |
| DE-141 | Affichage des révisions : Balisage et bulles, Balisage uniquement, Final, Original | oui | Présent mais à vérifier | `markupAll/Simple/None/Original` | P1 |
| DE-142 | Accepter / Rejeter (actuelle, toutes), Précédente / Suivante | oui | Présent mais à vérifier | `accept`, `rejectAll`, `prevChange` | P1 |
| DE-143 | Popover de révision (clic sur la modification : accepter, rejeter, auteur, date) | oui | Présent mais à vérifier | volet Modifications (STATUS) | P2 |
| DE-144 | Comparer (document local / URL / stockage ; paramètres : niveau caractères ou mots ; afficher les modifications) | oui (Comparer) | Présent mais à vérifier | `features/compare.ts` ; niveau caractères/mots non relevé | P1 |
| DE-145 | Combiner (fusionner deux versions) | oui (Combiner) | Absent | seule la comparaison existe | P2 |
| DE-146 | Commentaires : supprimer tous / les miens / actuels, résoudre tous / les miens / actuels | oui (partiel) | Partiel | suppression par commentaire et résolu présents ; actions de masse non relevées | P2 |
| DE-147 | Historique des versions | oui | Absent | voir COM-022 | P2 |
| DE-148 | Partage / droits d'accès | oui | Absent | HPL | P3 |
| DE-149 | Publipostage (Fusion et publipostage : source = fichier CSV/XLSX/stockage, aperçu, fusionner vers PDF / DOCX / E-mail) | oui (Publipostage) | Partiel | source CSV, champs, aperçu, fusion (`features/merge.ts`) ; sources XLSX et envoi par e-mail absents ; limite ONLYOFFICE : 100 destinataires par e-mail | P1 |
| DE-150 | Champ de fusion : insérer, surligner les champs, aperçu des résultats, premier / précédent / suivant / dernier enregistrement | oui | Présent mais à vérifier | `mergeField`, `previewResults`, `prevRecord/nextRecord` | P1 |
| DE-151 | Fusionner vers E-mail (objet, destinataire, format pièce jointe, message) | oui | Absent | — | P3 |
| DE-160 | Protection > Chiffrer (ajouter / modifier / supprimer le mot de passe) | oui | Partiel | voir COM-041 | P1 |
| DE-161 | Protection > Protéger le document (Aucune modification, Commentaires, Remplissage de formulaires, Suivi des modifications ; mot de passe 15 caractères max) | oui (Restreindre la modification) | Partiel | `T.cmd.restrict` : lecture seule uniquement, pas de mots de passe ni modes | P1 |
| DE-162 | Protection > Signature numérique visible / invisible, ajouter la zone de signature | oui | Absent | voir COM-040 | P2 |
| DE-170 | Onglet Dessiner : Stylo (couleur, épaisseur 0,05-30 mm), Surligneur, Gomme, Sélectionner | oui (Dessin) | Présent mais à vérifier | `pen/highlighter/eraser`, `T.draw` (encre = image PNG, pas d'objet encre) | P2 |
| DE-171 | Plugins (onglet) : liste des plugins installés, Plus | oui (Compléments) | Absent | voir COM-039 | P1 |
| DE-180 | Affichage > Navigation (panneau des titres : monter/descendre niveau, nouveau titre avant/après, sélectionner le contenu, tout réduire, développer jusqu'au niveau, taille de police, renvoi à la ligne) | oui (Volet Navigation) | Présent mais à vérifier | `T.dialogs.navTitle`, `promote/demote`, `showLevel` | P1 |
| DE-181 | Affichage > Miniatures de pages (taille, partie visible) | non ★ (Word : Plusieurs pages) | Partiel | « Plusieurs pages » = vignettes en lecture seule (STATUS) | P3 |
| DE-182 | Zoom, Ajuster à la page / largeur, Zoom 100 %, Plusieurs pages | oui | Présent mais à vérifier | `zoom`, `onePage`, `multiPage`, `pageWidth` | P1 |
| DE-183 | Règles, barre d'état, panneau gauche / droit (afficher/masquer) | oui | Présent mais à vérifier | `ruler`, barre d'état | P1 |
| DE-184 | Thème d'interface, Document sombre, Macros (enregistrement) | partiel | Partiel | voir COM-005, COM-006, COM-035 | P2 |
| DE-185 | Mode lecture / Web / Plan / Brouillon / Focus / Lecteur immersif (ForgeOffice en a plus qu'ONLYOFFICE) | oui | Présent mais à vérifier | `T.views` | P2 |

### 2.7 Onglet En-tête et pied de page (contextuel) et paramètres de droite

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-200 | Position de l'en-tête depuis le haut / du pied depuis le bas | oui | Partiel | marges d'en-tête dans la mise en page ; réglage dédié non relevé | P2 |
| DE-201 | Première page différente / Pages paires et impaires différentes | oui | Présent mais à vérifier | `diffFirst` ; paires/impaires non relevé | P1 |
| DE-202 | Lier à la précédente (par section) | oui | Partiel | une seule géométrie, sections lues (`features/sections.ts`) ; liaison à la section précédente non relevée | P2 |
| DE-203 | Champs : numéro de page, nombre de pages, date et heure, format de numérotation (1, i, I, a, A), « Insérer un champ » | oui | Présent mais à vérifier | `fieldPage`, `fieldPages`, `fieldDate` | P1 |
| DE-204 | Image dans l'en-tête (fichier / URL / stockage) | oui | Partiel | image insérable dans le corps ; dans l'en-tête non relevé | P3 |
| DE-205 | Fermer l'en-tête et le pied de page | oui | Présent mais à vérifier | `closeHeader` | P1 |
| DE-206 | Panneau droit Paragraphe : retraits, espacement, interligne, avant/après, ombre, bordures, « Paramètres avancés » (onglets Retraits et espacement, Saut de ligne et de page, Bordures et remplissage, Police : barré double, petites capitales, MAJUSCULES, espacement et position des caractères, Tabulations, Marges) | oui (Paragraphe...) | Partiel | dialogue Paragraphe + Police (`T.dialogs.paragraph`, `font`, `effects`) ; taquets de tabulation non rendus dans le corps (STATUS) | P1 |
| DE-207 | Panneau droit Tableau : lignes, colonnes, taille, répéter l'en-tête, marges de cellule, styles de tableau, bordures, position / habillage du tableau, texte alternatif, « Avancé » (largeur préférée, alignement, retrait, espacement des cellules) | oui | Partiel | onglets contextuels Création/Disposition de tableau (`T.tabs.tableDesign`, `tableLayout`) ; habillage du tableau et espacement des cellules non relevés | P1 |
| DE-208 | Panneau droit Image : taille, proportions, rotation, retournement, remplacer, texte alternatif, habillage, avancé | oui | Présent mais à vérifier | onglet Format de l'image (`T.tabs.picture`) | P1 |
| DE-209 | Panneau droit Forme : remplissage, trait, opacité, habillage, ombre, rotation, flèches, marges du texte, colonnes dans une forme, ajustement automatique | oui | Partiel | formes de base | P2 |
| DE-210 | Panneau droit Graphique (type, données, axes, titres, légende, étiquettes, 136 options avancées) | oui | Absent | pas de graphique dans Texte | P1 |
| DE-211 | Panneau droit En-tête/pied, Signature, Contrôle de contenu, Publipostage, Formulaire, Text Art | oui | Partiel | seul le publipostage a un équivalent (`ribbon/references.ts` onglet Publipostage) | P2 |

### 2.8 Menu contextuel (DocumentHolder) : 316 libellés, regroupés

| ID | Fonction ONLYOFFICE | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-220 | Couper / Copier / Coller (+ options de collage) | oui | Présent mais à vérifier | `T.ctx` | P1 |
| DE-221 | Menu orthographique (suggestions, Ignorer, Ajouter au dictionnaire, Langue, Synonymes ; plugin Thésaurus) | oui | Partiel | `T.ctx.native` (menu du navigateur), `synonyms` « aucun synonyme hors connexion », `translate (bientôt)` | P1 |
| DE-222 | Paragraphe : Paramètres avancés, Style, Redémarrer la numérotation, Continuer, Définir la valeur, Changer le niveau, Tout sélectionner | oui | Partiel | police / paragraphe / liste oui ; définir la valeur de numérotation absent | P2 |
| DE-223 | Lien : Modifier / Ouvrir / Copier / Supprimer le lien | oui | Présent mais à vérifier | `link`, `removeLink` | P1 |
| DE-224 | Tableau : insérer / supprimer lignes et colonnes, fusionner / fractionner, répartir (lignes / colonnes), aligner la cellule (9 positions), direction du texte (horizontal, rotation 90 / 270), marges de cellule, bordures, ombrage, « Formule », « Convertir en texte », « Trier » | oui | Partiel | insertion / suppression / fusion / alignement / tri / conversion oui ; répartir, formule de cellule, rotation de cellule non relevés | P1 |
| DE-225 | Image / forme : Habillage, Organiser, Aligner, Grouper, Rotation, Retourner, Rogner, Remplacer, Propriétés avancées, « Enregistrer sous image », « Convertir en forme libre » | oui | Partiel | habillage, rotation, retournement oui ; reste absent | P2 |
| DE-226 | Équation : propriétés (alignement, insertion de saut, grand opérateur...), changer en inline / affiché, Convertir en Unicode / LaTeX | oui | Absent | équation = atome texte | P2 |
| DE-227 | Note : Aller à la note, Convertir, Paramètres des notes | oui | Absent | — | P3 |
| DE-228 | Contrôle de contenu : paramètres, supprimer | oui | Absent | voir DE-041/042 | P1 |
| DE-229 | En-tête / pied : Modifier, Supprimer, Lier à la précédente | oui | Présent mais à vérifier | `editHeader/removeHeader` | P1 |
| DE-230 | Commentaire : modifier, supprimer, résoudre | oui | Présent mais à vérifier | volet Commentaires | P1 |
| DE-231 | Révision : accepter / rejeter dans le menu contextuel | oui | Partiel | boutons du ruban ; menu contextuel non relevé | P2 |
| DE-232 | Titre : « Ajouter à la table des matières / Mettre à jour la table » depuis le menu | oui | Partiel | commandes du ruban | P3 |
| DE-233 | Texte : Traduire (plugin), Rechercher dans Wikipedia / YouTube (plugins) | non ★ | Absent | voir PLG | P3 |

### 2.9 Dialogues propres à l'éditeur de documents (non couverts plus haut)

| ID | Fonction ONLYOFFICE | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| DE-240 | Aller à la page (barre d'état) | oui | Présent mais à vérifier | `goToTitle`, `goToPage` | P2 |
| DE-241 | Statistiques de la barre d'état (pages, paragraphes, mots, symboles avec/sans espaces) | oui | Présent mais à vérifier | `wordCount`, `features/stats.ts` + lisibilité, temps de lecture (en plus) | P1 |
| DE-242 | Tabulations avancées (position, alignement, caractère de remplissage) | oui | Partiel | `features/tabstops.ts` ; rendu dans le corps absent (STATUS) | P2 |
| DE-243 | Style de liste « Paramètres de la liste » avancés (liste liée à un style) | oui | Absent | — | P3 |
| DE-244 | Page : « Dialogue Taille de page / Marges » | oui | Présent mais à vérifier | `pageSetup` | P1 |
| DE-245 | Colonnes personnalisées (nombre, largeur, espace, ligne de séparation) | oui | Présent mais à vérifier | `columnsSpace` | P2 |
| DE-246 | Coller spécial : formaté / texte seul | oui | Présent mais à vérifier | `pasteSpecial`, `pasteFormatted` | P2 |
| DE-247 | Tri de texte (Trier : par paragraphes, croissant / décroissant, numérique / date) | oui | Présent mais à vérifier | `sortTitle` | P3 |
| DE-248 | Mode Plan | oui | Présent mais à vérifier | `T.tabs.outline` | P2 |
| DE-249 | Impression avec aperçu (`PrintWithPreview`) | oui | Partiel | Imprimer du Backstage ; PDF via l'impression système seulement (`T.backstage.printHint`) | P1 |

---

## 3. Éditeur de feuilles de calcul (spreadsheeteditor) face à Tableur (`packages/excel`)

Références : `packages/excel/STATUS.md`, `packages/xlsx`, `packages/formulas` (505 fonctions). Détail Excel dans EXCEL.md. La liste complète des fonctions ONLYOFFICE est en annexe A.

### 3.1 Accueil, Insertion, Mise en page

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| SSE-001 | Police, taille, gras / italique / souligné / barré, couleur de police, couleur de remplissage | oui | Présent mais à vérifier | STATUS excel « Mise en forme » | P1 |
| SSE-002 | Bordures (menu complet : style, couleur, toutes, extérieures, intérieures, diagonales) | oui | Présent mais à vérifier | « 14 bordures » (STATUS) | P1 |
| SSE-003 | Alignements horizontal et vertical, orientation du texte (angle, vertical), renvoi à la ligne, retrait | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-004 | Fusionner et centrer / Fusionner les cellules / Fusionner sur les lignes / Annuler la fusion | oui | Présent mais à vérifier | « fusion (4 modes) » | P1 |
| SSE-005 | Formats de nombre : Général, Nombre, Monétaire, Comptabilité, Date courte / longue, Heure, Pourcentage, Fraction, Scientifique, Texte, Spécial, Personnalisé + devises (€, $, £, CHF, ₽, ¥) | oui | Présent mais à vérifier | `formulas/src/format`, STATUS (€/$/£/CHF) ; rouble et yen non relevés | P1 |
| SSE-006 | Style de virgule, ajouter / réduire les décimales, style comptable, pourcentage | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-007 | Mettre sous forme de modèle de tableau (Clair, Moyen, Sombre, Personnalisé) | oui | Présent mais à vérifier | « 60 styles » | P1 |
| SSE-008 | Style de cellule (galerie) | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-009 | Mise en forme conditionnelle : règles (valeur, texte, date, doublons, 10 premiers, moyenne, formule), barres de données, nuances de couleurs, jeux d'icônes, gérer les règles, effacer | oui | Présent mais à vérifier | STATUS (14 jeux d'icônes) ; barres de données dégradé/plein/négatives non recoupées | P1 |
| SSE-010 | Somme automatique + menu (Moyenne, Nombre, Max, Min) | oui | Présent mais à vérifier | `fn.sum/count/average...` | P1 |
| SSE-011 | Remplir (série vers le bas / droite / haut / gauche, série personnalisée : linéaire, géométrique, date, jour ouvrable, tendance, incrément, valeur limite) | oui | Partiel | poignée de recopie + séries ; dialogue Série (FillSeriesDialog) non relevé | P2 |
| SSE-012 | Effacer (tout, texte, format, commentaires, liens) | oui | Présent mais à vérifier | « Effacer » (STATUS ruban) | P1 |
| SSE-013 | Trier et filtrer : croissant, décroissant, tri personnalisé (niveaux, options : sensible à la casse, orientation), filtre automatique, effacer, appliquer à nouveau | oui | Présent mais à vérifier | STATUS « Données » | P1 |
| SSE-014 | Hauteur de ligne / largeur de colonne (menu Format), masquer / afficher, ajuster | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-015 | Insérer / supprimer cellules (décaler à droite / bas / ligne / colonne) | oui | Présent mais à vérifier | `logic/structure.ts` | P1 |
| SSE-016 | Casse du texte (menu Modifier la casse sur les cellules) | non ★ (Excel : formules MAJUSCULE...) | Absent | — | P3 |
| SSE-017 | Rechercher / Remplacer (cellule / feuille / classeur, valeurs ou formules, ligne / colonne, correspondance entière) | oui | Partiel | recherche présente ; portée « classeur » et « dans les formules » non recoupées | P1 |
| SSE-018 | Orientation de la feuille de gauche à droite / droite à gauche | oui | Absent | aucune chaîne RTL feuille | P3 |
| SSE-020 | Insertion > Tableau croisé dynamique, Tableau, Graphique, Graphique recommandé, Sparkline, Segment, Image, Forme, Zone de texte, Text Art, Équation, Symbole, Lien, En-tête/Pied de page, SmartArt | oui (+ ★ Text Art) | Partiel | TCD, tableau, graphiques, images, formes, sparklines, liens, symboles oui ; Segment, Text Art, Équation, SmartArt, Zone de texte absents ou partiels | P1 |
| SSE-021 | Graphique recommandé (assistant de type, aperçu) | oui | Présent mais à vérifier | « Graphique recommandé » (`excel/src/strings.ts`) | P2 |
| SSE-022 | Assistant graphique (ChartWizard : types, combiné, axe secondaire, limites de points) | oui | Partiel | 9 types dessinés en SVG ; radar et bulles rendus en nuage (STATUS) | P1 |
| SSE-023 | Types de graphique ONLYOFFICE : colonnes, barres, lignes, secteurs, aires, nuages, boursier (hausse-baisse), radar, combiné, histogramme groupé/empilé/100 %, secteurs 3D, anneau | oui | Partiel | histogramme, barres, courbes, secteurs, anneau, aires, nuages, combiné ; boursier, radar réel, 3D absents | P1 |
| SSE-024 | Paramètres du graphique (136 options : titres, axes, grille, étiquettes de données, légende, lignes de tendance, barres d'erreur, hauts-bas, axe secondaire, échelle logarithmique, bordures de séries) | oui | Partiel | type, légende, étiquettes, quadrillage, couleurs ; pas d'éditeur de séries ni de titres d'axes (STATUS) | P1 |
| SSE-025 | Sparklines : types colonne / ligne / gain-perte, points haut / bas / premier / dernier / négatifs, axe, groupes | oui | Présent mais à vérifier | « sparklines » ; types et points non recoupés | P2 |
| SSE-026 | Segment (filtre visuel pour tableaux, TCD) : styles, colonnes, boutons, tri, masquer les éléments vides, verrouiller | oui | Absent | aucun objet segment (recherche vide) | P1 |
| SSE-027 | Mise en page : marges, orientation, taille, zone d'impression, sauts de page (insérer / supprimer / réinitialiser), titres à imprimer, mettre à l'échelle (largeur / hauteur / %), quadrillage / en-têtes à l'impression | oui | Partiel | orientation, papier, ajustement, quadrillage, zone d'impression (`excel/src/ui/print.tsx`) ; Titres à imprimer et sauts manuels absents | P1 |
| SSE-028 | En-tête et pied de page (dialogue : première page différente, paires / impaires, échelle avec le document, aligner sur les marges, texte gauche / centre / droite, champs page, pages, date, heure, nom de fichier, feuille, image) | oui | Absent | vue Mise en page sans en-têtes éditables (STATUS) | P2 |
| SSE-029 | Thème de couleurs du classeur (Couleurs) | oui | Partiel | styles de cellules ; jeux de couleurs non relevés | P3 |
| SSE-030 | Visible area (Zone visible / « Définir la zone visible ») | non ★ | Absent | — | P3 |

### 3.2 Formules

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| SSE-040 | Insérer une fonction (assistant, catégories, description des arguments, FormulaWizard) | oui | Présent mais à vérifier | « assistant Insérer une fonction avec résultat en direct » | P1 |
| SSE-041 | Fonctions récentes, Plus de fonctions, bibliothèque par catégories (Finances, Logique, Texte, Date/heure, Recherche, Math, Plus) | oui | Présent mais à vérifier | « bibliothèque par catégories » | P1 |
| SSE-042 | Gestionnaire de noms, Définir le nom, Coller un nom, plages nommées globales / de feuille | oui | Présent mais à vérifier | « gestionnaire de noms » | P1 |
| SSE-043 | Tracer les précédents / dépendants, Supprimer les flèches | oui | Présent mais à vérifier | « antécédents/dépendants (flèches) » | P2 |
| SSE-044 | Afficher les formules | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-045 | Fenêtre Espions (ajouter / supprimer l'espion : classeur, feuille, nom, cellule, valeur, formule) | oui | Absent | aucune chaîne « Espion » | P2 |
| SSE-046 | Options de calcul : automatique / manuel, Calculer le classeur, Calculer la feuille | oui | Présent mais à vérifier | « calcul auto/manuel + F9 » ; « feuille » seule non relevée | P1 |
| SSE-047 | Calcul itératif (nombre max d'itérations, variation maximale) | oui | Partiel | moteur : calcul itératif (`formulas/STATUS`) ; réglage UI : seul calcul auto/manuel | P2 |
| SSE-048 | Style de référence L1C1 | oui | Présent mais à vérifier | `strings.ts` (L1C1) + BackstagePages | P2 |
| SSE-049 | Langue des formules (choix de la langue des noms de fonctions : 30+ langues, exemple SOMME; MIN; MAX) | oui (selon l'Office installé) | Partiel | français et anglais (`toLocalized`/`fromLocalized`) ; autres langues absentes | P2 |
| SSE-050 | Infobulle de la fonction pendant la saisie + saisie semi-automatique | oui | Présent mais à vérifier | `fn-help.ts` | P1 |
| SSE-051 | Évaluation pas à pas | oui | Présent mais à vérifier | STATUS | P3 |
| SSE-052 | Moteur de 492 fonctions ONLYOFFICE : 480 présentes (ForgeOffice 505) | oui | Présent mais à vérifier | annexe A ; absentes : SINGLE, IMPORTRANGE ; non implémentées par ONLYOFFICE lui-même : CUBE*, RTD, JIS | P1 |
| SSE-053 | Fonction personnalisée JavaScript (macro « Fonctions personnalisées » appelable en formule) | non (VBA UDF / LAMBDA / Office Scripts) ★ | Absent | pas de macros ; LAMBDA nommées présentes (`formulas`) comme alternative | P2 |
| SSE-054 | Fonction `IMPORTRANGE` (données d'un autre fichier par URL) | non (Google Sheets) ★ | Absent | réseau : à refuser (WEBSERVICE refusé volontairement) ; alternative locale = référence externe `[fichier.xlsx]` | P3 |
| SSE-055 | Fonction `SINGLE` (intersection implicite @) | oui (@) | Absent | — | P3 |

### 3.3 Données et analyse

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| SSE-060 | Obtenir les données : texte / CSV local, depuis une URL, XML local (dialogue Importer des données : délimiteur, encodage, destination feuille existante / nouvelle) | oui (Obtenir des données) | Partiel | import CSV (`xlsx/src/csv.ts`) ; URL (hors ligne par principe) et XML (`excel/src/ui/actions.ts` : mention XML, import non prouvé) | P2 |
| SSE-061 | Texte en colonnes (délimiteurs, largeur fixe, séparateurs avancés décimal / milliers) | oui | Présent mais à vérifier | `excel/src/logic/data.ts`, `strings.ts` | P1 |
| SSE-062 | Supprimer les doublons | oui | Présent mais à vérifier | `logic/data.ts` | P1 |
| SSE-063 | Validation des données (nombre entier, décimal, liste, date, heure, longueur du texte, personnalisé ; message de saisie ; alerte stop / avertissement / information ; liste depuis une plage) | oui | Présent mais à vérifier | `logic/validation.ts` | P1 |
| SSE-064 | Grouper / Dissocier (lignes, colonnes), Effacer le plan, position des lignes de synthèse | oui | Partiel | niveaux et masquage OK ; boutons +/− dans la marge absents (STATUS) | P2 |
| SSE-065 | Valeur cible (Définir la cellule, Vers la valeur, En modifiant la cellule) | oui | Absent | aucune recherche de valeur cible dans `excel/src` | P1 |
| SSE-066 | Solveur (Simplex LP, GRG non linéaire, Évolutionnaire, contraintes <=, =, >=, ent, bin, dif, options, rapport) | oui (complément Solveur) | Absent | — | P2 |
| SSE-067 | Table de données / Gestionnaire de scénarios (analyse de scénarios) | oui | Absent | ONLYOFFICE n'a pas de gestionnaire de scénarios : le moteur `whatIfAnalysis.js` ne fait que la valeur cible | P3 |
| SSE-068 | Liens externes (Données > Liens externes) | oui | Absent | voir COM-044 | P2 |
| SSE-069 | Filtre automatique avancé : filtres de texte / nombres / dates (conditions « commence par », « est après », 10 premiers), par couleur, par recherche, ?* génériques | oui | Présent mais à vérifier | STATUS « filtres numériques/textuels, 10 premiers, moyenne » ; filtres par couleur non relevés | P1 |
| SSE-070 | Filtres de date par période (aujourd'hui, ce mois, ...) | oui | Partiel | « formats de date conditionnels partiels » (STATUS) | P2 |
| SSE-071 | Tri par couleur de cellule / de police | oui | Absent | — | P3 |
| SSE-072 | Prévision (feuille de prévision) | oui | Partiel | fonctions PREVISION.ETS.* présentes (`forecast-ets.ts`) ; assistant graphique de prévision absent | P3 |
| SSE-073 | Types de données (Actions, Géographie) | oui | Absent | réseau requis, hors périmètre | P3 |
| SSE-074 | Remplissage instantané | oui | Présent mais à vérifier | `excel/src/strings.ts` | P2 |
| SSE-075 | Vues de feuille nommées (Mode Feuille : Nouveau, Gestionnaire d'affichage, Dupliquer, Renommer, Passer à l'affichage, Fermer) : filtres et tris propres à chaque vue sans gêner les autres | Affichages de feuille (365) | Absent | `xlsx` lit `sheetViews` du fichier mais pas de gestionnaire de vues nommées | P2 |
| SSE-076 | Plages protégées (Protéger la plage : titre, plage, accès par utilisateur Refusé / Affichage / Modifier) | Autoriser la modification des plages | Partiel | modèle `protectedRange` dans `xlsx/src/model-page.ts` ; pas d'interface | P2 |

### 3.4 Tableaux, tableaux croisés dynamiques

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| SSE-080 | Onglet Création de tableau : ligne d'en-tête, ligne des totaux, lignes / colonnes à bandes, première / dernière colonne, bouton de filtre, convertir en plage, redimensionner, texte de remplacement, supprimer doublons, insérer TCD, segment | oui | Présent mais à vérifier | onglet contextuel (STATUS) ; segment absent | P1 |
| SSE-081 | Menu contextuel de tableau : insérer / supprimer ligne / colonne, sélectionner colonne / données / ligne / tableau | oui | Présent mais à vérifier | `logic/tables.ts` | P2 |
| SSE-090 | TCD : créer (fenêtre CreatePivotDialog : plage, emplacement), volet de champs (filtres, colonnes, lignes, valeurs), paramètres de champ (sous-totaux, tri, présentation, mise en forme, éléments masqués), paramètres de valeur (somme, nombre, moyenne, max, min, produit, écart type, variance, % du total / de la ligne / de la colonne, différence, cumul) | oui | Présent mais à vérifier | STATUS (volet de champs, agrégations) | P1 |
| SSE-091 | TCD : disposition du rapport (compacte, plan, tabulaire, répéter les étiquettes), sous-totaux haut / bas / aucun, totaux généraux (lignes / colonnes / les deux), lignes vides, styles de TCD (Clair / Moyen / Sombre / Personnalisé), lignes et colonnes à bandes | oui | Partiel | sous-totaux et totaux généraux ; disposition / lignes vides / styles TCD non relevés | P2 |
| SSE-092 | TCD : éléments calculés, champs calculés | oui | Absent | — | P3 |
| SSE-093 | TCD : regrouper (dates par mois / trimestre / année, nombres par intervalle), afficher les détails, filtre de valeurs (10 premiers, conditions), filtres de rapport | oui | Partiel | filtres de rapport oui ; regroupement de dates / numérique non relevé | P2 |
| SSE-094 | TCD : actualiser / actualiser tout, réduire / développer le champ | oui | Présent mais à vérifier | « actualisation » | P1 |
| SSE-095 | TCD : définitions enregistrées dans le fichier (pivotCache) | oui | Partiel | « définitions non enregistrées dans le fichier » (STATUS) | P1 |
| SSE-096 | Segments de TCD (filtrer un TCD) | oui | Absent | voir SSE-026 | P2 |

### 3.5 Classeur, feuilles, protection, affichage, impression

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| SSE-100 | Onglets de feuille : insérer, supprimer, renommer, dupliquer, déplacer ou copier (vers autre classeur), masquer / afficher, couleur d'onglet, protéger, sélectionner toutes les feuilles, dissocier, liste des feuilles | oui | Présent mais à vérifier | `ui/SheetTabs.tsx` ; copie vers autre classeur non relevée | P1 |
| SSE-101 | Protection de feuille (mot de passe + 15 autorisations : sélectionner cellules, mettre en forme, insérer lignes, trier, filtrer, TCD, objets...) | oui | Présent mais à vérifier | « protection feuille/classeur (empreinte Excel) » ; liste fine des autorisations non recoupée | P1 |
| SSE-102 | Protection de classeur (structure) | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-103 | Cellule verrouillée / formules masquées (cases dans Format de cellule > Protection) | oui | Présent mais à vérifier | `logic/styles.ts` non vérifié ; protection feuille effective | P1 |
| SSE-104 | Figer les volets (ligne, colonne, volets) + ombre des volets figés | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-105 | Quadrillage, en-têtes, barre de formule, zéros, zoom | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-106 | Aperçu des sauts de page / Normal | oui | Présent mais à vérifier | STATUS (vue Mise en page partielle) | P1 |
| SSE-107 | Barre d'état : somme, moyenne, nombre, min, max, chiffres sur la sélection (menu à cocher) ; « enregistrements filtrés » | oui | Partiel | moyenne, nombre, somme (STATUS) ; min / max / personnalisation du menu absents | P2 |
| SSE-108 | Copier/coller spécial (valeurs, formules, formats, largeurs, transposer, opérations, ignorer vides, liens) | oui | Présent mais à vérifier | STATUS (collage spécial) | P1 |
| SSE-109 | Cellule : commentaires (fil, résolus) + notes | oui | Présent mais à vérifier | STATUS | P1 |
| SSE-110 | Panneau droit : Paramètres de cellule (remplissage dégradé / motif, bordures, mise en forme conditionnelle, gérer les règles), de graphique, de forme, d'image, de TCD, de segment, de sparkline, de signature, de texte d'art | oui | Partiel | pas de panneau latéral unifié ; réglages via ruban et dialogues | P2 |
| SSE-111 | Remplissage de cellule en dégradé (points de dégradé) ou motif | oui | Partiel | motifs / dégradés non relevés dans `logic/styles.ts` | P3 |
| SSE-112 | Éditeur de règles de format (FormatRulesEditDlg : 103 libellés) et gestionnaire de règles | oui | Présent mais à vérifier | « gestionnaire » MFC (STATUS) | P1 |
| SSE-113 | Séparateurs décimal / milliers selon la région ; calendrier 1904 ; langue des formules | oui | Présent mais à vérifier | `formulas` fr-FR / en-US ; 1900 / 1904 | P2 |
| SSE-114 | Filtre de segment pour plusieurs colonnes de tableau | oui | Absent | voir SSE-026 | P2 |
| SSE-115 | Format de fichier XLSX, XLSM, XLTX, XLTM, ODS, OTS, CSV, TSV ; XLS lu ; PDF, PDF/A, image | oui | Partiel | xlsx, xlsm, xltx, ods, csv, tsv, xls (lecture) ; OTS, XLTM, PDF/A, image : voir FMT | P1 |
| SSE-116 | Raccourcis clavier Excel (Ctrl+Flèche, F2, F4, Ctrl+;...) | oui | Présent mais à vérifier | `excel/src/ui/keys.ts` | P1 |
| SSE-117 | Zoom, « Combiner la barre des feuilles et la barre d'état » | non ★ | Absent | — | P3 |
| SSE-118 | Défilement fluide / accroché à la grille | non ★ | Absent | — | P3 |

---

## 4. Éditeur de présentations (presentationeditor) face à Présentation (`packages/powerpoint`)

Références : `packages/powerpoint/STATUS.md` (version 0.2.0, 50 tests), `packages/pptx`. Détail PowerPoint dans POWERPOINT.md.
Remarque : `STATUS.md` liste encore SmartArt, équations et suppression d'arrière-plan comme « absents », alors que `src/app/smartart.ts`, `equation.ts` et `bg-remove.ts` existent : le STATUS est en retard sur le code.

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| PE-001 | Ajouter une diapositive (galerie de dispositions), Dupliquer, Supprimer, Changer la disposition | oui | Présent mais à vérifier | « nouvelle diapositive choisie dans la galerie » | P1 |
| PE-002 | Taille de diapositive : Standard 4:3, Écran large 16:9, Paramètres avancés (largeur / hauteur, orientation) | oui | Présent mais à vérifier | STATUS (Conception > Taille) non détaillé ici | P1 |
| PE-003 | Thème de diapositive (galerie de thèmes), Jeu de couleurs (≈ 25 jeux) | oui | Présent mais à vérifier | `app/themes.ts` | P1 |
| PE-004 | Police, taille, gras / italique / souligné / barré / indice / exposant, casse, couleur, surlignage, effacer le style | oui | Présent mais à vérifier | `canvas/text` | P1 |
| PE-005 | Puces (mêmes 8 styles que Texte), numérotation, paramètres de la liste | oui | Présent mais à vérifier | `canvas/render/numbering.ts` | P1 |
| PE-006 | Alignement horizontal / vertical, direction du texte (LTR / RTL, orientation), colonnes (une, deux, trois, personnalisées) | oui | Présent mais à vérifier | « texte vertical, colonnes » (STATUS) ; RTL non relevé | P1 |
| PE-007 | Interligne, retraits, espacement | oui | Présent mais à vérifier | STATUS | P1 |
| PE-008 | Organiser les formes (premier plan / arrière-plan, avancer, reculer), Aligner (gauche, centre, droite, haut, milieu, bas, distribuer H/V, sur la diapositive / sur les objets), Grouper / Dissocier | oui | Présent mais à vérifier | `canvas-ops`, `canvas-math` | P1 |
| PE-009 | Combiner les formes (Union, Combiner, Fragmenter, Entrecroiser, Soustraire) | oui | Absent | voir COM-055 | P2 |
| PE-010 | Insertion : image (fichier / URL / stockage), forme, graphique, tableau, zone de texte H / V, Text Art, SmartArt, équation, symbole, lien, audio, vidéo, en-tête/pied, date et heure, numéro de diapositive | oui | Partiel | tout sauf URL ; Text Art, SmartArt (3 familles), équation (linéaire) partiels ; audio et vidéo incorporés présents | P1 |
| PE-011 | Tableau (styles, dessiner, insérer feuille de calcul incorporée) | oui | Partiel | tableaux 19 styles (STATUS) ; feuille incorporée absente | P1 |
| PE-012 | Graphique dans une diapositive (types, données, éditeur) | oui | Présent mais à vérifier | tests `chart` (tous les types) | P1 |
| PE-013 | Transitions : Aucune, Fondu (en douceur / à travers le noir), Expulsion, Effacer, Diviser, Découvrir, Couvrir, Horloge, Zoom, Transformation (par objets, mots, lettres) ; durée, appliquer à toutes, au clic, après X secondes, aperçu | oui | Présent mais à vérifier | STATUS « Transitions, dont la Morphose (formes de même nom interpolées) » ; morphose par mots / lettres non relevée | P1 |
| PE-014 | Animations : entrée, accentuation, sortie, trajectoires ; volet Animation ; démarrer au clic / avec / après la précédente ; durée, retard, répéter (nombre, jusqu'au clic suivant, jusqu'à la fin), rembobiner, déclencheur ; déplacer avant / après ; aperçu automatique ; plus d'effets | oui | Présent mais à vérifier | STATUS (déclencheurs, trajectoires) | P1 |
| PE-015 | Masque des diapositives : ajouter un masque, ajouter une disposition, insérer un espace réservé (contenu, contenu vertical, texte, texte vertical, image, graphique, tableau, SmartArt), pieds de page, fermer | oui | Présent mais à vérifier | `app/deck-ops.ts`, `editor.ts` ; espaces réservés SmartArt non relevés | P1 |
| PE-016 | Arrière-plan de diapositive (panneau droit : couleur, dégradé, image, texture : papier, tissu, bois, granit, cuir..., motif, opacité, appliquer à toutes, réinitialiser, masquer les graphiques d'arrière-plan, afficher date / numéro) | oui (Format de l'arrière-plan) | Partiel | dégradé oui ; textures, motifs absents (STATUS « galerie de motifs absente ») | P2 |
| PE-017 | Diaporama : depuis le début, depuis la diapositive actuelle, mode Présentateur, paramètres (en boucle, afficher sans animation, avec la barre de défilement) | oui | Partiel | début / actuelle / présentateur oui ; boucle et paramètres non relevés | P1 |
| PE-018 | Fenêtre d'aperçu du diaporama (aller à la diapositive N, plein écran, flèches) | oui | Présent mais à vérifier | `SlideShow.tsx` | P1 |
| PE-019 | Affichage : Normale, Notes, Masque ; repères horizontaux / verticaux, effacer les repères, repères actifs (smart), quadrillage, fixer à la grille, règles, barre d'état, ajuster à la diapositive / largeur, zoom | oui | Présent mais à vérifier | STATUS « Affichage » (repères déplaçables) | P1 |
| PE-020 | Mode « Main » / « Sélection » | non ★ | Absent | voir COM-048 | P3 |
| PE-021 | Notes du présentateur | oui | Présent mais à vérifier | `NotesPage.tsx` | P1 |
| PE-022 | En-tête et pied de page (date, numéro, pied, ne pas afficher sur la diapositive de titre, appliquer à tout) | oui | Présent mais à vérifier | `strings.ts` | P1 |
| PE-023 | Lien vers une diapositive (suivante, précédente, première, dernière, numéro) | oui | Présent mais à vérifier | `app/App.tsx` (lien) | P2 |
| PE-024 | Commentaires de diapositive (volet, @) | oui | Présent mais à vérifier | STATUS | P1 |
| PE-025 | Paramètres de forme avancés (titre alt, rotation, ajustement du texte dans la forme, marges, colonnes, ombre) | oui | Présent mais à vérifier | `canvas` | P1 |
| PE-026 | Rogner l'image à la forme / au ratio, effets d'image, remplacement | oui | Présent mais à vérifier | « images (recadrage, effets) » | P1 |
| PE-027 | Supprimer l'arrière-plan d'une image | oui | Partiel | `app/bg-remove.ts` (méthode par couleur de bord, pas de marquage manuel) | P3 |
| PE-028 | Imprimer / enregistrer en PDF, PDF/A, images (PNG, JPG) | oui | Présent mais à vérifier | export PDF (`app/pdf-export.ts`) ; PDF/A et images par diapositive non relevés | P1 |
| PE-029 | Sections de diapositives | oui | Présent mais à vérifier | `deck-ops` (sections) : ONLYOFFICE n'a pas de sections | P3 |
| PE-030 | Concepteur / idées de conception | oui | Présent mais à vérifier | `app/designer.ts` (ForgeOffice en a plus) | P3 |
| PE-031 | Trieuse de diapositives | oui | Présent mais à vérifier | « Trieuse » (STATUS) | P2 |
| PE-032 | Dessin à l'encre (onglet Dessiner : stylo, surligneur, gomme) | oui | Présent mais à vérifier | « trait au stylet rouge » (STATUS) | P2 |
| PE-033 | Formats .pptx, .ppsx, .potx, .odp, .otp, PDF, PNG/JPG/SVG par diapositive ; .ppt lu | oui | Partiel | `pptx` : pptx, ppsx, potx, odp, ppt ; otp et images par diapositive : voir FMT | P1 |
| PE-034 | Masque : aussi disposition de notes / documents | oui | Absent | pas de masque des notes ni du document (STATUS) | P3 |
| PE-035 | Zones d'insertion « Équation » dans diapositive | oui | Partiel | voir COM-057 | P2 |
| PE-036 | Protection (mot de passe, signature) | oui | Absent | PowerPoint : `Mot de passe` absent | P2 |
| PE-037 | Enregistrement du diaporama (voix, minutage) | oui | Partiel | `RehearseBar.tsx` : minutage à la répétition ; enregistrement audio absent | P3 |

---

## 5. Éditeur PDF (pdfeditor) face à PDF (`packages/pdf`)

ONLYOFFICE 9 édite le PDF avec les moteurs Texte / Présentation (ajout de formes, tableaux, graphiques, équations dans un PDF). Références : `packages/pdf/STATUS.md`, `packages/pdf/src/*`.

### 5.1 Onglets Accueil, Commentaire, Modifier, Insertion, Formulaires, Biffure, Affichage, Protection

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| PDF-001 | Lecteur : zoom, ajuster à la page / largeur, une page / continu / deux pages, plein écran, navigation (première, précédente, suivante, dernière, aller à la page) | Acrobat / Word Lecture | Présent mais à vérifier | `pdf/src/PageView.tsx`, STATUS | P1 |
| PDF-002 | Miniatures de pages (taille, partie visible) + réorganisation par glisser | Acrobat | Présent mais à vérifier | volet Miniatures | P1 |
| PDF-003 | Signets / Navigation (table des matières du PDF : agrandir, renvoyer à la ligne) | Acrobat | Présent mais à vérifier | `outlines.ts` (modification de signets) | P1 |
| PDF-004 | Recherche (panneau, surbrillance) | oui | Présent mais à vérifier | `find.ts` | P1 |
| PDF-005 | Outil Main / Outil de sélection | Acrobat | Présent mais à vérifier | `pdf/src/ribbon.tsx` | P2 |
| PDF-006 | Modifier le PDF (mode d'édition) : ajouter / modifier du texte directement dans la page, polices, taille, puces, interligne, alignement | Acrobat Pro (Modifier le PDF) | Partiel | `Modifier le texte` : clic sur un texte et saisie sur place ; natif `corriger_texte` sinon couvrir + réécrire | P1 |
| PDF-007 | Reconnaître le texte (OCR) | Acrobat | Partiel | `ocr` natif (ocrmypdf) ; absent en navigateur / outil absent sur le PC | P2 |
| PDF-008 | Insertion de page vierge avant / après, Supprimer la page, Faire pivoter la page / les pages | Acrobat | Présent mais à vérifier | `insertBlank`, `deletePages`, `rotate` | P1 |
| PDF-009 | Insérer dans le PDF : image, forme, zone de texte, Text Art, tableau, graphique, équation, SmartArt, symbole, lien, en-tête / pied, numéro de page, date et heure | partiel (Acrobat : image, lien, en-tête) | Partiel | image, forme, zone de texte, lien, en-tête / pied, numérotation, filigrane présents ; tableau, graphique, équation, SmartArt, Text Art absents | P2 |
| PDF-010 | Commentaires : texte, surlignage, soulignement, barré, note, flèche, cercle / ovale, rectangle, lignes connectées, crayon, légende de texte, tampon (catalogue de tampons), liste / volet de commentaires | oui | Présent mais à vérifier | « Commentaire : surligner (5 couleurs), souligner, barrer, note, zone de texte, rectangle, ellipse, ligne, flèche, crayon, 6 tampons » ; lignes connectées, légende absents | P1 |
| PDF-011 | Tampons : catalogue (Approuvé, Brouillon, Confidentiel... en FR via `stamps/fr-FR.json`) et tampon personnalisé image | Acrobat | Partiel | 6 tampons, pas d'image personnalisée | P2 |
| PDF-012 | Afficher / masquer les commentaires, tri, filtre auteur | Acrobat | Partiel | volet Commentaires (ajoutés + existants) ; masquer / filtrer non relevé | P2 |
| PDF-013 | Annotations existantes modifiables | Acrobat | Absent | « affichées et listées, pas modifiables ni supprimables » (STATUS) | P1 |
| PDF-020 | Formulaires PDF : champ texte (aligné / fixe, multiligne, peigne, longueur max), zone de liste déroulante, liste, case à cocher, bouton radio, image, e-mail, téléphone, code postal, carte de crédit, date et heure | Acrobat Pro (Préparer le formulaire) | Partiel | 6 types (texte, multiligne, case, radio, liste déroulante, liste) : `pdf/src/forms.ts` ; image, e-mail, téléphone, code postal, carte, date : absents | P1 |
| PDF-021 | Paramètres de champ PDF (clé, conseil, obligatoire, verrouiller, bordure, remplissage, police, format, valeur par défaut, options, 110 libellés) | Acrobat Pro | Partiel | nom, valeur par défaut, options (`dialogs.fieldName/fieldOptions/fieldValue`) | P1 |
| PDF-022 | Formats de champ (nombre, pourcentage, date, heure, masque, regex) et calculs JavaScript | Acrobat Pro | Absent | JavaScript détecté mais jamais exécuté (`inspectFlags`) | P2 |
| PDF-023 | Champ suivant / précédent, Effacer tous les champs, Envoyer (soumettre), Enregistrer sous PDF | Acrobat | Partiel | remplir et aplatir oui ; navigation entre champs, effacer, soumettre absents | P1 |
| PDF-024 | Formulaire : champ de signature | Acrobat | Présent mais à vérifier | `sign/pdfsign.ts` : champ + signature adbe.pkcs7.detached | P1 |
| PDF-030 | Biffure : Marquer pour la biffure (sélection / page actuelle / plage), Rechercher et biffer, Biffer les pages, Appliquer les biffures (suppression réelle) | Acrobat Pro (Caviarder) | Partiel | marquage + application (`redact.ts`, natif `corriger`) ; « Rechercher et biffer » (par mot) et « pages » absents ; repli navigateur = page rastérisée | P1 |
| PDF-040 | Signature numérique PDF (certificat, apparence visible, raison, lieu), vérification | Acrobat | Présent mais à vérifier | `pdf/src/sign/{cms,der,pdfsign,pkcs12,verify}.ts` | P1 |
| PDF-041 | Signature visuelle dessinée / tapée | Acrobat (Remplir et signer) | Présent mais à vérifier | `dialogs.signDraw/signType` | P1 |
| PDF-042 | Chiffrement mot de passe AES-256 + autorisations | Acrobat | Présent mais à vérifier | STATUS | P1 |
| PDF-043 | Filigrane, numérotation Bates, en-tête et pied | Acrobat | Présent mais à vérifier | STATUS | P1 |
| PDF-044 | Propriétés du document (titre, auteur, sujet, mots-clés, producteur, version PDF, balisé, vue rapide) | Acrobat | Présent mais à vérifier | `dialogs.meta` | P2 |
| PDF-045 | Tri / disposition de page : fusionner, découper, extraire, insérer un fichier | Acrobat | Présent mais à vérifier | `Organiser` (STATUS) | P1 |
| PDF-046 | Pièces jointes, calques (OCG) | Acrobat | Présent mais à vérifier | `extras.ts` | P3 |
| PDF-047 | Lecture à voix haute | Acrobat / Word | Présent mais à vérifier | `speech.ts` | P3 |
| PDF-048 | Convertir PDF <-> DOCX / images / texte ; compresser ; PDF/A ; comparer | Acrobat | Présent mais à vérifier | Outils (natif pour certaines) | P2 |
| PDF-049 | Impression avec aperçu, impression rapide | oui | Présent mais à vérifier | Fichier > Imprimer | P1 |
| PDF-050 | Panneau droit : Paramètres de forme / image / texte / tableau / graphique / Text Art dans le PDF | Acrobat (partiel) | Absent | pas d'objets texte riche éditables autres que zone de texte | P3 |

---

## 6. Éditeur de diagrammes (visioeditor)

Constat tiré du code d'étude : l'éditeur de diagrammes d'ONLYOFFICE 9 est une VISIONNEUSE (barre d'outils de 2 libellés, onglets Fichier et Affichage, 480 chaînes de traduction contre 4 364 pour Texte). Il ouvre les fichiers Visio (.vsdx, .vsdm, .vssx, .vssm, .vstx, .vstm) ; l'édition passe par les plugins drawio / onlydraw (section 7). ForgeOffice n'a aucun module de diagrammes.

| ID | Fonction ONLYOFFICE (nom FR) | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|
| VSD-001 | Ouvrir un diagramme Visio (.vsdx) en lecture : pages multiples, onglets de pages | Visio (hors suite Office de base) | Absent | aucun module, `packages/` sans diagramme | P2 |
| VSD-002 | Zoom, ajuster à la page / largeur, plein écran | Visio | Absent | — | P2 |
| VSD-003 | Recherche dans le diagramme | Visio | Absent | — | P3 |
| VSD-004 | Imprimer (aperçu) / Enregistrer sous PDF | Visio | Absent | — | P3 |
| VSD-005 | Informations du document, thème d'interface | Visio | Absent | — | P3 |
| VSD-006 | ÉDITION de diagrammes (formes, connecteurs, pages, gabarits) : absente d'ONLYOFFICE (plugin draw.io seulement) | Visio | Absent | proposition : module Diagramme basé sur l'éditeur de page `@forgeoffice/powerpoint/canvas` + connecteurs | P2 |
| VSD-007 | Export du diagramme en image (PNG / SVG) | Visio | Absent | — | P2 |

---

## 7. Plugins officiels ONLYOFFICE (dépôt `onlyoffice.github.io`, 62 dossiers au 2026-11-05)

ForgeOffice n'a aucun hôte de greffons (voir COM-039). Colonne « Local » : le plugin fonctionne-t-il sans réseau ? Les plugins qui exigent un service en ligne ou une clé API sont à écarter (règle « zéro service payant »).
« Équivalent MS Office » : ce que Microsoft Office fournit nativement pour la même fonction.

| ID | Plugin (dossier) | Fonction | Équivalent MS Office | Local ? | Statut ForgeOffice | P |
|---|---|---|---|---|---|---|
| PLG-001 | thesaurus | Synonymes d'un mot | Dictionnaire des synonymes | non (service) ; dictionnaire local possible | Partiel : `T.ctx.synonyms` « aucun synonyme hors connexion » | P2 |
| PLG-002 | translator, quicktranslator, deepl, apertium, bergamot | Traduction du texte (bergamot = moteur local) | Traduire | bergamot oui, autres non | Absent : `T.ctx.translateSoon` | P2 |
| PLG-003 | speech | Synthèse vocale (lire à haute voix) | Lecture à haute voix | oui (voix du système) | Partiel : PDF seulement (`pdf/src/speech.ts`) ; Texte absent | P2 |
| PLG-004 | speechrecognition | Dictée vocale | Dicter | non (service) | Absent | P3 |
| PLG-005 | highlightcode | Coloration syntaxique de code (≈ 190 langages) | non ★ | oui | Absent | P3 |
| PLG-006 | ocr | Reconnaissance de texte dans une image (Tesseract) | Copier le texte de l'image | oui (Tesseract.js local) | Absent (OCR de PDF natif seulement) | P2 |
| PLG-007 | photoeditor | Éditeur de photos (rogner, filtres, dessin, texte) | Modifier l'image (limité) | oui | Absent | P3 |
| PLG-008 | insertQR | Code QR | non ★ | oui | Absent | P3 |
| PLG-009 | wordscounter | Compteur de mots détaillé | Statistiques | oui | Présent mais à vérifier : `features/stats.ts` (statistiques avancées) | P3 |
| PLG-010 | textcleaner | Nettoyage de texte (espaces multiples, sauts) | non ★ | oui | Absent | P3 |
| PLG-011 | typograf | Typographie automatique (espaces insécables, guillemets) | Mise en forme auto | oui | Absent (lié à COM-031 autocorrection) | P2 |
| PLG-012 | grammalecte, languagetool, antidote, glavred | Grammaire (grammalecte = français hors ligne) | Éditeur Word | grammalecte oui | Absent | P2 |
| PLG-013 | autocomplete | Complétion de mots | non (prévision de texte Word 365) | oui | Absent | P3 |
| PLG-014 | pdf-bookmarks | Signets PDF depuis les titres | Acrobat | oui | Présent mais à vérifier : `pdf/src/outlines.ts` | P3 |
| PLG-015 | doc2md | Conversion en Markdown | non ★ | oui | Présent mais à vérifier : `T.cmd.exportMd` | P3 |
| PLG-016 | html | Insertion de HTML | non | oui | Partiel : collage HTML, export HTML | P3 |
| PLG-017 | datepicker | Sélecteur de date | Contrôle de date | oui | Absent (voir DE-041) | P2 |
| PLG-018 | drawio, onlydraw | Diagrammes (draw.io) / dessin vectoriel | Visio, formes SmartArt | drawio: embarqué | Absent | P2 |
| PLG-019 | onlymath, lizardtypst | Équations avancées (Typst) | Équation | oui | Absent | P3 |
| PLG-020 | icons, marinamoji, pixabay | Icônes, emoji, images libres | Icônes, Images en ligne | icons/emoji oui, pixabay non | Partiel : icônes Fluent dans PowerPoint | P3 |
| PLG-021 | youtube, videoembedder | Vidéo en ligne dans le document | Vidéo en ligne | non | Absent (service) | P3 |
| PLG-022 | zotero, mendeley, easybib | Gestionnaires de références | Citations et bibliographie | non (comptes) | Présent mais à vérifier : sources et bibliographie natifs | P3 |
| PLG-023 | mathpix | OCR d'équations | Écriture manuscrite -> équation | non | Absent | P3 |
| PLG-024 | ai (ChatGPT, etc.), zhipu | Assistant IA (réécrire, résumer, traduire, générer image, fonction `AI` en cellule) | Copilot | non (clé API) | Absent ; refusé par la règle « zéro service payant » | P3 |
| PLG-025 | chess, pomodoro, rainbow, curly, scroll-manager, texthighlighter, chineseautoformattool, chineseconvertor, naqsha, termef, news, cvbuilder, idphoto | Divers (jeu, minuteur, guillemets courbes, gestion de défilement, mise en évidence, outils chinois, modèles de CV...) | non ★ | oui pour la plupart | Absent | P3 |
| PLG-026 | jitsi, zoom, telegram, wordpress, salesforce, odata | Intégrations de services tiers | non | non | Absent (hors périmètre) | P3 |
| PLG-027 | nlpsolver | Solveur d'optimisation (plugin de tableur) | Solveur | oui | Absent (voir SSE-066) | P3 |

Plugins livrés dans l'application (visibles dans l'onglet Plugins de la version bureau) : Macros, Vérification orthographique, Éditeur de photos, Traducteur, Thésaurus, Synthèse vocale, Coloration de code, ChatGPT/IA, OCR, Zotero, Mendeley, YouTube, draw.io, Insérer QR.

---

## 8. Formats de fichier

| ID | Format (ONLYOFFICE) | Lecture / écriture ONLYOFFICE | Équivalent MS Office | Statut ForgeOffice | Preuve / remarque | P |
|---|---|---|---|---|---|---|
| FMT-001 | DOCX | L/E | oui | Présent mais à vérifier | `docx/src/docx/` | P1 |
| FMT-002 | DOCM, DOTX, DOTM | L/E | oui | Présent mais à vérifier | `docx/src/formats.ts` (macros VBA non conservées) | P1 |
| FMT-003 | DOC, DOT (Word 97-2003) | L/E | oui | Partiel | lecture seule (`docx/src/doc/`) ; écriture absente | P1 |
| FMT-004 | ODT, OTT, FODT | L/E | oui (ODT) | Partiel | ODT lu et écrit, OTT lu comme ODT ; FODT absent | P1 |
| FMT-005 | RTF | L/E | oui | Présent mais à vérifier | `docx/src/rtf/` | P1 |
| FMT-006 | TXT (encodages), HTML, MHT | L/E | oui | Partiel | txt, html présents ; MHT absent ; choix de l'encodage non relevé | P1 |
| FMT-007 | MD (Markdown) | lecture (8.3) / export | non ★ | Présent mais à vérifier | `docx/src/md/` | P2 |
| FMT-008 | EPUB (lecture / écriture), FB2 (lecture / écriture) | oui | EPUB lecture seulement ; FB2 non ★ | Partiel | EPUB via `forge-convert` bureau seulement (grisé en navigateur) ; FB2 absent | P2 |
| FMT-009 | PDF (ouvrir et ÉDITER ; exporter ; PDF/A) | L/E | oui (PDF/A : exporter) | Partiel | module PDF ; export Texte -> PDF par impression système seulement | P1 |
| FMT-010 | XPS, OXPS, DjVu (lecture / conversion) | lecture | XPS oui | Absent | — | P3 |
| FMT-011 | OFD (norme chinoise), HWP/HWPX (Hangul), Pages (Apple) | lecture | non ★ | Absent | — | P3 |
| FMT-012 | DOCXF, OFORM (formulaires) | L/E | non ★ | Absent | voir DE-128 | P2 |
| FMT-020 | XLSX, XLSM, XLTX, XLTM | L/E | oui | Présent mais à vérifier | `xlsx/src/formats.ts` | P1 |
| FMT-021 | XLS, XLT | L/E | oui | Partiel | XLS lu ; XLT non relevé ; écriture absente | P1 |
| FMT-022 | XLSB (classeur binaire) | lecture | oui | Absent | aucune extension xlsb | P2 |
| FMT-023 | ODS, OTS, FODS | L/E | oui (ODS) | Partiel | ODS L/E ; OTS, FODS absents | P1 |
| FMT-024 | CSV (encodage, séparateur, délimiteur de texte), TSV | L/E | oui | Présent mais à vérifier | `xlsx/src/csv.ts` | P1 |
| FMT-025 | Numbers (Apple) | lecture | non ★ | Absent | — | P3 |
| FMT-030 | PPTX, PPTM, PPSX, PPSM, POTX, POTM | L/E | oui | Présent mais à vérifier | `pptx/src/index.ts` | P1 |
| FMT-031 | PPT, PPS, POT | lecture | oui | Partiel | lecture (`pptx/src/ppt.ts`) ; écriture absente | P1 |
| FMT-032 | ODP, OTP, FODP | L/E | oui | Partiel | ODP L/E ; OTP, FODP absents | P1 |
| FMT-033 | Keynote (KEY) | lecture | non ★ | Absent | — | P3 |
| FMT-034 | Export de diapositives en PNG / JPG / SVG | oui | oui | Partiel | PDF oui ; images par diapositive non relevées | P2 |
| FMT-040 | VSDX, VSDM, VSSX, VSSM, VSTX, VSTM (diagrammes) | lecture | Visio | Absent | voir VSD | P2 |
| FMT-050 | Formats chiffrés (OOXML « EncryptedPackage ») | L/E | oui | Partiel | lecture avec mot de passe (docx, pptx, xlsx) ; écriture chiffrée absente | P1 |
| FMT-051 | Conversion par lots (convertisseur) | — | non (LibreOffice / convertisseur ONLYOFFICE Document Builder) | Présent mais à vérifier | `packages/convert` (ForgeOffice en a plus) | P3 |

---

## 9. Collaboration en temps réel (serveur) : HPL = hors périmètre local

| ID | Fonction ONLYOFFICE | Statut | Équivalent local proposé | P |
|---|---|---|---|---|
| COL-001 | Coédition en temps réel (curseurs colorés, modes Rapide / Strict) | HPL | verrouillage du fichier à l'ouverture + détection de modification externe avec proposition de recharger / fusionner | P3 |
| COL-002 | Suivi des modifications des co-auteurs, visibilité (aucune, survol, ballons) | HPL | le suivi local existe (DE-140) | P3 |
| COL-003 | Chat intégré | HPL | aucun (ForgeChat est un autre produit) | P3 |
| COL-004 | Commentaires partagés avec @mentions et notifications | HPL | commentaires locaux avec auteur et réponses (existants) | P3 |
| COL-005 | Historique des versions serveur + restauration | HPL | Absent : versions locales datées (dossier `.versions`), voir COM-022 | P2 |
| COL-006 | Partage / droits d'accès (lecture, commentaire, révision, remplissage de formulaires, édition) | HPL | Absent : bouton « Envoyer une copie » (fichier + message), mode ouverture lecture seule | P3 |
| COL-007 | Remplissage de formulaire par rôles successifs | HPL | passage manuel du fichier d'un destinataire à l'autre, champs verrouillés par rôle (voir DE-121) | P3 |
| COL-008 | Verrouillage par utilisateur d'éléments en cours d'édition (Gestionnaire de vues, plages protégées) | HPL | sans objet en local | P3 |
| COL-009 | Mode « Aperçu de coédition » / Synchroniser | HPL | sans objet | P3 |
| COL-010 | Compte et nom d'utilisateur (dialogue UserNameDialog) | HPL partiel | nom d'auteur local dans les commentaires et révisions | P3 |

---

## 10. Fonctions UNIQUES d'ONLYOFFICE (sans équivalent direct dans Microsoft Office)

Légende : statut dans ForgeOffice entre parenthèses ; renvoi à la ligne détaillée.

1. Formulaires PDF remplissables créés depuis le traitement de texte (DOCXF / OFORM), champs préformatés (e-mail, téléphone, code postal, carte de crédit, date), rôles de destinataires, champs connectés, masque / expression régulière, peigne de caractères (Absent : DE-110 à DE-128).
2. Éditeur PDF intégré qui ajoute formes, tableaux, graphiques, équations et SmartArt dans un PDF (Partiel : PDF-009).
3. Biffure avec « Rechercher et biffer » et « Biffer les pages » dans l'éditeur PDF (Partiel : PDF-030).
4. Macros JavaScript + enregistrement + fonctions personnalisées appelables en formule + conversion VBA (Absent : COM-034 à COM-038, SSE-053).
5. Plugins : marché de modules JS (≈ 60 officiels) avec plugins d'arrière-plan et panneau de plugin (Absent : COM-039, section 7).
6. Raccourcis clavier personnalisables dans les trois suites avec 294 actions (Absent : COM-004).
7. Mode « Document sombre » séparé du thème, style d'onglet Remplissage / Ligne, hinting de la police (Absent : COM-006, COM-007, COM-013).
8. Vues de feuille nommées sans gêner les autres utilisateurs (Absent : SSE-075).
9. Plages protégées par utilisateur (Partiel : modèle seul, SSE-076).
10. Valeur cible et Solveur intégrés (Absent : SSE-065, SSE-066).
11. Fenêtre Espions (Absent : SSE-045).
12. IMPORTRANGE (références entre fichiers par URL) (Absent, à refuser : SSE-054).
13. Éditeur de diagrammes Visio en lecture + plugin draw.io (Absent : VSD).
14. Combiner les formes (Absent : COM-055) : existe aussi dans Office, rangé ici car absent chez ForgeOffice.
15. Miniatures de pages (panneau) dans le traitement de texte (Partiel : DE-181).
16. Texte d'un autre fichier inséré par URL / stockage (Absent : DE-020).
17. Ouverture directe de HWP, OFD, DjVu, XPS, Pages, Numbers, Keynote, FB2 (Absent : FMT-010 à FMT-033).
18. Plugin IA / ChatGPT intégré, fonction `AI()` de cellule (Absent, refusé : PLG-024).
19. Aperçu du formulaire et passage champ par champ (Absent : DE-123).
20. Chiffres arabes / hindi et numéraux selon la langue (réglage « Chiffres ») (Absent).

---

## 11. MODULES/FONCTIONS À AJOUTER

Effort : S = moins d'une journée d'un agent · M = 1 à 3 jours · L = plus de 3 jours ou plusieurs dossiers. « Recouvre » : l'audit Office correspondant traite sans doute la même lacune (à ne coder qu'une fois).
Le découpage en lots parallélisables est dans `ONLYOFFICE-priorites.md`.

| Réf. | Module / fonction à ajouter | Lignes d'audit | Effort | Priorité | Recouvre l'audit Office |
|---|---|---|---|---|---|
| A01 | Contrôles de contenu : texte riche / brut, image, liste, liste déroulante, date, case à cocher ; propriétés (titre, tag, verrouillage, espace réservé, apparence) ; menu contextuel ; aller-retour `w:sdt` (modèle déjà dans `docx`) | DE-041, DE-042, DE-043, DE-228 | M | P1 | WORD.md (Développeur) |
| A02 | Formulaires remplissables dans Texte : champs (texte aligné / fixe, combo, liste, case, radio, image, e-mail, téléphone, code postal, carte, date, complexe), paramètres, formats, aperçu / remplissage, protection « remplissage seul », rôles, export PDF avec champs AcroForm, formats DOCXF / OFORM | DE-110 à DE-128 | L | P1 | WORD.md (formulaires hérités) |
| A03 | Créateur de formulaires PDF complet : champs manquants (image, e-mail, téléphone, code postal, carte, date), propriétés (obligatoire, conseil, format, verrou, bordure, remplissage), navigation Champ suivant / précédent, Effacer, Soumettre, formats et calculs sans exécuter de JavaScript arbitraire | PDF-020 à PDF-023 | M | P1 | non |
| A04 | Hôte de plugins locaux : manifeste JSON, API (document, sélection, insertion, panneau latéral), exécution isolée (iframe sandbox / Worker), onglet Plugins, plugins d'arrière-plan | COM-039, DE-171 | L | P1 | non |
| A05 | Plugins locaux de base (chacun S à M) : thésaurus hors ligne, OCR image (Tesseract.js), QR, coloration de code, typographie française, nettoyage de texte, compteur de mots, sélecteur de date, emoji / icônes | section 7 | M (lot) | P2 | partiel (WORD.md : synonymes) |
| A06 | Autocorrection : liste de remplacements, guillemets typographiques FR, tirets, majuscule en début de phrase avec exceptions, listes automatiques, liens automatiques, AutoMaths (symboles LaTeX -> Unicode) ; réglages et dialogue | COM-031 | M | P1 | WORD.md / EXCEL.md |
| A07 | Macros JavaScript : éditeur, exécution en bac à sable, enregistreur, démarrage automatique, fonctions personnalisées de cellule, réglage de sécurité (désactiver / notifier / activer) | COM-034 à COM-038, SSE-053 | L | P2 | WORD.md (VBA, partiel) |
| A08 | Raccourcis clavier personnalisables (dialogue + stockage) pour les modules | COM-004 | M | P2 | WORD.md (Word seulement) |
| A09 | Segments (filtres visuels) pour tableaux et tableaux croisés dynamiques, avec lecture / écriture OOXML (`slicerCache`) | SSE-026, SSE-096, SSE-114 | M | P1 | EXCEL.md |
| A10 | Valeur cible (S) puis Solveur : Simplex LP (M), GRG non linéaire (M), évolutionnaire (L) | SSE-065, SSE-066 | S + L | P1 / P2 | EXCEL.md |
| A11 | Fenêtre Espions | SSE-045 | S | P2 | EXCEL.md |
| A12 | Vues de feuille nommées (gestionnaire) ; plages protégées avec interface ; titres à imprimer ; en-tête / pied de feuille | SSE-075, SSE-076, SSE-027, SSE-028 | M | P2 | EXCEL.md |
| A13 | Graphiques complets : insertion dans Texte, éditeur de séries, titres d'axes, lignes de tendance, barres d'erreur, boursier, radar, 3D | DE-035, DE-210, SSE-022 à SSE-024 | L | P1 | WORD.md / EXCEL.md / POWERPOINT.md |
| A14 | Éditeur d'équations structuré (barre de structures, OMML, conversion LaTeX / Unicode) pour Texte, Présentation, PDF | COM-057, DE-039, DE-226 | L | P1 | WORD.md |
| A15 | Combiner les formes (union, combiner, fragmenter, intersection, soustraction) dans l'éditeur de page | COM-055, PE-009, DE-072 | M | P2 | POWERPOINT.md / PUBLISHER.md |
| A16 | Module Diagramme : visionneuse .vsdx, puis éditeur de formes + connecteurs sur l'éditeur de page | VSD-001 à VSD-007 | L | P2 | non (Visio hors liste) |
| A17 | Formats : FB2 (S), MHT (S), FODT / FODS / FODP / OTS / OTP (S chacun), EPUB natif (M), XLSB lecture (M), écriture DOC / XLS / PPT (L), XPS / OFD / DjVu / HWP lecture (L, P3) | FMT-004 à FMT-034 | S à L | P2 | WORD.md / EXCEL.md / POWERPOINT.md |
| A18 | Signature numérique OOXML (docx / xlsx / pptx) : ligne de signature, signature invisible, vérification | COM-040, DE-162 | M | P2 | WORD.md |
| A19 | Écriture de fichiers OOXML chiffrés (mot de passe) pour docx, xlsx, pptx ; boîte Chiffrer / Modifier / Supprimer | COM-041, DE-160, PE-036 | M | P1 | WORD.md / EXCEL.md / POWERPOINT.md |
| A20 | Versions locales datées + restauration + comparaison | COM-022, COL-005 | M | P2 | non |
| A21 | Protection de document par modes (lecture seule, commentaires, révisions, formulaires) avec mot de passe | DE-127, DE-161 | M | P1 | WORD.md |
| A22 | Text Art dans Texte et Tableur (réutiliser le module de PowerPoint) | COM-054, DE-038 | S | P3 | WORD.md |
| A23 | Annotations PDF existantes modifiables / supprimables ; légende de texte, lignes connectées ; biffure « Rechercher et biffer » et « Biffer les pages » ; tampon image | PDF-010, PDF-011, PDF-013, PDF-030 | M | P1 | non |
| A24 | SmartArt complet (dispositions cycle, relation, matrice, pyramide, images) | COM-058 | L | P2 | POWERPOINT.md |
| A25 | Réglages d'interface : document sombre, style d'onglet, unité de mesure, zoom par défaut, intervalle de récupération, lecteur d'écran | COM-006 à COM-014 | S | P2 | transversal |
| A26 | Traduction locale (moteur bergamot / dictionnaire) et grammaire hors ligne (Grammalecte) | PLG-002, PLG-012 | L | P2 | WORD.md |
| A27 | Direction RTL du paragraphe / de la feuille / de l'interface | DE-012, SSE-018, COM-010 | M | P3 | WORD.md |
| A28 | Texte du paragraphe : lettrine, paramètres des notes, taquets rendus, numérotation avec valeur de départ, définition de liste multiniveau | DE-007, DE-008, DE-045, DE-092, DE-242 | M | P2 | WORD.md |
| A29 | Positionnement absolu des images et formes dans Texte, alignement multi-objets, grouper | DE-069, DE-071, DE-073 | L | P1 | WORD.md |
| A30 | Publipostage : source XLSX, envoi par e-mail, édition de la liste | DE-149, DE-151, COM-053 | M | P2 | WORD.md |
| A31 | Panneau droit unifié de paramètres (cellule, forme, image, paragraphe, tableau) | SSE-110, DE-206 à DE-211 | M | P3 | non (interface ONLYOFFICE) |
| A32 | Remplacer par la comparaison : « Combiner » deux versions | DE-145 | S | P3 | WORD.md |
| A33 | Tableau de Texte : formule de cellule (`=SOMME(AU-DESSUS)`), dessiner / effacer, répartir les lignes / colonnes | COM-059, DE-224 | M | P2 | WORD.md |
| A34 | Fonction `SINGLE` (@) dans le moteur de formules ; `IMPORTRANGE` à NE PAS ajouter (réseau) | SSE-055, SSE-054 | S | P3 | EXCEL.md |

---

## Annexe A. Fonctions de feuille de calcul ONLYOFFICE (liste complète) et état dans ForgeOffice

Source : groupes `cFormulaFunctionGroup` de `sdkjs/cell/model/FormulaObjects/*.js` (noms anglais) et `formula-lang/fr.json` (noms français). 492 fonctions distinctes ; ONLYOFFICE
classe lui-même 15 d'entre elles « non réalisées » (CUBE*, RTD, JIS, PHONETIC, BAHTTEXT) : elles sont déclarées mais sans calcul. Les fonctions de base de données (BD*) sont déclarées
dans `databaseFunctions.js` hors de ce motif de relevé ; elles figurent ici d'après le nom français. ForgeOffice (505 fonctions, `packages/formulas/STATUS.md`) couvre toutes les fonctions
réalisées par ONLYOFFICE sauf **SINGLE** et **IMPORTRANGE** (★ Google Sheets, à ne pas ajouter : accès réseau).
Le statut « Présent mais à vérifier » est celui du registre (`listFunctions()` interrogé le 2026-11-05) ; les 927 tests du moteur comparent à Excel, pas à ONLYOFFICE.

Fonctions présentes dans ForgeOffice mais introuvables sous ce nom dans ce `sdkjs` (ONLYOFFICE ne les a donc pas, ou sous un autre nom) : LET, LAMBDA, MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY, ISOMITTED, GROUPBY, PIVOTBY, PERCENTOF, TRIMRANGE, EUROCONVERT, VALUETOTEXT, ENCODEURL, MUNIT, INFO, RANK, CHIDIST, F.DIST, F.DIST.RT, FINV, DBCS. (Avance de ForgeOffice sur ONLYOFFICE, au moins pour LET / LAMBDA / tableaux dynamiques évolués.)

### Math et trigonométrie (82)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| ABS | ABS | oui | Présent mais à vérifier |
| ACOS | ACOS | oui | Présent mais à vérifier |
| ACOSH | ACOSH | oui | Présent mais à vérifier |
| ACOT | ACOT | oui | Présent mais à vérifier |
| ACOTH | ACOTH | oui | Présent mais à vérifier |
| AGGREGATE | AGREGAT | oui | Présent mais à vérifier |
| ARABIC | CHIFFRE.ARABE | oui | Présent mais à vérifier |
| ASIN | ASIN | oui | Présent mais à vérifier |
| ASINH | ASINH | oui | Présent mais à vérifier |
| ATAN | ATAN | oui | Présent mais à vérifier |
| ATAN2 | ATAN2 | oui | Présent mais à vérifier |
| ATANH | ATANH | oui | Présent mais à vérifier |
| BASE | BASE | oui | Présent mais à vérifier |
| CEILING | PLAFOND | oui | Présent mais à vérifier |
| CEILING.MATH | PLAFOND.MATH | oui | Présent mais à vérifier |
| CEILING.PRECISE | PLAFOND.PRECIS | oui | Présent mais à vérifier |
| COMBIN | COMBIN | oui | Présent mais à vérifier |
| COMBINA | COMBINA | oui | Présent mais à vérifier |
| COS | COS | oui | Présent mais à vérifier |
| COSH | COSH | oui | Présent mais à vérifier |
| COT | COT | oui | Présent mais à vérifier |
| COTH | COTH | oui | Présent mais à vérifier |
| CSC | CSC | oui | Présent mais à vérifier |
| CSCH | CSCH | oui | Présent mais à vérifier |
| DECIMAL | DECIMAL | oui | Présent mais à vérifier |
| DEGREES | DEGRES | oui | Présent mais à vérifier |
| ECMA.CEILING | ECMA.PLAFOND | oui | Présent mais à vérifier |
| EVEN | PAIR | oui | Présent mais à vérifier |
| EXP | EXP | oui | Présent mais à vérifier |
| FACT | FACT | oui | Présent mais à vérifier |
| FACTDOUBLE | FACTDOUBLE | oui | Présent mais à vérifier |
| FLOOR | PLANCHER | oui | Présent mais à vérifier |
| FLOOR.MATH | PLANCHER.MATH | oui | Présent mais à vérifier |
| FLOOR.PRECISE | PLANCHER.PRECIS | oui | Présent mais à vérifier |
| GCD | PGCD | oui | Présent mais à vérifier |
| INT | ENT | oui | Présent mais à vérifier |
| ISO.CEILING | ISO.PLAFOND | oui | Présent mais à vérifier |
| LCM | PPCM | oui | Présent mais à vérifier |
| LN | LN | oui | Présent mais à vérifier |
| LOG | LOG | oui | Présent mais à vérifier |
| LOG10 | LOG10 | oui | Présent mais à vérifier |
| MDETERM | DETERMAT | oui | Présent mais à vérifier |
| MINVERSE | INVERSEMAT | oui | Présent mais à vérifier |
| MMULT | PRODUITMAT | oui | Présent mais à vérifier |
| MOD | MOD | oui | Présent mais à vérifier |
| MROUND | ARRONDI.AU.MULTIPLE | oui | Présent mais à vérifier |
| MULTINOMIAL | MULTINOMIALE | oui | Présent mais à vérifier |
| ODD | IMPAIR | oui | Présent mais à vérifier |
| PI | PI | oui | Présent mais à vérifier |
| POWER | PUISSANCE | oui | Présent mais à vérifier |
| PRODUCT | PRODUIT | oui | Présent mais à vérifier |
| QUOTIENT | QUOTIENT | oui | Présent mais à vérifier |
| RADIANS | RADIANS | oui | Présent mais à vérifier |
| RAND | ALEA | oui | Présent mais à vérifier |
| RANDARRAY | TABLEAU.ALEAT | oui | Présent mais à vérifier |
| RANDBETWEEN | ALEA.ENTRE.BORNES | oui | Présent mais à vérifier |
| ROMAN | ROMAIN | oui | Présent mais à vérifier |
| ROUND | ARRONDI | oui | Présent mais à vérifier |
| ROUNDDOWN | ARRONDI.INF | oui | Présent mais à vérifier |
| ROUNDUP | ARRONDI.SUP | oui | Présent mais à vérifier |
| SEC | SEC | oui | Présent mais à vérifier |
| SECH | SECH | oui | Présent mais à vérifier |
| SEQUENCE | SEQUENCE | oui | Présent mais à vérifier |
| SERIESSUM | SOMME.SERIES | oui | Présent mais à vérifier |
| SIGN | SIGNE | oui | Présent mais à vérifier |
| SIN | SIN | oui | Présent mais à vérifier |
| SINGLE | — | oui | Absent |
| SINH | SINH | oui | Présent mais à vérifier |
| SQRT | RACINE | oui | Présent mais à vérifier |
| SQRTPI | RACINE.PI | oui | Présent mais à vérifier |
| SUBTOTAL | SOUS.TOTAL | oui | Présent mais à vérifier |
| SUM | SOMME | oui | Présent mais à vérifier |
| SUMIF | SOMME.SI | oui | Présent mais à vérifier |
| SUMIFS | SOMME.SI.ENS | oui | Présent mais à vérifier |
| SUMPRODUCT | SOMMEPROD | oui | Présent mais à vérifier |
| SUMSQ | SOMME.CARRES | oui | Présent mais à vérifier |
| SUMX2MY2 | SOMME.X2MY2 | oui | Présent mais à vérifier |
| SUMX2PY2 | SOMME.X2PY2 | oui | Présent mais à vérifier |
| SUMXMY2 | SOMME.XMY2 | oui | Présent mais à vérifier |
| TAN | TAN | oui | Présent mais à vérifier |
| TANH | TANH | oui | Présent mais à vérifier |
| TRUNC | TRONQUE | oui | Présent mais à vérifier |

### Statistiques (144)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| AVEDEV | ECART.MOYEN | oui | Présent mais à vérifier |
| AVERAGE | MOYENNE | oui | Présent mais à vérifier |
| AVERAGEA | AVERAGEA | oui | Présent mais à vérifier |
| AVERAGEIF | MOYENNE.SI | oui | Présent mais à vérifier |
| AVERAGEIFS | MOYENNE.SI.ENS | oui | Présent mais à vérifier |
| BETA.DIST | LOI.BETA.N | oui | Présent mais à vérifier |
| BETA.INV | BETA.INVERSE.N | oui | Présent mais à vérifier |
| BETADIST | LOI.BETA | oui | Présent mais à vérifier |
| BETAINV | BETA.INVERSE | oui | Présent mais à vérifier |
| BINOM.DIST | LOI.BINOMIALE.N | oui | Présent mais à vérifier |
| BINOM.DIST.RANGE | LOI.BINOMIALE.SERIE | oui | Présent mais à vérifier |
| BINOM.INV | LOI.BINOMIALE.INVERSE | oui | Présent mais à vérifier |
| BINOMDIST | LOI.BINOMIALE | oui | Présent mais à vérifier |
| CHIINV | KHIDEUX.INVERSE | oui | Présent mais à vérifier |
| CHISQ.DIST | LOI.KHIDEUX.N | oui | Présent mais à vérifier |
| CHISQ.DIST.RT | LOI.KHIDEUX.DROITE | oui | Présent mais à vérifier |
| CHISQ.INV | LOI.KHIDEUX.INVERSE | oui | Présent mais à vérifier |
| CHISQ.INV.RT | LOI.KHIDEUX.INVERSE.DROITE | oui | Présent mais à vérifier |
| CHISQ.TEST | CHISQ.TEST | oui | Présent mais à vérifier |
| CHITEST | TEST.KHIDEUX | oui | Présent mais à vérifier |
| CONFIDENCE | INTERVALLE.CONFIANCE | oui | Présent mais à vérifier |
| CONFIDENCE.NORM | INTERVALLE.CONFIANCE.NORMAL | oui | Présent mais à vérifier |
| CONFIDENCE.T | INTERVALLE.CONFIANCE.STUDENT | oui | Présent mais à vérifier |
| CORREL | COEFFICIENT.CORRELATION | oui | Présent mais à vérifier |
| COUNT | NB | oui | Présent mais à vérifier |
| COUNTA | NBVAL | oui | Présent mais à vérifier |
| COUNTBLANK | NB.VIDE | oui | Présent mais à vérifier |
| COUNTIF | NB.SI | oui | Présent mais à vérifier |
| COUNTIFS | NB.SI.ENS | oui | Présent mais à vérifier |
| COVAR | COVARIANCE | oui | Présent mais à vérifier |
| COVARIANCE.P | COVARIANCE.PEARSON | oui | Présent mais à vérifier |
| COVARIANCE.S | COVARIANCE.STANDARD | oui | Présent mais à vérifier |
| CRITBINOM | CRITERE.LOI.BINOMIALE | oui | Présent mais à vérifier |
| DEVSQ | SOMME.CARRES.ECARTS | oui | Présent mais à vérifier |
| EXPON.DIST | LOI.EXPONENTIELLE.N | oui | Présent mais à vérifier |
| EXPONDIST | LOI.EXPONENTIELLE | oui | Présent mais à vérifier |
| F.INV | INVERSE.LOI.F.N | oui | Présent mais à vérifier |
| F.INV.RT | INVERSE.LOI.F.DROITE | oui | Présent mais à vérifier |
| F.TEST | F.TEST | oui | Présent mais à vérifier |
| FDIST | LOI.F | oui | Présent mais à vérifier |
| FISHER | FISHER | oui | Présent mais à vérifier |
| FISHERINV | FISHER.INVERSE | oui | Présent mais à vérifier |
| FORECAST | PREVISION | oui | Présent mais à vérifier |
| FORECAST.ETS | PREVISION.ETS | oui | Présent mais à vérifier |
| FORECAST.ETS.CONFINT | PREVISION.ETS.CONFINT | oui | Présent mais à vérifier |
| FORECAST.ETS.SEASONALITY | PREVISION.ETS.CARACTERESAISONNIER | oui | Présent mais à vérifier |
| FORECAST.ETS.STAT | PREVISION.ETS.STAT | oui | Présent mais à vérifier |
| FORECAST.LINEAR | PREVISION.LINEAIRE | oui | Présent mais à vérifier |
| FREQUENCY | FREQUENCE | oui | Présent mais à vérifier |
| FTEST | TEST.F | oui | Présent mais à vérifier |
| GAMMA | GAMMA | oui | Présent mais à vérifier |
| GAMMA.DIST | LOI.GAMMA.N | oui | Présent mais à vérifier |
| GAMMA.INV | LOI.GAMMA.INVERSE.N | oui | Présent mais à vérifier |
| GAMMADIST | LOI.GAMMA | oui | Présent mais à vérifier |
| GAMMAINV | LOI.GAMMA.INVERSE | oui | Présent mais à vérifier |
| GAMMALN | LNGAMMA | oui | Présent mais à vérifier |
| GAMMALN.PRECISE | LNGAMMA.PRECIS | oui | Présent mais à vérifier |
| GAUSS | GAUSS | oui | Présent mais à vérifier |
| GEOMEAN | MOYENNE.GEOMETRIQUE | oui | Présent mais à vérifier |
| GROWTH | CROISSANCE | oui | Présent mais à vérifier |
| HARMEAN | MOYENNE.HARMONIQUE | oui | Présent mais à vérifier |
| HYPGEOM.DIST | LOI.HYPERGEOMETRIQUE.N | oui | Présent mais à vérifier |
| HYPGEOMDIST | LOI.HYPERGEOMETRIQUE | oui | Présent mais à vérifier |
| INTERCEPT | ORDONNEE.ORIGINE | oui | Présent mais à vérifier |
| KURT | KURTOSIS | oui | Présent mais à vérifier |
| LARGE | GRANDE.VALEUR | oui | Présent mais à vérifier |
| LINEST | DROITEREG | oui | Présent mais à vérifier |
| LOGEST | LOGREG | oui | Présent mais à vérifier |
| LOGINV | LOI.LOGNORMALE.INVERSE | oui | Présent mais à vérifier |
| LOGNORM.DIST | LOI.LOGNORMALE.N | oui | Présent mais à vérifier |
| LOGNORM.INV | LOI.LOGNORMALE.INVERSE.N | oui | Présent mais à vérifier |
| LOGNORMDIST | LOI.LOGNORMALE | oui | Présent mais à vérifier |
| MAX | MAX | oui | Présent mais à vérifier |
| MAXA | MAXA | oui | Présent mais à vérifier |
| MAXIFS | MAX.SI.ENS | oui | Présent mais à vérifier |
| MEDIAN | MEDIANE | oui | Présent mais à vérifier |
| MIN | MIN | oui | Présent mais à vérifier |
| MINA | MINA | oui | Présent mais à vérifier |
| MINIFS | MIN.SI.ENS | oui | Présent mais à vérifier |
| MODE | MODE | oui | Présent mais à vérifier |
| MODE.MULT | MODE.MULTIPLE | oui | Présent mais à vérifier |
| MODE.SNGL | MODE.SIMPLE | oui | Présent mais à vérifier |
| NEGBINOM.DIST | LOI.BINOMIALE.NEG.N | oui | Présent mais à vérifier |
| NEGBINOMDIST | LOI.BINOMIALE.NEG | oui | Présent mais à vérifier |
| NORM.DIST | LOI.NORMALE.N | oui | Présent mais à vérifier |
| NORM.INV | LOI.NORMALE.INVERSE.N | oui | Présent mais à vérifier |
| NORM.S.DIST | LOI.NORMALE.STANDARD.N | oui | Présent mais à vérifier |
| NORM.S.INV | LOI.NORMALE.STANDARD.INVERSE.N | oui | Présent mais à vérifier |
| NORMDIST | LOI.NORMALE | oui | Présent mais à vérifier |
| NORMINV | LOI.NORMALE.INVERSE | oui | Présent mais à vérifier |
| NORMSDIST | LOI.NORMALE.STANDARD | oui | Présent mais à vérifier |
| NORMSINV | LOI.NORMALE.STANDARD.INVERSE | oui | Présent mais à vérifier |
| PEARSON | PEARSON | oui | Présent mais à vérifier |
| PERCENTILE | CENTILE | oui | Présent mais à vérifier |
| PERCENTILE.EXC | CENTILE.EXCLURE | oui | Présent mais à vérifier |
| PERCENTILE.INC | CENTILE.INCLURE | oui | Présent mais à vérifier |
| PERCENTRANK | RANG.POURCENTAGE | oui | Présent mais à vérifier |
| PERCENTRANK.EXC | RANG.POURCENTAGE.EXCLURE | oui | Présent mais à vérifier |
| PERCENTRANK.INC | RANG.POURCENTAGE.INCLURE | oui | Présent mais à vérifier |
| PERMUT | PERMUTATION | oui | Présent mais à vérifier |
| PERMUTATIONA | PERMUTATIONA | oui | Présent mais à vérifier |
| PHI | PHI | oui | Présent mais à vérifier |
| POISSON | LOI.POISSON | oui | Présent mais à vérifier |
| POISSON.DIST | LOI.POISSON.N | oui | Présent mais à vérifier |
| PROB | PROBABILITE | oui | Présent mais à vérifier |
| QUARTILE | QUARTILE | oui | Présent mais à vérifier |
| QUARTILE.EXC | QUARTILE.EXCLURE | oui | Présent mais à vérifier |
| QUARTILE.INC | QUARTILE.INCLURE | oui | Présent mais à vérifier |
| RANK.AVG | MOYENNE.RANG | oui | Présent mais à vérifier |
| RANK.EQ | EQUATION.RANG | oui | Présent mais à vérifier |
| RSQ | COEFFICIENT.DETERMINATION | oui | Présent mais à vérifier |
| SKEW | COEFFICIENT.ASYMETRIE | oui | Présent mais à vérifier |
| SKEW.P | COEFFICIENT.ASYMETRIE.P | oui | Présent mais à vérifier |
| SLOPE | PENTE | oui | Présent mais à vérifier |
| SMALL | PETITE.VALEUR | oui | Présent mais à vérifier |
| STANDARDIZE | CENTREE.REDUITE | oui | Présent mais à vérifier |
| STDEV | ECARTYPE | oui | Présent mais à vérifier |
| STDEV.P | ECARTYPE.PEARSON | oui | Présent mais à vérifier |
| STDEV.S | ECARTYPE.STANDARD | oui | Présent mais à vérifier |
| STDEVA | STDEVA | oui | Présent mais à vérifier |
| STDEVP | ECARTYPEP | oui | Présent mais à vérifier |
| STDEVPA | STDEVPA | oui | Présent mais à vérifier |
| STEYX | ERREUR.TYPE.XY | oui | Présent mais à vérifier |
| T.DIST | LOI.STUDENT.N | oui | Présent mais à vérifier |
| T.DIST.2T | LOI.STUDENT.BILATERALE | oui | Présent mais à vérifier |
| T.DIST.RT | LOI.STUDENT.DROITE | oui | Présent mais à vérifier |
| T.INV | LOI.STUDENT.INVERSE.N | oui | Présent mais à vérifier |
| T.INV.2T | LOI.STUDENT.INVERSE.BILATERALE | oui | Présent mais à vérifier |
| T.TEST | T.TEST | oui | Présent mais à vérifier |
| TDIST | LOI.STUDENT | oui | Présent mais à vérifier |
| TINV | LOI.STUDENT.INVERSE | oui | Présent mais à vérifier |
| TREND | — | oui | Présent mais à vérifier |
| TRIMMEAN | MOYENNE.REDUITE | oui | Présent mais à vérifier |
| TTEST | TEST.STUDENT | oui | Présent mais à vérifier |
| VAR | VAR | oui | Présent mais à vérifier |
| VAR.P | VAR.P.N | oui | Présent mais à vérifier |
| VAR.S | VAR.S | oui | Présent mais à vérifier |
| VARA | VARA | oui | Présent mais à vérifier |
| VARP | VAR.P | oui | Présent mais à vérifier |
| VARPA | VARPA | oui | Présent mais à vérifier |
| WEIBULL | LOI.WEIBULL | oui | Présent mais à vérifier |
| WEIBULL.DIST | LOI.WEIBULL.N | oui | Présent mais à vérifier |
| Z.TEST | Z.TEST | oui | Présent mais à vérifier |
| ZTEST | TEST.Z | oui | Présent mais à vérifier |

### Texte (47)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| ARRAYTOTEXT | TABLEAU.EN.TEXTE | oui | Présent mais à vérifier |
| ASC | ASC | oui | Présent mais à vérifier |
| BAHTTEXT | — | oui | Présent mais à vérifier |
| CHAR | CAR | oui | Présent mais à vérifier |
| CLEAN | EPURAGE | oui | Présent mais à vérifier |
| CODE | CODE | oui | Présent mais à vérifier |
| CONCAT | CONCAT | oui | Présent mais à vérifier |
| CONCATENATE | CONCATENER | oui | Présent mais à vérifier |
| DOLLAR | DEVISE | oui | Présent mais à vérifier |
| EXACT | EXACT | oui | Présent mais à vérifier |
| FIND | TROUVE | oui | Présent mais à vérifier |
| FINDB | TROUVERB | oui | Présent mais à vérifier |
| FIXED | CTXT | oui | Présent mais à vérifier |
| IMPORTRANGE | IMPORTRANGE | non (Google Sheets) ★ | Absent |
| JIS | — | oui | Absent |
| LEFT | GAUCHE | oui | Présent mais à vérifier |
| LEFTB | GAUCHEB | oui | Présent mais à vérifier |
| LEN | NBCAR | oui | Présent mais à vérifier |
| LENB | LENB | oui | Présent mais à vérifier |
| LOWER | MINUSCULE | oui | Présent mais à vérifier |
| MID | STXT | oui | Présent mais à vérifier |
| MIDB | MIDB | oui | Présent mais à vérifier |
| NUMBERVALUE | VALEURNOMBRE | oui | Présent mais à vérifier |
| PHONETIC | — | oui | Présent mais à vérifier |
| PROPER | NOMPROPRE | oui | Présent mais à vérifier |
| REGEXEXTRACT | REGEX.EXTRAIRE | oui | Présent mais à vérifier |
| REGEXREPLACE | REGEX.REMPLACER | oui | Présent mais à vérifier |
| REGEXTEST | REGEX.TEST | oui | Présent mais à vérifier |
| REPLACE | REMPLACER | oui | Présent mais à vérifier |
| REPLACEB | REMPLACERB | oui | Présent mais à vérifier |
| REPT | REPT | oui | Présent mais à vérifier |
| RIGHT | DROITE | oui | Présent mais à vérifier |
| RIGHTB | DROITEB | oui | Présent mais à vérifier |
| SEARCH | CHERCHE | oui | Présent mais à vérifier |
| SEARCHB | CHERCHERB | oui | Présent mais à vérifier |
| SUBSTITUTE | SUBSTITUE | oui | Présent mais à vérifier |
| T | T | oui | Présent mais à vérifier |
| TEXT | TEXTE | oui | Présent mais à vérifier |
| TEXTAFTER | TEXTE.APRES | oui | Présent mais à vérifier |
| TEXTBEFORE | TEXTE.AVANT | oui | Présent mais à vérifier |
| TEXTJOIN | JOINDRE.TEXTE | oui | Présent mais à vérifier |
| TEXTSPLIT | FRACTIONNER.TEXTE | oui | Présent mais à vérifier |
| TRIM | SUPPRESPACE | oui | Présent mais à vérifier |
| UNICHAR | UNICAR | oui | Présent mais à vérifier |
| UNICODE | UNICODE | oui | Présent mais à vérifier |
| UPPER | MAJUSCULE | oui | Présent mais à vérifier |
| VALUE | VALEUR | oui | Présent mais à vérifier |

### Date et heure (25)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| DATE | DATE | oui | Présent mais à vérifier |
| DATEDIF | DATEDIF | oui | Présent mais à vérifier |
| DATEVALUE | DATEVAL | oui | Présent mais à vérifier |
| DAY | JOUR | oui | Présent mais à vérifier |
| DAYS | JOURS | oui | Présent mais à vérifier |
| DAYS360 | JOURS360 | oui | Présent mais à vérifier |
| EDATE | MOIS.DECALER | oui | Présent mais à vérifier |
| EOMONTH | FIN.MOIS | oui | Présent mais à vérifier |
| HOUR | HEURE | oui | Présent mais à vérifier |
| ISOWEEKNUM | NO.SEMAINE.ISO | oui | Présent mais à vérifier |
| MINUTE | MINUTE | oui | Présent mais à vérifier |
| MONTH | MOIS | oui | Présent mais à vérifier |
| NETWORKDAYS | NB.JOURS.OUVRES | oui | Présent mais à vérifier |
| NETWORKDAYS.INTL | NB.JOURS.OUVRES.INTL | oui | Présent mais à vérifier |
| NOW | MAINTENANT | oui | Présent mais à vérifier |
| SECOND | SECONDE | oui | Présent mais à vérifier |
| TIME | TEMPS | oui | Présent mais à vérifier |
| TIMEVALUE | TEMPSVAL | oui | Présent mais à vérifier |
| TODAY | AUJOURDHUI | oui | Présent mais à vérifier |
| WEEKDAY | JOURSEM | oui | Présent mais à vérifier |
| WEEKNUM | NO.SEMAINE | oui | Présent mais à vérifier |
| WORKDAY | SERIE.JOUR.OUVRE | oui | Présent mais à vérifier |
| WORKDAY.INTL | SERIE.JOUR.OUVRE.INTL | oui | Présent mais à vérifier |
| YEAR | ANNEE | oui | Présent mais à vérifier |
| YEARFRAC | FRACTION.ANNEE | oui | Présent mais à vérifier |

### Logique (11)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| AND | ET | oui | Présent mais à vérifier |
| FALSE | FAUX | oui | Présent mais à vérifier |
| IF | SI | oui | Présent mais à vérifier |
| IFERROR | SIERREUR | oui | Présent mais à vérifier |
| IFNA | SI.NON.DISP | oui | Présent mais à vérifier |
| IFS | SI.CONDITIONS | oui | Présent mais à vérifier |
| NOT | PAS | oui | Présent mais à vérifier |
| OR | OU | oui | Présent mais à vérifier |
| SWITCH | SI.MULTIPLE | oui | Présent mais à vérifier |
| TRUE | VRAI | oui | Présent mais à vérifier |
| XOR | OUX | oui | Présent mais à vérifier |

### Recherche et référence (36)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| ADDRESS | ADRESSE | oui | Présent mais à vérifier |
| AREAS | — | oui | Présent mais à vérifier |
| CHOOSE | CHOISIR | oui | Présent mais à vérifier |
| CHOOSECOLS | CHOISIRCOLS | oui | Présent mais à vérifier |
| CHOOSEROWS | CHOISIRLIGNES | oui | Présent mais à vérifier |
| COLUMN | COLONNE | oui | Présent mais à vérifier |
| COLUMNS | COLONNES | oui | Présent mais à vérifier |
| DROP | EXCLURE | oui | Présent mais à vérifier |
| EXPAND | ETENDRE | oui | Présent mais à vérifier |
| FILTER | FILTRE | oui | Présent mais à vérifier |
| FORMULATEXT | FORMULETEXTE | oui | Présent mais à vérifier |
| GETPIVOTDATA | LIREDONNEESTABCROISDYNAMIQUE | oui | Présent mais à vérifier |
| HLOOKUP | RECHERCHEH | oui | Présent mais à vérifier |
| HSTACK | ASSEMB.H | oui | Présent mais à vérifier |
| HYPERLINK | LIEN_HYPERTEXTE | oui | Présent mais à vérifier |
| INDEX | INDEX | oui | Présent mais à vérifier |
| INDIRECT | INDIRECT | oui | Présent mais à vérifier |
| LOOKUP | RECHERCHE | oui | Présent mais à vérifier |
| MATCH | EQUIV | oui | Présent mais à vérifier |
| OFFSET | DECALER | oui | Présent mais à vérifier |
| ROW | LIGNE | oui | Présent mais à vérifier |
| ROWS | LIGNES | oui | Présent mais à vérifier |
| RTD | — | oui | Absent |
| SORT | TRIER | oui | Présent mais à vérifier |
| SORTBY | TRIERPAR | oui | Présent mais à vérifier |
| TAKE | PRENDRE | oui | Présent mais à vérifier |
| TOCOL | DANSCOL | oui | Présent mais à vérifier |
| TOROW | DANSLIGNE | oui | Présent mais à vérifier |
| TRANSPOSE | TRANSPOSE | oui | Présent mais à vérifier |
| UNIQUE | UNIQUE | oui | Présent mais à vérifier |
| VLOOKUP | RECHERCHEV | oui | Présent mais à vérifier |
| VSTACK | ASSEMB.V | oui | Présent mais à vérifier |
| WRAPCOLS | ORGA.COLS | oui | Présent mais à vérifier |
| WRAPROWS | ORGA.LIGNES | oui | Présent mais à vérifier |
| XLOOKUP | XLOOKUP | oui | Présent mais à vérifier |
| XMATCH | EQUIVX | oui | Présent mais à vérifier |

### Finances (55)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| ACCRINT | INTERET.ACC | oui | Présent mais à vérifier |
| ACCRINTM | INTERET.ACC.MAT | oui | Présent mais à vérifier |
| AMORDEGRC | AMORDEGRC | oui | Présent mais à vérifier |
| AMORLINC | AMORLINC | oui | Présent mais à vérifier |
| COUPDAYBS | NB.JOURS.COUPON.PREC | oui | Présent mais à vérifier |
| COUPDAYS | NB.JOURS.COUPONS | oui | Présent mais à vérifier |
| COUPDAYSNC | NB.JOURS.COUPON.SUIV | oui | Présent mais à vérifier |
| COUPNCD | DATE.COUPON.SUIV | oui | Présent mais à vérifier |
| COUPNUM | NB.COUPONS | oui | Présent mais à vérifier |
| COUPPCD | DATE.COUPON.PREC | oui | Présent mais à vérifier |
| CUMIPMT | CUMUL.INTER | oui | Présent mais à vérifier |
| CUMPRINC | CUMUL.PRINCPER | oui | Présent mais à vérifier |
| DB | DB | oui | Présent mais à vérifier |
| DDB | DDB | oui | Présent mais à vérifier |
| DISC | TAUX.ESCOMPTE | oui | Présent mais à vérifier |
| DOLLARDE | PRIX.DEC | oui | Présent mais à vérifier |
| DOLLARFR | PRIX.FRAC | oui | Présent mais à vérifier |
| DURATION | DUREE | oui | Présent mais à vérifier |
| EFFECT | TAUX.EFFECTIF | oui | Présent mais à vérifier |
| FV | VC | oui | Présent mais à vérifier |
| FVSCHEDULE | VC.PAIEMENTS | oui | Présent mais à vérifier |
| INTRATE | TAUX.INTERET | oui | Présent mais à vérifier |
| IPMT | INTPER | oui | Présent mais à vérifier |
| IRR | TRI | oui | Présent mais à vérifier |
| ISPMT | ISPMT | oui | Présent mais à vérifier |
| MDURATION | DUREE.MODIFIEE | oui | Présent mais à vérifier |
| MIRR | TRIM | oui | Présent mais à vérifier |
| NOMINAL | TAUX.NOMINAL | oui | Présent mais à vérifier |
| NPER | NPM | oui | Présent mais à vérifier |
| NPV | VAN | oui | Présent mais à vérifier |
| ODDFPRICE | PRIX.PCOUPON.IRREG | oui | Présent mais à vérifier |
| ODDFYIELD | REND.PCOUPON.IRREG | oui | Présent mais à vérifier |
| ODDLPRICE | PRIX.DCOUPON.IRREG | oui | Présent mais à vérifier |
| ODDLYIELD | REND.DCOUPON.IRREG | oui | Présent mais à vérifier |
| PDURATION | PDUREE | oui | Présent mais à vérifier |
| PMT | VPM | oui | Présent mais à vérifier |
| PPMT | PRINCPER | oui | Présent mais à vérifier |
| PRICE | PRIX.TITRE | oui | Présent mais à vérifier |
| PRICEDISC | VALEUR.ENCAISSEMENT | oui | Présent mais à vérifier |
| PRICEMAT | PRIX.TITRE.ECHEANCE | oui | Présent mais à vérifier |
| PV | VA | oui | Présent mais à vérifier |
| RATE | TAUX | oui | Présent mais à vérifier |
| RECEIVED | VALEUR.NOMINALE | oui | Présent mais à vérifier |
| RRI | TAUX.INT.EQUIV | oui | Présent mais à vérifier |
| SLN | AMORLIN | oui | Présent mais à vérifier |
| SYD | AMORANN | oui | Présent mais à vérifier |
| TBILLEQ | TAUX.ESCOMPTE.R | oui | Présent mais à vérifier |
| TBILLPRICE | PRIX.BON.TRESOR | oui | Présent mais à vérifier |
| TBILLYIELD | RENDEMENT.BON.TRESOR | oui | Présent mais à vérifier |
| VDB | VDB | oui | Présent mais à vérifier |
| XIRR | TRI.PAIEMENTS | oui | Présent mais à vérifier |
| XNPV | VAN.PAIEMENTS | oui | Présent mais à vérifier |
| YIELD | RENDEMENT.TITRE | oui | Présent mais à vérifier |
| YIELDDISC | RENDEMENT.SIMPLE | oui | Présent mais à vérifier |
| YIELDMAT | RENDEMENT.TITRE.ECHEANCE | oui | Présent mais à vérifier |

### Ingénierie (54)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| BESSELI | BESSELI | oui | Présent mais à vérifier |
| BESSELJ | BESSELJ | oui | Présent mais à vérifier |
| BESSELK | BESSELK | oui | Présent mais à vérifier |
| BESSELY | BESSELY | oui | Présent mais à vérifier |
| BIN2DEC | BINDEC | oui | Présent mais à vérifier |
| BIN2HEX | BINHEX | oui | Présent mais à vérifier |
| BIN2OCT | BINOCT | oui | Présent mais à vérifier |
| BITAND | BITET | oui | Présent mais à vérifier |
| BITLSHIFT | BITDECALG | oui | Présent mais à vérifier |
| BITOR | BITOU | oui | Présent mais à vérifier |
| BITRSHIFT | BITDECALD | oui | Présent mais à vérifier |
| BITXOR | BITOUEXCLUSIF | oui | Présent mais à vérifier |
| COMPLEX | COMPLEXE | oui | Présent mais à vérifier |
| CONVERT | CONVERT | oui | Présent mais à vérifier |
| DEC2BIN | DECBIN | oui | Présent mais à vérifier |
| DEC2HEX | DECHEX | oui | Présent mais à vérifier |
| DEC2OCT | DECOCT | oui | Présent mais à vérifier |
| DELTA | DELTA | oui | Présent mais à vérifier |
| ERF | ERF | oui | Présent mais à vérifier |
| ERF.PRECISE | ERF.PRECIS | oui | Présent mais à vérifier |
| ERFC | ERFC | oui | Présent mais à vérifier |
| ERFC.PRECISE | ERFC.PRECIS | oui | Présent mais à vérifier |
| GESTEP | SUP.SEUIL | oui | Présent mais à vérifier |
| HEX2BIN | HEXBIN | oui | Présent mais à vérifier |
| HEX2DEC | HEXDEC | oui | Présent mais à vérifier |
| HEX2OCT | HEXOCT | oui | Présent mais à vérifier |
| IMABS | COMPLEXE.MODULE | oui | Présent mais à vérifier |
| IMAGINARY | COMPLEXE.IMAGINAIRE | oui | Présent mais à vérifier |
| IMARGUMENT | COMPLEXE.ARGUMENT | oui | Présent mais à vérifier |
| IMCONJUGATE | COMPLEXE.CONJUGUE | oui | Présent mais à vérifier |
| IMCOS | COMPLEXE.COS | oui | Présent mais à vérifier |
| IMCOSH | COMPLEXE.COSH | oui | Présent mais à vérifier |
| IMCOT | COMPLEXE.COT | oui | Présent mais à vérifier |
| IMCSC | COMPLEXE.CSC | oui | Présent mais à vérifier |
| IMCSCH | COMPLEXE.CSCH | oui | Présent mais à vérifier |
| IMDIV | COMPLEXE.DIV | oui | Présent mais à vérifier |
| IMEXP | COMPLEXE.EXP | oui | Présent mais à vérifier |
| IMLN | COMPLEXE.LN | oui | Présent mais à vérifier |
| IMLOG10 | COMPLEXE.LOG10 | oui | Présent mais à vérifier |
| IMLOG2 | COMPLEXE.LOG2 | oui | Présent mais à vérifier |
| IMPOWER | COMPLEXE.PUISSANCE | oui | Présent mais à vérifier |
| IMPRODUCT | COMPLEXE.PRODUIT | oui | Présent mais à vérifier |
| IMREAL | COMPLEXE.REEL | oui | Présent mais à vérifier |
| IMSEC | COMPLEXE.SEC | oui | Présent mais à vérifier |
| IMSECH | COMPLEXE.SECH | oui | Présent mais à vérifier |
| IMSIN | COMPLEXE.SIN | oui | Présent mais à vérifier |
| IMSINH | COMPLEXE.SINH | oui | Présent mais à vérifier |
| IMSQRT | COMPLEXE.RACINE | oui | Présent mais à vérifier |
| IMSUB | COMPLEXE.DIFFERENCE | oui | Présent mais à vérifier |
| IMSUM | COMPLEXE.SOMME | oui | Présent mais à vérifier |
| IMTAN | COMPLEXE.TAN | oui | Présent mais à vérifier |
| OCT2BIN | OCTBIN | oui | Présent mais à vérifier |
| OCT2DEC | OCTDEC | oui | Présent mais à vérifier |
| OCT2HEX | OCTHEX | oui | Présent mais à vérifier |

### Information (19)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| CELL | CELLULE | oui | Présent mais à vérifier |
| ERROR.TYPE | TYPE.ERREUR | oui | Présent mais à vérifier |
| ISBLANK | ESTVIDE | oui | Présent mais à vérifier |
| ISERR | ESTERR | oui | Présent mais à vérifier |
| ISERROR | ESTERREUR | oui | Présent mais à vérifier |
| ISEVEN | EST.PAIR | oui | Présent mais à vérifier |
| ISFORMULA | ESTFORMULE | oui | Présent mais à vérifier |
| ISLOGICAL | ESTLOGIQUE | oui | Présent mais à vérifier |
| ISNA | ESTNA | oui | Présent mais à vérifier |
| ISNONTEXT | ESTNONTEXTE | oui | Présent mais à vérifier |
| ISNUMBER | ESTNUM | oui | Présent mais à vérifier |
| ISODD | EST.IMPAIR | oui | Présent mais à vérifier |
| ISREF | ESTREF | oui | Présent mais à vérifier |
| ISTEXT | ESTTEXTE | oui | Présent mais à vérifier |
| N | N | oui | Présent mais à vérifier |
| NA | NA | oui | Présent mais à vérifier |
| SHEET | FEUILLE | oui | Présent mais à vérifier |
| SHEETS | FEUILLES | oui | Présent mais à vérifier |
| TYPE | TYPE | oui | Présent mais à vérifier |

### Base de données (12)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| DAVERAGE | BDMOYENNE | oui | Présent mais à vérifier |
| DCOUNT | BCOMPTE | oui | Présent mais à vérifier |
| DCOUNTA | BDNBVAL | oui | Présent mais à vérifier |
| DGET | BDLIRE | oui | Présent mais à vérifier |
| DMAX | BDMAX | oui | Présent mais à vérifier |
| DMIN | BDMIN | oui | Présent mais à vérifier |
| DPRODUCT | BDPRODUIT | oui | Présent mais à vérifier |
| DSTDEV | BDECARTYPE | oui | Présent mais à vérifier |
| DSTDEVP | BDECARTYPEP | oui | Présent mais à vérifier |
| DSUM | BDSOMME | oui | Présent mais à vérifier |
| DVAR | BDVAR | oui | Présent mais à vérifier |
| DVARP | BDVARP | oui | Présent mais à vérifier |

### Cube (OLAP) (7)

| Fonction (EN) | Nom FR ONLYOFFICE | Excel | Statut ForgeOffice |
|---|---|---|---|
| CUBEKPIMEMBER | — | oui | Absent |
| CUBEMEMBER | — | oui | Absent |
| CUBEMEMBERPROPERTY | — | oui | Absent |
| CUBERANKEDMEMBER | — | oui | Absent |
| CUBESET | — | oui | Absent |
| CUBESETCOUNT | — | oui | Absent |
| CUBEVALUE | — | oui | Absent |
