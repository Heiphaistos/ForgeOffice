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
