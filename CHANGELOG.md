# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les numéros suivent `X.Y.Z` ; le tag Git `vX.Y.Z` doit être identique à la version de `package.json`, `apps/desktop/package.json`, `tauri.conf.json` et `Cargo.toml` (vérifié par la release).

## [0.1.0] - 2026-11-04

Première version : toute la suite est écrite et testée, rien n'est encore publié (aucun `tauri build` complet n'a été lancé : voir `docs/ROADMAP.md`).

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

- Licence non choisie ; une dépendance GPL-3.0 (`epub`) et plusieurs MPL-2.0 sont signalées dans `THIRD_PARTY_NOTICES.md` (voir `docs/DECISIONS-A-PRENDRE.md`).
- Aucune police embarquée ; installeurs Windows non signés ; macOS non notarisé ; APK non signé.
- Limites fonctionnelles par application : `docs/ROADMAP.md`.
