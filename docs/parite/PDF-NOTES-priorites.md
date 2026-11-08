# Plan d'implémentation : PDF et Bloc-notes (parité Acrobat/Edge et Bloc-notes/Notepad++/éditeurs modernes)

Date : 2026-11-05. Sources : `docs/parite/PDF.md` (identifiants `PD-xxx`) et `docs/parite/NOTES.md` (identifiants `NT-xxx`). Aucun code modifié par l'audit.

Règles communes : un lot = un ensemble de fichiers disjoint des autres lots ; les fichiers partagés (`commands.ts`, `ribbon.ts`, `strings.ts`, `workspace.ts` pour le Bloc-notes ; `PdfApp.tsx`, `ribbon.tsx`, `strings.ts`, `model.ts` pour le PDF) ne sont touchés que par le lot 0 de chaque module, les autres lots ajoutant des fichiers et une ligne d'enregistrement. Fichier de 800 lignes visées, 1000 maximum. Texte d'interface en français dans `strings`. Tests `node --test packages/<p>/tests/*.test.ts` pour la logique sans DOM. Toute fonction visuelle est vérifiée sur le rendu et avec de vrais gestes (clic droit, glisser). Une nouvelle dépendance (`@codemirror/merge`, moteur TTS, etc.) s'installe sous verrou (`CONVENTIONS.md`). Un statut « Présent à vérifier » ne devient « OK » que par un test ou une capture citée.

## Partie A. PDF (`packages/pdf`) : `docs/parite/PDF.md`

Chiffres : 646 entrées de parité (OK 78, Présent à vérifier 105, Partiel 121, Absent 342 ; recalculé le 2026-11-07) + 20 idées Au-delà. Le lecteur et les annotations de base sont corrects ; l'écart porte sur les menus contextuels (un seul : celui des miniatures), les propriétés d'annotations et de champs, la signature numérique avancée, le caviardage assisté et l'édition de contenu.

Point de conflit : `PdfApp.tsx` (538 lignes) et `ribbon.tsx` sont des goulots. Le lot P0 est à faire d'abord.

