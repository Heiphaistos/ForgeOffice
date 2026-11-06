# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les numéros suivent `X.Y.Z` ; le tag Git `vX.Y.Z` doit être identique à la version de `package.json`, `apps/desktop/package.json`, `tauri.conf.json` et `Cargo.toml` (vérifié par la release).

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
