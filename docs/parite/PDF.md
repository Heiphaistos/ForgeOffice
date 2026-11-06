# Audit de parité du module PDF de ForgeOffice : Adobe Acrobat et Microsoft Edge

Date : 2026-11-05

Périmètre : paquet `packages/pdf` (pdf.js + `@cantoo/pdf-lib`, React), moteur TypeScript partagé `packages/convert/src/pdf-ops.ts` (et `pdf-batch.ts`), moteur natif `crates/forge-convert/src/pdf` (lopdf, Ghostscript et ocrmypdf en externe), composants communs de `packages/ui` utilisés par le module (ruban, barre d'état, boîtes de dialogue). Références : Acrobat (Pro/Reader, interface française : barre d'outils, volet Outils, panneaux, menus, préférences) et lecteur PDF de Microsoft Edge.

## Méthode

- Lecture complète du code : ribbon.tsx, PdfApp.tsx, model.ts, PageView.tsx, Sidebar.tsx, SidePanels.tsx, annots.ts, forms.ts, appearance.ts, apply.ts, dialogs.tsx, dialogs-sign.tsx, dialogActions.ts, extras.ts, useExtras.ts, useDoc.ts, useText.ts, pdfdoc.ts, sign/*, redact.ts, analyze.ts, outlines.ts, links.ts, speech.ts, find.ts, itemview.tsx, strings.ts, `packages/convert/src/pdf-ops.ts`, `pdf-batch.ts`, `crates/forge-convert/src/pdf/*` et `operation.rs`. Aucun code modifié, aucune application lancée.
- Un statut n'est donné que si le code a été vu. Les absences ont été confirmées par `grep` (par exemple : aucun `onContextMenu` hors miniatures, aucun écouteur `wheel`, aucune occurrence de `StructTreeRoot`, `fetch(` ou `confirmDiscard` utilisé).
- `packages/pdf/STATUS.md` est périmé. Écarts constatés : le dossier `sign/` (signatures numériques PKCS#12 / CMS, RSA et ECDSA, vérification) n'y figure pas ; `speech.ts` (lecture à voix haute), `analyze.ts`, `extras.ts` (liens, pièces jointes, calques), `outlines.ts` (signets modifiables) et le volet Signatures non plus ; la ligne « annotations existantes affichées, pas modifiables » est fausse (annots.ts les relit et useDoc.ts les modifie ou supprime) ; la ligne « outils d'édition désactivés tant que l'affichage n'est pas droit » est fausse (la rotation de la vue est gérée par `fromScreenPoint` dans PageView.tsx).
- Preuves acceptées pour le statut OK : test automatisé (`packages/pdf/tests`, `packages/convert/tests`, `crates/forge-convert/tests`) ou parcours cité dans STATUS.md (ouverture, miniatures, recherche « atelier », surlignage, rectangle, note, crayon, ellipse + zone de texte puis Ctrl+S, rotation de page, saisie d'un champ, marquage de caviardage, signature dessinée).

## Légende

- Colonnes de chaque ligne : ID, Type, Fonction (référence), Statut, Prio, Preuve / remarque. La fonction commence par la source entre crochets : `[Acrobat]` ou `[Edge]`.
- Statut : **OK** = effet prouvé (test automatisé ou parcours cité dans STATUS.md) ; **Présent à vérifier** = code lu et présent, effet non prouvé ; **Partiel** = une partie seulement de la fonction existe ; **Absent** = rien dans le code (la remarque dit quoi écrire et avec quelle brique : pdf.js, `@cantoo/pdf-lib` ou moteur natif).
- Prio : **P1** = attendu au quotidien, manque visible ; **P2** = utile ; **P3** = confort ou cas rare. Une priorité est donnée aussi pour les lignes OK.
- Types : Ruban/Outil, Menu contextuel, Annotation, Formulaire, Signature, Page/Organisation, Édition, Protection, Recherche/Lecture, Accessibilité, OCR/Conversion, Dialogue, Raccourci, Réglage, Intégration, Au-delà.
- Chemins relatifs à `D:\Projet\ForgeOffice`. Quand un nom de fichier est donné sans dossier dans une ligne de la section du module, il s'agit de `packages/pdf/src/` (par exemple `PageView.tsx`) ; `pdf-ops.ts` est `packages/convert/src/pdf-ops.ts` ; `dialogs.tsx` est `packages/pdf/src/dialogs.tsx`.
- Les identifiants numériques PD sont continus (001, 002, ...) jusqu'à la fin de la section 16 ; la section finale AU-DELÀ D'OFFICE porte PD-A01 à PD-A20.

## Récapitulatif par type (nombres calculés par awk sur les lignes d'entrée de ce fichier)

| Type | OK | Présent à vérifier | Partiel | Absent | Total |
|---|---|---|---|---|---|
| Ruban/Outil | 5 | 15 | 30 | 51 | 101 |
| Menu contextuel | 0 | 4 | 14 | 44 | 62 |
| Annotation | 10 | 8 | 15 | 36 | 69 |
| Formulaire | 6 | 6 | 7 | 32 | 51 |
| Signature | 7 | 9 | 5 | 25 | 46 |
| Page/Organisation | 6 | 4 | 3 | 14 | 27 |
| Édition | 6 | 3 | 10 | 23 | 42 |
| Protection | 7 | 6 | 3 | 16 | 32 |
| Recherche/Lecture | 10 | 9 | 8 | 16 | 43 |
| Accessibilité | 0 | 1 | 3 | 17 | 21 |
| OCR/Conversion | 0 | 4 | 11 | 12 | 27 |
| Dialogue | 1 | 15 | 3 | 20 | 39 |
| Raccourci | 1 | 11 | 3 | 24 | 39 |
| Réglage | 0 | 6 | 2 | 19 | 27 |
| Intégration | 0 | 4 | 1 | 15 | 20 |
| Au-delà | 0 | 0 | 3 | 17 | 20 |
| **Total hors Au-delà** | 59 | 105 | 118 | 364 | 646 |
| **Total général** | 59 | 105 | 121 | 381 | 666 |

Taux global hors Au-delà (646 fonctions de parité) : OK 9.1 %, Présent à vérifier 16.3 %, Partiel 18.3 %, Absent 56.3 %. Les 20 idées Au-delà d'Office sont comptées à part.

## Constats transverses à traiter en priorité

- Perte de données : `S.confirmDiscard` existe dans strings.ts mais n'est jamais utilisé ; ouvrir un autre PDF (Ctrl+O, glisser-déposer) ou fermer remplace le document sans demander si des modifications ne sont pas enregistrées. L'historique est en mémoire, sans enregistrement automatique ni récupération.
- Menus contextuels : seul le menu des miniatures existe. Aucun menu sur le texte sélectionné, la page, les annotations, les signets, les champs, les liens, les images, les signatures ni les commentaires.
- Texte sélectionné : impossible de le surligner, souligner, barrer, commenter, caviarder ou chercher depuis la sélection ; les marques exigent l'outil actif puis un glisser.
- Commentaires : pas de réponses, d'états, de filtres ni de tri ; les annotations avec `/IRT` sont ignorées à la relecture (annots.ts).
- Formulaires : les champs créés n'ont ni nom modifiable, ni propriétés, ni éléments de liste modifiables ; les champs existants ne se déplacent pas ; bouton, date, signature, code-barres non créables ; JavaScript jamais exécuté (choix de sécurité), donc ni format ni calcul.
- Signatures : réécriture complète du fichier (pas de mise à jour incrémentale) donc les signatures précédentes sont invalidées ; pas d'horodatage RFC 3161, de PAdES, de LTV, de certification, de chaîne de confiance, de magasin Windows ; position de la signature visible figée.
- Infobulle de l'action Aplatir : annonce la fusion des annotations, mais seul `form.flatten()` s'exécute (champs seulement).
- Outils natifs (compresser, PDF/A, OCR, Word, caviardage et correction de texte réels) : indisponibles ou dégradés dans le navigateur ; le STATUS.md rappelle que la coquille Tauri n'a jamais été lancée pour les valider.

## Sections
## 1. Barre de menus, Fichier, Édition, Affichage, Fenêtre, Aide, barre d'outils (Acrobat) et barre du lecteur (Edge)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-001 | Ruban/Outil | [Acrobat] Fichier > Ouvrir (Ctrl+O) : sélecteur PDF, glisser-déposer, mot de passe demandé à l'ouverture | OK | P1 | packages/pdf/src/PdfApp.tsx pickPdf + onDrop ; packages/pdf/src/useDoc.ts load (PasswordException -> dialogue mot de passe) ; Preuve OK : parcours du STATUS.md (ouverture d'un vrai PDF au banc navigateur) |
| PD-002 | Ruban/Outil | [Acrobat] Fichier > Ouvrir récent (liste des derniers fichiers dans le module) | Partiel | P2 | packages/pdf/src/useDoc.ts start appelle services.addRecent ; PdfApp.tsx backstagePages.open ouvre directement le sélecteur : la liste n'est pas affichée dans le module. Brancher services.recentFiles() dans une page backstage |
| PD-003 | Ruban/Outil | [Acrobat] Fichier > Enregistrer (Ctrl+S) : écrit annotations, champs et valeurs dans le fichier | OK | P1 | packages/pdf/src/useDoc.ts save + flush ; packages/pdf/src/apply.ts applyItems ; relecture pdf.js prouvée par packages/pdf/tests/pdf.test.ts ; Preuve OK : parcours du STATUS.md (Ctrl+S, annotations relues par pdf.js) et packages/pdf/tests/pdf.test.ts |
| PD-004 | Ruban/Outil | [Acrobat] Fichier > Enregistrer sous (Ctrl+Maj+S) | Présent à vérifier | P1 | packages/pdf/src/useDoc.ts save(true) ; BACKSTAGE_PAGES.saveAs dans PdfApp.tsx |
| PD-005 | Ruban/Outil | [Edge] Enregistrer / Enregistrer sous avec les dessins, surlignages et textes ajoutés | OK | P1 | packages/pdf/src/apply.ts applyItems + packages/pdf/src/appearance.ts writeItem (annotations réelles avec apparence /AP) ; Preuve OK : packages/pdf/tests/pdf.test.ts (annotations réelles avec apparence) et parcours du STATUS.md |
| PD-006 | Ruban/Outil | [Acrobat] Fichier > Enregistrer une copie sans changer le document ouvert | Absent | P3 | save(true) renomme le document courant (useDoc.ts). Réutiliser saveBytes de PdfApp.tsx sans setInfo |
| PD-007 | Ruban/Outil | [Acrobat] Fichier > Rétablir (revenir à la dernière version enregistrée) | Partiel | P3 | packages/pdf/src/SidePanels.tsx HistoryPanel (onUndoTo) revient à une étape quelconque ; pas de commande directe vers savedLog (useDoc.ts). Ajouter undoTo(savedLog.current) |
| PD-008 | Ruban/Outil | [Acrobat] Fichier > Imprimer (Ctrl+P) : plage, copies, échelle, recto verso, brochure, commentaires inclus | Partiel | P1 | packages/pdf/src/PdfApp.tsx print : iframe + contentWindow.print() sur les octets enregistrés (annotations incluses) ; aucun dialogue propre, tout dépend du dialogue système. Voir BACKSTAGE_PAGES.print |
| PD-009 | Dialogue | [Edge] Imprimer avec aperçu (pages, copies, mise à l'échelle, couleur, recto verso) | Partiel | P2 | packages/pdf/src/PdfApp.tsx print : délégué à la boîte d'impression de la webview, pas d'aperçu propre. Ajouter un dialogue qui choisit les pages puis imprime le résultat de pdfOps.extract |
| PD-010 | Dialogue | [Acrobat] Fichier > Propriétés (Ctrl+D), onglet Description : titre, auteur, sujet, mots-clés, application | Partiel | P1 | packages/pdf/src/dialogs.tsx case 'metadata' + packages/convert/src/pdf-ops.ts readMetadata/writeMetadata ; manquent dates, version PDF, taille de page, balisé, vue web rapide |
| PD-011 | Dialogue | [Acrobat] Propriétés, informations : dates de création et modification, version PDF, taille du fichier, nombre et taille des pages | Partiel | P2 | packages/pdf/src/PdfApp.tsx backstagePages.info (nom, pages, Ko) ; ajouter getCreationDate/getModificationDate (pdf-lib), en-tête %PDF-x.y, geomOf par page |
| PD-012 | Dialogue | [Acrobat] Propriétés, onglet Sécurité : méthode de chiffrement, restrictions résumées | Absent | P2 | Seul l'indicateur Protégé de la barre d'état (PdfApp.tsx StatusBar locked). Lire /Encrypt /P /V /R via pdf-lib ou Operation::Infos natif et afficher le tableau des permissions |
| PD-013 | Dialogue | [Acrobat] Propriétés, onglet Polices : polices utilisées et incorporation | Absent | P3 | Parcourir /Resources /Font (pdf-lib) ou page.commonObjs (pdf.js) et lister BaseFont, sous-ensemble, incorporée |
| PD-014 | Dialogue | [Acrobat] Propriétés, onglet Vue initiale : mise en page, zoom, page d'ouverture, volets, plein écran | Absent | P3 | Écrire /PageLayout /PageMode /OpenAction /ViewerPreferences dans le catalogue (pdf-lib) ; relire pour initialiser zoom/mode dans PdfApp.tsx |
| PD-015 | Dialogue | [Acrobat] Propriétés, onglet Personnalisé : propriétés personnalisées du dictionnaire Info | Absent | P3 | pdf-lib doc.getInfoDict().set(PDFName.of(cle), PDFHexString) ; ajouter une table clé/valeur au dialogue metadata |
| PD-016 | Dialogue | [Acrobat] Propriétés, onglet Avancé : langue, URL de base, options de lecture, préréglages d'impression | Absent | P3 | /Lang du catalogue, /ViewerPreferences (PrintScaling, Duplex, NumCopies) via pdf-lib ; dialogue dédié |
| PD-017 | Ruban/Outil | [Acrobat] Fichier > Fermer (Ctrl+W) avec avertissement si modifications non enregistrées | Partiel | P1 | packages/pdf/src/PdfApp.tsx BACKSTAGE_PAGES.close -> services.close() ; S.confirmDiscard est défini (strings.ts) mais jamais utilisé (grep) : Ouvrir remplace le document sans confirmation ; Ctrl+W non lié. Brancher useConfirmDiscard de @forgeoffice/ui |
| PD-018 | Ruban/Outil | [Acrobat] Fichier > Créer > PDF vierge (nouveau document) | Absent | P2 | MODULES.pdf.blankLabel est vide (packages/core) : pas de Nouveau. Créer PDFDocument.create()+addPage (pdf-lib) puis useDoc.start |
| PD-019 | Ruban/Outil | [Acrobat] Fichier > Joindre à un message électronique | Absent | P2 | Aucun service de messagerie dans Services (packages/core/src/types.ts). Natif Tauri : enregistrer en temporaire puis ouvrir le client par défaut (MAPI Windows, mailto avec chemin) |
| PD-020 | Ruban/Outil | [Acrobat] Fichier > Partager / Inviter à relire (lien partagé) | Absent | P3 | Nécessite un service d'hébergement (hors périmètre) ; alternative locale : exporter un dossier de revue (Intégration) |
| PD-021 | Ruban/Outil | [Acrobat] Édition > Annuler / Rétablir (historique 100 niveaux) | Présent à vérifier | P1 | packages/pdf/src/useDoc.ts undo/redo + History limit 100 ; boutons de la barre d'accès rapide (PdfApp.tsx quickAccess) |
| PD-022 | Ruban/Outil | [Acrobat] Édition > Couper / Copier / Coller les annotations ou éléments sélectionnés | Absent | P2 | Aucun presse-papiers d'éléments : le keydown de PdfApp.tsx ne gère ni Ctrl+X/C/V. Mémoriser un Item dans un état et le recoller avec nouvel id (newId) et décalage |
| PD-023 | Ruban/Outil | [Acrobat] Édition > Copier le texte sélectionné (Ctrl+C) | Présent à vérifier | P1 | packages/pdf/src/PageView.tsx TextLayer pdf.js en mode Sélection (copie par le navigateur) |
| PD-024 | Ruban/Outil | [Acrobat] Édition > Sélectionner tout (Ctrl+A) et Désélectionner tout (Ctrl+Maj+A) | Absent | P2 | Texte réparti par page (.pdf-text) : intercepter Ctrl+A et sélectionner la plage DOM du document (Range) ; Désélectionner = selectedId null |
| PD-025 | Ruban/Outil | [Acrobat] Édition > Supprimer (touche Suppr) l'annotation sélectionnée | Présent à vérifier | P1 | packages/pdf/src/PdfApp.tsx keydown Delete/Backspace -> d.removeItems ; barre flottante dans PageView.tsx (floatbar) |
| PD-026 | Ruban/Outil | [Acrobat] Édition > Copier le fichier dans le presse-papiers | Absent | P3 | navigator.clipboard.write avec le Blob application/pdf (octets de useDoc state.bytes) |
| PD-027 | Ruban/Outil | [Acrobat] Édition > Prendre un instantané (copie d'une zone en image) | Absent | P2 | Outil 'snapshot' : glisser une zone, dessiner le canevas (renderPage de pdfdoc.ts) sur un canvas rogné, navigator.clipboard.write(ClipboardItem png) |
| PD-028 | Ruban/Outil | [Acrobat] Édition > Vérifier l'orthographe dans les commentaires et champs | Absent | P3 | Les textarea de notes/champs (itemview.tsx) n'ont pas d'attribut spellcheck/lang ; ajouter spellcheck lang=fr |
| PD-029 | Ruban/Outil | [Acrobat] Édition > Rechercher (Ctrl+F) | Présent à vérifier | P1 | packages/pdf/src/PdfApp.tsx keydown Ctrl+F -> setPanel('search') ; SidePanels.tsx SearchPanel ; find.ts search |
| PD-030 | Ruban/Outil | [Acrobat] Édition > Recherche avancée (Ctrl+Maj+F) : plusieurs PDF, dossier, index, propriétés | Absent | P3 | Un seul document (useText.ts). Boucle openPdf sur une liste de fichiers (Services.openFile) puis search() par fichier ; index = Au-delà |
| PD-031 | Ruban/Outil | [Acrobat] Édition > Gérer les outils / personnaliser la barre d'outils rapide | Partiel | P3 | packages/pdf/src/PdfApp.tsx quickAccess (Enregistrer, Annuler, Rétablir, Imprimer) personnalisable par la barre de titre commune ; aucun outil PDF épinglable |
| PD-032 | Ruban/Outil | [Acrobat] Affichage > Page suivante / précédente | Présent à vérifier | P1 | ribbon.tsx boutons prev/next ; PdfApp.tsx goTo, touches PageUp/PageDown |
| PD-033 | Ruban/Outil | [Acrobat] Affichage > Première page / dernière page (Home/End, Ctrl+Maj+PgPréc) | Absent | P2 | goTo(0) / goTo(pageCount-1) existent dans PdfApp.tsx ; ajouter boutons et touches Début/Fin |
| PD-034 | Ruban/Outil | [Acrobat] Affichage > Aller à la page (Ctrl+Maj+N) : champ numéro de page éditable | Absent | P1 | Le libellé Page X sur N de la barre d'état n'a pas d'onClick (PdfApp.tsx StatusBar left). Ajouter un champ numérique qui appelle goTo |
| PD-035 | Ruban/Outil | [Acrobat] Affichage > Vue précédente / suivante (Alt+Gauche / Alt+Droite) | Absent | P2 | Garder une pile des positions dans goTo (PdfApp.tsx) et la dépiler sur Alt+flèche |
| PD-036 | Ruban/Outil | [Acrobat] Affichage > Zoom avant / arrière, curseur de zoom, boîte de dialogue Zoom | Présent à vérifier | P1 | ribbon.tsx zoom-in/zoom-out ; StatusBar (packages/ui logic/zoom.ts ZOOM_MIN 10 à ZOOM_MAX 500) ; persistance usePersistentState 'pdf.zoom' |
| PD-037 | Ruban/Outil | [Acrobat] Affichage > Zoom > Taille réelle (100 %, Ctrl+1) | Partiel | P2 | Atteignable via ZoomDialog/ZOOM_PRESETS de la barre d'état ; pas de bouton de ruban ni de raccourci |
| PD-038 | Ruban/Outil | [Acrobat] Affichage > Zoom > Ajuster à la largeur / Page entière (Ctrl+2 / Ctrl+0) | Présent à vérifier | P1 | ribbon.tsx fit-width/fit-page ; PdfApp.tsx fitValue (tient compte des deux pages et de la rotation) |
| PD-039 | Ruban/Outil | [Acrobat] Affichage > Zoom > Ajuster à la zone visible (Ctrl+3) | Absent | P3 | Calcul min(largeur, hauteur) sans marge : variante de fitValue('page') dans PdfApp.tsx |
| PD-040 | Ruban/Outil | [Acrobat] Affichage > Zoom dynamique, Loupe, Panoramique et zoom | Absent | P3 | Aucun outil correspondant (type Tool de model.ts). Loupe = canevas surdimensionné suivant le pointeur |
| PD-041 | Ruban/Outil | [Acrobat] Outil Zoom (zoom sur un rectangle, touche Z) | Absent | P2 | Ajouter Tool 'zoom' (model.ts) : le rectangle glissé donne le zoom via fitValue et goTo(rect) |
| PD-042 | Ruban/Outil | [Acrobat] Affichage > Rotation de la vue horaire / antihoraire | Présent à vérifier | P1 | ribbon.tsx rot-left/rot-right ; PdfApp.tsx viewRotation ; PageView.tsx overlayStyle. La mention du STATUS.md (outils désactivés vue tournée) est périmée : l'édition fonctionne via fromScreenPoint |
| PD-043 | Ruban/Outil | [Acrobat] Affichage de la page > Une page / Défilement continu | Présent à vérifier | P1 | ribbon.tsx mode-single/mode-continuous ; barre d'état views ; usePersistentState 'pdf.pageMode' |
| PD-044 | Ruban/Outil | [Acrobat] Affichage de la page > Deux pages / Défilement à deux pages | Présent à vérifier | P1 | ribbon.tsx two-pages ; PdfApp.tsx spreadStart, classe is-double |
| PD-045 | Ruban/Outil | [Acrobat] Affichage de la page > Afficher la page de couverture en vue à deux pages | Absent | P3 | spreadStart = current - (current % 2) : paires 1-2, 3-4 sans couverture. Option de décalage d'une page |
| PD-046 | Ruban/Outil | [Acrobat] Affichage > Mode lecture (Ctrl+H) : masque barres et volets | Absent | P2 | S.views.read défini dans strings.ts mais inutilisé ; masquer Ribbon, Sidebar, StatusBar avec un état readingMode |
| PD-047 | Ruban/Outil | [Acrobat] Affichage > Plein écran (Ctrl+L) | Partiel | P2 | ribbon.tsx full -> viewerRef.requestFullscreen (PdfApp.tsx) ; pas de Ctrl+L, de transitions ni de masquage des barres au sens Acrobat |
| PD-048 | Ruban/Outil | [Acrobat] Affichage > Défilement automatique (Ctrl+Maj+H) | Absent | P3 | requestAnimationFrame qui incrémente viewerRef.scrollTop, vitesse par flèches haut/bas |
| PD-049 | Ruban/Outil | [Acrobat] Affichage > Afficher/masquer les volets de navigation (rail : miniatures, signets, pièces jointes, calques, signatures, commentaires) | Présent à vérifier | P1 | packages/pdf/src/Sidebar.tsx PANELS (8 volets) ; persistance pdf.panel |
| PD-050 | Ruban/Outil | [Acrobat] Affichage > Règles (Ctrl+R) | Absent | P3 | Règles HTML autour de .pdf-pages en points PDF (displaySize) |
| PD-051 | Ruban/Outil | [Acrobat] Affichage > Grille (Ctrl+U) et Repères | Absent | P3 | Calque SVG de grille dans PageView.tsx ; repères glissés depuis les règles, aimantation dans moveItem |
| PD-052 | Ruban/Outil | [Acrobat] Affichage > Aperçu de la surimpression, éléments de page (zone de rognage, fond perdu) | Absent | P3 | Prépresse : dessiner CropBox/TrimBox/BleedBox lues par pdf-lib en cadres SVG |
| PD-053 | Ruban/Outil | [Acrobat] Fenêtre > Nouvelle fenêtre | Absent | P3 | services.openModule('pdf', chemin) existe (packages/core/src/types.ts) mais n'est appelé nulle part dans le module |
| PD-054 | Ruban/Outil | [Acrobat] Fenêtre > documents ouverts en onglets | Absent | P2 | Module mono-document (useDoc.ts) ; DocumentTabs de packages/ui (Panels.tsx) disponible pour multiplexer plusieurs useDoc |
| PD-055 | Ruban/Outil | [Acrobat] Fenêtre > Fractionner / Cascade / Mosaïque | Absent | P3 | Fractionner = deux PageView sur le même pdf ; cascade/mosaïque relèvent du système |
| PD-056 | Ruban/Outil | [Acrobat] Aide > Aide d'Acrobat (F1), Tutoriels | Absent | P3 | Aucun contenu d'aide dans le module ; panneau d'aide contextuel à écrire |
| PD-057 | Ruban/Outil | [Acrobat] Aide > Vérifier les mises à jour | Partiel | P3 | Services.updater (packages/core/src/types.ts) existe au niveau de la suite ; aucune commande dans PdfApp.tsx |
| PD-058 | Ruban/Outil | [Acrobat] Recherche de commandes et d'outils (barre Rechercher les outils) | Présent à vérifier | P2 | packages/pdf/src/PdfApp.tsx collectCommands(tabs) passé à TitleBar ; packages/ui logic/commands.ts searchCommands |
| PD-059 | Ruban/Outil | [Acrobat] Page d'accueil Acrobat (fichiers récents, favoris, partagés) | Partiel | P3 | Accueil de la suite (hors module) ; backstage Ouvrir direct dans PdfApp.tsx |
| PD-060 | Ruban/Outil | [Acrobat] Outil Sélection (V) | Présent à vérifier | P1 | ribbon.tsx tool-select ; model.ts Tool 'select' ; PageView.tsx TextLayer |
| PD-061 | Ruban/Outil | [Acrobat] Outil Main (H) : défilement par glisser | Présent à vérifier | P1 | ribbon.tsx tool-hand ; PdfApp.tsx onPointerDown viewer (scrollTo) ; curseur grab dans Pdf.css |
| PD-062 | Ruban/Outil | [Edge] Barre d'outils du lecteur (Dessiner, Surligner, Ajouter du texte, Effacer, Lire, Rechercher, Page, Organiser) | Partiel | P2 | Équivalents dans les onglets Accueil/Commentaire de packages/pdf/src/ribbon.tsx ; pas de barre flottante à la Edge |
| PD-063 | Annotation | [Edge] Dessiner : stylo avec couleur et épaisseur, sensible à la pression du stylet | OK | P1 | packages/pdf/src/ribbon.tsx tool-ink + ink-color + ink-width ; model.ts pressureWidth ; PageView.tsx touches/lastPen (rejet de la paume) ; Preuve OK : parcours du STATUS.md (crayon) et packages/pdf/tests/pressure.test.ts |
| PD-064 | Annotation | [Edge] Surligner le texte (plusieurs couleurs) | OK | P1 | ribbon.tsx tool-highlight + mark-color (MARK_COLORS 5) ; model.ts snapToText colle le surlignage aux lignes ; Preuve OK : parcours du STATUS.md (surlignage) et packages/pdf/tests/pdf.test.ts (surlignage collé au texte) |
| PD-065 | Annotation | [Edge] Effacer (gomme sur dessins et surlignages) | Partiel | P1 | Pas d'outil gomme : sélectionner puis Suppr efface le tracé entier (PageView.tsx floatbar). Outil 'erase' : hit-test pointeur sur ink/mark puis d.removeItems |
| PD-066 | Annotation | [Edge] Ajouter du texte (zone de texte avec taille et couleur) | Partiel | P1 | ribbon.tsx tool-freetext + font-size + ink-color ; FreeText avec Helvetica seulement (appearance.ts textOps), pas de police/gras/alignement |
| PD-067 | Signature | [Edge] Ajouter une signature (dessiner, saisir, image) | Partiel | P1 | packages/pdf/src/dialogs.tsx SignaturePad (dessiner/taper) ; pas d'import d'image ni de signature enregistrée (useState local) |
| PD-068 | Recherche/Lecture | [Edge] Ctrl+molette : zoom du document | Absent | P1 | Aucun écouteur wheel dans packages/pdf (grep) ; usePinchZoom de packages/ui ne gère que le tactile. Ajouter onWheel ctrlKey -> setZoom(stepZoom) avec preventDefault |
| PD-069 | Page/Organisation | [Edge] Organiser (réordonner, supprimer, pivoter, insérer des pages) | Présent à vérifier | P1 | ribbon.tsx onglet Organiser ; Sidebar.tsx miniatures glissables ; PdfApp.tsx onMovePage -> pdfOps.reorder |
| PD-070 | Recherche/Lecture | [Edge] Tableau de contenu (signets) dans la barre latérale | OK | P1 | Sidebar.tsx Bookmarks ; extras.ts/pdfdoc.ts outline ; useExtras.ts ; Preuve OK : packages/pdf/tests/reading.test.ts (signets relus par pdf.js) |
| PD-071 | Recherche/Lecture | [Edge] Mise en page : une page / deux pages, ajuster à la largeur, page entière | Présent à vérifier | P1 | ribbon.tsx mode-single, two-pages, fit-width, fit-page |
| PD-072 | Recherche/Lecture | [Edge] Faire pivoter la vue et tourner les pages du fichier | Présent à vérifier | P1 | ribbon.tsx rot-left/rot-right (vue) et rot-left-p/rot-right-p (pdfOps.rotate, fichier) |
| PD-073 | Formulaire | [Edge] Remplir un formulaire (champs interactifs) puis enregistrer | OK | P1 | PageView.tsx champs superposés ; forms.ts writeValues (/V + apparences + NeedAppearances) ; Preuve OK : parcours du STATUS.md (saisie d'un champ) et packages/pdf/tests/annots.test.ts |
| PD-074 | Recherche/Lecture | [Edge] Rechercher dans le document avec nombre de résultats et navigation | OK | P1 | SidePanels.tsx SearchPanel (compteur, liste, Entrée/Maj+Entrée) ; surlignage des résultats PageView.tsx pdf-hit ; Preuve OK : parcours du STATUS.md (recherche « atelier », 2 résultats + surlignage) |
| PD-075 | Accessibilité | [Edge] Obtenir des descriptions d'images (texte alternatif généré) | Absent | P3 | Aucune lecture des images ni de /Alt. Local : modèle de légendage en Rust (candle/ort) ou service optionnel ; écrire /Alt dans la structure (voir Accessibilité) |
| PD-076 | Intégration | [Edge] Demander à Copilot (résumer, poser des questions sur le PDF) | Absent | P3 | Aucune IA dans le module. Voir idée PD-A01 (résumé local) ; extraction via allText (pdfdoc.ts) comme contexte |
## 2. Page Outils d'Acrobat (un outil = une ligne, puis ses options principales)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-077 | Ruban/Outil | [Acrobat] Outils > Créer un PDF (panneau) : fichier, scanner, page web, presse-papiers, page vierge | Partiel | P1 | Aucune entrée Créer dans packages/pdf/src/ribbon.tsx ; la création vit dans le module Convertisseur (packages/convert/src/engines.ts, formats.ts). Ajouter un groupe Créer au backstage qui appelle runBytes op convertir / imagesToPdf |
| PD-078 | OCR/Conversion | [Acrobat] Créer un PDF depuis un fichier Word, Excel ou PowerPoint | Partiel | P1 | Moteur natif office_vers_pdf (LibreOffice, crates/forge-convert/src/pdf/externe.rs office_vers_pdf) et conversion simplifiée (conv/mod.rs) ; accessible seulement depuis packages/convert, pas depuis le module PDF |
| PD-079 | OCR/Conversion | [Acrobat] Créer un PDF depuis une ou plusieurs images (JPEG, PNG, TIFF, BMP) | Partiel | P1 | packages/convert/src/pdf-ops.ts imagesToPdf (png/jpg seulement) ; natif images_vers_pdf (crates/forge-convert/src/pdf/images.rs) plus large ; pas de bouton dans le module PDF |
| PD-080 | OCR/Conversion | [Acrobat] Créer un PDF depuis un texte, Markdown ou HTML | Partiel | P3 | crates/forge-convert/src/conv/mod.rs txt_to_pdf, md_to_pdf, html_to_pdf ; Convertisseur uniquement |
| PD-081 | OCR/Conversion | [Acrobat] Créer un PDF depuis un scanner (WIA/TWAIN, bac automatique, recto verso) | Absent | P2 | Aucune acquisition. Natif Windows : WIA via crate windows ou NAPS2 en processus externe, puis ocr natif ; navigateur/mobile : input capture ou caméra, imagesToPdf |
| PD-082 | OCR/Conversion | [Acrobat] Créer un PDF depuis une page web (URL, profondeur, options de conversion) | Absent | P2 | Seul html_to_pdf sur fichier existe (conv/mod.rs). Natif : WebView2 PrintToPdf (Tauri) sur une URL ; navigateur : impossible (CORS), message explicite |
| PD-083 | OCR/Conversion | [Acrobat] Créer un PDF depuis le presse-papiers (image ou capture d'écran) | Absent | P3 | navigator.clipboard.read() -> image -> imagesToPdf (pdf-ops.ts) puis useDoc.start |
| PD-084 | Ruban/Outil | [Acrobat] Combiner des fichiers (outil) : ajouter, réordonner, supprimer, fusionner | Partiel | P1 | packages/pdf/src/ribbon.tsx merge + PdfApp.tsx actions.merge : UN fichier ajouté à la fin à chaque fois (pdfOps.merge) |
| PD-085 | Page/Organisation | [Acrobat] Combiner : choisir plusieurs fichiers d'un coup, réordonner par glisser, aperçu des miniatures | Absent | P1 | pdfOps.merge(files[]) (packages/convert/src/pdf-ops.ts) et Operation::Fusionner avec ordre (operation.rs) acceptent N fichiers ; il manque le dialogue liste réordonnable |
| PD-086 | Page/Organisation | [Acrobat] Combiner : plages de pages par fichier et mots de passe par fichier chiffré | Absent | P2 | parsePageRange + pdfOps.extract existent ; natif Fusionner a mots_de_passe ; UI à écrire |
| PD-087 | Page/Organisation | [Acrobat] Combiner : taille du résultat (petite, moyenne, grande) et signets par fichier source | Absent | P3 | Chaîner NiveauCompression natif après merge ; signets : writeOutline (outlines.ts) avec un signet par fichier |
| PD-088 | Ruban/Outil | [Acrobat] Outils > Modifier un PDF (texte et images, rogner, filigrane, arrière-plan, en-tête, Bates, lien) | Partiel | P1 | Onglet Modifier de packages/pdf/src/ribbon.tsx : Modifier le texte, Zone de texte, champs, Filigrane, Numérotation, En-tête/pied, Propriétés ; pas d'images, liens, arrière-plan, rogner |
| PD-089 | Ruban/Outil | [Acrobat] Outils > Exporter un PDF (Word, Excel, PowerPoint, image, HTML, texte) | Partiel | P1 | Groupe Exporter de ribbon.tsx : Images PNG (ZIP), Texte, Word (natif) ; voir la section Export |
| PD-090 | Ruban/Outil | [Acrobat] Outils > Organiser les pages (miniatures + barre : extraire, insérer, remplacer, diviser, supprimer, rogner, pivoter, numéroter) | Partiel | P1 | Onglet Organiser de ribbon.tsx : pivoter, supprimer, extraire, vierge, insérer, fusionner, découper ; manquent remplacer, rogner, numérotation d'étiquettes |
| PD-091 | Ruban/Outil | [Acrobat] Outils > Commentaire (barre d'annotation, volet Commentaires, filtres, résumé) | Partiel | P1 | Onglet Commentaire de ribbon.tsx + SidePanels.tsx CommentsPanel ; sans réponses, états, filtres ni résumé |
| PD-092 | Ruban/Outil | [Acrobat] Commentaire > Envoyer pour commentaires / relecture partagée (suivi des réponses) | Absent | P2 | Aucun flux de relecture. Local : exporter un XFDF des annotations (voir Annotation) et fusionner les retours reçus |
| PD-093 | Ruban/Outil | [Acrobat] Outils > Remplir et signer | Partiel | P1 | ribbon.tsx : toggle fill (Remplir le formulaire) + bouton Signer (dialogs.tsx SignaturePad) ; sans coches/croix, date, initiales |
| PD-094 | Annotation | [Acrobat] Remplir et signer : ajouter du texte libre sur le document | Partiel | P1 | tool-freetext (ribbon.tsx) crée une annotation FreeText (appearance.ts) et non du contenu de page ; police et alignement fixes |
| PD-095 | Annotation | [Acrobat] Remplir et signer : coche, croix, cercle, ligne, point (marques de formulaire) | Absent | P1 | Aucune marque. Ajouter un Item 'mark' vectoriel (glyphes dessinés en chemins dans appearance.ts writeItem) et une barre rapide Remplir et signer |
| PD-096 | Annotation | [Acrobat] Remplir et signer : ajouter la date du jour | Absent | P2 | Item freetext prérempli avec new Date().toLocaleDateString('fr-FR') ; format de date configurable |
| PD-097 | Signature | [Acrobat] Remplir et signer : initiales (créer, enregistrer, placer) | Absent | P2 | Réutiliser SignaturePad (dialogs.tsx) avec un second emplacement persistant (settings.set) |
| PD-098 | Formulaire | [Acrobat] Remplir et signer : détecter automatiquement les lignes et cases d'un formulaire non interactif | Absent | P2 | Analyse du flux de contenu (chemins horizontaux, petits rectangles) via pdf.js getOperatorList puis création de champs |
| PD-099 | Ruban/Outil | [Acrobat] Outils > Préparer un formulaire | Partiel | P1 | ribbon.tsx : Ajouter un champ (6 types), Remplir le formulaire, Aplatir ; sans propriétés, détection, bouton, date, code-barres |
| PD-100 | Ruban/Outil | [Acrobat] Outils > Protéger (mot de passe, certificat, restrictions) | Partiel | P1 | Onglet Protéger de ribbon.tsx : mot de passe AES-256 + autorisations, retrait de protection ; pas de chiffrement par certificat |
| PD-101 | Ruban/Outil | [Acrobat] Outils > Caviarder (marquer, appliquer, propriétés, motifs) | Partiel | P1 | ribbon.tsx tool-redact + apply-redact ; natif caviarder (crates/forge-convert/src/pdf/caviardage.rs) ; sans recherche de texte, motifs, propriétés |
| PD-102 | Ruban/Outil | [Acrobat] Outils > Optimiser le PDF (réduire la taille, optimisation avancée, auditer l'espace) | Partiel | P1 | ribbon.tsx compress -> dialogs.tsx 'compress' 4 niveaux (natif compresser) ; pas d'optimiseur avancé ni d'audit |
| PD-103 | Ruban/Outil | [Acrobat] Outils > Améliorer les numérisations / Reconnaissance de texte | Partiel | P1 | ribbon.tsx ocr -> natif ocrmypdf (externe.rs ocr) ; sans amélioration d'image ni correction des suspects |
| PD-104 | Ruban/Outil | [Acrobat] Outils > Comparer des fichiers | Partiel | P2 | ribbon.tsx compare -> PdfApp.tsx compare : diff texte ligne à ligne (model.ts diffLines) |
| PD-105 | Ruban/Outil | [Acrobat] Outils > Accessibilité (vérification complète, ordre de lecture, texte de remplacement, étiquettes) | Absent | P2 | Aucun contrôle ni édition de structure. Voir section Accessibilité (lecture de /StructTreeRoot via pdf-lib) |
| PD-106 | Ruban/Outil | [Acrobat] Outils > Imprimer la production (aperçu de sortie, contrôle en amont, marques, couleurs) | Absent | P3 | Prépresse hors périmètre actuel ; contrôle en amont minimal possible avec pdf-lib (polices incorporées, profils) |
| PD-107 | Ruban/Outil | [Acrobat] Imprimer la production : contrôle en amont (Preflight) avec profils | Absent | P3 | Parcourir polices, images, espaces colorimétriques (pdf-lib) et produire un rapport ; Ghostscript pour PDF/X |
| PD-108 | Ruban/Outil | [Acrobat] Imprimer la production : marques d'impression, fond perdu, boîtes TrimBox/BleedBox | Absent | P3 | Écrire /TrimBox /BleedBox (pdf-lib setTrimBox/setBleedBox) et dessiner repères dans le flux |
| PD-109 | Ruban/Outil | [Acrobat] Imprimer la production : convertir les couleurs (CMJN/RVB/gris, profils ICC), aplatir la transparence | Absent | P3 | Ghostscript pdfwrite -sColorConversionStrategy (externe.rs pdf_a le fait déjà en RVB) ; exposer en options |
| PD-110 | Ruban/Outil | [Acrobat] Outils > Certificats (signer numériquement, horodater, valider) | Partiel | P1 | ribbon.tsx sign-digital -> dialogs-sign.tsx DigitalSignDialog -> sign/pdfsign.ts signPdf ; validation sign/verify.ts ; pas d'horodatage ni certification |
| PD-111 | Intégration | [Acrobat] Outils > Envoyer pour signature (demander des signatures à des tiers) | Absent | P2 | Aucun flux multi-signataires ni service. Local : champs de signature + ordre + export du PDF préparé, suivi manuel |
| PD-112 | Ruban/Outil | [Acrobat] Plus d'outils > Assistant d'actions (séquences enregistrées sur un ou plusieurs fichiers) | Absent | P2 | Moteur : Operation::Pdf accepte une liste d'actions enchaînées (crates/forge-convert/src/operation.rs ActionPdf) et packages/convert/src/pdf-batch.ts runPdfTool. Ajouter un éditeur de séquences + exécution par lot |
| PD-113 | Ruban/Outil | [Acrobat] Plus d'outils > Standards PDF (PDF/A, PDF/E, PDF/X, PDF/UA, vérifier la conformité) | Partiel | P2 | ribbon.tsx pdfa -> natif pdf_a (Ghostscript, PDF/A-2b seulement) ; aucun contrôle de conformité ni autres normes |
| PD-114 | Ruban/Outil | [Acrobat] Plus d'outils > Contenu multimédia et interactif (3D, audio, vidéo, SWF) | Absent | P3 | pdf.js n'exécute pas le rich media. Lister les annotations RichMedia/Screen/Sound dans le volet Pièces jointes et extraire le flux |
| PD-115 | Ruban/Outil | [Acrobat] Plus d'outils > JavaScript (éditeur, console, scripts de document) | Absent | P3 | Politique actuelle : JavaScript jamais exécuté (strings.ts notices.javascript, forms.ts inspectFlags). Au mieux un lecteur de scripts en lecture seule |
| PD-116 | Ruban/Outil | [Acrobat] Plus d'outils > Indexation (catalogue, index de recherche de plusieurs PDF) | Absent | P3 | Index local SQLite FTS5 des textes (forge-base) ; voir idée PD-A09 |
| PD-117 | Ruban/Outil | [Acrobat] Plus d'outils > Mesure (distance, périmètre, aire) | Absent | P3 | Voir lignes Annotation mesure ; échelle de page /VP /Measure à lire/écrire |
| PD-118 | Ruban/Outil | [Acrobat] Plus d'outils > Pièces jointes (joindre un fichier, joindre un commentaire audio) | Partiel | P2 | packages/pdf/src/extras.ts listAttachments/attachmentBytes + SidePanels.tsx AttachmentsPanel : lecture et enregistrement seulement, aucun ajout |
| PD-119 | Ruban/Outil | [Acrobat] Plus d'outils > Tampon (palette, tampons dynamiques, créer un tampon personnalisé) | Partiel | P2 | ribbon.tsx split stamp : 6 tampons fixes (model.ts StampKind) ; ni dynamiques ni personnalisés |
| PD-120 | Ruban/Outil | [Acrobat] Plus d'outils > Portfolio PDF (collection de fichiers) | Absent | P3 | /Collection du catalogue + EmbeddedFiles (pdf-lib attach) ; pdf.js ouvre le portfolio comme un PDF ordinaire |
| PD-121 | Intégration | [Acrobat] Assistant IA d'Acrobat : résumer le document | Absent | P2 | Aucune IA. Extraction du texte via allText (pdfdoc.ts) puis modèle local ; voir PD-A01 |
| PD-122 | Intégration | [Acrobat] Assistant IA d'Acrobat : poser des questions avec citations des pages sources | Absent | P2 | Indexer les boîtes de texte (useText.ts textBoxes) par page ; réponses avec liens goTo ; voir PD-A02 |
| PD-123 | Ruban/Outil | [Acrobat] Outils favoris et épinglés dans le volet Outils | Partiel | P3 | Recherche de commandes (collectCommands) et barre d'accès rapide ; pas d'épinglage d'outils PDF |
| PD-124 | Ruban/Outil | [Acrobat] Outil Instantané / Mesure / Loupe dans la barre d'outils de sélection | Absent | P3 | Voir lignes Édition et Affichage ; trois outils distincts à ajouter au type Tool (model.ts) |
## 3. Annotations et commentaires : types, propriétés, volet Commentaires

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-125 | Annotation | [Acrobat] Surligner le texte (Highlight, 5 couleurs, collé aux lignes) | OK | P1 | packages/pdf/src/model.ts snapToText ; packages/pdf/src/appearance.ts writeItem case 'mark' (QuadPoints + mode Multiply) ; packages/pdf/tests/pdf.test.ts ; Preuve OK : packages/pdf/tests/pdf.test.ts (surlignage collé aux lignes) et parcours du STATUS.md |
| PD-126 | Annotation | [Acrobat] Surligner une zone sans texte (rectangle libre) | Présent à vérifier | P2 | model.ts snapToText retourne le rectangle glissé quand aucune boîte de texte n'est touchée |
| PD-127 | Annotation | [Acrobat] Souligner le texte (Underline) | Présent à vérifier | P1 | ribbon.tsx tool-underline ; appearance.ts writeItem 'mark' mark=underline ; PageView.tsx finish |
| PD-128 | Annotation | [Acrobat] Barrer le texte (StrikeOut) | Présent à vérifier | P1 | ribbon.tsx tool-strike ; appearance.ts writeItem 'mark' mark=strike |
| PD-129 | Annotation | [Acrobat] Souligné ondulé (Squiggly) | Absent | P2 | MarkKind = highlight, underline, strike seulement (model.ts). Ajouter 'squiggly' : polyligne en zigzag dans appearance.ts et Subtype Squiggly ; lecture dans annots.ts parseAnnotation |
| PD-130 | Annotation | [Acrobat] Insérer du texte au curseur (Caret) | Absent | P2 | Annotation Caret + note associée : nouveau Item 'caret' (pos, texte) ; apparence en chevron, /Subtype /Caret /RC |
| PD-131 | Annotation | [Acrobat] Remplacer le texte sélectionné (barré + texte inséré) | Absent | P2 | Composer un mark strike et un caret avec texte, liés par /IRT et /RT |
| PD-132 | Annotation | [Acrobat] Ajouter une note au texte sélectionné (menu de sélection) | Absent | P1 | La note n'est posée qu'au clic (PageView.tsx finish case 'note'). Avec une sélection TextLayer, créer une note ancrée sur la sélection (lecture de window.getSelection) |
| PD-133 | Annotation | [Acrobat] Note (Text) : placement au clic, saisie du texte, déplacement, suppression | OK | P1 | ribbon.tsx tool-note ; itemview.tsx ItemDom case 'note' (textarea) ; appearance.ts case 'note' (Subtype Text, Name Comment) ; Preuve OK : parcours du STATUS.md (note) |
| PD-134 | Annotation | [Acrobat] Note : choix de l'icône (commentaire, clé, note, aide, paragraphe, insérer) | Absent | P3 | Icône fixe Name=Comment (appearance.ts). Ajouter item.icon et dessiner l'icône correspondante |
| PD-135 | Annotation | [Acrobat] Note : fenêtre contextuelle ouverte/fermée dans le fichier (Open, Popup) | Partiel | P2 | La note s'ouvre en textarea dans l'éditeur (itemview.tsx) ; le fichier écrit Open=false sans /Popup, annots.ts popupOf supprime les popups existants |
| PD-136 | Annotation | [Acrobat] Commentaire modifiable sur un surlignage, souligné ou barré (texte du popup) | Partiel | P1 | Le texte du surlignage est copié dans /Contents (textUnder, model.ts) mais itemview.tsx ItemDom n'offre aucun champ pour le modifier sur un 'mark' ; ajouter textarea comme pour 'note' |
| PD-137 | Annotation | [Acrobat] Zone de texte (FreeText) : tracé, saisie, déplacement, redimensionnement | Partiel | P1 | ribbon.tsx tool-freetext ; itemview.tsx 'freetext' ; appearance.ts case 'freetext' (Helvetica, /DA) ; ni bordure, ni remplissage, ni police |
| PD-138 | Annotation | [Acrobat] Zone de texte : police, gras, italique, alignement, interligne | Absent | P2 | Seuls size et color (model.ts Item freetext). Ajouter fontFamily/bold/italic/align et mapper sur StandardFonts (pdf-lib) ou polices incorporées |
| PD-139 | Annotation | [Acrobat] Zone de texte : couleur de remplissage et de bordure, épaisseur | Absent | P2 | Ajouter fill/border à Item freetext, /IC /C /BS dans appearance.ts |
| PD-140 | Annotation | [Acrobat] Légende (Callout, FreeText avec ligne de rappel) | Absent | P2 | Subtype FreeText avec /IT /FreeTextCallout et /CL ; item avec point d'ancrage et coude |
| PD-141 | Annotation | [Acrobat] Machine à écrire (texte posé sur la page) | Partiel | P2 | Équivalent par FreeText (annotation) ; pas de texte écrit dans le contenu de page. Voir Édition > Ajouter du texte |
| PD-142 | Annotation | [Acrobat] Crayon (Ink) à main levée, un trait = une annotation | OK | P1 | ribbon.tsx tool-ink ; appearance.ts case 'ink' (InkList, BS.W) ; PageView.tsx finish case 'ink' ; Preuve OK : parcours du STATUS.md (crayon) |
| PD-143 | Annotation | [Acrobat] Crayon : annotations Ink de plusieurs traits déjà dans un fichier modifiables | Absent | P3 | annots.ts parseAnnotation : InkList de plus d'un tracé -> null (laissé à pdf.js). Transformer en plusieurs Item ink liés |
| PD-144 | Annotation | [Acrobat] Gomme (effacer des traits de crayon) | Partiel | P2 | Suppression d'un tracé entier par sélection + Suppr (PdfApp.tsx) ; pas de gomme partielle sur un trait |
| PD-145 | Annotation | [Acrobat] Rectangle (Square) : trait seul | OK | P1 | ribbon.tsx tool-rect ; appearance.ts case 'shape' Square (BS.W) ; annots.ts parseAnnotation Square ; Preuve OK : parcours du STATUS.md (rectangle) |
| PD-146 | Annotation | [Acrobat] Ellipse (Circle) : trait seul | OK | P1 | ribbon.tsx tool-ellipse ; appearance.ts ellipsePath ; annots.ts parseAnnotation Circle ; Preuve OK : parcours du STATUS.md (ellipse, enregistrement puis relecture pdf.js) |
| PD-147 | Annotation | [Acrobat] Formes : couleur de remplissage et opacité | Absent | P2 | Item shape n'a que color et width (model.ts). Ajouter fill, opacity (/IC, /CA, ExtGState) dans appearance.ts |
| PD-148 | Annotation | [Acrobat] Polygone | Absent | P2 | Ajouter Tool 'polygon' : clics successifs, double-clic ferme ; Subtype Polygon avec /Vertices |
| PD-149 | Annotation | [Acrobat] Nuage (polygone à bords arrondis, /BE) | Absent | P2 | Subtype Polygon + /BE <</S /C /I 2>> ; apparence : arcs sur chaque côté |
| PD-150 | Annotation | [Acrobat] Ligne (Line) | Présent à vérifier | P1 | ribbon.tsx tool-line ; appearance.ts case 'shape' Line (L, BS) ; annots.ts parseAnnotation Line |
| PD-151 | Annotation | [Acrobat] Flèche (Line avec extrémité) | Présent à vérifier | P1 | ribbon.tsx tool-arrow ; appearance.ts LE [None, OpenArrow] ; annots.ts détecte /LE Arrow |
| PD-152 | Annotation | [Acrobat] Lignes : types d'extrémités (fermée, ouverte, ronde, carrée, diamant) et pointillés | Partiel | P3 | Une seule flèche (OpenArrow, appearance.ts) ; pas de styles /LE ni /BS /S D. Ajouter lineStart/lineEnd/dash à Item shape |
| PD-153 | Annotation | [Acrobat] Polyligne (PolyLine) | Absent | P3 | Même mécanique que Polygon sans fermeture ; Subtype PolyLine |
| PD-154 | Annotation | [Acrobat] Tampon (Stamp) : palette de tampons prédéfinis | Partiel | P2 | ribbon.tsx split stamp : 6 tampons FR (model.ts StampKind) écrits en Subtype Stamp ; Acrobat propose des dizaines (Approuvé, Confidentiel, Pour commentaire public, Signer ici...) |
| PD-155 | Annotation | [Acrobat] Tampon personnalisé (depuis image ou PDF) et dynamique (nom, date, heure) | Absent | P2 | Ajouter Item 'stamp' avec png/PDF source (embedPng/embedPdf) et gabarit {nom} {date} {heure} résolu à la pose |
| PD-156 | Annotation | [Acrobat] Pièce jointe : annotation Fichier joint (icône sur la page) | Absent | P3 | Subtype FileAttachment + /FS (pdf-lib attach) ; icône Punaise ; liste déjà vue par extras.ts listAttachments |
| PD-157 | Annotation | [Acrobat] Commentaire audio / son (Sound) et enregistrement micro | Absent | P3 | navigator.mediaDevices + MediaRecorder -> flux /Sound ; lecture hors périmètre de pdf.js |
| PD-158 | Annotation | [Acrobat] Outil de mesure : distance | Absent | P3 | Line avec /Measure ; échelle de page (/VP) ; libellé calculé |
| PD-159 | Annotation | [Acrobat] Outil de mesure : périmètre | Absent | P3 | Polyligne avec /Measure et somme des segments |
| PD-160 | Annotation | [Acrobat] Outil de mesure : aire | Absent | P3 | Polygone avec /Measure (formule de l'aire de Gauss) |
| PD-161 | Annotation | [Acrobat] Liste de contrôle : coche, croix (tampons de marque) | Absent | P1 | Aucune marque vectorielle (voir Remplir et signer). Ajouter Item 'check' dessiné en chemins dans appearance.ts |
| PD-162 | Annotation | [Acrobat] Propriétés d'une annotation : couleur (palette) | Présent à vérifier | P1 | PageView.tsx floatbar (pastilles MARK_COLORS/INK_COLORS) ; model.ts restyle ; PdfApp.tsx actions.setOpt applique à l'élément sélectionné |
| PD-163 | Annotation | [Acrobat] Propriétés d'une annotation : épaisseur de trait | Présent à vérifier | P1 | ribbon.tsx ink-width -> setOpt -> model.ts restyle (width) |
| PD-164 | Annotation | [Acrobat] Propriétés d'une annotation : opacité | Absent | P2 | Aucun champ opacity ; surlignage fixé à 0,45 (itemview.tsx) et Multiply (appearance.ts) ; ajouter /CA |
| PD-165 | Annotation | [Acrobat] Propriétés d'une annotation : auteur, sujet, date, étiquette | Absent | P2 | author vient de settings user.name (PdfApp.tsx) ; aucune boîte Propriétés par annotation. Dialogue : author, subject (/Subj), M |
| PD-166 | Annotation | [Acrobat] Propriétés d'une annotation : verrouiller (empêcher modification) | Absent | P3 | Bit Locked (128) de /F ; refuser move/resize dans PageView.tsx grab si verrouillé |
| PD-167 | Annotation | [Acrobat] Annotations existantes d'un autre outil : déplacer, recolorer, supprimer | Partiel | P1 | annots.ts parseAnnotation couvre Highlight, Underline, StrikeOut, Text, FreeText, Square, Circle, Line, Ink (1 trait), Stamp aux libellés connus ; les autres (Squiggly, Caret, Polygon, FileAttachment...) restent dessinées par pdf.js, non modifiables |
| PD-168 | Annotation | [Acrobat] Sélection multiple d'annotations (Ctrl+clic, rectangle) et déplacement groupé | Absent | P2 | selectedId est un seul identifiant (PdfApp.tsx). Passer à Set<string> et appliquer moveItem à chaque élément |
| PD-169 | Annotation | [Acrobat] Redimensionner une annotation par poignées (huit poignées) | Partiel | P2 | PageView.tsx une seule poignée bas droite (itemview.tsx handleOf/resizeItem) ; pas pour mark, note, ink |
| PD-170 | Annotation | [Acrobat] Dupliquer / copier-coller une annotation | Absent | P3 | Voir Édition > Copier/Coller ; Ctrl+D à définir |
| PD-171 | Annotation | [Acrobat] Ordre de superposition des annotations (premier plan, arrière-plan) | Absent | P3 | Ordre = ordre de /Annots ; ajouter reorder dans removeAnnotations/applyItems |
| PD-172 | Annotation | [Acrobat] Annotations sur pages pivotées (contenu droit à l'écran) | OK | P2 | model.ts screenFrame ; appearance.ts framed ; packages/pdf/tests/annots.test.ts (texte libre sur page pivotée) ; Preuve OK : packages/pdf/tests/annots.test.ts |
| PD-173 | Annotation | [Acrobat] Réponses aux commentaires (fil de discussion, IRT) | Absent | P1 | annots.ts parseAnnotation ignore les annotations avec /IRT (return null) ; aucune UI de réponse. Ajouter Item.replyTo, écrire /IRT /RT /R, afficher en arbre dans CommentsPanel |
| PD-174 | Annotation | [Acrobat] État d'un commentaire (Accepté, Rejeté, Annulé, Terminé) et case de révision | Absent | P2 | Annotations /State /StateModel (Review/Marked) comme réponses IRT ; menu d'état dans le volet |
| PD-175 | Annotation | [Acrobat] Volet Commentaires : liste des commentaires ajoutés et déjà dans le fichier | Partiel | P1 | SidePanels.tsx CommentsPanel (auteur, page, type, texte, suppression) ; sous-types non gérés listés en lecture seule via useExtras.ts foreign |
| PD-176 | Annotation | [Acrobat] Volet Commentaires : filtrer par type, auteur, état, page, couleur | Absent | P2 | CommentsPanel n'a aucun filtre ; ajouter un état filtre sur Item.kind/author/page |
| PD-177 | Annotation | [Acrobat] Volet Commentaires : trier (page, auteur, date, type) | Absent | P2 | Liste dans l'ordre d'insertion ; ajouter tri sur page/at/author |
| PD-178 | Annotation | [Acrobat] Volet Commentaires : rechercher dans le texte des commentaires | Absent | P3 | La recherche (SearchPanel) ne parcourt que le texte des pages ; étendre find.ts search aux Item.text |
| PD-179 | Annotation | [Acrobat] Remplacer du texte dans les commentaires (au-delà d'Acrobat) | OK | P3 | PdfApp.tsx replaceInComments + find.ts replaceIn (regex, casse) ; Preuve OK : packages/pdf/tests/reading.test.ts (remplacement dans le texte des annotations) |
| PD-180 | Annotation | [Acrobat] Résumer les commentaires (PDF de synthèse par page ou par auteur) | Absent | P2 | Générer un PDF avec pdf-lib à partir de allItems (page, auteur, texte) et l'ouvrir ou l'enregistrer |
| PD-181 | Annotation | [Acrobat] Exporter les commentaires en FDF/XFDF | Absent | P2 | Sérialiser allItems en XFDF (XML) : un élément par annotation avec rect, page, contents ; sauvegarde via saveBytes |
| PD-182 | Annotation | [Acrobat] Importer des commentaires depuis FDF/XFDF ou un autre PDF | Absent | P2 | Parser XFDF -> Item[] -> d.addItem ; ou lire /Annots d'un autre PDF avec annots.ts readAnnotations |
| PD-183 | Annotation | [Acrobat] Aplatir les commentaires et annotations dans le contenu de la page | Partiel | P2 | ribbon.tsx flatten -> d.flush(true) -> apply.ts form.flatten() : ne fige que les champs ; les annotations restent des annotations (l'infobulle flattenTip de strings.ts promet davantage) |
| PD-184 | Annotation | [Acrobat] Rejet de la paume et pression du stylet pour annoter (tablette) | Présent à vérifier | P2 | PageView.tsx lastPen/touches ; model.ts pressureWidth ; packages/pdf/tests/pressure.test.ts |
| PD-185 | Annotation | [Acrobat] Annotations réellement écrites dans le fichier avec apparence (lisibles par tout lecteur) | OK | P1 | appearance.ts addAnnot (AP/N) ; packages/pdf/tests/pdf.test.ts écriture des annotations réelles ; relecture annots.test.ts ; Preuve OK : packages/pdf/tests/pdf.test.ts et annots.test.ts |
| PD-186 | Annotation | [Acrobat] Définir les propriétés actuelles comme valeurs par défaut | Partiel | P2 | PdfApp.tsx opts (couleur, épaisseur, taille, tampon) restent pour les poses suivantes de la session, sans persistance par type d'outil |
## 4. Menus contextuels (clic droit) : texte, page, annotations, miniatures, signets, champs, liens, images, signatures, commentaires

Constat code : le seul menu contextuel personnalisé du module est celui des miniatures (Sidebar.tsx onContextMenu -> PdfApp.tsx pageMenu). Aucun autre onContextMenu dans packages/pdf/src (grep). La webview affiche son menu natif ailleurs.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-187 | Menu contextuel | [Acrobat] Texte sélectionné : Copier | Partiel | P1 | Copie par le menu natif de la webview sur le TextLayer (PageView.tsx) ; pas de menu ForgeOffice. Ajouter onContextMenu avec useContextMenu de @forgeoffice/ui |
| PD-188 | Menu contextuel | [Acrobat] Texte sélectionné : Surligner / Souligner / Barrer le texte | Absent | P1 | Les marques exigent l'outil actif puis un glisser (PageView.tsx finish). Créer l'Item mark depuis window.getSelection().getRangeAt(0).getClientRects() converti en Rect |
| PD-189 | Menu contextuel | [Edge] Texte sélectionné : Surligner (sous-menu de couleurs) | Absent | P1 | Même mécanique que ci-dessus avec les cinq MARK_COLORS (model.ts) |
| PD-190 | Menu contextuel | [Acrobat] Texte sélectionné : Ajouter une note au texte sélectionné | Absent | P1 | Item note ancré au premier rectangle de la sélection ; ouvrir directement l'éditeur (setEditing) |
| PD-191 | Menu contextuel | [Edge] Texte sélectionné : Ajouter un commentaire | Absent | P1 | Équivalent Edge de la note à la sélection (surlignage + commentaire) : mark avec text modifiable |
| PD-192 | Menu contextuel | [Acrobat] Texte sélectionné : Ajouter un signet (Ctrl+B) | Absent | P2 | outlines.ts addBookmark(tree, parent, titre, page) existe ; titre = sélection, page = courante |
| PD-193 | Menu contextuel | [Acrobat] Texte sélectionné : Insérer du texte / Remplacer le texte sélectionné | Absent | P2 | Dépend de l'annotation Caret (voir Annotation) |
| PD-194 | Menu contextuel | [Acrobat] Texte sélectionné : Rechercher la sélection dans le document | Absent | P2 | text.setQuery(selection) puis setPanel('search') (useText.ts) |
| PD-195 | Menu contextuel | [Edge] Texte sélectionné : Rechercher sur le web | Absent | P3 | window.open sur le moteur de recherche via LinkDialog (dialogs-sign.tsx) pour confirmation |
| PD-196 | Menu contextuel | [Acrobat] Texte sélectionné : Lire à voix haute la sélection | Absent | P2 | speech.ts speak(texte) existe ; l'appeler avec la sélection au lieu de la page |
| PD-197 | Menu contextuel | [Edge] Texte sélectionné : Lire à voix haute à partir d'ici | Absent | P2 | readPage (PdfApp.tsx) lit page par page depuis current ; passer la boîte de départ à pageSpeechText |
| PD-198 | Menu contextuel | [Acrobat] Texte sélectionné : Caviarder la sélection | Absent | P2 | Créer des Item redact aux rectangles de la sélection (model.ts, apply via commitPending) |
| PD-199 | Menu contextuel | [Acrobat] Page vide : Zoom, Ajuster, Rotation de la vue, Mode d'affichage | Absent | P2 | Aucun onContextMenu sur .pdf-page (PageView.tsx) ; menu avec actions du ribbon (zoom, fit, rotateView, setPageMode) |
| PD-200 | Menu contextuel | [Acrobat] Page vide : Coller (annotation, image, texte) | Absent | P2 | navigator.clipboard.read -> Item stamp/signature (image) ou freetext (texte) à l'endroit du clic |
| PD-201 | Menu contextuel | [Acrobat] Page vide : Ajouter un signet sur cette page | Absent | P2 | outlines.ts addBookmark + PdfApp.tsx editBookmarks |
| PD-202 | Menu contextuel | [Acrobat] Page vide : Propriétés du document / de la page | Absent | P3 | Ouvrir openDialog('metadata') (dialogActions.ts) ; propriétés de page = taille, rotation, boîtes |
| PD-203 | Menu contextuel | [Acrobat] Page vide : Outil Main / Sélection / Instantané | Absent | P3 | setTool depuis un menu ; Tool 'snapshot' absent |
| PD-204 | Menu contextuel | [Edge] Page : Faire pivoter dans le sens horaire / antihoraire, Enregistrer sous, Imprimer | Absent | P3 | Actions existantes (ribbon rotateView, useDoc.save, print) à exposer dans un menu |
| PD-205 | Menu contextuel | [Acrobat] Surlignage / souligné / barré : Ouvrir la note, Répondre, Définir l'état | Absent | P1 | Pas de menu ni de fil de réponses (annots.ts ignore IRT). Voir lignes Annotation > Réponses |
| PD-206 | Menu contextuel | [Acrobat] Surlignage / souligné / barré : Propriétés (couleur, opacité, auteur, sujet) | Absent | P1 | Seules des pastilles de couleur dans PageView.tsx floatbar ; dialogue Propriétés à écrire |
| PD-207 | Menu contextuel | [Acrobat] Surlignage : Supprimer | Partiel | P1 | Suppr au clavier (PdfApp.tsx) et bouton corbeille de la barre flottante (PageView.tsx) ; pas dans un menu contextuel |
| PD-208 | Menu contextuel | [Acrobat] Surlignage : Définir comme propriétés par défaut | Absent | P2 | Persister opts.markColor par type dans settings (PdfApp.tsx opts) depuis le menu |
| PD-209 | Menu contextuel | [Acrobat] Note : Ouvrir la note, Répondre, Supprimer, Propriétés | Absent | P1 | Double-clic ouvre la note (itemview.tsx onDoubleClick) ; barre flottante supprime ; aucun menu |
| PD-210 | Menu contextuel | [Acrobat] Zone de texte : Modifier le texte, Propriétés (police), Supprimer, Ordre | Partiel | P1 | Double-clic = édition (itemview.tsx), suppression par barre flottante ; ni police ni ordre. Menu à construire avec useContextMenu |
| PD-211 | Menu contextuel | [Acrobat] Tampon : Propriétés, Supprimer, Créer un tampon personnalisé depuis la sélection | Absent | P2 | Tampon déplaçable/redimensionnable (itemview.tsx) mais aucun menu |
| PD-212 | Menu contextuel | [Acrobat] Dessin (crayon) : Propriétés (couleur, épaisseur), Supprimer | Partiel | P1 | Couleur/épaisseur via ruban et pastilles (restyle) ; pas de menu |
| PD-213 | Menu contextuel | [Acrobat] Forme (rectangle, ellipse) : Propriétés, Définir par défaut, Supprimer | Partiel | P1 | restyle(model.ts) pour couleur et épaisseur ; pas de menu ni de remplissage |
| PD-214 | Menu contextuel | [Acrobat] Ligne / flèche : Propriétés (extrémités, pointillés), Supprimer | Partiel | P2 | Extrémité fixe (appearance.ts) ; pas de menu |
| PD-215 | Menu contextuel | [Acrobat] Pièce jointe (icône sur la page) : Ouvrir, Enregistrer, Supprimer, Propriétés | Absent | P3 | Les pièces jointes ne sont qu'au volet (SidePanels.tsx AttachmentsPanel) ; annotation FileAttachment non éditable |
| PD-216 | Menu contextuel | [Acrobat] Copier / Couper / Coller / Dupliquer / Ordre sur une annotation | Absent | P2 | Aucun presse-papiers d'éléments (voir Édition) |
| PD-217 | Menu contextuel | [Acrobat] Barre d'outils contextuelle de l'élément sélectionné (couleur, suppression) | Partiel | P1 | PageView.tsx div.pdf-floatbar : pastilles de couleur + corbeille ; pas d'épaisseur, de police, d'opacité |
| PD-218 | Menu contextuel | [Acrobat] Miniature de page : Pivoter les pages à gauche / à droite | Présent à vérifier | P1 | PdfApp.tsx pageMenu rl/rr -> pdfOps.rotate sur pagesSel() ; Sidebar.tsx onContextMenu |
| PD-219 | Menu contextuel | [Acrobat] Miniature de page : Insérer une page vierge / depuis un fichier | Présent à vérifier | P1 | PdfApp.tsx pageMenu blank/file -> pdfOps.insertBlank / insertDocument après la page cliquée |
| PD-220 | Menu contextuel | [Acrobat] Miniature de page : Insérer depuis le presse-papiers, le scanner ou une page web | Absent | P3 | Voir Créer un PDF ; insertDocument(bytes, at) réutilisable |
| PD-221 | Menu contextuel | [Acrobat] Miniature de page : Extraire les pages | Présent à vérifier | P1 | PdfApp.tsx pageMenu extract -> dialogs.tsx 'extract' -> pdfOps.extract |
| PD-222 | Menu contextuel | [Acrobat] Miniature de page : Supprimer les pages | Présent à vérifier | P1 | PdfApp.tsx pageMenu del -> pdfOps.removePages (désactivé si toutes les pages) |
| PD-223 | Menu contextuel | [Acrobat] Miniature de page : Remplacer les pages | Absent | P2 | pdfOps.removePages + insertDocument(autre PDF) enchaînés sous un seul label d.mutate |
| PD-224 | Menu contextuel | [Acrobat] Miniature de page : Rogner les pages | Absent | P2 | pdf-lib page.setCropBox ; dialogue de marges |
| PD-225 | Menu contextuel | [Acrobat] Miniature de page : Numéroter les pages (étiquettes de page) | Absent | P2 | /PageLabels du catalogue (pdf-lib) ; distinct de la numérotation imprimée (stampPages) |
| PD-226 | Menu contextuel | [Acrobat] Miniature de page : Copier / Couper / Coller des pages, Dupliquer | Absent | P2 | Garder les indices copiés ; coller = insertDocument(extract(bytes, indices), at) |
| PD-227 | Menu contextuel | [Acrobat] Miniature de page : Imprimer les pages sélectionnées | Absent | P2 | print() (PdfApp.tsx) sur pdfOps.extract(bytes, pagesSel()) |
| PD-228 | Menu contextuel | [Acrobat] Miniature de page : Propriétés de la page | Absent | P3 | Taille, rotation, boîtes ; lecture par geomOf (geom.ts) |
| PD-229 | Menu contextuel | [Acrobat] Miniatures : Réduire / agrandir les miniatures, Tout sélectionner, pages paires/impaires | Absent | P2 | Taille fixée à 130 px dans Sidebar.tsx Thumb ; ajouter curseur de taille et menu de sélection |
| PD-230 | Menu contextuel | [Acrobat] Signet : Aller à, Renommer, Supprimer (menu contextuel du volet) | Absent | P2 | Actions présentes en boutons (Sidebar.tsx Bookmarks : renommer, monter, descendre, supprimer) mais pas en menu contextuel |
| PD-231 | Menu contextuel | [Acrobat] Signet : Propriétés (gras, italique, couleur, action) | Absent | P3 | outlines.ts writeOutline n'écrit ni /F ni /C ; ajouter style au type Bookmark |
| PD-232 | Menu contextuel | [Acrobat] Signet : Définir la destination (vue courante) | Absent | P2 | writeOutline écrit toujours Dest [page, Fit] ; mémoriser /XYZ de la vue et la reporter |
| PD-233 | Menu contextuel | [Acrobat] Signet : Couper / Coller / glisser-déposer pour réorganiser | Partiel | P2 | Monter/descendre parmi les frères seulement (outlines.ts moveBookmark) ; pas de re-parentage ni glisser |
| PD-234 | Menu contextuel | [Acrobat] Signet : Développer / réduire les enfants, Imprimer les pages du signet | Absent | P3 | Arbre toujours déployé (Sidebar.tsx Tree aria-expanded=true) |
| PD-235 | Menu contextuel | [Acrobat] Champ de formulaire (préparation) : Propriétés | Absent | P1 | Aucune boîte Propriétés ; seul le nom automatique (uniqueFieldName) et l'info-bulle du champ. Voir section Formulaire |
| PD-236 | Menu contextuel | [Acrobat] Champ de formulaire : Dupliquer, Copier plusieurs fois, Aligner, Centrer, Distribuer | Absent | P2 | Item 'field' déplaçable (itemview.tsx) sans copie ; aligner = calcul sur Rect |
| PD-237 | Menu contextuel | [Acrobat] Champ de formulaire : Définir comme défaut, Verrouiller, Ordre de tabulation | Absent | P3 | Pas de /Ff verrouillé ni /Tabs ; voir Formulaire |
| PD-238 | Menu contextuel | [Acrobat] Champ de formulaire (remplissage) : Effacer le champ, Copier, Coller | Absent | P3 | d.setValue(nom, '') depuis un menu sur le champ (PageView.tsx) |
| PD-239 | Menu contextuel | [Acrobat] Lien : Propriétés du lien (apparence, action), Supprimer le lien | Absent | P2 | Liens lus en lecture seule (extras.ts pageLinks) ; pas d'édition de /Annots Link |
| PD-240 | Menu contextuel | [Edge] Lien : Ouvrir le lien, Copier l'adresse du lien | Partiel | P2 | Clic sur lien : navigation interne ou LinkDialog de confirmation puis window.open (PdfApp.tsx onLink, links.ts safeUrl) ; pas de Copier l'adresse |
| PD-241 | Menu contextuel | [Acrobat] Image : Copier l'image, Enregistrer l'image sous, Modifier l'image | Absent | P2 | Images non sélectionnables ; natif extraire_images (pdf/images.rs) disponible mais non exposé |
| PD-242 | Menu contextuel | [Edge] Image : Obtenir une description de l'image, Enregistrer l'image | Absent | P3 | Voir [Edge] Obtenir des descriptions d'images |
| PD-243 | Menu contextuel | [Acrobat] Signature (champ signé) : Valider la signature | Partiel | P1 | Validation automatique à l'ouverture (useDoc.ts verifySignatures) et volet Signatures ; pas de bouton Valider par signature |
| PD-244 | Menu contextuel | [Acrobat] Signature : Afficher les propriétés (certificat, chaîne, détails) | Partiel | P1 | SidePanels.tsx SignaturesPanel (signataire, émetteur, date, motif, lieu, avertissements) ; pas de visionneuse de certificat |
| PD-245 | Menu contextuel | [Acrobat] Signature : Effacer la signature / Afficher la version signée | Absent | P2 | Signature réécrite en entier (sign/pdfsign.ts) : pas de révision antérieure. Passer à une mise à jour incrémentale permettrait les deux |
| PD-246 | Menu contextuel | [Acrobat] Champ de signature vide : Signer ici (certificat ou visuelle) | Partiel | P1 | PageView.tsx bouton pdf-sigfield -> onSignField : signature visuelle seulement, pas de signature numérique dans le champ existant |
| PD-247 | Menu contextuel | [Acrobat] Commentaire du volet : Répondre, Définir l'état, Supprimer | Partiel | P1 | SidePanels.tsx CommentsPanel : clic = aller à, bouton Supprimer ; ni réponse ni état |
| PD-248 | Menu contextuel | [Acrobat] Commentaire du volet : Copier le texte, Aller à l'annotation | Partiel | P3 | Aller à par clic (onItem -> goTo) ; pas de menu |
## 5. Formulaires : remplissage, création de champs, propriétés, import/export, XFA et JavaScript

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-249 | Formulaire | [Acrobat] Remplir un champ de texte (simple) et enregistrer | OK | P1 | packages/pdf/src/PageView.tsx input.pdf-field ; forms.ts writeValues (setText, NeedAppearances) ; packages/pdf/tests/annots.test.ts ; Preuve OK : parcours du STATUS.md (saisie d'un champ) et packages/pdf/tests/annots.test.ts |
| PD-250 | Formulaire | [Acrobat] Remplir une zone de texte multiligne | Présent à vérifier | P1 | PageView.tsx textarea.pdf-field (f.multiline) ; forms.ts readFields isMultiline |
| PD-251 | Formulaire | [Acrobat] Cocher / décocher une case | Présent à vérifier | P1 | PageView.tsx input checkbox ; forms.ts writeValues check/uncheck |
| PD-252 | Formulaire | [Acrobat] Choisir un bouton radio dans un groupe (valeurs d'export lues) | Présent à vérifier | P1 | PageView.tsx input radio ; forms.ts radioOption (index /Opt ou valeur On) |
| PD-253 | Formulaire | [Acrobat] Liste déroulante et zone de liste : choix d'une valeur | Partiel | P1 | PageView.tsx un seul select pour les deux ; forms.ts regroupe PDFDropdown et PDFOptionList en 'liste' ; ni sélection multiple ni valeur libre d'une liste modifiable |
| PD-254 | Formulaire | [Acrobat] Champs en lecture seule respectés | Présent à vérifier | P2 | PageView.tsx disabled={f.readOnly} ; forms.ts readOnly |
| PD-255 | Formulaire | [Acrobat] Champs obligatoires mis en évidence avant enregistrement | Absent | P2 | Lire le bit Required (Ff bit 2) via pdf-lib acroField.hasFlag, liseré rouge et message |
| PD-256 | Formulaire | [Acrobat] Mettre en évidence les champs de formulaire (bascule) | Partiel | P3 | CSS .pdf-field toujours teinté (Pdf.css) ; pas de bascule, ruban Remplir/Afficher les champs |
| PD-257 | Formulaire | [Acrobat] Boutons de formulaire (Soumettre, Réinitialiser, Imprimer, Action) | Absent | P2 | forms.ts type 'autre' ignoré, PageView.tsx ne rend rien ; afficher le bouton (PDFButton) et exécuter Réinitialiser/Imprimer, jamais Soumettre sans confirmation |
| PD-258 | Formulaire | [Acrobat] Champ de signature : cliquer pour signer | Partiel | P1 | PageView.tsx pdf-sigfield -> dialogs.tsx SignaturePad -> dialogActions.ts fitInto : image posée dans le cadre, pas de signature numérique du champ |
| PD-259 | Formulaire | [Acrobat] Effacer le formulaire (réinitialiser toutes les valeurs) | Absent | P2 | d.setValue(nom, valeurParDefaut) en boucle sur d.fields ; commande Remplir > Effacer |
| PD-260 | Formulaire | [Acrobat] Aplatir le formulaire | OK | P2 | ribbon.tsx flatten -> d.flush(true) -> apply.ts form.flatten() ; Preuve OK : packages/pdf/tests/pdf.test.ts (aplatissement) |
| PD-261 | Formulaire | [Acrobat] Caractères hors WinAnsi (cyrillique, grec, CJK) dans les champs | Absent | P2 | forms.ts winAnsi remplace par ? ; embarquer une police Unicode (fontkit) pour les apparences et /DA |
| PD-262 | Formulaire | [Acrobat] Ordre de tabulation à l'ouverture (touche Tab entre les champs) | Partiel | P2 | Ordre du DOM = ordre de getFields() ; /Tabs et l'ordre de /Annots non respectés (PdfApp.tsx fieldsByPage) |
| PD-263 | Formulaire | [Acrobat] Volet Champs de données (liste des champs et valeurs) | Absent | P2 | d.fields (useDoc.ts) contient déjà tout ; ajouter un volet à PANELS (Sidebar.tsx) avec saut à la page du champ |
| PD-264 | Formulaire | [Acrobat] Outils > Préparer un formulaire : détecter automatiquement les champs | Absent | P1 | Aucune détection. Analyser lignes/cases du contenu (getOperatorList) et texte voisin pour nommer ; créer des Item field |
| PD-265 | Formulaire | [Acrobat] Créer un champ de texte | OK | P1 | ribbon.tsx field split -> PageView.tsx finish case 'field' -> apply.ts form.createTextField + addToPage ; Preuve OK : packages/pdf/tests/pdf.test.ts (création de champs) |
| PD-266 | Formulaire | [Acrobat] Créer une zone de texte multiligne | Présent à vérifier | P1 | apply.ts enableMultiline ; strings.ts fields.zone_texte |
| PD-267 | Formulaire | [Acrobat] Créer une case à cocher | Présent à vérifier | P1 | apply.ts form.createCheckBox ; état initial 'oui' |
| PD-268 | Formulaire | [Acrobat] Créer un groupe de boutons radio (valeurs d'export distinctes) | Partiel | P1 | apply.ts createRadioGroup/addOptionToPage mais valeur d'export par défaut identique 'Choix1' (PageView.tsx finish) : deux radios du même nom partagent la valeur. Générer Choix1, Choix2... |
| PD-269 | Formulaire | [Acrobat] Créer une liste déroulante (éléments modifiables) | Partiel | P1 | apply.ts createDropdown avec options ['Option 1','Option 2'] imposées (PageView.tsx) ; aucun éditeur d'éléments |
| PD-270 | Formulaire | [Acrobat] Créer une zone de liste (éléments, sélection multiple) | Partiel | P2 | apply.ts createOptionList, mêmes limites que ci-dessus |
| PD-271 | Formulaire | [Acrobat] Créer un bouton (apparence, action) | Absent | P2 | pdf-lib form.createButton + widget MK ; actions limitées à Réinitialiser/Imprimer/Aller à |
| PD-272 | Formulaire | [Acrobat] Créer un champ de signature numérique | Absent | P1 | pdf-lib n'a pas createSignature : écrire le dictionnaire /FT /Sig + widget à la main (sign/pdfsign.ts le fait déjà pour la signature) |
| PD-273 | Formulaire | [Acrobat] Créer un champ de date (sélecteur) | Absent | P2 | Champ texte + /AA format AFDate ; sélecteur HTML côté remplissage |
| PD-274 | Formulaire | [Acrobat] Créer un champ code-barres (QR, Code 128) | Absent | P3 | Rendu direct d'un code-barres statique (bwip-js) en apparence ; le champ dynamique d'Acrobat exige JavaScript |
| PD-275 | Formulaire | [Acrobat] Créer un champ image (bouton avec icône) | Absent | P3 | Bouton /MK /I + embedPng |
| PD-276 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Général (nom, info-bulle, visibilité, orientation, lecture seule, obligatoire) | Absent | P1 | Nom automatique par uniqueFieldName (model.ts), non modifiable ; boîte Propriétés à écrire (Dialog + patch de l'Item field) |
| PD-277 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Apparence (bordure, remplissage, police, taille, couleur) | Absent | P1 | Item field sans style (model.ts) ; pdf-lib setBorderColor/setBackgroundColor/updateAppearances |
| PD-278 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Options (valeur par défaut, longueur max, peigne, mot de passe, défilement, éléments, valeurs d'export) | Absent | P1 | Item.options/value existent mais sans interface ; pdf-lib setMaxLength, enableCombing, enablePassword |
| PD-279 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Actions (souris, focus, aller à la page, ouvrir un lien, soumettre) | Absent | P3 | Écrire /AA /A (GoTo, URI) ; jamais de JavaScript |
| PD-280 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Format (nombre, pourcentage, date, heure, code postal, téléphone) | Absent | P2 | Posé par JavaScript AFNumber_Format ; ForgeOffice n'exécute jamais de JS (strings.ts notices.javascript). Implémenter un sous-ensemble déclaratif évalué en TypeScript |
| PD-281 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Validation (plage de valeurs, script) | Absent | P3 | Même sous-ensemble déclaratif que Format |
| PD-282 | Formulaire | [Acrobat] Propriétés d'un champ : onglet Calcul (somme, produit, moyenne, min, max, notation simplifiée) | Absent | P2 | Moteur de calcul TypeScript sur d.fields (somme/produit/moyenne) exécuté à la saisie ; ordre de calcul /CO |
| PD-283 | Formulaire | [Acrobat] JavaScript de formulaire (exécution des scripts du document) | Absent | P3 | Décision de sécurité : jamais exécuté (forms.ts inspectFlags, avis dans PdfApp.tsx). À maintenir ; lecture seule des scripts envisageable |
| PD-284 | Formulaire | [Acrobat] Détecter le JavaScript et avertir l'utilisateur | OK | P2 | forms.ts inspectFlags/hasScript ; PdfApp.tsx notices ; packages/pdf/tests/annots.test.ts (XFA et JavaScript détectés) ; Preuve OK : packages/pdf/tests/annots.test.ts (XFA et JavaScript détectés) |
| PD-285 | Formulaire | [Acrobat] Modifier un champ déjà présent dans le fichier (déplacer, redimensionner) | Absent | P1 | Seuls les champs ajoutés dans la session sont des Item éditables (itemview.tsx 'field') ; les widgets existants (forms.ts readFields) sont fixes. Ajouter annotEdits pour les widgets |
| PD-286 | Formulaire | [Acrobat] Supprimer ou renommer un champ existant | Absent | P1 | pdf-lib form.removeField(field) et field.acroField.setPartialName ; commande dans le menu du champ |
| PD-287 | Formulaire | [Acrobat] Aligner, centrer, distribuer et grille d'aimantation des champs | Absent | P3 | Calcul sur Rect des Item field sélectionnés (sélection multiple requise) |
| PD-288 | Formulaire | [Acrobat] Ordre de tabulation à définir (rangée, colonne, structure) | Absent | P2 | Écrire /Tabs /R /C /S par page (pdf-lib) ; réordonner /Annots |
| PD-289 | Formulaire | [Acrobat] Exporter les données du formulaire (FDF, XFDF, XML, CSV, JSON) | Absent | P2 | d.fields (useDoc.ts) -> sérialisation ; saveBytes (PdfApp.tsx) |
| PD-290 | Formulaire | [Acrobat] Importer des données dans le formulaire (FDF, XFDF, CSV) | Absent | P2 | Parser puis d.setValue(nom, valeur) pour chaque champ connu |
| PD-291 | Formulaire | [Acrobat] Collecter les données de plusieurs formulaires remplis (tableur) | Absent | P3 | Boucle sur des fichiers, readFields (forms.ts), agrégation CSV |
| PD-292 | Formulaire | [Acrobat] Formulaires XFA : détection et avertissement | OK | P2 | forms.ts inspectFlags (xfa) ; PdfApp.tsx notice S.notices.xfa ; Preuve OK : packages/pdf/tests/annots.test.ts |
| PD-293 | Formulaire | [Acrobat] Formulaires XFA dynamiques : affichage et remplissage | Absent | P3 | pdf.js a un rendu XFA expérimental (option enableXfa de getDocument, désactivée : enableXfa: false dans packages/convert/src/pdfjs.ts openPdf) |
| PD-294 | Formulaire | [Acrobat] Soumission de formulaire par e-mail ou HTTP | Absent | P3 | Remplacer par export de données ; jamais d'envoi automatique (sécurité) |
| PD-295 | Formulaire | [Acrobat] Saisie semi-automatique des champs (AutoComplete) et valeurs enregistrées | Absent | P3 | Stocker des valeurs par nom de champ dans settings ; datalist HTML |
| PD-296 | Formulaire | [Acrobat] Texte enrichi dans un champ (gras, couleur, RV) | Absent | P3 | Champs /RV XFA-like : lecture seule via pdf.js ; écriture non prévue |
| PD-297 | Formulaire | [Acrobat] Créer un formulaire depuis un document existant (Word, Excel, numérisation) | Absent | P3 | Chaîne : Créer un PDF -> OCR -> détection de champs |
## 6. Signatures visuelles, signatures numériques (PKCS#12 / CMS), certificats et vérification

Constat code : le dossier packages/pdf/src/sign/ existe et signe réellement (adbe.pkcs7.detached, RSA et ECDSA, WebCrypto) ; le STATUS.md ne le mentionne pas. Limite structurelle : le fichier est réécrit en entier à la signature, pas de mise à jour incrémentale.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-298 | Signature | [Acrobat] Signature visuelle dessinée à la souris, au doigt ou au stylet | OK | P1 | packages/pdf/src/dialogs.tsx SignaturePad (canvas 600x200, PNG transparent) ; ribbon.tsx signature / sign-visual ; Preuve OK : parcours du STATUS.md (signature dessinée) |
| PD-299 | Signature | [Acrobat] Signature visuelle tapée (nom en écriture manuscrite) | Présent à vérifier | P1 | dialogs.tsx SignaturePad mode 'type' (police Segoe Script / Brush Script) |
| PD-300 | Signature | [Edge] Signature visuelle depuis une image importée (PNG, JPEG) | Absent | P1 | Ajouter un bouton Image au SignaturePad : File -> createImageBitmap -> canvas -> PNG |
| PD-301 | Signature | [Acrobat] Signature visuelle depuis la caméra | Absent | P3 | getUserMedia + détourage par seuil de luminance |
| PD-302 | Signature | [Acrobat] Signatures enregistrées (créées une fois, réutilisées, plusieurs) | Absent | P1 | opts.signature (PdfApp.tsx) vit en mémoire, perdue à la fermeture. Persister les PNG dans services.settings ou un coffre local (chiffré) |
| PD-303 | Signature | [Acrobat] Style de signature : polices manuscrites, couleur, épaisseur du trait | Partiel | P2 | Une police et un bleu fixe #1b2a6b (dialogs.tsx) ; ajouter sélecteur de police/couleur |
| PD-304 | Signature | [Acrobat] Pose, déplacement et redimensionnement de la signature sur la page | Présent à vérifier | P1 | PageView.tsx finish case 'signature' ; itemview.tsx 'signature' + resizeItem ; apply.ts drawSignature (dessin dans le contenu) |
| PD-305 | Signature | [Acrobat] Signature visuelle posée droite sur une page pivotée | Présent à vérifier | P2 | appearance.ts drawSignature (rotation d après screenFrame) ; la page pivotée est testée pour la signature numérique visible (sign.test.ts), pas pour cette image |
| PD-306 | Signature | [Acrobat] Date et nom automatiques sous la signature visuelle | Absent | P2 | Composer l'image avec une ligne de texte datée (canvas) à la pose |
| PD-307 | Signature | [Acrobat] Signature visuelle placée dans un champ de signature du formulaire | Présent à vérifier | P2 | PageView.tsx onSignField -> dialogActions.ts fitInto (proportions conservées) |
| PD-308 | Signature | [Acrobat] Signature numérique avec certificat .pfx / .p12 (invisible ou visible) | OK | P1 | packages/pdf/src/sign/pdfsign.ts signPdf ; dialogs-sign.tsx DigitalSignDialog ; packages/pdf/tests/sign.test.ts ; Preuve OK : packages/pdf/tests/sign.test.ts |
| PD-309 | Signature | [Acrobat] Clés RSA (SHA-256) et ECDSA P-256 / P-384 / P-521 | OK | P1 | sign/cms.ts keyKind/buildSignedData (WebCrypto) ; tests sign.test.ts RSA et ECDSA ; Preuve OK : packages/pdf/tests/sign.test.ts (RSA et ECDSA) |
| PD-310 | Signature | [Acrobat] Lecture de PKCS#12 modernes (PBES2 PBKDF2 + AES) et classiques (3DES) | OK | P1 | sign/pkcs12.ts parsePkcs12 + sign/des.ts des3CbcDecrypt ; tests sign.test.ts ; mauvais mot de passe refusé ; Preuve OK : packages/pdf/tests/sign.test.ts |
| PD-311 | Signature | [Acrobat] PKCS#12 anciens chiffrés en RC2-40 | Absent | P3 | Refusé avec message (pkcs12.ts). Implémenter RC2 en TypeScript ou conseiller la conversion openssl |
| PD-312 | Signature | [Acrobat] Utiliser un certificat du magasin Windows / trousseau macOS | Absent | P1 | Aucun accès au magasin. Natif : crate windows (NCrypt/CAPI) ou security-framework, signature déléguée côté Rust ; PKCS#12 reste le seul chemin |
| PD-313 | Signature | [Acrobat] Jeton USB ou carte à puce (PKCS#11, CNG) | Absent | P2 | Natif uniquement : cryptoki (PKCS#11) ou CNG ; le hash CMS reste calculé en TypeScript |
| PD-314 | Signature | [Acrobat] Créer une identité numérique auto-signée | Absent | P2 | Générer clé WebCrypto + certificat X.509 (der.ts écrit déjà DER) puis exporter en PKCS#12 |
| PD-315 | Signature | [Acrobat] Position de la signature visible choisie par rectangle sur la page | Absent | P1 | dialogActions.ts digitalSign fixe rect {x 0.52, y 0.9, w 0.42, h 0.07} sur la page courante. Réutiliser le tracé de signTarget (champ) pour dessiner le cadre |
| PD-316 | Signature | [Acrobat] Apparence de la signature : texte (nom, date, motif, lieu), logo, graphique | Partiel | P2 | sign/pdfsign.ts apparence texte Helvetica bordée de bleu ; pas de logo ni de modèles d'apparence |
| PD-317 | Signature | [Acrobat] Motif et lieu de la signature | Présent à vérifier | P2 | DigitalSignDialog (reason, location) -> /Reason /Location dans le dictionnaire /Sig |
| PD-318 | Signature | [Acrobat] Coordonnées du signataire (ContactInfo) | Absent | P3 | Ajouter /ContactInfo dans pdfsign.ts |
| PD-319 | Signature | [Acrobat] Format PAdES (ETSI.CAdES.detached, attributs signés ESS) | Absent | P1 | SubFilter adbe.pkcs7.detached uniquement (pdfsign.ts). Passer à ETSI.CAdES.detached : signing-certificate-v2 déjà ajouté (cms.ts OID.signingCertV2), ajouter le SubFilter et valider |
| PD-320 | Signature | [Acrobat] Horodatage de la signature (serveur RFC 3161) | Absent | P1 | Aucun appel TSA. Après le CMS, requête TimeStampReq (SHA-256 de la signature) vers une TSA configurable, ajouter l'attribut non signé id-aa-timeStampToken (cms.ts) ; réseau via natif |
| PD-321 | Signature | [Acrobat] Validation à long terme (LTV : DSS, OCSP, CRL embarqués) | Absent | P2 | Ajouter /DSS au catalogue avec certificats et réponses OCSP/CRL récupérés par le natif (reqwest) ; signature de document timestamp |
| PD-322 | Signature | [Acrobat] Signature de certification (DocMDP : aucun changement, remplissage, annotations) | Absent | P2 | Ajouter /Reference [<</TransformMethod /DocMDP /TransformParams <</P n>>>>] et /Perms /DocMDP au catalogue dans signPdf |
| PD-323 | Signature | [Acrobat] Signatures multiples sans invalider les précédentes (mise à jour incrémentale) | Absent | P1 | signPdf réécrit tout le fichier (en-tête de sign/pdfsign.ts, avertissement S.sign.replaceWarn). Écrire une section incrémentale (append) avec nouveau /AcroForm et signature ; lopdf natif ou writer maison |
| PD-324 | Signature | [Acrobat] Signer dans un champ de signature existant du formulaire | Absent | P1 | pdfsign.ts crée toujours un nouveau champ (noms pris évités). Cibler un champ vide : lui ajouter /V |
| PD-325 | Signature | [Acrobat] Signer plusieurs fichiers d'un coup | Absent | P3 | Boucle de signPdf (sign/pdfsign.ts) dans un pipeline de lots (voir PD-A06) |
| PD-326 | Signature | [Acrobat] Avertir qu'enregistrer après signature la rend invalide | Partiel | P2 | strings.ts sign.rewrite et replaceWarn ; pas de blocage de modifications après signature |
| PD-327 | Signature | [Acrobat] Vérifier l'intégrité (/ByteRange et empreinte) | OK | P1 | sign/verify.ts verifySignatures ; useDoc.ts déclenche si /ByteRange présent ; packages/pdf/tests/sign.test.ts (altération détectée) ; Preuve OK : packages/pdf/tests/sign.test.ts (altération détectée) |
| PD-328 | Signature | [Acrobat] Vérifier la signature cryptographique (RSA PKCS#1 v1.5, ECDSA) | OK | P1 | sign/cms.ts verifyCryptoSignature ; RSASSA-PSS non géré (avertissement unsupported) ; Preuve OK : packages/pdf/tests/sign.test.ts |
| PD-329 | Signature | [Acrobat] Signer avec RSASSA-PSS ou vérifier une signature PSS | Absent | P3 | cms.ts refuse sigOid 1.2.840.113549.1.1.10 ; ajouter RSA-PSS à WebCrypto (saltLength) |
| PD-330 | Signature | [Acrobat] Détecter les données ajoutées après la signature | Présent à vérifier | P1 | verify.ts avertissement afterSigning ; strings.ts sign.warnings |
| PD-331 | Signature | [Acrobat] Valider la période de validité du certificat à la date de signature | Présent à vérifier | P2 | verify.ts expired/notYetValid |
| PD-332 | Signature | [Acrobat] Valider la chaîne de certification contre des autorités de confiance (AATL, EUTL, Windows) | Absent | P1 | verify.ts émet toujours l'avertissement chain (aucun magasin de confiance). Natif : racines du système (rustls-native-certs) + liste EUTL, construction de chemin |
| PD-333 | Signature | [Acrobat] Vérification de révocation (OCSP, CRL) | Absent | P2 | Requêtes réseau via le natif ; mise en cache ; résultat dans SignatureReport |
| PD-334 | Signature | [Acrobat] Vérification de l'horodatage de la signature | Absent | P2 | Dépend de l'horodatage ; parser l'attribut non signé timeStampToken (cms.ts parseSignedData) |
| PD-335 | Signature | [Acrobat] Visionneuse de certificat (sujet, émetteur, empreinte, usages, validité) | Partiel | P2 | SidePanels.tsx SignaturesPanel affiche signataire, émetteur, date ; cms.ts parseCert détient plus (spki, dates) mais pas affiché |
| PD-336 | Signature | [Acrobat] Ajouter un certificat aux identités approuvées / gérer les identités | Absent | P2 | Stockage local de certificats approuvés (settings) et prise en compte dans la validation de chaîne |
| PD-337 | Signature | [Acrobat] Panneau Signatures : liste des signatures avec état valide / invalide / inconnu | Présent à vérifier | P1 | SidePanels.tsx SignaturesPanel ; bandeau PdfApp.tsx notices (badSignature) |
| PD-338 | Signature | [Acrobat] Valider toutes les signatures à l'ouverture | Présent à vérifier | P1 | useDoc.ts effet : verifySignatures(bytes) si marqueur /ByteRange |
| PD-339 | Signature | [Acrobat] Interopérabilité : signature relue par OpenSSL et pdf.js | OK | P2 | packages/pdf/tests/sign.test.ts contrôle croisé OpenSSL cms -verify ; Preuve OK : packages/pdf/tests/sign.test.ts (OpenSSL cms -verify) |
| PD-340 | Signature | [Acrobat] Effacer la signature d'un champ (si autorisé) | Absent | P2 | Retirer /V du champ de signature (pdf-lib) ; interdit si DocMDP ou signatures suivantes |
| PD-341 | Signature | [Acrobat] Demander des signatures à des tiers (ordre, rappels) | Absent | P2 | Voir Outils > Envoyer pour signature ; prérequis : champs de signature et PDF prêt |
## 7. Organisation des pages : miniatures, réordonner, extraire, insérer, remplacer, diviser, rogner, numéroter, filigrane, arrière-plan

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-342 | Page/Organisation | [Acrobat] Volet Pages : miniatures de toutes les pages, rendu à la demande, page courante repérée | OK | P1 | packages/pdf/src/Sidebar.tsx Thumb (IntersectionObserver, rendu pdf.js) ; classe is-current + scrollIntoView ; Preuve OK : parcours du STATUS.md (miniatures) |
| PD-343 | Page/Organisation | [Acrobat] Sélection de pages : clic, Ctrl+clic, Maj+clic | Présent à vérifier | P1 | Sidebar.tsx onClick (Set<number>) ; PdfApp.tsx selectedPages / pagesSel |
| PD-344 | Page/Organisation | [Acrobat] Réordonner par glisser-déposer des miniatures (souris, doigt et stylet par poignée) | Présent à vérifier | P1 | Sidebar.tsx down/move/up (seuil 6 px, pdf-thumb__grip) ; PdfApp.tsx onMovePage -> pdfOps.reorder |
| PD-345 | Page/Organisation | [Acrobat] Réordonner plusieurs pages sélectionnées d'un seul glisser | Absent | P2 | onMovePage ne déplace qu'une page (from -> to). Déplacer le bloc sélectionné en conservant l'ordre relatif (model.ts moveIndex à étendre) |
| PD-346 | Page/Organisation | [Acrobat] Pivoter les pages sélectionnées de 90 degrés (fichier modifié) | OK | P1 | ribbon.tsx rot-left-p/rot-right-p ; pdf-ops.ts rotate (tient compte du /Rotate existant) ; Preuve OK : parcours du STATUS.md (rotation de page) et packages/convert/tests/convert.test.ts |
| PD-347 | Page/Organisation | [Acrobat] Supprimer les pages sélectionnées (au moins une page conservée) | OK | P1 | ribbon.tsx delete-p ; pdf-ops.ts removePages (erreur si toutes) ; Preuve OK : packages/convert/tests/convert.test.ts (suppression, au moins une page) |
| PD-348 | Page/Organisation | [Acrobat] Extraire des pages vers un nouveau fichier (plage libre) | OK | P1 | dialogs.tsx 'extract' ; dialogActions.ts pdfOps.parsePageRange + pdfOps.extract -> saveBytes ; Preuve OK : packages/convert/tests/convert.test.ts (extraction, sélection de pages) |
| PD-349 | Page/Organisation | [Acrobat] Extraire : supprimer les pages extraites du document / extraire comme pages séparées | Absent | P2 | Ajouter deux cases à la boîte extract : enchaîner removePages ou pdfOps.split(chunks(…, 1)) |
| PD-350 | Page/Organisation | [Acrobat] Insérer une page vierge (avant/après, taille, nombre) | Partiel | P2 | pdf-ops.ts insertBlank(bytes, at) : une page de la taille de la voisine, toujours après la page courante ; pas de dialogue (taille, nombre, avant) |
| PD-351 | Page/Organisation | [Acrobat] Insérer les pages d'un autre PDF (avant/après, page ou plage de la source) | Partiel | P1 | PdfApp.tsx actions.insertFile : tout le fichier choisi, toujours après la page courante ; pas de choix de position ni de plage |
| PD-352 | Page/Organisation | [Acrobat] Remplacer des pages par celles d'un autre PDF | Absent | P2 | Enchaîner removePages et insertDocument(autre, at) dans un seul d.mutate (une entrée d'historique) |
| PD-353 | Page/Organisation | [Acrobat] Diviser le document : une page par fichier | OK | P1 | dialogs.tsx 'split' mode each ; dialogActions.ts pdfOps.split + zip (JSZip) ; Preuve OK : packages/convert/tests/convert.test.ts (extraction, chunks) |
| PD-354 | Page/Organisation | [Acrobat] Diviser le document : toutes les N pages | OK | P1 | dialogs.tsx mode every ; pdf-ops.ts chunks(total, n) ; Preuve OK : packages/convert/tests/convert.test.ts (chunks) |
| PD-355 | Page/Organisation | [Acrobat] Diviser le document : selon des plages libres | Présent à vérifier | P2 | dialogs.tsx mode ranges (séparées par une barre verticale) ; pdfOps.parsePageRange par plage |
| PD-356 | Page/Organisation | [Acrobat] Diviser par taille maximale de fichier | Absent | P2 | Estimer par extraction progressive : ajouter des pages tant que extract(…).length < limite ; pdfOps.extract répété |
| PD-357 | Page/Organisation | [Acrobat] Diviser par signets de premier niveau | Absent | P2 | useExtras.ts outline donne page de chaque signet ; chunks entre pages successives |
| PD-358 | Page/Organisation | [Acrobat] Nommer les fichiers issus de la division (préfixe, dossier de sortie) | Partiel | P3 | Noms fixes nom-1.pdf dans un ZIP (dialogActions.ts split) ; le natif Decouper accepte noms mais n'est pas utilisé par ce chemin |
| PD-359 | Page/Organisation | [Acrobat] Rogner les pages (marges, valeurs, appliquer à plusieurs pages, supprimer les blancs) | Absent | P2 | geomOf (geom.ts) lit la CropBox ; pdf-lib page.setCropBox(x,y,w,h) ; dialogue avec aperçu et plage |
| PD-360 | Page/Organisation | [Acrobat] Redimensionner / changer le format des pages (A4, Lettre, échelle) | Absent | P3 | Embarquer la page (embedPage) dans une page de la taille cible avec matrice d'échelle |
| PD-361 | Page/Organisation | [Acrobat] Étiquettes de page (i, ii, 1, 2, A-1) | Absent | P2 | /PageLabels (arbre de nombres) dans le catalogue via pdf-lib ; afficher l'étiquette dans la miniature et la barre d'état |
| PD-362 | Page/Organisation | [Acrobat] Boîtes de page : MediaBox, CropBox, TrimBox, BleedBox, ArtBox (affichage, édition) | Absent | P3 | Seule la CropBox visible est exploitée (geom.ts) ; dialogue des cinq boîtes |
| PD-363 | Page/Organisation | [Acrobat] Duplication d'une page (copier plusieurs fois la même page) | Absent | P3 | pdfOps.extract accepte les doublons mais parsePageRange (pdf-ops.ts) les supprime ; ajouter commande Dupliquer qui construit l'ordre |
| PD-364 | Page/Organisation | [Acrobat] Imposition en brochure / mosaïque / affiche à l'impression | Absent | P3 | Embarquer deux pages source par page feuille (embedPages, matrices) ; impression en brochure |
| PD-365 | Édition | [Acrobat] Numérotation des pages / Bates : modèle avec {page} et {total} | OK | P1 | dialogs.tsx 'numbering' ; pdf-ops.ts fillTemplate/stampPages (haut, bas, gauche, centre, droite) ; Preuve OK : packages/convert/tests/convert.test.ts (gabarit, position, numérotation) |
| PD-366 | Édition | [Acrobat] Bates : premier numéro, zéros de remplissage, préfixe et suffixe | OK | P1 | NumberField start/digits (dialogs.tsx) ; template préfixe-{page} (pdf-ops.ts fillTemplate padStart) ; Preuve OK : packages/convert/tests/convert.test.ts (fillTemplate avec zéros de tête) |
| PD-367 | Édition | [Acrobat] Numérotation : plage de pages concernées | Présent à vérifier | P2 | dialogs.tsx pages ; dialogActions.ts pagesOf -> pdfOps.parsePageRange |
| PD-368 | Édition | [Acrobat] Numérotation : police, couleur, marges asymétriques, aperçu | Partiel | P3 | Helvetica noire, marge unique (pdf-ops.ts stampPages) ; taille et marge réglables, pas de police ni couleur |
| PD-369 | Édition | [Acrobat] Numérotation Bates continue sur plusieurs fichiers | Absent | P2 | stampPages accepte start ; un lot doit chaîner start = fin du précédent (voir PD-A06) |
| PD-370 | Édition | [Acrobat] Variables supplémentaires : date, nom du fichier, auteur | Absent | P2 | fillTemplate ne remplace que {page} et {total} (pdf-ops.ts) ; ajouter {date} {fichier} {titre} |
| PD-371 | Édition | [Acrobat] En-tête et pied de page : texte à gauche, au centre et à droite | Partiel | P2 | dialogActions.ts headerFooter : un en-tête centré et un pied centré seulement ; stampPages sait gauche/droite |
| PD-372 | Édition | [Acrobat] En-tête et pied de page : pages paires/impaires, plages, police, couleur, marges | Absent | P3 | Options de PageTextOptions (pages) non exposées dans le dialogue 'headerFooter' |
| PD-373 | Édition | [Acrobat] Supprimer ou mettre à jour un en-tête, un pied de page ou un filigrane existant | Absent | P2 | Le texte est posé dans le flux de contenu sans marqueur ; écrire en contenu balisé (OC calque) pour le retrouver |
| PD-374 | Édition | [Acrobat] Filigrane texte : texte, taille, opacité, angle, pages | Présent à vérifier | P1 | dialogs.tsx 'watermark' ; pdf-ops.ts watermark (drawText, rotation, opacité) |
| PD-375 | Édition | [Acrobat] Filigrane : couleur, police, position, décalage | Absent | P2 | Gris 0,5 et Helvetica-Bold fixes (dialogActions.ts / pdf-ops.ts), centré ; ajouter color/position |
| PD-376 | Édition | [Acrobat] Filigrane image ou PDF, placé derrière le contenu | Absent | P2 | Dessiner avant le contenu existant (insertion en tête de /Contents) et embedPng/embedPage |
| PD-377 | Édition | [Acrobat] Arrière-plan : couleur, image ou page, opacité | Absent | P2 | Rectangle plein ou image dessiné avant le contenu de chaque page (pdf-lib) |
| PD-378 | Édition | [Acrobat] Aplatir les calques (fusionner) ou supprimer des calques | Absent | P3 | Retirer /OCProperties et les marqueurs /OC du contenu ; pdf.js getOptionalContentConfig sert déjà à la lecture |
## 8. Édition du contenu, liens, signets, pièces jointes, calques, métadonnées

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-379 | Édition | [Acrobat] Modifier le texte existant : cliquer une ligne et la remplacer | Partiel | P1 | ribbon.tsx tool-edittext ; PageView.tsx boutons .pdf-textbox (une boîte pdf.js = un segment) + textarea ; pdfdoc.ts commitPending -> natif corriger_texte retire l'ancien texte (crates/forge-convert/src/pdf/caviardage.rs corriger) |
| PD-380 | Édition | [Acrobat] Modifier le texte : paragraphes entiers avec retour à la ligne automatique | Absent | P2 | Un segment à la fois (textBoxes de pdfdoc.ts) ; regrouper les segments par bloc via position/interligne, recomposer la mise en page |
| PD-381 | Édition | [Acrobat] Modifier le texte : police, taille, couleur, gras, italique, interligne, alignement | Partiel | P2 | Seule la taille d'origine est reprise (TextBox.size, model.ts) ; police Helvetica et couleur noire fixes (apparence coverText / natif police_standard) |
| PD-382 | Édition | [Acrobat] Modifier le texte : caractères hors WinAnsi et polices incorporées | Partiel | P2 | appearance.ts safe() et natif winansi() remplacent par ? ; accents français couverts. Ajouter polices Unicode incorporées (fontkit) |
| PD-383 | Édition | [Acrobat] Modifier le texte sans moteur natif (navigateur) : l'ancien texte est seulement recouvert | Partiel | P2 | appearance.ts coverText (fond blanc + réécriture) ; avertissement S.errors.coverOnly ; le texte d'origine reste extractible : à ne pas utiliser pour supprimer une donnée |
| PD-384 | Édition | [Acrobat] Modifier le texte sur une page pivotée | Présent à vérifier | P2 | appearance.ts coverText (rotate d'après screenFrame) ; natif en_points_rot (crates/forge-convert/src/pdf/mod.rs) |
| PD-385 | Édition | [Acrobat] Ajouter du texte directement dans le contenu de la page (pas une annotation) | Partiel | P1 | tool-freetext ajoute une annotation FreeText ; pas de texte de contenu. Natif : ops_texte + ajouter_contenu (pdf/mod.rs) déjà disponibles, action « texte » à exposer |
| PD-386 | Édition | [Acrobat] Ajouter une image (fichier, presse-papiers) dans la page | Absent | P1 | Aucun Item image. pdf-lib embedPng/embedJpg + drawImage (comme drawSignature dans appearance.ts) ; Item 'image' déplaçable/redimensionnable |
| PD-387 | Édition | [Acrobat] Remplacer, pivoter, retourner, rogner une image existante | Absent | P2 | Sélection des images impossible : lire les XObject Image positionnés (getOperatorList pdf.js) pour produire des boîtes d'édition |
| PD-388 | Édition | [Acrobat] Supprimer une image ou un objet de la page | Absent | P2 | Retirer l'opérateur Do du flux de contenu (natif lopdf) ; le caviardage sait déjà retirer des images (caviardage.rs) |
| PD-389 | Édition | [Acrobat] Extraire / enregistrer les images du PDF | Partiel | P2 | Natif extraire_images (crates/forge-convert/src/pdf/images.rs) existe sans UI ; export du module = pages rendues en PNG (PdfApp.tsx exportAs images) |
| PD-390 | Édition | [Acrobat] Modifier les objets graphiques (chemins, formes vectorielles) | Absent | P3 | Éditeur d'objets hors périmètre ; lecture du flux (pdf/rendu/interprete.rs sait l'interpréter) |
| PD-391 | Édition | [Acrobat] Ajouter ou modifier un lien (rectangle, apparence, action : page, URL, fichier) | Absent | P1 | pageLinks (extras.ts) lit seulement. Tool 'link' : rectangle puis dialogue d'action ; pdf-lib annotation Subtype Link avec /A /URI ou /Dest |
| PD-392 | Édition | [Acrobat] Supprimer un lien / lien invisible ou bordé | Absent | P2 | Retirer l'annotation Link (removeAnnotations de annots.ts accepte une référence) |
| PD-393 | Édition | [Acrobat] Détecter les URL du texte et les rendre cliquables | Absent | P3 | Regex sur textBoxes (pdfdoc.ts) pour créer des zones de lien non persistantes |
| PD-394 | Recherche/Lecture | [Acrobat] Suivre un lien : page interne ou URL (confirmation pour les adresses externes) | Présent à vérifier | P1 | extras.ts pageLinks + PdfApp.tsx onLink + dialogs-sign.tsx LinkDialog ; links.ts safeUrl bloque javascript:, data:, file: |
| PD-395 | Édition | [Acrobat] Signets : créer un signet sur la page affichée, un sous-signet | OK | P1 | Sidebar.tsx Bookmarks (add/addChild) ; outlines.ts addBookmark ; packages/pdf/tests/reading.test.ts ; Preuve OK : packages/pdf/tests/reading.test.ts (signets) |
| PD-396 | Édition | [Acrobat] Signets : renommer (bouton ou double-clic), supprimer, monter, descendre | OK | P1 | Sidebar.tsx rename/remove/moveBookmark ; outlines.ts renameBookmark/removeBookmark/moveBookmark ; Preuve OK : packages/pdf/tests/reading.test.ts (signets) |
| PD-397 | Édition | [Acrobat] Signets : conserver la destination d'origine (zoom, position) et le style lors d'une modification | Partiel | P2 | outlines.ts writeOutline réécrit tout l'arbre avec Dest [page, Fit] et perd position et style (message S.bookmarksEdit.loses) ; conserver /Dest d'origine pour les nœuds non modifiés |
| PD-398 | Édition | [Acrobat] Signets : créer depuis les titres de la table des matières ou les styles | Absent | P3 | Heuristique sur tailles de police des textBoxes (pdfdoc.ts) pour proposer un arbre |
| PD-399 | Édition | [Acrobat] Pièces jointes : consulter la liste et enregistrer un fichier joint | OK | P2 | extras.ts listAttachments/attachmentBytes ; SidePanels.tsx AttachmentsPanel ; PdfApp.tsx saveAttachment ; tests reading.test.ts ; Preuve OK : packages/pdf/tests/reading.test.ts (pièces jointes) |
| PD-400 | Édition | [Acrobat] Pièces jointes : ajouter, supprimer, renommer un fichier joint | Absent | P2 | pdf-lib doc.attach(bytes, nom, options) pour ajouter ; suppression par /Names /EmbeddedFiles |
| PD-401 | Édition | [Acrobat] Pièces jointes : ouvrir directement le fichier joint dans son application | Absent | P3 | Enregistrer en temporaire puis services.openDocument(file) (packages/core/src/types.ts) |
| PD-402 | Édition | [Acrobat] Calques (contenu optionnel) : afficher / masquer | Partiel | P2 | extras.ts listLayers/setLayerVisible + SidePanels.tsx LayersPanel + rendu PageView.tsx optionalContentConfigPromise ; liste plate sans hiérarchie, ordre, verrouillage, ni écriture dans le fichier |
| PD-403 | Édition | [Acrobat] Calques : créer, fusionner, changer les propriétés, enregistrer l'état de visibilité | Absent | P3 | Écrire /OCProperties /D /OFF (pdf-lib) à partir de l'état de config courante |
| PD-404 | Édition | [Acrobat] Métadonnées Info : titre, auteur, sujet, mots-clés, application, producteur | OK | P1 | dialogs.tsx 'metadata' ; pdf-ops.ts writeMetadata (modifie aussi la date de modification) ; Preuve OK : packages/convert/tests/convert.test.ts (métadonnées écrites puis relues) |
| PD-405 | Édition | [Acrobat] Métadonnées XMP (lecture / écriture) | Absent | P3 | /Metadata du catalogue (flux XML) via pdf-lib ; nécessaire à PDF/A et à l'assainissement |
| PD-406 | Édition | [Acrobat] Actions de document et de page (ouverture, fermeture, impression) | Absent | P3 | Voir Propriétés > Vue initiale ; /OpenAction, /AA ; JavaScript exclu par politique |
| PD-407 | Édition | [Acrobat] Texte de remplacement et ordre de lecture (édition de la structure) | Absent | P2 | Voir section Accessibilité ; nécessite l'écriture de /StructTreeRoot |
## 9. Protection, mots de passe, caviardage, assainissement

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-408 | Protection | [Acrobat] Protéger par un mot de passe d'ouverture (AES-256) | OK | P1 | dialogs.tsx 'protect' ; dialogActions.ts natif nativeOp 'chiffrer' sinon pdfOps.encrypt (pdf-ops.ts) ; crates/forge-convert/src/pdf/securite.rs chiffrer (R6) ; tests packages/convert/tests ; Preuve OK : packages/convert/tests/convert.test.ts (AES-256 lu par pdf.js) et crate pdf_outils |
| PD-409 | Protection | [Acrobat] Mot de passe propriétaire (modifier les autorisations) | Présent à vérifier | P1 | dialogs.tsx champ owner (défaut = mot de passe d'ouverture) ; securite.rs Autorisations |
| PD-410 | Protection | [Acrobat] Restreindre l'impression (aucune / basse / haute résolution) | Partiel | P2 | Case Autoriser l'impression : booléen (pdf-ops.ts printing highResolution ou false) ; pas de niveau basse résolution |
| PD-411 | Protection | [Acrobat] Restreindre la copie du contenu | Présent à vérifier | P2 | dialogs.tsx allowCopy -> copying / copier |
| PD-412 | Protection | [Acrobat] Restreindre la modification et l'assemblage de pages | Présent à vérifier | P2 | dialogs.tsx allowEdit -> modifying + documentAssembly (pdf-ops.ts encrypt) |
| PD-413 | Protection | [Acrobat] Restreindre les commentaires / autoriser le remplissage des formulaires | Présent à vérifier | P2 | dialogs.tsx allowAnnot, allowForms -> annotating, fillingForms |
| PD-414 | Protection | [Acrobat] Autoriser l'extraction pour l'accessibilité (lecteurs d'écran) | Absent | P2 | pdf-ops.ts encrypt ne renseigne pas contentAccessibility (à vérifier : un défaut faux bloquerait les lecteurs d'écran) ; ajouter la case et la fixer à vrai par défaut |
| PD-415 | Protection | [Acrobat] Restrictions sans mot de passe d'ouverture (propriétaire seul) | Absent | P2 | dialogs.tsx 'protect' désactive Appliquer si le mot de passe d'ouverture est vide ; permettre user='' avec owner renseigné |
| PD-416 | Protection | [Acrobat] Niveau de chiffrement (AES-256, AES-128, RC4) pour compatibilité | Absent | P3 | AES-256 seulement (securite.rs). Les lecteurs récents suffisent ; option AES-128 dans pdf-lib encrypt si besoin |
| PD-417 | Protection | [Acrobat] Chiffrer avec un certificat (clé publique des destinataires) | Absent | P2 | Enveloppe CMS EnvelopedData par destinataire (/Filter /Adobe.PubSec) ; cms.ts parseCert/der.ts à étendre ; natif recommandé |
| PD-418 | Protection | [Acrobat] Supprimer la protection (mot de passe connu) | OK | P1 | ribbon.tsx unprotect -> useDoc.ts load ; pdf-ops.ts decrypt/unlock ; natif mot_de_passe + actions vides ; Preuve OK : packages/convert/tests/convert.test.ts (unlock) |
| PD-419 | Protection | [Acrobat] Ouvrir un PDF protégé : mot de passe demandé, lecture seule si déchiffrement impossible | Présent à vérifier | P1 | useDoc.ts load (PasswordException, setAskPassword, lockedPassword) ; dialogs.tsx 'password' |
| PD-420 | Protection | [Acrobat] Indicateur de force et gestion des mots de passe | Absent | P3 | Aucun contrôle ; calcul d'entropie simple dans dialogs.tsx 'protect' |
| PD-421 | Protection | [Acrobat] Afficher l'empreinte (SHA-256) du fichier pour vérifier son intégrité | Absent | P2 | crypto.subtle.digest('SHA-256', state.bytes) affiché dans Propriétés (voir PD-A07) |
| PD-422 | Protection | [Acrobat] Droits d'utilisation étendus Reader, gestion des droits (IRM) | Absent | P3 | Hors périmètre (service Adobe) |
| PD-423 | Protection | [Acrobat] Caviarder : marquer une zone rectangulaire | OK | P1 | ribbon.tsx tool-redact ; PageView.tsx finish case 'redact' (Item redact) ; hachures .pdf-redact ; Preuve OK : parcours du STATUS.md (marquage de caviardage) |
| PD-424 | Protection | [Acrobat] Caviarder : appliquer (suppression réelle du texte, des images et des traits sous la zone) | OK | P1 | pdfdoc.ts commitPending -> natif caviarder ; crates/forge-convert/src/pdf/caviardage.rs, traits.rs, decodage.rs ; crates/forge-convert/tests/pdf_caviardage.rs et pdf_caviardage_avance.rs ; Preuve OK : crates/forge-convert/tests/pdf_caviardage.rs et pdf_caviardage_avance.rs |
| PD-425 | Protection | [Acrobat] Caviarder : retirer les annotations et formulaires touchés, purger miniatures, XMP, signets et structure | OK | P1 | crates/forge-convert/src/pdf/purge.rs ; caviardage.rs RapportCaviardage ; Preuve OK : crates/forge-convert/tests/pdf_caviardage_avance.rs (annexes purgées) |
| PD-426 | Protection | [Acrobat] Caviarder : marquer le texte sélectionné (sélection -> zone) | Absent | P1 | Aujourd'hui rectangle à la main (PageView.tsx). Convertir window.getSelection().getClientRects() en Item redact |
| PD-427 | Protection | [Acrobat] Caviarder : rechercher du texte et marquer toutes les occurrences | Absent | P1 | search() de find.ts + hitRect donnent déjà les rectangles ; créer un Item redact par résultat avec confirmation |
| PD-428 | Protection | [Acrobat] Caviarder : motifs prédéfinis (e-mail, téléphone, n° de sécurité sociale, IBAN, carte bancaire, dates) | Absent | P1 | Regex (find.ts compile) sur textBoxes avec validations Luhn/IBAN ; voir idée PD-A04 |
| PD-429 | Protection | [Acrobat] Caviarder : pages entières ou plages de pages | Absent | P2 | Item redact pleine page ; sélection depuis les miniatures |
| PD-430 | Protection | [Acrobat] Caviarder : annuler un marquage avant application | Présent à vérifier | P1 | Sélection puis Suppr ; corbeille flottante ; Annuler (useDoc.ts undo) |
| PD-431 | Protection | [Acrobat] Caviarder : aperçu du résultat avant application | Partiel | P2 | Zones hachurées rouges (Pdf.css .pdf-redact) mais pas de simulation du noir final ni de la liste du texte supprimé |
| PD-432 | Protection | [Acrobat] Caviarder : couleur de remplissage et texte de superposition (code d'exemption) | Absent | P2 | Le natif a caviarder_couleurs (caviardage.rs) mais commitPending (pdfdoc.ts) n'envoie que des zones noires ; ajouter couleur/texte à Item redact |
| PD-433 | Protection | [Acrobat] Caviarder : rapport (nombre de caractères, images, annotations retirés) | Absent | P2 | RapportCaviardage renvoyé par le natif (operation.rs Output::Fichiers caviardage) non exploité : PdfApp.tsx applyRedactions n'affiche qu'un message générique |
| PD-434 | Protection | [Acrobat] Caviarder sans moteur natif : page rastérisée à 200 ppp | Partiel | P2 | pdfdoc.ts rasterRedact + redact.ts rebuildWithRasterPages (nouveau document, métadonnées vidées) ; signets et formulaires perdus (S.errors.rasterRedact) ; packages/pdf/tests/redact.test.ts |
| PD-435 | Protection | [Acrobat] Caviardage correct sur page pivotée ou avec CropBox | OK | P2 | model.ts toNativeZone ; natif Zone::en_points_rot (pdf/mod.rs) ; Preuve OK : crates/forge-convert/tests/pdf_caviardage_avance.rs (rotation, CropBox) |
| PD-436 | Protection | [Acrobat] Supprimer les informations masquées (assainir : métadonnées, commentaires, scripts, pièces jointes, calques, signets, texte masqué) | Absent | P1 | Aucun assainissement global. Natif purge.rs réutilisable pour la partie structure ; côté TypeScript : vider Info/XMP, /Names JavaScript, /EmbeddedFiles, /Annots, /Outlines via pdf-lib |
| PD-437 | Protection | [Acrobat] Examiner le document (inspection avant partage) avec liste des éléments trouvés | Absent | P2 | Parcours pdf-lib du catalogue et des pages pour produire un rapport cliquable (métadonnées, pièces jointes, JavaScript via forms.ts hasScript, commentaires) |
| PD-438 | Protection | [Acrobat] Assainir automatiquement à l'enregistrement ou à l'envoi | Absent | P2 | Réglage settings 'pdf.sanitizeOnSave' appliqué dans useDoc.ts save |
| PD-439 | Protection | [Acrobat] Texte caviardé réellement absent du fichier (preuve par test) | OK | P1 | packages/pdf/tests/redact.test.ts (repli) ; crates/forge-convert/tests/pdf_caviardage.rs pour le natif ; Preuve OK : packages/pdf/tests/redact.test.ts |
## 10. Optimisation, normes PDF (A, X, E, UA), OCR, export vers d'autres formats, comparaison

Constat code : compresser, PDF/A et OCR passent par le moteur natif (coquille de bureau) ; dans le navigateur le ruban les grise avec la raison de capacites() (ribbon.tsx native(), PdfApp.tsx nativeReason). PDF/A et OCR exigent en plus Ghostscript et ocrmypdf + Tesseract installés (crates/forge-convert/src/pdf/externe.rs).

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-440 | Ruban/Outil | [Acrobat] Réduire la taille du fichier : compression sans perte, écran, livre électronique, impression | OK | P1 | dialogs.tsx 'compress' ; dialogActions.ts nativeOp 'compresser' ; crates/forge-convert/src/pdf/compression.rs NiveauCompression (images rééchantillonnées en JPEG si gain) ; indisponible hors bureau ; Preuve OK pour le moteur : crates/forge-convert/tests/pdf_outils.rs (compression) ; la boîte de dialogue n'a pas été exercée |
| PD-441 | Ruban/Outil | [Acrobat] Compression sans moteur natif (navigateur) | Absent | P2 | Le ruban grise l'outil. Repli TypeScript : réenregistrer avec useObjectStreams (pdf-ops.ts save) et supprimer les objets orphelins ; images via canvas |
| PD-442 | Dialogue | [Acrobat] Compression : résolution cible (ppp) et qualité JPEG personnalisées | Absent | P2 | Seulement quatre niveaux fixes (strings.ts dialogs.levels) ; exposer dpi/qualité dans NiveauCompression |
| PD-443 | Dialogue | [Acrobat] Compression : bilan avant/après (taille économisée) | Absent | P2 | Le natif renvoie BilanCompression (operation.rs Output::Fichiers.compression) mais nativeOp (PdfApp.tsx) ne garde que les octets ; afficher le gain dans la notification |
| PD-444 | Ruban/Outil | [Acrobat] Optimiseur PDF avancé : images, polices, transparence, suppression d'éléments, nettoyage | Absent | P2 | Un seul panneau compress ; décliner en options : désincorporer polices (pdf-lib), supprimer JS/signets/commentaires/métadonnées |
| PD-445 | Ruban/Outil | [Acrobat] Auditer l'utilisation de l'espace (polices, images, flux, structure) | Absent | P3 | Parcourir context.enumerateIndirectObjects (pdf-lib) et additionner la taille des flux par type |
| PD-446 | Ruban/Outil | [Acrobat] Optimiser pour la vue Web rapide (linéarisation) | Absent | P3 | Ni lopdf ni pdf-lib ne linéarisent ; qpdf externe (retiré du projet) ou écrire le linéariseur en Rust |
| PD-447 | Ruban/Outil | [Acrobat] Convertir en PDF/A-2b | Partiel | P2 | ribbon.tsx pdfa -> natif pdf_a (externe.rs, Ghostscript -dPDFA=2) ; aucune validation de conformité, outil externe requis |
| PD-448 | Ruban/Outil | [Acrobat] Convertir en PDF/A-1b et PDF/A-3 (pièces jointes) | Absent | P3 | Paramètre -dPDFA=1/3 de Ghostscript et profil ICC ; choix dans un dialogue |
| PD-449 | Ruban/Outil | [Acrobat] Vérifier la conformité PDF/A (rapport) | Absent | P2 | Intégrer veraPDF en processus externe ou contrôles minimaux (XMP, polices incorporées, pas de chiffrement) |
| PD-450 | Ruban/Outil | [Acrobat] Convertir en PDF/X (1a, 3, 4) pour l'imprimerie | Absent | P3 | Ghostscript -dPDFX avec profil de sortie ; voir Imprimer la production |
| PD-451 | Ruban/Outil | [Acrobat] Convertir en PDF/E (ingénierie) | Absent | P3 | Hors périmètre ; conserver tel quel les calques et le contenu 3D |
| PD-452 | Accessibilité | [Acrobat] Rendre conforme PDF/UA (étiquetage complet, langue, titre) | Absent | P2 | Voir section Accessibilité ; dépend de l'écriture de la structure balisée |
| PD-453 | OCR/Conversion | [Acrobat] Reconnaissance de texte (OCR) du document | Partiel | P1 | dialogs.tsx 'ocr' ; PdfApp.tsx/dialogActions.ts runBytes op 'ocr' ; externe.rs ocr (ocrmypdf --skip-text ou --force-ocr) ; bureau + outils externes seulement |
| PD-454 | OCR/Conversion | [Acrobat] OCR : choix des langues (nombreuses langues, combinaisons) | Partiel | P2 | strings.ts dialogs.langs : fra, eng, fra+eng seulement ; externe.rs valide n'importe quelle langue Tesseract. Lister `tesseract --list-langs` |
| PD-455 | OCR/Conversion | [Acrobat] OCR : forcer la reconnaissance et remplacer un texte existant | Présent à vérifier | P2 | dialogs.tsx ocrForce -> forcer (externe.rs --force-ocr) |
| PD-456 | OCR/Conversion | [Acrobat] OCR : type de sortie (image avec texte caché, texte éditable, image reconstruite) | Absent | P2 | Sortie = image avec texte invisible seulement (ocrmypdf). Texte éditable = reconstruction (hOCR + pdfium) hors périmètre |
| PD-457 | OCR/Conversion | [Acrobat] OCR : limiter à une plage de pages | Absent | P2 | Extraire la plage (pdfOps.extract), OCR, réinsérer (removePages + insertDocument) ou option --pages d'ocrmypdf |
| PD-458 | OCR/Conversion | [Acrobat] Améliorer les numérisations : redressement, nettoyage, rotation automatique, résolution | Absent | P2 | ocrmypdf --deskew --clean --rotate-pages --remove-background ; cases dans le dialogue OCR |
| PD-459 | OCR/Conversion | [Acrobat] Révision du texte reconnu (corriger les suspects) | Absent | P3 | Exige le score de confiance Tesseract (hOCR) ; interface de correction |
| PD-460 | OCR/Conversion | [Acrobat] OCR par lots sur plusieurs fichiers | Partiel | P3 | packages/convert/src/pdf-batch.ts runPdfTool('ocr') dans le Convertisseur ; pas dans le module PDF |
| PD-461 | OCR/Conversion | [Acrobat] Progression et annulation d'un OCR long | Absent | P2 | d.setBusy(label) affiche un spinner sans pourcentage ni annulation (useDoc.ts mutate) ; natif : flux d'événements de progression |
| PD-462 | OCR/Conversion | [Acrobat] Détecter une page sans texte (numérisation) et proposer la reconnaissance | Partiel | P2 | strings.ts reading.noText cite la reconnaissance de texte mais seulement à la lecture vocale (PdfApp.tsx readPage) ; bandeau proactif absent |
| PD-463 | OCR/Conversion | [Acrobat] Rechercher, sélectionner et lire le texte reconnu | Présent à vérifier | P2 | Après OCR le texte passe par pdf.js : PageView.tsx TextLayer, find.ts, speech.ts |
| PD-464 | OCR/Conversion | [Acrobat] Exporter vers Word (.docx) | Partiel | P1 | ribbon.tsx exp-word -> PdfApp.tsx exportAs 'word' -> natif convertir ; passe par un pivot texte (conv/mod.rs text_to_doc) : ni mise en page, ni tableaux, ni images |
| PD-465 | OCR/Conversion | [Acrobat] Exporter vers Excel (.xlsx) avec tableaux détectés | Absent | P2 | Détection de tableaux par alignement des textBoxes (pdfdoc.ts) ; écriture xlsx par le natif (conv/donnees.rs) ; voir PD-A03 |
| PD-466 | OCR/Conversion | [Acrobat] Exporter vers PowerPoint (.pptx) | Absent | P3 | Une diapositive par page avec image de fond et texte ; natif conv office.rs à étendre |
| PD-467 | OCR/Conversion | [Acrobat] Exporter en images PNG (une par page, ZIP) | Présent à vérifier | P2 | PdfApp.tsx exportAs 'images' (150 ppp, canvasBytes, zip) |
| PD-468 | OCR/Conversion | [Acrobat] Exporter en JPEG, JPEG 2000, TIFF | Partiel | P2 | Le natif pdf_vers_images gère PNG et JPG (externe.rs FormatImage) mais le ruban n'expose que PNG ; TIFF/JP2 absents |
| PD-469 | OCR/Conversion | [Acrobat] Exporter les images : résolution, pages choisies | Absent | P2 | 150 ppp fixé (PdfApp.tsx) et toutes les pages ; ajouter un dialogue (dpi, plage) |
| PD-470 | OCR/Conversion | [Acrobat] Exporter en texte brut (.txt) | Présent à vérifier | P2 | PdfApp.tsx exportAs 'text' (allText de pdfdoc.ts, pages séparées par saut de page) |
| PD-471 | OCR/Conversion | [Acrobat] Exporter en HTML ou Markdown | Partiel | P3 | conv/mod.rs ("pdf","html") et ("pdf","txt"/"md") dans le moteur (texte seul) ; aucun bouton dans le module PDF |
| PD-472 | OCR/Conversion | [Acrobat] Exporter en RTF / XML / EPUB | Absent | P3 | Voie texte du moteur (doc_to_text puis text_to_doc) à rendre disponible depuis le module |
| PD-473 | OCR/Conversion | [Acrobat] Enregistrer comme autre : PDF de taille réduite, PDF optimisé, PDF certifié, lecture seule | Partiel | P3 | Réduit via Compresser ; autres variantes absentes |
| PD-474 | Ruban/Outil | [Acrobat] Comparer deux PDF : différences de texte | OK | P2 | ribbon.tsx compare -> PdfApp.tsx compare -> model.ts diffLines (LCS, 4000 lignes par côté) -> dialogs.tsx 'compare' ; packages/pdf/tests/pdf.test.ts ; Preuve OK : packages/pdf/tests/pdf.test.ts (comparaison) |
| PD-475 | Ruban/Outil | [Acrobat] Comparer : affichage côte à côte avec différences marquées sur les pages | Absent | P2 | Résultat = liste de lignes (dialogs.tsx pdf-diff). Placer deux PageView côte à côte et surligner les boîtes de texte modifiées (positions via textBoxes) |
| PD-476 | Ruban/Outil | [Acrobat] Comparer : comparaison visuelle (pixels, images, graphiques) | Absent | P2 | Rendre les deux pages (renderPage) et diff pixel par pixel ; voir PD-A05 |
| PD-477 | Ruban/Outil | [Acrobat] Comparer : différences au niveau du mot dans une ligne | Absent | P2 | diffLines travaille par ligne ; appliquer un second diff sur les mots des lignes modifiées |
| PD-478 | Ruban/Outil | [Acrobat] Comparer : plages de pages, ignorer espaces/casse/ponctuation/en-têtes | Absent | P3 | Options de normalisation avant diffLines |
| PD-479 | Ruban/Outil | [Acrobat] Comparer : rapport exportable (HTML ou PDF) | Partiel | P3 | Le natif comparer produit un rapport HTML (crates/forge-convert/src/pdf/texte.rs Comparaison.html) mais la comparaison du module est faite en TypeScript sans export |
## 11. Recherche, lecture à voix haute, modes de lecture, rendu et performance

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-480 | Recherche/Lecture | [Acrobat] Recherche insensible à la casse et aux accents (texte simple) | OK | P1 | packages/pdf/src/find.ts fold + matches ; packages/pdf/tests/reading.test.ts ; Preuve OK : packages/pdf/tests/reading.test.ts |
| PD-481 | Recherche/Lecture | [Acrobat] Recherche : respecter la casse | OK | P1 | SidePanels.tsx Checkbox matchCase -> SearchOptions.matchCase ; Preuve OK : packages/pdf/tests/reading.test.ts |
| PD-482 | Recherche/Lecture | [Acrobat] Recherche : mot entier uniquement | Absent | P1 | find.ts n'a pas d'option wholeWord. Ajouter \b…\b (avec support Unicode via lookarounds) dans compile() et une case dans SearchPanel |
| PD-483 | Recherche/Lecture | [Acrobat] Recherche par expression régulière (au-delà d'Acrobat) | OK | P3 | find.ts compile (motif borné à 200 caractères, 500 résultats) ; SidePanels.tsx case regex ; Preuve OK : packages/pdf/tests/reading.test.ts |
| PD-484 | Recherche/Lecture | [Acrobat] Recherche aussi dans les signets, commentaires, champs de formulaire et pièces jointes | Absent | P2 | search() ne parcourt que les TextBox des pages (find.ts) ; étendre à Item.text, outline, d.fields |
| PD-485 | Recherche/Lecture | [Acrobat] Résultat suivant / précédent (boutons, F3, Maj+F3) | Partiel | P1 | SidePanels.tsx : Entrée / Maj+Entrée dans le champ et clic dans la liste ; pas de boutons ni F3 globaux |
| PD-486 | Recherche/Lecture | [Acrobat] Liste des résultats avec contexte et page, saut au résultat | OK | P1 | SidePanels.tsx SearchPanel (ul.pdf-results, mark) ; PdfApp.tsx onHit -> goTo(page, rect) ; Preuve OK : parcours du STATUS.md (recherche « atelier ») |
| PD-487 | Recherche/Lecture | [Edge] Surlignage des occurrences dans la page, occurrence active distincte | OK | P1 | PageView.tsx div.pdf-hit.is-active ; useText.ts hitRects (largeurs mesurées par canvas) ; Preuve OK : parcours du STATUS.md (recherche « atelier », surlignage) |
| PD-488 | Recherche/Lecture | [Acrobat] Mot coupé entre deux segments de texte, ligne coupée, ligatures | Absent | P2 | find.ts ne cherche que dans une TextBox (limite signalée en commentaire). Concaténer les boîtes d'une ligne avec table de correspondance de positions |
| PD-489 | Recherche/Lecture | [Acrobat] Recherche dans un document volumineux (chargement progressif du texte) | Partiel | P2 | useText.ts charge le texte page par page et recopie la Map à chaque page (setBoxes(new Map(m))) : coût quadratique sur des milliers de pages. Accumuler puis un seul setState par lot |
| PD-490 | Recherche/Lecture | [Acrobat] Historique des recherches et recherche dans plusieurs documents | Absent | P3 | Liste des dernières requêtes dans settings ; multi-documents voir Recherche avancée |
| PD-491 | Recherche/Lecture | [Acrobat] Lire à voix haute : lecture continue page par page jusqu'à la fin | Présent à vérifier | P2 | ribbon.tsx aloud ; PdfApp.tsx toggleSpeech/readPage ; speech.ts speak (voix fr-FR) ; packages/pdf/tests/reading.test.ts |
| PD-492 | Recherche/Lecture | [Acrobat] Lire à voix haute : lire seulement la page courante, ou à partir d'un point | Absent | P2 | readPage enchaîne toujours jusqu'à la fin (PdfApp.tsx) ; ajouter un mode 'page' et un point de départ (TextBox) |
| PD-493 | Recherche/Lecture | [Acrobat] Lire à voix haute : pause et reprise | Absent | P2 | speechSynthesis.pause()/resume() non utilisés (speech.ts) ; bascule Pause dans le ruban |
| PD-494 | Recherche/Lecture | [Edge] Lecture : choix de la voix, vitesse, volume | Absent | P2 | speech.ts speak fixe lang fr-FR et la première voix française (frenchVoice) ; ajouter u.rate/u.volume et sélecteur de voix, réglages persistants |
| PD-495 | Recherche/Lecture | [Edge] Lecture : mot en cours surligné pendant la lecture | Absent | P2 | Événement onboundary de SpeechSynthesisUtterance (charIndex) -> mapper vers la TextBox/hitRect (find.ts) et dessiner un pdf-hit mobile |
| PD-496 | Recherche/Lecture | [Edge] Lecture : voix neuronales en ligne | Absent | P3 | Hors-ligne par principe (aucun service payant) ; voix locales du système uniquement |
| PD-497 | Recherche/Lecture | [Acrobat] Ordre de lecture du texte pour la voix (colonnes, tableaux, en-têtes) | Partiel | P2 | speech.ts pageSpeechText : lignes triées haut-bas puis gauche-droite, colonnes mélangées. Utiliser l'ordre logique /StructTreeRoot si présent sinon détecter les colonnes |
| PD-498 | Recherche/Lecture | [Acrobat] Lire dans la langue du document (/Lang) | Partiel | P3 | speech.ts force fr-FR ; lire /Lang du catalogue (pdf-lib) pour choisir la voix |
| PD-499 | Recherche/Lecture | [Acrobat] Mode nuit / thème sombre du document | Présent à vérifier | P2 | ribbon.tsx night ; Pdf.css .pdf-page.is-night (filtre invert sur le canevas) ; persistance pdf.night |
| PD-500 | Recherche/Lecture | [Acrobat] Couleurs de page et de texte personnalisées (haut contraste, sépia) | Absent | P2 | Ajouter des préréglages de filtre CSS ou recoloration au rendu (canvas) ; réglage persistant |
| PD-501 | Recherche/Lecture | [Acrobat] Sélectionner du texte en colonne ou en rectangle | Absent | P3 | TextLayer ne gère que la sélection linéaire ; sélection rectangulaire par hit-test des TextBox |
| PD-502 | Recherche/Lecture | [Acrobat] Défilement continu de toutes les pages avec chargement paresseux | Présent à vérifier | P1 | PageView.tsx IntersectionObserver (marge 600 px) ; rendu du canevas seulement quand visible |
| PD-503 | Recherche/Lecture | [Acrobat] Libération de la mémoire des pages éloignées (documents de milliers de pages) | Partiel | P2 | Les canevas rendus ne sont jamais vidés quand la page sort de l'écran (PageView.tsx effet de rendu). Remettre canvas.width à 0 hors zone |
| PD-504 | Recherche/Lecture | [Acrobat] Rendu haute densité (écrans HiDPI) | Présent à vérifier | P2 | PageView.tsx dpr = min(devicePixelRatio, 3) |
| PD-505 | Recherche/Lecture | [Acrobat] Pages de formats différents dans un même document | Partiel | P2 | Chaque PageView prend son viewport (PageView.tsx) ; fitValue (PdfApp.tsx) calcule sur la première page seulement (firstSize) |
| PD-506 | Recherche/Lecture | [Acrobat] Zoom tactile par pincement | Présent à vérifier | P2 | PdfApp.tsx usePinchZoom(viewerRef) de packages/ui |
| PD-507 | Recherche/Lecture | [Acrobat] Reprendre à la dernière page lue à la réouverture | Absent | P2 | Mémoriser page et zoom par chemin de fichier dans services.settings (clé pdf.last.<hash>) puis goTo au chargement |
| PD-508 | Recherche/Lecture | [Acrobat] Texte de l'annotation au survol (info-bulle des notes et surlignages) | Partiel | P3 | itemview.tsx title={i.text} sur la note ; pas de popup au survol pour les surlignages |
| PD-509 | Recherche/Lecture | [Acrobat] Liens cliquables sur la page (interne, URL, mailto) avec garde-fou | OK | P1 | extras.ts pageLinks ; PageView.tsx button.pdf-linkarea ; links.ts safeUrl ; packages/pdf/tests/reading.test.ts ; Preuve OK : packages/pdf/tests/reading.test.ts (liens) |
| PD-510 | Recherche/Lecture | [Acrobat] Signets : navigation dans l'arbre (clic = aller à la page) | Présent à vérifier | P1 | Sidebar.tsx Bookmarks Tree ; pdfdoc.ts outline (résout /Dest nommées) |
| PD-511 | Recherche/Lecture | [Acrobat] Pièces jointes du document (liste, taille, enregistrer) | OK | P2 | SidePanels.tsx AttachmentsPanel ; extras.ts ; Preuve OK : packages/pdf/tests/reading.test.ts (pièces jointes) |
| PD-512 | Recherche/Lecture | [Acrobat] Calques : cocher pour afficher / masquer | OK | P2 | SidePanels.tsx LayersPanel ; extras.ts setLayerVisible ; PageView.tsx re-rendu via layers.version ; Preuve OK : packages/pdf/tests/reading.test.ts (calques) |
| PD-513 | Recherche/Lecture | [Acrobat] Panneau Étiquettes (arbre de balisage) | Absent | P2 | Lire /StructTreeRoot (pdf-lib) en lecture seule dans un volet, puis édition (voir Accessibilité) |
| PD-514 | Recherche/Lecture | [Acrobat] Rotation de la vue mémorisée avec le document | Absent | P3 | viewRotation (PdfApp.tsx) est un useState non persisté ; stocker par fichier |
| PD-515 | Recherche/Lecture | [Edge] Zoom adapté automatiquement à la largeur à l'ouverture | Absent | P3 | Le zoom est repris de settings ('pdf.zoom') ; option « ajuster à l'ouverture » via fitValue('width') |
| PD-516 | Recherche/Lecture | [Edge] Défilement fluide et saut direct par la barre de défilement avec numéro de page indiqué | Partiel | P3 | PageView.tsx onVisible met à jour la page courante ; pas d'infobulle de page pendant le glissement de la barre |
## 12. Accessibilité (outil Accessibilité d'Acrobat, lecteurs d'écran, PDF balisés)

Constat code : aucune lecture ni écriture de la structure balisée (/StructTreeRoot, /MarkInfo, /Alt, /Lang) dans packages/pdf (grep). Seul le natif purge.rs touche ActualText/Alt, pour le caviardage.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-517 | Accessibilité | [Acrobat] Vérification complète de l'accessibilité (vérificateur) | Absent | P2 | Écrire un vérificateur pdf-lib : MarkInfo.Marked, StructTreeRoot, /Lang, titre, DisplayDocTitle, alt des figures ; rapport en volet |
| PD-518 | Accessibilité | [Acrobat] Vérificateur : contenu du document (titre, langue, balisage, sécurité autorisant les lecteurs d'écran) | Absent | P2 | Lecture du catalogue (pdf-lib) et de /Encrypt /P (bit accessibilité) |
| PD-519 | Accessibilité | [Acrobat] Vérificateur : texte de remplacement des figures et images | Absent | P2 | Parcours de l'arbre de structure : éléments Figure sans /Alt |
| PD-520 | Accessibilité | [Acrobat] Vérificateur : champs de formulaire (étiquettes, info-bulles /TU) | Absent | P2 | forms.ts readFields pourrait lire /TU (field.acroField.dict) |
| PD-521 | Accessibilité | [Acrobat] Vérificateur : tableaux (en-têtes, lignes, cellules), listes, titres (hiérarchie H1-H6) | Absent | P3 | Contrôle de structure sur l'arbre balisé |
| PD-522 | Accessibilité | [Acrobat] Rapport d'accessibilité (volet, export HTML ou PDF) | Absent | P3 | Rendu des résultats du vérificateur ; export via saveBytes |
| PD-523 | Accessibilité | [Acrobat] Reconnaissance : ajouter automatiquement les balises au document | Absent | P2 | Heuristique sur textBoxes (taille de police -> titres, paragraphes) puis écriture de /StructTreeRoot et contenu marqué (BDC/EMC) : travail natif en Rust (lopdf) |
| PD-524 | Accessibilité | [Acrobat] Définir le texte de remplacement des images (panneau et propriétés) | Absent | P1 | Édition de /Alt sur les éléments Figure ; interface liste des images de la page |
| PD-525 | Accessibilité | [Acrobat] Panneau Ordre de lecture et ordre de lecture éditable | Absent | P2 | Afficher les blocs numérotés sur la page et permettre la réorganisation (écrit l'ordre de /K) |
| PD-526 | Accessibilité | [Acrobat] Panneau Étiquettes : modifier, créer, supprimer des étiquettes, marquer comme artefact | Absent | P3 | Édition de l'arbre de structure ; /Artifact dans le flux de contenu |
| PD-527 | Accessibilité | [Acrobat] Définir la langue du document | Absent | P2 | catalog.set(PDFName.of('Lang'), PDFString.of('fr-FR')) via pdf-lib ; case dans Propriétés > Avancé |
| PD-528 | Accessibilité | [Acrobat] Afficher le titre du document dans la barre de titre (DisplayDocTitle) | Absent | P3 | /ViewerPreferences /DisplayDocTitle true ; case dans Propriétés > Vue initiale |
| PD-529 | Accessibilité | [Acrobat] Affichage Reflow : texte réorganisé en une colonne adaptée à l'écran | Absent | P2 | Regrouper textBoxes (pdfdoc.ts) en paragraphes et afficher en HTML à largeur du volet ; plus simple que l'édition de structure |
| PD-530 | Accessibilité | [Acrobat] Zoom jusqu'à 6400 % pour la basse vision | Partiel | P2 | ZOOM_MAX = 500 (packages/ui logic/zoom.ts) ; relever la borne et limiter la taille de canevas par pavage (tiles) |
| PD-531 | Accessibilité | [Acrobat] Lecteur d'écran : texte de la page exposé aux technologies d'assistance | Partiel | P2 | PageView.tsx rend le TextLayer seulement en mode Sélection et le canevas porte un aria-label de page ; pas de texte accessible dans les autres modes |
| PD-532 | Accessibilité | [Acrobat] Navigation clavier et rôles ARIA de l'interface | Partiel | P2 | Rail aria-pressed, arbre role=tree, boutons étiquetés (Sidebar.tsx) ; pas de navigation clavier entre pages ni vers les annotations |
| PD-533 | Accessibilité | [Acrobat] Contrôle des couleurs et du contraste du document | Absent | P3 | Analyse du contraste texte/fond par échantillonnage du canevas |
| PD-534 | Accessibilité | [Acrobat] Assistant de configuration de l'accessibilité (préférences) | Absent | P3 | Réglages regroupés : contraste, taille minimale, lecture, animations |
| PD-535 | Accessibilité | [Acrobat] Interface en français pour tous les textes et messages | Présent à vérifier | P2 | packages/pdf/src/strings.ts (S) ; aucune chaîne en dur hors fichier de chaînes dans PdfApp.tsx |
## 13. Boîtes de dialogue (présentes dans le module et absentes par rapport à Acrobat / Edge)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-536 | Dialogue | [Acrobat] Boîte Ouvrir / Enregistrer sous (sélecteur de fichiers de la plate-forme) | Présent à vérifier | P1 | packages/pdf/src/PdfApp.tsx pickPdf -> services.openFile ; useDoc.ts save -> services.saveFile ; filtre PDF |
| PD-537 | Dialogue | [Acrobat] Boîte Mot de passe d'ouverture (erreur si faux, nouvel essai) | Présent à vérifier | P1 | packages/pdf/src/dialogs.tsx case 'password' ; STATUS.md : non exercée au banc graphique (code seulement) ; déchiffrement prouvé par packages/convert/tests |
| PD-538 | Dialogue | [Acrobat] Boîte Protéger par mot de passe (confirmation, propriétaire, cinq autorisations) | Présent à vérifier | P1 | dialogs.tsx case 'protect' ; STATUS.md : non exercée au banc graphique |
| PD-539 | Dialogue | [Acrobat] Boîte Propriétés du document (six champs) | Présent à vérifier | P1 | dialogs.tsx case 'metadata' ; dialogActions.ts openDialog lit pdfOps.readMetadata |
| PD-540 | Dialogue | [Acrobat] Boîte Filigrane (texte, taille, opacité, angle, pages, aperçu) | Présent à vérifier | P2 | dialogs.tsx case 'watermark' (aperçu .pdf-wm-preview) ; pdf-ops.ts watermark |
| PD-541 | Dialogue | [Acrobat] Boîte Numérotation / Bates | Présent à vérifier | P2 | dialogs.tsx case 'numbering' |
| PD-542 | Dialogue | [Acrobat] Boîte En-tête et pied de page | Présent à vérifier | P2 | dialogs.tsx case 'headerFooter' |
| PD-543 | Dialogue | [Acrobat] Boîte Réduire la taille (niveau) | Présent à vérifier | P2 | dialogs.tsx case 'compress' |
| PD-544 | Dialogue | [Acrobat] Boîte Reconnaissance de texte (langue, forcer) | Présent à vérifier | P2 | dialogs.tsx case 'ocr' |
| PD-545 | Dialogue | [Acrobat] Boîte Diviser le document | Présent à vérifier | P2 | dialogs.tsx case 'split' |
| PD-546 | Dialogue | [Acrobat] Boîte Extraire des pages | Présent à vérifier | P2 | dialogs.tsx case 'extract' |
| PD-547 | Dialogue | [Acrobat] Boîte Créer une signature (dessiner, taper) | OK | P1 | dialogs.tsx SignaturePad ; parcours du STATUS.md : signature dessinée au banc navigateur ; Preuve OK : parcours du STATUS.md (signature dessinée) |
| PD-548 | Dialogue | [Acrobat] Boîte Signer numériquement (certificat, mot de passe, motif, lieu, visible) | Présent à vérifier | P1 | packages/pdf/src/dialogs-sign.tsx DigitalSignDialog ; la signature elle-même est prouvée par packages/pdf/tests/sign.test.ts, pas la boîte |
| PD-549 | Dialogue | [Acrobat] Boîte de confirmation d'ouverture d'un lien externe | Présent à vérifier | P2 | dialogs-sign.tsx LinkDialog ; links.ts safeUrl testé (reading.test.ts), pas la boîte |
| PD-550 | Dialogue | [Acrobat] Boîte Résultat de la comparaison | Présent à vérifier | P2 | dialogs.tsx case 'compare' ; diffLines testé (pdf.test.ts) |
| PD-551 | Dialogue | [Acrobat] Boîte Zoom (préréglages et valeur libre) | Présent à vérifier | P2 | packages/ui StatusBar.tsx ZoomDialog (ZOOM_PRESETS + presets Largeur/Page entière) |
| PD-552 | Dialogue | [Acrobat] Boîte Préférences (Ctrl+K) | Absent | P2 | Aucun dialogue de préférences PDF. Créer un panneau Réglages (voir section Réglages) alimenté par services.settings |
| PD-553 | Dialogue | [Acrobat] Boîte Propriétés d'une annotation (apparence, général, historique de révision) | Absent | P1 | Ajouter un Dialog ouvert par double-clic ou menu contextuel qui édite Item (couleur, opacité, auteur, sujet) |
| PD-554 | Dialogue | [Acrobat] Boîte Propriétés d'un champ (Général, Apparence, Options, Actions, Format, Validation, Calcul) | Absent | P1 | Voir section Formulaire ; Dialog à onglets patchant l'Item field ou le widget existant |
| PD-555 | Dialogue | [Acrobat] Boîte Imprimer (imprimante, plage, copies, échelle, recto verso, commentaires) | Absent | P1 | PdfApp.tsx print délègue à la webview ; écrire le dialogue puis extract + print |
| PD-556 | Dialogue | [Acrobat] Boîte Insérer des pages (avant/après, page ou plage de la source) | Absent | P1 | actions.insertFile insère sans dialogue (PdfApp.tsx) ; ajouter position et plage via parsePageRange |
| PD-557 | Dialogue | [Acrobat] Boîte Rogner les pages (marges, plage, supprimer les blancs) | Absent | P2 | pdf-lib setCropBox ; aperçu des marges sur la miniature |
| PD-558 | Dialogue | [Acrobat] Boîte Combiner des fichiers (liste réordonnable) | Absent | P1 | pdfOps.merge accepte N fichiers ; liste glisser-déposer + miniatures |
| PD-559 | Dialogue | [Acrobat] Boîte Exporter (format, dpi, pages) | Absent | P2 | Un dialogue unique Exporter remplaçant les trois boutons du ruban (images, texte, Word) |
| PD-560 | Dialogue | [Acrobat] Boîte Propriétés du caviardage (couleur, texte de superposition) | Absent | P2 | Item redact enrichi ; natif caviarder_couleurs |
| PD-561 | Dialogue | [Acrobat] Boîte Créer un tampon personnalisé | Absent | P2 | Image ou PDF + catégorie ; stockage dans settings |
| PD-562 | Dialogue | [Acrobat] Boîte Rechercher et remplacer le texte du document | Absent | P3 | Acrobat n'offre pas le remplacement dans le texte de page ; couvert par Édition > Modifier le texte |
| PD-563 | Dialogue | [Edge] Boîte Imprimer avec aperçu intégré | Absent | P2 | Voir ligne Imprimer ; aperçu = miniatures de pages à imprimer |
| PD-564 | Dialogue | [Acrobat] Boîte Aide / À propos du module PDF | Absent | P3 | Fenêtre d'aide statique avec raccourcis et limites connues |
## 14. Raccourcis clavier (Acrobat et Edge)

Constat code : un seul écouteur keydown dans packages/pdf/src/PdfApp.tsx ; Ctrl+S/O/P/F fonctionnent même en saisie, les autres touches sont ignorées quand le focus est dans un champ.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-565 | Raccourci | [Acrobat] Ctrl+S : enregistrer | OK | P1 | PdfApp.tsx keydown -> d.save ; parcours du STATUS.md (ellipse + zone de texte puis Ctrl+S, annotations relues par pdf.js) ; Preuve OK : parcours du STATUS.md (Ctrl+S) |
| PD-566 | Raccourci | [Acrobat] Ctrl+Maj+S : enregistrer sous | Présent à vérifier | P1 | PdfApp.tsx keydown (e.shiftKey -> d.save(true)) |
| PD-567 | Raccourci | [Acrobat] Ctrl+O : ouvrir | Présent à vérifier | P1 | PdfApp.tsx keydown -> pickPdf + d.load |
| PD-568 | Raccourci | [Acrobat] Ctrl+P : imprimer | Présent à vérifier | P1 | PdfApp.tsx keydown -> print() |
| PD-569 | Raccourci | [Acrobat] Ctrl+F : rechercher | Présent à vérifier | P1 | PdfApp.tsx keydown -> setPanel('search') |
| PD-570 | Raccourci | [Acrobat] Ctrl+Z : annuler | Présent à vérifier | P1 | PdfApp.tsx keydown -> d.undo (ignoré pendant la saisie de texte) |
| PD-571 | Raccourci | [Acrobat] Ctrl+Maj+Z : rétablir | Absent | P2 | Seul Ctrl+Y est lié (convention Office). Ajouter e.shiftKey sur la branche Ctrl+Z |
| PD-572 | Raccourci | [Edge] Ctrl+Y : rétablir | Présent à vérifier | P2 | PdfApp.tsx keydown -> d.redo |
| PD-573 | Raccourci | [Acrobat] Suppr : supprimer l'annotation sélectionnée | Présent à vérifier | P1 | PdfApp.tsx keydown Delete/Backspace -> removeItems |
| PD-574 | Raccourci | [Acrobat] Échap : revenir à l'outil Sélection | Présent à vérifier | P2 | PdfApp.tsx keydown Escape -> setTool('select') |
| PD-575 | Raccourci | [Acrobat] Page suivante / Page précédente | Présent à vérifier | P1 | PdfApp.tsx keydown PageDown/PageUp -> goTo (saute de deux pages en vue double) |
| PD-576 | Raccourci | [Acrobat] Début / Fin : première / dernière page | Absent | P2 | goTo(0) / goTo(pageCount - 1) |
| PD-577 | Raccourci | [Acrobat] Ctrl+Maj+N : aller à la page | Absent | P1 | Lier à un champ numérique dans la barre d'état |
| PD-578 | Raccourci | [Acrobat] Flèches et Espace : défilement du document | Partiel | P2 | Le conteneur .pdf-viewer n'a pas de tabIndex (PdfApp.tsx) ; le défilement clavier dépend du focus de la webview |
| PD-579 | Raccourci | [Acrobat] Alt+Gauche / Alt+Droite : vue précédente / suivante | Absent | P2 | Dépend de la pile de navigation (voir Affichage) |
| PD-580 | Raccourci | [Acrobat] Ctrl+C : copier le texte sélectionné | Présent à vérifier | P1 | Copie native du navigateur sur le TextLayer (PageView.tsx) |
| PD-581 | Raccourci | [Acrobat] Ctrl+X / Ctrl+V : couper / coller des éléments | Absent | P2 | Aucun presse-papiers d'éléments (voir Édition) |
| PD-582 | Raccourci | [Acrobat] Ctrl+A / Ctrl+Maj+A : tout sélectionner / désélectionner | Absent | P2 | Voir Édition > Sélectionner tout |
| PD-583 | Raccourci | [Acrobat] F3 / Maj+F3 / Ctrl+G : résultat suivant / précédent | Absent | P1 | Seules Entrée et Maj+Entrée dans le champ (SidePanels.tsx SearchPanel) ; écouteur global à ajouter |
| PD-584 | Raccourci | [Acrobat] Ctrl+Maj+F : recherche avancée | Absent | P3 | Voir Édition > Recherche avancée |
| PD-585 | Raccourci | [Acrobat] Ctrl++ / Ctrl+- : zoom avant / arrière | Absent | P1 | Aucune liaison dans PdfApp.tsx keydown ; appeler stepZoom(zoom, ±1) avec preventDefault |
| PD-586 | Raccourci | [Acrobat] Ctrl+0 : page entière | Absent | P2 | fitZoom('page') |
| PD-587 | Raccourci | [Acrobat] Ctrl+1 : taille réelle (100 %) | Absent | P2 | setZoom(100) |
| PD-588 | Raccourci | [Acrobat] Ctrl+2 : ajuster à la largeur | Absent | P2 | fitZoom('width') |
| PD-589 | Raccourci | [Acrobat] Ctrl+Maj++ / Ctrl+Maj+- : rotation de la vue | Absent | P2 | setViewRotation (PdfApp.tsx) |
| PD-590 | Raccourci | [Edge] Ctrl+] / Ctrl+[ : rotation horaire / antihoraire du document | Absent | P3 | Même action de rotation de la vue |
| PD-591 | Raccourci | [Acrobat] Ctrl+H : mode lecture | Absent | P2 | Voir Affichage > Mode lecture |
| PD-592 | Raccourci | [Acrobat] Ctrl+L : plein écran, Échap pour en sortir | Partiel | P2 | Bouton ribbon.tsx full ; sortie par Échap gérée par le navigateur ; pas de Ctrl+L |
| PD-593 | Raccourci | [Acrobat] Ctrl+Maj+Y / Ctrl+Maj+V / Ctrl+Maj+B / Ctrl+Maj+C : lecture à voix haute (activer, page, jusqu'à la fin, arrêter) | Absent | P3 | Un seul bouton Lire à voix haute (ribbon.tsx aloud) ; lier quatre commandes à toggleSpeech |
| PD-594 | Raccourci | [Acrobat] Ctrl+B : ajouter un signet | Absent | P3 | outlines.ts addBookmark depuis la sélection |
| PD-595 | Raccourci | [Acrobat] Touches uniques d'outils (H main, V sélection, Z zoom, G instantané) | Absent | P2 | Table de raccourcis vers setTool (PdfApp.tsx) hors saisie ; réglage pour l'activer |
| PD-596 | Raccourci | [Acrobat] Flèches : déplacer finement l'annotation sélectionnée | Absent | P2 | moveItem (itemview.tsx) par pas de 1 px (écran) ; Maj = 10 px |
| PD-597 | Raccourci | [Acrobat] Tab / Maj+Tab : passer d'un champ de formulaire à l'autre | Partiel | P2 | Ordre du DOM des champs (PageView.tsx) ; pas de respect de /Tabs |
| PD-598 | Raccourci | [Acrobat] Ctrl+D : propriétés du document | Absent | P3 | openDialog('metadata') |
| PD-599 | Raccourci | [Acrobat] Ctrl+W : fermer le document | Absent | P2 | services.close() avec confirmation de modifications |
| PD-600 | Raccourci | [Acrobat] Ctrl+K : préférences | Absent | P2 | Dépend d'un panneau Réglages |
| PD-601 | Raccourci | [Acrobat] F4 / F8 / F9 : masquer volets, barre d'outils, barre de menus | Absent | P3 | Masquage du Sidebar et du ruban (état readingMode) |
| PD-602 | Raccourci | [Acrobat] Alt : touches d'accès du ruban (KeyTips) | Présent à vérifier | P3 | packages/ui logic/keytips.ts assignKeytips fournit les touches pour le Ribbon commun ; non exercé dans ce module |
| PD-603 | Raccourci | [Acrobat] Ctrl+Tab : passer au document ouvert suivant | Absent | P3 | Dépend des onglets multi-documents |
## 15. Réglages et préférences (catégories de Préférences d'Acrobat)

Constat code : pas de panneau Préférences ; seuls cinq réglages persistants (services.settings via usePersistentState dans PdfApp.tsx) plus user.name.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-604 | Réglage | [Acrobat] Mémoriser le niveau de zoom | Présent à vérifier | P2 | packages/pdf/src/PdfApp.tsx usePersistentState 'pdf.zoom' |
| PD-605 | Réglage | [Acrobat] Mémoriser le mode d'affichage (continu, une page, deux pages) | Présent à vérifier | P2 | PdfApp.tsx 'pdf.pageMode' et 'pdf.twoPages' |
| PD-606 | Réglage | [Acrobat] Mémoriser le mode nuit | Présent à vérifier | P3 | PdfApp.tsx 'pdf.night' |
| PD-607 | Réglage | [Acrobat] Mémoriser le volet de navigation ouvert | Présent à vérifier | P3 | PdfApp.tsx 'pdf.panel' |
| PD-608 | Réglage | [Acrobat] Préférences > Identité : nom d'auteur des commentaires | Présent à vérifier | P2 | PdfApp.tsx 'user.name' (défaut Utilisateur) -> ToolOptions.author -> Item.author -> /T de l'annotation (appearance.ts) ; réglage édité hors module |
| PD-609 | Réglage | [Acrobat] Préférences > Commentaires (police et opacité des popups, copier le texte surligné dans la note, afficher au survol) | Absent | P2 | Constantes en dur (surlignage 0,45 itemview.tsx ; texte copié textUnder). Réglages dans settings lus par PageView.tsx |
| PD-610 | Réglage | [Acrobat] Préférences > Documents : enregistrement automatique et récupération après incident | Absent | P1 | L'historique vit en mémoire (useDoc.ts History) : une fermeture brutale perd tout. Écrire un instantané périodique dans le dossier de données de l'application et proposer la récupération |
| PD-611 | Réglage | [Acrobat] Préférences > Documents : rouvrir à la dernière page vue ; avertir à la fermeture | Absent | P2 | Voir Recherche/Lecture > Reprendre ; S.confirmDiscard défini mais non utilisé |
| PD-612 | Réglage | [Acrobat] Préférences > Affichage de la page : zoom par défaut, lissage du texte et des images, résolution | Absent | P3 | Zoom initial = dernier utilisé ; DPR plafonné à 3 dans PageView.tsx ; exposer qualité du rendu |
| PD-613 | Réglage | [Acrobat] Préférences > Plein écran : transitions, défilement automatique, clic pour avancer | Absent | P3 | Seul requestFullscreen (PdfApp.tsx) |
| PD-614 | Réglage | [Acrobat] Préférences > Général : touches uniques d'outils, ouverture de documents en onglets | Absent | P2 | Voir Raccourcis et Fenêtre |
| PD-615 | Réglage | [Acrobat] Préférences > Accessibilité : couleurs du document, vue Reflow, ordre de lecture | Absent | P2 | Voir Accessibilité et Recherche/Lecture > Couleurs de page |
| PD-616 | Réglage | [Acrobat] Préférences > Formulaires : couleur de surbrillance des champs, saisie semi-automatique | Absent | P3 | Couleur #e8f0fe fixe (Pdf.css .pdf-field) ; réglage et bascule |
| PD-617 | Réglage | [Acrobat] Préférences > JavaScript : activer / désactiver l'exécution | Absent | P3 | Politique figée : jamais exécuté (strings.ts notices.javascript) |
| PD-618 | Réglage | [Acrobat] Préférences > Sécurité renforcée : confirmation des liens et fichiers externes | Partiel | P2 | LinkDialog confirme toujours les URL externes (dialogs-sign.tsx, links.ts) ; pas de liste de sites approuvés ni de réglage |
| PD-619 | Réglage | [Acrobat] Préférences > Signatures : apparence, vérification, autorités approuvées | Absent | P2 | Apparence fixe (sign/pdfsign.ts) ; aucune préférence de vérification (verify.ts) |
| PD-620 | Réglage | [Acrobat] Préférences > Unités : points, pouces, millimètres | Absent | P2 | Dialogues en points (filigrane marge 24 pt, tailles) ; ajouter une unité d'affichage |
| PD-621 | Réglage | [Acrobat] Préférences > Langue : langue de l'interface et de la vérification orthographique | Absent | P3 | Interface 100 % française (strings.ts) sans sélecteur ; autres langues après finalisation (consigne du projet) |
| PD-622 | Réglage | [Acrobat] Préférences > Lecture : voix, vitesse, ordre de lecture | Absent | P2 | speech.ts figé en fr-FR ; voir Lecture à voix haute |
| PD-623 | Réglage | [Acrobat] Préférences > Recherche : index de recherche, options par défaut (casse, mot entier) | Absent | P3 | useText.ts options en état local, non persistées |
| PD-624 | Réglage | [Acrobat] Préférences > Mesure : échelle et unités | Absent | P3 | Dépend des outils de mesure |
| PD-625 | Réglage | [Acrobat] Préférences > Conversion vers / depuis PDF : qualité, profils | Absent | P3 | Paramètres des conversions dans packages/convert (Convert.tsx) ; pas de préférences côté module PDF |
| PD-626 | Réglage | [Acrobat] Préférences > Mise à jour automatique | Partiel | P3 | Services.updater de la suite ; pas de réglage dans le module |
| PD-627 | Réglage | [Acrobat] Chemin des outils externes (Ghostscript, ocrmypdf, MuPDF, LibreOffice) | Absent | P2 | crates/forge-convert/src/outils.rs détecte les outils sans chemin configurable ; capacites() signale leur absence (griser PDF/A, OCR) |
| PD-628 | Réglage | [Acrobat] Enregistrement incrémental ou complet (conserver les signatures existantes) | Absent | P1 | Toujours une réécriture complète (apply.ts doc.save useObjectStreams) : les signatures numériques déjà présentes deviennent invalides. Voir Signature > mise à jour incrémentale |
| PD-629 | Réglage | [Acrobat] Indicateur du moteur natif disponible dans la barre d'état | Présent à vérifier | P3 | PdfApp.tsx StatusBar (Moteur PDF natif ou Navigateur : outils natifs indisponibles) |
| PD-630 | Réglage | [Edge] Barre d'outils du lecteur ancrée ou masquée automatiquement | Absent | P3 | Ruban commun toujours affiché ; masquage = mode lecture |
## 16. Intégrations (système, autres modules de la suite, cloud, impression, mobile)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-631 | Intégration | [Acrobat] Ouvrir avec : lancement du module par double-clic ou ligne de commande sur un .pdf | Présent à vérifier | P1 | ModuleProps.file (packages/core/src/types.ts) consommé par PdfApp.tsx useEffect(d.load(file)) ; MODULES.pdf.extensions ['pdf'] ; association système non vérifiée ici |
| PD-632 | Intégration | [Edge] Définir ForgeOffice comme lecteur PDF par défaut du système | Absent | P2 | Option d'installation (association de fichier, ProgID) dans l'installeur et un réglage dans la suite |
| PD-633 | Intégration | [Acrobat] Glisser-déposer d'un fichier non PDF (image, Word) pour le convertir et l'ouvrir | Absent | P2 | PdfApp.tsx onDrop accepte tout fichier mais useDoc.ts load refuse un non-PDF (S.errors.notPdf). Router vers imagesToPdf ou convert natif |
| PD-634 | Intégration | [Acrobat] Convertisseur : traitements PDF par lots (fusion, rotation, filigrane, numérotation, compression, protection, PDF/A, OCR) | Présent à vérifier | P2 | packages/convert/src/pdf-batch.ts runPdfTool ; ribbon.ts onglet PDF du Convertisseur ; non exercé en parcours par cette revue |
| PD-635 | Intégration | [Acrobat] Convertisseur : PDF vers images et texte, images vers PDF | Présent à vérifier | P2 | packages/convert/src/formats.ts ('pdf-images', 'pdf-texte', 'images-pdf') ; engines.ts pdfPages/pdfText ; pdf-ops.ts imagesToPdf |
| PD-636 | Intégration | [Acrobat] Ouvrir le document courant dans le Convertisseur (conversions Office, ZIP, images) | Absent | P3 | services.openModule('convert', chemin) (types.ts) à brancher depuis le backstage |
| PD-637 | Intégration | [Acrobat] Exporter un PDF depuis les autres modules (Texte, Tableur, Présentation) puis l'ouvrir dans PDF | Absent | P2 | Aucun lien depuis le module PDF ; services.openDocument(file) disponible pour la bascule |
| PD-638 | Intégration | [Acrobat] Imprimante virtuelle « Imprimer en PDF » pour toute application Windows | Absent | P2 | Pilote d'impression Microsoft Print to PDF + dossier surveillé qui ouvre le résultat dans le module |
| PD-639 | Intégration | [Acrobat] Services cloud (Document Cloud, OneDrive, Google Drive, Dropbox, SharePoint) | Absent | P2 | Services.openFile/saveFile (types.ts) restent locaux ; fournisseurs en natif (OAuth) seulement si la règle zéro service payant le permet |
| PD-640 | Intégration | [Acrobat] Signature électronique via un fournisseur externe (Adobe Sign, DocuSign, Yousign) | Absent | P3 | Hors périmètre (service tiers payant) ; alternative locale : signature PKCS#12 (sign/pdfsign.ts) |
| PD-641 | Intégration | [Acrobat] Plug-in de création de PDF dans Word / Excel / Outlook (PDFMaker) | Absent | P3 | Les modules de la suite exportent eux-mêmes en PDF ; pas d'automatisation Office tiers |
| PD-642 | Intégration | [Edge] Ouvrir le PDF dans l'application système par défaut | Absent | P3 | Natif : enregistrer en temporaire puis shell open ; sans objet si l'utilisateur est déjà dans ForgeOffice |
| PD-643 | Intégration | [Edge] Ajouter à une collection, partager la page | Absent | P3 | Fonctions du navigateur Edge, sans équivalent prévu |
| PD-644 | Intégration | [Acrobat] Version mobile (Android / iOS) du module PDF | Partiel | P2 | Moteur pur Rust prévu pour mobile (crates/forge-convert/src/pdf/mod.rs) mais PDF/A, OCR et rendu externe exigent des outils de bureau ; interactions tactiles et stylet présentes (PageView.tsx, usePinchZoom) ; voir docs/MOBILE.md |
| PD-645 | Intégration | [Acrobat] Fonctionnement hors ligne complet, aucune donnée envoyée | Présent à vérifier | P1 | Aucun appel réseau dans packages/pdf (grep fetch/XMLHttpRequest) ; liens externes seulement après confirmation (LinkDialog) |
| PD-646 | Intégration | [Acrobat] Exécution de séquences d'actions sur un dossier surveillé | Absent | P3 | Voir Assistant d'actions ; watcher natif (notify) |
## 17. AU-DELÀ D'OFFICE : 20 idées pour dépasser Acrobat et Edge

Statut = état du socle existant (Absent si rien n'existe, Partiel si une brique du module ou du moteur est déjà là). Preuve / remarque = piste d'implémentation concrète.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| PD-A01 | Au-delà | [Acrobat] Résumé du document par IA locale (par page, par chapitre, global) sans envoi de données | Absent | P2 | Texte via allText (packages/pdf/src/pdfdoc.ts) découpé en passages ; modèle quantifié local (llama.cpp ou ONNX Runtime) lancé par la coquille Tauri en processus enfant ; volet Résumé avec liens goTo ; zéro service payant |
| PD-A02 | Au-delà | [Edge] Questions-réponses sur le document avec citations cliquables de pages | Absent | P2 | Index BM25 SQLite FTS5 (forge-base) des TextBox par page (textBoxes de pdfdoc.ts) + modèle local ; chaque réponse porte (page, rect) renvoyé à goTo(page, rect) de PdfApp.tsx |
| PD-A03 | Au-delà | [Acrobat] Extraction de tableaux vers Excel / CSV avec sélection de zone | Absent | P2 | Regrouper les TextBox par colonnes (clustering des x) et lignes (y) dans un nouveau tables.ts ; écriture xlsx par le natif (crates/forge-convert/src/conv/donnees.rs) ; aperçu sur la page avant export |
| PD-A04 | Au-delà | [Acrobat] Expurgation par motifs RGPD en un clic (e-mail, téléphone, IBAN, n° de sécurité sociale, carte, adresses) | Absent | P2 | Regex + validations (Luhn, IBAN mod 97, clé NIR) sur textBoxes via find.ts ; création d'Item redact en lot (PageView.tsx finish), rapport par catégorie, application par le natif caviarder (caviardage.rs) ; test sur le modèle de packages/pdf/tests/redact.test.ts |
| PD-A05 | Au-delà | [Acrobat] Diff visuel de deux PDF : surimpression colorée, curseur de fondu, liste des zones modifiées | Partiel | P2 | Brique existante : diff texte (model.ts diffLines, PdfApp.tsx compare). Ajouter rendu des deux pages (renderPage de pdfdoc.ts) et comparaison de pixels sur canvas avec seuil, boîtes englobantes cliquables |
| PD-A06 | Au-delà | [Acrobat] Pipeline de lots visuel (suite d'actions enregistrée, dossier surveillé, journal) | Partiel | P2 | Briques : Operation::Pdf avec actions chaînées (crates/forge-convert/src/operation.rs ActionPdf) et packages/convert/src/pdf-batch.ts. Ajouter éditeur de séquences JSON, exécution sur dossier (watcher natif), journal horodaté dans .logs/ |
| PD-A07 | Au-delà | [Acrobat] Rapport d'intégrité et empreinte vérifiable (SHA-256, signatures, révisions, modifications) exporté en PDF | Absent | P3 | crypto.subtle.digest sur state.bytes ; verifySignatures (sign/verify.ts) pour le détail ; page de garde générée avec pdf-lib et QR code de l'empreinte |
| PD-A08 | Au-delà | [Acrobat] Assistant « Prêt à partager » : assainir, caviarder, compresser et protéger en une checklist | Absent | P1 | Chaîner d.mutate : suppression des données masquées (à écrire, natif purge.rs), caviardage des motifs, compresser (dialogActions.ts nativeOp), chiffrer (pdfOps.encrypt) avec rapport avant/après |
| PD-A09 | Au-delà | [Edge] Index de recherche local de tout un dossier de PDF avec vignettes des résultats | Absent | P2 | Table SQLite FTS5 (forge-base) alimentée par allText ; panneau Recherche étendu (find.ts search pour la mise en évidence) ; mise à jour incrémentale par date de fichier |
| PD-A10 | Au-delà | [Acrobat] Annotation vocale : dictée locale transcrite en note (modèle Whisper embarqué) | Absent | P3 | MediaRecorder + transcription locale par le natif ; Item note créé avec le texte, audio joint en pièce jointe optionnelle |
| PD-A11 | Au-delà | [Edge] Traduction locale du document avec mise en page conservée | Absent | P3 | Modèle de traduction local sur chaque TextBox ; remplacement par l'action corriger_texte du natif (caviardage.rs corriger) ou calque superposé optionnel ; contrôle visuel avant enregistrement |
| PD-A12 | Au-delà | [Acrobat] Mode étude : surlignage par catégorie sémantique et export des surlignages en fiche (Markdown, CSV) | Absent | P3 | Couleurs du surlignage (model.ts MARK_COLORS) associées à des catégories nommées dans settings ; export des Item mark (text, page) groupés par couleur |
| PD-A13 | Au-delà | [Acrobat] Liste de contrôle du dossier : champs obligatoires, signatures et pièces manquantes avec navigation | Absent | P2 | d.fields (useDoc.ts) filtré sur obligatoire et vide + champs de signature non signés (forms.ts signed) ; volet avec saut au champ et barre de progression |
| PD-A14 | Au-delà | [Acrobat] Réparation automatique des PDF corrompus (xref reconstruit) avec rapport | Absent | P2 | useDoc.ts load échoue sur un fichier endommagé ; lopdf natif reconstruit la table xref : action « reparer » à ajouter à ActionPdf (operation.rs) et proposition à l'ouverture |
| PD-A15 | Au-delà | [Edge] Rendu par tuiles et cache disque pour très gros PDF (plans A0, milliers de pages) | Partiel | P2 | Existant : rendu paresseux par IntersectionObserver (PageView.tsx). Ajouter pavage du canevas, libération hors écran, cache des tuiles par page/zoom |
| PD-A16 | Au-delà | [Acrobat] Revue collaborative sans serveur : fusion de plusieurs jeux de commentaires (XFDF) avec dédoublonnage et statistiques | Absent | P2 | Export/import XFDF (voir Annotation) ; fusion par (page, rect, auteur, date) ; volet Commentaires (SidePanels.tsx) avec compteurs par relecteur et statut |
| PD-A17 | Au-delà | [Edge] Accessibilité assistée : texte alternatif local, balisage heuristique, vérificateur PDF/UA avec corrections guidées | Absent | P2 | Légendage d'images par modèle local ; écriture de /StructTreeRoot et /Alt par pdf-lib ou lopdf ; boucle vérifier-corriger dans un volet Accessibilité |
| PD-A18 | Au-delà | [Acrobat] Signature en lot avec cachet d'organisation et PAdES-LTA (horodatage + validation longue durée) | Absent | P2 | Étendre sign/pdfsign.ts (ETSI.CAdES.detached, horodatage RFC 3161, /DSS) ; boucle sur une liste de fichiers ; journal des signatures |
| PD-A19 | Au-delà | [Acrobat] Remplissage automatique des formulaires depuis un profil local chiffré (identité, adresse, IBAN) avec correspondance des champs par libellé | Absent | P2 | Profil dans services.settings chiffré par une clé locale ; correspondance par nom de champ et texte voisin (forms.ts readFields + textBoxes) ; proposition champ par champ avant d.setValue, jamais d'envoi réseau |
| PD-A20 | Au-delà | [Edge] Lecture à voix haute neuronale hors ligne avec mot surligné et export audio d'un chapitre | Absent | P3 | Moteur TTS local (Piper) côté natif ; onboundary/horodatages vers hitRect (find.ts) pour le surlignage ; export WAV par chapitre de signet |
