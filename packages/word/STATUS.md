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

## Limites connues (reste à faire)

- Pagination : une seule géométrie de page (dernière section) pour tout le document ; espacement avant non supprimé en haut de page ;
  la dernière ligne avant une coupure dans un paragraphe justifié n'est pas justifiée.
- Colonnes en mode Page : pagination native CSS `column-wrap` (WebView2/Chromium récents) ; ailleurs colonnes équilibrées sans pages.
- Notes de bas de page affichées dans la marge basse (la zone de texte n'est pas réduite) ; notes de fin seulement dans le volet Notes.
- Taquets de tabulation personnalisés non rendus dans le corps (tabulation par défaut), sauf en-têtes/pieds (gauche/centre/droite)
  et table des matières (points de suite).
- Images flottantes : habillage carré approximé (flottement CSS), pas de positionnement absolu ni de poignées de redimensionnement
  (taille dans l'onglet Format de l'image).
- Filigrane et couleur de page stockés en propriétés personnalisées (non visibles dans Word).
- Dessin : l'encre est insérée comme image PNG (pas d'objet encre Word).
- Correcteur : celui du système (attribut `spellcheck`), sans grammaire propre.
- Publipostage et Comparer demandent un fichier : vérifiés par les tests, non pilotés dans le banc (dialogue système).
- Plusieurs pages et aperçu avant impression : vignettes en lecture seule (clic = retour à la page).
