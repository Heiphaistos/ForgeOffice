# Plan d'implémentation : parité de l'application Texte avec Word

> Découle de [`WORD.md`](WORD.md) (755 entrées auditées, dont 388 Absent, 165 Partiel, 179 À vérifier, 23 OK). Aucun code n'a été modifié par l'audit.
> Efforts : **S** = moins d'une journée d'agent, **M** = 1 à 3 jours, **L** = plus de 3 jours ou touche au modèle.
> Règle de conflit : **un lot = un dossier propre** (`packages/word/src/<dossier>/`, tests dans `packages/word/tests/<dossier>.test.ts`). Les fichiers communs (listés au Lot 0) sont éclatés AVANT, pour qu'aucun lot n'ait à modifier le même fichier qu'un autre.

## Constats qui déterminent l'ordre

1. **Les trous de P1 les plus lourds ne sont pas des boutons mais des moteurs absents** : correction automatique / mise en forme en cours de frappe (aucune règle de saisie ProseMirror), objets flottants (formes et zones de texte insérées EN LIGNE, non sélectionnables), propriétés de tableau, tabulations, correcteur/grammaire.
2. **Beaucoup de commandes existent mais ne sont pas prouvées** : 99 entrées P1 sont « À vérifier ». Elles relèvent de l'outil de conformité automatique (en construction), pas d'un lot de code : il leur faut des identifiants stables (voir Lot 0, `data-cmd`).
3. **Raccourcis anglais au lieu de français** : Ctrl+L/R, Ctrl+Maj+C/V, Alt+Maj+T, Ctrl+Alt+F/D ; en Word FR : Ctrl+Maj+G/D, Alt+Ctrl+C/V, Alt+Maj+H, Alt+Ctrl+B/F. Les KeyTips (Alt+…) diffèrent aussi pour 5 onglets sur 9.
4. **Fichiers volumineux** : `ribbon/home.ts` (15 Ko), `strings.ts` (29 Ko), `dialogs/text.tsx` + `page.tsx` (24 Ko chacun), `App.tsx` (41 Ko, déjà > limite de 800 lignes visée) sont des points de collision : le Lot 0 les éclate.

## Ordre d'exécution

```
Lot 0 (séquentiel, seul) ──► Lots 1 à 9 (P1, en parallèle) ──► Lots 10 à 14 (P2, en parallèle) ──► Lot 15 (P3, au fil de l'eau)
```

---

## Lot 0 : socle d'intégration (S/M, à faire seul avant tout) — P1

**But** : permettre aux lots suivants de s'enregistrer sans toucher les mêmes fichiers.
**Entrées concernées** : aucune fonction nouvelle ; prérequis de toutes.
**Fichiers / dossier** : `packages/word/src/registry/` (nouveau) + éclatements :
- `strings.ts` -> `strings/index.ts` (+ un fichier par domaine : `ribbon.ts`, `dialogs.ts`, `menus.ts`, `backstage.ts`, `autocorrect.ts`…) ; `T` reste exporté à l'identique.
- `dialogs/index.tsx` -> table d'enregistrement `registry/dialogs.ts` (`registerDialog(id, Component)`), `DialogId` devient extensible (`app/types.ts`).
- `editor/setup.ts` -> `registry/plugins.ts` (liste de greffons ProseMirror) et `registry/keymaps.ts` (jeux de raccourcis, voir Lot 2).
- `ribbon/home.ts`, `insert.tsx`, `page.ts`, `references.ts`, `review.ts`, `contextual.ts` -> un sous-dossier par onglet (`ribbon/home/{clipboard,font,paragraph,styles,editing}.ts` …) ; `ribbon/index.ts` assemble. Chaque lot ne possède que ses groupes.
- `ui/editorMenu.ts` -> `contextmenu/` (Lot 13) avec une fonction par objet.
- `App.tsx` : extraire les effets (raccourcis, souris, volets) en hooks dans `app/hooks/` pour passer sous 800 lignes.
**Conformité** : chaque contrôle de ruban/menu/raccourci reçoit un attribut `data-cmd="<id stable>"` et un enregistrement dans `registry/commands.ts` (id, libellé, clé UIA Word correspondante, ex. `FormatPainter`) : l'outil de conformité automatique pourra ainsi relier chaque ligne de WORD.md à un test.
**Vérification** : `npx tsc -p packages/word/tsconfig.json --noEmit`, `node --test packages/word/tests/*.test.ts` inchangés (29 tests + nouveaux), rendu identique par captures.

---

## Lots P1 (usage quotidien) — parallélisables après le Lot 0

