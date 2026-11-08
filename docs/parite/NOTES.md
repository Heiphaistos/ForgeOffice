# Audit de parité du module Bloc-notes de ForgeOffice

Date : 2026-11-05 (lignes mises à jour le 2026-11-07 : statut OK ou Partiel avec preuve citée ; scripts « banc » dans `packages/notes/tests/e2e/`). Totaux recalculés le 2026-11-07. Paquet audité : `packages/notes` (CodeMirror 6, React). Chemins de preuve relatifs à `packages/notes/`.

## Méthode

- Références décrites de mémoire (connaissance du produit, versions récentes) : Bloc-notes de Windows 11 (11.2x), Notepad++ 8.x, WinNote 0.6.0 (`INVENTAIRE-WINNOTE.md`), VS Code et Obsidian. Aucune application de référence n'a été lancée.
- Code lu : `src/commands.ts` (registre des commandes), `src/ribbon.ts`, `src/ui/*`, `src/editor/*`, `src/logic/*`, `src/workspace.ts`, `src/NotesApp.tsx`, `src/strings.ts`, `src/notes.css`, plus les jeux de touches de `@codemirror/commands`, `@codemirror/search` et `@codemirror/language` installés.
- Chaque statut OK, Présent à vérifier ou Partiel renvoie à un fichier et à un identifiant présents dans le code (vérifié par script : tout identifiant cité entre accents graves est retrouvé dans `src/`, `tests/` ou `STATUS.md`). `STATUS.md` n'a pas été pris pour argent comptant : plusieurs lignes de `INVENTAIRE-WINNOTE.md` sont nuancées (section 22).
- Les entrées « Absent » décrivent l'implémentation visée (extension ou paquet CodeMirror 6, ou contrat `@forgeoffice/core` à étendre).

## Légende

- Statut `OK` : effet prouvé par un test automatisé du paquet (`tests/*.test.ts`) ou par un parcours / une capture cités dans `STATUS.md`.
- Statut `Présent à vérifier` : code lu et présent, effet non prouvé par un test ni un parcours cité.
- Statut `Partiel` : la fonction existe mais incomplète, sous une autre touche, ou limitée (le reste est dit en remarque).
- Statut `Absent` : rien dans le code.
- Priorité `P1` : attendu par un utilisateur quotidien, manque visible. `P2` : confort ou usage avancé courant. `P3` : niche. Pour un OK, la priorité que la fonction aurait.
- Source entre crochets en tête de fonction : `[Win11]` Bloc-notes Windows 11, `[N++]` Notepad++, `[WinNote]`, `[VSCode]`, `[Obsidian]`.
- Types : Menu, Menu contextuel, Dialogue, Édition, Recherche, Affichage, Encodage, Fichier, Langage, Raccourci, Thème/Réglage, Intégration, Au-delà (section finale).
- Les ID `NT-001` à `NT-830` sont continus ; les idées de la dernière section sont `NT-A01` à `NT-A20`.

## Récapitulatif par type

| Type | OK | Présent à vérifier | Partiel | Absent | Total | Part Absent |
|---|---|---|---|---|---|---|
| Menu | 17 | 36 | 13 | 54 | 120 | 55 % |
| Menu contextuel | 3 | 23 | 9 | 45 | 80 | 44 % |
| Dialogue | 4 | 11 | 11 | 14 | 40 | 65 % |
| Édition | 29 | 21 | 12 | 64 | 126 | 49 % |
| Recherche | 4 | 4 | 6 | 21 | 35 | 40 % |
| Affichage | 5 | 21 | 24 | 48 | 98 | 51 % |
| Encodage | 9 | 4 | 4 | 24 | 41 | 41 % |
| Fichier | 6 | 7 | 8 | 11 | 32 | 66 % |
| Langage | 1 | 28 | 5 | 17 | 51 | 67 % |
| Raccourci | 13 | 27 | 13 | 15 | 68 | 78 % |
| Thème/Réglage | 8 | 36 | 20 | 47 | 111 | 58 % |
| Intégration | 0 | 7 | 1 | 20 | 28 | 29 % |
| Au-delà | 0 | 1 | 1 | 18 | 20 | 10 % |
| **Total hors Au-delà** | 99 | 225 | 126 | 380 | 830 | 54 % |
| **Total général** | 99 | 226 | 127 | 398 | 850 | 53 % |

Taux hors Au-delà : OK 11.9 %, Présent à vérifier 27.1 %, Partiel 15.2 %, Absent 45.8 % (830 entrées).

## 1. Bloc-notes de Windows 11 : menus Fichier, Édition, Format, Affichage

