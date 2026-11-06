# @forgeoffice/pptx : etat (2026-11-05)

Modele de presentation + lecture/ecriture, pur TypeScript sans DOM. Sert aussi au module Publication (taille de page libre).

## Fait et prouve

| Format | Lecture | Ecriture | Preuve |
|---|---|---|---|
| .pptx / .pptm / .potx / .potm / .ppsx / .ppsm | complete | complete (type de contenu par format, macros VBA conservees) | aller-retour sur le modele complet + 16 fichiers ecrits rouverts sans erreur par PowerPoint 16 (COM) |
| .odp | basique++ : pages, cadres, formes, geometries libres (draw:enhanced-path, draw:path, draw:polygon / polyline), rotation/miroir, images, graphiques (draw:object : barres, courbes, secteurs...), medias (draw:plugin), tableaux fusionnes, liens, notes, transitions, masquees, titre/description | basique : texte mis en forme, formes, chemins libres, images, tableaux (texte), notes (`writeOdp`) | fixtures LibreOffice + export PowerPoint ; fichier ecrit rouvert par PowerPoint (COM : texte, ellipse, tableau, image) |
| .ppt 97-2003 | texte, niveaux de retrait, sauts de ligne, mise en forme des caracteres (gras, italique, souligne, police, taille, couleur, exposant), positions, formes groupees (repere FSPGR : positions identiques a celles de PowerPoint), espaces reserves, images PNG/JPEG/TIFF/DIB/EMF/WMF, notes, taille | non (converti en .pptx) | fixture enregistree par PowerPoint (`tests/fixtures/legacy.ppt`) |

- Modele (`src/model.ts`) : masques, 11 dispositions francaises, theme (12 couleurs, polices majeure/mineure, effets), diapositives (disposition, arriere-plan, formes, notes, transition, animations avec minutage d'origine conserve, masquee, commentaires, sections), formes : predefinie/chemin libre, image (recadrage, effets), tableau (fusions, style), graphique (`ChartModel` generique de `src/chart.ts`), groupe, connecteur, video/audio, SmartArt et objets inconnus conserves avec rendu de repli.
- Heritage des espaces reserves diapositive -> disposition -> masque : `effectiveShape()` (position, remplissage, contour, effets, styles de texte, polices de theme resolues), `placeholderPrompt`, `effectiveBackground`, `effectiveColorMap`, `backgroundShapes`.
- `createBlankDeck(size, { titleSlide, orientation })` : theme Office 2024 (Aptos / Aptos Display + replis), 11 dispositions, tailles 16:9, 4:3, 16:10, A3, A4, A5, Lettre, Legal, Tabloid, carte de visite, banniere, transparent, carre, ou taille libre bornee a 1..56 po (limites OOXML). Polices et positions mises a l'echelle selon la taille.
- Graphiques crees avec l'aspect par defaut d'Office 2024 (quadrillage gris clair, texte gris 9 pt), verifie par rendu PowerPoint.
- Fichiers chiffres par mot de passe (conteneur EncryptedPackage) : `openPresentation(bytes, { password })`, `PresentationPasswordError` (required / wrong) ; dechiffrement dans `@forgeoffice/opc` (`decryptOoxml`, `isEncryptedOoxml`), commun a docx / xlsx / pptx.
- Styles de tableau : `BUILTIN_TABLE_STYLES` (74 GUID + noms francais) releves dans PowerPoint 365 par COM (`Table.ApplyStyle` puis `Table.Style.Id/Name`) ; 2 GUID de memoire etaient faux (clair 1 sans accent, moyen 2 accentuation 2), corriges a la lecture par `normalizeTableStyleId`.
- EMF / WMF : convertis en SVG (`metafileToSvg` dans `@forgeoffice/opc`) ; le media garde ses octets et porte `preview` (SVG) ; `displayMedia(item)` donne le media a afficher.
- SmartArt : noeuds de texte du graphe dgm exposes (`SmartArtShape.nodes`) et modifiables (`setSmartArtNodeText`, texte du rendu de repli mis a jour) ; relu par PowerPoint (COM : `AllNodes`).
- Securite : liens `javascript:` refuses a la lecture, chemins zip et tailles bornes par @forgeoffice/opc, lecture CFB bornee, .ppt binaire chiffre refuse avec message, decompression bornee (bombe).

## Tests

`node --test packages/pptx/tests/*.test.ts` : 38 tests, tous verts (avant : 31). Fichiers reels PowerPoint 365 : `powerpoint-table-styles.txt` (74 styles releves), `powerpoint-smartart.pptx`, `powerpoint97-format.ppt` (auteurs neutralises).
`npx tsc -p tsconfig.json --noEmit` : aucune erreur dans packages/pptx (des erreurs existent dans packages/convert et packages/pdf, hors perimetre).

## Reste a faire

- .odp : animations (`presentation:anim-*`), formules dans les chemins (`?f0`, `$0`), graphiques combines ; ecriture : graphiques, animations, transitions, masques personnalises, SmartArt.
- .ppt : tableaux (lus comme formes groupees de cellules, sans bordures ni fusion), graphiques et objets OLE (MSGraph), animations, mise en forme des paragraphes (alignement, puces, interligne), couleurs de theme exactes.
- Rendu EMF+ pur (sans enregistrements GDI de repli) : non gere ; texte EMF positionne sans largeurs de caracteres (Dx).
- Captures du rendu a deposer dans `docs/captures/` par le lot de l'editeur (hors perimetre de ce paquet).