| Lot | Contenu | Fichiers (disjoints) | Effort | Prio | Entrées principales |
|---|---|---|---|---|---|
| P0 | **Points d'extension** : sortir de `PdfApp.tsx` et `ribbon.tsx` les raccourcis, menus, impression, `SignaturePad`, `SignaturesPanel` ; champs optionnels dans les `Item` de `model.ts` (image, lien, coche, caviardage coloré) | `PdfApp.tsx`, `ribbon.tsx`, `strings.ts`, `model.ts` | S | P1 | bloque P2 à P8, P10 à P12 |
| P1 | **Preuves** : tests et captures pour faire passer les 105 « Présent à vérifier » à OK | nouveaux `packages/pdf/tests/*`, `docs/captures/` | M | P1 | |
| P2 | **Menus contextuels et actions sur la sélection de texte** (surligner, souligner, barrer, note, commentaire) ; menu par type d'annotation | nouveaux `contextMenus.tsx`, `selection.ts`, `PageView.tsx` | M | P1 | PD-132, PD-187 à PD-191, PD-205 à PD-217, PD-426 |
| P3 | **Annotations** : réponses (`/IRT`, ignorées par `annots.ts`), états, boîte Propriétés, filtre/tri, XFDF, types manquants (ondulé, insertion, polygone, nuage, tampons personnalisés) ; modifier/supprimer les annotations existantes | `annots.ts`, `appearance.ts`, `itemview.tsx`, `SidePanels.tsx`, nouveaux `dialogs-annot.tsx`, `xfdf.ts` | L | P1 | PD-136, PD-137, PD-167, PD-173, PD-175, PD-206, PD-209, PD-247, PD-553 |
| P4 | **Formulaires** : propriétés de champ (Général, Apparence, Options), édition des champs déjà présents (déplacer, renommer, supprimer), détection automatique, champ de signature, import/export, volet Champs de données | `forms.ts`, `apply.ts`, `analyze.ts`, nouveaux `dialogs-field.tsx`, `FieldsPanel.tsx`, `formio.ts` | L | P1 | PD-235, PD-264, PD-272, PD-276 à PD-278, PD-285, PD-286, PD-554 |
| P5 | **Signatures** : mise à jour incrémentale (la signature réécrit tout et invalide les précédentes), signer dans un champ existant, PAdES, horodatage RFC 3161, chaîne de confiance, magasin de certificats du système, signature par image, signatures enregistrées, position choisie | `sign/*`, `dialogs-sign.tsx`, nouveau `dialogs-signpad.tsx` | L | P1 | PD-300, PD-302, PD-312, PD-315, PD-319, PD-320, PD-323, PD-324, PD-332, PD-628 |
| P6 | **Navigation et vue** : Ctrl+molette, Ctrl +/-, Aller à la page, F3, mode lecture, vue précédente | nouveaux `useShortcuts.ts`, `ReadingMode.tsx`, `PageNav.tsx` | S-M | P1 | PD-034, PD-068, PD-577, PD-583, PD-585 |
| P7 | **Caviardage avancé et assainissement** : depuis une sélection, par recherche, par motifs (e-mail, téléphone, IBAN, numéro de sécurité sociale), pages entières, rapport, inspection du document | `redact.ts`, `pdfdoc.ts`, nouveaux `dialogs-redact.tsx`, `sanitize.ts` (dépend de P9) | M | P1 | PD-426 à PD-428, PD-436, PD-A08 |
| P8 | **Pages et fichiers** : Combiner multi-fichiers (aujourd'hui un à la fois), Insérer, Remplacer, Rogner, étiquettes de page, découpage par taille ou signets, filigrane image, en-tête 3 zones, Bates | `packages/convert/src/pdf-ops.ts`, nouveaux `dialogs-pages.tsx`, `pagesTools.ts` | M | P1/P2 | PD-085, PD-351, PD-556, PD-558 |
| P9 | **Moteur natif** : action d'assainissement, réparation de PDF, options OCR (deskew, langues, plage), bilan de compression, PDF/A-1 et 3 | `crates/forge-convert/src/operation.rs`, `pdf/purge.rs`, `pdf/externe.rs`, `pdf/compression.rs`, nouveaux modules `pdf/` | L | P2 | PD-453, PD-102 |
| P10 | **Fichier et sécurité des données** : confirmation avant perte (`S.confirmDiscard` n'est jamais utilisé : perte de données possible), enregistrement automatique et récupération, vraie boîte Imprimer, Enregistrer une copie, Rétablir, onglets de Propriétés | `useDoc.ts`, nouveaux `print.ts`, `docProps.tsx`, `recovery.ts` | M | P1 | PD-008, PD-010, PD-017, PD-555, PD-610 |
| P11 | **Édition de contenu** : ajouter image, lien, texte natif dans la page, paragraphes, extraction d'images | `links.ts`, `extras.ts`, nouveaux `imageTool.ts`, `pdf/contenu.rs` (dépend de P9) | L | P1/P2 | PD-379, PD-385, PD-386, PD-391 |
| P12 | **Export, OCR, accessibilité** : dialogue Exporter (JPEG, DPI, Excel, PowerPoint), lecture à voix haute (pause, vitesse, mot surligné), vérificateur d'accessibilité, texte alternatif | `speech.ts`, nouveaux `dialogs-export.tsx`, `a11y.ts`, `AccessibilityPanel.tsx` (dépend de P9) | M | P1/P2 | PD-464, PD-482, PD-524 |
| P13 | **Au-delà** : IA locale (résumé, questions), tableaux vers Excel, diff visuel, traitement par lots, remplissage depuis un profil chiffré | `ai/*`, `tables.ts` | L | P3 | PD-A01 à PD-A20 |

Constats hors STATUS à corriger au passage : l'infobulle d'« Aplatir » promet de fusionner les annotations alors que seuls les champs le sont ; les permissions de chiffrement ne renseignent pas `contentAccessibility` (`pdf-ops.ts`) ; la recherche dans un gros PDF recopie toute la `Map` de texte à chaque page chargée (`useText.ts`, coût quadratique).

Ordre : P0, puis P1, P9, P2, P6, P10, P5 en parallèle, puis P3, P4, P7, P8, P11, P12, P13.


## Partie B. Bloc-notes (`packages/notes`) : `docs/parite/NOTES.md`

Chiffres : 830 entrées hors Au-delà (OK 99, Présent à vérifier 225, Partiel 126, Absent 380 ; recalculé le 2026-11-07) + 20 idées Au-delà ; Absent P1 = 28, Partiel P1 = 11. Le module est déjà solide (WinNote : 98 sur 101 fonctions) ; l'écart porte sur Notepad++ (menus Ligne/Recherche/Encodage), l'auto-complétion, la sauvegarde automatique, la comparaison et les outils Obsidian.

Point de conflit : `commands.ts`, `ribbon.ts`, `strings.ts`, `workspace.ts` et `editor/extensions.ts` sont touchés par presque tous les lots.

| Lot | Contenu | Fichiers (disjoints) | Effort | Prio | Entrées |
|---|---|---|---|---|---|
| N0 | **Préalable** : découper le registre en `src/commands/<domaine>.ts`, `src/strings/<domaine>.ts`, liste de modules d'extensions CodeMirror | `commands.ts`, `ribbon.ts`, `strings.ts`, `editor/extensions.ts` | S | P1 | bloque N1, N2, N3, N6, N8, N10 |
| N1 | **Édition CodeMirror** : `closeBrackets`, `autocompletion` (mots, identifiants, `[[note]]`), copier/couper la ligne sans sélection, ligne vide dessus/dessous, transposer | nouveau `editor/complete.ts`, `editor/actions.ts` | M | P1 | NT-081, NT-142, NT-146, NT-372, NT-395, NT-399, NT-418, NT-611, NT-692 |
| N2 | **Opérations de texte pures** : supprimer les lignes vides, tris (numérique, casse, colonne, aléatoire), trim, dédoublonnage consécutif, casses supplémentaires | `logic/lines.ts`, nouveau `tests/lines.test.ts` | M | P1 | NT-119, NT-125, NT-126 |
| N3 | **Rechercher/Remplacer** : panneau propre, dans la sélection, mode étendu `\n \t \0 \xHH`, compteur, historique ; Rechercher dans les fichiers avec regex et filtres | nouveau `src/search/*`, `ui/FindPanel.tsx`, `ui/FindInFiles.tsx` | L | P1 | NT-167, NT-206, NT-208, NT-220, NT-806 |
| N4 | **Encodages** : table `logic/codepages.ts` (Windows-125x, ISO-8859-x, KOI8, Shift-JIS, GBK, EUC-KR…), « Rouvrir avec l'encodage » (`decodeFile(bytes, forced)` existe, aucune commande ne l'appelle), détection heuristique, mode hexadécimal | `logic/encoding.ts`, `logic/codepages.ts`, `logic/hex.ts`, `ui/HexView.tsx` | M-L | P1 | NT-295, NT-302, NT-303, NT-313 |
| N5 | **Sauvegarde et historique** : enregistrement automatique, copie `.bak`, historique local de versions (volet Chronologie), signets persistants, export/import de session | `logic/history.ts`, `ui/HistoryPanel.tsx`, `logic/session.ts` (touche `workspace.ts`, sérialiser avec N6) | L | P1 | NT-415, NT-417, NT-474, NT-669, NT-671, NT-A01 |
| N6 | **Onglets et groupes d'éditeurs** : épinglage, couleurs, fermer à gauche et les non modifiés, deux documents côte à côte (la vue scindée montre aujourd'hui deux fois le même onglet) | `workspace.ts` (à scinder en `workspace/*`), `ui/TabStrip.tsx` | L | P1 | NT-239 |
| N7 | **Notes liées Markdown** : aperçu en direct, saut `[[note#titre]]` (analysé mais ignoré par `openNote`), liens non résolus, tags, propriétés YAML, callouts, transclusion, graphe, notes quotidiennes ; renommage avec mise à jour des liens | `logic/links.ts`, `editor/marks.ts`, `ui/Preview.tsx`, nouveau `src/graph/*` (renommage et notes quotidiennes dépendent de N9) | L | P1/P2 | NT-284, NT-687, NT-696, NT-810 |
| N8 | **Affichage** : minimap, repères d'indentation, colonne repère, fil d'Ariane, repli par niveaux, défilement synchronisé | nouveau `editor/view-extras.ts`, `notes.css`, `ui/StatusLine.tsx` | M | P2 | |
| N9 | **Contrat `@forgeoffice/core` et coquille** : `fileInfo`, `revealInFolder`, `setAlwaysOnTop`, `openFolder/listDir/writeFile/rename/trash`, surveillance de fichier, `runCommand`, associations de fichiers | `packages/core`, coquille Tauri `apps/desktop/src-tauri` (hors paquet notes) | M | P1 (débloquant) | NT-554, NT-555, NT-797 |
| N10 | **Préférences, raccourcis, thèmes** : boîte Préférences à pages, table de raccourcis modifiable avec conflits (Ctrl+U masque `undoSelection`, Ctrl+I pris par `selectParentSyntax`), éditeur de styles, import/export | `logic/prefs.ts`, `themes.ts`, `shortcuts.ts`, `ui/PrefsDialog.tsx` | L | P1/P2 | NT-378 |
| N11 | **Comparaison** : `@codemirror/merge` (nouveau paquet à installer sous verrou), côte à côte, différences au caractère, comparer au disque | `logic/diff.ts`, `ui/CompareView.tsx` | L | P1 | NT-458, NT-459, NT-638 |
| N12 | **Outils, macros, exécution** : enregistreur de macros, empreintes MD5/SHA, Base64/URL, JSON/XML, pipelines de texte | nouveau `src/tools/*`, `src/macros.ts` | M-L | P2 | |
| N13 | **Langages** : Ada, AutoIt, Registre, NASM, détection par shebang, langage défini par l'utilisateur | `editor/languages.ts`, `modes.ts` | S-M | P3 | |
| N14 | **Idées « Au-delà »** (IA locale, synchronisation chiffrée, collaboration, exécution de blocs de code, publication par lots) | sous-modules indépendants | L chacun | P3 | NT-A01 à NT-A20 |

Ordre : N0 puis, en parallèle, N1, N2, N4, N8, N9, N13 (disjoints) ; ensuite N3, N6, N10, N11 ; N5 et N7 après N6 et N9.
Écarts à noter par rapport à `INVENTAIRE-WINNOTE.md` : signets non persistants hors session, vue scindée limitée à l'onglet actif, dossier lu en mémoire sans écriture en place, saut vers un titre non implémenté.