> Menus du Bloc-notes 11.2x. Le ForgeOffice Bloc-notes expose ces commandes dans le ruban, les menus classiques (option) et la palette.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-001 | Menu | [Win11] Fichier > Nouvel onglet (Ctrl+N) | Présent à vérifier | P1 | src/commands.ts `new` |
| NT-002 | Menu | [Win11] Fichier > Nouvelle fenêtre (Ctrl+Maj+N) | Présent à vérifier | P2 | src/commands.ts `newWindow` (services.openModule) |
| NT-003 | Menu | [Win11] Fichier > Ouvrir… (Ctrl+O) | Présent à vérifier | P1 | src/commands.ts `open` -> src/workspace.ts `openDialog` |
| NT-004 | Menu | [Win11] Fichier > Fichiers récents (sous-menu, 15 entrées) | Présent à vérifier | P2 | src/ribbon.ts `recent` (buildMenus), services.recentFiles |
| NT-005 | Menu | [Win11] Fichier > Enregistrer (Ctrl+S) | OK | P1 | src/commands.ts `save` -> src/workspace.ts `save` |
| NT-006 | Menu | [Win11] Fichier > Enregistrer sous… (Ctrl+Maj+S) | OK | P1 | src/commands.ts `saveAs` |
| NT-007 | Menu | [Win11] Fichier > Enregistrer tout (Ctrl+Alt+S) | Présent à vérifier | P2 | src/commands.ts `saveAll` |
| NT-008 | Menu | [Win11] Fichier > Mise en page… (papier, orientation, marges, en-tête, pied) | Absent | P2 | src/logic/print.ts `pageCss` fixe les marges à 18 mm ; ajouter un dialogue qui produit @page size/margin et des variables d'en-tête |
| NT-009 | Menu | [Win11] Fichier > Imprimer… (Ctrl+P) | Présent à vérifier | P1 | src/commands.ts `print` -> src/dom-actions.ts `printText` (feuille @page, boîte d'impression du système) |
| NT-010 | Menu | [Win11] Fichier > Fermer l'onglet (Ctrl+W) | Présent à vérifier | P1 | src/commands.ts `close` (invite Enregistrer/Ne pas enregistrer/Annuler) |
| NT-011 | Menu | [Win11] Fichier > Fermer la fenêtre (Ctrl+Maj+W) | Partiel | P2 | src/commands.ts `quit` ferme la fenêtre mais n'a pas le raccourci Ctrl+Maj+W |
| NT-012 | Menu | [Win11] Fichier > Quitter | Présent à vérifier | P2 | src/commands.ts `quit` (propose d'enregistrer chaque onglet modifié) |
| NT-013 | Menu | [Win11] Édition > Annuler (Ctrl+Z) | Présent à vérifier | P1 | src/commands.ts `undo` (historique par onglet) |
| NT-014 | Menu | [Win11] Édition > Couper / Copier / Coller / Supprimer | Présent à vérifier | P1 | src/commands.ts `cut` `copy` `paste` `del` |
| NT-015 | Menu | [Win11] Édition > Rechercher avec Bing (Ctrl+E) | Absent | P3 | commande qui ouvre un moteur configurable (window.open) sur la sélection ; Ctrl+E est déjà pris par l'ouverture rapide |
| NT-016 | Menu | [Win11] Édition > Rechercher (Ctrl+F) | OK | P1 | src/commands.ts `find` -> CodeMirror `openSearchPanel` |
| NT-017 | Menu | [Win11] Édition > Rechercher suivant / précédent (F3, Maj+F3) | Présent à vérifier | P1 | src/commands.ts `findNext` `findPrev` |
| NT-018 | Menu | [Win11] Édition > Remplacer (Ctrl+H) | OK | P1 | src/commands.ts `replace` |
| NT-019 | Menu | [Win11] Édition > Atteindre… (Ctrl+G) | Présent à vérifier | P1 | src/commands.ts `gotoLine` (accepte aussi ligne:colonne) |
| NT-020 | Menu | [Win11] Édition > Tout sélectionner (Ctrl+A) | Présent à vérifier | P1 | src/commands.ts `selectAll` |
| NT-021 | Menu | [Win11] Édition > Heure/Date (F5) | OK | P2 | src/commands.ts `dateTime` -> src/logic/lines.ts `dateTimeStamp` |
| NT-022 | Menu | [Win11] Édition > Police… | Présent à vérifier | P2 | src/commands.ts `font` -> src/ui/Dialogs.tsx `FontDialog` |
| NT-023 | Menu | [Win11] Format > Retour automatique à la ligne | Présent à vérifier | P1 | src/commands.ts `wrap` |
| NT-024 | Menu | [Win11] Affichage > Zoom avant / arrière / Rétablir le zoom par défaut | Présent à vérifier | P1 | src/commands.ts `zoomIn` `zoomOut` `zoomReset` (10 à 500 %, Ctrl+molette) |
| NT-025 | Menu | [Win11] Affichage > Barre d'état | Présent à vérifier | P2 | src/commands.ts `statusBar` |
| NT-026 | Affichage | [Win11] Barre d'état : Ln/Col, caractères, zoom, fins de ligne, encodage | Présent à vérifier | P1 | src/ui/StatusLine.tsx `StatusLine` (position, sélection, caractères, langage, EOL, encodage, curseur de zoom) |
| NT-027 | Affichage | [Win11] Clic sur Fins de ligne / Encodage dans la barre d'état | Présent à vérifier | P1 | src/ui/StatusLine.tsx `onPick('eol')` `onPick('encoding')` -> src/ui/Palette.tsx |
| NT-028 | Menu | [Win11] Écrire (Copilot : générer du texte à partir d'une consigne) | Absent | P3 | service payant exclu ; modèle local via services.native (voir NT-A04) avec bouton Écrire dans le ruban |
| NT-029 | Menu | [Win11] Réécrire (Copilot : ton, longueur, reformulation de la sélection) | Absent | P3 | même mécanisme que Écrire : sélection -> modèle local -> aperçu diff -> accepter |
| NT-030 | Menu | [Win11] Résumer (Copilot) | Absent | P3 | même mécanisme : résumé de la sélection ou du document inséré en tête |
| NT-031 | Menu | [Win11] Barre de mise en forme Markdown : Gras (Ctrl+B) | OK | P2 | commande qui entoure la sélection de ** (changeByRange) ; Ctrl+B libre (pas lié à l'accolade correspondante) Fait 2026-11-07 : Ctrl+B met en gras (**). tests/markdown.test.ts + banc CDP packages/notes/tests/e2e/md.mjs (vraies touches Ctrl+B/I/K) + capture md-ribbon.png. |
| NT-032 | Menu | [Win11] Barre de mise en forme Markdown : Italique (Ctrl+I) | OK | P2 | entourer de _ ; Ctrl+I est pris par CodeMirror `selectParentSyntax`, à réaffecter en mode Markdown Fait 2026-11-07 : Ctrl+I met en italique (*) ; « Étendre la sélection » (selectParentSyntax) passe à Alt+Maj+→. tests/markdown.test.ts + banc CDP packages/notes/tests/e2e/md.mjs (vraies touches Ctrl+B/I/K) + capture md-ribbon.png. |
| NT-033 | Menu | [Win11] Barre de mise en forme Markdown : Lien hypertexte (Ctrl+K) | OK | P2 | transformer la sélection en [texte](url) avec invite d'adresse Fait 2026-11-07 : Ctrl+K crée [texte](https://) avec l'adresse sélectionnée. tests/markdown.test.ts + banc CDP packages/notes/tests/e2e/md.mjs (vraies touches Ctrl+B/I/K) + capture md-ribbon.png. |
| NT-034 | Menu | [Win11] Barre de mise en forme Markdown : listes à puces / numérotées | Partiel | P2 | la continuation de liste à Entrée existe (lang-markdown markdownKeymap) mais pas de bouton de bascule de liste |
| NT-035 | Menu | [Win11] Barre de mise en forme Markdown : titres (H1 à H6) | Absent | P2 | commandes qui préfixent la ligne par # ; menu Titre dans le ruban |
| NT-036 | Menu | [Win11] Bascule Markdown / texte brut | Partiel | P2 | src/commands.ts `preview` (aperçu) et `language` (Texte brut / Markdown) mais pas de bascule unique de l'affichage mis en forme |
| NT-037 | Fichier | [Win11] Enregistrement automatique de l'état (onglets restaurés sans demander d'enregistrer) | OK | P1 | src/workspace.ts `persist` `restore`, src/logic/session.ts `claimSession` (toutes les 5 s si changement) |
| NT-038 | Dialogue | [Win11] Invite « Voulez-vous enregistrer les modifications ? » à la fermeture | Présent à vérifier | P1 | src/ui/Dialogs.tsx `SaveDialog` |
| NT-039 | Thème/Réglage | [Win11] Paramètres : thème de l'application (clair, sombre, système) | Partiel | P2 | src/logic/prefs.ts `theme` : Office 2024 suit le thème de la suite, plus 17 thèmes ; pas d'entrée « Système » explicite |
| NT-040 | Thème/Réglage | [Win11] Paramètres : police (famille, style, taille) | Partiel | P3 | src/ui/Dialogs.tsx `FontDialog` : famille, taille, tabulation, marge, interligne ; pas de style gras/italique |
| NT-041 | Thème/Réglage | [Win11] Paramètres : retour automatique à la ligne | Présent à vérifier | P1 | src/logic/prefs.ts `wrap` |
| NT-042 | Thème/Réglage | [Win11] Paramètres : ouvrir les fichiers dans un nouvel onglet ou une nouvelle fenêtre | Absent | P3 | réglage `openIn` dans NotesPrefs ; src/workspace.ts `openFile` ouvre toujours un onglet |
| NT-043 | Thème/Réglage | [Win11] Paramètres : restaurer la session précédente (activer/désactiver) | Partiel | P3 | toujours actif (src/NotesApp.tsx `ws.restore`) ; ajouter un booléen de préférence |
| NT-044 | Thème/Réglage | [Win11] Paramètres : correcteur orthographique | Partiel | P2 | src/commands.ts `spell` + `spellLang:*` (attribut spellcheck/lang du moteur web) |
| NT-045 | Thème/Réglage | [Win11] Paramètres : correction automatique | Absent | P3 | src/editor/extensions.ts force `autocorrect: 'off'` ; proposer un réglage (attribut autocorrect natif WebView2/Safari) |
| NT-046 | Thème/Réglage | [Win11] Paramètres : activer/désactiver les fonctions IA (Copilot) | Absent | P3 | sans objet tant que NT-A04 n'existe pas |
| NT-047 | Intégration | [Win11] Partager… (Windows Share) | Absent | P3 | navigator.share avec le texte dans le navigateur ; plugin de partage côté coquille Tauri |

## 2. Notepad++ : menu Fichier

> Les chemins de preuve sont relatifs à packages/notes/. Pour « Absent », la phrase donne l'implémentation visée.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-048 | Menu | [N++] Fichier > Nouveau (Ctrl+N) | Présent à vérifier | P1 | src/commands.ts `new` |
| NT-049 | Menu | [N++] Fichier > Ouvrir… (Ctrl+O), sélection de plusieurs fichiers | Partiel | P2 | src/commands.ts `open` : services.openFile renvoie UN seul fichier ; la sélection multiple demande un contrat openFiles (@forgeoffice/core) |
| NT-050 | Menu | [N++] Fichier > Ouvrir le dossier contenant > Explorateur | Absent | P2 | la commande `reveal` existe mais reste grisée (src/commands.ts `reveal`) ; contrat revealInFolder (STATUS.md) |
| NT-051 | Menu | [N++] Fichier > Ouvrir le dossier contenant > cmd / terminal | Absent | P3 | commande Tauri qui lance le terminal sur le dossier du fichier (chemin validé) |
| NT-052 | Menu | [N++] Fichier > Ouvrir le dossier contenant > Définir comme espace de travail | Absent | P3 | nécessite un contrat listDir/readDir sur le dossier parent |
| NT-053 | Menu | [N++] Fichier > Ouvrir le dossier comme espace de travail | Partiel | P2 | src/commands.ts `openFolder` -> src/dom-actions.ts `pickFolder` : lecture en mémoire via webkitdirectory (3000 fichiers, 2 Mo/fichier), pas d'écriture en place |
| NT-054 | Menu | [N++] Fichier > Ouvrir dans l'application par défaut | Absent | P3 | @tauri-apps/plugin-opener (openPath) exposé via Services |
| NT-055 | Menu | [N++] Fichier > Recharger depuis le disque | Présent à vérifier | P2 | src/commands.ts `reload` (bureau seulement) |
| NT-056 | Menu | [N++] Fichier > Enregistrer (Ctrl+S) | OK | P1 | src/commands.ts `save` |
| NT-057 | Menu | [N++] Fichier > Enregistrer sous… (Ctrl+Alt+S) | OK | P1 | src/commands.ts `saveAs` (Ctrl+Maj+S) + choix encodage et fins de ligne dans le Backstage src/ui/FileBackstage.tsx `SaveAsPage` |
| NT-058 | Menu | [N++] Fichier > Enregistrer une copie sous… | Absent | P2 | variante de src/workspace.ts `save` qui n'affecte ni path ni dirty de l'onglet |
| NT-059 | Menu | [N++] Fichier > Enregistrer tout (Ctrl+Maj+S) | Présent à vérifier | P2 | src/commands.ts `saveAll` (Ctrl+Alt+S ici) |
| NT-060 | Menu | [N++] Fichier > Renommer… | Absent | P2 | contrat rename(path, nom) ; pour un onglet sans fichier, simple changement de Tab.name dans src/workspace.ts |
| NT-061 | Menu | [N++] Fichier > Fermer (Ctrl+W) | Présent à vérifier | P1 | src/commands.ts `close` |
| NT-062 | Menu | [N++] Fichier > Fermer tout (Ctrl+Maj+W) | Présent à vérifier | P2 | src/commands.ts `closeAll` |
| NT-063 | Menu | [N++] Fichier > Fermer plus > Tout sauf le document actif | Présent à vérifier | P2 | src/commands.ts `closeOthers` |
| NT-064 | Menu | [N++] Fichier > Fermer plus > Tout à droite | Partiel | P2 | seulement dans le menu d'onglet (src/NotesApp.tsx `closeRight`), absent du registre de commandes et de la palette |
| NT-065 | Menu | [N++] Fichier > Fermer plus > Tout à gauche | OK | P2 | même code que closeRight avec les onglets d'indice inférieur (src/NotesApp.tsx `tabMenu`) Fait 2026-11-07 : menu de l'onglet, menu Fichier et palette. tests/tabs.test.ts + banc CDP packages/notes/tests/e2e/tabs.mjs (clic droit réel) + captures tabs-menu.png, tabs-after.png. |
| NT-066 | Menu | [N++] Fichier > Fermer plus > Tous les non modifiés | OK | P2 | filtrer ws.tabs sur !dirty puis closeTabs Fait 2026-11-07 : « Fermer les onglets non modifiés ». tests/tabs.test.ts + banc CDP packages/notes/tests/e2e/tabs.mjs (clic droit réel) + captures tabs-menu.png, tabs-after.png. |
| NT-067 | Menu | [N++] Fichier > Fermer plus > Tout sauf les onglets épinglés | OK | P2 | dépend de l'épinglage d'onglets (champ Tab.pinned à créer dans src/workspace.ts) Fait 2026-11-07 : Tab.pinned ; Fermer les autres / à droite / à gauche / tous épargnent les épinglés. tests/tabs.test.ts + banc CDP packages/notes/tests/e2e/tabs.mjs (clic droit réel) + captures tabs-menu.png, tabs-after.png. |
| NT-068 | Menu | [N++] Fichier > Déplacer à la corbeille | Absent | P3 | contrat trash(path) côté Tauri (crate trash) |
| NT-069 | Menu | [N++] Fichier > Charger une session… | Absent | P2 | importer un JSON de la liste d'onglets dans src/logic/session.ts (parseStore) via un sélecteur de fichier |
| NT-070 | Menu | [N++] Fichier > Enregistrer la session… | Absent | P2 | exporter src/workspace.ts `sessionTabs` dans un fichier .json nommé |
| NT-071 | Menu | [N++] Fichier > Imprimer… (Ctrl+P) | Présent à vérifier | P1 | src/commands.ts `print` |
| NT-072 | Menu | [N++] Fichier > Imprimer maintenant | Partiel | P3 | même chemin que `print` : la boîte d'impression du système s'ouvre toujours |
| NT-073 | Menu | [N++] Fichier > Quitter (Alt+F4) | Présent à vérifier | P2 | src/commands.ts `quit` |
| NT-074 | Menu | [N++] Fichier > Restaurer le dernier fichier fermé (Ctrl+Maj+T) | Présent à vérifier | P1 | src/commands.ts `reopenClosed` (pile de 30, texte compris) |
| NT-075 | Menu | [N++] Fichier > Fichiers récents (liste numérotée) | Présent à vérifier | P2 | src/ribbon.ts `recent` |
| NT-076 | Menu | [N++] Fichier > Fichiers récents > Ouvrir tous les récents | Absent | P3 | boucle sur src/workspace.ts `openPath` |
| NT-077 | Menu | [N++] Fichier > Fichiers récents > Vider la liste | Présent à vérifier | P3 | src/commands.ts `clearRecent` |
| NT-078 | Menu | [N++] Fichier > Fichiers récents > nombre max, chemin complet, tri (réglages) | Absent | P3 | liste fixée à 15 dans src/NotesApp.tsx `recents.slice(0, 15)` ; exposer un réglage maxRecent |

## 3. Notepad++ : menu Édition (annuler, presse-papiers, sélection, insertion, indentation, casse)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-079 | Menu | [N++] Édition > Annuler / Rétablir (Ctrl+Z, Ctrl+Y) | Présent à vérifier | P1 | src/commands.ts `undo` `redo` (historique par onglet, partagé avec la vue scindée) |
| NT-080 | Menu | [N++] Édition > Couper / Copier / Coller / Supprimer | Présent à vérifier | P1 | src/commands.ts `cut` `copy` `paste` `del` |
| NT-081 | Édition | [N++] Couper / copier la ligne entière quand la sélection est vide | Absent | P1 | src/editor/actions.ts `copySelection` sort si le texte est vide ; ajouter le repli sur la ligne du curseur (comportement de N++ et VS Code) |
| NT-082 | Édition | [N++] Coller une ligne par curseur en multi-curseurs | Partiel | P2 | le Ctrl+V natif de CodeMirror répartit les lignes ; la commande de menu src/editor/actions.ts `pasteClipboard` insère le même texte partout |
| NT-083 | Menu | [N++] Édition > Tout sélectionner (Ctrl+A) | Présent à vérifier | P1 | src/commands.ts `selectAll` |
| NT-084 | Édition | [N++] Édition > Début/Fin de sélection (Begin/End Select) | Absent | P3 | StateField mémorisant l'ancre, commande qui étend jusqu'au curseur |
| NT-085 | Édition | [N++] Édition > Début/Fin de sélection en mode colonne | Absent | P3 | même principe avec une sélection rectangulaire (CodeMirror `EditorSelection`) |
| NT-086 | Édition | [N++] Édition > Insérer > Date et heure, format court | Partiel | P2 | src/commands.ts `dateTime` n'a qu'un format « HH:MM JJ/MM/AAAA » (src/logic/lines.ts `dateTimeStamp`) |
| NT-087 | Édition | [N++] Édition > Insérer > Date et heure, format long | Absent | P2 | Intl.DateTimeFormat('fr', {dateStyle: 'full', timeStyle: 'medium'}) dans une nouvelle commande |
| NT-088 | Édition | [N++] Édition > Insérer > Date et heure, format personnalisé | Absent | P3 | gabarit dans NotesPrefs avec jetons yyyy, MM, dd, HH, mm |
| NT-089 | Édition | [N++] Édition > Copier dans le presse-papiers > chemin complet | Présent à vérifier | P2 | src/commands.ts `copyPath` |
| NT-090 | Édition | [N++] Édition > Copier dans le presse-papiers > nom du fichier seul | Absent | P2 | dérivé de Tab.name dans src/workspace.ts |
| NT-091 | Édition | [N++] Édition > Copier dans le presse-papiers > dossier courant | Absent | P2 | dérivé de Tab.path dans src/workspace.ts |
| NT-092 | Édition | [N++] Édition > Copier / couper / coller le contenu binaire | Absent | P3 | ClipboardItem application/octet-stream, utile avec un futur mode hexadécimal |
| NT-093 | Édition | [N++] Édition > Coller le contenu HTML | Absent | P2 | navigator.clipboard.read() type text/html puis conversion en Markdown ou texte |
| NT-094 | Édition | [N++] Édition > Coller le contenu RTF | Absent | P3 | lecture ClipboardItem text/rtf puis extraction du texte |
| NT-095 | Édition | [N++] Copier le texte avec coloration syntaxique (NppExport) | Absent | P3 | sérialiser les spans CodeMirror en HTML dans le presse-papiers (text/html) |
| NT-096 | Édition | [N++] Édition > Indentation > Augmenter / diminuer (Tab, Maj+Tab, Ctrl+], Ctrl+[) | Présent à vérifier | P1 | src/commands.ts `indent` `outdent` ; src/editor/extensions.ts Tab = CodeMirror `insertTab`, Maj+Tab = CodeMirror `indentLess` |
| NT-097 | Édition | [N++] Indentation par espaces à la place des tabulations (« Replace by space ») | Partiel | P2 | Tab insère un caractère tabulation (src/editor/extensions.ts `insertTab`) ; indentUnit suit tabSize mais aucune bascule « espaces » n'existe |
| NT-098 | Édition | [N++] Édition > Convertir la casse > MAJUSCULES (Ctrl+Maj+U) | OK | P1 | src/commands.ts `upper` |
| NT-099 | Édition | [N++] Édition > Convertir la casse > minuscules (Ctrl+U) | OK | P1 | src/commands.ts `lower` |
| NT-100 | Édition | [N++] Édition > Convertir la casse > Première Lettre En Majuscule | OK | P2 | src/commands.ts `titleCase` -> src/logic/lines.ts `changeCase` |
| NT-101 | Édition | [N++] Édition > Convertir la casse > Première Lettre En Majuscule (mélange) | Absent | P3 | mode 'titleBlend' de changeCase qui conserve les capitales déjà présentes |
| NT-102 | Édition | [N++] Édition > Convertir la casse > Majuscule en début de phrase | OK | P2 | src/commands.ts `sentenceCase` |
| NT-103 | Édition | [N++] Édition > Convertir la casse > Majuscule en début de phrase (mélange) | Absent | P3 | mode 'sentenceBlend' conservant les majuscules existantes |
| NT-104 | Édition | [N++] Édition > Convertir la casse > iNVERSER lA cASSE | OK | P3 | src/commands.ts `invertCase` |
| NT-105 | Édition | [N++] Édition > Convertir la casse > casse aléatoire | Absent | P3 | mode 'random' dans src/logic/lines.ts `changeCase` |
| NT-106 | Édition | [VSCode] Transformer en camelCase, snake_case, kebab-case, PascalCase | OK | P3 | modes supplémentaires de src/logic/lines.ts `changeCase` (découpage en mots) et entrées du menu Casse du ruban Fait 2026-11-07 : camelCase, PascalCase, snake_case, kebab-case (lines.ts words/changeCase) ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |

## 4. Notepad++ : Édition > Opérations sur les lignes

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-107 | Édition | [N++] Lignes > Dupliquer la ligne courante (Ctrl+D) | OK | P1 | src/commands.ts `duplicate` (CodeMirror `copyLineDown` ; Ctrl+D détourné de « occurrence suivante ») |
| NT-108 | Édition | [N++] Lignes > Supprimer la ligne courante (Ctrl+L) | Présent à vérifier | P1 | src/commands.ts `deleteLine` (Ctrl+Maj+K, convention VS Code) |
| NT-109 | Édition | [N++] Lignes > Déplacer la ligne vers le haut / bas | Présent à vérifier | P1 | src/commands.ts `moveUp` `moveDown` (Alt+flèches ; N++ utilise Ctrl+Maj+flèches) |
| NT-110 | Édition | [N++] Lignes > Joindre les lignes (Ctrl+J) | OK | P2 | src/commands.ts `join` -> src/logic/lines.ts `joinLines` |
| NT-111 | Édition | [N++] Lignes > Fractionner les lignes (Ctrl+I, à la colonne de bord) | Absent | P3 | fonction splitLines(width) dans src/logic/lines.ts appliquée par src/editor/actions.ts `transformLines` |
| NT-112 | Édition | [N++] Lignes > Transposer la ligne avec la précédente (Ctrl+T) | Absent | P3 | commande qui échange deux lignes adjacentes (CodeMirror `moveLineUp` suffit côté sélection) |
| NT-113 | Édition | [N++] Lignes > Supprimer les doublons (toutes les lignes) | OK | P2 | src/commands.ts `dedupe` -> src/logic/lines.ts `dedupeLines` (garde la première occurrence ; document entier si pas de sélection) |
| NT-114 | Édition | [N++] Lignes > Supprimer les doublons consécutifs seulement | OK | P3 | fonction dedupeConsecutive dans src/logic/lines.ts Fait 2026-11-07 : dedupeAdjacent ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-115 | Édition | [N++] Lignes > Insérer une ligne vide dessus (Ctrl+Alt+Entrée) | OK | P2 | commande combinant CodeMirror `insertBlankLine` et un déplacement du curseur Fait 2026-11-07 : Ctrl+Alt+Entrée, retrait conservé ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-116 | Édition | [N++] Lignes > Insérer une ligne vide dessous (Ctrl+Alt+Maj+Entrée) | OK | P2 | Ctrl+Entrée = CodeMirror `insertBlankLine` (jeu de touches par défaut) mais pas dans les menus ni dans la palette Fait 2026-11-07 : Ctrl+Alt+Maj+Entrée ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-117 | Édition | [N++] Lignes > Inverser l'ordre des lignes | OK | P3 | src/commands.ts `reverse` -> src/logic/lines.ts `reverseLines` |
| NT-118 | Édition | [N++] Lignes > Ordre aléatoire des lignes | Absent | P3 | Fisher-Yates dans src/logic/lines.ts (crypto.getRandomValues) |
| NT-119 | Édition | [N++] Lignes > Trier lexicographiquement croissant/décroissant | Partiel | P1 | src/commands.ts `sortAsc` `sortDesc` : Intl.Collator('fr', numeric) donc tri naturel et insensible à la casse, pas l'ordre des octets |
| NT-120 | Édition | [N++] Lignes > Trier en ignorant la casse | OK | P2 | src/logic/lines.ts `sortLines` (sensitivity: 'base') est insensible à la casse et aux accents |
| NT-121 | Édition | [N++] Lignes > Trier en respectant la casse (ordre binaire) | Absent | P3 | variante sortLines avec comparaison de code points |
| NT-122 | Édition | [N++] Lignes > Trier comme des entiers croissant/décroissant | OK | P2 | le collateur numérique ordonne « 2 » avant « 10 » mais ignore les signes et les lignes mixtes ; ajouter un tri par Number() Fait 2026-11-07 : tri par nombre croissant / décroissant (signes, virgule décimale, lignes sans nombre à la fin) ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-123 | Édition | [N++] Lignes > Trier comme des décimaux (virgule ou point) | Absent | P3 | parseFloat avec normalisation de la virgule décimale |
| NT-124 | Édition | [VSCode] Trier par colonne / champ (séparateur, n-ième champ) | Absent | P3 | dialogue de paramètres + sortLines avec clé extraite (équivalent du plugin TextFX) |
| NT-125 | Édition | [N++] Lignes > Supprimer les lignes vides | OK | P1 | fonction removeEmptyLines dans src/logic/lines.ts ; commande très demandée (ligne vide = longueur 0) Fait 2026-11-07 : removeEmptyLines ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-126 | Édition | [N++] Lignes > Supprimer les lignes vides (y compris espaces seuls) | OK | P1 | variante avec trim() === '' Fait 2026-11-07 : supprime aussi les lignes d'espaces seuls ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-127 | Édition | [N++] Lignes > Supprimer les lignes contenant / ne contenant pas un motif | Absent | P2 | boîte de dialogue + regex, ou via Marquer puis Supprimer les lignes marquées |
| NT-128 | Édition | [N++] Lignes > Supprimer les espaces en fin de ligne | OK | P1 | src/commands.ts `trim` -> src/logic/lines.ts `trimTrailing` |

## 5. Notepad++ : Édition > Blancs, commentaires, saut de ligne, complétion

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-129 | Édition | [N++] Blancs > Supprimer les espaces en début de ligne | OK | P2 | trimLeading dans src/logic/lines.ts Fait 2026-11-07 : trimLeading et trimBoth ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-130 | Édition | [N++] Blancs > Supprimer les espaces en début et fin de ligne | Absent | P2 | trimBoth dans src/logic/lines.ts |
| NT-131 | Édition | [N++] Blancs > Fin de ligne en espace (EOL to Space) | Absent | P3 | joindre sans trim : replace des sauts par une espace |
| NT-132 | Édition | [N++] Blancs > Supprimer les blancs et sauts de ligne inutiles | Absent | P3 | réduire les suites de lignes vides et d'espaces |
| NT-133 | Édition | [N++] Blancs > Tabulation vers espaces | OK | P2 | src/commands.ts `tabsToSpaces` (respecte les taquets, src/logic/lines.ts `tabsToSpaces`) |
| NT-134 | Édition | [N++] Blancs > Espaces vers tabulation (début de ligne) | OK | P2 | src/commands.ts `spacesToTabs` |
| NT-135 | Édition | [N++] Blancs > Espaces vers tabulation (toutes) | Absent | P3 | variante qui convertit aussi les espaces internes |
| NT-136 | Édition | [N++] Commentaire > Commenter / décommenter la ligne (Ctrl+Q) | Présent à vérifier | P1 | src/commands.ts `toggleComment` (Ctrl+/ ; jetons du langage ; sans effet en texte brut) |
| NT-137 | Édition | [N++] Commentaire > Commentaire de bloc / décommenter le bloc | Partiel | P2 | CodeMirror `toggleBlockComment` lié à Maj+Alt+A par le jeu de touches par défaut, sans entrée de menu ni de palette |
| NT-138 | Édition | [N++] Commentaire > Commenter seulement / décommenter seulement | Absent | P3 | CodeMirror `lineComment` et CodeMirror `lineUncomment` à exposer comme commandes |
| NT-139 | Édition | [N++] Fin de ligne > Conversion Windows (CRLF) | OK | P1 | src/commands.ts `eol` + src/ribbon.ts menu Format > Fins de ligne (S.eols.crlf) ; appliquée à l'enregistrement |
| NT-140 | Édition | [N++] Fin de ligne > Conversion Unix (LF) | OK | P1 | src/logic/encoding.ts `applyEol` |
| NT-141 | Édition | [N++] Fin de ligne > Conversion Macintosh (CR) | OK | P3 | src/logic/encoding.ts `applyEol` (cr) |
| NT-142 | Édition | [N++] Auto-complétion > Complétion de mots (Ctrl+Entrée) | Partiel | P1 | @codemirror/autocomplete est installé mais non utilisé : autocompletion({override: [completeAnyWord]}) + completionKeymap Fait 2026-11-07 : complétion des mots du document (completeAnyWord), option « Complétion des mots du document » désactivée par défaut ; banc CDP packages/notes/tests/e2e/typing.mjs + capture typing-complete.png. Pas de Ctrl+Entrée (déjà « Ouvrir le lien ») ni de sources par langage. |
| NT-143 | Édition | [N++] Auto-complétion > Complétion de fonctions (Ctrl+Espace) | Absent | P2 | sources de complétion fournies par chaque langage (lang-html, lang-css, lang-sql…) activées par autocompletion() |
| NT-144 | Édition | [N++] Auto-complétion > Aide sur les paramètres de fonction | Absent | P3 | infobulle CodeMirror `showTooltip` alimentée par une table de signatures par langage |
| NT-145 | Édition | [N++] Auto-complétion > Complétion de chemins (Ctrl+Alt+Espace) | Absent | P3 | source de complétion lisant le dossier ouvert (src/ui/Sidebar.tsx dossier) ; limitée sans contrat listDir |
| NT-146 | Édition | [N++] Fermeture automatique des parenthèses, crochets, guillemets | OK | P1 | ajouter CodeMirror `closeBrackets`() et CodeMirror `closeBracketsKeymap` dans src/editor/extensions.ts `editorExtensions` Fait 2026-11-07 : option « Fermeture automatique des parenthèses et guillemets » (désactivée par défaut), Retour arrière supprime la paire, pas de paire pour l'apostrophe française ; banc CDP packages/notes/tests/e2e/typing.mjs (8 contrôles). |
| NT-147 | Édition | [N++] Fermeture automatique des balises HTML/XML | Présent à vérifier | P2 | le support des langages HTML et XML de language-data inclut autoCloseTags (config par défaut) ; chargé par src/editor/languages.ts `LANGUAGES` |

## 6. Notepad++ : Édition > sélection multiple, mode colonne, divers

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-148 | Édition | [N++] Sélection multiple > Ajouter l'occurrence suivante | Présent à vérifier | P1 | src/commands.ts `selectNext` (Alt+D) -> CodeMirror `selectNextOccurrence` |
| NT-149 | Édition | [N++] Sélection multiple > Sélectionner toutes les occurrences | Partiel | P1 | src/commands.ts `selectAllMatches` (Ctrl+Maj+L) ; CodeMirror `selectSelectionMatches` respecte la casse et n'a pas les variantes « mot entier » / « ignorer la casse » |
| NT-150 | Édition | [N++] Sélection multiple > variantes (casse, mot entier) | Absent | P3 | construire un SearchQuery avec les drapeaux voulus puis CodeMirror `selectMatches` |
| NT-151 | Édition | [N++] Sélection multiple > Annuler la dernière occurrence ajoutée | Absent | P3 | CodeMirror `undoSelection` existe mais Ctrl+U est pris par la mise en minuscules (src/commands.ts `lower`) |
| NT-152 | Édition | [N++] Sélection multiple > Ignorer et passer à l'occurrence suivante | Absent | P3 | commande qui retire la dernière plage et appelle CodeMirror `selectNextOccurrence` |
| NT-153 | Édition | [N++] Multi-curseurs par Ctrl+clic | Présent à vérifier | P1 | EditorState.allowMultipleSelections dans src/editor/extensions.ts (Ctrl+clic = ajout de curseur dans CodeMirror) |
| NT-154 | Édition | [VSCode] Ajouter un curseur au-dessus / au-dessous (Ctrl+Alt+↑/↓) | Présent à vérifier | P2 | jeu de touches par défaut src/editor/extensions.ts `defaultKeymap` : CodeMirror `addCursorAbove` CodeMirror `addCursorBelow` |
| NT-155 | Édition | [VSCode] Ajouter des curseurs en fin de chaque ligne sélectionnée (Maj+Alt+I) | Absent | P2 | commande qui crée un curseur par ligne de la sélection (EditorSelection.cursor) |
| NT-156 | Édition | [N++] Mode colonne : sélection rectangulaire à la souris (Alt+glisser) | Présent à vérifier | P1 | src/editor/extensions.ts CodeMirror `rectangularSelection` et CodeMirror `crosshairCursor` |
| NT-157 | Édition | [N++] Mode colonne : sélection au clavier (Alt+Maj+flèches) | Absent | P2 | Alt+Maj+flèches est pris par CodeMirror `copyLineUp`/Down ; ajouter une commande dédiée basée sur CodeMirror `selectLineUp` en colonnes |
| NT-158 | Édition | [N++] Éditeur de colonnes > insérer du texte (Alt+C) | Absent | P2 | dialogue qui insère un texte sur chaque ligne de la sélection rectangulaire |
| NT-159 | Édition | [N++] Éditeur de colonnes > insérer des nombres (initial, incrément, répétition, zéros, déc/hex/oct/bin) | Absent | P2 | même dialogue, générateur de séquence appliqué par changeByRange |
| NT-160 | Édition | [N++] Panneau des caractères (insertion ASCII) | Absent | P3 | volet dans src/ui/Sidebar.tsx avec table 0-255 qui appelle replaceSelection |
| NT-161 | Édition | [N++] Historique du presse-papiers | Absent | P3 | liste des derniers textes copiés dans l'éditeur, volet latéral (le presse-papiers système n'est pas lisible en continu) |
| NT-162 | Édition | [N++] Édition > Lecture seule du document | Présent à vérifier | P2 | src/commands.ts `readOnly` -> Tab.readOnly (par onglet, non écrit sur le disque) |
| NT-163 | Édition | [N++] Édition > Poser / retirer l'attribut lecture seule du fichier | Absent | P3 | contrat setReadOnlyAttr(path, bool) |
| NT-164 | Édition | [N++] Édition > Sur la sélection : ouvrir le fichier nommé | Absent | P3 | résoudre le chemin relatif au dossier de l'onglet, services.readFile |
| NT-165 | Édition | [N++] Édition > Sur la sélection : rechercher sur Internet / changer de moteur | Absent | P3 | window.open(moteur + encodeURIComponent(sélection)) avec moteur choisi dans les réglages |

## 7. Notepad++ : menu Recherche, marque-pages, aller à

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-166 | Recherche | [N++] Recherche > Rechercher (Ctrl+F) | OK | P1 | src/commands.ts `find` : panneau CodeMirror en haut de l'éditeur (src/editor/extensions.ts CodeMirror `search`({top: true})), libellés français src/strings.ts `PHRASES` |
| NT-167 | Recherche | [N++] Recherche > Rechercher dans les fichiers (Ctrl+Maj+F) | Partiel | P1 | src/commands.ts `findInFiles` : palette sur les onglets ouverts et le dossier en mémoire, sous-chaîne insensible à la casse, 300 résultats, sans regex ni filtres |
| NT-168 | Recherche | [N++] Recherche > Suivant / Précédent (F3, Maj+F3) | Présent à vérifier | P1 | src/commands.ts `findNext` `findPrev` |
| NT-169 | Recherche | [N++] Recherche > Sélectionner et rechercher suivant (Ctrl+F3) | Absent | P3 | commande : prendre le mot sous le curseur puis CodeMirror `setSearchQuery` + findNext |
| NT-170 | Recherche | [N++] Recherche > Rechercher (volatile) suivant/précédent (Ctrl+Alt+F3) | Absent | P3 | même mécanisme sans ouvrir le panneau |
| NT-171 | Recherche | [N++] Recherche > Remplacer (Ctrl+H) | OK | P1 | src/commands.ts `replace` : ouvre le panneau et place le curseur dans le champ Remplacer |
| NT-172 | Recherche | [N++] Recherche > Recherche incrémentale (Ctrl+Alt+I) | Partiel | P2 | le panneau surligne les occurrences pendant la frappe (searchMatch) mais ne déplace la sélection qu'à Entrée ; pas de barre dédiée |
| NT-173 | Recherche | [N++] Recherche > Fenêtre des résultats de recherche (F7) | Absent | P2 | volet inférieur regroupant les résultats par fichier |
| NT-174 | Recherche | [N++] Recherche > Résultat suivant / précédent (F4, Maj+F4) | Absent | P2 | navigation dans la liste de résultats de la fenêtre ci-dessus |
| NT-175 | Recherche | [N++] Recherche > Atteindre une ligne (Ctrl+G) | Présent à vérifier | P1 | src/commands.ts `gotoLine` (CodeMirror `gotoLine` : ligne, ligne:colonne, +n/-n, pourcentage) |
| NT-176 | Recherche | [N++] Recherche > Atteindre un décalage (octet) | Absent | P3 | option « Décalage » du dialogue Aller à : doc.sliceString avec comptage UTF-8 |
| NT-177 | Recherche | [N++] Recherche > Atteindre l'accolade correspondante (Ctrl+B) | Partiel | P2 | CodeMirror `cursorMatchingBracket` est lié à Ctrl+Maj+\ par le jeu de touches par défaut, sans menu |
| NT-178 | Recherche | [N++] Recherche > Sélectionner entre les accolades correspondantes (Ctrl+Alt+B) | Absent | P3 | exposer CodeMirror `selectMatchingBracket` (existe dans @codemirror/commands, non lié) |
| NT-179 | Recherche | [N++] Recherche > Rechercher les caractères dans une plage | Absent | P3 | dialogue : classe de caractères ASCII/non-ASCII, recherche par regex /[^\x00-\x7F]/ |
| NT-180 | Recherche | [N++] Recherche > Marquer… (marquer toutes les occurrences) | Absent | P2 | StateField de décorations (comme src/editor/marks.ts bookmarks) alimenté par un SearchQuery |
| NT-181 | Recherche | [N++] Recherche > Effacer tous les marquages / par style | Absent | P2 | effet StateEffect qui vide le champ de marques |
| NT-182 | Recherche | [N++] Recherche > Aller au marquage suivant / précédent | Absent | P3 | parcours du RangeSet de marques |
| NT-183 | Recherche | [N++] Recherche > Copier le texte marqué | Absent | P3 | concaténer les plages marquées dans le presse-papiers |
| NT-184 | Recherche | [N++] Recherche > Mettre en style toutes les occurrences d'un mot (styles 1 à 5) | Absent | P2 | 5 classes de Decoration.mark + effacement ; couleurs liées au thème (src/logic/themes.ts `NoteTheme`) |
| NT-185 | Recherche | [N++] Recherche > Marque-page : basculer (Ctrl+F2) | OK | P1 | src/commands.ts `bookmarkToggle` -> src/editor/marks.ts `toggleBookmark` (marge cliquable) |
| NT-186 | Recherche | [N++] Recherche > Marque-page : suivant / précédent (F2, Maj+F2) | OK | P1 | src/commands.ts `bookmarkNext` `bookmarkPrev` -> src/editor/marks.ts `stepBookmark` (en boucle) |
| NT-187 | Recherche | [N++] Recherche > Marque-page : tout effacer | Présent à vérifier | P2 | src/commands.ts `bookmarkClear` |
| NT-188 | Recherche | [N++] Recherche > Marque-pages persistants (conservés à la fermeture et à la restauration de session) | Absent | P2 | src/logic/session.ts `SessionTab` ne contient pas les signets : ajouter bookmarkLines(state) à la session |
| NT-189 | Recherche | [N++] Recherche > Marque-page : couper / copier / coller sur les lignes marquées | Absent | P2 | commandes basées sur src/editor/marks.ts `bookmarkLines` |
| NT-190 | Recherche | [N++] Recherche > Marque-page : supprimer les lignes marquées | Absent | P2 | transformation des lignes marquées (permet « supprimer les lignes contenant X » après Marquer) |
| NT-191 | Recherche | [N++] Recherche > Marque-page : supprimer les lignes non marquées | Absent | P3 | complément de la précédente |
| NT-192 | Recherche | [N++] Recherche > Marque-page : inverser les marque-pages | Absent | P3 | complémenter l'ensemble de lignes de src/editor/marks.ts |
| NT-193 | Recherche | [N++] Recherche > Historique des modifications (marge verte/orange, suivant/précédent/effacer) | Absent | P2 | StateField qui marque les lignes touchées depuis l'ouverture/enregistrement (changesSinceSave) |

## 8. Notepad++ : boîte de dialogue Rechercher / Remplacer (tous les onglets)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-194 | Dialogue | [N++] Rechercher : champ avec liste d'historique des recherches | Absent | P2 | mémoriser les 20 dernières requêtes dans NotesPrefs ; le panneau CodeMirror n'a pas d'historique |
| NT-195 | Dialogue | [N++] Rechercher : Compter les occurrences | OK | P2 | SearchCursor sur le document, résultat affiché dans la barre d'état ; le panneau n'affiche aucun compteur Fait 2026-11-07 : compteur « k sur N » / « N résultats » dans le panneau (plafonné à 9999+). Panneau maison editor/findpanel.ts ; banc CDP packages/notes/tests/e2e/find.mjs (12 contrôles) + capture find-selection.png. |
| NT-196 | Dialogue | [N++] Rechercher : Tout rechercher dans le document courant | Partiel | P2 | le bouton « Tout » sélectionne toutes les occurrences (CodeMirror `selectMatches`) mais sans liste de résultats |
| NT-197 | Dialogue | [N++] Rechercher : Tout rechercher dans tous les documents ouverts | Partiel | P2 | palette src/commands.ts `findInFiles` parcourt les onglets (src/ui/Sidebar.tsx `noteSources`) mais sans options de casse ni regex |
| NT-198 | Dialogue | [N++] Rechercher : Respecter la casse | Présent à vérifier | P1 | case à cocher du panneau (PHRASES « match case ») |
| NT-199 | Dialogue | [N++] Rechercher : Mot entier | Présent à vérifier | P1 | case « by word » traduite « Mot entier » |
| NT-200 | Dialogue | [N++] Rechercher : Reprendre au début (wrap around) | Partiel | P3 | CodeMirror reprend toujours en début/fin ; pas de case pour le désactiver et aucun message « fin du document atteinte » |
| NT-201 | Dialogue | [N++] Rechercher : Mode normal | Présent à vérifier | P1 | panneau CodeMirror, mode littéral |
| NT-202 | Dialogue | [N++] Rechercher : Mode étendu (\n \r \t \0 \x) | Partiel | P2 | en mode non regex, CodeMirror `SearchQuery` dé-échappe \n \r \t \\ seulement (littéral=false) ; pas \0, \xHH, \uHHHH Fait 2026-11-07 : modes Normal / Étendu (\n \r \t \\) / Expression régulière dans le panneau ; \0 et \xHH non gérés. Panneau maison editor/findpanel.ts ; banc CDP packages/notes/tests/e2e/find.mjs (12 contrôles) + capture find-selection.png. |
| NT-203 | Dialogue | [N++] Rechercher : Expression régulière | Présent à vérifier | P1 | case « regexp » (syntaxe JavaScript, groupes $1 dans le remplacement) |
| NT-204 | Dialogue | [N++] Rechercher : « . » correspond au saut de ligne | Partiel | P3 | les regex CodeMirror multi-lignes ne sont activées que si le motif contient \n ; pas de case dédiée |
| NT-205 | Dialogue | [N++] Rechercher : Sens Haut / Bas | Présent à vérifier | P2 | boutons Précédent / Suivant du panneau |
| NT-206 | Dialogue | [N++] Rechercher : Dans la sélection | OK | P1 | CodeMirror `search` ne limite pas à la sélection : ajouter une plage dans le SearchQuery (filtre `test`) et une case « Dans la sélection » Fait 2026-11-07 : case « Dans la sélection » (filtre test du SearchQuery, plage suivie pendant les modifications). Panneau maison editor/findpanel.ts ; banc CDP packages/notes/tests/e2e/find.mjs (12 contrôles) + capture find-selection.png. |
| NT-207 | Dialogue | [N++] Remplacer : Remplacer / Tout remplacer | Présent à vérifier | P1 | boutons « Remplacer » et « Remplacer tout » (PHRASES) |
| NT-208 | Dialogue | [N++] Remplacer : Tout remplacer dans la sélection | OK | P1 | dépend de « Dans la sélection » ci-dessus Fait 2026-11-07 : Tout remplacer limité à la sélection. Panneau maison editor/findpanel.ts ; banc CDP packages/notes/tests/e2e/find.mjs (12 contrôles) + capture find-selection.png. |
| NT-209 | Dialogue | [N++] Remplacer : Tout remplacer dans tous les documents ouverts | Absent | P2 | boucle sur ws.tabs avec SearchQuery.getCursor ; confirmation avant |
| NT-210 | Dialogue | [N++] Remplacer : Remplacer dans les fichiers | Absent | P2 | nécessite l'écriture en place dans un dossier (contrat openFolder/writeFile) |
| NT-211 | Dialogue | [N++] Remplacer : références de capture \1 ou $1 dans le remplacement | Partiel | P2 | CodeMirror supporte $1 et $& ; les \1 de style PCRE ne sont pas interprétés |
| NT-212 | Dialogue | [N++] Rechercher dans les fichiers : filtres (*.txt;*.md), exclusions (!*.log) | Absent | P2 | champ filtre appliqué à FolderFile.rel dans src/ui/Sidebar.tsx `noteSources` |
| NT-213 | Dialogue | [N++] Rechercher dans les fichiers : répertoire, sous-dossiers, dossiers cachés | Absent | P3 | limités au dossier en mémoire (src/dom-actions.ts `pickFolder`) tant qu'un contrat de lecture récursive n'existe pas |
| NT-214 | Dialogue | [N++] Rechercher dans les fichiers : suivre le document actif | Absent | P3 | case qui fixe le dossier au dossier du fichier courant |
| NT-215 | Dialogue | [N++] Rechercher dans les projets | Absent | P3 | sans objet tant que le panneau Projet n'existe pas |
| NT-216 | Dialogue | [N++] Onglet Marquer : Tout marquer / Marquer les lignes / Purger | Absent | P2 | bouton Marquer + case « Marquer la ligne (signet) » reliée à src/editor/marks.ts |
| NT-217 | Dialogue | [N++] Résultats : arborescence par fichier repliable, ligne et extrait, double-clic | Partiel | P2 | src/commands.ts `findInFiles` : liste plate triée par fichier avec ligne:extrait, clic = ouvrir à la ligne (src/NotesApp.tsx `openFolderFile`) |
| NT-218 | Dialogue | [N++] Résultats : copier, tout sélectionner, effacer, rechercher dans les résultats | Absent | P3 | volet de résultats persistant (src/ui/Palette.tsx Palette est éphémère) |
| NT-219 | Dialogue | [N++] Fenêtre transparente quand elle perd le focus | Absent | P3 | sans objet (panneau intégré, pas de fenêtre flottante) |
| NT-220 | Dialogue | [Win11] Rechercher : Respecter la casse, Mot entier, Reprendre au début | Partiel | P1 | casse et mot entier OK ; reprise automatique non réglable |
| NT-221 | Dialogue | [Win11] Barre Remplacer repliable (Ctrl+H) | Présent à vérifier | P1 | src/commands.ts `replace` -> panneau CodeMirror avec champ Remplacer |
| NT-222 | Dialogue | [N++] Atteindre : ligne ou décalage, plage valide affichée | Partiel | P2 | CodeMirror `gotoLine` accepte ligne:colonne mais n'affiche pas le nombre de lignes ni le décalage (panneau src/strings.ts « Go to line ») |

## 9. Notepad++ : menu Affichage (fenêtre, symboles, zoom, repli, volets)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-223 | Affichage | [N++] Affichage > Toujours au premier plan | Partiel | P3 | src/commands.ts `topmost` masquée tant que `setAlwaysOnTop` de `windowControls` manque au contrat @forgeoffice/core (src/NotesApp.tsx `canTopmost`) |
| NT-224 | Affichage | [N++] Affichage > Plein écran (F11) | Présent à vérifier | P2 | src/commands.ts `zen` : requestFullscreen + chrome masqué (src/NotesApp.tsx `toggleZen`) |
| NT-225 | Affichage | [N++] Affichage > Mode post-it (F12) | Absent | P3 | fenêtre réduite sans bordure côté Tauri (setDecorations) ; sans objet dans le navigateur |
| NT-226 | Affichage | [N++] Affichage > Mode sans distraction | Présent à vérifier | P2 | src/commands.ts `zen` + CSS `.is-zen` texte centré à 52 em (src/notes.css `.nt-root.is-zen`) |
| NT-227 | Affichage | [N++] Affichage > Afficher le fichier dans Firefox/Chrome/Edge | Partiel | P3 | src/commands.ts `openInBrowser` ouvre une copie nettoyée (DOMPurify) : HTML sans script, Markdown rendu, texte ; pas le fichier réel |
| NT-228 | Affichage | [N++] Symboles > Afficher les espaces et tabulations | Présent à vérifier | P2 | src/commands.ts `whitespace` -> CodeMirror `highlightWhitespace` + CodeMirror `highlightTrailingWhitespace` |
| NT-229 | Affichage | [N++] Symboles > Afficher les fins de ligne (CR LF) | Absent | P2 | décoration Widget en fin de ligne selon Tab.eol (¶ ou CRLF) ; CodeMirror n'en a pas |
| NT-230 | Affichage | [N++] Symboles > Afficher les caractères de contrôle et Unicode | Partiel | P3 | CodeMirror `highlightSpecialChars` toujours actif (src/editor/extensions.ts) mais non basculable et sans libellé NUL/SOH |
| NT-231 | Affichage | [N++] Symboles > Afficher tous les caractères | Partiel | P3 | espaces visibles seulement ; pas les fins de ligne |
| NT-232 | Affichage | [N++] Symboles > Afficher les repères d'indentation | Absent | P2 | extension de repères verticaux (ViewPlugin avec Decoration.line ou @replit/codemirror-indentation-markers) |
| NT-233 | Affichage | [N++] Symboles > Afficher le symbole de retour à la ligne | Absent | P3 | Decoration ligne wrap (CSS ::after) ou widget en fin de ligne visuelle |
| NT-234 | Affichage | [N++] Affichage > Zoom avant (Ctrl+molette, Ctrl++) | Présent à vérifier | P1 | src/commands.ts `zoomIn` + src/editor/extensions.ts wheel -> onZoom (10 à 500 %) |
| NT-235 | Affichage | [N++] Affichage > Zoom arrière | Présent à vérifier | P1 | src/commands.ts `zoomOut` |
| NT-236 | Affichage | [N++] Affichage > Zoom par défaut (Ctrl+0) | Présent à vérifier | P1 | src/commands.ts `zoomReset` |
| NT-237 | Affichage | [N++] Affichage > Déplacer/Cloner le document dans l'autre vue : cloner | Partiel | P2 | src/commands.ts `split` : 2e vue du MÊME document actif (src/workspace.ts `attachSecondary`), vue seconde réinitialisée à chaque changement d'onglet |
| NT-238 | Affichage | [N++] Affichage > Déplacer le document dans l'autre vue | Absent | P2 | permettre à la vue 2 d'avoir son propre onglet actif (src/workspace.ts `secondaryState` suit toujours `this.active`) |
| NT-239 | Affichage | [N++] Affichage > Deux fichiers différents côte à côte | Absent | P1 | ajouter un second EditorState/activeId par vue dans src/workspace.ts et un focus de groupe (groupes d'éditeurs) |
| NT-240 | Affichage | [N++] Affichage > Orientation horizontale/verticale de la vue scindée | Absent | P3 | CSS flex-direction de `.nt-editors` (src/notes.css `.is-split`) pilotée par une préférence ; aujourd'hui empilée seulement |
| NT-241 | Affichage | [N++] Affichage > Onglet suivant / précédent (Ctrl+Tab, Ctrl+PgSuiv) | Présent à vérifier | P1 | src/commands.ts `tabNext` `tabPrev` (ordre des onglets, pas ordre d'usage récent) |
| NT-242 | Affichage | [N++] Affichage > Aller à l'onglet n (Alt+1..9) | Absent | P3 | raccourcis Alt+chiffre dans src/commands.ts |
| NT-243 | Affichage | [N++] Affichage > Retour automatique à la ligne | Présent à vérifier | P1 | src/commands.ts `wrap` |
| NT-244 | Affichage | [N++] Affichage > Retour à la ligne avec indentation conservée | Absent | P3 | extension qui ajoute un padding-left par ligne selon l'indentation |
| NT-245 | Affichage | [N++] Affichage > Replier tout (Alt+0) | Présent à vérifier | P2 | src/commands.ts `foldAll` (Ctrl+Alt+[) |
| NT-246 | Affichage | [N++] Affichage > Déplier tout | Présent à vérifier | P2 | src/commands.ts `unfoldAll` (Ctrl+Alt+]) |
| NT-247 | Affichage | [N++] Affichage > Replier / déplier le niveau courant | Partiel | P2 | CodeMirror `foldCode` et CodeMirror `unfoldCode` (Ctrl+Maj+[ et ]) via src/editor/extensions.ts `foldKeymap`, sans menu |
| NT-248 | Affichage | [N++] Affichage > Replier le niveau 1 à 8 | Absent | P2 | parcourir CodeMirror `foldable` sur les noeuds du syntaxTree à profondeur N et dispatcher foldEffect |
| NT-249 | Affichage | [N++] Affichage > Déplier le niveau 1 à 8 | Absent | P2 | symétrique avec unfoldEffect |
| NT-250 | Affichage | [N++] Affichage > Marge de repli (style flèche, cercle, boîte, simple) | Partiel | P3 | src/commands.ts `foldGutter` : un seul style (chevron, src/editor/extensions.ts `foldMarker`) |
| NT-251 | Affichage | [N++] Affichage > Repli par indentation en texte brut | Présent à vérifier | P2 | src/editor/extensions.ts `indentFold` (foldService) n'est actif que sans langage ; les StreamLanguage hérités n'ont pas de repli |
| NT-252 | Affichage | [N++] Affichage > Masquer les lignes (Alt+H) | Absent | P3 | Decoration.replace de lignes sélectionnées avec widget « n lignes masquées » |
| NT-253 | Affichage | [N++] Affichage > Résumé… (statistiques) | Partiel | P2 | src/commands.ts `stats` -> src/ui/Dialogs.tsx `StatsDialog` : lignes, mots, caractères, octets, temps de lecture ; ni chemin, ni dates de création/modification |
| NT-254 | Affichage | [N++] Affichage > Carte du document (Document Map, miniature) | Absent | P2 | extension de minimap (canvas défilant ou @replit/codemirror-minimap) dans src/editor/extensions.ts |
| NT-255 | Affichage | [N++] Affichage > Liste des fonctions (Function List) | Partiel | P2 | volet Plan src/ui/Sidebar.tsx `outline` : titres Markdown ou débuts de définitions par préfixes (src/logic/outline.ts `CODE_STARTS`), sans analyse par langage ni tri/filtre |
| NT-256 | Affichage | [N++] Affichage > Liste des documents (Document List) | Partiel | P3 | ouverture rapide Ctrl+E (src/commands.ts `quickOpen`) liste les onglets ; pas de volet permanent avec tri |
| NT-257 | Affichage | [N++] Affichage > Dossier comme espace de travail | Partiel | P2 | src/ui/Sidebar.tsx mode 'files' : arborescence repliable du dossier ouvert, pas de rafraîchissement ni de menu contextuel |
| NT-258 | Affichage | [N++] Affichage > Panneaux de projet 1 à 3 | Absent | P3 | arbre virtuel de fichiers enregistré en JSON dans services.settings |
| NT-259 | Affichage | [N++] Affichage > Historique du presse-papiers | Absent | P3 | voir le volet de presse-papiers ci-dessus |
| NT-260 | Affichage | [N++] Affichage > Surveillance du fichier (mode tail -f) | Absent | P2 | interrogation périodique via services.readFile (ou fileInfo) puis ajout au bas avec défilement automatique |
| NT-261 | Affichage | [N++] Affichage > Synchroniser le défilement vertical | Absent | P3 | écouteur scroll sur les deux vues (src/workspace.ts view et view2) |
| NT-262 | Affichage | [N++] Affichage > Synchroniser le défilement horizontal | Absent | P3 | idem sur scrollLeft |
| NT-263 | Affichage | [N++] Affichage > Barre d'état (afficher/masquer) | Présent à vérifier | P2 | src/commands.ts `statusBar` |
| NT-264 | Affichage | [N++] Affichage > Barre de menus classique à la place du ruban | OK | P2 | src/commands.ts `menus` -> src/ui/MenuBar.tsx MenuBar |
| NT-265 | Affichage | [N++] Affichage > Barre d'onglets : masquer, verrouiller, réduire, multiligne, verticale | Absent | P3 | réglages sur src/ui/TabStrip.tsx `TabStrip` (CSS) ; seule la fermeture par bouton existe |
| NT-266 | Affichage | [N++] Marge des numéros de ligne | Présent à vérifier | P1 | src/commands.ts `lineNumbers` -> CodeMirror `lineNumbers` |
| NT-267 | Affichage | [N++] Marge des signets (masquable) | Partiel | P3 | marge toujours présente (src/editor/marks.ts `bookmarkExtension`), sans réglage de masquage |
| NT-268 | Affichage | [N++] Numéros de ligne relatifs | Absent | P3 | lineNumbers avec l option formatNumber avec la ligne du curseur (VS Code editor.lineNumbers relative) |
| NT-269 | Affichage | [N++] Surlignage de la ligne courante | Partiel | P3 | CodeMirror `highlightActiveLine` toujours actif (src/editor/extensions.ts), non désactivable |
| NT-270 | Affichage | [N++] Colonne repère (bord vertical, 80 colonnes) | Absent | P2 | extension qui trace une ligne verticale à N caractères (ViewPlugin + CSS ch) |
| NT-271 | Affichage | [N++] Défilement au-delà de la dernière ligne | Absent | P3 | CodeMirror `scrollPastEnd`() de @codemirror/view |
| NT-272 | Affichage | [N++] Barre d'outils (petites/grandes icônes, standard) | Partiel | P3 | ruban Office 2024 par onglets à la place (src/ribbon.ts `buildRibbon`) ; pas de barre d'outils N++ |
| NT-273 | Affichage | [VSCode] Fil d'Ariane (breadcrumbs) | Absent | P2 | barre au-dessus de l'éditeur construite sur le syntaxTree et le chemin du fichier |
| NT-274 | Affichage | [VSCode] Minimap | Absent | P2 | voir Carte du document (même fonction) |
| NT-275 | Affichage | [VSCode] Défilement collant (sticky scroll) des en-têtes de bloc | Absent | P3 | ViewPlugin qui épingle en haut les noeuds de syntaxe englobants |
| NT-276 | Affichage | [VSCode] Colorisation des paires de crochets | Absent | P2 | décoration par profondeur à partir de CodeMirror `syntaxTree`/bracketMatching, ou paquet tiers rainbow-brackets |
| NT-277 | Affichage | [VSCode] Centrer la mise en page (Centered Layout) | Partiel | P3 | mode sans distraction centre à 52 em (src/notes.css `.is-zen`) ; marge réglable dans Police… mais pas de bascule dédiée |
| NT-278 | Affichage | [VSCode] Caractères de rendu des espaces : limites, sélection, fin de ligne seule | Partiel | P3 | un seul mode (tout) via `whitespace` |
| NT-279 | Affichage | [VSCode] Style du curseur (ligne, bloc, souligné), clignotement | Absent | P3 | CSS `.cm-cursor` (largeur fixée à 2 px dans src/notes.css) + réglages |
| NT-280 | Affichage | [VSCode] Défilement fluide et animation du curseur | Absent | P3 | CSS scroll-behavior et transition sur `.cm-cursor` |
| NT-281 | Affichage | [VSCode] Largeur de mot de saut de ligne (wordWrapColumn) | Absent | P3 | largeur max `ch` du `.cm-content` pour un retour à la ligne à N colonnes |
| NT-282 | Affichage | [Obsidian] Largeur de ligne lisible | Partiel | P3 | marge réglable (Police…) et mode sans distraction ; pas d'option « largeur lisible » automatique |
| NT-283 | Affichage | [Obsidian] Basculer Édition / Lecture | Partiel | P2 | volet Aperçu Markdown (src/commands.ts `preview`, Ctrl+Maj+M) mais pas de mode lecture plein écran sur le même volet |
| NT-284 | Affichage | [Obsidian] Aperçu en direct (live preview : rendu dans l'éditeur) | Absent | P1 | décorations de widgets sur le syntaxTree Markdown (titres, gras, liens, listes) masquant le balisage hors ligne courante |
| NT-285 | Affichage | [Win11] Mode d'affichage Markdown rendu dans l'éditeur | Absent | P2 | même chantier que l'aperçu en direct |

## 10. Encodages et fins de ligne (Notepad++ menu Encodage, Bloc-notes Win11, VS Code)

> Seuls cinq encodages existent : utf-8, utf-8-bom, utf-16le, utf-16be, windows-1252 ({enc} `ENCODINGS`, type TextEncoding de @forgeoffice/docx). Le décodage navigateur (TextDecoder) sait lire presque tous les autres ; l'encodage inverse exige des tables (crate encoding_rs côté Tauri ou paquet JS).

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-286 | Encodage | [N++] Encodage > ANSI (ici Windows-1252) | OK | P1 | src/logic/encoding.ts `ENCODINGS` : 'windows-1252' ; alerte src/strings.ts `lossy` si des caractères sont perdus |
| NT-287 | Encodage | [N++] Encodage > UTF-8 (sans BOM) | OK | P1 | src/logic/encoding.ts `ENCODINGS` : 'utf-8' (défaut des nouveaux onglets) |
| NT-288 | Encodage | [N++] Encodage > UTF-8 avec BOM | OK | P1 | 'utf-8-bom' ; BOM conservé à l'enregistrement (src/logic/encoding.ts `encodeFile`) |
| NT-289 | Encodage | [N++] Encodage > UTF-16 Big Endian avec BOM (UCS-2 BE) | OK | P2 | 'utf-16be' |
| NT-290 | Encodage | [N++] Encodage > UTF-16 Little Endian avec BOM (UCS-2 LE) | OK | P2 | 'utf-16le' |
| NT-291 | Encodage | [N++] Encodage > UTF-16 sans BOM (détection) | Présent à vérifier | P3 | détection par proportion d'octets nuls (docx `detectEncoding`) ; l'enregistrement écrit toujours un BOM |
| NT-292 | Encodage | [N++] Encodage > UTF-32 | Absent | P3 | TextDecoder ne gère pas UTF-32 : décodeur manuel de 4 octets, ajouter 'utf-32le/be' à TextEncoding (paquet docx) |
| NT-293 | Encodage | [N++] Encodage > Convertir en ANSI / UTF-8 / UTF-8 BOM / UCS-2 (conversion du texte) | OK | P1 | src/commands.ts `encoding` change Tab.encoding : le texte est ré-encodé à l'enregistrement (onglet marqué modifié) |
| NT-294 | Encodage | [Win11] Enregistrer avec l'encodage (menu de la barre d'état) | OK | P1 | src/ui/StatusLine.tsx `onPick('encoding')` et Backstage src/ui/FileBackstage.tsx `SaveAsPage` |
| NT-295 | Encodage | [Win11] Rouvrir avec l'encodage (réinterpréter les octets) | Absent | P1 | decodeFile(bytes, forced) existe dans src/logic/encoding.ts mais aucune commande ne l'appelle ; conserver les octets lus dans Tab et relire avec l'encodage choisi |
| NT-296 | Encodage | [N++] Détection automatique de l'encodage à l'ouverture (UTF-8 valide sinon ANSI) | OK | P1 | src/logic/encoding.ts `decodeFile` -> docx `detectEncoding` |
| NT-297 | Encodage | [N++] Détection par heuristique des jeux de caractères non occidentaux (chardet) | Absent | P2 | ajouter une détection statistique (jschardet) ou la crate chardetng côté Tauri |
| NT-298 | Encodage | [N++] Fichier binaire : ouverture en lecture seule avec avertissement | Présent à vérifier | P2 | src/logic/encoding.ts `looksBinary` + src/workspace.ts `openFile` (Tab.readOnly) |
| NT-299 | Encodage | [N++] Jeux de caractères > Arabe (ISO 8859-6, Windows-1256, OEM 720) | Absent | P2 | TextDecoder('windows-1256'/'iso-8859-6') en lecture ; table inverse en écriture |
| NT-300 | Encodage | [N++] Jeux de caractères > Balte (ISO 8859-4, ISO 8859-13, OEM 775, Windows-1257) | Absent | P3 | idem : étiquettes WHATWG windows-1257, iso-8859-4, iso-8859-13 |
| NT-301 | Encodage | [N++] Jeux de caractères > Celtique (ISO 8859-14) | Absent | P3 | étiquette iso-8859-14 |
| NT-302 | Encodage | [N++] Jeux de caractères > Cyrillique (ISO 8859-5, KOI8-R, KOI8-U, Windows-1251, DOS 855/866) | Absent | P1 | windows-1251 et koi8-r sont lisibles par TextDecoder ; prévoir l'écriture et la détection |
| NT-303 | Encodage | [N++] Jeux de caractères > Europe centrale (ISO 8859-2, Windows-1250, OEM 852) | Absent | P1 | windows-1250 / iso-8859-2 (polonais, tchèque, hongrois) |
| NT-304 | Encodage | [N++] Jeux de caractères > Chinois (Big5, GB2312, GBK, GB18030) | Absent | P2 | TextDecoder('gbk'/'big5'/'gb18030') ; encodeur via encoding_rs (Tauri) |
| NT-305 | Encodage | [N++] Jeux de caractères > Europe de l'Est (ISO 8859-16) | Absent | P3 | étiquette iso-8859-16 |
| NT-306 | Encodage | [N++] Jeux de caractères > Grec (ISO 8859-7, Windows-1253, OEM 737) | Absent | P2 | windows-1253 / iso-8859-7 |
| NT-307 | Encodage | [N++] Jeux de caractères > Hébreu (ISO 8859-8, Windows-1255, OEM 862) | Absent | P2 | windows-1255 / iso-8859-8 |
| NT-308 | Encodage | [N++] Jeux de caractères > Japonais (Shift-JIS, EUC-JP, ISO-2022-JP) | Absent | P2 | TextDecoder('shift_jis'/'euc-jp') ; encodage inverse via encoding_rs |
| NT-309 | Encodage | [N++] Jeux de caractères > Coréen (Windows-949, EUC-KR, Johab) | Absent | P2 | TextDecoder('euc-kr') ; Johab absent de WHATWG |
| NT-310 | Encodage | [N++] Jeux de caractères > Europe du Nord (ISO 8859-10) | Absent | P3 | étiquette iso-8859-10 |
| NT-311 | Encodage | [N++] Jeux de caractères > Thaï (TIS-620, Windows-874) | Absent | P3 | étiquette windows-874 |
| NT-312 | Encodage | [N++] Jeux de caractères > Turc (ISO 8859-3, ISO 8859-9, Windows-1254, OEM 857) | Absent | P2 | windows-1254 / iso-8859-9 |
| NT-313 | Encodage | [N++] Jeux de caractères > Europe de l'Ouest : ISO 8859-1 (Latin-1) | Absent | P1 | distinct de Windows-1252 pour les octets 0x80-0x9F ; ajouter 'iso-8859-1' à TextEncoding |
| NT-314 | Encodage | [N++] Jeux de caractères > Europe de l'Ouest : ISO 8859-15 (Latin-9, euro) | Absent | P2 | étiquette iso-8859-15 |
| NT-315 | Encodage | [N++] Jeux de caractères > Europe de l'Ouest : OEM 850 / 437 / 858 (DOS) | Absent | P2 | tables CP437/CP850 (TextDecoder ne les expose pas ; table statique de 256 entrées) |
| NT-316 | Encodage | [N++] Jeux de caractères > Europe de l'Ouest : Macintosh (Mac Roman) | Absent | P3 | étiquette macintosh |
| NT-317 | Encodage | [N++] Jeux de caractères > Vietnamien (Windows-1258) | Absent | P3 | étiquette windows-1258 |
| NT-318 | Encodage | [N++] Jeux de caractères > menu compact avec recherche | Partiel | P3 | sélecteur filtrable de src/ui/Palette.tsx Palette pour 5 entrées ; passe à l'échelle si la liste grossit |
| NT-319 | Encodage | [Win11] Encodage affiché et modifiable dans la barre d'état | Présent à vérifier | P1 | src/ui/StatusLine.tsx `enc` : S.encodings[tab.encoding] |
| NT-320 | Encodage | [VSCode] Encodage par défaut et détection automatique (files.encoding, files.autoGuessEncoding) | Partiel | P2 | détection automatique oui ; défaut d'un nouvel onglet figé à 'utf-8' (src/workspace.ts `add`) sans réglage |
| NT-321 | Encodage | [N++] Fins de ligne : Windows (CR LF), Unix (LF), Mac (CR) | OK | P1 | src/logic/encoding.ts `EOLS`, src/commands.ts `eol` ; menu Format > Fins de ligne (src/ribbon.ts `buildMenus`) |
| NT-322 | Encodage | [N++] Fins de ligne : nouveau document en CRLF par défaut (réglage) | Partiel | P2 | CRLF figé dans src/workspace.ts `add` (eol: 'crlf') ; ajouter un réglage « fin de ligne par défaut » (LF sous Linux/macOS) |
| NT-323 | Encodage | [N++] Fins de ligne : détection de fins de ligne mélangées avec avertissement | Partiel | P2 | src/logic/encoding.ts `detectEol` retient la majorité et normalise tout en LF interne sans prévenir ; afficher « Mixte » et proposer de convertir |
| NT-324 | Encodage | [N++] Fins de ligne Unicode (NEL, LS, PS) | Absent | P3 | option de normalisation à l'ouverture |
| NT-325 | Encodage | [Win11] Fins de ligne affichées dans la barre d'état (Windows CRLF / Unix LF / Macintosh CR) | Présent à vérifier | P1 | src/ui/StatusLine.tsx `eol` |
| NT-326 | Encodage | [VSCode] Insérer un saut de ligne final / supprimer les espaces en fin à l'enregistrement | Absent | P2 | options d'enregistrement appliquées dans src/workspace.ts `save` avant encodeFile |

## 11. Langages et coloration syntaxique (Notepad++ menu Langage, VS Code, Win11)

> Les langages viennent de @codemirror/language-data (Lezer et modes hérités, plus de 100) et de neuf compléments ({lang} `EXTRA`). Le choix manuel passe par la palette (barre d'état, clic sur le langage) ; l'attribution automatique se fait par nom de fichier.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-327 | Langage | [N++] Langage > choisir le langage de l'onglet | Présent à vérifier | P1 | src/commands.ts `language` + clic sur le langage de src/ui/StatusLine.tsx ; Tab.lang mémorisé dans la session (src/logic/session.ts `lang`) |
| NT-328 | Langage | [N++] Langage > Texte brut | Présent à vérifier | P1 | src/strings.ts `plainText`, repli par indentation seulement (src/editor/extensions.ts `indentFold`) |
| NT-329 | Langage | [N++] Attribution automatique par extension et nom de fichier | Présent à vérifier | P1 | src/editor/languages.ts `languageForFile` (LanguageDescription.matchFilename + table `ALIASES` : .jsonc, .h, .svelte, .cu, .asm…) |
| NT-330 | Langage | [N++] Attribution par ligne shebang (#!/bin/bash, #!/usr/bin/env python) | Absent | P3 | lire la première ligne dans src/workspace.ts `loadLanguage` quand l'extension est inconnue |
| NT-331 | Langage | [VSCode] Détection par contenu (<?xml, <!DOCTYPE html, {) pour un fichier sans extension | Absent | P3 | heuristique sur les 200 premiers caractères |
| NT-332 | Langage | [N++] Langage > C / C++ / C# / Objective-C / Java | Présent à vérifier | P1 | language-data : C, C++, C#, Objective-C, Objective-C++, Java (src/editor/languages.ts `LANGUAGES`) |
| NT-333 | Langage | [N++] Langage > JavaScript / TypeScript / JSX / TSX / JSON | OK | P1 | language-data (lang-javascript, lang-json) ; .jsonc/.json5 via `ALIASES` |
| NT-334 | Langage | [N++] Langage > HTML / CSS / SCSS / Sass / Less / XML / SVG | Présent à vérifier | P1 | language-data (lang-html, lang-css, lang-sass, lang-less, lang-xml) |
| NT-335 | Langage | [N++] Langage > PHP / ASP / JSP | Partiel | P2 | PHP complet ; ASP/ASPX rattachés à HTML par `ALIASES`, JSP absent |
| NT-336 | Langage | [N++] Langage > Python / Ruby / Perl / Lua / Tcl | Présent à vérifier | P1 | language-data (lang-python, legacy ruby, perl, lua, tcl) |
| NT-337 | Langage | [N++] Langage > Rust / Go / Swift / Kotlin / Scala / Dart | Présent à vérifier | P1 | language-data (lang-rust, lang-go, legacy swift, kotlin, scala, dart) |
| NT-338 | Langage | [N++] Langage > SQL (MySQL, PostgreSQL, MariaDB, SQLite, MS SQL, PL/SQL) | Présent à vérifier | P1 | language-data (lang-sql) |
| NT-339 | Langage | [N++] Langage > Shell / Bash / PowerShell | Présent à vérifier | P1 | language-data : Shell, PowerShell |
| NT-340 | Langage | [N++] Langage > Batch (.bat, .cmd) | Présent à vérifier | P1 | src/editor/languages.ts `EXTRA` Batch -> src/editor/modes.ts `batch` |
| NT-341 | Langage | [N++] Langage > Makefile / CMake / Dockerfile / Nginx | Présent à vérifier | P2 | Makefile (src/editor/modes.ts `makefile`), CMake, Dockerfile, Nginx (language-data) |
| NT-342 | Langage | [N++] Langage > YAML / TOML / INI / Properties | Présent à vérifier | P1 | language-data (YAML, TOML, Properties) et complément INI / Config (src/editor/languages.ts `EXTRA`) |
| NT-343 | Langage | [N++] Langage > Markdown | Présent à vérifier | P1 | src/editor/languages.ts `EXTRA` Markdown avec blocs de code colorés ; continuation de listes à Entrée (lang-markdown) |
| NT-344 | Langage | [N++] Langage > LaTeX / TeX | Présent à vérifier | P3 | language-data (stex) ; .sty/.cls/.bib via `ALIASES` |
| NT-345 | Langage | [N++] Langage > Diff / Patch | Présent à vérifier | P2 | language-data : diff |
| NT-346 | Langage | [N++] Langage > Assembleur (x86, NASM, MASM) | Partiel | P3 | seulement Gas (.s) ; .asm/.nasm/.inc rattachés à Gas par `ALIASES`, pas de mode NASM/MASM |
| NT-347 | Langage | [N++] Langage > Pascal / Delphi | Présent à vérifier | P3 | language-data : Pascal (.pp/.dpr/.lpr via `ALIASES`) |
| NT-348 | Langage | [N++] Langage > Fortran / COBOL / Forth | Présent à vérifier | P3 | language-data (Fortran, Cobol, Forth) |
| NT-349 | Langage | [N++] Langage > Haskell / OCaml / F# / Erlang | Présent à vérifier | P2 | language-data |
| NT-350 | Langage | [N++] Langage > Lisp / Scheme / Clojure | Présent à vérifier | P3 | language-data (Common Lisp, Scheme, Clojure) |
| NT-351 | Langage | [N++] Langage > Visual Basic / VBScript | Présent à vérifier | P2 | language-data : VB.NET, VBScript ; .bas/.vba via `ALIASES` |
| NT-352 | Langage | [N++] Langage > VHDL / Verilog / SystemVerilog | Présent à vérifier | P3 | language-data |
| NT-353 | Langage | [N++] Langage > R / Julia / Octave (Matlab) | Partiel | P3 | R, Julia, Octave présents ; MATLAB seulement par l'extension .m partagée avec Objective-C |
| NT-354 | Langage | [N++] Langage > Nim / Zig / Solidity / GLSL-HLSL / GDScript | Présent à vérifier | P3 | compléments WinNote (src/editor/languages.ts `EXTRA`, src/editor/modes.ts `nim` `zig` `solidity`) |
| NT-355 | Langage | [N++] Langage > NSIS / SAS / Smalltalk / Groovy / D | Présent à vérifier | P3 | language-data |
| NT-356 | Langage | [N++] Langage > Ada, ActionScript, AutoIt, BaanC, Raku | Absent | P3 | créer des StreamParser (simple-mode) ou importer @codemirror/legacy-modes s'ils existent ; AutoIt et Raku n'ont pas de mode officiel |
| NT-357 | Langage | [N++] Langage > Fichier du Registre Windows (.reg) | Absent | P3 | petit mode simple-mode (clés [HKEY_…], valeurs "nom"=) |
| NT-358 | Langage | [N++] Langage > Inno Setup / PureBasic / BlitzBasic / FreeBasic | Absent | P3 | modes à écrire dans src/editor/modes.ts sur le modèle de `batch` |
| NT-359 | Langage | [N++] Langage > CSV / TSV (colonnes colorées) | Absent | P2 | ViewPlugin colorant une colonne sur N (décoration par champ) |
| NT-360 | Langage | [N++] Langage > Définir votre langage (UDL : mots-clés, opérateurs, commentaires, délimiteurs) | Absent | P2 | éditeur de définitions JSON converti en StreamLanguage.define(simpleMode(...)) ; stockage dans services.settings |
| NT-361 | Langage | [N++] Langage > Importer / exporter un UDL (.xml) | Absent | P3 | convertisseur du format userDefineLang.xml de N++ |
| NT-362 | Langage | [N++] Langage > Ouvrir le dossier des UDL | Absent | P3 | sans objet hors bureau ; liste dans un volet de réglages |
| NT-363 | Langage | [N++] Coloration des blocs de code dans le Markdown | Présent à vérifier | P2 | src/editor/languages.ts `EXTRA` Markdown : codeLanguages: DATA |
| NT-364 | Langage | [N++] Coloration du JavaScript/CSS imbriqués dans le HTML | Présent à vérifier | P2 | lang-html mixe JavaScript et CSS ; ASP/PHP imbriqués limités |
| NT-365 | Langage | [N++] Correspondance des accolades, crochets, parenthèses | Présent à vérifier | P1 | CodeMirror `bracketMatching`() dans src/editor/extensions.ts, style `.cm-matchingBracket` (src/notes.css) |
| NT-366 | Langage | [N++] Mise en évidence de la balise HTML/XML correspondante | Absent | P2 | ViewPlugin sur le syntaxTree (noeud OpenTag/CloseTag) pour décorer la paire |
| NT-367 | Langage | [N++] Indentation automatique selon le langage | Présent à vérifier | P1 | CodeMirror `indentOnInput`() et règles de chaque langage ; Entrée = CodeMirror `insertNewlineAndIndent` |
| NT-368 | Langage | [N++] Mise en évidence intelligente (occurrences du mot sous le curseur) | Partiel | P2 | CodeMirror `highlightSelectionMatches`() ne surligne que le texte sélectionné ; mot sous le curseur sans sélection non couvert |
| NT-369 | Langage | [N++] Fonction de repli par syntaxe | Partiel | P2 | replis fournis par Lezer pour JS, JSON, HTML, XML, Python, Markdown… ; modes hérités (Batch, Makefile, Nim…) sans repli |
| NT-370 | Langage | [VSCode] Snippets (extraits de code avec tabulations) | Absent | P2 | CodeMirror `snippetCompletion` de @codemirror/autocomplete + bibliothèque par langage dans les réglages |
| NT-371 | Langage | [VSCode] Emmet (abréviations HTML/CSS) | Absent | P2 | paquet @emmetio/codemirror6-plugin (expand sur Tab) |
| NT-372 | Langage | [VSCode] IntelliSense / complétions de langage | Absent | P1 | autocompletion() active les sources de lang-html, lang-css, lang-sql, lang-javascript (déjà installées) |
| NT-373 | Langage | [VSCode] Diagnostics et soulignement des erreurs (JSON, JavaScript) | Absent | P2 | @codemirror/lint est installé mais non utilisé : jsonParseLinter(), gutter lintGutter() |
| NT-374 | Langage | [VSCode] Formater le document / la sélection | Absent | P2 | JSON.stringify(…, null, indent), XML pretty-print intégrés ; Prettier en WASM pour le reste |
| NT-375 | Langage | [VSCode] Aller à la définition, renommer un symbole, références (LSP) | Absent | P3 | client LSP via services.native ; hors périmètre d'un Bloc-notes léger |
| NT-376 | Langage | [VSCode] Infobulles au survol (hover) | Absent | P3 | CodeMirror `hoverTooltip` alimenté par le syntaxTree ou un LSP |
| NT-377 | Langage | [Win11] Coloration syntaxique du texte brut | Présent à vérifier | P3 | sans objet : le Bloc-notes Windows n'en a pas ; ForgeOffice colore le Markdown et plus de 100 langages |

## 12. Notepad++ : menu Paramètres et boîte Préférences, page par page

> Les réglages existants sont dans {pref} `NotesPrefs` (clé « notes.prefs » de services.settings), la boîte Police… ({dlg} `FontDialog`) et le Backstage > Options ({bs}). Il n'y a pas de boîte Préférences à pages.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-378 | Dialogue | [N++] Paramètres > Préférences… (boîte à pages unique) | Partiel | P1 | deux endroits seulement : src/ui/Dialogs.tsx `FontDialog` (6 champs) et src/ui/FileBackstage.tsx Options (thème, disposition, menus, correcteur) ; créer une boîte à pages src/ui/Dialogs.tsx |
| NT-379 | Dialogue | [N++] Préférences > Général : afficher/masquer la barre d'outils, la barre de menus | Partiel | P3 | ruban ou menus classiques via src/commands.ts `menus` ; pas de masquage complet |
| NT-380 | Dialogue | [N++] Préférences > Général : bouton de fermeture sur chaque onglet | Présent à vérifier | P2 | src/ui/TabStrip.tsx `nt-tab__close` ; visible au survol et sur l'onglet actif |
| NT-381 | Dialogue | [N++] Préférences > Général : fermer un onglet par double-clic | Absent | P3 | onDoubleClick sur `.nt-tab` (src/ui/TabStrip.tsx `TabStrip`) |
| NT-382 | Dialogue | [N++] Préférences > Général : onglets verrouillés (pas de glisser-déposer) | Absent | P3 | booléen qui retire draggable de src/ui/TabStrip.tsx `TabStrip` |
| NT-383 | Dialogue | [N++] Préférences > Général : sélecteur de documents (Ctrl+Tab par ordre d'usage) | Absent | P2 | liste MRU des onglets ; src/commands.ts `tabNext` suit aujourd'hui l'ordre de la barre |
| NT-384 | Dialogue | [N++] Préférences > Général : langue de l'interface | Absent | P3 | français uniquement (src/strings.ts) par exigence « Français d'abord » ; i18n après l'application finie |
| NT-385 | Dialogue | [N++] Préférences > Général : barre d'état | Présent à vérifier | P2 | src/commands.ts `statusBar` |
| NT-386 | Thème/Réglage | [N++] Préférences > Édition 1 : largeur et clignotement du curseur | Absent | P3 | largeur fixe de 2 px dans src/notes.css `.cm-cursor` ; variables CSS pilotées par NotesPrefs |
| NT-387 | Thème/Réglage | [N++] Préférences > Édition 1 : surlignage de la ligne courante (activer/désactiver) | Partiel | P3 | CodeMirror `highlightActiveLine` toujours actif (src/editor/extensions.ts) ; passer en Compartment |
| NT-388 | Thème/Réglage | [N++] Préférences > Édition 1 : retour automatique à la ligne | Présent à vérifier | P1 | src/logic/prefs.ts `wrap` -> src/editor/extensions.ts compartiment `wrap` |
| NT-389 | Thème/Réglage | [N++] Préférences > Édition 1 : numéros de ligne et marge des signets | Partiel | P2 | numéros OK (src/logic/prefs.ts `lineNumbers`) ; marge des signets non masquable |
| NT-390 | Thème/Réglage | [N++] Préférences > Édition 1 : style de la marge de repli | Partiel | P3 | un seul style (chevron) ; ajouter 3 variantes CSS |
| NT-391 | Thème/Réglage | [N++] Préférences > Édition 1 : colonne repère verticale (bord) | Absent | P2 | voir Colonne repère dans Affichage |
| NT-392 | Thème/Réglage | [N++] Préférences > Édition 1 : marges gauche et droite du texte | Partiel | P2 | une marge unique src/logic/prefs.ts `margin` (0 à 400 px) ; gauche/droite indépendantes absentes |
| NT-393 | Thème/Réglage | [N++] Préférences > Édition 1 : défilement au-delà de la dernière ligne | Absent | P3 | CodeMirror `scrollPastEnd`() |
| NT-394 | Thème/Réglage | [N++] Préférences > Édition 2 : mise en évidence intelligente (casse, mot entier) | Partiel | P3 | CodeMirror `highlightSelectionMatches`() sans options exposées |
| NT-395 | Thème/Réglage | [N++] Préférences > Édition 2 : fermeture automatique des paires ( [ { " ' | OK | P1 | CodeMirror `closeBrackets`() et ses options (brackets: ['(', '[', '{', "'", '"']) Fait 2026-11-07 : voir NT-146 (réglage dans le menu Outils et la palette). |
| NT-396 | Thème/Réglage | [N++] Préférences > Édition 2 : fermeture automatique des balises HTML/XML | Présent à vérifier | P3 | incluse par défaut dans le support HTML/XML (voir Édition > fermeture automatique) |
| NT-397 | Thème/Réglage | [N++] Préférences > Édition 2 : indentation automatique (aucune, basique, avancée) | Partiel | P3 | toujours active ; pas de mode « aucune » |
| NT-398 | Thème/Réglage | [N++] Préférences > Édition 2 : multi-édition activée | Présent à vérifier | P2 | EditorState.allowMultipleSelections (src/editor/extensions.ts), toujours actif |
| NT-399 | Thème/Réglage | [N++] Préférences > Édition 2 : copier/couper sans sélection copie la ligne | Absent | P1 | voir la fonction équivalente d'Édition (copySelection) |
| NT-400 | Thème/Réglage | [N++] Préférences > Mode sombre : activer, couleurs personnalisées | Partiel | P2 | thèmes sombres (src/logic/themes.ts `THEMES`, champ `dark` de `NoteTheme`) et thème Office qui suit la suite ; couleurs d'interface non personnalisables |
| NT-401 | Thème/Réglage | [N++] Préférences > Marges / bordures : largeur de bordure, largeur de marge des numéros | Absent | P3 | variables CSS dans src/notes.css `.cm-gutters` |
| NT-402 | Thème/Réglage | [N++] Préférences > Nouveau document : format de fin de ligne par défaut | Absent | P2 | src/workspace.ts `add` fixe eol: 'crlf' |
| NT-403 | Thème/Réglage | [N++] Préférences > Nouveau document : encodage par défaut | Absent | P2 | src/workspace.ts `add` fixe encoding: 'utf-8' |
| NT-404 | Thème/Réglage | [N++] Préférences > Nouveau document : langage par défaut | Absent | P3 | Tab.lang initial dans src/workspace.ts `newTab` |
| NT-405 | Thème/Réglage | [N++] Préférences > Nouveau document : ouvrir les ANSI en UTF-8 | Partiel | P3 | détection automatique ; pas de réglage « forcer » |
| NT-406 | Thème/Réglage | [N++] Préférences > Dossier par défaut (ouverture, enregistrement) | Absent | P3 | géré par les dialogues du système via services.openFile/saveFile ; mémoriser le dernier dossier dans settings |
| NT-407 | Thème/Réglage | [N++] Préférences > Fichiers récents : nombre, affichage du chemin | Absent | P3 | fixé à 15 ; voir Fichier > Fichiers récents |
| NT-408 | Thème/Réglage | [N++] Préférences > Langage : tabulation par langage (taille, espaces) | Absent | P2 | table langage -> {tabSize, useSpaces} appliquée par src/editor/extensions.ts compartiment `tabs` |
| NT-409 | Thème/Réglage | [N++] Préférences > Langage : taille de tabulation | Présent à vérifier | P1 | src/logic/prefs.ts `tabSize` (1 à 16) via la boîte Police… |
| NT-410 | Thème/Réglage | [N++] Préférences > Langage : activer ou masquer des langages du menu | Absent | P3 | liste d'exclusion dans les réglages, appliquée par src/editor/languages.ts `languageNames` |
| NT-411 | Thème/Réglage | [N++] Préférences > Impression : numéros de ligne, couleurs, marges | Absent | P2 | options passées à src/dom-actions.ts `printText` et src/logic/print.ts `pageCss` |
| NT-412 | Thème/Réglage | [N++] Préférences > Impression : en-tête et pied de page | Partiel | P2 | en-tête fixe (nom du fichier) et pied « Page n / N » (src/logic/print.ts `pageCss`), sans variables personnalisables |
| NT-413 | Thème/Réglage | [N++] Préférences > Recherche : remplir le champ avec la sélection | Présent à vérifier | P2 | CodeMirror `openSearchPanel` reprend la sélection comme requête |
| NT-414 | Thème/Réglage | [N++] Préférences > Recherche : confirmer « Tout remplacer dans tous les documents » | Absent | P3 | dépend de la fonction elle-même |
| NT-415 | Thème/Réglage | [N++] Préférences > Sauvegarde : instantané de session et sauvegarde périodique | Partiel | P1 | src/NotesApp.tsx intervalle de 5 s + 1 s après changement, src/workspace.ts `persist` ; pas de réglage de l'intervalle ni de désactivation |
| NT-416 | Thème/Réglage | [N++] Préférences > Sauvegarde : copie de sauvegarde à l'enregistrement (.bak, dossier dédié) | Absent | P2 | écrire l'ancienne version dans un dossier .forge-backup avant src/workspace.ts `save` |
| NT-417 | Thème/Réglage | [N++] Préférences > Sauvegarde : enregistrement automatique après N minutes | Absent | P1 | minuteur appelant src/workspace.ts `save` sur les onglets avec chemin (voir NT-A01 pour l'historique) |
| NT-418 | Thème/Réglage | [N++] Préférences > Auto-complétion : activer, déclenchement après N caractères | Partiel | P1 | CodeMirror `autocompletion`({activateOnTyping: true}) et NotesPrefs.completion Fait 2026-11-07 : activation de la complétion en option ; pas de réglage du nombre de caractères. |
| NT-419 | Thème/Réglage | [N++] Préférences > Multi-instance et date : modes d'instances | Partiel | P2 | plusieurs fenêtres supportées (session par fenêtre, src/logic/session.ts `claimSession`), sans réglage d'ouverture |
| NT-420 | Thème/Réglage | [N++] Préférences > Multi-instance et date : format de date personnalisé | Absent | P3 | voir Édition > Insérer > Date et heure |
| NT-421 | Thème/Réglage | [N++] Préférences > Délimiteurs : caractères d'un mot / délimiteurs de sélection | Absent | P3 | EditorState.languageData wordChars et charCategorizer |
| NT-422 | Thème/Réglage | [N++] Préférences > Performances : fichiers volumineux (désactiver coloration, repli) | Partiel | P2 | refus au-delà de 64 Mo (src/logic/encoding.ts `MAX_FILE_BYTES`) ; pas de mode dégradé progressif |
| NT-423 | Thème/Réglage | [N++] Préférences > Cloud et liens : dossier de synchronisation des réglages | Absent | P2 | chiffrer services.settings vers un dossier ou un serveur (voir NT-A05) |
| NT-424 | Thème/Réglage | [N++] Préférences > Cloud et liens : liens cliquables (http, https, mailto) | Présent à vérifier | P1 | src/editor/marks.ts `linkMatcher`, Ctrl+clic ; refus des schémas dangereux (src/logic/links.ts `isSafeUrl`) |
| NT-425 | Thème/Réglage | [N++] Préférences > Cloud et liens : liste de schémas d'URL | Absent | P3 | regex de linkMatcher figée sur http(s)://, mailto: |
| NT-426 | Thème/Réglage | [N++] Préférences > Moteur de recherche (Google, Bing, DuckDuckGo, StackOverflow, personnalisé) | Absent | P3 | réglage + commande « Rechercher la sélection sur Internet » |
| NT-427 | Thème/Réglage | [N++] Préférences > Divers : détecter les changements du fichier par un autre programme | Partiel | P2 | src/workspace.ts `checkExternal` au retour de focus (bureau seulement), recharge si onglet propre, avertit sinon |
| NT-428 | Thème/Réglage | [N++] Préférences > Divers : mise à jour automatique | Présent à vérifier | P2 | src/commands.ts `checkUpdate` + mise à jour de la coquille (Accueil > Options) |
| NT-429 | Thème/Réglage | [N++] Préférences > Divers : réduire dans la zone de notification | Absent | P3 | plugin tray de Tauri (côté coquille) |
| NT-430 | Thème/Réglage | [N++] Préférences > Divers : ouvrir le dernier fichier par glisser-déposer / fichiers multiples | Présent à vérifier | P2 | src/NotesApp.tsx onDropCapture : un onglet par fichier déposé |
| NT-431 | Thème/Réglage | [N++] Paramètres > Éditeur de styles (Style Configurator) : choisir un thème | Présent à vérifier | P1 | src/logic/themes.ts `THEMES` (17 + Office) via src/commands.ts `theme:*`, menu Thème, Backstage Options |
| NT-432 | Thème/Réglage | [N++] Éditeur de styles : couleurs, police, gras, italique par style et par langage | Absent | P2 | éditeur de HighlightStyle par balise Lezer, stocké dans NotesPrefs et appliqué à src/editor/extensions.ts `highlight` |
| NT-433 | Thème/Réglage | [N++] Éditeur de styles : importer / exporter un thème | Absent | P3 | JSON du NoteTheme (src/logic/themes.ts) ; import XML de N++ en option |
| NT-434 | Thème/Réglage | [N++] Paramètres > Mappage des raccourcis (Shortcut Mapper) : modifier une touche | Absent | P2 | Command.key est figé dans src/commands.ts ; stocker un tableau id -> raccourci dans NotesPrefs et le fusionner dans buildCommands |
| NT-435 | Thème/Réglage | [N++] Mappage des raccourcis : détection des conflits | Absent | P3 | vérifier les doublons de key dans le registre ; avertir dans la boîte |
| NT-436 | Thème/Réglage | [N++] Mappage des raccourcis : macros, commandes d'exécution, commandes Scintilla | Absent | P3 | dépend des macros et des tâches (voir menus Macro et Exécution) |
| NT-437 | Thème/Réglage | [N++] Paramètres > Modifier le menu contextuel (contextMenu.xml) | Absent | P3 | liste d'ids de commandes dans NotesPrefs lue par src/NotesApp.tsx `editorMenu` |
| NT-438 | Thème/Réglage | [N++] Paramètres > Importer des modules ou des thèmes | Absent | P3 | voir Modules ; import de thème JSON |
| NT-439 | Thème/Réglage | [N++] Paramètres > Ouvrir le dossier des paramètres | Absent | P3 | sans objet dans le navigateur ; bureau : revealInFolder du dossier de données |

## 13. Notepad++ : menus Outils, Macro, Exécution, Modules, Fenêtre, ?

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-440 | Menu | [N++] Outils > Empreinte MD5 (générer, depuis des fichiers, dans le presse-papiers) | Absent | P3 | MD5 n'est pas dans SubtleCrypto : petite implémentation en src/logic/lines.ts ou crypto-js ; sélection ou fichier (src/workspace.ts) |
| NT-441 | Menu | [N++] Outils > Empreinte SHA-1 | Absent | P3 | crypto.subtle.digest('SHA-1', bytes) sur le texte encodé (src/logic/encoding.ts `encodeFile`) |
| NT-442 | Menu | [N++] Outils > Empreinte SHA-256 | Absent | P2 | crypto.subtle.digest('SHA-256', …) |
| NT-443 | Menu | [N++] Outils > Empreinte SHA-512 | Absent | P3 | crypto.subtle.digest('SHA-512', …) |
| NT-444 | Menu | [N++] Macro > Démarrer l'enregistrement / Arrêter | Absent | P2 | enregistrer les transactions utilisateur par EditorView.updateListener (changes + sélection) ou les ids de commande exécutés |
| NT-445 | Menu | [N++] Macro > Lire la macro enregistrée (Ctrl+Maj+P) | Absent | P2 | rejouer la liste d'actions sur la vue active |
| NT-446 | Menu | [N++] Macro > Enregistrer la macro courante… | Absent | P2 | nommer la macro et la stocker dans services.settings ; l'exposer dans la palette |
| NT-447 | Menu | [N++] Macro > Exécuter la macro plusieurs fois (n fois, jusqu'à la fin du fichier) | Absent | P3 | boucle avec arrêt quand le curseur n'avance plus |
| NT-448 | Menu | [N++] Macro > Liste des macros enregistrées et raccourcis associés | Absent | P3 | entrées dynamiques dans buildCommands (src/commands.ts) reliées au mappage des raccourcis |
| NT-449 | Menu | [N++] Exécution > Exécuter… (F5, commande avec variables $(FULL_CURRENT_PATH), $(CURRENT_WORD)) | Absent | P2 | contrat runCommand côté Tauri avec liste blanche ; interdit dans le navigateur |
| NT-450 | Menu | [N++] Exécution > Enregistrer la commande avec un raccourci | Absent | P3 | commandes utilisateur dans NotesPrefs |
| NT-451 | Menu | [N++] Exécution > Ouvrir dans le navigateur (Chrome, Firefox, Edge) | Partiel | P3 | src/commands.ts `openInBrowser` : copie assainie, pas le fichier tel quel |
| NT-452 | Menu | [N++] Exécution > Envoyer par courrier / ouvrir le fichier courant dans une autre application | Absent | P3 | mailto: avec corps, ou plugin opener |
| NT-453 | Menu | [N++] Modules > Gestionnaire de modules (Plugins Admin) | Absent | P3 | système de modules JavaScript sandboxés (Worker) ; hors périmètre court terme |
| NT-454 | Menu | [N++] Modules > Outils MIME : encoder / décoder Base64 | Absent | P2 | btoa/atob sur UTF-8 (TextEncoder) ; commande sur la sélection |
| NT-455 | Menu | [N++] Modules > Outils MIME : encoder / décoder URL, quoted-printable, SAML | Absent | P3 | encodeURIComponent/decodeURIComponent ; autres formats fonctions pures dans src/logic/lines.ts |
| NT-456 | Menu | [N++] Modules > Convertisseur (ASCII vers hexadécimal et inverse, décimal) | Absent | P3 | fonctions pures de conversion appliquées à la sélection |
| NT-457 | Menu | [N++] Modules > Export (copier en RTF / HTML, enregistrer en RTF / HTML) | Absent | P2 | sérialiseur du texte coloré vers HTML ; RTF par conversion ; sortie via services.saveFile |
| NT-458 | Menu | [N++] Modules > Compare : comparer deux onglets | Partiel | P1 | src/commands.ts `compare` -> src/ui/Dialogs.tsx `CompareDialog` : diff ligne à ligne en lecture seule (src/logic/diff.ts `diffLines`) |
| NT-459 | Menu | [N++] Compare : affichage côte à côte avec défilement synchronisé | Absent | P1 | deux vues d'éditeur (@codemirror/merge MergeView) au lieu de la liste unifiée |
| NT-460 | Menu | [N++] Compare : différence suivante / précédente, effacer | Absent | P2 | navigation entre hunks dans le tableau de src/ui/Dialogs.tsx |
| NT-461 | Menu | [N++] Compare : ignorer espaces, casse, fins de ligne | Absent | P2 | options de normalisation passées à src/logic/diff.ts `diffLines` |
| NT-462 | Menu | [N++] Compare : surbrillance des différences au niveau du caractère | Absent | P2 | second passage de diff caractère sur les lignes remplacées |
| NT-463 | Menu | [N++] Compare : comparer avec la dernière version enregistrée | Absent | P2 | conserver Tab.disk (texte de référence) et ouvrir le dialogue avec lui |
| NT-464 | Menu | [N++] Compare : comparer à Git / SVN | Absent | P3 | lecture de HEAD via commande native git show (Tauri) |
| NT-465 | Menu | [N++] Compare : fusionner (copier la différence vers l'autre côté) | Absent | P3 | actions par hunk avec @codemirror/merge |
| NT-466 | Menu | [N++] Modules > XML Tools (formater, valider, XPath) | Absent | P3 | DOMParser + serializer pour mise en forme ; validation de bonne formation |
| NT-467 | Menu | [N++] Modules > JSON Viewer / JSTool (formater, compacter, arbre) | Absent | P2 | commandes JSON.parse/stringify sur la sélection ; arbre dans un volet |
| NT-468 | Menu | [N++] Modules > Éditeur hexadécimal (HEX-Editor) | Absent | P2 | conserver les octets de Tab, afficher une vue 16 colonnes ; édition d'octets avec ré-encodage |
| NT-469 | Menu | [N++] Modules > TextFX : numéroter les lignes | OK | P3 | insérer un compteur en début de ligne (padStart configurable) Fait 2026-11-07 : « Numéroter les lignes » (« 1. texte ») ; tests/lines.test.ts + banc CDP packages/notes/tests/e2e/lines.mjs (palette) + capture notes-lines-menu.png. |
| NT-470 | Menu | [N++] Modules > TextFX : insérer un UUID / GUID | Absent | P3 | crypto.randomUUID() |
| NT-471 | Menu | [N++] Modules > TextFX : entourer de guillemets / retirer / échapper | Absent | P3 | fonctions pures dans src/logic/lines.ts |
| NT-472 | Menu | [N++] Modules > Correcteur orthographique (DSpellCheck) | Partiel | P2 | src/commands.ts `spell` + `spellLang:*` (moteur du webview) ; pas de liste de suggestions ni de dictionnaire propre |
| NT-473 | Menu | [N++] Modules > Explorateur de fichiers (volet Explorer / Light Explorer) | Partiel | P2 | volet src/ui/Sidebar.tsx 'files' pour un dossier chargé en mémoire |
| NT-474 | Menu | [N++] Modules > Auto-enregistrement | Absent | P1 | voir Sauvegarde > enregistrement automatique |
| NT-475 | Menu | [N++] Fenêtre > Fenêtres… (liste des documents : activer, enregistrer, fermer, trier) | Absent | P2 | dialogue listant ws.tabs avec actions groupées |
| NT-476 | Menu | [N++] Fenêtre > Trier les onglets (nom, chemin, type, taille, croissant/décroissant) | Absent | P2 | src/workspace.ts `move` permet déjà de réordonner ; ajouter un tri sur Tab.name/path |
| NT-477 | Menu | [N++] Fenêtre > Document suivant / précédent | Présent à vérifier | P2 | src/commands.ts `tabNext` `tabPrev` |
| NT-478 | Menu | [N++] ? > À propos | Présent à vérifier | P3 | src/commands.ts `about` -> src/ui/Dialogs.tsx `AboutDialog` |
| NT-479 | Menu | [N++] ? > Rechercher une mise à jour | Présent à vérifier | P2 | src/commands.ts `checkUpdate` (services.updater) |
| NT-480 | Menu | [N++] ? > Informations de débogage | Absent | P3 | dialogue copiable : version, plateforme, services disponibles, préférences |
| NT-481 | Menu | [N++] ? > Arguments de ligne de commande | Absent | P3 | page d'aide statique ; le module reçoit seulement la prop `file` |
| NT-482 | Menu | [N++] ? > Aide en ligne / manuel / liste des raccourcis | Absent | P2 | page d'aide intégrée générée depuis le registre src/commands.ts (ids, libellés, raccourcis) |
| NT-483 | Menu | [WinNote] ? > Statistiques du document | OK | P2 | src/commands.ts `stats` -> src/ui/Dialogs.tsx `StatsDialog` |

## 14. Menus contextuels de l'éditeur (une ligne par entrée de chaque produit)

> Menu ForgeOffice actuel ({app} `editorMenu`) : Annuler, Rétablir, Couper, Copier, Coller, Supprimer, Tout sélectionner, Rechercher, Commenter, Ouvrir le lien, Palette. Il est remplacé par le menu natif du moteur web quand le correcteur est actif ou avec Maj+clic droit.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-484 | Menu contextuel | [Win11] Éditeur > Annuler | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : item(map, 'undo') |
| NT-485 | Menu contextuel | [Win11] Éditeur > Couper | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'cut' |
| NT-486 | Menu contextuel | [Win11] Éditeur > Copier | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'copy' |
| NT-487 | Menu contextuel | [Win11] Éditeur > Coller | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'paste' |
| NT-488 | Menu contextuel | [Win11] Éditeur > Supprimer | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'del' |
| NT-489 | Menu contextuel | [Win11] Éditeur > Tout sélectionner | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'selectAll' |
| NT-490 | Menu contextuel | [Win11] Éditeur > Ordre de lecture de droite à gauche | Absent | P3 | bascule par ligne avec CodeMirror `EditorView.perLineTextDirection` et l'attribut dir |
| NT-491 | Menu contextuel | [Win11] Éditeur > Afficher les caractères de contrôle Unicode | Partiel | P3 | CodeMirror `highlightSpecialChars` toujours actif, sans bascule dans le menu |
| NT-492 | Menu contextuel | [Win11] Éditeur > Insérer un caractère de contrôle Unicode (LRM, RLM, ZWJ…) | Absent | P3 | sous-menu qui insère le point de code choisi |
| NT-493 | Menu contextuel | [Win11] Éditeur > Ouvrir l'IME / Reconversion | Présent à vérifier | P3 | géré par le moteur web (composition IME native de CodeMirror) |
| NT-494 | Menu contextuel | [Win11] Éditeur > Suggestions orthographiques | Partiel | P2 | menu natif du webview quand `spell` est actif (src/NotesApp.tsx `editorMenu` renvoie au natif) |
| NT-495 | Menu contextuel | [Win11] Éditeur > Rechercher avec Bing / Réécrire (Copilot) | Absent | P3 | voir menu Édition ; entrée ajoutée à editorMenu |
| NT-496 | Menu contextuel | [N++] Éditeur > Couper / Copier / Coller / Supprimer / Tout sélectionner | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` |
| NT-497 | Menu contextuel | [N++] Éditeur > Ouvrir le fichier (nom sous la sélection) | Absent | P3 | commande openSelectedPath |
| NT-498 | Menu contextuel | [N++] Éditeur > Rechercher sur Internet / changer de moteur | Absent | P3 | voir Édition > Sur la sélection |
| NT-499 | Menu contextuel | [N++] Éditeur > Mettre en style le jeton (styles 1 à 5), effacer le style | Absent | P2 | voir Recherche > Mettre en style |
| NT-500 | Menu contextuel | [N++] Éditeur > Sélection multiple (toutes les occurrences, suivante) | Absent | P3 | ajouter `selectAllMatches` et `selectNext` à editorMenu (commandes existantes src/commands.ts) |
| NT-501 | Menu contextuel | [N++] Éditeur > Commenter / décommenter la ligne | Présent à vérifier | P2 | src/NotesApp.tsx `editorMenu` : 'toggleComment' |
| NT-502 | Menu contextuel | [N++] Éditeur > Commentaire de bloc / décommenter le bloc | Absent | P3 | exposer CodeMirror `toggleBlockComment` comme commande |
| NT-503 | Menu contextuel | [N++] Éditeur > Replier / déplier tout | Absent | P3 | ajouter `foldAll` `unfoldAll` à editorMenu |
| NT-504 | Menu contextuel | [N++] Éditeur > Copier vers le presse-papiers (chemin, nom, dossier) | Absent | P3 | sous-menu dans editorMenu |
| NT-505 | Menu contextuel | [N++] Éditeur > Fermer les instances multiples / modifier le menu contextuel | Absent | P3 | liste configurable d'ids de commandes (NotesPrefs) |
| NT-506 | Menu contextuel | [VSCode] Éditeur > Aller à la définition / déclaration / type / implémentations | Absent | P3 | nécessite un client LSP ; hors périmètre |
| NT-507 | Menu contextuel | [VSCode] Éditeur > Aperçu (peek) de la définition ou des références | Absent | P3 | idem LSP |
| NT-508 | Menu contextuel | [VSCode] Éditeur > Rechercher toutes les références | Absent | P3 | idem LSP ; pour les liens [[ ]] : volet src/ui/Sidebar.tsx 'backlinks' |
| NT-509 | Menu contextuel | [VSCode] Éditeur > Renommer le symbole (F2) | Absent | P3 | LSP ; pour les notes : renommage avec mise à jour des liens (voir Obsidian) |
| NT-510 | Menu contextuel | [VSCode] Éditeur > Modifier toutes les occurrences (Ctrl+F2) | Partiel | P2 | src/commands.ts `selectAllMatches` (Ctrl+Maj+L) fait la même chose sans l'entrée de menu |
| NT-511 | Menu contextuel | [VSCode] Éditeur > Refactoriser / Action source | Absent | P3 | LSP |
| NT-512 | Menu contextuel | [VSCode] Éditeur > Couper / Copier / Coller | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` |
| NT-513 | Menu contextuel | [VSCode] Éditeur > Copier en tant que (JSON, Markdown, HTML) | Absent | P3 | sérialisation du texte coloré dans ClipboardItem |
| NT-514 | Menu contextuel | [VSCode] Éditeur > Formater le document / la sélection | Absent | P2 | voir Langage > Formater |
| NT-515 | Menu contextuel | [VSCode] Éditeur > Palette de commandes | Présent à vérifier | P1 | src/NotesApp.tsx `editorMenu` : 'palette' |
| NT-516 | Menu contextuel | [Obsidian] Éditeur > Ajouter un lien interne | Absent | P2 | entoure la sélection par [[ ]] et ouvre la complétion de notes |
| NT-517 | Menu contextuel | [Obsidian] Éditeur > Ajouter un lien externe | Absent | P3 | transforme la sélection en [texte](url) |
| NT-518 | Menu contextuel | [Obsidian] Éditeur > Format : gras, italique, barré, surligné, code, mathématique, commentaire, effacer la mise en forme | Partiel | P2 | 8 commandes d'encadrement Markdown (gras, italique, barré, surligné, code, formule, commentaire) Fait 2026-11-07 : gras, italique, barré, code (Format). Surligné, mathématique, commentaire et effacement de la mise en forme restent à faire. tests/markdown.test.ts + banc CDP packages/notes/tests/e2e/md.mjs (vraies touches Ctrl+B/I/K) + capture md-ribbon.png. |
| NT-519 | Menu contextuel | [Obsidian] Éditeur > Paragraphe : liste à puces, numérotée, tâches, titres 1 à 6, citation | Partiel | P2 | commandes de préfixe de ligne Fait 2026-11-07 : listes à puces, numérotée, de tâches, titres 1 à 3, citation (Édition > Markdown). Titres 4 à 6 restent à faire. tests/markdown.test.ts + banc CDP packages/notes/tests/e2e/md.mjs (vraies touches Ctrl+B/I/K) + capture md-ribbon.png. |
| NT-520 | Menu contextuel | [Obsidian] Éditeur > Insérer : encadré (callout), tableau, note de bas de page, ligne horizontale, bloc de code, modèle | Absent | P2 | insertions de gabarits Markdown |
| NT-521 | Menu contextuel | [Obsidian] Éditeur > Coller en texte brut | Absent | P2 | commande de collage qui ignore le HTML du presse-papiers (src/editor/actions.ts `pasteClipboard` colle déjà du texte brut seulement) |
| NT-522 | Menu contextuel | [Obsidian] Éditeur > Ouvrir le lien dans un nouvel onglet / volet | Partiel | P2 | src/commands.ts `openLink` ouvre dans un onglet (Ctrl+Entrée) ; pas de volet de droite |

## 15. Menus contextuels d'onglet et d'espace de travail

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-523 | Menu contextuel | [Win11] Onglet > Fermer l'onglet | Présent à vérifier | P1 | src/NotesApp.tsx `tabMenu` : 'close' |
| NT-524 | Menu contextuel | [Win11] Onglet > Fermer les autres onglets | Présent à vérifier | P1 | src/NotesApp.tsx `tabMenu` : 'others' |
| NT-525 | Menu contextuel | [Win11] Onglet > Fermer les onglets à droite | Présent à vérifier | P2 | src/NotesApp.tsx `tabMenu` : 'right' (`closeRight`) |
| NT-526 | Menu contextuel | [Win11] Onglet > Fermer les onglets à gauche | OK | P2 | calculer les ids d'indice inférieur dans src/NotesApp.tsx `tabMenu` Fait 2026-11-07 : menu de l'onglet. tests/tabs.test.ts + banc CDP packages/notes/tests/e2e/tabs.mjs (clic droit réel) + captures tabs-menu.png, tabs-after.png. |
| NT-527 | Menu contextuel | [Win11] Onglet > Ouvrir l'emplacement du fichier | Absent | P2 | entrée 'reveal' présente mais grisée (src/NotesApp.tsx `tabMenu`) ; dépend de revealInFolder |
| NT-528 | Menu contextuel | [N++] Onglet > Enregistrer / Enregistrer sous… | Présent à vérifier | P1 | src/NotesApp.tsx `tabMenu` : 'save', 'saveAs' |
| NT-529 | Menu contextuel | [N++] Onglet > Enregistrer une copie sous… | Absent | P2 | voir Fichier |
| NT-530 | Menu contextuel | [N++] Onglet > Renommer… | Absent | P2 | voir Fichier |
| NT-531 | Menu contextuel | [N++] Onglet > Déplacer à la corbeille | Absent | P3 | voir Fichier |
| NT-532 | Menu contextuel | [N++] Onglet > Recharger depuis le disque | Partiel | P2 | commande `reload` (src/commands.ts) présente dans Fichier mais pas dans le menu d'onglet |
| NT-533 | Menu contextuel | [N++] Onglet > Imprimer | Absent | P3 | ajouter 'print' à src/NotesApp.tsx `tabMenu` (imprime l'onglet actif) |
| NT-534 | Menu contextuel | [N++] Onglet > Copier le chemin | Présent à vérifier | P2 | src/NotesApp.tsx `tabMenu` : 'path' (CMD.copyPath) |
| NT-535 | Menu contextuel | [N++] Onglet > Copier le nom du fichier / le dossier | Absent | P2 | deux entrées de plus dans src/NotesApp.tsx `tabMenu` |
| NT-536 | Menu contextuel | [N++] Onglet > Déplacer vers l'autre vue / Cloner dans l'autre vue | Absent | P2 | dépend des groupes d'éditeurs |
| NT-537 | Menu contextuel | [N++] Onglet > Déplacer vers une nouvelle instance | Partiel | P2 | 'win' : ouvre le chemin dans une nouvelle fenêtre (src/NotesApp.tsx `tabMenu`, bureau, onglet avec chemin) ; l'onglet n'est pas retiré de la fenêtre source |
| NT-538 | Menu contextuel | [N++] Onglet > Ouvrir dans l'application par défaut / dans une nouvelle instance | Absent | P3 | plugin opener |
| NT-539 | Menu contextuel | [N++] Onglet > Lecture seule / retirer l'attribut | Partiel | P2 | bascule dans le menu Affichage (src/commands.ts `readOnly`) mais pas dans le menu d'onglet |
| NT-540 | Menu contextuel | [N++] Onglet > Épingler l'onglet | OK | P2 | Tab.pinned : onglet réduit à gauche, non fermé par « fermer les autres » Fait 2026-11-07 : Épingler / Désépingler (menu de l'onglet, palette), icône d'épingle, pas de bouton de fermeture, épinglés regroupés à gauche et restaurés avec la session. tests/tabs.test.ts + banc CDP packages/notes/tests/e2e/tabs.mjs (clic droit réel) + captures tabs-menu.png, tabs-after.png. |
| NT-541 | Menu contextuel | [N++] Onglet > Couleur de l'onglet (5 couleurs, retirer) | Absent | P3 | Tab.color rendu en liseré dans src/ui/TabStrip.tsx `TabStrip` |
| NT-542 | Menu contextuel | [N++] Onglet > Fermer tous les onglets non modifiés | OK | P2 | voir Fichier > Fermer plus Fait 2026-11-07 : voir NT-066. |
| NT-543 | Menu contextuel | [N++] Onglet > Tout fermer | Présent à vérifier | P2 | src/NotesApp.tsx `tabMenu` : 'all' |
| NT-544 | Menu contextuel | [WinNote] Onglet > Comparer avec l'onglet actif | Présent à vérifier | P2 | src/NotesApp.tsx `tabMenu` : 'compare' -> src/ui/Dialogs.tsx `CompareDialog` |
| NT-545 | Menu contextuel | [WinNote] Onglet > Rouvrir l'onglet fermé | Présent à vérifier | P2 | src/NotesApp.tsx `tabMenu` : 'reopen' |
| NT-546 | Menu contextuel | [VSCode] Onglet > Fermer les enregistrés | Absent | P3 | filtrer les onglets propres avec chemin |
| NT-547 | Menu contextuel | [VSCode] Onglet > Garder ouvert (sortir du mode aperçu) | Absent | P3 | dépend d'un mode « onglet d'aperçu » en italique (src/ui/TabStrip.tsx) |
| NT-548 | Menu contextuel | [VSCode] Onglet > Scinder à gauche / droite / haut / bas | Absent | P2 | groupes d'éditeurs : plusieurs EditorView pour plusieurs onglets |
| NT-549 | Menu contextuel | [VSCode] Onglet > Copier le chemin relatif au dossier ouvert | Absent | P3 | Tab.origin existe pour les fichiers du dossier (src/workspace.ts) ; ajouter l'entrée |
| NT-550 | Menu contextuel | [VSCode] Onglet > Afficher dans la barre latérale (révéler dans l'explorateur du volet) | Absent | P3 | sélectionner la ligne correspondante dans src/ui/Sidebar.tsx 'files' |
| NT-551 | Menu contextuel | [VSCode] Onglet > Partager | Absent | P3 | navigator.share |
| NT-552 | Menu contextuel | [Obsidian] Onglet > Lier avec / dissocier les onglets | Absent | P3 | synchroniser défilement et position entre deux onglets |
| NT-553 | Menu contextuel | [Obsidian] Onglet > Ajouter aux signets / épingler | Absent | P3 | épingle + liste de favoris persistants |
| NT-554 | Menu contextuel | [VSCode] Explorateur > Nouveau fichier / nouveau dossier | Absent | P1 | nécessite l'écriture dans le dossier ouvert (contrat openFolder/writeFile) ; menu contextuel dans src/ui/Sidebar.tsx |
| NT-555 | Menu contextuel | [VSCode] Explorateur > Renommer / supprimer | Absent | P1 | contrat rename/trash ; mettre à jour les liens [[ ]] au renommage |
| NT-556 | Menu contextuel | [VSCode] Explorateur > Copier le chemin / Révéler / Ouvrir dans le terminal | Absent | P2 | le volet src/ui/Sidebar.tsx 'files' n'a aucun menu contextuel |
| NT-557 | Menu contextuel | [VSCode] Explorateur > Couper / Copier / Coller des fichiers | Absent | P3 | idem, glisser-déposer d'un fichier vers un dossier |
| NT-558 | Menu contextuel | [Obsidian] Explorateur > Nouvelle note / dossier / canevas | Absent | P2 | mêmes besoins d'écriture que ci-dessus |
| NT-559 | Menu contextuel | [Obsidian] Explorateur > Ajouter aux favoris / ouvrir dans un nouvel onglet | Absent | P3 | liste de favoris persistants |
| NT-560 | Menu contextuel | [WinNote] Plan > clic = aller à la ligne | Présent à vérifier | P2 | src/ui/Sidebar.tsx 'outline' : `onGoTo` ; pas de menu contextuel (replier une section, copier le titre) |
| NT-561 | Menu contextuel | [WinNote] Liens entrants > clic = ouvrir à la ligne | Présent à vérifier | P2 | src/ui/Sidebar.tsx 'backlinks' : `onOpenFolderFile` / `onGoTo` |
| NT-562 | Menu contextuel | [N++] Marge (gutter) > clic gauche = basculer le marque-page | Présent à vérifier | P2 | src/editor/marks.ts `bookmarkExtension` : mousedown sur la marge |
| NT-563 | Menu contextuel | [N++] Barre d'état > clic sur Langage / Fins de ligne / Encodage | Présent à vérifier | P2 | src/ui/StatusLine.tsx `onPick('language')`, `onPick('eol')`, `onPick('encoding')` |

## 16. Raccourcis clavier courants (comparaison touche par touche)

> Un raccourci est « OK » si la même touche déclenche la même fonction ; « Partiel » si la fonction existe sous une autre touche ou sans touche ; « Absent » sinon. Les raccourcis sont interceptés par {app} (fenêtre) sauf ceux laissés à CodeMirror (`nativeKey`).

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-564 | Raccourci | [Win11] Ctrl+N : nouvel onglet | Présent à vérifier | P1 | src/commands.ts `new` |
| NT-565 | Raccourci | [Win11] Ctrl+O : ouvrir | Présent à vérifier | P1 | src/commands.ts `open` |
| NT-566 | Raccourci | [Win11] Ctrl+S : enregistrer | Présent à vérifier | P1 | src/commands.ts `save` |
| NT-567 | Raccourci | [Win11] Ctrl+Maj+S : enregistrer sous | Présent à vérifier | P1 | src/commands.ts `saveAs` |
| NT-568 | Raccourci | [N++] Ctrl+Alt+S : enregistrer sous (convention N++) | Partiel | P3 | Ctrl+Alt+S enregistre tout dans src/commands.ts `saveAll` ; conflit entre conventions Win11 et N++ |
| NT-569 | Raccourci | [N++] Ctrl+Maj+S : enregistrer tout (convention N++) | Partiel | P3 | fonction `saveAll` sous Ctrl+Alt+S |
| NT-570 | Raccourci | [Win11] Ctrl+W : fermer l'onglet | Présent à vérifier | P1 | src/commands.ts `close` |
| NT-571 | Raccourci | [N++] Ctrl+Maj+W : fermer tous les onglets | Partiel | P2 | fonction `closeAll` sans touche (src/commands.ts) |
| NT-572 | Raccourci | [N++] Ctrl+Maj+T : rouvrir le dernier fichier fermé | Présent à vérifier | P1 | src/commands.ts `reopenClosed` |
| NT-573 | Raccourci | [Win11] Ctrl+P : imprimer | Présent à vérifier | P1 | src/commands.ts `print` |
| NT-574 | Raccourci | [Win11] Ctrl+Z / Ctrl+Y : annuler / rétablir | Présent à vérifier | P1 | src/commands.ts `undo` `redo` (nativeKey) |
| NT-575 | Raccourci | [Win11] Ctrl+X / Ctrl+C / Ctrl+V / Suppr | Présent à vérifier | P1 | src/commands.ts `cut` `copy` `paste` `del` |
| NT-576 | Raccourci | [Win11] Ctrl+A : tout sélectionner | Présent à vérifier | P1 | src/commands.ts `selectAll` |
| NT-577 | Raccourci | [Win11] Ctrl+F : rechercher | OK | P1 | src/commands.ts `find` |
| NT-578 | Raccourci | [Win11] F3 / Maj+F3 : suivant / précédent | OK | P1 | src/commands.ts `findNext` `findPrev` |
| NT-579 | Raccourci | [Win11] Ctrl+H : remplacer | OK | P1 | src/commands.ts `replace` |
| NT-580 | Raccourci | [Win11] Ctrl+G : atteindre la ligne | Présent à vérifier | P1 | src/commands.ts `gotoLine` |
| NT-581 | Raccourci | [N++] Ctrl+Maj+F : rechercher dans les fichiers | Présent à vérifier | P2 | src/commands.ts `findInFiles` |
| NT-582 | Raccourci | [Win11] F5 : heure et date | OK | P2 | src/commands.ts `dateTime` |
| NT-583 | Raccourci | [N++] F5 : exécuter une commande | Absent | P3 | touche prise par la date ; voir menu Exécution |
| NT-584 | Raccourci | [N++] Ctrl+D : dupliquer la ligne | OK | P1 | src/commands.ts `duplicate` (intercepté avant CodeMirror, qui y mettait « occurrence suivante ») |
| NT-585 | Raccourci | [VSCode] Ctrl+D : ajouter l'occurrence suivante à la sélection | Partiel | P2 | placée sur Alt+D (src/commands.ts `selectNext`) |
| NT-586 | Raccourci | [N++] Ctrl+L : supprimer la ligne | Absent | P2 | la fonction existe sur Ctrl+Maj+K ; Alt+L = CodeMirror `selectLine` seulement |
| NT-587 | Raccourci | [VSCode] Ctrl+Maj+K : supprimer la ligne | Présent à vérifier | P1 | src/commands.ts `deleteLine` |
| NT-588 | Raccourci | [N++] Ctrl+J : joindre les lignes | OK | P2 | src/commands.ts `join` |
| NT-589 | Raccourci | [N++] Ctrl+I : fractionner les lignes | Absent | P3 | Ctrl+I est pris par CodeMirror `selectParentSyntax` (jeu par défaut) |
| NT-590 | Raccourci | [N++] Ctrl+T : transposer la ligne | Absent | P3 | pas de commande de transposition de lignes |
| NT-591 | Raccourci | [VSCode] Alt+↑ / Alt+↓ : déplacer la ligne | OK | P1 | src/commands.ts `moveUp` `moveDown` |
| NT-592 | Raccourci | [N++] Ctrl+Maj+↑ / ↓ : déplacer la ligne | Partiel | P3 | Alt+flèches à la place |
| NT-593 | Raccourci | [VSCode] Maj+Alt+↑ / ↓ : copier la ligne vers le haut / bas | Présent à vérifier | P2 | CodeMirror `copyLineUp` et CodeMirror `copyLineDown` du jeu de touches par défaut |
| NT-594 | Raccourci | [VSCode] Ctrl+Entrée : insérer une ligne dessous | Partiel | P2 | CodeMirror `insertBlankLine` (Mod-Enter, jeu par défaut) Ctrl+Entrée reste « Ouvrir le lien sous le curseur » (commande du registre) ; la ligne vide dessous est sur Ctrl+Alt+Maj+Entrée (NT-116). |
| NT-595 | Raccourci | [VSCode] Ctrl+Maj+Entrée : insérer une ligne dessus | Absent | P3 | pas de commande équivalente |
| NT-596 | Raccourci | [N++] Ctrl+Q : commenter / décommenter | Partiel | P2 | Ctrl+/ dans src/commands.ts `toggleComment` |
| NT-597 | Raccourci | [VSCode] Ctrl+/ : commenter / décommenter | OK | P1 | src/commands.ts `toggleComment` |
| NT-598 | Raccourci | [VSCode] Maj+Alt+A : commentaire de bloc | Partiel | P3 | CodeMirror `toggleBlockComment` lié à Maj+Alt+A |
| NT-599 | Raccourci | [N++] Ctrl+Maj+U / Ctrl+U : majuscules / minuscules | OK | P1 | src/commands.ts `upper` `lower` |
| NT-600 | Raccourci | [N++] Ctrl+B : accolade correspondante | Partiel | P2 | CodeMirror `cursorMatchingBracket` sur Ctrl+Maj+\ |
| NT-601 | Raccourci | [N++] Ctrl+F2 / F2 / Maj+F2 : marque-pages | OK | P1 | src/commands.ts `bookmarkToggle` `bookmarkNext` `bookmarkPrev` |
| NT-602 | Raccourci | [N++] F11 : plein écran | Présent à vérifier | P2 | src/commands.ts `zen` ; Échap en sort (src/NotesApp.tsx onKey) |
| NT-603 | Raccourci | [N++] F12 : mode post-it | Absent | P3 | voir Affichage |
| NT-604 | Raccourci | [N++] Ctrl+Tab / Ctrl+Maj+Tab : onglet suivant / précédent | Présent à vérifier | P1 | src/commands.ts `tabNext` `tabPrev` (+ Ctrl+PgSuiv / Ctrl+PgPréc) |
| NT-605 | Raccourci | [N++] Alt+1 à Alt+9 : aller à l'onglet n | Absent | P3 | raccourcis à ajouter dans src/NotesApp.tsx onKey |
| NT-606 | Raccourci | [N++] Ctrl+molette, Ctrl++ , Ctrl+- , Ctrl+0 : zoom | OK | P1 | src/commands.ts `zoomIn` `zoomOut` `zoomReset` ; src/editor/extensions.ts wheel |
| NT-607 | Raccourci | [VSCode] Ctrl+P : ouverture rapide d'un fichier | Partiel | P2 | fonction `quickOpen` sous Ctrl+E (Ctrl+P imprime comme dans le Bloc-notes) |
| NT-608 | Raccourci | [VSCode] Ctrl+Maj+P : palette de commandes | OK | P1 | src/commands.ts `palette` |
| NT-609 | Raccourci | [VSCode] Ctrl+Maj+O : aller au symbole du fichier | Partiel | P2 | Ctrl+Maj+O ouvre le volet Plan (src/commands.ts `sideOutline`), pas de liste filtrable |
| NT-610 | Raccourci | [N++] F1 : aide | Absent | P3 | pas d'aide intégrée |
| NT-611 | Raccourci | [N++] Ctrl+Espace : complétion | Absent | P1 | voir auto-complétion (autocomplete/completionKeymap) |
| NT-612 | Raccourci | [N++] Ctrl+Entrée : complétion de mots | Absent | P2 | Ctrl+Entrée sert à insérer une ligne |
| NT-613 | Raccourci | [N++] Alt+C : éditeur de colonnes | Absent | P2 | voir Édition > Éditeur de colonnes |
| NT-614 | Raccourci | [N++] Alt+glisser : sélection rectangulaire | Présent à vérifier | P1 | CodeMirror `rectangularSelection` (src/editor/extensions.ts) |
| NT-615 | Raccourci | [N++] Alt+Maj+flèches : sélection rectangulaire au clavier | Absent | P2 | conflit avec CodeMirror `copyLineUp`/Down |
| NT-616 | Raccourci | [VSCode] Ctrl+Alt+↑ / ↓ : curseur supplémentaire au-dessus / au-dessous | Présent à vérifier | P2 | CodeMirror `addCursorAbove` CodeMirror `addCursorBelow` |
| NT-617 | Raccourci | [VSCode] Alt+clic : ajouter un curseur | Partiel | P2 | Ctrl+clic ajoute un curseur ; Alt+clic lance la sélection rectangulaire |
| NT-618 | Raccourci | [VSCode] Ctrl+Maj+L : sélectionner toutes les occurrences | Présent à vérifier | P1 | src/commands.ts `selectAllMatches` |
| NT-619 | Raccourci | [VSCode] Ctrl+U : annuler le dernier curseur | Absent | P3 | Ctrl+U sert à mettre en minuscules (CodeMirror `undoSelection` non accessible) |
| NT-620 | Raccourci | [VSCode] Ctrl+Maj+[ / ] : replier / déplier | Présent à vérifier | P2 | src/editor/extensions.ts `foldKeymap` |
| NT-621 | Raccourci | [N++] Alt+0 / Alt+Maj+n : replier tout / niveau n | Partiel | P2 | Ctrl+Alt+[ et ] pour tout (src/commands.ts `foldAll` `unfoldAll`) ; pas de niveaux |
| NT-622 | Raccourci | [VSCode] Alt+Z : retour automatique à la ligne | Absent | P3 | la commande `wrap` n'a pas de raccourci |
| NT-623 | Raccourci | [VSCode] Ctrl+Backspace / Ctrl+Suppr : supprimer le mot | Présent à vérifier | P2 | CodeMirror `deleteGroupBackward` et CodeMirror `deleteGroupForward` (jeu par défaut) |
| NT-624 | Raccourci | [Win11] Ctrl+Maj+N : nouvelle fenêtre | Présent à vérifier | P2 | src/commands.ts `newWindow` |
| NT-625 | Raccourci | [WinNote] Ctrl+Entrée : ouvrir le lien ou [[note]] sous le curseur | OK | P1 | src/commands.ts `openLink` |
| NT-626 | Raccourci | [WinNote] Ctrl+Maj+E / O / B : volets Explorateur / Plan / Liens entrants | Présent à vérifier | P2 | src/commands.ts `sideFiles` `sideOutline` `sideBacklinks` |
| NT-627 | Raccourci | [WinNote] Ctrl+Maj+M : aperçu Markdown | Présent à vérifier | P2 | src/commands.ts `preview` |
| NT-628 | Raccourci | [WinNote] Ctrl+\ : vue scindée | Présent à vérifier | P2 | src/commands.ts `split` |
| NT-629 | Raccourci | [WinNote] Alt+D : ajouter l'occurrence suivante | Présent à vérifier | P2 | src/commands.ts `selectNext` |
| NT-630 | Raccourci | [N++] Insert : basculer écrasement / insertion | Absent | P3 | CodeMirror n'a pas de mode écrasement ; EditorView.inputHandler + indicateur INS/OVR de la barre d'état |
| NT-631 | Raccourci | [Win11] Échap : fermer le panneau de recherche | Présent à vérifier | P1 | CodeMirror `closeSearchPanel` (searchKeymap) |

## 17. Éditeurs modernes : VS Code (palette, groupes, différences, historique, intégrations)

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-632 | Menu | [VSCode] Palette de commandes (Ctrl+Maj+P) avec recherche floue | OK | P1 | src/commands.ts `palette` -> src/ui/Palette.tsx `Palette` (matchScore de @forgeoffice/ui), toutes les commandes, thèmes, dispositions et langues du registre |
| NT-633 | Menu | [VSCode] Palette : modes à préfixe (> commandes, @ symboles, : ligne, # recherche) | Partiel | P3 | modes séparés (Ctrl+Maj+P, Ctrl+E, Ctrl+Maj+F, sélecteurs) mais pas de préfixe dans un champ unique |
| NT-634 | Menu | [VSCode] Palette : commandes récentes en tête | Absent | P3 | liste MRU dans NotesPrefs triée avant matchScore |
| NT-635 | Menu | [VSCode] Ouverture rapide de fichiers (onglets, récents, dossier) | Présent à vérifier | P1 | src/commands.ts `quickOpen` : onglets ouverts, récents (src/NotesApp.tsx `recents`), fichiers du dossier |
| NT-636 | Menu | [VSCode] Aller au symbole du fichier (@) | Partiel | P2 | volet Plan (src/ui/Sidebar.tsx 'outline') par heuristique de préfixes ; pas de sélecteur filtrable ni de symboles Lezer |
| NT-637 | Menu | [VSCode] Aller au symbole de l'espace de travail (#) | Absent | P3 | agréger src/logic/outline.ts `outline` sur les fichiers du dossier |
| NT-638 | Affichage | [VSCode] Éditeur de différences : côte à côte et en ligne | Partiel | P1 | src/ui/Dialogs.tsx `CompareDialog` : tableau unifié ligne à ligne en lecture seule, pas de côte à côte |
| NT-639 | Affichage | [VSCode] Éditeur de différences : accepter / rétablir un bloc, édition à droite | Absent | P2 | @codemirror/merge (MergeView, unifiedMergeView) |
| NT-640 | Affichage | [VSCode] Comparer le document actif avec le fichier enregistré sur disque | Absent | P2 | relire via services.readFile et ouvrir le dialogue de comparaison |
| NT-641 | Affichage | [VSCode] Groupes d'onglets colorés et repliables (regrouper des onglets) | Absent | P3 | Tab.group et couleur, rendu en bandeau dans src/ui/TabStrip.tsx `TabStrip` |
| NT-642 | Affichage | [VSCode] Onglets épinglés | Absent | P2 | champ Tab.pinned, onglet compact à gauche, ignoré par « fermer les autres » |
| NT-643 | Affichage | [VSCode] Onglets d'aperçu (italique, remplacés au clic suivant) | Absent | P3 | mode d'ouverture des fichiers du dossier dans src/ui/Sidebar.tsx |
| NT-644 | Affichage | [VSCode] Groupes d'éditeurs (colonnes et lignes avec plusieurs documents) | Absent | P2 | plusieurs Workspace-views : chaque groupe a ses onglets ; aujourd'hui src/workspace.ts gère une vue principale et une vue secondaire du même onglet |
| NT-645 | Affichage | [VSCode] Glisser un onglet vers un autre groupe | Absent | P3 | dépend des groupes ; le glisser actuel ne réordonne qu'une barre (src/ui/TabStrip.tsx `onMove`) |
| NT-646 | Affichage | [VSCode] Mode Zen | Présent à vérifier | P2 | src/commands.ts `zen` |
| NT-647 | Affichage | [VSCode] Barre latérale / panneau bas / barre d'activités | Partiel | P3 | volet gauche à trois modes (Explorateur, Plan, Liens entrants : src/ui/Sidebar.tsx) ; pas de panneau bas |
| NT-648 | Affichage | [VSCode] Vue Plan (Outline) | Partiel | P2 | src/ui/Sidebar.tsx 'outline' : titres Markdown ou définitions de code par préfixes |
| NT-649 | Affichage | [VSCode] Aperçu Markdown sur le côté | OK | P1 | src/commands.ts `preview` -> src/ui/Preview.tsx `Preview` (DOMPurify, 150 ms de délai) |
| NT-650 | Affichage | [VSCode] Aperçu Markdown : défilement synchronisé avec l'éditeur | Absent | P2 | relier le scroll de `.cm-scroller` à l'élément `.nt-preview` par proportion ou par ligne |
| NT-651 | Affichage | [VSCode] Panneau Problèmes (erreurs et avertissements) | Absent | P3 | lintGutter + liste des diagnostics (CodeMirror `forEachDiagnostic`) |
| NT-652 | Recherche | [VSCode] Recherche par expression régulière | Présent à vérifier | P1 | case « regexp » du panneau (src/strings.ts `PHRASES`) |
| NT-653 | Recherche | [VSCode] Recherche dans les fichiers avec inclusions et exclusions de globs | Partiel | P2 | src/commands.ts `findInFiles` : notes ouvertes et dossier en mémoire, sans globs ni regex |
| NT-654 | Recherche | [VSCode] Remplacer dans les fichiers avec aperçu | Absent | P2 | liste de modifications cochables puis écriture en place (contrat de dossier) |
| NT-655 | Recherche | [VSCode] Éditeur de recherche (résultats dans un onglet) | Absent | P3 | ouvrir les résultats comme document Markdown avec liens fichier:ligne |
| NT-656 | Recherche | [VSCode] Rechercher la sélection (Ctrl+F3) / utiliser la sélection pour rechercher | Partiel | P3 | le panneau reprend la sélection à l'ouverture ; pas de commande directe |
| NT-657 | Édition | [VSCode] Étendre / réduire la sélection (Maj+Alt+→ / ←) | Partiel | P2 | CodeMirror `selectParentSyntax` sur Ctrl+I (étendre) ; pas de réduction |
| NT-658 | Édition | [VSCode] Sélectionner la ligne (Ctrl+L) | Partiel | P3 | CodeMirror `selectLine` sur Alt+L (jeu par défaut) |
| NT-659 | Édition | [VSCode] Aller à l'accolade correspondante (Ctrl+Maj+\) | Présent à vérifier | P2 | CodeMirror `cursorMatchingBracket` (jeu par défaut) |
| NT-660 | Édition | [VSCode] Basculer la casse en snake/camel/kebab | Absent | P3 | voir Convertir la casse |
| NT-661 | Édition | [VSCode] Supprimer jusqu'au début / fin de ligne | Absent | P3 | CodeMirror `deleteLineBoundaryBackward` et CodeMirror `deleteToLineEnd` à lier à des touches |
| NT-662 | Édition | [VSCode] Lignes en double : supprimer | Présent à vérifier | P2 | src/commands.ts `dedupe` |
| NT-663 | Édition | [VSCode] Trier les lignes croissant / décroissant | Présent à vérifier | P2 | src/commands.ts `sortAsc` `sortDesc` |
| NT-664 | Édition | [VSCode] Joindre les lignes (Ctrl+J) | Présent à vérifier | P2 | src/commands.ts `join` |
| NT-665 | Édition | [VSCode] Transposer deux caractères (Ctrl+T) | Absent | P3 | CodeMirror `transposeChars` à lier (existe dans @codemirror/commands) |
| NT-666 | Édition | [VSCode] Indentation selon le type de fichier, détection automatique de l'indentation | Partiel | P3 | indentation par langage ; pas de détection du style (tab/2/4) du fichier ouvert |
| NT-667 | Édition | [VSCode] Éditeur de tableaux Markdown (alignement automatique des colonnes) | Absent | P3 | commande de formatage des tables GFM |
| NT-668 | Édition | [VSCode] Surligner TODO / FIXME | Absent | P3 | MatchDecorator comme src/editor/marks.ts `linkMatcher` |
| NT-669 | Fichier | [VSCode] Enregistrement automatique (après délai, perte de focus, changement de fenêtre) | Absent | P1 | minuteur sur Tab.dirty avec chemin, appelant src/workspace.ts `save` ; réglage de mode dans NotesPrefs |
| NT-670 | Fichier | [VSCode] Hot exit : récupérer les fichiers non enregistrés | OK | P1 | src/logic/session.ts + src/workspace.ts `persist` : textes non enregistrés restaurés (jusqu'à 4 Mo/onglet) |
| NT-671 | Fichier | [VSCode] Historique local (instantanés à chaque enregistrement, restaurer une version) | Absent | P1 | voir NT-A01 : IndexedDB + src/logic/diff.ts `diffLines` |
| NT-672 | Fichier | [VSCode] Chronologie (Timeline) d'un fichier | Absent | P2 | volet listant les instantanés et le Git local |
| NT-673 | Fichier | [VSCode] Ouvrir à la ligne et colonne (fichier:ligne:colonne, --goto) | Absent | P2 | analyser le suffixe dans la prop `file` (src/NotesApp.tsx `file`) puis src/editor/actions.ts `goToLine` |
| NT-674 | Fichier | [VSCode] Dossier récent / espace de travail récent | Partiel | P3 | fichiers récents seulement (services.recentFiles) ; dossier ouvert non mémorisé |
| NT-675 | Fichier | [VSCode] Espaces de travail multi-racines | Absent | P3 | plusieurs Folder dans src/workspace.ts ; dépend d'un contrat de dossier |
| NT-676 | Thème/Réglage | [VSCode] Éditeur de paramètres (interface et JSON) | Partiel | P2 | src/ui/FileBackstage.tsx Options + src/ui/Dialogs.tsx FontDialog ; pas de recherche de paramètres ni d'export JSON |
| NT-677 | Thème/Réglage | [VSCode] Profils et synchronisation des réglages | Absent | P3 | voir NT-A05 pour une synchronisation chiffrée |
| NT-678 | Thème/Réglage | [VSCode] Aperçu du thème au survol dans le sélecteur | Absent | P3 | src/ui/Palette.tsx `Palette` : appliquer provisoirement le thème de l'entrée active |
| NT-679 | Thème/Réglage | [VSCode] Thème d'icônes de fichiers | Absent | P3 | icônes par extension dans src/ui/Sidebar.tsx (Fluent Icon par type) |
| NT-680 | Intégration | [VSCode] Terminal intégré | Absent | P3 | hors périmètre d'un Bloc-notes ; commande native optionnelle |
| NT-681 | Intégration | [VSCode] Tâches (tasks.json : lancer un build ou un script) | Absent | P3 | voir menu Exécution |
| NT-682 | Intégration | [VSCode] Gouttière de modifications Git (ajouté, modifié, supprimé) | Absent | P3 | comparer au HEAD via commande native git ; version légère : modifications depuis l'enregistrement |
| NT-683 | Intégration | [VSCode] Extensions (marketplace) | Absent | P3 | modules JavaScript sandboxés (voir Modules) |
| NT-684 | Intégration | [VSCode] Mode Vim | Absent | P3 | @replit/codemirror-vim |

## 18. Notes liées : Obsidian (liens, rétroliens, graphe, canevas, propriétés, tags, modèles)

> Le module gère des notes par onglets et un dossier lu en mémoire ; il n'y a pas de « coffre » indexé. Les liens sont analysés à la demande par {lnk} sur les onglets ouverts et les fichiers du dossier.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-685 | Édition | [Obsidian] Liens [[note]] soulignés et cliquables (Ctrl+clic) | OK | P1 | src/editor/marks.ts `linkMatcher` + `linkExtension` ; src/logic/links.ts `findWikiLinks` (parcours : Ctrl+clic sur [[Idées]] bascule l'onglet) |
| NT-686 | Édition | [Obsidian] Création de la note au clic sur un lien non résolu | Présent à vérifier | P1 | src/NotesApp.tsx `openNote` crée un onglet « # nom » marqué modifié (extension .md) |
| NT-687 | Édition | [Obsidian] Lien vers un titre [[note#titre]] : ouvrir la note et sauter au titre | OK | P1 | le titre est analysé (src/logic/links.ts `findWikiLinks` : heading) et affiché dans l'aperçu, mais src/NotesApp.tsx `openNote` l'ignore ; ajouter un goToHeading via src/logic/outline.ts `outline` Fait 2026-11-07 : le saut vers le titre fonctionne depuis l'éditeur (Ctrl+Entrée) et l'aperçu (data-heading), titre introuvable = avis ; tests/headings.test.ts + banc packages/notes/tests/e2e/headings.mjs + capture heading-jump.png. |
| NT-688 | Édition | [Obsidian] Lien avec alias [[note et alias]] | Présent à vérifier | P2 | alias reconnu et affiché dans l'aperçu (src/logic/links.ts `linkifyWikiHtml`) ; pas de rendu de l'alias dans l'éditeur |
| NT-689 | Édition | [Obsidian] Liens vers un bloc [[note#^id]] et identifiants de bloc | Absent | P3 | analyser ^id en fin de ligne, saut vers la ligne correspondante |
| NT-690 | Édition | [Obsidian] Liens avec chemin [[dossier/note]] et noms homonymes | Partiel | P3 | src/logic/links.ts `noteKey` ne garde que le nom de base ; deux notes de même nom dans deux dossiers sont confondues |
| NT-691 | Édition | [Obsidian] Liens Markdown relatifs [texte](autre.md) | Absent | P2 | src/logic/links.ts `linkAt` reconnaît la forme mais src/logic/links.ts `isSafeUrl` refuse tout sauf http(s)/mailto ; résoudre vers une note du dossier |
| NT-692 | Édition | [Obsidian] Complétion automatique à la frappe de [[ (liste de notes) | Absent | P1 | source autocompletion() alimentée par src/ui/Sidebar.tsx `noteSources` ; Absent car @codemirror/autocomplete n'est pas branché |
| NT-693 | Édition | [Obsidian] Aperçu d'une note au survol d'un lien | Absent | P3 | CodeMirror `hoverTooltip` affichant renderMarkdown (src/ui/Preview.tsx) de la note cible |
| NT-694 | Édition | [Obsidian] Liens non résolus : style distinct dans l'éditeur | Absent | P2 | décoration conditionnelle de `.cm-wikilink` si noteKey introuvable parmi src/ui/Sidebar.tsx `noteSources` |
| NT-695 | Édition | [Obsidian] Vue des liens non résolus (vérificateur de liens) | Absent | P2 | volet listant les cibles [[ ]] sans note correspondante, avec bouton « Créer » |
| NT-696 | Édition | [Obsidian] Renommer une note et mettre à jour tous les liens | Absent | P1 | renommage + réécriture des [[ancien]] dans les onglets et fichiers du dossier (contrat de dossier pour les fichiers) |
| NT-697 | Édition | [Obsidian] Déplacer un fichier avec mise à jour des liens | Absent | P3 | même mécanisme que le renommage |
| NT-698 | Affichage | [Obsidian] Rétroliens (liens entrants) avec extrait et clic | OK | P1 | src/ui/Sidebar.tsx 'backlinks' + src/logic/links.ts `backlinks` (test « rétroliens » ; capture bloc-notes-sombre.png) |
| NT-699 | Affichage | [Obsidian] Mentions non liées (texte du titre sans [[ ]]) | Absent | P2 | deuxième passe de src/logic/links.ts `backlinks` sur le titre en texte brut |
| NT-700 | Affichage | [Obsidian] Liens sortants de la note courante | Absent | P2 | volet listant src/logic/links.ts `findWikiLinks` du texte de l'onglet avec état résolu/non résolu |
| NT-701 | Affichage | [Obsidian] Graphe global des notes | Absent | P3 | SVG/canvas à forces à partir des liens (NT-A02) |
| NT-702 | Affichage | [Obsidian] Graphe local (voisinage de la note courante) | Absent | P3 | même rendu limité à la profondeur 1 ou 2 |
| NT-703 | Affichage | [Obsidian] Canevas (tableau blanc de notes reliées, format JSON Canvas) | Absent | P3 | nouveau type de document .canvas ; hors périmètre court terme |
| NT-704 | Affichage | [Obsidian] Plan du document (titres) | OK | P2 | src/ui/Sidebar.tsx 'outline' + src/logic/outline.ts `outline` (test « plan du document » ; capture bloc-notes-office.png) |
| NT-705 | Affichage | [Obsidian] Repli des titres et listes | Présent à vérifier | P2 | lang-markdown fournit les replis ; marge src/commands.ts `foldGutter` |
| NT-706 | Affichage | [Obsidian] Mode lecture plein volet (sans éditeur) | Absent | P3 | basculer `preview` en pleine largeur et masquer `.nt-editors` |
| NT-707 | Affichage | [Obsidian] Propriétés : panneau d'édition du front matter YAML | Absent | P2 | analyser le bloc --- en tête (Lezer YAML) et le montrer en formulaire ; texte brut aujourd'hui |
| NT-708 | Affichage | [Obsidian] Coloration du front matter YAML | Absent | P3 | extension d'analyse mixte Markdown + YAML (frontmatter de lang-markdown) |
| NT-709 | Édition | [Obsidian] Alias de note (propriété aliases) pour la résolution des liens | Absent | P3 | table alias -> note dans src/logic/links.ts `noteKey` |
| NT-710 | Édition | [Obsidian] Tags #tag : coloration dans l'éditeur | Absent | P2 | MatchDecorator sur les mots précédés de # (lettres, chiffres, _ et /) comme src/editor/marks.ts `linkMatcher` |
| NT-711 | Recherche | [Obsidian] Volet des tags et filtre par tag | Absent | P2 | index de tags des notes (src/ui/Sidebar.tsx `noteSources`) et clic = recherche |
| NT-712 | Recherche | [Obsidian] Recherche globale avec opérateurs (path:, tag:, file:, line:) | Partiel | P2 | src/commands.ts `findInFiles` : sous-chaîne simple sans opérateurs |
| NT-713 | Édition | [Obsidian] Modèles de notes (insérer un modèle, variables de date et de titre) | Absent | P2 | dossier « Modèles » du dossier ouvert + commande d'insertion avec substitution |
| NT-714 | Fichier | [Obsidian] Notes quotidiennes (création/ouverture de la note du jour) | Absent | P2 | commande qui ouvre AAAA-MM-JJ.md du dossier ouvert (crée à partir du modèle) |
| NT-715 | Édition | [Obsidian] Transclusion ![[note]] (incruster une note ou un titre) | Absent | P2 | widget de bloc dans l'éditeur et rendu récursif dans src/ui/Preview.tsx (garde-fou de profondeur) |
| NT-716 | Édition | [Obsidian] Incrustation d'images ![[image.png]] et ![](chemin) | Absent | P2 | résolution via le dossier ouvert (URL d'objet) dans src/ui/Preview.tsx |
| NT-717 | Édition | [Obsidian] Encadrés (callouts) > [!note] | Absent | P2 | extension du rendu src/ui/Preview.tsx `renderMarkdown` et décoration dans l'éditeur ; aujourd'hui simple citation |
| NT-718 | Édition | [Obsidian] Notes de bas de page, formules $…$, diagrammes Mermaid | Absent | P3 | plugins markdown-it/KaTeX/Mermaid chargés à la demande dans src/ui/Preview.tsx |
| NT-719 | Édition | [Obsidian] Listes de tâches - [ ] : cocher au clic | Absent | P2 | widget case à cocher dans l'éditeur (Decoration.replace) ; src/ui/Preview.tsx interdit les input |
| NT-720 | Édition | [Obsidian] Continuation automatique des listes et citations à Entrée | Présent à vérifier | P1 | lang-markdown markdownKeymap (insertNewlineContinueMarkup, addKeymap par défaut) |
| NT-721 | Édition | [Obsidian] Raccourcis de mise en forme (Ctrl+B gras, Ctrl+I italique, Ctrl+K lien) | Absent | P2 | voir Win11 > barre de mise en forme Markdown |
| NT-722 | Édition | [Obsidian] Collage d'image presse-papiers enregistrée comme pièce jointe | Absent | P2 | gestionnaire paste d'EditorView.domEventHandlers + écriture dans le dossier de notes |
| NT-723 | Fichier | [Obsidian] Coffre (vault) : dossier de notes indexé en continu | Partiel | P2 | dossier lu une fois en mémoire (src/dom-actions.ts `pickFolder`), pas de rafraîchissement ni d'écriture en place |
| NT-724 | Fichier | [Obsidian] Sélecteur rapide de notes (Ctrl+O) | Présent à vérifier | P1 | src/commands.ts `quickOpen` (Ctrl+E) |
| NT-725 | Fichier | [Obsidian] Favoris (signets de notes) | Absent | P3 | liste de chemins dans NotesPrefs affichée dans src/ui/Sidebar.tsx |
| NT-726 | Fichier | [Obsidian] Espaces de travail enregistrés (disposition nommée) | Partiel | P3 | 8 dispositions prédéfinies (src/logic/themes.ts `LAYOUTS`) mais pas d'enregistrement de la sienne |
| NT-727 | Intégration | [Obsidian] Greffons communautaires, CSS personnalisé | Absent | P3 | voir Modules ; CSS utilisateur injecté dans `.nt-root` |
| NT-728 | Intégration | [Obsidian] Publier / synchroniser un coffre | Absent | P3 | voir NT-A05 (synchronisation chiffrée) et NT-A19 (publication) |
| NT-729 | Intégration | [Obsidian] Importer des notes (Evernote, Apple Notes, Notion en Markdown) | Absent | P3 | convertisseurs en fonctions pures vers des fichiers Markdown |

## 19. Thèmes, dispositions et réglages

> 18 thèmes : Office 2024 (suit la suite) et 17 thèmes de WinNote ({thm} `THEMES`). Appliqués à toute la fenêtre (ruban, onglets, volets, dialogues) par {css} `.nt-root:not([data-nt-theme="office"])`.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-730 | Thème/Réglage | [WinNote] Thème Office 2024 (suit le thème clair/sombre/contraste de la suite) | OK | P1 | src/logic/themes.ts `OFFICE_THEME` ; src/notes.css `[data-theme="dark"] .nt-root[data-nt-theme="office"]` (capture bloc-notes-office.png) |
| NT-731 | Thème/Réglage | [WinNote] Thème Clair (Windows) | Présent à vérifier | P2 | src/logic/themes.ts `windows-light` |
| NT-732 | Thème/Réglage | [WinNote] Thème Sombre (Windows) | Présent à vérifier | P2 | src/logic/themes.ts `windows-dark` |
| NT-733 | Thème/Réglage | [WinNote] Thème Monokai | Présent à vérifier | P3 | src/logic/themes.ts `monokai` |
| NT-734 | Thème/Réglage | [WinNote] Thème Dracula | OK | P3 | src/logic/themes.ts `dracula` (capture bloc-notes-code.png) |
| NT-735 | Thème/Réglage | [WinNote] Thème Nord | Présent à vérifier | P3 | src/logic/themes.ts `nord` |
| NT-736 | Thème/Réglage | [WinNote] Thème Solarized clair | Présent à vérifier | P3 | src/logic/themes.ts `solarized-light` |
| NT-737 | Thème/Réglage | [WinNote] Thème Solarized sombre | Présent à vérifier | P3 | src/logic/themes.ts `solarized-dark` |
| NT-738 | Thème/Réglage | [WinNote] Thème Papier (sépia) | Présent à vérifier | P3 | src/logic/themes.ts `sepia` |
| NT-739 | Thème/Réglage | [WinNote] Thème Gruvbox sombre | Présent à vérifier | P3 | src/logic/themes.ts `gruvbox` |
| NT-740 | Thème/Réglage | [WinNote] Thème Nuit (contraste élevé) | Présent à vérifier | P2 | src/logic/themes.ts `high-contrast` |
| NT-741 | Thème/Réglage | [WinNote] Thème Apple Notes clair | OK | P3 | src/logic/themes.ts `apple-light` (capture bloc-notes-menus.png) |
| NT-742 | Thème/Réglage | [WinNote] Thème Apple Notes sombre | Présent à vérifier | P3 | src/logic/themes.ts `apple-dark` |
| NT-743 | Thème/Réglage | [WinNote] Thème GitHub clair | Présent à vérifier | P3 | src/logic/themes.ts `github-light` |
| NT-744 | Thème/Réglage | [WinNote] Thème Tokyo Night | OK | P3 | src/logic/themes.ts `tokyo-night` (capture bloc-notes-sombre.png) |
| NT-745 | Thème/Réglage | [WinNote] Thème One Dark | Présent à vérifier | P3 | src/logic/themes.ts `one-dark` |
| NT-746 | Thème/Réglage | [WinNote] Thème Catppuccin Mocha | Présent à vérifier | P3 | src/logic/themes.ts `catppuccin` |
| NT-747 | Thème/Réglage | [WinNote] Thème Obsidian | Présent à vérifier | P3 | src/logic/themes.ts `obsidian` |
| NT-748 | Thème/Réglage | [N++] Thèmes N++ absents : Zenburn, Twilight, Vibrant Ink, Bespin, Black Board | Absent | P3 | ajouter des objets NoteTheme dans src/logic/themes.ts `THEMES` (9 couleurs d'interface + 9 de syntaxe) |
| NT-749 | Thème/Réglage | [N++] Thèmes N++ absents : Choco, DansLeRuSH Dark, Deep Black, HotFudgeSundae, Khaki | Absent | P3 | idem |
| NT-750 | Thème/Réglage | [N++] Thèmes N++ absents : Mono Industrial, MossyLawn, Navajo, Plastic Code Wrap, Ruby Blue, Vim Dark Blue | Absent | P3 | idem |
| NT-751 | Thème/Réglage | [VSCode] Thèmes VS Code absents : Abyss, Kimbie Dark, Quiet Light, Red, Tomorrow Night Blue, Light/Dark Modern | Absent | P3 | idem (Dark+ / Light+ existent sous Clair/Sombre Windows) |
| NT-752 | Thème/Réglage | [VSCode] Importer un thème (JSON VS Code, XML N++, JSON Obsidian) | Absent | P3 | convertisseur vers NoteTheme et stockage dans services.settings |
| NT-753 | Thème/Réglage | [N++] Thème par langage ou par type de fichier | Absent | P3 | table extension -> thème dans NotesPrefs |
| NT-754 | Thème/Réglage | [WinNote] Disposition Classique (Bloc-notes) | Présent à vérifier | P2 | src/logic/themes.ts `LAYOUTS` n°0 (Consolas 11, retour auto, sans numéros) |
| NT-755 | Thème/Réglage | [WinNote] Disposition Code (Notepad++) | OK | P2 | src/logic/themes.ts `LAYOUTS` n°1 (numéros, repli, sans retour auto) |
| NT-756 | Thème/Réglage | [WinNote] Disposition Écriture | Présent à vérifier | P3 | src/logic/themes.ts `LAYOUTS` n°2 (Georgia 14, marge 56) |
| NT-757 | Thème/Réglage | [WinNote] Dispositions Notes style Apple (clair et sombre) | Présent à vérifier | P3 | src/logic/themes.ts `LAYOUTS` n°3 et 4 |
| NT-758 | Thème/Réglage | [WinNote] Disposition Obsidian (volet Plan) | OK | P3 | src/logic/themes.ts `LAYOUTS` n°5 |
| NT-759 | Thème/Réglage | [WinNote] Disposition Markdown (édition + aperçu) | Présent à vérifier | P3 | src/logic/themes.ts `LAYOUTS` n°6 (aperçu activé) |
| NT-760 | Thème/Réglage | [WinNote] Disposition Sans distraction | Présent à vérifier | P3 | src/logic/themes.ts `LAYOUTS` n°7 (marge 150) |
| NT-761 | Thème/Réglage | [WinNote] Enregistrer sa propre disposition | Absent | P3 | instantané de NotesPrefs nommé dans services.settings |
| NT-762 | Thème/Réglage | [Win11] Police par défaut Consolas, remplacements Linux/macOS | Présent à vérifier | P2 | src/logic/themes.ts `fontStack` (Cascadia Mono, DejaVu Sans Mono, Menlo) |
| NT-763 | Thème/Réglage | [WinNote] Réglage Police… : famille, taille, tabulation, marge, interligne, ligatures | Présent à vérifier | P1 | src/ui/Dialogs.tsx `FontDialog` -> src/logic/prefs.ts `NotesPrefs` |
| NT-764 | Thème/Réglage | [WinNote] Réglages persistants et vérifiés à la lecture | OK | P1 | src/logic/prefs.ts `parsePrefs` (clé notes.prefs, test « réglages : valeurs vérifiées ») |
| NT-765 | Thème/Réglage | [WinNote] Largeur des volets mémorisée (explorateur, aperçu) | Présent à vérifier | P3 | src/logic/prefs.ts `sideWidth` `previewWidth` |
| NT-766 | Thème/Réglage | [WinNote] Zoom de 10 à 500 % mémorisé | Présent à vérifier | P2 | src/logic/prefs.ts `zoom` |
| NT-767 | Thème/Réglage | [N++] Réinitialiser tous les réglages | Absent | P2 | bouton qui écrit DEFAULT_PREFS (src/logic/prefs.ts) après confirmation |
| NT-768 | Thème/Réglage | [N++] Exporter / importer les réglages | Absent | P3 | JSON téléchargeable de NotesPrefs |
| NT-769 | Thème/Réglage | [VSCode] Réglages par dossier / par espace de travail | Absent | P3 | fichier .forge-notes.json dans le dossier ouvert (contrat de dossier) |
| NT-770 | Thème/Réglage | [VSCode] Retour à la ligne à une colonne donnée, règles de colonnes | Absent | P3 | voir Affichage > colonne repère |
| NT-771 | Thème/Réglage | [WinNote] Interligne supplémentaire en pixels | Présent à vérifier | P3 | src/logic/prefs.ts `spacing` -> `--nt-spacing` (src/notes.css `.cm-scroller`) |
| NT-772 | Thème/Réglage | [WinNote] Marque de langue du correcteur (fr, en, es, de, it) | Présent à vérifier | P2 | src/logic/prefs.ts `spellLang` ; src/commands.ts `spellLang:*` |

## 20. Fichiers, session et sauvegarde

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-773 | Fichier | [Win11] Plusieurs onglets, glisser pour réordonner | Présent à vérifier | P1 | src/ui/TabStrip.tsx `TabStrip` (draggable, `onMove`) -> src/workspace.ts `move` |
| NT-774 | Fichier | [WinNote] Fermeture par clic du milieu, bouton, Ctrl+W | Présent à vérifier | P2 | src/ui/TabStrip.tsx `onAuxClick` |
| NT-775 | Fichier | [WinNote] Session restaurée : onglets et textes non enregistrés | OK | P1 | src/workspace.ts `persist` `restore`, src/logic/session.ts `keepText` (parcours : 4 onglets restaurés après rechargement ; tests session.test.ts) |
| NT-776 | Fichier | [WinNote] Session multi-fenêtres sans écrasement, reprise des fenêtres fermées | OK | P2 | src/logic/session.ts `claimSession` `touchAlive` (tests de reprise multi-fenêtres) |
| NT-777 | Fichier | [WinNote] Session : données hostiles ignorées | OK | P2 | src/logic/session.ts `parseStore` (test « données hostiles ») |
| NT-778 | Fichier | [N++] Instantané de session toutes les N secondes | Présent à vérifier | P2 | src/NotesApp.tsx intervalle de 5 s ; réglage de la durée absent |
| NT-779 | Fichier | [WinNote] Détection de modification externe du fichier (rechargement ou avertissement) | Partiel | P2 | src/workspace.ts `checkExternal` au retour de focus (bureau), empreinte src/logic/disk.ts `diskSignature` ; pas de surveillance continue ni de date de fichier |
| NT-780 | Fichier | [WinNote] Glisser-déposer de fichiers : un onglet par fichier | Présent à vérifier | P2 | src/NotesApp.tsx onDropCapture |
| NT-781 | Fichier | [WinNote] Fichiers volumineux : refus au-delà de 64 Mo | Partiel | P2 | src/logic/encoding.ts `MAX_FILE_BYTES` ; N++ ouvre des fichiers de plusieurs Go (mode dégradé à prévoir) |
| NT-782 | Fichier | [WinNote] Fichier passé en argument à l'ouverture (prop file) | Présent à vérifier | P2 | src/NotesApp.tsx `file` -> `ws.openFile` |
| NT-783 | Fichier | [WinNote] Fichiers récents partagés avec la suite (liste « notes ») | Présent à vérifier | P2 | src/workspace.ts `openFile` appelle services.addRecent |
| NT-784 | Fichier | [WinNote] Conversion d'une note Markdown en document Texte (.docx) | OK | P2 | src/dom-actions.ts `convertToDocx` -> services.openDocument (parcours : ouvre Texte) |
| NT-785 | Fichier | [N++] Exporter en PDF / HTML / RTF | Absent | P2 | PDF via @forgeoffice/pdf, HTML via renderMarkdown (src/ui/Preview.tsx), RTF par fonction pure ; Backstage > Exporter n'a que le .docx |
| NT-786 | Fichier | [N++] Enregistrer en tant qu'administrateur | Absent | P3 | élévation côté Tauri avec confirmation ; sans objet dans le navigateur |
| NT-787 | Fichier | [N++] Fichiers texte avec chemin accessible (dossier de l'onglet pour les liens relatifs) | Partiel | P3 | Tab.path conservé ; Tab.origin pour le dossier en mémoire |
| NT-788 | Fichier | [N++] Ouvrir une URL (http) comme document | Absent | P3 | fetch avec assainissement et limite de taille (SSRF : liste d'autorisations) |

## 21. Intégration système et suite ForgeOffice

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-789 | Intégration | [WinNote] Associations de fichiers (.txt, .md, .log, .json…) | Absent | P2 | fileAssociations du bundle Tauri générées depuis MODULES.notes.extensions (@forgeoffice/core) |
| NT-790 | Intégration | [WinNote] « Modifier avec le Bloc-notes ForgeOffice » dans le menu contextuel de l'explorateur | Absent | P2 | entrée de registre Windows posée par l'installeur |
| NT-791 | Intégration | [N++] Remplacer le Bloc-notes de Windows (Image File Execution Options) | Absent | P3 | option d'installation, non souhaitable par défaut |
| NT-792 | Intégration | [N++] Arguments de ligne de commande (-n12, -lpython, -multiInst, -nosession, -ro, -openSession) | Absent | P3 | analyseur d'arguments dans la coquille Tauri transmettant ligne, langage, lecture seule à la prop `file` |
| NT-793 | Intégration | [WinNote] Liste de raccourcis de la barre des tâches (fichiers récents) | Absent | P3 | Jump List Windows côté Tauri |
| NT-794 | Intégration | [WinNote] Contrat Services.fileInfo (date/taille sans relire) | Absent | P2 | décrit dans STATUS.md : `Workspace.checkExternal` comparerait mtime/size avant de relire |
| NT-795 | Intégration | [WinNote] Contrat Services.revealInFolder | Absent | P2 | décrit dans STATUS.md : passer la commande `reveal` de grisée à active |
| NT-796 | Intégration | [WinNote] Contrat WindowControls.setAlwaysOnTop | Absent | P3 | décrit dans STATUS.md : active `topmost` (src/NotesApp.tsx `canTopmost`) |
| NT-797 | Intégration | [WinNote] Contrat openFolder / listDir / writeFile pour écrire en place dans un dossier | Absent | P1 | absent de @forgeoffice/core ; débloque Explorateur complet, renommage, remplacement dans les fichiers |
| NT-798 | Intégration | [WinNote] Ouvrir un .docx/.xlsx depuis le Bloc-notes dans l'application de la suite | Partiel | P3 | src/dom-actions.ts `convertToDocx` (note vers Texte) ; l'ouverture inverse passe par la coquille |
| NT-799 | Intégration | [N++] Presse-papiers système (copier/coller avec navigator.clipboard) | Présent à vérifier | P2 | src/editor/actions.ts `copySelection` `pasteClipboard` (refus géré : src/strings.ts `clipboardDenied`) |
| NT-800 | Intégration | [Win11] Impression via la boîte du système | Présent à vérifier | P1 | src/dom-actions.ts `printText` : feuille @page, nettoyage afterprint (non essayée sur imprimante) |
| NT-801 | Intégration | [WinNote] Mise à jour automatique de l'application | Présent à vérifier | P2 | src/commands.ts `checkUpdate` (services.updater) ; installation gérée par la coquille |
| NT-802 | Intégration | [N++] Modules, macros, tâches, extraits : API d'extension | Absent | P3 | registre de commandes (src/commands.ts `buildCommands`) ouvert aux modules JavaScript sandboxés |
| NT-803 | Intégration | [WinNote] Mobile : barre de saisie (Tab, signes, flèches, annuler/rétablir) | Présent à vérifier | P2 | src/ui/MobileBar.tsx `MobileBar` (KeyboardBar au-dessus du clavier virtuel) |
| NT-804 | Intégration | [WinNote] Tactile : onglets de 44 px et bouton Commandes | Présent à vérifier | P2 | src/notes.css `@media (pointer: coarse)` + src/ui/TabStrip.tsx `onPalette` |
| NT-805 | Intégration | [WinNote] Accessibilité : rôles tab/tablist, combobox de palette, étiquettes ARIA | Présent à vérifier | P2 | src/ui/TabStrip.tsx `role="tablist"`, src/ui/Palette.tsx `role="combobox"` |

## 22. WinNote : écarts entre INVENTAIRE-WINNOTE.md et le code lu

> L'inventaire annonce 91 OK et 7 adaptés. Ces lignes confirment ou nuancent les points dont le code diffère de l'inventaire.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-806 | Édition | [WinNote] #28 Rechercher dans le dossier (inventaire : OK) | Partiel | P1 | src/commands.ts `findInFiles` : palette, sous-chaîne insensible à la casse, 300 résultats, sans regex ni remplacement |
| NT-807 | Affichage | [WinNote] #59 Vue scindée (inventaire : deux vues synchronisées du même document) | Partiel | P2 | confirmé : src/workspace.ts `secondaryState` suit toujours l'onglet actif ; deux documents différents impossibles |
| NT-808 | Affichage | [WinNote] #62 Marge de repli : par syntaxe, titres Markdown, indentation | Partiel | P2 | indentation seulement sans langage (src/editor/extensions.ts `indentFold`) ; langages hérités sans repli |
| NT-809 | Édition | [WinNote] #68 à #70 Signets : basculer, suivant/précédent, effacer | OK | P1 | src/editor/marks.ts (parcours Ctrl+F2 / F2) ; les signets ne survivent ni à la fermeture ni à la session (src/logic/session.ts `SessionTab` sans signets) |
| NT-810 | Édition | [WinNote] #98 Liens [[note#titre]] avec alias (inventaire : OK) | OK | P1 | analyse OK (src/logic/links.ts) mais le saut vers le titre n'est pas implémenté (src/NotesApp.tsx `openNote`) Fait 2026-11-07 : voir NT-687. |
| NT-811 | Fichier | [WinNote] #3 Ouvrir un dossier (explorateur) | Partiel | P2 | lecture en mémoire de 3000 fichiers max ; enregistrer un fichier du dossier passe par Enregistrer sous (STATUS.md) |
| NT-812 | Fichier | [WinNote] #12 Afficher dans l'explorateur | Absent | P2 | commande grisée, test « commandes : Afficher dans l'explorateur grisée » (src/commands.ts `reveal`) |
| NT-813 | Fichier | [WinNote] #14 Ouvrir dans le navigateur | Partiel | P3 | copie nettoyée (DOMPurify) : src/dom-actions.ts `openInBrowser` |
| NT-814 | Thème/Réglage | [WinNote] #33 à #35 Correcteur orthographique, langue, suggestions | Partiel | P2 | attribut spellcheck/lang (src/editor/extensions.ts) ; suggestions par le menu natif ; dépend du moteur web (STATUS.md : non vérifié sur Tauri) |
| NT-815 | Affichage | [WinNote] #66 Toujours au premier plan | Partiel | P3 | option masquée sans setAlwaysOnTop (src/commands.ts `topmost`) |
| NT-816 | Intégration | [WinNote] #83 Intégrer « Modifier avec WinNote » à l'explorateur | Absent | P2 | voir Intégration > associations |
| NT-817 | Intégration | [WinNote] #77 Style de fenêtre Windows/macOS | Présent à vérifier | P3 | sans objet : barre de titre commune ForgeOffice (src/NotesApp.tsx `TitleBar`) |
| NT-818 | Thème/Réglage | [WinNote] #75 17 thèmes + Office | Présent à vérifier | P2 | src/logic/themes.ts `THEMES` (voir section Thèmes) |
| NT-819 | Affichage | [WinNote] #99 Barre de menus classique (option) | OK | P2 | src/commands.ts `menus` + src/ribbon.ts `buildMenus` (capture bloc-notes-menus.png) |
| NT-820 | Édition | [WinNote] #30 Multi-curseurs : Ctrl+clic, Alt+D, Ctrl+Maj+L | Présent à vérifier | P2 | Ctrl+clic natif ; src/commands.ts `selectNext` `selectAllMatches` |
| NT-821 | Édition | [WinNote] #96 Sélection rectangulaire Alt+glisser | Présent à vérifier | P2 | CodeMirror `rectangularSelection` |
| NT-822 | Édition | [WinNote] #97 Indentation automatique | Présent à vérifier | P2 | CodeMirror `indentOnInput`, Entrée avec indentation |
| NT-823 | Menu | [WinNote] #73 Palette de commandes Ctrl+Maj+P | OK | P1 | src/commands.ts `palette` (capture bloc-notes-palette.png) |
| NT-824 | Menu | [WinNote] #74 Ouverture rapide Ctrl+E | Présent à vérifier | P2 | src/commands.ts `quickOpen` |
| NT-825 | Affichage | [WinNote] #60 Liens entrants (rétroliens) | Présent à vérifier | P1 | voir section Obsidian |
| NT-826 | Affichage | [WinNote] #65 Mode sans distraction F11 | Présent à vérifier | P2 | src/commands.ts `zen` |
| NT-827 | Affichage | [WinNote] #64 Barre d'état complète | Présent à vérifier | P1 | src/ui/StatusLine.tsx `StatusLine` ; absents par rapport à N++ : nombre de lignes total, mode INS/OVR |
| NT-828 | Affichage | [WinNote] #67 Lecture seule par onglet | Présent à vérifier | P2 | src/commands.ts `readOnly` |
| NT-829 | Dialogue | [WinNote] #80 Statistiques du document | OK | P2 | src/ui/Dialogs.tsx `StatsDialog` (test « statistiques ») ; manque : mots/lignes de la sélection séparés, dates |
| NT-830 | Dialogue | [WinNote] #86 à #88 Onglets arrondis, réordonnables, menu contextuel | Présent à vérifier | P2 | src/ui/TabStrip.tsx `TabStrip`, src/NotesApp.tsx `tabMenu` |

## AU-DELÀ D'OFFICE

> Vingt idées qui dépassent le Bloc-notes de Windows 11, Notepad++, VS Code et Obsidian. Aucune ne dépend d'un service payant.

| ID | Type | Fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| NT-A01 | Au-delà | [WinNote] Historique de versions local par fichier : instantané à chaque enregistrement et à chaque pause de frappe, restauration et diff entre versions | Absent | P1 | IndexedDB (clé = chemin + horodatage, textes compressés par CompressionStream), volet Chronologie, comparaison avec src/logic/diff.ts `diffLines`, purge par ancienneté et taille |
| NT-A02 | Au-delà | [Obsidian] Graphe de notes interactif (global et local) avec couleurs par dossier ou tag | Absent | P2 | nœuds = notes de src/ui/Sidebar.tsx `noteSources`, arêtes = src/logic/links.ts `findWikiLinks` ; SVG avec simulation de forces (d3-force chargé à la demande), clic = ouvrir, filtre par texte |
| NT-A03 | Au-delà | [VSCode] Exécution de blocs de code du Markdown (js, python, sql, sh) avec sortie sous le bloc | Absent | P2 | JavaScript dans un Worker sandboxé, Python via Pyodide, SQL via SQLite WASM, shell via services.native avec liste blanche ; bouton Exécuter en marge du bloc |
| NT-A04 | Au-delà | [Win11] IA locale (réécrire, résumer, corriger, traduire) sans service payant | Absent | P2 | modèle local (Ollama ou WebLLM) appelé par services.native, résultat présenté en diff acceptable par bloc ; désactivée par défaut |
| NT-A05 | Au-delà | [Obsidian] Synchronisation chiffrée de bout en bout du dossier de notes (VPS, Forgejo ou WebDAV) | Absent | P1 | chiffrement AES-GCM / XChaCha20 dérivé d'une phrase (PBKDF2/Argon2), fichiers chiffrés individuellement, fusion par diff à trois voies ; clés jamais envoyées |
| NT-A06 | Au-delà | [Obsidian] Recherche plein texte indexée avec classement, fautes de frappe et filtres (tag, dossier, date) | Absent | P2 | index MiniSearch ou FlexSearch reconstruit en tâche de fond depuis src/ui/Sidebar.tsx `noteSources`, stocké en IndexedDB ; remplace la palette src/commands.ts `findInFiles` |
| NT-A07 | Au-delà | [WinNote] Calculs en ligne dans la note (« 12*3,5 », sommes, conversions) évalués avec le moteur de formules de la suite | Absent | P2 | décoration de fin de ligne affichant le résultat ; moteur @forgeoffice/formulas appelé sur les lignes se terminant par « = » |
| NT-A08 | Au-delà | [WinNote] Transclusion entre applications : ![[budget.xlsx#A1:C5]] et ![[rapport.docx#Chapitre 2]] | Absent | P2 | widgets de bloc qui lisent la plage via @forgeoffice/xlsx et le titre via @forgeoffice/docx, rendus en tableau ou paragraphes dans l'éditeur et l'aperçu |
| NT-A09 | Au-delà | [Obsidian] Vues « base » sur les propriétés YAML et les tags (tableau, liste, cartes, calendrier) | Absent | P2 | analyse du front matter de chaque note, requête saisie en YAML, rendu via les composants de @forgeoffice/ui ; liaison possible avec le module Base de données |
| NT-A10 | Au-delà | [VSCode] Édition collaborative en temps réel avec curseurs de présence | Absent | P3 | Yjs + y-codemirror.next, transport WebSocket vers le VPS (salle chiffrée par lien secret) ; historique src/logic/session.ts conservé localement |
| NT-A11 | Au-delà | [N++] Pipelines de transformation de texte chaînables et nommés (trier, dédoublonner, regex, casse, colonnes) | Absent | P2 | liste d'étapes JSON exécutée par src/editor/actions.ts `transformLines` ; enregistrée dans services.settings et ajoutée à la palette ; remplace macros et TextFX |
| NT-A12 | Au-delà | [WinNote] Résolution de conflits à trois voies lors d'une modification externe | Absent | P2 | conserver la version de base (src/logic/disk.ts `diskSignature` -> texte), diff3 entre base, disque et onglet, choix par bloc ; remplace l'avertissement de src/workspace.ts `checkExternal` |
| NT-A13 | Au-delà | [Win11] Correcteur orthographique et grammatical local avec dictionnaire personnel synchronisé | Absent | P2 | Hunspell compilé en WASM (nspell) et LanguageTool local en option ; soulignements CodeMirror `lint` ; dictionnaire dans services.settings |
| NT-A14 | Au-delà | [Win11] Dictée vocale et OCR d'image collée, traitement local | Absent | P3 | Web Speech API ou whisper.cpp WASM ; Tesseract.js pour une image du presse-papiers ; texte inséré au curseur |
| NT-A15 | Au-delà | [Win11] Lecture à voix haute avec surlignage de la phrase courante | Absent | P3 | speechSynthesis du navigateur, décoration mobile suivant l'événement boundary |
| NT-A16 | Au-delà | [WinNote] Détection de secrets et coffre chiffré dans la note | Absent | P2 | regex (clés API, jetons, mots de passe) avertissant à l'enregistrement ; blocs « secret » chiffrés AES-GCM déverrouillés par phrase ; aligné avec la politique de sécurité de la suite |
| NT-A17 | Au-delà | [Obsidian] Visionneuse CSV, TSV et JSON en grille ou arbre éditable synchronisée avec le texte | Absent | P3 | détection par langage, grille tri/filtre par colonne (réutiliser les composants du Tableur), modifications répercutées par transaction CodeMirror |
| NT-A18 | Au-delà | [WinNote] Pont avec la suite : note vers Texte (.docx), Présentation (plan en diapositives), Tableur (tableau Markdown) | Partiel | P2 | seule la conversion en .docx existe (src/dom-actions.ts `convertToDocx`) ; ajouter plan -> pptx via @forgeoffice/pptx et tableaux -> xlsx via @forgeoffice/xlsx |
| NT-A19 | Au-delà | [Obsidian] Publication par lots : dossier de notes vers site statique, PDF ou EPUB | Absent | P3 | générateur utilisant renderMarkdown (src/ui/Preview.tsx) pour chaque note, table des liens [[ ]] résolus en liens relatifs, export via @forgeoffice/pdf et @forgeoffice/publisher |
| NT-A20 | Au-delà | [WinNote] Barre de saisie tactile (Tab, signes de code, flèches, annuler/rétablir) | Présent à vérifier | P2 | src/ui/MobileBar.tsx `MobileBar` (KeyboardBar) : absente des Bloc-notes de Windows 11, Notepad++ et Obsidian mobile comparables |

