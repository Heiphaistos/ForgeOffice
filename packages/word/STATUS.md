# packages/word (Texte) : état (2026-11-04)

Application Texte de ForgeOffice (équivalent Word 2024), éditeur ProseMirror sur le modèle `@forgeoffice/docx`.
Point d'entrée : `src/index.ts` exporte `{ info: MODULES.word, App }`.

## Vérifié

- `npx tsc -p packages/word/tsconfig.json --noEmit` : 0 erreur.
- `node --test packages/word/tests/*.test.ts` : 29 tests, 29 réussis (conversion modèle <-> ProseMirror sans perte, fusions de
  cellules, pagination calculée (coupure de ligne, veuves/orphelines, solidaire du suivant, lignes solidaires, sauts manuels,
  rangées de tableau), rechercher/remplacer (casse, mot entier, accents, regex, $1), commandes, CSS des styles, listes,
  statistiques avancées, publipostage CSV, comparaison, suivi des modifications, table des matières, modèles, export .docx).
- Fichiers ouverts dans Word 365 par COM sans réparation : un .docx produit uniquement par les commandes de l'éditeur
  (titre, gras, liste, note, tableau, saut de page, modification suivie, table des matières) et le .docx de test riche.
- Rendu regardé dans Chromium (banc `?app=word`, port 5311), captures `docs/captures/texte-*.png` : document ouvert, pagination,
  tous les onglets, Backstage (Accueil, Informations, Imprimer), dialogues, tableau et image (onglets contextuels), modes
  Lecture/Plan/Plusieurs pages/Focus, colonnes en paysage, filigrane + numéros de ligne, en-tête modifié, suivi des modifications,
  commentaires, galerie avec aperçu au survol, enregistrer -> rouvrir, récupération après plantage, thème sombre.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/editor/` | schéma (une marque par propriété de caractère, atomes qui gardent les éléments non édités), conversion, CSS des styles, commandes, raccourcis, greffons (pagination, listes, commentaires, recherche, aperçu), suivi des modifications, recherche |
| `src/layout/` | pagination calculée pure (`paginate.ts`) + mesure DOM des blocs et lignes (`measure.ts`) |
| `src/features/` | logique sans DOM : listes, statistiques, publipostage, comparaison, table des matières, modèles, conception |
| `src/ribbon/` | onglets du ruban (Accueil, Insertion, Dessin, Conception, Mise en page, Références, Publipostage, Révision, Affichage, contextuels) |
| `src/ui/`, `src/dialogs/` | surface de pages, règle, volets, Backstage, boîtes de dialogue |
| `src/app/` | contrat ruban/application, actions (fichiers, insertions...), état de la sélection |

## Lot « résidus 1 » (2026-11-05)

Fait, avec test `node:test` (logique) et vérification visuelle (captures `docs/captures/residus1-*.png`) :

- Géométrie de page PAR SECTION : `features/sections.ts` (découpage, numérotation par section, héritage des en-têtes/pieds), `layout/paginate.ts`
  (géométrie par page, page blanche pour les sauts « pages paires / impaires »), `layout/flow.ts`, `editor/layout-deco.ts` (marges gauche/droite
  par section par variables CSS `--fo-sl/--fo-sr`, les retraits restent corrects). Portrait + paysage + A5 dans le même document vérifiés, ouvert dans
  Word 365 par COM masqué : 3 sections, tailles et marges identiques, 3 pages, 2 notes + 1 note de fin, image flottante carrée.
  Saisie : Mise en page > Sauts (section au curseur, la section reçoit sa propre géométrie), « Appliquer à : cette section / tout le document » dans la
  boîte Mise en page ; orientation, taille, marges, colonnes du ruban = section du curseur.
- Taquets de tabulation personnalisés rendus dans le corps (`layout/tabs.ts`, `features/tabstops.ts`) : gauche, centré, droit, décimal, points de suite.
- Notes de bas de page : zone de texte réduite (pagination juste), notes en bas de page ; notes de fin à la fin du document.
- Images : poignées (8 + rotation), menu d'habillage (aligné, carré, rapproché, haut et bas, devant, derrière), déplacement (poignée ✥, repères
  gauche/centre/droite), flèches = 1 pt, Ctrl+flèches = 10 pt (images flottantes). Correction : `updateAtom` levait une exception (sélection d'un ancien document).
- Dessin : « Insérer » s'active dès le premier contact (doigt, stylet, souris), coordonnées corrigées quand le canevas est réduit.
- Correcteur : menu contextuel avec suggestions (mots du document), « Ignorer ce mot » (noProof), langue par paragraphe (`lang`, `spellcheck=false`),
  « Corrections du navigateur… » (ouvre le menu natif au clic droit suivant : le navigateur ne donne pas ses suggestions à la page).
- 332 pages de lorem ipsum : plus longue tâche de 195 ms à l'ouverture (mode développement), défilement sans tâche longue ; seules les feuilles
  proches de l'écran sont dessinées (`VIRTUAL_MIN` = 40 pages), position de ligne recherchée à la demande (dichotomie, plus de `posAtCoords`).
- Retours du propriétaire : curseur dessiné 2 px (réglable 1/2/3 px, couleur auto/accent/noir/blanc, clignotement) dans Fichier > Options > Curseur ;
  menus contextuels par contexte (`ui/editorMenu.ts` : texte, lien, image, tableau, liste, champ, révision, commentaire, note, en-tête/pied) ;
  mini-barre flottante (`MiniToolbar` + `useSelectionMiniToolbar` dans `packages/ui`, `ui/miniBar.ts` réutilise les contrôles du ruban).

## Limites connues (reste à faire)

- Colonnes : une seule géométrie quand une section a plusieurs colonnes (pagination native CSS `column-wrap`) ; colonnes de largeurs inégales
  affichées égales (CSS ne sait pas faire autrement dans un flux unique) ; elles restent enregistrées dans le fichier.
- Filigrane et couleur de page : stockés en propriétés personnalisées tant que `@forgeoffice/docx` ne les écrit pas en dur (à revérifier à l'intégration).
- Formes, zones de texte, pièces jointes : pas de poignées ni de déplacement (seulement les images) ; « Rogner », « Bordure », « Effets » de l'image absents.
- Dessin : l'encre est insérée comme image PNG (pas d'objet encre Word).
- Correcteur : pas de dictionnaire embarqué (suggestions limitées aux mots du document), grammaire absente.
- Publipostage et Comparer demandent un fichier : vérifiés par les tests, non pilotés dans le banc (dialogue système).
- Plusieurs pages et aperçu avant impression : vignettes en lecture seule.
- Non vérifié : liste des commandes d'un clic droit comparée à celle de Word 365 par UI Automation.
