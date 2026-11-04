# Décisions qui reviennent au propriétaire

Hormis le point 2 (polices, décidé le 2026-11-04), rien de ce qui suit n'a été décidé ni exécuté : aucune publication, aucun dépôt distant créé, aucun certificat acheté. Chaque point donne l'état, les options et une recommandation. Les cases à cocher servent de suivi.

## 1. Licence (décidée le 2026-11-04 : PolyForm Noncommercial 1.0.0)

> **Mise à jour.** La crate GPL `epub` a été retirée (lecteur EPUB réécrit avec `zip` + `quick-xml`, `cargo tree -i epub` ne trouve plus rien), puis la licence recommandée a été posée : `LICENSE` = PolyForm Noncommercial 1.0.0, la même que WinNote. Il ne reste que des dépendances MPL-2.0 (copyleft faible, sans obligation tant qu'on ne les modifie pas). Pour en changer : remplacer `LICENSE` et les champs `license` (package.json, Cargo.toml des crates et de la coquille). Le texte d'analyse ci-dessous est conservé pour mémoire.

**État.** Aucun fichier `LICENSE` dans le dépôt ; les crates internes sont déclarées `UNLICENSED`. Le texte légal des dépendances est généré dans [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) (`node scripts/third-party-notices.mjs`).

**Constat sur les dépendances : elles ne sont pas toutes permissives.** Presque tout est MIT, Apache-2.0 ou une double licence « MIT OR Apache-2.0 » ; mais l'analyse automatique relève :

| Dépendance | Licence | Où | Gravité |
|---|---|---|---|
| **`epub` 2.1.x** (lecture d'EPUB) | **GPL-3.0** (2.1.5) / GPL-3.0-or-later (2.1.6) | `crates/forge-convert` (`conv/documents.rs`, seul usage), donc dans le binaire de la coquille | **Forte** : un binaire qui lie du code GPL-3.0 doit être distribué sous GPL-3.0 avec ses sources. Incompatible avec une licence propriétaire ou « non commerciale ». |
| `resvg`, `usvg` 0.44 ; `symphonia*` 0.5 (14 crates) ; `epub-builder` 0.7 | MPL-2.0 | `forge-convert` | Faible : copyleft au niveau du fichier. Distribuer l'application est permis ; si un fichier MPL est modifié, il faut publier sa version modifiée. Rien à faire tant qu'on n'y touche pas. |
| `cssparser`, `selectors`, `dtoa-short`, `option-ext` | MPL-2.0 | arbre Tauri (affichage web) | Idem |
| `jszip` | MIT OR GPL-3.0-or-later | npm | Aucune : on retient MIT |
| `dompurify` | MPL-2.0 OR Apache-2.0 | npm | Aucune : on retient Apache-2.0 |

Dépendances directes (production) et leur licence :

- **npm** : CodeMirror 6 (`@codemirror/*`, `@lezer/highlight`), ProseMirror (`prosemirror-*`), React, React DOM, `@cantoo/pdf-lib` (fork maintenu de pdf-lib, qui était abandonné) : MIT. `pdfjs-dist` : Apache-2.0. `jszip` : MIT OR GPL-3.0. `dompurify` : MPL-2.0 OR Apache-2.0. `@tauri-apps/api` et plugins : MIT OR Apache-2.0.
- **Outils de développement** (non distribués) : Vite, `@vitejs/plugin-react`, `@types/*` : MIT ; TypeScript : Apache-2.0 ; `@tauri-apps/cli` : Apache-2.0 OR MIT ; `@fluentui/svg-icons` : MIT (icônes extraites et embarquées).
- **Rust, coquille** : `tauri` et ses plugins (dialog, fs, updater, single-instance) : Apache-2.0 OR MIT ; `serde`, `serde_json`, `getrandom` : MIT OR Apache-2.0 ; `rfd` : MIT.
- **Rust, `forge-base`** : `rusqlite` (SQLite embarqué, domaine public) : MIT ; `thiserror`, `base64`, `serde*` : MIT OR Apache-2.0.
- **Rust, `forge-convert`** : MIT (`lopdf`, `calamine`, `docx-rs`, `pulldown-cmark`, `quick-xml`, `zip`), MIT OR Apache-2.0 (`image`, `flate2`, `tar`, `toml`, `serde_yaml`, `rust_xlsxwriter`, `anyhow`, `thiserror`), Apache-2.0 (`htmd`, `flacenc`, `hound`, `similar`, `sevenz-rust2`), Unlicense/MIT (`csv`), **MPL-2.0** (`resvg`, `symphonia`, `epub-builder`), **GPL-3.0** (`epub`).

**Options pour `epub`.**

- [ ] **A (recommandée)** : retirer la crate et réécrire la lecture EPUB (un EPUB est un zip : `container.xml` → `.opf` → ordre du *spine* → fichiers XHTML), avec `zip` et `quick-xml` déjà présents ; une centaine de lignes, tests à ajouter sur un EPUB généré par `epub-builder`. Plus aucune dépendance GPL, la licence de ForgeOffice reste libre de ton choix.
- [ ] B : garder `epub` et publier **tout ForgeOffice sous GPL-3.0** (sources publiques). Cohérent seulement si le projet est ouvert.
- [ ] C : supprimer la lecture d'EPUB (l'écriture reste via `epub-builder`, MPL).

**Options pour la licence de ForgeOffice** (après A) :

- [ ] Propriétaire, tous droits réservés, binaires gratuits (cohérent avec « zéro service payant » et un dépôt privé).
- [ ] Source disponible, non commerciale (comme WinNote : PolyForm Noncommercial) : lisible, gratuit pour un usage personnel, pas de revente.
- [ ] Libre (MIT, Apache-2.0 ou GPL-3.0).

Recommandation : A, puis la même licence que WinNote pour rester cohérent entre les applications ; ajouter alors un fichier `LICENSE` et `license` dans `Cargo.toml` / `package.json`.

**Autre point juridique à connaître.** L'interface reproduit l'aspect de Microsoft Office 2024 (disposition du ruban, couleurs d'application, vocabulaire « équivalent Word/Excel… » dans la documentation). Aucun logo, aucun code ni police Microsoft n'est embarqué (les icônes Fluent sont MIT). Éviter les noms « Word », « Excel », « PowerPoint », « Publisher », « Access » comme noms de produit ou d'écran : les appellations « Texte », « Tableur », « Présentation »… le font déjà. Citer Microsoft seulement pour comparer.

## 2. Polices à embarquer — DÉCISION PRISE (2026-11-04)

**Décision du propriétaire : téléchargement autorisé, polices complètes (pas de sous-ensembles), avec Selawik.** Carlito 1.104 (Calibri), Liberation 2.1.5 Sans/Serif/Mono (Arial, Times New Roman, Courier New) et Selawik 1.01 (Segoe UI), toutes SIL OFL 1.1, sont dans `packages/ui/fonts/` (7,3 Mo, `.ttf` commités ; récupération vérifiée par SHA-256 : `node scripts/fetch-fonts.mjs`). Déclarées par alias dans `packages/ui/src/fonts.css` (`local()` d'abord : les vraies polices Microsoft restent prioritaires). Licences : section « Polices » de `THIRD_PARTY_NOTICES.md` (générateur `scripts/third-party-notices.mjs`).

- [x] autoriser le téléchargement et l'ajout au dépôt · [x] avec Selawik · [x] polices complètes.
- Aptos, Calibri, Segoe UI et Cambria (propriétaires) ne sont pas embarquées ; Aptos se replie sur Carlito. Cambria n'a pas de substitut embarqué (Caladea, métriquement compatible, SIL OFL, pourrait s'ajouter).
- Reste à faire : incorporer les polices aux PDF exportés pour un rendu stable ; faire attendre `whenFontsReady()` (exporté par `@forgeoffice/ui`) aux modules qui mesurent le texte (voir `packages/ui/STATUS.md`).

## 3. Certificat de signature de code Windows

**État.** Les exécutables et installeurs Windows ne sont **pas signés** (seule la signature minisign de l'updater existe, elle protège la mise à jour mais pas l'installation initiale). Conséquence : avertissement Microsoft SmartScreen (« Windows a protégé votre ordinateur ») au premier lancement, et réputation à construire.

**Options :**

- [ ] Aucun certificat (gratuit) : SmartScreen avertit ; documenter « Informations complémentaires → Exécuter quand même » dans la page de téléchargement.
- [ ] Certificat Authenticode OV ou EV (payant, abonnement annuel) : incompatible avec la règle « zéro service payant » ; l'EV supprime l'avertissement immédiatement.
- [ ] Service de signature gratuit pour projets libres (par exemple SignPath Foundation) : exige un dépôt public sous licence libre (voir §1 option B) ; conditions à vérifier au moment de la demande.
- [ ] Signature automatique Azure / service cloud : payant.

Branchement technique une fois le certificat disponible : `bundle.windows.signCommand` ou `certificateThumbprint` dans `tauri.conf.json` (fichier de la coquille, à modifier par l'agent concerné) et un secret dans `release.yml`.

## 4. Dépôt GitHub, relais de mise à jour, secrets

**État.** L'endpoint de l'updater est `https://github.com/Heiphaistos/ForgeOffice/releases/latest/download/latest.json` (dans `tauri.conf.json`). Ce dépôt **n'existe pas encore** (`gh repo view` ne le trouve pas). La clé publique de l'updater est embarquée ; la clé privée est dans `D:\MDP\forgeoffice-updater.key` (copie à garder aussi sur `E:\MDP`).

**À décider :**

- [ ] Créer le dépôt `Heiphaistos/ForgeOffice`. Privé par défaut ; mais **un dépôt privé ne peut pas servir `latest.json` à une application installée** (les téléchargements de release exigent un jeton). Deux voies :
  - dépôt **public** (cohérent avec l'option B/SignPath et simple) ;
  - dépôt **privé + relais** `https://heiphaistos.org/gh/ForgeOffice/releases/download/…` comme pour les autres applications : modifier l'endpoint de `tauri.conf.json` et passer l'URL du relais à `make-latest-json.mjs --base-url` (ligne marquée dans `release.yml`).
- [ ] Créer les secrets Actions `TAURI_SIGNING_PRIVATE_KEY` (contenu du fichier `.key`) et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Ne jamais les écrire dans un fichier du dépôt (`*.key` est dans `.gitignore`).
- [ ] Protection de la branche principale, Dependabot, secret scanning (règles GitHub habituelles).
- [ ] Quota Actions : si « Actions budget » est épuisé sur un dépôt privé, appliquer la procédure habituelle (public le temps du build puis retour en privé). Attention : la matrice complète (2 Windows, Linux, 2 macOS, Android) consomme beaucoup de minutes, surtout macOS (facturé 10 ×).
- [ ] Première release : pousser un tag `vX.Y.Z` correspondant aux versions (`release.yml` le vérifie), contrôler le **brouillon**, tester l'installation et la mise à jour sur une machine propre, puis publier à la main. `latest.json` n'est servi par `/releases/latest/` qu'une fois la release publiée (non brouillon, non préversion).

## 5. Notarisation macOS

**État.** Les `.dmg` (Apple silicon et Intel) sont construits avec une **signature ad hoc** (`APPLE_SIGNING_IDENTITY: '-'`), sans compte Apple : l'application se lance après « clic droit → Ouvrir » ; Gatekeeper avertit sinon.

**Options :**

- [ ] Rester en ad hoc et documenter le contournement (gratuit).
- [ ] Adhérer à l'Apple Developer Program (payant, annuel), certificat « Developer ID Application » + notarisation (`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` en secrets) : l'application s'ouvre sans avertissement. Même compte nécessaire pour iOS.

## 6. Signature Android (et iOS)

**État.** `npm run android:init` n'a jamais été lancé (`gen/android` est ignoré par git) ; le job Android de `release.yml` l'exécute et produit un `.apk` **non signé** (non installable tel quel). Il est marqué `continue-on-error` : son échec n'empêche pas la release.

**À décider :**

- [ ] Créer un keystore de publication hors dépôt (`D:\MDP\`), le mettre en secret Actions (base64 + mots de passe) et ajouter l'étape de signature (`gen/android/keystore.properties`) ; sans cela, l'APK ne peut être diffusé qu'en l'ayant signé à la main (`apksigner`).
- [ ] Distribution : APK sur la page de release seulement, ou aussi Google Play (compte payant unique) / F-Droid (gratuit, exige des sources libres).
- [ ] iOS : compte Apple Developer obligatoire, profil de provisionnement, construction sur macOS ; hors périmètre tant que ce compte n'existe pas.

## 7. Site web (optionnel)

`apps/web` est une application statique (`npm run build` → `apps/web/dist`) : elle pourrait être hébergée telle quelle pour un essai en ligne. Limites en mode navigateur : pas de moteurs natifs (Base de données en lecture seule sur base de démonstration, conversions vers PDF/EPUB et audio grisées), pas d'enregistrement à l'emplacement d'origine (téléchargement), pas de mise à jour.

- [ ] Pas de site pour l'instant (recommandé tant que les installeurs ne sont pas validés).
- [ ] Site d'essai en ligne seulement (banc navigateur).
- [ ] Vrai site multi-pages (présentation, une page par application, tutoriels d'installation par plateforme, journal des versions), selon le standard habituel des sites du propriétaire ; à confier à l'agent web.

## 8. Autres décisions mineures

- [ ] Identifiant d'application `org.heiphaistos.forgeoffice` et éditeur « Heiphaistos » : à confirmer (changer l'identifiant après publication casse les mises à jour et les associations).
- [ ] Langues : l'interface est **uniquement en français** (règle « Français d'abord ») ; décider quand ajouter l'anglais (les installeurs MSI/NSIS proposent déjà fr-FR et en-US).
- [ ] Fréquence de vérification des mises à jour (20 s après le démarrage puis toutes les 6 h) et canal (stable seulement ?).
- [ ] Format `.pub` de Publisher et `.accdb`/`.mdb` d'Access : déclarés dans la table des modules mais non lus ; les retirer des associations ou prévoir des lecteurs (chantiers importants, voir la feuille de route).
- [ ] Langage de macros (VBA conservé mais non exécuté) : à trancher avant tout chantier d'automatisation.
