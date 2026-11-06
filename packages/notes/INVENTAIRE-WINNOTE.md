# Inventaire WinNote → Bloc-notes ForgeOffice

Source : `D:\Projet\WinNote` v0.6.0 (README, ROADMAP, `src/ids.rs` palette + menus, `menu.rs`, `cmds.rs`, `textops.rs`, `findbar.rs`,
`palette.rs`, `sidebar.rs`, `notes.rs`, `session.rs`, `theme.rs`, `lang.rs`, `spell.rs`, `print.rs`, `mdpreview.rs`, `settings.rs`, `main.rs`).

Légende : **OK** livré · **ADAPTÉ** livré autrement (raison donnée) · **NON** pas livré (raison + reste à faire).

## Fichier

| # | Fonction WinNote | Raccourci | État | Équivalent livré |
|---|---|---|---|---|
| 1 | Nouvel onglet | Ctrl+N / Ctrl+T | OK | `new`, Ctrl+N, bouton « + » des onglets, Backstage > Nouveau |
| 2 | Ouvrir… | Ctrl+O | OK | `services.openFile` (filtre texte et code ; « Tous les fichiers » sur bureau) |
| 3 | Ouvrir un dossier… | | OK | Sélecteur de dossier ; fichiers texte lus en mémoire (3000 fichiers, 2 Mo/fichier, 64 Mo au total, `.git`/`node_modules`… ignorés) |
| 4 | Fichiers récents (15) | | OK | Menu Fichier > Fichiers récents, Backstage > Ouvrir, Ctrl+E (via `services.recentFiles`) |
| 5 | Effacer la liste des récents | | OK | Fichier > Fichiers récents > « Effacer la liste des fichiers récents », bouton dans Backstage > Ouvrir, palette (`services.clearRecent`, liste commune à la suite) |
| 6 | Rouvrir l'onglet fermé | Ctrl+Maj+T | OK | Pile des 30 derniers onglets fermés (texte compris) |
| 7 | Enregistrer | Ctrl+S | OK | `services.saveFile` avec l'encodage et les fins de ligne de l'onglet |
| 8 | Enregistrer sous… | Ctrl+Maj+S | OK | + choix encodage / fins de ligne dans Backstage > Enregistrer sous |
| 9 | Tout enregistrer | Ctrl+Alt+S | OK | |
| 10 | Imprimer… | Ctrl+P | OK | Texte seul, noir sur blanc, en-tête = nom du fichier, pied « Page n / N » (`@page`), `services.print` |
| 11 | Recharger depuis le disque | | OK | Bureau (`services.readFile`) ; masqué dans le navigateur |
| 12 | Afficher dans l'explorateur | | NON | Commande présente (menu Fichier, ruban Outils, menu de l'onglet) mais grisée, info-bulle « Bientôt disponible » : aucun service « révéler » dans `@forgeoffice/core` (API à ajouter : STATUS.md) |
| 13 | Copier le chemin | | OK | |
| 14 | Ouvrir dans le navigateur | | ADAPTÉ | Copie nettoyée (DOMPurify, sans script) : HTML, Markdown rendu, texte |
| 15 | Fermer l'onglet | Ctrl+W | OK | Demande « Enregistrer / Ne pas enregistrer / Annuler » si modifié |
| 16 | Fermer les autres onglets | | OK | + « Fermer les onglets à droite » |
| 17 | Fermer tous les onglets | | OK | |
| 18 | Quitter | | OK | `services.close` (la session garde les textes non enregistrés) |
| 19 | Ouvrir dans une nouvelle fenêtre | | OK | Menu de l'onglet (bureau) + « Nouvelle fenêtre » Ctrl+Maj+N (`services.openModule`) |

## Édition

| # | Fonction WinNote | Raccourci | État | Équivalent livré |
|---|---|---|---|---|
| 20 | Annuler / Rétablir | Ctrl+Z / Ctrl+Y | OK | Historique par onglet (aussi depuis la vue scindée) |
| 21 | Couper / Copier / Coller / Supprimer | | OK | |
| 22 | Tout sélectionner | Ctrl+A | OK | |
| 23 | Rechercher | Ctrl+F | OK | Barre intégrée en haut de l'éditeur, en français |
| 24 | Suivant / Précédent | F3 / Maj+F3 | OK | |
| 25 | Remplacer, remplacer tout | Ctrl+H | OK | |
| 26 | Regex, mot entier, casse | | OK | Cases de la barre de recherche |
| 27 | Surlignage de toutes les occurrences | | OK | + surlignage des occurrences de la sélection |
| 28 | Rechercher dans le dossier | Ctrl+Maj+F | OK | Notes ouvertes + dossier ouvert, 300 résultats, clic = aller à la ligne |
| 29 | Aller à la ligne… | Ctrl+G | OK | Accepte aussi `ligne:colonne` |
| 30 | Ajouter l'occurrence suivante (multi-curseurs) | Alt+D | OK | + Ctrl+Maj+L toutes les occurrences |
| 31 | Ouvrir le lien / [[note]] sous le curseur | Ctrl+Entrée | OK | + Ctrl+clic ; note absente = créée ; seules http(s)/mailto sont ouvertes |
| 32 | Heure et date | F5 | OK | Format du Bloc-notes : `HH:MM JJ/MM/AAAA` |
| 33 | Correcteur orthographique | | OK | Attribut `spellcheck` du webview |
| 34 | Langue du correcteur (fr, en, es, de, it) | | OK | Attribut `lang` (le moteur web choisit ses dictionnaires installés) |
| 35 | Suggestions, Ajouter au dictionnaire, Ignorer | | ADAPTÉ | Menu contextuel natif du moteur web quand le correcteur est actif (sinon menu ForgeOffice ; Maj+clic droit = natif) |

