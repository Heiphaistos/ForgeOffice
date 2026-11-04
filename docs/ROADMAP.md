# Feuille de route de ForgeOffice

Agrégation des « reste à faire » des fiches `STATUS.md` (état au 2026-11-04), puis ce qui manque face à Microsoft 365, puis les priorités proposées. Rien ici n'est engagé : ce sont des propositions à arbitrer.

## 1. Transversal : ce qui n'a jamais été exécuté

Le point le plus important : **`tauri build` complet n'a jamais été lancé**, et la coquille graphique n'a pas été ouverte pendant les lots de développement (consigne de ne pas piloter l'écran). Tout ce qui suit est prouvé par les tests et le rendu dans un navigateur, pas par l'application installée.

| À observer | Où |
|---|---|
| Installeurs NSIS et MSI (64 et 32 bits), exécutable portable, `portable.flag` | `apps/desktop` |
| **Fermeture sans processus restant** (app, enfants, WebView2) par le chemin réel, et après un kill brutal | exigence commune à toutes les apps |
| Chaîne de mise à jour N → N+1, installeur **et** portable | `apps/desktop` |
| Création, ouverture, enregistrement réels d'une base ; dialogues natifs ; impression | Base de données, tous les modules |
| Compression, protection, déchiffrement, caviardage, correction de texte natifs dans la fenêtre PDF ; chaîne native du Convertisseur | PDF, Convertisseur |
| Compilation et lancement Linux, macOS, Android (`gen/android` absent : `npm run android:init`), iOS | CI |
| Ghostscript (PDF/A), ocrmypdf + Tesseract (OCR), MuPDF/Poppler (rendu), LibreOffice (Office → PDF fidèle) : **jamais exercés** (seul `pdftotext` est installé sur le PC de développement) | `forge-convert` |
| Associations Windows : le modèle NSIS de Tauri libelle le verbe en anglais (« Open with ForgeOffice ») et se propose comme défaut ; un `installerHooks` est à finir pour « Ouvrir avec » en français | `apps/desktop` |
| Les workflows GitHub (`ci.yml`, `release.yml`) n'ont jamais tourné | `.github/` |

## 2. Limites connues par application

### Texte (`packages/word`, `packages/docx`)

- Pagination : une seule géométrie de page (celle de la dernière section) pour tout le document ; espacement avant non supprimé en haut de page ; dernière ligne avant une coupure non justifiée.
- Colonnes en mode Page : dépendent de `column-wrap` CSS (WebView2/Chromium récents) ; ailleurs, colonnes équilibrées sans pages.
- Notes de bas de page dans la marge basse (zone de texte non réduite) ; notes de fin seulement dans un volet.
- Taquets de tabulation personnalisés non rendus dans le corps ; images flottantes approximées (pas de positionnement absolu ni de poignées) ; filigrane et couleur de page en propriétés personnalisées (invisibles dans Word) ; encre insérée comme image.
- Correcteur du système, sans grammaire propre. Publipostage et Comparer demandent un fichier (vérifiés par test, pas pilotés dans le banc). Plusieurs pages et aperçu avant impression : vignettes en lecture seule.
- Format : `.doc` (images, en-têtes/pieds, commentaires, listes numérotées, sections non lus ; pas d'écriture), RTF (commentaires non lus), `.docx` chiffré refusé ; réponses de commentaires non revérifiées dans Word.

### Tableur (`packages/excel`, `packages/xlsx`, `packages/formulas`)

- Définitions des tableaux croisés dynamiques non enregistrées dans le fichier (seuls les résultats le sont) : à relier à un modèle `pivotCache`.
- Vue Mise en page sans pages séparées éditables ; graphiques sans éditeur de séries ni titres d'axes (radar et bulles rendus en nuage) ; pas de menu d'options de recopie ; grouper/plan sans boutons +/− dans la marge.
- `.xls` : commentaires, liens, images, graphiques, mises en forme conditionnelles, validations, filtres, protection non lus ; pas d'écriture `.xls`. `.ods` : mises en forme conditionnelles, validations, graphiques, images, commentaires, volets figés non lus ni écrits.
- Fonctions absentes : `FORECAST.ETS*`, `ACCRINT`, `AMORDEGRC`, `AMORLINC`, `ODDF*`/`ODDL*`, `GETPIVOTDATA`, `PIVOTBY`, `FILTERXML`, `WEBSERVICE`, `BAHTTEXT`, `TRIMRANGE`, `IMAGE`, `EUROCONVERT`, `STOCKHISTORY`, `RTD`. Références 3D non ajustées à l'insertion de lignes ; `CELLULE` et `INFORMATIONS` partiels ; index de zones lent avec des dizaines de milliers de plages se chevauchant.

### Présentation (`packages/powerpoint`, `packages/pptx`)

- **Export PDF rastérisé** (une image JPEG par page) : texte non sélectionnable ; à passer en vectoriel avec pdf-lib.
- Diaporama : pas de fenêtre « public » séparée sur un second écran ; pas d'enregistrement ni de vérification du minutage.
- Rendu : pas de 3D ; images EMF/WMF remplacées par un aplat gris. Absents : création de SmartArt, équations, motifs de remplissage, styles de tableau au-delà de 19, suppression d'arrière-plan d'image. Police « Aptos Display » absente du système de test (repli plus gras).
- Formats : `.odp` (graphiques, médias, animations, écriture), `.ppt` (mise en forme des caractères, tableaux, graphiques, animations), `.pptx` chiffré refusé.

### Publication (`packages/publisher`)

- Habillage : limité à la première colonne d'une zone multicolonne et à 2 objets par zone ; « ajusté » ne suit que les ellipses. Le `.pptx` exporté ne garde ni habillage, ni liaisons, ni lettrines, ni repères.
- Mesure du texte approchée (`measureText` + 3 %) : une police de repli très différente peut couper une ligne trop tôt.
- **PDF rastérisé** (150 ou 300 ppp) : texte non sélectionnable, ce qui limite l'usage « prêt pour l'imprimeur » aux imprimeurs qui acceptent des images.
- `.pub` (binaire Publisher) non lu ; pas de rognage interactif d'image, de galerie de styles de tableau ; publipostage limité au CSV ; impression `services.print()` non déclenchée dans le banc.

### Base de données (`packages/access`, `crates/forge-base`)

- Interface bureau jamais lancée. Mobile : `base_create`/`base_copy` refusent les URL `content://` (SQLite exige un chemin). Ouvrir une base lit tout le fichier (jusqu'à 1 Go) pour obtenir le chemin.
- Résultats de requête en lecture seule ; pas de largeur de colonne réglable ; pagination par 100 ; mode Page des formulaires/états montre les noms de champs.
- Pas de sous-formulaires ni de boutons de commande ; états à un seul niveau de regroupement ; pas d'annuler/rétablir (écriture immédiate, comme Access) ; index multi-champs nommés absents ; `.accdb` / `.mdb` déclarés dans la table des modules, mais le Backstage n'ouvre que `.fodb`, `.sqlite` et `.db` (aucun lecteur Access).

### PDF (`packages/pdf`)

- Annotations existantes du fichier affichées et listées, mais pas modifiables ni supprimables.
- Pages avec `/Rotate` : zones de texte libre orientées comme la page non pivotée ; outils d'édition désactivés tant que l'affichage est pivoté. Glisser-déposer des miniatures et annuler/rétablir non exercés au banc.

### Convertisseur (`packages/convert`, `crates/forge-convert`)

- Nom de sortie personnalisé par fichier ; ordre et nom de la fusion réglables ; miniatures dans la liste (la commande existe côté coquille).
- Rendu PDF → images en pur Rust (Android/iOS) : passe aujourd'hui par un binaire externe.
- Caviardage : tracés vectoriels recouverts et non retirés ; CMap à longueur variable lues sur 2 octets ; signets et métadonnées contenant le texte non nettoyés ; image non décodable (JPX, CCITT, JBIG2) retirée entièrement. `Zone::en_points` ignore `/Rotate`.

### Bloc-notes (`packages/notes`)

- Non livrés ou à compléter (5 sur 101, dont 3 sans objet) : « Toujours au premier plan » (contrat `WindowControls.setAlwaysOnTop` absent), « Afficher dans l'explorateur » et détection de modification externe (pas de service), dossier ouvert en lecture mémoire (contrat `openFolder` à créer pour écrire en place).
- En-tête/pied d'impression via `@page` : non affichés par WebKitGTK (Linux). Non testé sur bureau Tauri ni sur imprimante réelle.

### Accueil, design system, coquille

- Modèles Présentation, Publication et Base de données dans l'accueil : en attente d'un contrat `template` dans `@forgeoffice/core`. Rouvrir un récent est impossible dans le navigateur (pas de chemin). Contraste élevé : aperçu sélectionné de la galerie de styles peu lisible.
- Shell : à la navigation vers une autre application, l'ancien module est remonté un instant avec le fichier destiné au nouveau (le Bloc-notes l'ignore désormais).
- Android : intent-filters « Ouvrir avec » à ajouter après `android:init`. iOS : construction sur Mac uniquement.

## 3. Ce qui manque face à Microsoft 365

Fonctions de la suite Microsoft qui n'ont **aucun équivalent** dans ForgeOffice aujourd'hui :

| Produit Microsoft | État | Remarque |
|---|---|---|
| **Outlook** (courrier, agenda, contacts) | absent | Hors périmètre « local d'abord » sans client réseau ; l'agenda et les contacts pourraient exister hors ligne (iCalendar, vCard) |
| **OneNote** (carnets) | absent | Le Bloc-notes avec liens `[[ ]]` et plan couvre l'écriture de notes en texte, pas l'encre libre ni les carnets hiérarchiques |
| **Visio** (diagrammes) | absent | Le canevas de Présentation (187 formes, connecteurs accrochés) est une bonne base |
| **Project** (planification) | absent | |
| **Forms** (formulaires, sondages), **Sway**, **Loop**, **Planner/To Do**, **Teams** | absents | Nécessitent un serveur |
| **Collaboration en temps réel**, co-édition, partage, commentaires synchronisés | absente | Architecture locale : un fichier = une fenêtre. Il faudrait un modèle CRDT et un relais |
| **Macros et VBA** | absents | Les projets VBA sont conservés dans `.docm`/`.xlsm`/`.pptm`, jamais exécutés ; seul le module Base de données a ses macros d'actions. Un langage de script maison (ou Office Scripts) reste à décider |
| **Compléments Office (Office.js)**, Power Query, Power Pivot, Power Automate, Power BI | absents | |
| **Copilot / assistants IA** | absent | À éviter en natif (règle « zéro service payant ») ; un module local optionnel est envisageable |
| **Stockage en ligne** (OneDrive, SharePoint) | absent | Volontaire (hors ligne) ; un dossier synchronisé fonctionne comme n'importe quel dossier |
| Signature numérique de documents (certificat) | partielle | PDF : signature **visuelle** (dessinée ou tapée) ; pas de signature cryptographique ni de gestion de certificats |
| Information Rights Management, étiquettes de sensibilité, chiffrement par mot de passe des fichiers Office | absents | `.docx`/`.xlsx`/`.pptx` chiffrés refusés avec un message ; chiffrement AES-256 seulement pour les PDF |
| Équations (éditeur), SmartArt (création), 3D, vidéo en ligne | absents | OMML conservé à l'enregistrement ; SmartArt conservé et rendu en repli |
| Dictée, lecteur immersif, traduction, éditeur (grammaire) | absents | Correcteur du système seulement |
| Verrouillage de document, versions, historique en ligne | absents | Récupération locale après plantage seulement |

## 4. Priorités proposées

1. **Prouver la livraison** (bloquant avant toute publication) : lancer `tauri build` sur Windows 64 et 32 bits, installer, ouvrir chaque module dans la vraie coquille, tester fermeture propre et kill brutal, tester la mise à jour N → N+1 (installeur et portable). Faire tourner `ci.yml` puis `release.yml` sur un dépôt de test (brouillon).
2. **Décisions du propriétaire** (voir [`DECISIONS-A-PRENDRE.md`](DECISIONS-A-PRENDRE.md)), en particulier la licence et la dépendance GPL `epub` : elles conditionnent la publication.
3. **Fidélité des sorties** : PDF vectoriel (texte sélectionnable) pour Présentation et Publication ; pivotCache des tableaux croisés ; habillage et polices embarquées (Carlito/Liberation/Selawik) pour un rendu identique d'un système à l'autre.
4. **Plateformes jamais compilées** : Linux et macOS via la CI, Android (`android:init` + intent-filters), puis iOS.
5. **Fonctions Office courantes manquantes** : macros (décision de langage), signature numérique des PDF, éditeur d'équations, rognage interactif d'image, sous-formulaires Access, fenêtre « public » du diaporama.
6. **Modules Microsoft absents** si le besoin se confirme : agenda/contacts hors ligne (équivalent Outlook local), diagrammes (Visio), planification (Project). La collaboration en temps réel est un chantier d'architecture à part, à ne lancer qu'avec un relais assumé.
