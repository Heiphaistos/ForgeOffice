# Interface tactile (téléphone et tablette)

Branche `feat/mobile-ui` (code web des modules uniquement). Vérifié avec de vrais événements tactiles du protocole Chrome
(`Input.dispatchTouchEvent`, `Input.imeSetComposition`), pas avec des clics souris : `apps/web/tests/e2e/touchkit.mjs` (gestes) et
`apps/web/tests/e2e/flows-touch.mjs` (parcours 7, 24 contrôles : `node apps/web/tests/e2e/flows.mjs 7`). Le parcours 6
(`flows-mobile.mjs`) mesure toujours la disposition à 400 px. Émulations : 390x844 (téléphone), 820x1180 (tablette portrait), 1180x820
(tablette paysage), 844x390 (téléphone paysage), tactile, échelle 2. Captures : `docs/captures/mobile2-*.png`.

## Socle `packages/ui`

| Élément | Fichier | Comportement |
|---|---|---|
| Mode d'appareil | `logic/touch.ts` (`deviceMode`, `ribbonLayoutFor`), `touch.ts` | `data-fo-form` (phone / tablet / desktop), `data-fo-orient`, `data-fo-touch` sur `<html>` ; hook `useDeviceMode()` |
| Cibles de 44 px | `touch.css` (chargé en dernier) | menus, boutons, champs, cases, interrupteurs, curseur de zoom, onglets, barre d'état, volets, dialogues |
| Appui long = menu contextuel | `touch.ts` `installTouchSupport` | un doigt immobile 500 ms envoie `contextmenu` (donc `useContextMenu` partout) ; pas dans un texte éditable (l'appui long y sélectionne un mot) ; le clic qui suit est avalé ; une zone peut s'exclure (`data-fo-own-longpress`, grille du Tableur) |
| Infobulles | `Tooltip.tsx` | pas de survol : l'appui long affiche l'infobulle 2,8 s |
| Pas de zoom de page ni de sélection parasite | `touch.css`, `installTouchSupport` | `touch-action: pan-x pan-y`, `maximum-scale=1`, `gesturestart` annulé (iOS), `user-select: none` sur l'interface |
| Zones sûres, `100dvh` | `touch.css` | `env(safe-area-inset-*)` sur barre de titre, d'état, volets, Backstage, dialogues, notifications ; coquille en `var(--fo-vvh, 100dvh)` |
| Clavier virtuel | `touch.ts` | fenêtre visuelle (`visualViewport`) -> `--fo-vvh`, `--fo-kb`, classe `fo-kb-open` ; le curseur de saisie reste visible (`scrollDeltaToReveal`) |
| Barre au-dessus du clavier | `components/KeyboardBar.tsx` | boutons de 44 px qui ne volent pas le focus, repli dans « Plus » (`foldToolbar`) ou défilement ; remplace la barre d'état pendant la saisie |
| Ruban | `Ribbon.tsx`, `touch.css` | téléphone : bande d'onglets défilante de 44 px, ruban simplifié défilant ; tablette portrait : ruban simplifié ; tablette paysage : ruban complet (rangées de 44 px) ; téléphone paysage : ruban replié, ouvert en flottant par un onglet ; ruban replié : poignée chevron pour le rouvrir, un appui sur un onglet le rouvre |

## État par application

| Application | État tactile | Prouvé par (événements) | Limites |
|---|---|---|---|
| Accueil | corrigé : vignettes agrandies (téléphone), rail latéral et accueil à deux volets (nouveau + récents) en tablette paysage, lignes de 44 px | appui long (`touchStart` tenu 800 ms) -> menu contextuel, lignes de 44 px | réouverture d'un récent impossible dans le navigateur (pas de chemin) |
| Texte | corrigé : barre de mise en forme flottante (annuler, gras, italique, souligné, barré, listes, alignements, retrait), saisie IME, pincement, ruban tablette | `imeSetComposition` + `insertText` ('café'), double toucher = sélection, touche sur « Gras » avec sélection, pincement 70 -> 175 % avec `visualViewport.scale` = 1 | l'appui long de sélection de mot et les poignées de sélection sont ceux du navigateur : non reproduits par l'émulation de bureau ; clavier simulé par la fenêtre visuelle |
| Tableur | corrigé : un doigt défile avec inertie, appui long = sélection puis glisser, appui long sans glisser = menu, double toucher = édition, mode « Sélection / Défilement » (bouton), poignées début/fin et recopie de 44 px, barre de formule 46 px, barre de signes au-dessus du clavier, pincement | `touchMove` (C14 -> C33), appui long + glisser (B26:E26), poignée de fin (jusqu'à H37), double toucher, bascule, pincement 100 -> 250 % | redimensionner une colonne au doigt seulement en mode Sélection |
| Présentation | corrigé : un doigt sur le fond fait défiler, deux doigts = pincement + défilement, poignées de 44 px (taille, rotation, ajustement), barre d'objets flottante (dupliquer, premier plan, supprimer, menu), diaporama : balayage, pincement pour quitter, boutons de 44 px | redimensionnement par poignée (`touchMove`), barre d'objets, balayage gauche/droite, pincement 200 -> 60 px | pendant l'édition d'un texte la barre d'objets est masquée et le glisser sélectionne le texte ; le plein écran réel demande une vraie activation utilisateur ; la rotation par poignée n'a pas été rejouée |
| Publication | corrigé : même canevas que Présentation, règles masquées sur téléphone, bandeau de pages, « Page entière » 44 px | règles absentes à 390 px | pas de réorganisation des pages au glisser |
| Base de données | corrigé : navigation 44 px, volet 280 px en tablette, jointures par glisser au doigt (appui long sur un champ), tables déplaçables par l'en-tête, appui long = menu de l'objet | appui long -> menu, `touchMove` d'un en-tête de table, appui long + glisser d'un champ vers un champ (2 -> 3 liens) | formulaires à mise en page fixe : défilement dans la zone ; la création reste réservée à l'application installée |
| PDF | corrigé : pincement, défilement natif, annotation au doigt ou au stylet (`pointerType` pen/touch, pression -> épaisseur, rejet de la paume 1,5 s), un deuxième doigt annule le tracé | pincement 100 -> 250 %, défilement 0 -> 235, trait au doigt (polyligne créée) | pression : calcul testé, mais le stylet n'a pas pu être rejoué par l'émulation ; pas de redimensionnement des annotations |
| Bloc-notes | corrigé : barre de raccourcis (Tab, désindenter, annuler/rétablir, flèches, 22 signes), onglets de 44 px défilants | IME dans CodeMirror, `(`, Tab, annuler | sélection par poignées : celle du navigateur |
| Convertisseur | corrigé : pas de dépôt (bouton « Touchez pour choisir des fichiers »), « Ajouter un dossier » masqué (ruban et zone vide), listes à 46 px | titre de l'état vide, absence du bouton dossier | colonnes Taille et État masquées sur téléphone (par conception) |

## Limites générales

- Le clavier virtuel est simulé (la fenêtre visuelle est réduite) : le vrai clavier d'Android/iOS et la prédiction ne sont vérifiés que par la composition IME simulée.
- Quelques cibles restent sous 44 px dans leur petite dimension : interrupteur d'enregistrement automatique (zone de toucher étendue, rond de 28 px), lanceurs de dialogue du ruban (zone étendue de 24 à 44 px), flèches de listes et de couleurs du ruban de tablette paysage (32 px de large, 44 px de haut), cellule en cours d'édition (taille de la cellule).
- Aucun test sur matériel : tout est émulé (Chromium sans interface).
- Le bouton Retour d'Android et la confirmation « Enregistrer / Ne pas enregistrer / Annuler » : le hook `useConfirmDiscard` de `@forgeoffice/ui` propose déjà « Enregistrer » (il reçoit la fonction `save`) ; le garde de sortie propre à la coquille Android relève de l'autre worktree.

## Disposition 400 px (2026-11-04)

Barre d'état défilante, volet de diapositives réduit, page A4 ajustée à la largeur, actions du Convertisseur en icônes, listes déroulantes élargies (voir `docs/captures/mobile-*.png`). La liste d'onglets du ruban (`<select>`) a été remplacée par la bande d'onglets défilante.

## Mobile complet (2026-11-05, branche `feat/mobile2`) : « toutes les fonctionnalités, sur tous les appareils »

Constat de départ (banc 390x844, Texte > Accueil) : le ruban simplifié contenait bien les 48 commandes, mais dans une piste de 2167 px vue par une fenêtre de
284 px, sans étiquette de groupe, sans indicateur de position, sans ombre de défilement, sans calage ; les listes (police, taille) tenaient dans des petites
fenêtres ancrées ; les menus étaient des popovers de bureau ; la liste des styles débordait. Rien ne signalait qu'il y avait une suite : « on ne peut même
pas centrer le texte » (le bouton Centrer était la 36e icône).

| Élément | Où | Comportement |
|---|---|---|
| Bande du ruban | `components/ribbon/MobileBand.tsx`, `logic/mobileRibbon.ts`, `mobile.css` | téléphone : l'onglet actif = TOUS ses groupes et TOUTES ses commandes en une bande défilante au doigt (calage par groupe, ombres de défilement, curseur de position, étiquette de groupe sous chaque groupe, lanceurs de dialogue de 44 px, champs numériques avec étiquette et boutons -/+ de 44 px) ; tablette : la même bande passe à la ligne (ruban complet sur plusieurs rangées, sans défilement horizontal) ; chaque cellule porte `data-cmd=<id du schéma>` |
| Feuilles du bas | `mobile.css` (Menu, Popover) | sur téléphone TOUT menu, galerie, palette de couleurs, liste (police, taille, formats de nombre...) et menu contextuel s'ouvre en feuille du bas pleine largeur (voile, poignée, 44 px par ligne) ; un sous-menu remplace la feuille avec un bouton « Retour » ; Échap (touche Retour d'Android) ferme le menu du dessus même si le focus est reparti vers l'éditeur |
| Dialogues plein écran | `Dialog.tsx`, `mobile.css` | téléphone : plein écran (hauteur = fenêtre visible, donc clavier géré), en-tête « Retour / titre / OK », corps défilant ; le pied de page est masqué quand il ne contient que OK/Annuler par défaut |
| Toutes les commandes | `components/CommandSheet.tsx` | bouton loupe toujours visible à droite des onglets (téléphone et tablette) : feuille avec recherche et TOUTES les commandes du ruban, groupées par onglet > groupe, exécutables en un toucher (même source que Alt+Q : `collectCommands`) |
| Barre au-dessus du clavier | `KeyboardBar.tsx`, `itemsFromTab()` | défilante, boutons de 44 px, menus en feuille du bas (couleur de police, surlignage, styles), bouton « Fermer le clavier » ; `itemsFromTab(tab, ids)` construit la barre À PARTIR DU RUBAN (mêmes fonctions, donc mêmes effets) : Texte (gras, italique, souligné, barré, couleur, surlignage, A-/A+, 4 alignements, listes, retraits, styles, annuler/rétablir), Tableur (en saisie de cellule : gras, italique, souligné, couleurs, alignements, renvoi, fusion, formats, bordures + signes de formule), Présentation et Publication (pendant l'édition d'un texte de forme) |
| Mini-barre de sélection | `SelectionMiniToolbar.tsx` (`useSelectionMiniToolbar`) | près du texte sélectionné (sous la sélection, pour ne pas masquer le menu natif ni les poignées) : couper, copier, coller, gras, italique, souligné, centrer, couleur ; branchée dans Texte |
| Menu contextuel du texte | `packages/word/src/ui/contextMenu.ts`, `groupsToMenu()` | Texte n'avait AUCUN menu contextuel (ni clic droit ni appui long) : presse-papiers + sous-menus Police / Paragraphe / Styles (toutes les commandes des groupes du ruban) + lien + rechercher, et, selon la sélection, les groupes des onglets Tableau ou Image |
| Schéma exposé au banc | `Ribbon.tsx` (`?e2e=1`) | `window.__FO_RIBBON__.schema()` renvoie onglets > groupes > commandes (id, genre, libellé, désactivé) calculés par `ribbonSchema(tabs)` ; c'est la source du test de couverture, à relier à l'outil de conformité par commande |

### Test de couverture (le filet contre la régression)

`node apps/web/tests/e2e/mobile-coverage.mjs [module ...] [--tablet] [--no-tap] [--tab=<id>]` (banc sur le port 5391 ; `FO_BASE`, `FO_CDP_PORT`).
Pour chaque module, chaque onglet, chaque commande DU SCHÉMA (pas du DOM) : présente dans la bande, tous ses contrôles interactifs >= 44 px, entièrement dans la
fenêtre une fois amenée à l'écran, non recouverte (`elementFromPoint`), puis VRAI toucher (`Input.dispatchTouchEvent`) : une feuille/un dialogue s'ouvre ou l'état de la
page change ; sinon la commande est listée « sans effet visible » (information : copier sans sélection, annuler sans historique, bascules dont l'effet est dans un canevas...).
Entre deux touchers : Échap, puis rechargement (stockage vidé) si le ruban est recouvert ou a disparu (mode lecture, diaporama, palette). Échec (code 1) si une commande est
introuvable, trop petite, hors écran, recouverte, ou si le toucher fait planter le module. La feuille « Toutes les commandes » est ouverte et interrogée.
Logique pure : `packages/ui/tests/mobileRibbon.test.ts` (aplatissement, groupes, schéma, calage, ombres, sections, `groupsToMenu`) et `touch.test.ts` (position de la mini-barre).

### Résultats (2026-11-05)

Téléphone 390x844 (toucher réel de chaque commande) et tablette 820x1180 (présence, taille, recouvrement) : **689 commandes sur 689 atteignables, 0 exception levée** (`mobile-coverage.mjs`).

| Module | Onglets | Commandes | Atteignables (téléphone) | Atteignables (tablette) |
|---|---|---|---|---|
| Texte | 9 | 139 | 139 | 139 |
| Tableur | 7 | 128 | 128 | 128 |
| Présentation | 9 | 125 | 125 | 125 |
| Publication | 6 | 91 | 91 | 91 |
| Base de données (démonstration) | 4 | 45 | 45 | 45 |
| PDF | 6 | 62 | 62 | 62 |
| Bloc-notes | 4 | 77 | 77 | 77 |
| Convertisseur | 3 | 22 | 22 | 22 |

La feuille « Toutes les commandes » liste 317 (Texte), 878 (Tableur), 598 (Présentation), 319 (Publication), 58 (Base), 76 (PDF), 108 (Bloc-notes) et 17 (Convertisseur) entrées (commandes + éléments de menu et de galerie).
`mobile-acts.mjs` (Texte, toucher réel, effet lu dans le document) : 21 vérifications, dont centrer au doigt depuis la barre du clavier ET depuis le ruban, justifier, gras, italique, souligné, taille, couleur (palette en feuille du bas), puces, annuler, menu contextuel en feuille du bas, insertion d'une image, redimensionnement par la poignée de 44 px (168x84 -> 258x129, proportions gardées), rotation par la poignée.

Anomalies RÉELLES trouvées et corrigées par ces tests (les « options qui ne fonctionnent pas ») :
- Texte, onglet Format de l'image : largeur, hauteur, rotation, retournement, texte alternatif ne s'appliquaient JAMAIS (`updateAtom` : `RangeError`, sélection créée sur l'ancien document) ; corrigé dans `packages/word/src/editor/commands.ts`.
- `Menu` : `focus()` appelé alors que le menu était encore invisible (jamais pris), et Échap (touche Retour d'Android) ne fermait pas un menu quand le focus était resté dans l'éditeur ; corrigé.
- Publication > Insertion > Date et heure : plantage (hook React appelé sous condition dans la barre du clavier, introduit puis corrigé pendant ce lot).

### Preuves sur Android réel (émulateur Pixel 6 x86_64, APK debug construit depuis cette branche)

Touchers et saisie par `adb input` (vrai clavier Gboard, vraie WebView) ; l'état est relu par le protocole de débogage de la WebView (debug seulement). Captures `docs/captures/mobile3-android-*.png` :

| Scénario | Résultat | Capture |
|---|---|---|
| Texte : saisie réelle (« Bonjour ForgeOffice sur Android ») avec le clavier Android ouvert | la barre de mise en forme défilante est collée au-dessus du clavier | `mobile3-android-centre-barre.png` |
| Centrer depuis la barre au-dessus du clavier | `text-align: center` appliqué | `mobile3-android-centre-barre.png` |
| Centrer depuis le ruban (groupe Paragraphe, bande défilante) | `center`, bouton enfoncé | `mobile3-android-centre-ruban.png` |
| Gras (ruban), couleur de police rouge (palette en feuille du bas) | poids 700, `rgb(255, 0, 0)` | `mobile3-android-feuille-couleurs.png` |
| Sélection + mini-barre près du texte | couper/copier/coller, B/I/U, centrer, couleur | `mobile3-android-mini-barre.png` |
| Appui long sur le texte | poignées natives + menu contextuel complet en feuille du bas | `mobile3-android-appui-long.png` |
| Image : insertion par le sélecteur système, toucher, glisser la poignée (336 -> 396 px), glisser la poignée de rotation | redimensionnée et pivotée | `mobile3-android-image-redim.png` |
| Tableur : saisie par la barre de formule, cellule A1 en gras + centré + fond jaune | appliqué | `mobile3-android-tableur-format.png` |
| Présentation : forme sélectionnée (poignées de 44 px), couleur de remplissage jaune depuis l'onglet Format de la forme | appliqué | `mobile3-android-presentation-couleur.png` |
| Bouton Retour dans un classeur modifié | dialogue plein écran « Modifications non enregistrées » (Retour / Rester) | (vu pendant la preuve) |

Limites constatées sur l'appareil : le glisser d'une forme pendant l'édition de son texte sélectionne le texte (il faut quitter l'édition) ; l'APK installé pour ces preuves précède deux retouches visuelles (mini-barre bornée sous le ruban, groupe Diapositives de Présentation sur une ligne) vérifiées seulement dans le navigateur ; le menu contextuel est construit avant que la sélection native soit recopiée dans le modèle (Couper/Copier grisés au premier appui long sur un mot) ; la page A4 de Texte reste plus large que l'écran à 70 % (défilement horizontal, comportement antérieur).


### Reste / limites

- Les commandes « sans effet visible » ne prouvent pas que l'effet est correct : seule la conformité par commande (modèle avant/après) le fait ; le test de couverture prouve qu'aucune commande n'est inatteignable ni inertes au toucher (ouverture ou changement d'état).
- Un onglet contextuel (tableau, image, forme...) n'est couvert que s'il est visible au démarrage ; ses commandes restent dans la feuille « Toutes les commandes » et dans les menus contextuels.
- Palette de couleurs : 10 colonnes sur 390 px = pastilles de ~36 px (sous 44 px), le reste de la feuille est en lignes de 44 px.
- Le mode Lecture (Texte) et le diaporama masquent le ruban comme sur bureau : on en sort par Échap / le bouton Retour d'Android.