### Lot 1 : frappe automatique et typographie (L) — P1
**Entrées** (WORD.md §9) : Correction automatique (options + ≈100 remplacements), guillemets « typographiques », espaces insécables français avant `; : ! ? »`, fractions/ordinaux/tirets, listes automatiques (`1.`/`-` + Espace), URL -> lien, majuscule en début de phrase, 2 majuscules, jours ; dialogue « Options de correction automatique » (§4) ; Texte prédictif (P2).
**Dossier** : `packages/word/src/autocorrect/` (`rules.ts` règles pures testables, `french.ts`, `replacements.ts`, `plugin.ts` branché via `registry/plugins.ts`, `dialog.tsx` enregistré via `registry/dialogs.ts`, réglages `services.settings`). Tests : `tests/autocorrect.test.ts` (règles sans DOM).
**Dépendances** : Lot 0.

### Lot 2 : raccourcis français et clavier (M) — P1
**Entrées** (§5) : Ctrl+Maj+G/D (aligner gauche/droite, conflit avec le double soulignement actuel), Alt+Ctrl+C/V (copier/coller la mise en forme), Alt+Ctrl+B/F (notes), Alt+Maj+H (heure), Ctrl+Maj+E (suivi), F4/Ctrl+Y (répéter), Ctrl+Maj+Espace, Ctrl+Maj+F/P, Ctrl+Alt+V, Alt+Maj+←/→/↑/↓, Ctrl+8, F9 (champs), Ctrl+Alt+P/O/N, Ctrl+B = Atteindre (conflit avec Gras EN), jeu de raccourcis sélectionnable (français par défaut, anglais conservé en option) ; KeyTips alignés sur Word (§1 : Insertion = S, Conception = Ç, Références = É, Publipostage = G, Affichage = N, Aide = Ù).
**Dossier** : `packages/word/src/keymap/` (`fr.ts`, `en.ts`, `repeat.ts` commande Répéter) + `tests/keymap.test.ts` ; les KeyTips sont des propriétés `keytip` de chaque onglet : le lot ne touche que `keymap/keytips.ts` appliqué par `ribbon/index.ts` (Lot 0).
**Dépendances** : Lot 0.