## Lignes et texte

| # | Fonction WinNote | Raccourci | État | Équivalent livré |
|---|---|---|---|---|
| 36 | Déplacer la ligne haut / bas | Alt+↑ / Alt+↓ | OK | |
| 37 | Dupliquer | Ctrl+D | OK | |
| 38 | Supprimer la ligne | Ctrl+Maj+K | OK | |
| 39 | Joindre | Ctrl+J | OK | |
| 40 | Trier A → Z | | OK | Tri français, naturel (« ligne 2 » avant « ligne 10 ») |
| 41 | Trier Z → A | | OK | |
| 42 | Supprimer les doublons | | OK | |
| 43 | Supprimer les espaces en fin de ligne | | OK | |
| 44 | Commenter / décommenter | Ctrl+/ | OK | Jetons de commentaire de chaque langage |
| 45 | MAJUSCULES | Ctrl+Maj+U | OK | |
| 46 | minuscules | Ctrl+U | OK | |
| 47 | Première Lettre En Majuscule | | OK | |
| 48 | Tabulations → espaces | | OK | Respecte les taquets |
| 49 | Espaces → tabulations | | OK | |
| 50 | Augmenter / diminuer le retrait | Tab / Maj+Tab | OK | + Ctrl+] / Ctrl+[ |

## Format et affichage

| # | Fonction WinNote | Raccourci | État | Équivalent livré |
|---|---|---|---|---|
| 51 | Retour automatique à la ligne | | OK | |
| 52 | Police… | | OK | Police, taille, largeur de tabulation, marge, interligne (+ police et taille dans le ruban) |
| 53 | Rendu DirectWrite | | ADAPTÉ | Le moteur web fait le rendu du texte ; reste le réglage utile : « Ligatures de la police » (Police…, Affichage, palette) |
| 54 | Fins de ligne CRLF / CR / LF | | OK | Détectées, affichées dans la barre d'état, convertibles (clic ou menu Format) |
| 55 | Zoom avant / arrière / défaut | Ctrl++ / Ctrl+- / Ctrl+0 | OK | + Ctrl+molette, curseur de zoom de la barre d'état (10-500 %) |
| 56 | Explorateur de fichiers | Ctrl+Maj+E | OK | Arborescence repliable du dossier ouvert |
| 57 | Plan du document | Ctrl+Maj+O | OK | Titres Markdown ou symboles du code ; clic = aller à la ligne |
| 58 | Aperçu Markdown | Ctrl+Maj+M | OK | En direct, nettoyé par DOMPurify, liens [[ ]] cliquables, volet redimensionnable |
| 59 | Vue scindée | Ctrl+\ | OK | Deux vues synchronisées du même document |
| 60 | Liens entrants (backlinks) | | OK | Volet : onglets ouverts + dossier, ligne et extrait, clic = ouvrir à la ligne (Ctrl+Maj+B) |
| 61 | Numéros de ligne | | OK | |
| 62 | Marge de repli | | OK | Repli par syntaxe, par titres Markdown, par indentation en texte brut |
| 63 | Espaces et tabulations visibles | | OK | + espaces de fin surlignés |
| 64 | Barre d'état | | OK | Ln/Col, sélection, caractères, lecture seule, langage, fins de ligne, encodage, zoom |
| 65 | Mode sans distraction | F11 | OK | Plein écran, chrome masqué, texte centré ; Échap ou F11 pour sortir |
| 66 | Toujours au premier plan | | ADAPTÉ | Option affichée seulement si `windowControls.setAlwaysOnTop` existe (absent du contrat actuel : option masquée) |
| 67 | Lecture seule | | OK | Par onglet ; fichiers binaires ouverts en lecture seule |
| 68 | Signet : basculer | Ctrl+F2 | OK | Marge des signets cliquable + ligne surlignée |
| 69 | Signet suivant / précédent | F2 / Maj+F2 | OK | En boucle |
| 70 | Effacer les signets | | OK | |
| 71 | Tout replier / tout déplier | | OK | Ctrl+Alt+[ / Ctrl+Alt+] |
| 72 | Onglet suivant / précédent | Ctrl+Tab / Ctrl+Maj+Tab | OK | + Ctrl+PgSuiv / Ctrl+PgPréc |
| 73 | Palette de commandes | Ctrl+Maj+P | OK | Toutes les commandes, thèmes, dispositions, langues |
| 74 | Ouverture rapide (onglets, récents, dossier) | Ctrl+E | OK | |
| 75 | 17 thèmes | | OK | Mêmes couleurs que `theme.rs`, appliqués à toute la fenêtre (ruban, onglets, volets, menus) + thème Office 2024 par défaut |
| 76 | 8 dispositions | | OK | Mêmes réglages que `LAYOUTS` (police, marge, interligne, thème, volet, aperçu, repli) |
| 77 | Style de fenêtre Windows / macOS | | NON | Sans objet : barre de titre commune ForgeOffice |
| 78 | 45 langages colorés | | OK | 150+ : tout `@codemirror/language-data` + Batch, Makefile, Nim, Zig, Solidity, GLSL/HLSL, GDScript, INI ; Markdown colore aussi ses blocs de code |
| 79 | Encodages UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE / ANSI | | OK | Détectés à l'ouverture, choisis à l'enregistrement, alerte si l'ANSI perd des caractères |

## Menu « ? » et système

| # | Fonction WinNote | État | Équivalent livré |
|---|---|---|---|
| 80 | Statistiques du document | OK | Lignes, mots, caractères (avec/sans espaces), paragraphes, octets dans l'encodage courant, temps de lecture, sélection |
| 81 | Rechercher une mise à jour | OK | `services.updater.check()` (bureau) |
| 82 | Mises à jour automatiques on/off | ADAPTÉ | Gérées par la coquille ForgeOffice (Accueil > Options) |
| 83 | Intégrer / retirer « Modifier avec WinNote » de l'explorateur | NON | Associations de fichiers de la coquille Tauri (hors périmètre du module) |
| 84 | À propos | OK | |
| 85 | Autotest `--selftest` | ADAPTÉ | 19 tests `node:test` de la logique + vérification visuelle et parcours réels dans le navigateur |

## Interface et comportements

| # | Fonction WinNote | État | Équivalent livré |
|---|---|---|---|
| 86 | Onglets arrondis | OK | Liseré d'accent sur l'onglet actif, point « modifié », cadenas lecture seule |
| 87 | Réordonner les onglets par glisser | OK | |
| 88 | Menu contextuel d'onglet | OK | Fermer, autres, à droite, tous, enregistrer, enregistrer sous, copier le chemin, comparer, rouvrir, nouvelle fenêtre |
| 89 | Clic du milieu = fermer | OK | |
| 90 | Menu contextuel de l'éditeur | OK | |
| 91 | Session restaurée (textes non enregistrés compris) | OK | `services.settings`, une entrée par fenêtre (plusieurs fenêtres sans écrasement), fenêtres fermées ou plantées reprises |
| 92 | Sauvegarde de session toutes les 30 s | OK | Toutes les 5 s si changement + à la fermeture |
| 93 | Détection de modification externe du fichier | ADAPTÉ | Bureau : au retour dans la fenêtre, le fichier de l'onglet actif est relu et son empreinte comparée ; onglet propre = rechargé, onglet modifié = avertissement (jamais écrasé). Sans date de fichier dans le contrat (API : STATUS.md) |
| 94 | Glisser-déposer de fichiers | OK | Chaque fichier ouvre un onglet |
| 95 | Multi-curseurs | OK | Ctrl+clic, Alt+D, Ctrl+Maj+L |
| 96 | Sélection rectangulaire | OK | Alt+glisser |
| 97 | Indentation automatique | OK | |
| 98 | Liens [[note]] (Obsidian) avec #titre et \|alias | OK | Soulignés, Ctrl+clic, création de la note si elle n'existe pas |
| 99 | Barre de menus classique | OK | Option « Menus classiques » (Fichier, Édition, Lignes, Format, Affichage, Thème, Disposition, ?) à la place du ruban |
| 100 | Fichier passé en ligne de commande | OK | Prop `file` du module |
| 101 | Clic sur la barre d'état (encodage, fins de ligne, langage) | OK | Sélecteurs filtrables |

## Couverture

- **101 fonctions inventoriées** : **91 OK**, **7 ADAPTÉ**, **3 NON** (#12 attend le contrat ; #77 style de fenêtre et #83 associations de fichiers sans objet dans le module).
- Couverture fonctionnelle : **98 / 101** (OK + ADAPTÉ).
- À reprendre si le contrat s'enrichit (détail et signatures dans `STATUS.md`) : révéler dans l'explorateur (#12), date de fichier pour #93 (relecture évitée), `setAlwaysOnTop` pour #66.

## En plus de WinNote

Ruban Office 2024 (Accueil, Édition, Affichage, Outils) + Backstage Fichier + recherche de commandes Alt+Q ; conversion d'une note Markdown en document Texte (.docx, via `@forgeoffice/docx` puis `services.openDocument`) ;
comparaison de deux onglets (diff ligne à ligne) ; « Inverser l'ordre » des lignes ; casse « phrase » et « inversée » ; sélection de toutes les occurrences ;
statistiques étendues ; « Fermer les onglets à droite » ; 150+ langages ; session multi-fenêtres.
