# @forgeoffice/pptx : etat (2026-11-04)

Modele de presentation + lecture/ecriture, pur TypeScript sans DOM. Sert aussi au module Publication (taille de page libre).

## Fait et prouve

| Format | Lecture | Ecriture | Preuve |
|---|---|---|---|
| .pptx / .pptm / .potx / .potm / .ppsx / .ppsm | complete | complete (type de contenu par format, macros VBA conservees) | aller-retour sur le modele complet + 16 fichiers ecrits rouverts sans erreur par PowerPoint 16 (COM) |
| .odp | basique+ : pages, cadres, formes, rotation/miroir, images, tableaux fusionnes, liens, notes, transitions, masquees, titre/description | non (converti en .pptx) | fixtures LibreOffice + export PowerPoint |
| .ppt 97-2003 | texte, niveaux de retrait, sauts de ligne, positions, espaces reserves, images PNG/JPEG, notes, taille | non (converti en .pptx) | fixture enregistree par PowerPoint (`tests/fixtures/legacy.ppt`) |

- Modele (`src/model.ts`) : masques, 11 dispositions francaises, theme (12 couleurs, polices majeure/mineure, effets), diapositives (disposition, arriere-plan, formes, notes, transition, animations avec minutage d'origine conserve, masquee, commentaires, sections), formes : predefinie/chemin libre, image (recadrage, effets), tableau (fusions, style), graphique (`ChartModel` generique de `src/chart.ts`), groupe, connecteur, video/audio, SmartArt et objets inconnus conserves avec rendu de repli.
- Heritage des espaces reserves diapositive -> disposition -> masque : `effectiveShape()` (position, remplissage, contour, effets, styles de texte, polices de theme resolues), `placeholderPrompt`, `effectiveBackground`, `effectiveColorMap`, `backgroundShapes`.
- `createBlankDeck(size, { titleSlide, orientation })` : theme Office 2024 (Aptos / Aptos Display + replis), 11 dispositions, tailles 16:9, 4:3, 16:10, A3, A4, A5, Lettre, Legal, Tabloid, carte de visite, banniere, transparent, carre, ou taille libre bornee a 1..56 po (limites OOXML). Polices et positions mises a l'echelle selon la taille.
- Graphiques crees avec l'aspect par defaut d'Office 2024 (quadrillage gris clair, texte gris 9 pt), verifie par rendu PowerPoint.
- Securite : liens `javascript:` refuses a la lecture, chemins zip et tailles bornes par @forgeoffice/opc, lecture CFB bornee, fichiers chiffres refuses avec message.

## Tests

`node --test packages/pptx/tests/*.test.ts` : 31 tests, 212 assertions ecrites (plus en boucle), tous verts.
`npx tsc -p tsconfig.json --noEmit` : aucune erreur dans packages/pptx.

## Reste a faire

- .odp : graphiques (draw:object), medias (draw:plugin), animations, geometries « non-primitive » (lues comme rectangle), ecriture .odp.
- .ppt : mise en forme des caracteres (police, taille, couleur), tableaux, graphiques, coordonnees des formes groupees (lues dans le repere du groupe), animations.
- .pptx chiffre (mot de passe) : refuse, pas de dechiffrement.
- Captures du rendu a deposer dans `docs/captures/` par le lot de l'editeur (hors perimetre de ce paquet).