### Lot 3 : objets flottants — formes, zones de texte, WordArt (L, touche au modèle) — P1
**Entrées** (§1, §1bis, §2.7) : Insertion > Formes (170), Zone de texte (galerie), onglet **Format de forme** (Insérer des formes, Styles, Remplissage, Contour, Effets, Organiser, Taille), WordArt, ordre Z (Avancer/Reculer), Grouper, Aligner, Volet Sélection, Position/Habillage, rotation, menu contextuel des objets, poignées de déplacement et de redimensionnement (celles de l'image existent déjà : `ui/ImageOverlay.tsx`).
**Dossier** : `packages/word/src/objects/` (sélection d'objet, `ShapeOverlay.tsx` poignées réutilisant `editor/images.ts`, `format-shape-tab.ts`, galerie de formes, ordre Z) ; touche `packages/docx/src/model-inline.ts` (`ShapeInline` : position absolue, ancrage, z-order, groupe) et sa lecture/écriture DrawingML (`packages/docx/src/docx/`).
**Dépendances** : Lot 0 ; **réserve le modèle docx** (un seul lot y écrit à la fois : coordonner avec Lot 4 s'il ajoute des propriétés de tableau au modèle).

### Lot 4 : tableaux complets (L) — P1
**Entrées** (§1bis Création de tableau / Disposition du tableau, §2.5, §4) : options de style (6 cases), 100 styles de tableau, bordures et trame (dialogue + stylo, style, épaisseur, couleur), Sélectionner, Afficher le quadrillage, Propriétés du tableau (Tableau/Ligne/Colonne/Cellule/Texte de remplacement), hauteur de ligne / largeur de colonne numériques, Ajustement automatique, Uniformiser, alignement 9 positions, orientation du texte, marges de cellule, Fractionner (dialogue), Fractionner le tableau, Insérer des cellules, Dessiner/Gomme, Convertir texte <-> tableau, Formule, légende de tableau, Tab en fin de tableau (nouvelle ligne).
**Dossier** : `packages/word/src/tables/` (`ribbon.ts` deux onglets contextuels, `dialogs/`, `styles.ts`, `commands.ts`) + styles de tableau dans `editor/css.ts` (point de contact minimal, annoncé au Lot 0 comme `registry/css.ts`) ; modèle : `packages/docx/src/model-table.ts`.
**Dépendances** : Lot 0 ; coordination modèle avec Lot 3.

### Lot 5 : mise en forme du texte — police, paragraphe, tabulations, bordures, listes (L) — P1
**Entrées** (§1 Accueil, §4) : dialogue **Police** (Avancé : échelle, position, crénage, ligatures ; ombre/contour/relief/gravé ; couleur de soulignement ; 17 soulignements), dialogue **Paragraphe** complet (retrait spécial, miroir, enchaînements, numéros de ligne, coupure), dialogue **Tabulations** + **rendu des taquets personnalisés dans le corps** (écart STATUS), **Bordures et trame** (paragraphe/texte/page), Puces et Numérotation (bibliothèques, Définir une puce/format/valeur), listes à plusieurs niveaux (galerie), Effets de texte, Souligner (menu complet), Reproduire la mise en forme persistant (double-clic), Interligne.
**Dossier** : `packages/word/src/format/` (`font/`, `paragraph/`, `tabs/`, `borders/`, `lists/`) ; rendu des taquets dans `packages/word/src/layout/tabs.ts` (déjà présent, à étendre dans ce lot seul).
**Dépendances** : Lot 0.

### Lot 6 : styles, thèmes, jeux de styles (M) — P1/P2
**Entrées** (§1 Accueil > Styles, Conception, §4, §6) : volet Styles complet (Nouveau, Modifier, Supprimer, Inspecteur, Gérer les styles, Options), dialogue Modifier le style (Format… Police/Paragraphe/Tabulations/Bordure/Numérotation), enregistrer la sélection comme nouveau style rapide, Jeux de styles (21), Thèmes (38), Couleurs (29), Polices (31), Effets, Espacement des paragraphes (personnalisé), Définir par défaut, personnalisation des couleurs/polices.
**Dossier** : `packages/word/src/styles/` (volet, dialogues, `themes-data.ts`, `features/design.ts` déplacé ici). Tests : CSS des styles déjà testés (`tests/features.test.ts`), à étendre.
**Dépendances** : Lot 0 ; le dialogue Police/Paragraphe du Lot 5 sert de « Format… ».

### Lot 7 : mise en page, sections, en-têtes et pieds de page (M) — P1
**Entrées** (§1 Mise en page, §1bis En-tête et pied de page, §4) : dialogue Mise en page à 3 onglets (Marges avec reliure/pages en regard, Papier ~20 tailles, **Disposition** : début de section, alignement vertical, première page différente, paires/impaires), Par défaut, Marges (Dernière personnalisée, Office 2003), Habillage du texte (saut), numéros de ligne (options, par section), coupure de mots (manuelle, options), **onglet contextuel En-tête et pied de page** (première page différente, paires/impaires, lier au précédent, position, atteindre, tabulation d'alignement, galerie de 28 modèles), numéro de page (position actuelle, format, début à), notes de bas de page/de fin (dialogue : format, position, conversion), filigrane image, bordures de page (appliquer à).
**Dossier** : `packages/word/src/pagesetup/` (+ `headerfooter/`). Les modèles de section existent (`features/sections.ts`, testé).
**Dépendances** : Lot 0.

### Lot 8 : correction, grammaire, révision (L) — P1
**Entrées** (§2.3, §1 Révision, §9) : dictionnaire hors ligne FR/EN (WASM type Hunspell) remplaçant l'attribut `spellcheck`, **Ajouter au dictionnaire**, Ignorer tout, correction automatique des suggestions, grammaire et style (volet Éditeur), synonymes (thésaurus local), Définir la langue de vérification (dialogue), détection de langue, Dictionnaire des synonymes ; suivi : Pour tous / Pour moi seul, Afficher les marques (filtres par type et par relecteur), **Volet Vérifications**, Options de suivi, Comparer/Combiner ; protection : mot de passe, restrictions de mise en forme/commentaires, Bloquer les auteurs.
**Dossier** : `packages/word/src/proofing/` (`dictionary/`, `grammar/`, `editor-pane.tsx`, `review-pane.tsx`) ; `features/spelling.ts` (présent) y est déplacé ; suivi : `editor/track.ts` reste, le lot ne modifie que `proofing/track-ui.ts`.
**Dépendances** : Lot 0 ; dictionnaires = ressource sous licence libre à valider (voir `THIRD_PARTY_NOTICES.md`).

### Lot 9 : navigation, recherche, atteindre, sélection (M) — P1
**Entrées** (§6, §4, §1 Accueil > Édition) : volet **Navigation** (onglets Titres / Pages (miniatures) / Résultats, glisser-déposer des titres, clic droit Hausser/Abaisser/Nouveau titre/Supprimer/Tout développer-réduire, recherche d'objets), Rechercher et remplacer avancé (Format…, Spécial… `^p ^t ^&`, surligner tout, phonétique, toutes les formes), **Atteindre** (page, section, ligne, signet, commentaire, notes, champ, tableau, titre…), Sélectionner (objets, même mise en forme), Sélection par mot/phrase/paragraphe (triple-clic).
**Dossier** : `packages/word/src/navigation/` (`NavPane.tsx` déplacé depuis `ui/Panes.tsx`, `find-advanced.ts` étendant `editor/find.ts` sans le modifier, `goto.tsx`). Tests : `tests/find.test.ts` (existant) + `tests/navigation.test.ts`.
**Dépendances** : Lot 0.

---

## Lots P2 (courants)

### Lot 10 : insertions, presse-papiers, liens (M) — P1/P2
**Entrées** (§1 Insertion) : menu Images (appareil, archives, en ligne), Coller (Fusionner la mise en forme, Image, défaut de collage), Presse-papiers Office, galerie Page de garde (16), Lien (e-mail, nouveau document, fichier), Signet (masqués), Renvoi (tous types), Légende (étiquettes personnalisées), QuickPart (blocs de construction, Insertion automatique, Propriété du document), WordArt, Lettrine, Objet, Signature, Capture, Symbole (sous-ensembles, Caractères spéciaux, raccourcis), Date et heure (formats), Équation (éditeur 2D + onglet Équation, entrée LaTeX), Icônes, Modèles 3D (P3).
**Dossier** : `packages/word/src/insert/` ; équations : `packages/word/src/equations/` (éditeur 2D, onglet contextuel).
**Dépendances** : Lot 0 (Lot 3 pour WordArt).

### Lot 11 : références (M) — P2
**Entrées** (§1 Références) : Table des matières personnalisée + 3 modèles + Table manuelle, Ajouter le texte (Ne pas afficher), table des illustrations, mise à jour des tables, boîte Notes (format, position), Note suivante, Citations (gestionnaire de sources, styles bibliographiques CSL, bibliographie), Index (marquer, insérer, mettre à jour, colonnes, table des autorités).
**Dossier** : `packages/word/src/references/` (+ `features/toc.ts` déplacé).
**Dépendances** : Lot 0, Lot 6 (styles de titres).

### Lot 12 : publipostage complet (M) — P2
**Entrées** (§1 Publipostage) : types de document (lettres, e-mails, enveloppes, étiquettes, répertoire), Sélection des destinataires (CSV, XLSX via le Tableur, SQLite via Base de données), Modifier la liste, champs en surbrillance, Bloc d'adresse, Formule d'appel, Règles, Faire correspondre les champs, Premier/Dernier, Rechercher, erreurs, Terminer (documents, impression, e-mails), Enveloppes, Étiquettes, assistant pas à pas.
**Dossier** : `packages/word/src/mailmerge/` (+ `features/merge.ts` déplacé, déjà testé).
**Dépendances** : Lot 0.

### Lot 13 : menus contextuels, mini-barre, barre d'état, règle (M) — P1
**Entrées** (§2, §3, §8) : refonte de `ui/editorMenu.ts` en `contextmenu/` selon les tables §2 (texte, orthographe, lien, tableau, image, forme, note, légende, titre, liste, commentaire, champ, révision, en-tête, règle, barre d'état, onglet du ruban), **mini-barre affichée AVEC le menu contextuel**, Options de collage avec les 4 icônes, Puces/Numérotation en bibliothèques, barre d'état personnalisable (≈25 indicateurs), menu de la règle (Mise en page…, Tabulations…), double-clic sur taquet -> dialogue (Lot 5), Personnaliser le ruban.
**Dossier** : `packages/word/src/contextmenu/` ; la mini-barre (`ui/miniBar.ts`, `MiniToolbar` du paquet ui, en cours d'ajout par une autre session) est reprise ici ; `packages/ui/src/components/MiniToolbar.tsx` et `StatusBar.tsx` sont propres à ce lot.
**Dépendances** : Lot 0 ; chaque entrée de menu appelle une commande des autres lots (menu rempli au fil de leur livraison, entrée grisée en attendant).

### Lot 14 : coque — Backstage, affichage, ruban, aide (M) — P2
**Entrées** (§7, §1 Affichage / Aide, §8) : Backstage : Partager, Historique des versions (local), Imprimer (copies, pages, recto-verso, orientation, taille, marges, aperçu pleine page + zoom), Enregistrer sous (emplacements), Exporter (PDF réel), Informations (inspection du document, versions, accessibilité), Compte, Options en 11 catégories (Affichage, Vérification, Enregistrement, Avancé, Personnaliser le ruban, Barre d'accès rapide…) ; Affichage : dialogue Zoom, Fenêtre (nouvelle, réorganiser, fractionner, côte à côte, défilement synchrone), Mode foncé du document, mouvement de page, Lecteur immersif complet ; onglet Aide ; onglet Développeur optionnel ; personnalisation du ruban et de la barre d'accès rapide.
**Dossier** : `packages/word/src/shell/` + `packages/ui/src/components/Backstage.tsx`, `Ribbon.tsx` (propres à ce lot).
**Dépendances** : Lot 0.

### Lot 15 : accessibilité, voix, dictée (M) — P2
**Entrées** (§1 Révision, §9) : Lecture à voix haute (voix système, surbrillance mot à mot), Dicter, Vérifier l'accessibilité (+ volet), texte de remplacement obligatoire/décoratif, Lecteur immersif (syllabes, espacement), Traduction (P3).
**Dossier** : `packages/word/src/voice/`, `packages/word/src/a11y/`.
**Dépendances** : Lot 0, Lot 8 pour la langue.

---

## Lot 16 : « au-delà d'Office » (P3, au fil de l'eau)

25 idées détaillées en §10 de WORD.md ; à planifier après la parité P1/P2. Chacune est autonome et vit dans son dossier (`packages/word/src/beyond/<idée>/`) : historique local de versions, fusion à trois voies, recherche multi-documents, export EPUB/LaTeX/PDF-A, chiffrement AES, liaison vivante avec le Tableur, grammaire/dictée/traduction hors ligne, scripts sûrs en bac à sable, plan-manuscrit, audit WCAG.

---

## Vérification attendue de chaque lot (exigences du propriétaire)

- `npx tsc -p packages/word/tsconfig.json --noEmit` : 0 erreur ; `node --test packages/word/tests/*.test.ts` : tout vert + tests du lot.
- Règle visuelle : capture du banc `?app=word`, comparée à Word 365, enregistrée dans `docs/captures/texte-<lot>-*.png`.
- Chaque commande livrée enregistre son identifiant UIA Word (Lot 0, `registry/commands.ts`) pour que la colonne « Statut » de WORD.md passe de « À vérifier » à « OK » automatiquement via l'outil de conformité.
- Mettre à jour `packages/word/STATUS.md` (limites connues) au fil des lots ; incrémenter la version.

## Récapitulatif

| Lot | Thème | Effort | Priorité | Dossier propre | Parallèle avec |
|---|---|---|---|---|---|
| 0 | Socle d'intégration | S/M | P1 | `registry/` + éclatements | aucun (seul) |
| 1 | Frappe automatique, typographie FR | L | P1 | `autocorrect/` | 2 à 9 |
| 2 | Raccourcis FR, KeyTips | M | P1 | `keymap/` | 1, 3 à 9 |
| 3 | Objets flottants (formes, zones de texte) | L | P1 | `objects/` + docx | 1, 2, 5 à 9 (attention modèle avec 4) |
| 4 | Tableaux complets | L | P1 | `tables/` | 1, 2, 5 à 9 (attention modèle avec 3) |
| 5 | Police, paragraphe, tabulations, bordures, listes | L | P1 | `format/` | 1 à 4, 6 à 9 |
| 6 | Styles et thèmes | M | P1/P2 | `styles/` | 1 à 5, 7 à 9 |
| 7 | Mise en page, sections, en-têtes/pieds | M | P1 | `pagesetup/` | 1 à 6, 8, 9 |
| 8 | Correcteur, grammaire, révision, protection | L | P1 | `proofing/` | 1 à 7, 9 |
| 9 | Navigation, recherche, atteindre | M | P1 | `navigation/` | 1 à 8 |
| 10 | Insertions, presse-papiers, équations | M | P1/P2 | `insert/`, `equations/` | 11 à 15 |
| 11 | Références | M | P2 | `references/` | 10, 12 à 15 |
| 12 | Publipostage | M | P2 | `mailmerge/` | 10, 11, 13 à 15 |
| 13 | Menus contextuels, mini-barre, barre d'état | M | P1 | `contextmenu/` | 10 à 12, 14, 15 |
| 14 | Coque : Backstage, Affichage, ruban | M | P2 | `shell/` | 10 à 13, 15 |
| 15 | Accessibilité, voix, dictée | M | P2 | `voice/`, `a11y/` | 10 à 14 |
| 16 | Au-delà d'Office | variable | P3 | `beyond/*` | après 1 à 15 |
