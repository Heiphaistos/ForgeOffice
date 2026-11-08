# Parité de l'application Texte (ForgeOffice) avec Microsoft Word 2024 / 365 (interface française)

> Audit réalisé le 2026-11-05 sans modifier aucun code. Dépôt `D:\Projet\ForgeOffice`, paquets `packages/word` (+ `packages/ui` pour le ruban, les menus, le Backstage, la barre d'état).
> Plan d'implémentation associé : [`WORD-priorites.md`](WORD-priorites.md).

## 0. Méthode, légende, limites

**Vérité-terrain de Word.** Le vrai Word 365 (build 16.0.20527.20112, interface française) installé sur ce PC a été piloté sans toucher à la souris ni au clavier réels : lancement par COM (`Word.Application`), fenêtre hors écran (`Left/Top = -32000`), lecture de l'arbre **UI Automation** (`System.Windows.Automation`, PowerShell), sélection des onglets par `SelectionItemPattern`, ouverture des menus par `ExpandCollapsePattern`, fermeture par `Quit()` dans un `finally` (aucun `WINWORD` ni `EXCEL` restant : vérifié). Objets de test créés par COM (tableau, image, forme, zone de texte, SmartArt, graphique, équation, en-tête) pour lire les **onglets contextuels**. Les menus contextuels du clic droit viennent de `Application.CommandBars` (80 menus contextuels, entrées complètes avec sous-menus). Les noms, KeyTips (Alt…) et raccourcis (colonne « Accélérateur ») sont ceux de Word, copiés tels quels.

**Statuts (colonne « Statut »).**

| Statut | Sens |
|---|---|
| **OK** | code présent ET effet prouvé : test automatisé (`packages/word/tests`, cité) ou capture/parcours cité dans `packages/word/STATUS.md` |
| **À vérifier** | code présent (fonction branchée dans le ruban/menu/raccourci), mais effet NON prouvé : à confronter à l'outil de conformité automatique en construction |
| **Partiel** | présent mais écart fonctionnel connu avec Word (la note dit lequel) ; un écart prime sur « à vérifier » |
| **Absent** | aucun code, ou chaîne de `strings.ts` jamais câblée |
| Extra | fonction ForgeOffice qui n'existe pas dans Word (non comptée dans les taux) |

**Priorités.** P1 = usage quotidien, à faire d'abord ; P2 = courant ; P3 = rare ou hors périmètre.

**Limites et réserves.**
- Les boîtes de dialogue, la mini-barre et les vrais menus contextuels exigent des clics réels : leur CONTENU vient de ma connaissance de Word (marqué « source : connaissance »), les entrées de menus contextuels sont vérifiées par COM. L'onglet *Dessin* et *Développeur* sont masqués sur ce Word : contenu par connaissance.
- Les galeries dont le menu n'a pu être ouvert (rares) n'ont pas de colonne « Contenu ».
- **Le code bouge pendant l'audit** : une autre session ajoutait la mini-barre (`ui/miniBar.ts`, `MiniToolbar`), le curseur personnalisable (`CaretOverlay.tsx`), `ImageOverlay.tsx` (déplacer/redimensionner/pivoter les images), `tests/context-menu.test.ts`, `images.test.ts`, `sections.test.ts`… Les statuts correspondent au code lu le 2026-11-05 (modifications jusqu'à 01:01 ce jour-là).
- « Prouvé » ne signifie pas « le bouton du ruban fonctionne » : les tests couvrent le modèle et les commandes ProseMirror, pas le câblage clic -> commande. C'est exactement le rôle de l'outil de conformité en cours de construction.



## Synthèse chiffrée

| Domaine | Entrées | OK | À vérifier | Partiel | Absent | OK / À vérifier / Partiel / Absent |
|---|---|---|---|---|---|---|
| Ruban (onglets standard) | 208 | 15 | 57 | 62 | 74 | 7 % / 27 % / 30 % / 36 % |
| Ruban (onglets contextuels) | 229 | 1 | 10 | 26 | 192 | 0 % / 4 % / 11 % / 84 % |
| Menus contextuels | 94 | 0 | 30 | 21 | 43 | 0 % / 32 % / 22 % / 46 % |
| Mini-barre | 21 | 0 | 18 | 0 | 3 | 0 % / 86 % / 0 % / 14 % |
| Boîtes de dialogue | 45 | 0 | 3 | 25 | 17 | 0 % / 7 % / 56 % / 38 % |
| Raccourcis clavier | 82 | 1 | 47 | 8 | 26 | 1 % / 57 % / 10 % / 32 % |
| Volets de tâches | 14 | 0 | 2 | 4 | 8 | 0 % / 14 % / 29 % / 57 % |
| Backstage | 14 | 2 | 1 | 8 | 3 | 14 % / 7 % / 57 % / 21 % |
| Barre d'état et affichages | 20 | 2 | 8 | 5 | 5 | 10 % / 40 % / 25 % / 25 % |
| Fonctions invisibles | 28 | 2 | 3 | 6 | 17 | 7 % / 11 % / 21 % / 61 % |
| **TOTAL** | 755 | 23 | 179 | 165 | 388 | 3 % / 24 % / 22 % / 51 % |

Entrées par onglet du ruban (vrai Word) : Accueil 42 ; Insertion 29 ; Conception 10 ; Mise en page 21 ; Références 20 ; Publipostage 20 ; Révision 19 ; Affichage 27 ; Aide 5 ; Création de tableau 15 ; Disposition du tableau 32 ; Format de l'image 30 ; Format de forme 31 ; Conception de SmartArt 14 ; Mise en forme (SmartArt) 17 ; En-tête et pied de page 20 ; Equation 19 ; Création de graphique 8 ; Mise en forme (graphique) 42.

Note : « À vérifier » = code présent dont l'effet n'est pas prouvé ; le taux de fonctions réellement complètes et prouvées est donc la colonne OK seule.


## 1. Ruban

Onglets de l'interface française de Word 365 (relevés par UI Automation) : **Fichier** (Backstage : voir section 7), Accueil, Insertion, [Dessin], Conception, Mise en page, Références, Publipostage, Révision, Affichage, Aide, plus les onglets contextuels. ForgeOffice a : Accueil, Insertion, Dessin, Conception, Mise en page, Références, Publipostage, Révision, Affichage + contextuels Création de tableau, Disposition, Format de l'image, Mode Plan ; **pas d'onglet Aide**, pas d'onglet Développeur, pas d'onglets Forme, SmartArt, En-tête/pied de page, Équation, Graphique.

### Onglet Accueil  ·  KeyTip Alt L

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Presse-papiers | Coller | bouton + menu | Alt L V / Ctrl+V | Partiel | P1 | Conserver uniquement le texte ; Collage spécial... ; Définir le collage par défaut... | ribbon/home.ts : conserver la mise en forme, texte seul, collage spécial ; manque « Fusionner la mise en forme », « Image », défaut de collage |
| Presse-papiers | Couper | bouton | Alt L X / Ctrl+X | À vérifier | P1 |  | home.ts act.cut |
| Presse-papiers | Copier | bouton | Alt L C / Ctrl+C | À vérifier | P1 |  | home.ts act.copy |
| Presse-papiers | Reproduire la mise en forme | bouton (bascule) | Alt L W R / Alt+Ctrl+C, Alt+Ctrl+V | Partiel | P1 |  | home.ts : un seul clic ; le double-clic (mode persistant, paramètre sticky) n'est pas câblé au ruban |
| Presse-papiers | Presse-papiers Office... | bouton | Alt L F R | Absent | P3 |  | aucun volet Presse-papiers multi-éléments |
| Police | Police | liste déroulante | Alt L W P | À vérifier | P1 |  | home.ts FontPicker (Ctrl+Maj+F annoncé, raccourci non lié) |
| Police | Taille de police | liste déroulante | Alt L G T | À vérifier | P1 |  | home.ts ComboBox tailles Word |
| Police | Agrandir la police | bouton | Alt L R A / Ctrl+Maj+> | À vérifier | P1 |  | home.ts + raccourcis Ctrl+], Ctrl+> |
| Police | Réduire la police | bouton | Alt L R É / Ctrl+< | À vérifier | P1 |  | home.ts |
| Police | Modifier la casse | menu / galerie | Alt L 7 | OK | P2 | Majuscule en début de phrase ; minuscules ; CAPITALES ; 1re Lettre Des Mots En Majuscule ; iNVERSER lA cASSE | home.ts 5 modes identiques à Word ; test features « commandes : casse » |
| Police | Effacer la mise en forme | bouton | Alt L M F | À vérifier | P1 |  | home.ts clearRunFormatting + style Normal |
| Police | Gras | bouton (bascule) | Alt L 1 / Ctrl+G | OK | P1 |  | test features « commandes : gras » ; Ctrl+G et Ctrl+B |
| Police | Italique | bouton (bascule) | Alt L 2 / Ctrl+I | À vérifier | P1 |  | home.ts toggle rp_italic |
| Police | Souligner | bouton + menu (bascule) | Alt L 3 | Partiel | P1 | Souligné ; Double souligné ; Soulignement épais ; Soulignement en pointillés ; Souligné en pointillé ; Souligné point-tiret ; Souligné point-point-tiret ; souligné ondulé ; Non souligné ; Autres soulignements... ; Couleur de soulignement | 4 styles sur 17 (simple, double, pointillé, ondulé) ; pas de couleur de soulignement |
| Police | Barré | bouton (bascule) | Alt L 4 1 | À vérifier | P1 |  | home.ts |
| Police | Indice | bouton (bascule) | Alt L 5 / Ctrl+Maj+ | À vérifier | P1 |  | home.ts + Ctrl+= |
| Police | Exposant | bouton (bascule) | Alt L 6 / Ctrl+Maj++ | À vérifier | P1 |  | home.ts + Ctrl+Maj++ |
| Police | Effets de texte et typographie | menu / galerie | Alt L E | Partiel | P3 | Remplissage : Noir, Couleur de texte 1 ; Ombre ; Remplissage : Bleu-vert foncé, Couleur d’accentuation 1 ; Ombre ; Remplissage : Orange, Couleur d’accentuation 2 ; Contour : Orange, Couleur d’accentuation 2 ; Remplissage : Blanc ; Contour : Prune, Couleur d’accentuation 5 ; Ombre ; Remplissage : Turquoise, Couleur d’accentuation 4 ; Biseau souple ; Remplissage dégradé, Gris ; Remplissage dégradé : Prune, Couleur d’accentuation 5 ; Réflexion ; Remplissage dégradé : Turquoise, Couleur d’accentuation 4 ; Contour : Turquoise, Couleur d’accentuation 4 ; Remplissage : Blanc ; Contour : Bleu-vert foncé, Couleur d’accentuation 1 ; Lumière : Bleu-vert foncé, Couleur d’accentuation 1 ; Remplissage : Vert foncé, Couleur d’accentuation 3 ; Biseau net ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Blanc, Couleur d’arrière-plan 1 ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Prune, Couleur d’accentuation 5 … (+10) | menu simple : ombre, contour, petites maj., maj., masqué ; pas de galerie WordArt, réflexion, lueur, ligatures, jeux stylistiques |
| Police | Couleur de surlignage du texte | bouton + menu (bascule) | Alt L D C | À vérifier | P1 | Contraste élevé uniquement ; Jaune ; Vert brillant ; Cyan ; Rose ; Bleu ; Rouge ; Bleu foncé ; Bleu-vert ; Vert ; Violet ; Rouge foncé … (+6) | home.ts : couleur arrondie à la palette de 16 surlignages Word |
| Police | Couleur de police | bouton + menu | Alt L G O | À vérifier | P1 | Contraste élevé uniquement ; Automatique ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 … (+62) | home.ts ColorPicker |
| Police | Police... | bouton | Alt L P L | Partiel | P2 |  | dialogs/text.tsx FontDialog : pas d'onglet « Avancé » (échelle, position, crénage, ligatures), pas d'effets Relief/Gravé/Ombre/Contour, souligné sans couleur ; 2026-11-06 : effets Ombre, Contour, Relief, Gravé, échelle et position ajoutés (e2e) ; reste crénage, ligatures, couleur de soulignement ; 2026-11-07 : + couleur de soulignement (portée par la marque, .docx) et crénage ; reste ligatures |
| Paragraphe | Puces | bouton + menu (bascule) | Alt L K | Partiel | P1 | Aucune ; Avec puces, Cercle plein ; Avec puces, Cercle creux ; Avec puces, Carré plein ; Liste à images de puces ; Avec puces, Quatre petits diamants ; Avec puces, Flèche creuse ; Avec puces, Coche ; Modifier le niveau de liste ; Définir une puce... | bibliothèque limitée à quelques caractères ; pas de « Définir une puce », niveaux de liste |
| Paragraphe | Numérotation | bouton + menu (bascule) | Alt L N | Partiel | P1 | Aucune ; 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1. ; 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1) ; I, II, III, …, ALIGNEMENTDroite, Format de nombre : I. ; A, B, C, …, ALIGNEMENTGauche, Format de nombre : A. ; a, b, c, …, ALIGNEMENTGauche, Format de nombre : a) ; a, b, c, …, ALIGNEMENTGauche, Format de nombre : a. ; i, ii, iii, …, ALIGNEMENTDroite, Format de nombre : i. ; Modifier le niveau de liste ; Définir un nouveau format de numérotation... ; Définir la valeur de numérotation... | 6 formats ; pas de « Définir un format de numérotation », « Définir la valeur de numérotation » |
| Paragraphe | Liste à plusieurs niveaux | menu / galerie | Alt L L | Partiel | P2 | Tout ; Filtre de galerie ; Hiérarchisation: L1: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1., Alignement :  0,63 cm, Retrait :  1,27 cm L2: Numéros, a, b, c, …, ALIGNEMENTGauche, Format de nombre : .a., Alignement :  1,9 cm, Retrait :  2,54 cm L3: Numéros, i, ii, i ; Aucune ; Hiérarchisation: L1: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1), Alignement :  0 cm, Retrait :  0,63 cm L2: Numéros, a, b, c, …, ALIGNEMENTGauche, Format de nombre : )a), Alignement :  0,63 cm, Retrait :  1,27 cm L3: Numéros, i, ii, iii ; Hiérarchisation: L1: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1., Alignement :  0 cm, Retrait :  0,63 cm L2: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1.., Alignement :  0,63 cm, Retrait :  1,4 cm L3: Numéros, 1, 2, 3, …, ; Hiérarchisation: L1: Avec puces, Quatre petits diamants, Alignement :  0 cm, Retrait :  0,63 cm L2: Avec puces, Flèche creuse, Alignement :  0,63 cm, Retrait :  1,27 cm L3: Avec puces, Carré plein, Alignement :  1,27 cm, Retrait :  1,9 cm L4: Avec puces, ; Hiérarchisation: L1: Numéros, I, II, III, …, ALIGNEMENTGauche, Format de nombre : Article I., Alignement :  0 cm, Retrait :  0 cm L2: Numéros, 01, 02, 03, …, ALIGNEMENTGauche, Format de nombre : Section 01., Alignement :  0 cm, Retrait :  0 cm L3: Numéro ; Hiérarchisation: L1: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1, Alignement :  0 cm, Retrait :  0,76 cm L2: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : 1., Alignement :  0 cm, Retrait :  1,02 cm L3: Numéros, 1, 2, 3, …, ALI ; Hiérarchisation: L1: Numéros, I, II, III, …, ALIGNEMENTGauche, Format de nombre : I., Alignement :  0 cm, Retrait :  0 cm L2: Numéros, A, B, C, …, ALIGNEMENTGauche, Format de nombre : .A., Alignement :  1,27 cm, Retrait :  1,27 cm L3: Numéros, 1, 2, 3, … ; Hiérarchisation: L1: Numéros, 1, 2, 3, …, ALIGNEMENTGauche, Format de nombre : Chapitre 1, Alignement :  0 cm, Retrait :  0 cm L2: Avec puces, Alignement :  0 cm, Retrait :  0 cm L3: Avec puces, Alignement :  0 cm, Retrait :  0 cm L4: Avec puces, Aligneme ; Modifier le niveau de liste … (+2) | bouton unique (act.list multilevel), pas de galerie ni « Définir une liste à plusieurs niveaux » |
| Paragraphe | Diminuer le retrait | bouton | Alt L D I | OK | P1 |  | test features « commandes : retrait » |
| Paragraphe | Augmenter le retrait | bouton | Alt L U U | OK | P1 |  | test features « commandes : retrait » |
| Paragraphe | Trier... | bouton | Alt L H R | À vérifier | P2 |  | dialogs/page.tsx SortDialog |
| Paragraphe | Afficher tout | bouton (bascule) | Alt L 8 / Ctrl+8 | À vérifier | P1 |  | ui.showMarks |
| Paragraphe | Aligner à gauche | bouton (bascule) | Alt L G L / Ctrl+Maj+G | OK | P1 |  | setParagraph alignment ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Paragraphe | Centrer | bouton (bascule) | Alt L G C / Ctrl+E | À vérifier | P1 |  | setParagraph alignment |
| Paragraphe | Aligner à droite | bouton (bascule) | Alt L W L / Ctrl+Maj+D | OK | P1 |  | setParagraph alignment ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Paragraphe | Justifier | bouton (bascule) | Alt L U S / Ctrl+J | À vérifier | P1 |  | setParagraph alignment |
| Paragraphe | Interligne et espacement de paragraphe | menu / galerie | Alt L É N | À vérifier | P1 | 1,0 ; 1,15 ; 1,5 ; 2,0 ; 2,5 ; 3,0 ; Options d'interligne… ; Ajouter de l’espace avant le paragraphe ; Supprimer l'espace après le paragraphe | menu 1 à 3 + options + avant/après |
| Paragraphe | Trame de fond | bouton + menu | Alt L H T | À vérifier | P1 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+61) | ColorPicker vers paragraphe.shading |
| Paragraphe | Bordures | bouton + menu (bascule) | Alt L O O | Partiel | P2 | Bordure inférieure ; Bordure supérieure ; Bordure gauche ; Bordure droite ; Aucune bordure ; Toutes les bordures ; Bordures extérieures ; Bordures intérieures ; Bordure intérieure horizontale ; Bordure intérieure verticale ; Bordure diagonale bas ; Bordure diagonale haut … (+4) | 4 entrées (bas, extérieures, aucune, bordures de page) sur 13 (haut, gauche, droite, intérieures, horizontale, tableau, dessiner...) ; pas de « Bordure et trame... » |
| Paragraphe | Paragraphe... | bouton | Alt L P A | Partiel | P1 |  | ParagraphDialog : pas de bouton Tabulations, retrait spécial (Suspendu/1re ligne) simplifié, pas de retraits en miroir, onglet Enchaînements incomplet (coupure de mots, numéros de ligne) |
| Styles | Styles (galerie) | menu / galerie |  | OK | P1 |  | capture « aperçu au survol » (STATUS.md) ; styles rapides du document |
| Styles | Styles... | bouton | Alt L T / Alt+Ctrl+Maj+S | À vérifier | P1 |  | volet Styles (ui/Panes.tsx StylesPane) ; manque Inspecteur de style, Gérer les styles |
| Édition | Rechercher | bouton + menu | Alt L F E / Ctrl+F | Partiel | P1 | Rechercher ; Recherche avancée... ; Atteindre... | ouvre le volet Navigation ; manque la recherche avancée, atteindre |
| Édition | Remplacer... | bouton | Alt L À E / Ctrl+H | OK | P1 |  | test find.test (casse, mot entier, accents, regex) ; dialogue FindDialog |
| Édition | Sélectionner | menu / galerie | Alt L 4 2 | Partiel | P2 | Sélectionner tout ; Sélectionner les objets ; Sélectionner tout le texte avec une mise en forme similaire (Aucune donnée) ; Volet Sélection... | Tout, Atteindre ; manque « Sélectionner les objets », « Sélectionner tout le texte de mise en forme similaire », volet Sélection |
| Compléments | Compléments | bouton (bascule) | Alt L A S | Absent | P3 |  | hors périmètre (pas de modules complémentaires Office) |

### Onglet Insertion  ·  KeyTip Alt S

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Pages | Page de garde | menu / galerie | Alt S P | Partiel | P2 | Austin ; Guide ; Lignes latérales ; Quadrillage ; Whisp ; À bandes ; Facette ; Filigrane ; Intégrale ; Ion (clair) ; Ion (foncé) ; Rétrospective … (+11) | 3 modèles (classique, bandeau, minimaliste) ; pas de galerie de 16 ni « Supprimer la page de garde » |
| Pages | Page vierge | bouton | Alt S G | À vérifier | P2 |  | act.insertBlankPage |
| Pages | Saut de page | bouton | Alt S S 1 / Ctrl+Retour | OK | P1 |  | test features « commandes : saut de page » + Ctrl+Entrée |
| Tableaux | Tableau | menu / galerie | Alt S Ç T | Partiel | P1 | Tableau 1x1 ; Tableau 1x2 ; Tableau 1x3 ; Tableau 1x4 ; Tableau 1x5 ; Tableau 1x6 ; Tableau 1x7 ; Tableau 2x1 ; Tableau 2x2 ; Tableau 2x3 ; Tableau 2x4 ; Tableau 2x5 … (+3) | grille 10x8 + dialogue ; manque Dessiner un tableau, Convertir le texte en tableau, Feuille de calcul Excel, Tableaux rapides |
| Illustrations | Images | menu / galerie | Alt S I 1 | Partiel | P1 | Cet appareil... ; Images d’archive... ; Images en ligne | un bouton « fichier » ; manque menu (Cet appareil, Images de stock, Images en ligne) |
| Illustrations | Formes | menu / galerie | Alt S E R | Partiel | P1 | Zone de texte ; Courbe ; Flèche trait ; Rectangle ; Ellipse ; Rectangle : coins arrondis ; Triangle isocèle ; Connecteur : en angle ; Connecteur : en angle avec flèche ; Flèche : droite ; Flèche : bas ; Forme libre : forme … (+151) | 4 formes (rectangle, arrondi, ellipse, ligne) sur ~170 ; insérées en ligne, non déplaçables ni redimensionnables à la souris, sans poignées ; 2026-11-07 : formes flottantes avec onglet Format de forme (remplissage, contour, position, habillage, ordre, taille) ; 4 géométries seulement ; 2026-11-07 : 16 géométries (flèches, étoiles, bulles), rotation, contour SVG non coupé, menu contextuel ; pas de groupement |
| Illustrations | Icônes | bouton | Alt S N S | Absent | P3 |  | aucune bibliothèque d'icônes |
| Illustrations | Modèles 3D | bouton + menu | Alt S S 3 | Absent | P3 | Cet appareil... ; Modèles 3D prêts à l’emploi... | hors périmètre |
| Illustrations | SmartArt... | bouton | Alt S R M | Absent | P2 |  | absent du modèle docx (conservé en brut seulement) |
| Illustrations | Graphique... | bouton | Alt S C 1 | Absent | P2 |  | absent (aucun objet graphique éditable dans Texte) |
| Illustrations | Capture | menu / galerie | Alt S R C | Absent | P3 | ◐ Suite bureautique multiplateforme style Office ; le dossier Images\Captures d’écran : Explorateur de fichiers ; Bitwarden ; Capture d’écran | aucune capture d'écran |
| Média | Vidéos en ligne... | bouton | Alt S L | Absent | P3 |  | absent |
| Liens | Lien | bouton | Alt S I 2 / Ctrl+K | Partiel | P1 |  | LinkDialog : texte, adresse, emplacement, info-bulle ; manque adresse e-mail, nouveau document, fichier existant |
| Liens | Signet... | bouton | Alt S Ç I | À vérifier | P2 |  | BookmarkDialog |
| Liens | Renvoi... | bouton | Alt S 9 | À vérifier | P2 |  | CrossRefDialog (titres, signets...) |
| Commentaires | Commentaire | bouton | Alt S C 2 | À vérifier | P1 |  | act.insertComment ; Ctrl+Alt+M |
| En-tête et pied de page | En-tête | menu / galerie | Alt S T | Partiel | P1 | Vide ; Vide (3 colonnes) ; À bandes ; Austin ; Guide (page impaire) ; Guide (page paire) ; Ligne latérale ; Quadrillage ; Whisp ; Facette (page impaire) ; Facette (page paire) ; Filigrane … (+16) | 4 modèles + modifier/supprimer ; manque la galerie (28 modèles) |
| En-tête et pied de page | Pied de page | menu / galerie | Alt S I 3 | Partiel | P1 | Vide ; Vide (3 colonnes) ; À bandes ; Austin ; Guide (page impaire) ; Guide (page paire) ; Lignes latérales ; Quadrillage ; Whisp ; AffichageMaître (horizontal) ; AffichageMaître (vertical) ; Facette (page impaire) … (+16) | idem En-tête (17 modèles Word) |
| En-tête et pied de page | Numéro de page | menu / galerie | Alt S J | Partiel | P1 | Haut de page ; Bas de page ; Marges de la page ; Position actuelle ; Format des numéros de page... ; Supprimer les numéros de page | haut/bas x3 + « Page X sur Y » ; manque « Position actuelle », « Format des numéros de page », « Début à » |
| Texte | Zone de texte | menu / galerie | Alt S 8 | Partiel | P1 | Zone de texte simple ; Citation à bandes ; Citation Austin ; Citation avec trait latéral ; Citation quadrillage ; Citation simple ; Citation, style guide ; Encadré à bandes ; Encadré Austin ; Encadré avec trait latéral ; Encadré quadrillage ; Encadré, style guide … (+30) | insère un rectangle avec texte EN LIGNE ; non flottant, non déplaçable, pas de galerie de zones de texte ; 2026-11-07 : zone de texte flottante (habillage, déplacement souris, .docx) ; pas de galerie de modèles |
| Texte | QuickPart | menu / galerie | Alt S U | Absent | P3 | Insertion automatique ; Propriété du document ; Champ... ; Organisateur de blocs de construction... ; Enregistrer la sélection dans la galerie de composants QuickPart... | pas de blocs de construction (Insertion automatique, Propriété du document, Organisateur) |
| Texte | WordArt | menu / galerie | Alt S 1 | Absent | P3 | Remplissage : Noir, Couleur de texte 1 ; Ombre ; Remplissage : Bleu-vert foncé, Couleur d’accentuation 1 ; Ombre ; Remplissage : Orange, Couleur d’accentuation 2 ; Contour : Orange, Couleur d’accentuation 2 ; Remplissage : Blanc ; Contour : Prune, Couleur d’accentuation 5 ; Ombre ; Remplissage : Turquoise, Couleur d’accentuation 4 ; Biseau souple ; Remplissage dégradé, Gris ; Remplissage dégradé : Prune, Couleur d’accentuation 5 ; Réflexion ; Remplissage dégradé : Turquoise, Couleur d’accentuation 4 ; Contour : Turquoise, Couleur d’accentuation 4 ; Remplissage : Blanc ; Contour : Bleu-vert foncé, Couleur d’accentuation 1 ; Lumière : Bleu-vert foncé, Couleur d’accentuation 1 ; Remplissage : Vert foncé, Couleur d’accentuation 3 ; Biseau net ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Blanc, Couleur d’arrière-plan 1 ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Prune, Couleur d’accentuation 5 … (+3) | absent |
| Texte | Lettrine | menu / galerie | Alt S À | Absent | P3 | Options de lettrine... | absent |
| Texte | Signature | bouton + menu | Alt S F | Absent | P3 | Ligne de signature Microsoft Office... ; Ajouter des services de signature... | absent |
| Texte | Date et heure... | bouton | Alt S È D | À vérifier | P2 |  | DateDialog + champ DATE (Alt+Maj+D) |
| Texte | Objet... | bouton + menu | Alt S B | Absent | P3 | Objet... ; Texte d'un fichier... | pas d'objet OLE ni « Texte d'un fichier » |
| Symboles | Équation | bouton + menu | Alt S Q Q | Partiel | P2 | Développement de Taylor ; Élévation d’une somme ; Formule du binôme ; Formule quadratique ; Identité trigonométrique 1 ; Identité trigonométrique 2 ; Série de Fourier ; Surface du cercle ; Théorème de Pythagore ; Ligne vers le haut ; Page précédente ; Page suivante … (+5) | saisie linéaire + 5 équations ; pas d'éditeur d'équations 2D, ni onglet Équation, ni entrée manuscrite |
| Symboles | Symbole | menu / galerie | Alt S È Y | Partiel | P2 | SYMBOLE EURO ; SYMBOLE LIVRE ; SYMBOLE YEN ; SYMBOLE COPYRIGHT ; SYMBOLE MARQUE DÉPOSÉE ; SYMBOLE ANGLAIS MARQUE DE COMMERCE ; SIGNE PLUS-OU-MOINS ; PAS ÉGAL À ; PLUS PETIT OU ÉGAL À ; PLUS GRAND OU ÉGAL À ; SIGNE DIVISION ; SIGNE MULTIPLICATION … (+9) | 30 symboles + dialogue par jeux (latin, grec, maths, flèches...) ; manque sous-ensemble Unicode, Caractères spéciaux, touche de raccourci |
| eSignature | Champs d’eSignature | bouton | Alt S S E | Absent | P3 |  | hors périmètre |

### Onglet Dessin (source : connaissance ; masqué sur ce Word, donc absent de l'arbre UI Automation)

| Groupe | Commande | Type | KeyTip / Raccourci | Statut | Prio | Contenu / note |
|---|---|---|---|---|---|---|
| Outils | Sélection au lasso | bouton (bascule) | Alt J I … | Absent | P3 |  |
| Outils | Gomme | menu |  | Partiel | P2 | gomme dans la boîte « Dessiner » (InkDialog, `cmd.eraser`) ; pas de gomme de trait / de point |
| Outils | Stylos (galerie de 3 stylos + Ajouter un stylo) | galerie |  | Partiel | P2 | 5 stylets fixes (noir, rouge, bleu, vert, surligneur) dans `ribbon/insert.tsx` drawTab ; pas d'épaisseur/couleur éditables dans le ruban |
| Outils | Dessiner avec la souris ou le doigt | bascule |  | À vérifier | P2 | `Dessiner` ouvre InkDialog (l'encre est insérée comme image PNG, STATUS) |
| Convertir | Encre en forme | bouton |  | Absent | P3 |  |
| Convertir | Encre en équation (maths) | bouton |  | Absent | P3 |  |
| Convertir | Encre en texte (écriture manuscrite) | bouton |  | Absent | P3 |  |
| Insérer | Insérer une zone de dessin | bouton |  | Absent | P3 |  |
| Relecture | Relecture de l'encre | bouton |  | Absent | P3 |  |


### Onglet Conception  ·  KeyTip Alt Ç

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Mise en forme du document | Thèmes | menu / galerie | Alt Ç T | Partiel | P2 | Office ; Thème Office 2013 – 2022 ; Brin ; Facette ; Galerie ; Intégral ; Ion ; Organique ; Rétrospective ; Salle d’ions ; Secteur ; À bandes … (+26) | 6 thèmes prédéfinis (features/design.ts) ; pas de « Rechercher des thèmes », « Enregistrer le thème » ; 2026-11-07 : 14 thèmes (8 ajoutés, couleurs + polices) ; Word en propose 38 |
| Mise en forme du document | Jeux de styles | menu / galerie |  | Partiel | P2 | Document ; Basique (élégant) ; Basique (simple) ; Basique (sophistiqué) ; Centré ; Informel ; Lignes (distinctif) ; Lignes (élégant) ; Lignes (simple) ; Minimaliste ; Noir et blanc (classique) ; Noir et blanc (en majuscules) … (+9) | 4 jeux (par défaut, classique, moderne, élégant) sur ~20 |
| Mise en forme du document | Couleurs | menu / galerie | Alt Ç U | Partiel | P2 | Office ; Office 2013 - 2022 ; Office 2007 - 2010 ; Nuances de gris ; Bleu chaud ; Bleu ; Bleu II ; Bleu vert ; Vert ; Vert jaune ; Jaune ; Jaune orange … (+17) | couleurs des 6 thèmes ; pas de « Personnaliser les couleurs » |
| Mise en forme du document | Polices | menu / galerie | Alt Ç L | Partiel | P2 | Office, Police du titre : Aptos Display, Police du corps du texte : Aptos ; Office 2013 - 2022, Police du titre : Calibri Light, Police du corps du texte : Calibri ; Office 2007 - 2010, Police du titre : Cambria, Police du corps du texte : Calibri ; Calibri, Police du titre : Calibri, Police du corps du texte : Calibri ; Arial, Police du titre : Arial, Police du corps du texte : Arial ; Corbel, Police du titre : Corbel, Police du corps du texte : Corbel ; Candara, Police du titre : Candara, Police du corps du texte : Candara ; Franklin Gothic, Police du titre : Franklin Gothic Medium, Police du corps du texte : Franklin Gothic Book ; Century Gothic, Police du titre : Century Gothic, Police du corps du texte : Century Gothic ; Tw Cen MT, Police du titre : Tw Cen MT, Police du corps du texte : Tw Cen MT ; Cambria, Police du titre : Cambria, Police du corps du texte : Cambria ; Garamond … (+19) | paires des 6 thèmes ; pas de « Personnaliser les polices » |
| Mise en forme du document | Espacement des paragraphes | menu / galerie | Alt Ç S | Partiel | P2 | Par défaut ; Aucun espace de paragraphe ; Compact ; Rapproché ; Ouvert ; Relâché ; Double ; Espacement personnalisé des paragraphes... | 5 réglages sur 7 (+ personnalisé) |
| Mise en forme du document | Effets | menu / galerie | Alt Ç É | Absent | P3 | Office ; Office 2007 - 2010 ; Solides discrets ; Coin à bandes ; Verre de fumée ; Coin lumineux ; Texture grunge ; Verre givré ; Ombre supérieure ; Incrustation ; Verre de lait ; Riblet … (+3) | pas d'effets de thème |
| Mise en forme du document | Définir par défaut | bouton | Alt Ç D | Absent | P3 |  | absent |
| Arrière-plan de la page | Filigrane | menu / galerie | Alt Ç F | Partiel | P2 | BROUILLON 1 ; BROUILLON 2 ; EXEMPLE 1 ; EXEMPLE 2 ; CONFIDENTIEL 1 ; CONFIDENTIEL 2 ; NE PAS COPIER 1 ; NE PAS COPIER 2 ; Dès que possible 1 ; Dès que possible 2 ; URGENT 1 ; URGENT 2 … (+8) | 5 textes + personnalisé ; stocké en propriété personnalisée (non visible dans Word) ; pas de filigrane image |
| Arrière-plan de la page | Couleur de page | menu / galerie | Alt Ç P C | Partiel | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+62) | propriété personnalisée (non visible dans Word) ; pas d'effets de remplissage |
| Arrière-plan de la page | Bordures de page... | bouton | Alt Ç B | Partiel | P2 |  | PageBorderDialog simple ; pas de bordure artistique, appliquer à, options |

### Onglet Mise en page  ·  KeyTip Alt P

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Mise en page | Marges | menu / galerie | Alt P À | Partiel | P1 | Marges normales ; Marges étroites ; Marges moyennes ; Marges larges ; Marges en miroir ; Marges personnalisées... | 5 préréglages + personnalisé ; manque « Dernière personnalisée », « Office 2003 » |
| Mise en page | Orientation | menu / galerie | Alt P N | À vérifier | P1 | Portrait ; Paysage | inversion largeur/hauteur de la section |
| Mise en page | Taille | menu / galerie | Alt P K A | Partiel | P1 | Lettre US (215,9 x 279,4 mm) ; Tabloïd ; Legal US ; Statement US ; Exécutif US (18,42 x 26,67 cm) ; A3 ; A4 ; A5 ; B4 (JIS) ; B5 (JIS) ; Enveloppe US n° 9 ; Enveloppe US n° 10 … (+57) | 6 formats sur ~20 ; manque « Autres tailles de papier » |
| Mise en page | Colonnes | menu / galerie | Alt P O C | À vérifier | P2 | Un ; Deux ; Trois ; Gauche ; Droite ; Autres colonnes... | une/deux/trois/gauche/droite + ligne séparatrice ; pagination des colonnes selon le moteur (STATUS) |
| Mise en page | Sauts de page | menu / galerie | Alt P B | À vérifier | P1 | Page ; Colonne ; Habillage du texte ; Page suivante ; Continu ; Page paire ; Page impaire | page, colonne, 4 sauts de section ; manque « Habillage du texte » |
| Mise en page | Numéros de lignes | menu / galerie | Alt P U | Partiel | P3 | Aucun ; Continu ; Redémarrer chaque page ; Redémarrer chaque section ; Supprimer pour le paragraphe actuel ; Options de numérotation de ligne... | continu / par page ; manque « Supprimer pour le paragraphe », « Options de numérotation » ; 2026-11-06 : boîte Numéros de ligne (début, pas, redémarrage) prouvée en réel ; reste distance au texte et suppression par paragraphe |
| Mise en page | Coupure de mots | menu / galerie | Alt P C | Partiel | P3 | Aucune ; Automatique ; Manuelle ; Options de coupure de mots... | bascule automatique/aucune ; manque Manuelle, Options de coupure de mots |
| Mise en page | Mise en page... | bouton | Alt P J | Partiel | P1 |  | PageSetupDialog une seule page : marges/papier/colonnes ; manque onglet Disposition (sections, pages paires/impaires, alignement vertical, numéros de ligne), « Appliquer à : à partir de ce point », « Définir par défaut » |
| Paragraphe | Retrait à gauche | champ numérique | Alt P G | À vérifier | P2 |  | ribbon/page.ts NumberField cm |
| Paragraphe | Retrait à droite | champ numérique | Alt P D | À vérifier | P2 |  | ribbon/page.ts |
| Paragraphe | Espace avant | champ numérique | Alt P T | À vérifier | P2 |  | ribbon/page.ts |
| Paragraphe | Espace après | champ numérique | Alt P A | À vérifier | P2 |  | ribbon/page.ts |
| Paragraphe | Paragraphe... | bouton | Alt P P A | Partiel | P1 |  | voir Accueil |
| Organiser | Position | menu / galerie | Alt P W | Absent | P2 | Aligné sur le texte ; En haut à gauche avec habillage du texte carré ; En haut au centre avec habillage de texte carré ; En haut à droite avec habillage du texte carré ; Au milieu à gauche avec habillage du texte carré | pas de positionnement des objets |
| Organiser | Habillage | menu / galerie | Alt P Q | Absent | P2 |  | disponible seulement dans l'onglet contextuel Format de l'image |
| Organiser | Avancer | bouton + menu | Alt P È V | Absent | P3 | Avancer ; Premier plan ; Texte en dessous | pas d'ordre Z des objets |
| Organiser | Reculer | bouton + menu | Alt P 7 | Absent | P3 | Reculer ; Arrière-plan ; Texte au-dessus | idem |
| Organiser | Volet Sélection... | bouton (bascule) | Alt P 5 | Partiel | P3 |  | absent ; 2026-11-07 : volet Sélection pour formes, zones de texte et images (objects/SelectionPane.tsx) |
| Organiser | Aligner | menu / galerie | Alt P K L | Absent | P3 | Aligner à gauche ; Centrer ; Aligner à droite ; Aligner en haut ; Aligner au milieu ; Aligner en bas ; Distribuer horizontalement ; Distribuer verticalement ; Aligner sur la page ; Aligner sur la marge ; Aligner les objets sélectionnés ; Utiliser les repères d'alignement … (+2) | absent |
| Organiser | Grouper | menu / galerie | Alt P Ù G | Absent | P3 | Grouper ; Dissocier | absent |
| Organiser | Rotation | menu / galerie | Alt P È R | Absent | P3 | Faire pivoter à droite de 90° ; Faire pivoter à gauche de 90° ; Retourner verticalement ; Retourner horizontalement ; Autres options de rotation... | rotation seulement pour l'image (onglet Format de l'image) |

### Onglet Références  ·  KeyTip Alt É

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Table des matières | Table des matières | menu / galerie | Alt É T | Partiel | P1 |  | 1 modèle automatique + supprimer (test TOC) ; manque Table manuelle, 2e modèle, « Table des matières personnalisée... » |
| Table des matières | Ajouter le texte | menu / galerie | Alt É X | À vérifier | P2 | Ne pas afficher dans la table des matières ; Niveau 1 ; Niveau 2 ; Niveau 3 | niveaux 1-3 via styles Titre ; manque « Ne pas afficher dans la table » |
| Table des matières | Mettre à jour la table... | bouton | Alt É U | OK | P1 |  | test features « titres, table des matières » |
| Notes de bas de page | Insérer une note de bas de page | bouton | Alt É H / Alt+Ctrl+B | OK | P1 |  | Ctrl+Alt+F (Word FR : Alt+Ctrl+B) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Notes de bas de page | Insérer une note de fin | bouton | Alt É É / Alt+Ctrl+F | OK | P2 |  | Ctrl+Alt+D (Word FR : Alt+Ctrl+F) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Notes de bas de page | Note de bas de page suivante | bouton + menu | Alt É D | Absent | P3 | Note de bas de page suivante ; Note de bas de page précédente ; Note de fin suivante ; Note de fin précédente | string cmd.nextNote non utilisée |
| Notes de bas de page | Afficher les notes | bouton | Alt É F | À vérifier | P2 |  | volet Notes |
| Notes de bas de page | Boîte de dialogue Note de bas de page et de fin... | bouton | Alt É P | Absent | P2 |  | pas de format de numérotation, position, conversion |
| Citations et bibliographie | Insérer une citation | menu / galerie | Alt É I | Partiel | P3 |  | CitationDialog 4 champs ; pas de gestionnaire de sources |
| Citations et bibliographie | Gérer les sources... | bouton | Alt É G | Absent | P3 |  | absent |
| Citations et bibliographie | Style | liste déroulante | Alt É L | Absent | P3 |  | pas de styles bibliographiques (APA, MLA...) |
| Citations et bibliographie | Bibliographie | menu / galerie | Alt É B | Partiel | P3 | Bibliographie ; Références ; Travaux cités ; Insérer la bibliographie ; Enregistrer la sélection dans la galerie de bibliographies... | même dialogue que la citation ; pas de génération de bibliographie |
| Citations et bibliographie | Changer de fournisseur | menu / galerie | Alt É S P | Absent | P3 |  | hors périmètre |
| Légendes | Insérer une légende... | bouton | Alt É A | À vérifier | P2 |  | CaptionDialog (Figure, Tableau, Équation) |
| Légendes | Insérer une table des illustrations... | bouton | Alt É N | Absent | P2 |  | string non câblée |
| Légendes | Mettre à jour la table | bouton | Alt É À | Partiel | P2 |  | act.updateFields (champs et sommaire, pas table des illustrations) |
| Légendes | Renvoi... | bouton | Alt É 9 | À vérifier | P2 |  | CrossRefDialog |
| Index | Marquer entrée... | bouton | Alt É E | Partiel | P3 |  | IndexDialog |
| Index | Insérer l'index... | bouton | Alt É R | Partiel | P3 |  | même dialogue ; génération non prouvée |
| Index | Mettre à jour l'index | bouton | Alt É O | Absent | P3 |  | absent |

### Onglet Publipostage  ·  KeyTip Alt G

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Créer | Enveloppes... | bouton | Alt G N | Absent | P3 |  | absent |
| Créer | Étiquettes... | bouton | Alt G É | Absent | P3 |  | absent |
| Démarrer la fusion et le publipostage | Démarrer la fusion et le publipostage | menu / galerie | Alt G U | Partiel | P2 | Lettres ; Courriers ; Enveloppes... ; Étiquettes... ; Annuaire ; Document Word normal ; Assistant Fusion et publipostage pas à pas... | menu unique « liste CSV » ; manque type de document (lettres, e-mails, enveloppes, étiquettes, répertoire) et assistant pas à pas |
| Démarrer la fusion et le publipostage | Sélection des destinataires | menu / galerie | Alt G T | Partiel | P2 | Entrer une nouvelle liste... ; Utiliser une liste existante... ; Sélectionner dans les contacts Outlook... | CSV seulement ; pas d'Excel, Outlook, liste existante |
| Démarrer la fusion et le publipostage | Modifier la liste de destinataires... | bouton | Alt G O | Absent | P2 |  | absent |
| Champs d'écriture et d'insertion | Champs de fusion en surbrillance | bouton (bascule) | Alt G H | Absent | P3 |  | absent |
| Champs d'écriture et d'insertion | Bloc d'adresse... | bouton | Alt G B | Absent | P3 |  | absent |
| Champs d'écriture et d'insertion | Formule d’appel... | bouton | Alt G F | Absent | P3 |  | absent |
| Champs d'écriture et d'insertion | Insérer un champ de fusion | bouton + menu | Alt G X | À vérifier | P2 |  | menu des en-têtes CSV ; test publipostage CSV |
| Champs d'écriture et d'insertion | Règles | menu / galerie | Alt G G | Absent | P3 | Demander... ; Remplir... ; Si...Alors...Sinon... ; Nº enregistr. de fusion ; Nº séquence de fusion ; Suivant ; Suivant Si... ; Définir Signet... ; Sauter l'enregistrement si... | pas de règles (Si...Alors...Sinon, Demander...) |
| Champs d'écriture et d'insertion | Faire correspondre les champs... | bouton | Alt G A | Absent | P3 |  | absent |
| Champs d'écriture et d'insertion | Mettre à jour les étiquettes | bouton | Alt G M | Absent | P3 |  | absent |
| Aperçu des résultats | Aperçu des résultats | bouton (bascule) | Alt G Ç | OK | P2 |  | test features « publipostage : CSV, champs, fusion » |
| Aperçu des résultats | Premier | bouton | Alt G À | Absent | P3 |  | absent (seuls précédent/suivant) |
| Aperçu des résultats | Précédent | bouton | Alt G P | À vérifier | P2 |  | ribbon/references.ts |
| Aperçu des résultats | Suivant | bouton | Alt G S | À vérifier | P2 |  | ribbon/references.ts |
| Aperçu des résultats | Dernier | bouton | Alt G D | Absent | P3 |  | absent |
| Aperçu des résultats | Rechercher un destinataire... | bouton | Alt G R | Absent | P3 |  | absent |
| Aperçu des résultats | Rechercher les erreurs... | bouton | Alt G L | Absent | P3 |  | absent |
| Terminer | Terminer & fusionner | menu / galerie | Alt G È | Partiel | P2 | Modifier des documents individuels... ; Imprimer les documents... ; Envoyer des courriers... | crée un document fusionné ; manque « Imprimer les documents », « Envoyer des messages électroniques » |

### Onglet Révision  ·  KeyTip Alt R

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Vérification | Grammaire et orthographe | bouton | Alt R 6 | Partiel | P1 |  | dialogue d'info : s'appuie sur le correcteur du système (soulignement navigateur), aucune grammaire propre (STATUS) |
| Vérification | Dictionnaire des synonymes... | bouton | Alt R D I | Absent | P2 |  | menu contextuel : « Aucun synonyme disponible hors connexion » |
| Vérification | Statistiques | bouton | Alt R L 1 | OK | P2 |  | test features « statistiques avancées » + StatsDialog |
| Fonction vocale | Lecture à voix haute | bouton | Alt R L 2 / Alt+Ctrl+Espace | Absent | P2 |  | absent (SpeechSynthesis possible) |
| Accessibilité | Vérifier l’accessibilité | bouton + menu | Alt R A 1 | Absent | P2 | Vérifier l’accessibilité ; Texte de remplacement ; Volet de navigation ; Focus ; Options : accessibilité | absent |
| Langue | Langue | menu / galerie | Alt R Z L | Partiel | P2 |  | langue du paragraphe/sélection (6 langues) ; manque « Définir la langue de vérification » dialogue, Traduire |
| Commentaires | Nouveau commentaire | bouton | Alt R N | À vérifier | P1 |  | volet Commentaires (capture) |
| Commentaires | Supprimer | bouton + menu | Alt R U S | Partiel | P2 | Supprimer ; Supprimer tous les commentaires affichés ; Supprimer tous les commentaires du document | suppression depuis le volet seulement ; manque supprimer tous/tous visibles |
| Commentaires | Précédent | bouton | Alt R É | À vérifier | P2 |  | act.gotoComment |
| Commentaires | Suivant | bouton | Alt R A U | À vérifier | P2 |  | act.gotoComment |
| Commentaires | Afficher les commentaires | bouton (bascule) | Alt R H | À vérifier | P2 |  | volet Commentaires |
| Marque de révision | Afficher pour la révision | liste déroulante | Alt R P | À vérifier | P2 |  | 4 modes (simple, toutes, aucune, original) |
| Marque de révision | Afficher les marques | menu / galerie | Alt R Ù | Absent | P2 | Commentaires ; Insertions et suppressions ; Mise en forme ; Bulles ; Personnes spécifiques ; Surligner les mises à jour ; Autres auteurs | pas de filtre par type de marque ni par relecteur |
| Marque de révision | Volet Vérifications | bouton + menu (bascule) | Alt R W | Absent | P2 | Volet Vérifications - Vertical... ; Volet Vérifications - Horizontal... | absent |
| Marque de révision | Modifier les options de suivi... | bouton | Alt R M 1 | Absent | P3 |  | absent |
| Suivi | Suivi | menu / galerie | Alt R Z T | OK | P1 |  | test « suivi des modifications : frappe, suppression, accepter, refuser » ; pas de « Pour tous / Pour moi seul », verrouillage |
| Comparer | Comparer | menu / galerie | Alt R C C | Partiel | P2 | Comparer... ; Combiner... ; Afficher les documents sources | compare simple (test comparer) ; pas de « Combiner » |
| Protéger | Protéger | menu / galerie | Alt R Z R | Partiel | P2 |  | « Restreindre la modification » = basculer en lecture seule ; pas de mot de passe, restrictions de mise en forme/commentaires, bloquer les auteurs |
| Entrée manuscrite | Masquer les entrées manuscrites | bouton + menu (bascule) | Alt R M 2 | Absent | P3 | Masquer les entrées manuscrites ; Supprimer tous les éléments manuscrits dans le document | absent |

### Onglet Affichage  ·  KeyTip Alt N

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Vues | Mode Lecture | bouton (bascule) | Alt N M | OK | P2 |  | capture mode Lecture |
| Vues | Page | bouton (bascule) | Alt N A | OK | P1 |  | vue par défaut, captures |
| Vues | Web | bouton (bascule) | Alt N W | À vérifier | P3 |  | view web |
| Vues | Plan | bouton (bascule) | Alt N P | OK | P2 |  | capture mode Plan + onglet Mode Plan |
| Vues | Brouillon | bouton (bascule) | Alt N B | À vérifier | P3 |  | view draft |
| Immersion | Focus | bouton (bascule) | Alt N O 1 | OK | P2 |  | capture mode Focus |
| Immersion | Lecteur immersif | bouton (bascule) | Alt N L 1 | Partiel | P3 |  | mode Lecture + minuteur ; pas d'espacement du texte, focus de ligne, lecture à voix haute |
| Mode foncé | Changer de mode | bouton (bascule) | Alt N D 1 | Partiel | P3 |  | thème sombre dans Options (capture) ; pas de bascule rapide dans le ruban |
| Mouvement de page | Vertical | bouton (bascule) | Alt N C 1 | À vérifier | P3 |  | défilement vertical par défaut |
| Mouvement de page | Côte à côte | bouton (bascule) | Alt N H | Partiel | P3 |  | Plusieurs pages en vignettes en lecture seule |
| Afficher | Règle | case à cocher (bascule) | Alt N È | À vérifier | P1 |  | ui.ruler ; Ruler.tsx |
| Afficher | Quadrillage | case à cocher (bascule) | Alt N E | À vérifier | P3 |  | ui.grid |
| Afficher | Volet de navigation | case à cocher (bascule) | Alt N V | À vérifier | P1 |  | titres + recherche |
| Zoom | Zoom... | bouton | Alt N 6 | Partiel | P2 |  | menu à 5 niveaux ; pas de dialogue Zoom (pourcentage libre, plusieurs pages) |
| Zoom | 100% | bouton | Alt N 0 / Ctrl+0 | À vérifier | P2 |  | setUi zoom 100 |
| Zoom | Une page | bouton | Alt N 1 | À vérifier | P2 |  | barre d'état (zoomPresets) + ruban |
| Zoom | Plusieurs pages | bouton | Alt N 2 | Partiel | P2 |  | vignettes en lecture seule (STATUS) |
| Zoom | Largeur de la page | bouton | Alt N L 2 | Partiel | P2 |  | dans le menu de la barre d'état seulement |
| Fenêtre | Nouvelle fenêtre | bouton | Alt N O 2 | Absent | P2 |  | absent (onglets de documents du paquet ui possibles) |
| Fenêtre | Réorganiser tout | bouton | Alt N K | Absent | P3 |  | absent |
| Fenêtre | Fractionner | bouton | Alt N F | Absent | P3 |  | absent |
| Fenêtre | Côte à côte | bouton (bascule) | Alt N C 2 | Partiel | P3 |  | Plusieurs pages en vignettes en lecture seule |
| Fenêtre | Défilement synchrone | bouton (bascule) | Alt N D 2 | Absent | P3 |  | absent |
| Fenêtre | Rétablir la position de la fenêtre | bouton | Alt N R | Absent | P3 |  | absent |
| Fenêtre | Changer de fenêtre | menu / galerie | Alt N Ù | Absent | P3 | 1 Document1 | absent |
| Macros | Macros | bouton + menu | Alt N G | Absent | P3 | Afficher les macros ; Enregistrer une macro... ; Suspendre l'enregistrement | VBA : non (décision du propriétaire) ; pas d'enregistreur de macros |
| SharePoint | Propriétés | bouton (bascule) | Alt N S P | Partiel | P3 |  | propriétés du document dans Backstage > Informations |

### Onglet Aide  ·  KeyTip Alt Ù

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Aide | Aide | bouton | Alt Ù A 1 | Absent | P3 |  | pas d'aide F1 ; recherche de commandes Alt+Q existe |
| Aide | Contacter le support... | bouton | Alt Ù C | Absent | P3 |  | hors périmètre (local) |
| Aide | Commentaires | bouton | Alt Ù K | Absent | P3 |  | hors périmètre |
| Aide | Afficher la formation | bouton | Alt Ù A 2 | Absent | P3 |  | hors périmètre |
| Mobile | Obtenir l’application mobile Word | bouton | Alt Ù O | Absent | P3 |  | hors périmètre |

### Onglet Développeur (source : connaissance ; masqué par défaut dans Word)

| Groupe | Commande | Type | KeyTip / Raccourci | Statut | Prio | Contenu / note |
|---|---|---|---|---|---|---|
| Code | Visual Basic / Macros / Enregistrer une macro / Sécurité des macros | boutons | Alt+F11 | Absent | P3 | VBA : non (décision) |
| Compléments | Compléments Word / Compléments COM | boutons |  | Absent | P3 | hors périmètre |
| Contrôles | Contrôles de contenu (texte enrichi, texte brut, image, liste, date, case à cocher, bloc de construction) + Mode Création + Propriétés | boutons |  | Absent | P2 | le modèle lit les contrôles de contenu (`contentControl`) mais aucune commande d'insertion |
| Mappage | Mappage XML / Volet de mappage | boutons |  | Absent | P3 |  |
| Protéger | Bloquer les auteurs / Restreindre la modification | boutons |  | Partiel | P2 | voir Révision > Protéger |
| Modèles | Modèle de document / Volet Actions du document | boutons |  | Absent | P3 |  |


## 1bis. Onglets contextuels du ruban

Relevés sur le vrai Word après sélection d'un objet de test. ForgeOffice n'en a que quatre (Création de tableau, Disposition, Format de l'image, Mode Plan).

### Onglet Création de tableau  ·  KeyTip Alt J T  ·  contextuel : Tableau (Outils de tableau) — s'affiche quand le curseur est dans un tableau

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Options de style de tableau | Ligne d’en-tête | case à cocher (bascule) | Alt J T L | Partiel | P2 |  | bouton « Ligne d'en-tête » (toggleHeaderRow) mais pas une case d'option de style |
| Options de style de tableau | Ligne Total | case à cocher (bascule) | Alt J T G | Absent | P3 |  | string cmd.tableStyleTotal non câblée |
| Options de style de tableau | Lignes à bandes | case à cocher (bascule) | Alt J T I | Absent | P3 |  | string non câblée |
| Options de style de tableau | Première colonne | case à cocher (bascule) | Alt J T P | Absent | P3 |  | string non câblée |
| Options de style de tableau | Dernière colonne | case à cocher (bascule) | Alt J T D | Absent | P3 |  | absent |
| Options de style de tableau | Colonnes à bandes | case à cocher (bascule) | Alt J T C | Absent | P3 |  | absent |
| Styles de tableau | Styles de tableau | menu / galerie |  | Partiel | P2 |  | 2 styles (Grille du tableau, Tableau normal) sur ~100 ; pas de Nouveau style / Effacer |
| Styles de tableau | Trame de fond | bouton + menu | Alt J T H T | À vérifier | P1 |  | ColorPicker → cellProps.shading |
| Bordures | Styles de bordure | bouton + menu | Alt J T E | Absent | P3 |  | absent |
| Bordures | Style du stylo | liste déroulante | Alt J T T | Absent | P3 |  | absent |
| Bordures | Épaisseur du stylo | liste déroulante | Alt J T U | Absent | P3 |  | absent |
| Bordures | Couleur du stylet | bouton + menu | Alt J T À | Absent | P3 |  | absent |
| Bordures | Bordures | bouton + menu (bascule) | Alt J T O O | Partiel | P1 |  | boutons « Toutes les bordures » / « Aucune bordure » ; manque haut/bas/gauche/droite/intérieures/diagonales/quadrillage |
| Bordures | Mise en forme des bordures | bouton (bascule) | Alt J T M | Absent | P3 |  | absent |
| Bordures | Bordure et trame... | bouton | Alt J T B | Absent | P2 |  | aucun dialogue Bordures et trame pour cellules/tableau |

### Onglet Disposition du tableau  ·  KeyTip Alt J L  ·  contextuel : Tableau (Outils de tableau)

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Tableau | Sélectionner | menu / galerie | Alt J L À | Absent | P2 |  | string cmd.selectTable non câblée |
| Tableau | Afficher le quadrillage | bouton (bascule) | Alt J L Q | Absent | P3 |  | absent |
| Tableau | Propriétés... | bouton | Alt J L P | Absent | P2 |  | aucun dialogue Propriétés du tableau (largeur, alignement, habillage, ligne, colonne, cellule, texte de remplacement) |
| Dessiner | Dessiner un tableau | bouton (bascule) | Alt J L È | Absent | P3 |  | absent |
| Dessiner | Gomme | bouton (bascule) | Alt J L K | Absent | P3 |  | absent |
| Lignes et colonnes | Supprimer | menu / galerie | Alt J L D U | Partiel | P1 |  | 3 boutons séparés (tableau, lignes, colonnes) ; pas de menu ni « Supprimer les cellules » |
| Lignes et colonnes | Insérer une ligne au-dessus | bouton | Alt J L I | À vérifier | P1 |  | addRowBefore |
| Lignes et colonnes | Insérer une ligne en dessous | bouton | Alt J L N | À vérifier | P1 |  | addRowAfter |
| Lignes et colonnes | Insérer une colonne à gauche | bouton | Alt J L S | À vérifier | P1 |  | addColumnBefore |
| Lignes et colonnes | Insérer une colonne à droite | bouton | Alt J L É | À vérifier | P1 |  | addColumnAfter |
| Lignes et colonnes | Insérer des cellules... | bouton | Alt J L R | Absent | P3 |  | absent |
| Fusionner | Fusionner | bouton | Alt J L C E | À vérifier | P1 |  | mergeCells ; test convert (fusions de cellules au chargement) |
| Fusionner | Fractionner... | bouton | Alt J L Ç R | Partiel | P2 |  | splitCell sans dialogue (nombre de colonnes/lignes) |
| Fusionner | Fractionner le tableau | bouton | Alt J L F | Absent | P3 |  | absent |
| Taille de la cellule | Ajustement automatique | menu / galerie | Alt J L A | Absent | P2 |  | absent (contenu / fenêtre / largeur fixe) |
| Taille de la cellule | Tableau Hauteur Ligne | champ numérique | Alt J L U | Absent | P2 |  | absent (hauteur de ligne non éditable) |
| Taille de la cellule | Tableau Largeur de colonne | champ numérique | Alt J L L | Partiel | P2 |  | redimensionnement à la souris (columnResizing) ; pas de champ numérique |
| Taille de la cellule | Uniformiser les lignes | bouton | Alt J L X D | Absent | P3 |  | absent |
| Taille de la cellule | Uniformiser les colonnes | bouton | Alt J L D D | Absent | P3 |  | absent |
| Taille de la cellule | Propriétés... | bouton | Alt J L P | Absent | P2 |  | aucun dialogue Propriétés du tableau (largeur, alignement, habillage, ligne, colonne, cellule, texte de remplacement) |
| Alignement | Coin supérieur gauche | bouton (bascule) | Alt J L C C | Partiel | P2 |  | 3 alignements verticaux seulement (haut/milieu/bas), pas d'alignement horizontal combiné (9 positions) |
| Alignement | Au centre en haut | bouton (bascule) | Alt J L J 1 | Partiel | P2 |  | idem |
| Alignement | Coin supérieur droit | bouton (bascule) | Alt J L G O | Partiel | P2 |  | idem |
| Alignement | Au centre à gauche | bouton (bascule) | Alt J L G A | Partiel | P2 |  | idem |
| Alignement | Centrer | bouton (bascule) | Alt J L X E | Partiel | P2 |  | idem |
| Alignement | Au centre à droite | bouton (bascule) | Alt J L Ç A | Partiel | P2 |  | idem |
| Alignement | Coin inférieur gauche | bouton (bascule) | Alt J L Ù | Partiel | P2 |  | idem |
| Alignement | Au centre en bas | bouton (bascule) | Alt J L W | Partiel | P2 |  | idem |
| Alignement | Coin inférieur droit | bouton (bascule) | Alt J L 6 | Partiel | P2 |  | idem |
| Alignement | Orientation du texte | bouton | Alt J L E | Absent | P3 |  | absent |
| Alignement | Marges de la cellule... | bouton | Alt J L M | Absent | P3 |  | absent |
| Données | Données | menu / galerie | Alt J L Z D 2 | Partiel | P2 |  | Trier (SortDialog) et Répéter la ligne d'en-tête ; manque Convertir en texte, Formule |

### Onglet Format de l'image  ·  KeyTip Alt J P  ·  contextuel : Image

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Ajuster | Supprimer l’arrière-plan | bouton (bascule) | Alt ( J P ) S | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Corrections | menu / galerie | Alt ( J P ) I | Absent | P3 | Options de correction de l’image... ; Atténuer : 50 % ; Atténuer : 25 % ; Accentuer : 0 % ; Accentuer : 25 % ; Accentuer : 50 % ; Luminosité : -40 % Contraste : -40 % ; Luminosité : -20 % Contraste : -40 % ; Luminosité : 0 % (Normal) Contraste : -40 % ; Luminosité : +20 % Contraste : -40 % ; Luminosité : +40 % Contraste : -40 % ; Luminosité : -40 % Contraste : -20 % … (+19) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Couleur | menu / galerie | Alt ( J P ) U | Absent | P3 | Température : 4700 K ; Température : 5300 K ; Température : 5900 K ; Température : 6500 K ; Température : 7200 K ; Température : 8800 K ; Température : 11200 K ; Saturation : 0 % ; Saturation : 33 % ; Saturation : 66 % ; Saturation : 100 % ; Saturation : 200 % … (+26) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Effets artistiques | menu / galerie | Alt ( J P ) A 1 | Absent | P3 | Aucun ; Marque ; Crayon - Nuances de gris ; Crayon - Croquis ; Traits ; Craie - Croquis ; Coups de pinceau ; Peindre ; Éclat diffus ; Flou ; Écran clair ; Aquarelle - Éponge … (+12) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Transparence | menu / galerie | Alt ( J P ) T | Absent | P3 | Transparence : 0 % ; Transparence : 15 % ; Transparence : 30 % ; Transparence : 50 % ; Transparence : 65 % ; Transparence : 80 % ; Transparence : 95 % ; Options de transparence d’image... | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Compresser les images... | bouton | Alt ( J P ) C | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Changer d’image | menu / galerie | Alt ( J P ) E | Absent | P3 | Cet appareil... ; À partir d’images de photothèque... ; À partir de sources en ligne... ; À partir d’icônes... ; À partir du Presse-papiers... | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Ajuster | Rétablir l'image | bouton + menu | Alt ( J P ) R | Partiel | P2 | Rétablir l'image ; Rétablir la taille de l’image | « Rétablir la taille » : retire rotation, retournement, rognage |
| Styles d'image | Styles d’image (galerie) | menu / galerie |  | Absent | P3 | Cadre simple, blanc ; Mat biseauté, blanc ; Cadre métallique ; Rectangle à ombre portée ; Rectangle arrondi réfléchi ; Rectangle à bord estompé ; Cadre double, noir ; Mat épais, noir ; Cadre simple, noir ; Oval en biseau, noir ; Cadre composé, noir ; Cadre modéré, noir … (+16) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Bordure de l’image | bouton + menu | Alt ( J P ) É O | Absent | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+64) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Autres couleurs de contour... | menu / galerie | Alt ( J P ) É O T | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Épaisseur | menu / galerie | Alt ( J P ) É O S | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Croquis | menu / galerie | Alt ( J P ) É O C | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Tirets | menu / galerie | Alt ( J P ) É O R | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Effets d’image | menu / galerie | Alt ( J P ) F | Absent | P3 | Prédéfini ; Ombre ; Réflexion ; Lumière ; Bord estompé ; Biseau ; Rotation 3D | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Disposition d’image | menu / galerie | Alt ( J P ) D | Absent | P3 | Image accentuée ; Légende d’image circulaire ; Liste de légendes d'images ; Liste d’images instantanées ; Image spirale ; Images avec une légende ; Images en lacet avec légendes ; Texte semi-transparent en lacet avec image ; Blocs en lacet avec images ; Liste d’images en lacet avec légendes ; Blocs d’images avec titre ; Grille d’images … (+24) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Styles d'image | Image... | bouton | Alt ( J P ) O 1 | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Accessibilité | Texte de remplacement | bouton (bascule) | Alt ( J P ) A T | À vérifier | P2 |  | AltDialog |
| Organiser | Position | menu / galerie | Alt ( J P ) W | Partiel | P2 | Aligné sur le texte ; En haut à gauche avec habillage du texte carré ; En haut au centre avec habillage de texte carré ; En haut à droite avec habillage du texte carré ; Au milieu à gauche avec habillage du texte carré ; Au milieu au centre avec habillage du texte carré ; Au milieu à droite avec habillage du texte carré ; En bas à gauche avec habillage de texte carré ; En bas au centre avec habillage de texte carré ; En bas à droite avec habillage de texte carré ; Autres options de disposition... | alignement gauche/centre/droite seulement via menu contextuel (image flottante) |
| Organiser | Habillage | menu / galerie | Alt ( J P ) Q | OK | P1 | Aligné sur le texte ; Encadré ; Adapté ; Au travers ; Haut et bas ; Derrière le texte ; Devant le texte ; Modifier les points de l'habillage ; Déplacer avec le texte ; Corriger la position sur la page ; Autres options de disposition... ; Toujours utiliser cette disposition | test images.test « habillage : aller-retour des six modes » ; manque « Modifier les points d'habillage », « Déplacer avec le texte », « Fixer la position » |
| Organiser | Avancer | bouton + menu | Alt ( J P ) È V | Absent | P3 | Avancer ; Premier plan ; Texte en dessous | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Organiser | Reculer | bouton + menu | Alt ( J P ) 7 | Absent | P3 | Reculer ; Arrière-plan ; Texte au-dessus | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Organiser | Volet Sélection... | bouton (bascule) | Alt ( J P ) 5 | Absent | P3 |  | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Organiser | Aligner | menu / galerie | Alt ( J P ) K L | Absent | P3 | Aligner à gauche ; Centrer ; Aligner à droite ; Aligner en haut ; Aligner au milieu ; Aligner en bas ; Distribuer horizontalement ; Distribuer verticalement ; Aligner sur la page ; Aligner sur la marge ; Aligner les objets sélectionnés ; Utiliser les repères d'alignement … (+2) | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Organiser | Grouper | menu / galerie | Alt ( J P ) Ù G | Absent | P3 | Grouper ; Dissocier | absent : onglet « Format de l'image » ForgeOffice limité à 3 groupes (styles, organiser, taille) |
| Organiser | Rotation | menu / galerie | Alt ( J P ) È R | Partiel | P2 | Faire pivoter à droite de 90° ; Faire pivoter à gauche de 90° ; Retourner verticalement ; Retourner horizontalement ; Autres options de rotation... | rotation à droite de 90° + retournements + poignée de rotation (test images.test) ; manque angle numérique, rotation à gauche |
| Taille | Rogner | bouton + menu (bascule) | Alt ( J P ) O 2 | Absent | P2 | Rogner ; Rogner à la forme ; Rapport hauteur-largeur ; Remplir ; Ajuster | le modèle porte un champ crop mais aucune commande ni poignée de rognage |
| Taille | Hauteur de la forme | champ numérique | Alt ( J P ) K A | À vérifier | P1 |  | NumberField cm, proportions conservées |
| Taille | Largeur de la forme | champ numérique | Alt ( J P ) G | À vérifier | P1 |  | NumberField cm |
| Taille | Taille et position... | bouton | Alt ( J P ) B | Absent | P2 |  | entrée désactivée du menu contextuel |

### Onglet Format de forme  ·  KeyTip Alt J D  ·  contextuel : Forme et Zone de texte (même onglet)

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Insérer des formes | Insérer des formes (galerie) | menu / galerie |  | Absent | P2 | Zone de texte ; Courbe ; Flèche trait ; Rectangle ; Ellipse ; Rectangle : coins arrondis ; Triangle isocèle ; Connecteur : en angle ; Connecteur : en angle avec flèche ; Flèche : droite ; Flèche : bas ; Forme libre : forme … (+150) | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Insérer des formes | Modifier la forme | menu / galerie | Alt J D O | Absent | P2 | Modifier la forme ; Modifier les points ; Rediriger les connecteurs | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Insérer des formes | Dessiner une zone de texte | bouton | Alt J D N | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Styles de formes (galerie) | menu / galerie |  | Absent | P2 | Tous ; Filtre de galerie ; Contour couleur - Noir, 1 foncé ; Contour couleur - Bleu-vert foncé, 1 accentué ; Contour couleur - Orange, 2 accentué ; Contour couleur - Vert foncé, 3 accentué ; Contour couleur - Turquoise, 4 accentué ; Contour couleur - Prune, 5 accentué ; Contour couleur - Vert, 6 accentué ; Remplissage couleur - Noir, 1 foncé ; Remplissage couleur - Bleu-vert foncé, 1 accentué ; Remplissage couleur - Orange, 2 accentué … (+68) | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Autres thèmes de remplissage | menu / galerie | Alt J D H T A | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Remplissage | bouton + menu | Alt J D È E | Absent | P2 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+64) | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Contour | bouton + menu | Alt J D É O | Absent | P2 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+65) | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Effets | menu / galerie | Alt J D Ù F | Absent | P2 | Prédéfini ; Ombre ; Réflexion ; Lumière ; Bordures adoucies ; Biseau ; Rotation 3D | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles de formes | Mise en forme de l’objet... | bouton | Alt J D H M | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Styles rapides | menu / galerie | Alt J D S T | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Remplissage du texte | bouton + menu | Alt J D S R | Absent | P2 | Contraste élevé uniquement ; Autres couleurs... ; Dégradé | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Autres couleurs... | menu / galerie | Alt J D S R L | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Contour du texte | bouton + menu | Alt J D X C | Absent | P2 | Contraste élevé uniquement ; Autres couleurs de contour... ; Épaisseur ; Tirets | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Autres couleurs de contour... | menu / galerie | Alt J D X C U | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Effets de texte | menu / galerie | Alt J D F | Absent | P2 | Ombre ; Reflet ; Éclat ; Biseau ; Rotation 3D ; Transformer | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Styles WordArt | Mise en forme des effets de texte... | bouton | Alt J D E F | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Texte | Orientation du texte | menu / galerie | Alt J D T | Absent | P2 | Options d'orientation de texte... | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Texte | Aligner le texte | menu / galerie | Alt J D A 1 | Absent | P2 | Haut ; Milieu ; Bas | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Texte | Créer un lien | bouton | Alt J D C | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Accessibilité | Texte de remplacement | bouton (bascule) | Alt J D A T | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Position | menu / galerie | Alt J D W | Absent | P2 | Aligné sur le texte ; En haut à gauche avec habillage du texte carré ; En haut au centre avec habillage de texte carré ; En haut à droite avec habillage du texte carré ; Au milieu à gauche avec habillage du texte carré ; Au milieu au centre avec habillage du texte carré ; Au milieu à droite avec habillage du texte carré ; En bas à gauche avec habillage de texte carré ; En bas au centre avec habillage de texte carré ; En bas à droite avec habillage de texte carré ; Autres options de disposition... | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Habillage | menu / galerie | Alt J D Q | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Avancer | bouton + menu | Alt J D È V | Absent | P2 | Avancer ; Premier plan ; Texte en dessous | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Reculer | bouton + menu | Alt J D 7 | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Volet Sélection... | bouton (bascule) | Alt J D 5 | Partiel | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés ; 2026-11-07 : onglet Format de forme + volet Sélection (liste, sélection, ordre) prouvés |
| Organiser | Aligner | menu / galerie | Alt J D K L | Absent | P2 | Aligner à gauche ; Centrer ; Aligner à droite ; Aligner en haut ; Aligner au milieu ; Aligner en bas ; Distribuer horizontalement ; Distribuer verticalement ; Aligner sur la page ; Aligner sur la marge ; Aligner les objets sélectionnés ; Utiliser les repères d'alignement … (+2) | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Grouper | menu / galerie | Alt J D Ù G | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Organiser | Rotation | menu / galerie | Alt J D È R | Absent | P2 | Faire pivoter à droite de 90° | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Taille | Hauteur de la forme | champ numérique | Alt J D K A | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Taille | Largeur de la forme | champ numérique | Alt J D G | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |
| Taille | Taille et position... | bouton | Alt J D B | Absent | P2 |  | ForgeOffice n'a PAS d'onglet « Format de forme » : les formes sont insérées en ligne (ribbon/insert.tsx), sans sélection, poignées ni propriétés |

### Onglet Conception de SmartArt  ·  KeyTip Alt J S  ·  contextuel : SmartArt

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Créer un graphique | Ajouter une forme | bouton + menu | Alt J S T | Absent | P3 | Ajouter la forme après ; Ajouter la forme avant ; Ajouter la forme au-dessus ; Ajouter la forme en dessous ; Ajouter assistant(e) | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Ajouter une puce | bouton | Alt J S U | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Volet Texte | bouton (bascule) | Alt J S X | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Promouvoir | bouton | Alt J S P | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Abaisser | bouton | Alt J S A 1 | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | De droite à gauche | bouton (bascule) | Alt J S E | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Déplacer avant | bouton | Alt J S M 1 | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Déplacer après | bouton | Alt J S A 2 | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Créer un graphique | Disposition | menu / galerie | Alt J S N | Absent | P3 | Standard ; Les deux ; Retrait à gauche ; Retrait à droite | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Dispositions | Dispositions SmartArt (galerie) | menu / galerie |  | Absent | P3 | Liste de blocs simple ; Hexagones alternés ; Liste de légendes d'images ; Liste alignée ; Liste à puces verticale ; Zone de liste verticale ; Liste à puces horizontale ; Liste accentuée avec carrés ; Liste accentuée avec images ; Liste accentuée en lacet avec images ; Liste empilée ; Liste d’actions verticale … (+26) | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Dispositions | Autres dispositions... | menu / galerie | Alt J S M 2 A | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Styles SmartArt | Modifier les couleurs | menu / galerie | Alt J S I | Absent | P3 | Contour foncé 1 ; Contour foncé 2 ; Remplissage foncé 2 ; Coloré - Couleurs vives ; Coloré - Couleurs vives 2 à 3 ; Coloré - Couleurs vives 3 à 4 ; Coloré - Couleurs vives 4 à 5 ; Coloré - Couleurs vives 5 à 6 ; Accentuation 1 - Contour ; Accentuation 1 - Couleur unie ; Accentuation 1 - Dégradé vertical ; Accentuation 1 - Dégradé irradiant … (+31) | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Styles SmartArt | Styles SmartArt (galerie) | menu / galerie |  | Absent | P3 | Remplissage simple ; Contour blanc ; Effet discret ; Effet moyen ; Effet intense ; Poli ; Encastré ; Dessin animé ; Poudre ; Briques ; Plat ; Métallique … (+2) | SmartArt non pris en charge (pas d'insertion, ni d'édition) |
| Rétablir | Rétablir le graphique | bouton | Alt J S R | Absent | P3 |  | SmartArt non pris en charge (pas d'insertion, ni d'édition) |

### Onglet Mise en forme (SmartArt)  ·  KeyTip Alt J M  ·  contextuel : SmartArt

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Formes | Modifier en 2D | bouton (bascule) | Alt J M M | Absent | P3 |  | SmartArt non pris en charge |
| Formes | Modifier la forme | menu / galerie | Alt J M U | Absent | P3 | Rectangle ; Rectangle : coins arrondis ; Ellipse ; Rectangle : avec coin rogné ; Rectangle : avec coins rognés en haut ; Rectangle : avec coins rognés en diagonale ; Rectangle : avec coin arrondi et coin rogné en haut ; Rectangle : avec coin arrondi ; Rectangle : avec coins arrondis en haut ; Rectangle : avec coins arrondis en diagonale ; Triangle isocèle ; Triangle rectangle … (+131) | SmartArt non pris en charge |
| Formes | Plus grand | bouton | Alt J M L | Absent | P3 |  | SmartArt non pris en charge |
| Formes | Plus petit | bouton | Alt J M P | Absent | P3 |  | SmartArt non pris en charge |
| Styles de formes | Styles de formes (galerie) | menu / galerie |  | Absent | P3 | Contour couleur - Noir, 1 foncé ; Contour couleur - Bleu-vert foncé, 1 accentué ; Contour couleur - Orange, 2 accentué ; Contour couleur - Vert foncé, 3 accentué ; Contour couleur - Turquoise, 4 accentué ; Contour couleur - Prune, 5 accentué ; Contour couleur - Vert, 6 accentué ; Remplissage couleur - Noir, 1 foncé ; Remplissage couleur - Bleu-vert foncé, 1 accentué ; Remplissage couleur - Orange, 2 accentué ; Remplissage couleur - Vert foncé, 3 accentué ; Remplissage couleur - Turquoise, 4 accentué … (+30) | SmartArt non pris en charge |
| Styles de formes | Remplissage | bouton + menu | Alt J M È E | Absent | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+64) | SmartArt non pris en charge |
| Styles de formes | Contour | bouton + menu | Alt J M É O | Absent | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+65) | SmartArt non pris en charge |
| Styles de formes | Effets | menu / galerie | Alt J M Ù F | Absent | P3 | Prédéfini ; Ombre ; Réflexion ; Lumière ; Bordures adoucies ; Biseau ; Rotation 3D | SmartArt non pris en charge |
| Styles de formes | Mise en forme de l’objet... | bouton | Alt J M H M | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Styles WordArt (galerie) | menu / galerie |  | Absent | P3 | Remplissage : Noir, Couleur de texte 1 ; Ombre ; Remplissage : Bleu-vert foncé, Couleur d’accentuation 1 ; Ombre ; Remplissage : Orange, Couleur d’accentuation 2 ; Contour : Orange, Couleur d’accentuation 2 ; Remplissage : Blanc ; Contour : Prune, Couleur d’accentuation 5 ; Ombre ; Remplissage : Turquoise, Couleur d’accentuation 4 ; Biseau souple ; Remplissage dégradé, Gris ; Remplissage dégradé : Prune, Couleur d’accentuation 5 ; Réflexion ; Remplissage dégradé : Turquoise, Couleur d’accentuation 4 ; Contour : Turquoise, Couleur d’accentuation 4 ; Remplissage : Blanc ; Contour : Bleu-vert foncé, Couleur d’accentuation 1 ; Lumière : Bleu-vert foncé, Couleur d’accentuation 1 ; Remplissage : Vert foncé, Couleur d’accentuation 3 ; Biseau net ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Blanc, Couleur d’arrière-plan 1 ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Prune, Couleur d’accentuation 5 … (+3) | SmartArt non pris en charge |
| Styles WordArt | Remplissage du texte | bouton + menu | Alt J M S R | Absent | P3 | Contraste élevé uniquement ; Automatique ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 … (+56) | SmartArt non pris en charge |
| Styles WordArt | Contour du texte | bouton + menu | Alt J M X C | Absent | P3 | Contraste élevé uniquement ; Automatique ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 … (+64) | SmartArt non pris en charge |
| Styles WordArt | Effets de texte | menu / galerie | Alt J M F | Absent | P3 | Ombre ; Reflet ; Éclat ; Biseau ; Rotation 3D ; Transformer | SmartArt non pris en charge |
| Styles WordArt | Mise en forme des effets de texte... | bouton | Alt J M E F | Absent | P3 |  | SmartArt non pris en charge |
| Accessibilité | Texte de remplacement | bouton (bascule) | Alt J M A T | Absent | P3 |  | SmartArt non pris en charge |
| Organiser | Organiser | menu / galerie | Alt J M Z A | Absent | P3 |  | SmartArt non pris en charge |
| Taille | Taille | menu / galerie | Alt J M Z Z | Absent | P3 |  | SmartArt non pris en charge |

### Onglet En-tête et pied de page  ·  KeyTip Alt J B  ·  contextuel : En-tête / pied de page (en édition)

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| En-tête et pied de page | En-tête | menu / galerie | Alt J B T | Partiel | P1 | Vide ; Vide (3 colonnes) ; À bandes ; Austin ; Guide (page impaire) ; Guide (page paire) ; Ligne latérale ; Quadrillage ; Whisp ; Facette (page impaire) ; Facette (page paire) ; Filigrane … (+16) | via Insertion > En-tête |
| En-tête et pied de page | Pied de page | menu / galerie | Alt J B I | Partiel | P1 | Vide ; Vide (3 colonnes) ; À bandes ; Austin ; Guide (page impaire) ; Guide (page paire) ; Lignes latérales ; Quadrillage ; Whisp ; AffichageMaître (horizontal) ; AffichageMaître (vertical) ; Facette (page impaire) … (+5) | via Insertion > Pied de page |
| En-tête et pied de page | Numéro de page | menu / galerie | Alt J B J | Partiel | P1 |  | via Insertion > Numéro de page |
| Insérer | Date et heure... | bouton | Alt J B È D | Partiel | P2 |  | DateDialog accessible dans le corps ; insertion dans l'en-tête non prouvée |
| Insérer | Descriptif du document | menu / galerie | Alt J B C | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Insérer | QuickPart | menu / galerie | Alt J B U | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Insérer | Images... | bouton | Alt J B E M | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Insérer | Images en ligne | bouton | Alt J B F 1 | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Navigation | Atteindre l'en-tête | bouton | Alt J B Ç | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Navigation | Atteindre le pied de page | bouton | Alt J B B | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Navigation | Précédent | bouton | Alt J B P | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Navigation | Suivant | bouton | Alt J B S | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Navigation | Lier au précédent | bouton (bascule) | Alt J B L | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Options | Première page différente | case à cocher (bascule) | Alt J B R | Partiel | P1 |  | sections.titlePage rendue (PageView refFor) mais aucune commande pour l'activer |
| Options | Pages paires et impaires différentes | case à cocher (bascule) | Alt J B G | Partiel | P1 |  | settings.evenAndOddHeaders rendu mais aucune commande |
| Options | Afficher le texte du document | case à cocher (bascule) | Alt J B A | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Position | Position de l'en-tête à partir du haut | champ numérique | Alt J B À | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Position | Position de l'en-tête à partir du bas | champ numérique | Alt J B D | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Position | Insérer une tabulation d’alignement | bouton | Alt J B É | Absent | P2 |  | ForgeOffice n'a pas d'onglet contextuel En-tête et pied de page : édition par double-clic (App.tsx hfEdit) + bouton « Fermer l'en-tête » |
| Fermeture | Fermer l'en-tête et le pied de page | bouton | Alt J B F 2 | À vérifier | P1 |  | bouton fo-word-hfclose + Échap |

### Onglet Equation  ·  KeyTip Alt J E  ·  contextuel : Équation

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Outils | Équation | menu / galerie | Alt J E Q Q | Absent | P2 | Développement de Taylor ; Élévation d’une somme ; Formule du binôme ; Formule quadratique ; Identité trigonométrique 1 ; Identité trigonométrique 2 ; Série de Fourier ; Surface du cercle ; Théorème de Pythagore ; Ligne vers le haut ; Page précédente ; Page suivante … (+3) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Outils | Équation manuscrite | bouton | Alt J E É | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Conversions | Unicode | bouton (bascule) | Alt J E U F | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Conversions | LaTeX | bouton (bascule) | Alt J E T X | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Conversions | Texte | bouton (bascule) | Alt J E E | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Conversions | Convertir | bouton + menu (bascule) | Alt J E C 1 | Absent | P2 | Actuelle - Professionnel ; Actuelle - Linéaire ; Toutes - Professionnel ; Toutes - Linéaire | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Conversions | Options des équations... | bouton | Alt J E O | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Symboles | Fonction mathématique de base | menu / galerie |  | Absent | P2 |  | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Fraction | menu / galerie | Alt J E F | Absent | P2 | Structure d'équation Fraction sur deux lignes ; Structure d'équation Fraction oblique ; Structure d'équation Fraction sur une ligne ; Structure d'équation Petite fraction ; Structure d'équation dy sur dx ; Structure d'équation cap delta y sur cap delta x ; Structure d'équation partielle y sur partielle x ; Structure d'équation y delta sur delta x ; Structure d'équation pi sur 2 | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Notation | menu / galerie | Alt J E C 2 | Absent | P2 | Structure d'équation Exposant ; Structure d'équation Indice ; Structure d'équation Indice-Exposant ; Structure d'équation Indice-Exposant gauche ; Structure d'équation x indice y au carré ; Structure d'équation e au i négatif oméga t ; Structure d'équation x au carré ; Structure d'équation Y exposant gauche n indice gauche un | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Radical | menu / galerie | Alt J E R | Absent | P2 | Structure d'équation Racine carrée ; Structure d'équation Radical avec degré ; Structure d'équation Racine carrée avec degré ; Structure d'équation Racine cubique ; Structure d'équation Côté droit de la formule quadratique ; Structure d'équation Racine carrée de a au carré plus b au carré | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Intégrale | menu / galerie | Alt J E N | Absent | P2 | Structure d'équation Intégrale ; Structure d'équation Intégrale avec limites ; Structure d'équation Intégrale avec limites empilées ; Structure d'équation Double intégrale ; Structure d'équation Intégrale double avec limites ; Structure d'équation Intégrale double avec limites empilées ; Structure d'équation Triple intégrale ; Structure d'équation Intégrale triple avec limites ; Structure d'équation Intégrale triple avec limites empilées ; Structure d'équation Intégrale de contour ; Structure d'équation Intégrale de contour avec limites ; Structure d'équation Intégrale de contour avec limites empilées … (+13) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Grand opérateur | menu / galerie | Alt J E G | Absent | P2 | Structure d'équation Somme ; Structure d'équation Somme avec limites ; Structure d'équation Somme avec limites en indice/exposant ; Structure d'équation Somme avec limite inférieure ; Structure d'équation Somme avec limite inférieure en indice ; Structure d'équation Produit ; Structure d'équation Produit avec limites ; Structure d'équation Produit avec limites en indice/exposant ; Structure d'équation Produit avec limite inférieure ; Structure d'équation Produit avec limite inférieure en indice ; Structure d'équation Coproduit ; Structure d'équation Coproduit avec limites … (+32) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Crochet | menu / galerie | Alt J E H | Absent | P2 | Structure d'équation Parenthèses ; Structure d'équation Crochets ; Structure d'équation Accolades ; Structure d'équation Crochets pointus ; Structure d'équation Valeur plancher (demi-crochets) ; Structure d'équation Valeur plafond (coins de Quine) ; Structure d'équation Barres verticales ; Structure d'équation Barres verticales doubles ; Structure d'équation Espace réservé entre deux crochets gauches ; Structure d'équation Espace réservé entre deux crochets droits ; Structure d'équation Crochets inversés ; Structure d'équation Crochets doubles … (+33) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Fonction | menu / galerie | Alt J E T 1 | Absent | P2 | Structure d'équation Fonction sinus ; Structure d'équation Fonction cosinus ; Structure d'équation Fonction tangente ; Structure d'équation Fonction cosécante ; Structure d'équation Fonction sécante ; Structure d'équation Fonction cotangente ; Structure d'équation Fonction sinus inverse ; Structure d'équation Fonction cosinus inverse ; Structure d'équation Fonction tangente inverse ; Structure d'équation Fonction cosécante inverse ; Structure d'équation Fonction sécante inverse ; Structure d'équation Fonction cotangente inverse … (+19) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Accentuation | menu / galerie | Alt J E U 1 | Absent | P2 | Structure d'équation Point ; Structure d'équation Double point ; Structure d'équation Triple point ; Structure d'équation Circonflexe ; Structure d'équation Caron ; Structure d'équation Aigu ; Structure d'équation Grave ; Structure d'équation Brève ; Structure d'équation Tilde ; Structure d'équation Barre ; Structure d'équation Barre supérieure double ; Structure d'équation Accolade supérieure … (+19) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Limite et logarithme | menu / galerie | Alt J E L | Absent | P2 | Structure d'équation Logarithme avec base vide ; Structure d'équation Logarithme sans base ; Structure d'équation Limite ; Structure d'équation Minimum ; Structure d'équation Maximum ; Structure d'équation Logarithme naturel ; Structure d'équation Exemple de limite ; Structure d'équation Exemple de maximum | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Opérateur | menu / galerie | Alt J E A | Absent | P2 | Structure d'équation Deux-points Égal ; Structure d'équation Égal Égal ; Structure d'équation Plus Égal ; Structure d'équation Moins Égal ; Structure d'équation Égal par définition à ; Structure d'équation Mesuré(e) par ; Structure d'équation Delta égal à ; Structure d'équation Flèche vers la gauche au-dessus ; Structure d'équation Flèche vers la droite au-dessus ; Structure d'équation Flèche vers la gauche en dessous ; Structure d'équation Flèche vers la droite en dessous ; Structure d'équation Flèche double vers la gauche au-dessus … (+9) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |
| Structures | Matrice | menu / galerie | Alt J E M | Absent | P2 | Structure d'équation Matrice vide 1x2 ; Structure d'équation Matrice vide 2x1 ; Structure d'équation Matrice vide 1x3 ; Structure d'équation Matrice vide 3x1 ; Structure d'équation Matrice vide 2x2 ; Structure d'équation Matrice vide 2x3 ; Structure d'équation Matrice vide 3x2 ; Structure d'équation Matrice vide 3x3 ; Structure d'équation Points d'interligne ; Structure d'équation Points de ligne de base ; Structure d'équation Points verticaux ; Structure d'équation Points diagonaux … (+10) | ForgeOffice n'a pas d'onglet Équation : l'équation est un objet atomique saisi en forme linéaire (EquationDialog) |

### Onglet Création de graphique  ·  KeyTip Alt J C  ·  contextuel : Graphique

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Dispositions du graphique | Ajouter un élément graphique | menu / galerie | Alt J C U | Absent | P2 | Axes ; Titres des axes ; Titre du graphique ; Étiquettes de données ; Table de données ; Barres d’erreur ; Quadrillage ; Légende ; Lignes ; Courbe de tendance ; Barres Haut/Bas | graphique non pris en charge |
| Dispositions du graphique | Disposition rapide | menu / galerie | Alt J C D | Absent | P2 | Disposition 1 ; Disposition 2 ; Disposition 3 ; Disposition 4 ; Disposition 5 ; Disposition 6 ; Disposition 7 ; Disposition 8 ; Disposition 9 ; Disposition 10 ; Disposition 11 | graphique non pris en charge |
| Styles du graphique | Modifier les couleurs | menu / galerie | Alt J C M | Absent | P2 | Palette de couleurs 1 ; Palette de couleurs 2 ; Palette de couleurs 3 ; Palette de couleurs 4 ; Palette monochrome 1 ; Palette monochrome 2 ; Palette monochrome 3 ; Palette monochrome 4 ; Palette monochrome 5 ; Palette monochrome 6 ; Palette monochrome 7 ; Palette monochrome 8 … (+9) | graphique non pris en charge |
| Données | Intervertir ligne/colonne | bouton | Alt J C I | Absent | P2 |  | graphique non pris en charge |
| Données | Sélectionner des données... | bouton | Alt J C S | Absent | P2 |  | graphique non pris en charge |
| Données | Modifier les données | bouton + menu | Alt J C F | Absent | P2 | Modifier les données ; Modifier les données dans Excel | graphique non pris en charge |
| Données | Actualiser les données | bouton | Alt J C A | Absent | P2 |  | graphique non pris en charge |
| Type | Modifier le type de graphique... | bouton | Alt J C O | Absent | P2 |  | graphique non pris en charge |

### Onglet Mise en forme (graphique)  ·  KeyTip Alt J S  ·  contextuel : Graphique

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Sélection active | Éléments de graphique | liste déroulante | Alt J S L | Absent | P3 |  | SmartArt non pris en charge |
| Sélection active | Mise en forme de la sélection | bouton | Alt J S M | Absent | P3 |  | SmartArt non pris en charge |
| Sélection active | Rétablir le style d'origine | bouton | Alt J S À | Absent | P3 |  | SmartArt non pris en charge |
| Insérer des formes | Insérer des formes (galerie) | menu / galerie |  | Absent | P3 | Zone de texte ; Courbe ; Flèche trait ; Rectangle ; Ellipse ; Rectangle : coins arrondis ; Triangle isocèle ; Connecteur : en angle ; Connecteur : en angle avec flèche ; Flèche : droite ; Flèche : bas ; Forme libre : forme … (+150) | SmartArt non pris en charge |
| Insérer des formes | Modifier la forme | menu / galerie | Alt J S U | Absent | P3 | Rectangle ; Rectangle : coins arrondis ; Ellipse ; Rectangle : avec coin rogné ; Rectangle : avec coins rognés en haut ; Rectangle : avec coins rognés en diagonale ; Rectangle : avec coin arrondi et coin rogné en haut ; Rectangle : avec coin arrondi ; Rectangle : avec coins arrondis en haut ; Rectangle : avec coins arrondis en diagonale ; Triangle isocèle ; Triangle rectangle … (+131) | SmartArt non pris en charge |
| Styles de forme | Styles de formes (galerie) | menu / galerie |  | Absent | P3 | Tous ; Filtre de galerie ; Contour couleur - Noir, 1 foncé ; Contour couleur - Bleu-vert foncé, 1 accentué ; Contour couleur - Orange, 2 accentué ; Contour couleur - Vert foncé, 3 accentué ; Contour couleur - Turquoise, 4 accentué ; Contour couleur - Prune, 5 accentué ; Contour couleur - Vert, 6 accentué ; Remplissage couleur - Noir, 1 foncé ; Remplissage couleur - Bleu-vert foncé, 1 accentué ; Remplissage couleur - Orange, 2 accentué … (+67) | SmartArt non pris en charge |
| Styles de forme | Remplissage | bouton + menu | Alt J S È E | Absent | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+64) | SmartArt non pris en charge |
| Styles de forme | Autres couleurs de remplissage... | menu / galerie | Alt J S È E U | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Image... | menu / galerie | Alt J S È E A | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Dégradé | menu / galerie | Alt J S È E D | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Texture | menu / galerie | Alt J S È E X | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Contour | bouton + menu | Alt J S É O | Absent | P3 | Contraste élevé uniquement ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 ; Blanc, Arrière-plan 1, plus sombre 5 % … (+64) | SmartArt non pris en charge |
| Styles de forme | Autres couleurs de contour... | menu / galerie | Alt J S É O T | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Épaisseur | menu / galerie | Alt J S É O S | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Tirets | menu / galerie | Alt J S É O R | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Flèches | menu / galerie |  | Absent | P3 |  | SmartArt non pris en charge |
| Styles de forme | Effets | menu / galerie | Alt J S Ù F | Absent | P3 | Prédéfini ; Ombre ; Réflexion ; Lumière ; Bordures adoucies ; Biseau ; Rotation 3D | SmartArt non pris en charge |
| Styles de forme | Mise en forme de l’objet... | bouton | Alt J S H M | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Styles rapides | menu / galerie | Alt J S S T | Absent | P3 | Remplissage : Noir, Couleur de texte 1 ; Ombre ; Remplissage : Bleu-vert foncé, Couleur d’accentuation 1 ; Ombre ; Remplissage : Orange, Couleur d’accentuation 2 ; Contour : Orange, Couleur d’accentuation 2 ; Remplissage : Blanc ; Contour : Prune, Couleur d’accentuation 5 ; Ombre ; Remplissage : Turquoise, Couleur d’accentuation 4 ; Biseau souple ; Remplissage dégradé, Gris ; Remplissage dégradé : Prune, Couleur d’accentuation 5 ; Réflexion ; Remplissage dégradé : Turquoise, Couleur d’accentuation 4 ; Contour : Turquoise, Couleur d’accentuation 4 ; Remplissage : Blanc ; Contour : Bleu-vert foncé, Couleur d’accentuation 1 ; Lumière : Bleu-vert foncé, Couleur d’accentuation 1 ; Remplissage : Vert foncé, Couleur d’accentuation 3 ; Biseau net ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Blanc, Couleur d’arrière-plan 1 ; Remplissage : Noir, Couleur de texte 1 ; Contour : Blanc, Couleur d’arrière-plan 1 ; Ombre marquée : Prune, Couleur d’accentuation 5 … (+3) | SmartArt non pris en charge |
| Styles WordArt | Remplissage du texte | bouton + menu | Alt J S S R | Absent | P3 | Contraste élevé uniquement ; Automatique ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 … (+65) | SmartArt non pris en charge |
| Styles WordArt | Autres couleurs... | menu / galerie | Alt J S S R L | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Image... | menu / galerie | Alt J S S R I | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Dégradé | menu / galerie | Alt J S S R R | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Texture | menu / galerie | Alt J S S R T | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Contour du texte | bouton + menu | Alt J S X C | Absent | P3 | Contraste élevé uniquement ; Automatique ; Blanc, Arrière-plan 1 ; Noir, Texte 1 ; Gris clair, Arrière-plan 2 ; Bleu foncé, Texte 2 ; Bleu-vert foncé, Accentuation1 ; Orange, Accentuation2 ; Vert foncé, Accentuation3 ; Turquoise, Accentuation4 ; Prune, Accentuation5 ; Vert, Accentuation6 … (+64) | SmartArt non pris en charge |
| Styles WordArt | Autres couleurs de contour... | menu / galerie | Alt J S X C U | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Épaisseur | menu / galerie | Alt J S X C I | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Tirets | menu / galerie | Alt J S X C R | Absent | P3 |  | SmartArt non pris en charge |
| Styles WordArt | Effets de texte | menu / galerie | Alt J S F | Absent | P3 | Ombre ; Reflet ; Éclat ; Biseau ; Rotation 3D ; Transformer | SmartArt non pris en charge |
| Styles WordArt | Mise en forme des effets de texte... | bouton | Alt J S E F | Absent | P3 |  | SmartArt non pris en charge |
| Accessibilité | Texte de remplacement | bouton (bascule) | Alt J S A T | Absent | P3 |  | SmartArt non pris en charge |
| Organiser | Position | menu / galerie | Alt J S W | Absent | P3 | Aligné sur le texte ; En haut à gauche avec habillage du texte carré ; En haut au centre avec habillage de texte carré ; En haut à droite avec habillage du texte carré ; Au milieu à gauche avec habillage du texte carré ; Au milieu au centre avec habillage du texte carré ; Au milieu à droite avec habillage du texte carré ; En bas à gauche avec habillage de texte carré ; En bas au centre avec habillage de texte carré ; En bas à droite avec habillage de texte carré ; Autres options de disposition... | SmartArt non pris en charge |
| Organiser | Habillage | menu / galerie | Alt J S Q | Absent | P3 | Aligné sur le texte ; Encadré ; Adapté ; Au travers ; Haut et bas ; Derrière le texte ; Devant le texte ; Modifier les points de l'habillage ; Déplacer avec le texte ; Corriger la position sur la page ; Autres options de disposition... ; Toujours utiliser cette disposition | SmartArt non pris en charge |
| Organiser | Avancer | bouton + menu | Alt J S È V | Absent | P3 | Avancer ; Premier plan ; Texte en dessous | SmartArt non pris en charge |
| Organiser | Reculer | bouton + menu | Alt J S 7 | Absent | P3 | Reculer ; Arrière-plan ; Texte au-dessus | SmartArt non pris en charge |
| Organiser | Volet Sélection... | bouton (bascule) | Alt J S 5 | Absent | P3 |  | SmartArt non pris en charge |
| Organiser | Aligner | menu / galerie | Alt J S K L | Absent | P3 | Aligner à gauche ; Centrer ; Aligner à droite ; Aligner en haut ; Aligner au milieu ; Aligner en bas ; Distribuer horizontalement ; Distribuer verticalement ; Aligner sur la page ; Aligner sur la marge ; Aligner les objets sélectionnés ; Utiliser les repères d'alignement … (+2) | SmartArt non pris en charge |
| Organiser | Grouper | menu / galerie | Alt J S Ù G | Absent | P3 | Grouper ; Dissocier | SmartArt non pris en charge |
| Organiser | Rotation | menu / galerie | Alt J S È R | Absent | P3 | Faire pivoter à droite de 90° ; Faire pivoter à gauche de 90° ; Retourner verticalement ; Retourner horizontalement ; Autres options de rotation... | SmartArt non pris en charge |
| Taille | Hauteur de la forme | champ numérique | Alt J S K A | Absent | P3 |  | SmartArt non pris en charge |
| Taille | Largeur de la forme | champ numérique | Alt J S G | Absent | P3 |  | SmartArt non pris en charge |
| Taille | Taille et position... | bouton | Alt J S B | Absent | P3 |  | SmartArt non pris en charge |

### Mode Plan (contextuel ForgeOffice / Word : onglet « Plan » de la vue Plan)

| Groupe | Commande | Type | KeyTip / raccourci | Statut | Prio | Contenu du menu (vrai Word) | Note ForgeOffice |
|---|---|---|---|---|---|---|---|
| Outils du mode Plan | Hausser / Abaisser / Corps de texte / Afficher le niveau / Développer / Réduire / Monter / Descendre / Afficher la mise en forme / Afficher la première ligne uniquement (source : connaissance) | boutons | Alt J O… | Partiel | P2 |  | `ribbon/contextual.ts` outlineTab : hausser, abaisser, corps de texte, niveau affiché, fermer ; manque Développer/Réduire, Monter/Descendre, mise en forme du plan, documents maîtres |

### Extras ForgeOffice dans le ruban


| Groupe | Commande | Type | KeyTip / Raccourci | Statut | Prio | Contenu / note |
|---|---|---|---|---|---|---|
| Affichage > Plus que Word | Minuteur de lecture | bascule | | Extra | 3 | `ribbon/review.ts` viewTab |
| Affichage > Plus que Word | Défilement machine à écrire | bascule | | Extra | 3 | |
| Affichage > Plus que Word | Exporter en Markdown / en HTML | boutons | | Extra | 3 | |
| Révision > Vérification | Statistiques avancées (lisibilité, temps de lecture, mots fréquents) | bascule | | Extra | 3 | volet `stats` |
| Insertion > Texte | Champ… (DATE, TIME, PAGE, NUMPAGES, AUTHOR, TITLE, FILENAME) | bouton | | Extra | 3 | équivalent de QuickPart > Champ… |
| Fichier > Options | Curseur personnalisable (épaisseur, couleur, clignotement) | réglage | | Extra | 3 | `CaretOverlay.tsx`, en cours d'ajout |
| Fichier > Options | Mini-barre activable | réglage | | Extra | 3 | `ui.miniBar` |


## 2. Menus contextuels (clic droit)
Sources : l'EXISTENCE des entrées est vérifiée sur le vrai Word 365 (`Application.CommandBars`, popups « Text », « Spelling », « Table Text », « Whole Table », « Inline Picture », « Floating Picture », « Shapes », « Footnotes », « Fields », « Comment », « Track Changes », « Lists », « Hyperlink Context Menu »…, 229 barres dont 80 menus contextuels, dump complet conservé dans le dossier de travail de l'audit). Ce dump est un SURENSEMBLE (il contient aussi les entrées conditionnelles : Copilot, cloud, signature…). **L'ORDRE d'affichage et la visibilité selon le contexte viennent de ma connaissance de Word (source : connaissance)**, car un vrai clic droit n'a pas été simulé (règle : pas de souris réelle). Statuts ForgeOffice lus dans `packages/word/src/ui/editorMenu.ts` (+ `tests/context-menu.test.ts`, qui prouve la présence/l'ordre des entrées, pas leur effet).

### 2.1 Texte sélectionné (menu « Texte »)

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Mini-barre de mise en forme (au-dessus du menu) | voir section 3 | Partiel | P1 | `ui/miniBar.ts` + `MiniToolbar` : en cours d'ajout par une autre session |
| Couper | Ctrl+X | À vérifier | P1 | `editorMenu.ts` clipboardItems (grisé sans sélection : test) |
| Copier | Ctrl+C | À vérifier | P1 | idem |
| Options de collage | Conserver la mise en forme source ; Fusionner la mise en forme ; Image ; Conserver uniquement le texte (icônes) | Partiel | P1 | 3 entrées de texte (source, texte, Collage spécial…) ; pas Fusionner ni Image ; présentées en sous-menu au lieu d'icônes |
| Coller (Ctrl+V) en entrée directe |  | Absent | P2 | uniquement via le sous-menu |
| Recherche intelligente / Rechercher « mot » | volet de recherche | À vérifier | P3 | `Rechercher « mot »` ouvre le volet Navigation |
| Synonymes | liste de synonymes + Dictionnaire des synonymes… | Partiel | P2 | entrée présente mais vide : « Aucun synonyme disponible hors connexion » |
| Lecture à voix haute | Alt+Ctrl+Espace | Absent | P3 |  |
| Traduire | volet de traduction | Absent | P3 | entrée « Traduire (bientôt) » grisée |
| Police… | Ctrl+D | À vérifier | P1 | FontDialog |
| Paragraphe… |  | À vérifier | P1 | ParagraphDialog |
| Puces | bibliothèque de puces | Partiel | P1 | applique une puce directe, sans sous-menu de bibliothèque |
| Numérotation | bibliothèque de numérotation | Partiel | P1 | applique « 1. » directement, sans bibliothèque |
| Styles | galerie des styles | À vérifier | P1 | sous-menu de 16 styles rapides |
| Lien hypertexte… | Ctrl+K | À vérifier | P1 | LinkDialog |
| Nouveau commentaire | Ctrl+Alt+M | À vérifier | P1 | act.insertComment |
| Rechercher… |  | À vérifier | P2 |  |
| Langue | Définir la langue de vérification… | Partiel | P2 | sous-menu des langues du paragraphe ; pas de dialogue |
| Sélectionner | Tout ; Paragraphe ; Mot… | Extra | P3 | extension ForgeOffice (Word n'a pas cette entrée dans « Texte ») |
| Réécrire / Résumer / Expliquer (Copilot) |  | Absent | P3 | hors périmètre (service cloud) |
| Qui est-ce… / Gens près de moi / carte de visite |  | Absent | P3 | hors périmètre (compte Microsoft) |
| Bloquer les auteurs | co-édition | Absent | P3 | hors périmètre (pas de co-édition) |
| Actions supplémentaires |  | Absent | P3 | hors périmètre |

### 2.2 Clic droit sans sélection (curseur dans le texte)

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Mini-barre |  | Partiel | P1 | idem 2.1 (en cours) |
| Couper / Copier (grisés), Options de collage |  | À vérifier | P1 | `disabled: !has` testé |
| Police…, Paragraphe…, Puces, Numérotation, Styles, Lien hypertexte…, Nouveau commentaire |  | À vérifier | P1 | mêmes entrées que 2.1 |
| Synonymes, Lecture à voix haute, Traduire |  | Partiel | P3 | voir 2.1 |

### 2.3 Mot mal orthographié (menu « Orthographe »)

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Suggestions (jusqu'à 5, en gras) |  | Partiel | P1 | `features/spelling.ts` : mots fréquents du document (distance d'édition), pas un dictionnaire de langue |
| Ignorer une fois |  | À vérifier | P1 | « Ignorer ce mot » (`ignoreWord`) |
| Ignorer tout |  | Absent | P2 |  |
| Ajouter au dictionnaire |  | Absent | P1 | pas de dictionnaire personnel |
| Correction automatique | suggestions → remplacement automatique ; Options de correction automatique… | Absent | P2 | pas de module de correction automatique |
| Langue | Définir la langue de vérification… | Partiel | P2 | langue du paragraphe |
| Orthographe… / Éditeur | volet Éditeur | Partiel | P2 | ; 2026-11-06 : boîte Grammaire et orthographe (suspects, changer, ignorer, ajouter au dictionnaire) ; pas de grammaire |
| Corrections du navigateur… |  | Extra | P3 | repli sur le menu natif (`armNative`) |
| Couper / Copier / Options de collage / Lien / Nouveau commentaire |  | À vérifier | P1 |  |
| Grammaire (menu « Grammaire »: Ignorer la règle, Expliquer…) |  | Absent | P2 | aucune grammaire (STATUS) |

### 2.4 Lien hypertexte

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Couper / Copier / Options de collage |  | À vérifier | P1 |  |
| Modifier le lien hypertexte… |  | À vérifier | P1 | `Modifier le lien…` ouvre LinkDialog (non pré-rempli prouvé : à vérifier) |
| Ouvrir le lien hypertexte | Ctrl+clic | À vérifier | P1 | `window.open` (http, https, mailto, tel, ftp) ; Ctrl+clic géré dans App.tsx |
| Copier le lien hypertexte |  | À vérifier | P2 |  |
| Supprimer le lien hypertexte |  | À vérifier | P1 |  |
| Sélectionner le lien hypertexte |  | Absent | P3 |  |
| Police… / Paragraphe… / Nouveau commentaire |  | À vérifier | P2 |  |

### 2.5 Tableau : texte de cellule, cellules sélectionnées, tableau entier

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Couper / Copier / Options de collage |  | À vérifier | P1 |  |
| Insérer | colonnes à gauche, à droite, lignes au-dessus, en dessous, Insérer des cellules… | Partiel | P1 | 4 premières entrées ; pas « Insérer des cellules… » |
| Supprimer les cellules… (ou Supprimer le tableau / lignes / colonnes) | dialogue : décaler à gauche/haut, ligne entière, colonne entière | Partiel | P1 | sous-menu Supprimer : ligne, colonne, tableau (pas de dialogue ni de décalage) |
| Fusionner les cellules (si plusieurs cellules sélectionnées) |  | À vérifier | P1 | `mergeCells` |
| Fractionner… | dialogue colonnes/lignes | Partiel | P2 | `splitCell` sans dialogue |
| Répartir les lignes / colonnes uniformément |  | Absent | P3 |  |
| Ajustement automatique | Ajuster au contenu ; Ajuster à la fenêtre ; Largeur de colonne fixe | Absent | P2 |  |
| Styles de bordure | Bordures + coin pinceau | Absent | P2 |  |
| Alignement des cellules | 9 positions | Absent | P2 |  |
| Orientation du texte… |  | Absent | P3 |  |
| Insérer une légende… | (tableau entier) | Absent | P3 | uniquement pour les images |
| Propriétés du tableau… | onglets Tableau, Ligne, Colonne, Cellule, Texte de remplacement | OK | P1 | ; tables/PropsDialog.tsx, e2e : hauteur, largeur, alignement, titre |
| Trier… |  | Extra | P3 | entrée ForgeOffice supplémentaire |
| Synonymes / Traduire / Lien / Nouveau commentaire (texte de cellule) |  | Partiel | P2 | voir 2.1 |

### 2.6 Image (alignée sur le texte ou flottante)

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Couper / Copier / Options de collage |  | À vérifier | P1 |  |
| Modifier le texte de remplacement… |  | À vérifier | P2 | AltDialog |
| Insérer une légende… |  | À vérifier | P2 | CaptionDialog |
| Habillage | 7 modes + Modifier les points d'habillage + Plus d'options | Partiel | P1 | 6 modes (test images.test) ; pas points d'habillage ni « Plus d'options de disposition » |
| Position (Ordre : Premier plan, Arrière-plan, Avancer, Reculer, Texte en dessous/au-dessus) |  | Absent | P2 | `Position` = alignement gauche/centre/droite ; pas d'ordre Z ni Regroupement |
| Regroupement | Grouper ; Dissocier ; Regrouper | Absent | P3 |  |
| Taille et position… |  | Absent | P2 | entrée désactivée |
| Mise en forme de l'image… | volet à droite | Absent | P2 |  |
| Rogner |  | Absent | P2 |  |
| Changer l'image |  | Absent | P3 |  |
| Enregistrer sous image… |  | Absent | P3 |  |
| Réinitialiser l'image |  | À vérifier | P2 | rétablit rotation/retournement/rognage |
| Lien hypertexte… / Nouveau commentaire |  | À vérifier | P2 |  |
| Modification directe par la souris : déplacer, redimensionner, pivoter | poignées | À vérifier | P1 | `ui/ImageOverlay.tsx` + tests images.test (poignées, rotation, flèches) ; en cours d'ajout par une autre session |

### 2.7 Forme, zone de texte, WordArt, SmartArt, graphique, équation, zone de dessin

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Forme / zone de texte : Couper, Copier, Coller, Modifier le texte, Regroupement, Ordre, Définir comme forme par défaut, Mise en forme de la forme…, Nouveau commentaire |  | Absent | P1 | les formes sont insérées EN LIGNE et ne sont pas sélectionnables comme objets : aucun menu contextuel ; onglet Format de forme et poignée de déplacement faits, menu contextuel d’objet toujours absent |
| WordArt : Modifier le texte… , Regroupement, Ordre |  | Absent | P3 |  |
| SmartArt (Diagram) : Modifier le texte, Insérer une forme, Supprimer la forme, Utiliser la mise en forme automatique |  | Absent | P2 |  |
| Graphique : Modifier les données, Modifier le type de graphique, Mise en forme… |  | Absent | P2 |  |
| Équation : Professionnel / Linéaire, Enregistrer comme nouvelle équation…, Options |  | Absent | P2 | l'équation est un atome non éditable |
| Zone de dessin : Ajuster, Agrandir, Mettre le dessin à l'échelle |  | Absent | P3 |  |
| Ligne horizontale, Objet OLE |  | Absent | P3 |  |

### 2.8 En-tête, pied de page, note, légende, titre, liste, commentaire, champ, révision, signet, saut de page

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Zone d'en-tête / de pied de page : Modifier l'en-tête (Modifier le pied de page) |  | À vérifier | P1 | `headerFooterMenu` : Modifier, Numéro de page, Supprimer (testé) |
| En-tête : Format des numéros de page… |  | Absent | P2 |  |
| Note de bas de page / de fin : Atteindre la note, Convertir en note de fin (de bas de page), Options des notes…, Style…, Police…, Paragraphe… |  | Partiel | P2 | seul « Afficher les notes » (volet Notes) |
| Légende / champ : Mettre à jour les champs ; Modification du champ… ; Basculer les codes de champs ; Modifier la citation ; Police… ; Paragraphe… |  | Partiel | P2 | « Mettre à jour le champ » et « Modifier le champ… » (À vérifier) ; pas de codes de champs |
| Titre dans le volet Navigation : Hausser, Abaisser, Nouveau titre avant/après, Nouveau sous-titre, Supprimer, Sélectionner le titre et son contenu, Imprimer, Afficher les niveaux, Tout développer / réduire |  | Absent | P2 | le volet n'a pas de menu contextuel |
| Titre (Développer/Réduire dans le corps) : Développer le titre ; Réduire le titre ; Développer tous ; Réduire tous |  | Absent | P2 | pas de réduction de titres |
| Liste : Ajuster les retraits de la liste… ; Continuer la numérotation ; Définir la valeur de numérotation… ; Séparer la liste ; Joindre à la liste précédente ; Redémarrer à 1 |  | Partiel | P2 | seul « Redémarrer la numérotation » |
| Commentaire (clic sur le texte commenté) : Modifier ; Répondre ; Marquer comme terminé ; Supprimer |  | Partiel | P2 | « Afficher le commentaire » seulement ; répondre/résoudre/supprimer dans le volet |
| Révision (marque de suivi) : Accepter la modification ; Refuser la modification ; Suivi des modifications ; Suivre le mouvement |  | À vérifier | P1 | Accepter / Refuser présents (logique testée) |
| Signet |  | Absent | P3 | Word n'a pas de menu dédié ; ForgeOffice non plus (équivalent) |
| Saut de page / saut de section |  | Absent | P3 | Word : menu « Texte » standard ; idem |
| Contrôle de contenu : Propriétés ; Supprimer le contrôle de contenu |  | Absent | P3 | les contrôles sont lus (model `contentControl`) mais non éditables |

### 2.9 Règle, barre d'état, onglets du ruban, barre d'accès rapide, volet Navigation

| Entrée Word (ordre) | Sous-menu / détail | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Règle : clic droit sur la zone de retrait (Mise en page…, Paragraphe…, Tabulations…) ; double-clic sur un taquet → dialogue Tabulations | (source : connaissance) | Absent | P2 | `Ruler.tsx` : glisser retraits/taquets, double-clic = supprimer le taquet, aucun menu ni dialogue |
| Barre d'état : « Personnaliser la barre d'état » (≈25 cases : Numéro de page, Nombre de mots, Vérification, Langue, Focus, Zoom…) | (source : connaissance) | Partiel | P3 | `StatusBar` du paquet ui : éléments fixes, non personnalisables ; 2026-11-07 : menu clic droit avec 6 indicateurs masquables (ui/statusMenu.ts), mémorisé ; pas les ≈25 cases de Word |
| Barre d'état : clic droit sur Langue |  | Partiel | P3 | clic ouvre un menu de langues |
| Onglet du ruban : Personnaliser le ruban… ; Personnaliser la barre d'outils Accès rapide… ; Réduire le ruban ; Afficher la barre d'outils Accès rapide sous le ruban |  | Partiel | P2 | réduction (double-clic, Ctrl+F1) présente ; personnalisation de la QAT dans la barre de titre ; pas de personnalisation du ruban |
| Barre d'accès rapide : Supprimer de la barre ; Personnaliser… |  | À vérifier | P3 | `TitleBar` quickAccess personnalisable |
| Document Map : Développer, Réduire, niveaux 1 à 9, Tout |  | Absent | P2 |  |
| Menu système de la fenêtre (Restauration, Déplacer, Taille…) |  | Extra | P3 | géré par l'OS / Tauri |


## 3. Mini-barre flottante de mise en forme

Source du contenu : connaissance de Word 2024/365 (la mini-barre n'apparaît qu'après une sélection ou un clic droit : non pilotable par UI Automation sans souris). ForgeOffice : `ui/miniBar.ts` (deux rangées reprenant les contrôles de l'onglet Accueil) + `MiniToolbar` / `useSelectionMiniToolbar` du paquet ui, **ajoutés pendant l'audit par une autre session** : aucun parcours réel prouvé.

| Élément | Rangée | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Police (liste) | 1 | À vérifier | P1 | `fontname` |
| Taille de police (liste) | 1 | À vérifier | P1 | `fontsize` |
| Agrandir la police | 1 | À vérifier | P1 | `grow` |
| Réduire la police | 1 | À vérifier | P1 | `shrink` |
| Styles (galerie) | 1 | À vérifier | P2 | menu des 14 premiers styles |
| Gras | 2 | À vérifier | P1 |  |
| Italique | 2 | À vérifier | P1 |  |
| Souligné | 2 | À vérifier | P1 |  |
| Couleur de surlignage | 2 | À vérifier | P1 |  |
| Couleur de police | 2 | À vérifier | P1 |  |
| Puces | 2 | À vérifier | P1 |  |
| Numérotation | 2 | À vérifier | P1 |  |
| Diminuer / Augmenter le retrait | 2 | À vérifier | P2 |  |
| Reproduire la mise en forme | 2 | À vérifier | P2 |  |
| Effacer la mise en forme | 2 | À vérifier | P2 |  |
| Aligner / Centrer / Interligne dans la mini-barre | 2 | Absent | P3 |  |
| Nouveau commentaire / Copilot dans la mini-barre | 2 | Absent | P3 |  |
| Apparition automatique près de la sélection (après relâchement de la souris) | comportement | À vérifier | P1 | `useSelectionMiniToolbar` + `placeMiniToolbar` (tests ui/tests/miniToolbar.test.ts) |
| Apparition AVEC le menu contextuel au clic droit (mini-barre au-dessus du menu) | comportement | Absent | P1 | non relié à `useContextMenu` |
| Atténuation puis disparition quand le pointeur s'éloigne ; disparition à la frappe ; Échap | comportement | À vérifier | P2 |  |
| Option « Afficher la mini-barre à la sélection » | réglage | À vérifier | P2 | Options > Curseur (ui.miniBar) |

## 4. Boîtes de dialogue

Sources : onglets et options de Word = connaissance (les boîtes de dialogue sont modales : non ouvertes par UI Automation). Statuts = lecture de `packages/word/src/dialogs/*.tsx`. Les dialogues ForgeOffice sont tous des `Dialog` du paquet ui (déplaçable).

| Dialogue | Onglets / options principales de Word | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Police (Ctrl+D) | Police : police, style, taille, couleur, soulignement + couleur, couleur de soulignement, effets (barré, barré double, exposant, indice, ombre, contour, relief, gravé, petites majuscules, majuscules, masqué), aperçu, Par défaut, Effets de texte… ; Avancé : échelle, espacement, position, crénage, ligatures, chiffres, jeux stylistiques | Partiel | P1 | `FontDialog` : police, style, taille, soulignement, espacement, effets (barré, double, exposant, indice, petites maj., maj., masqué), couleur, aperçu ; manque Avancé, ombre/contour/relief/gravé, Par défaut |
| Paragraphe | Retrait et espacement : alignement, niveau hiérarchique, retraits (gauche, droite, spécial, en miroir), espacement avant/après, interligne, « ne pas ajouter d'espace… » ; Enchaînements : veuves/orphelines, paragraphes solidaires, lignes solidaires, saut de page avant, supprimer numéros de ligne, ne pas couper les mots ; Tabulations… | Partiel | P1 | `ParagraphDialog` (une seule page, sans onglets) : tous les champs principaux ; manque retrait en miroir, supprimer les numéros de ligne, ne pas couper les mots, bouton Tabulations… |
| Tabulations | position, alignement (gauche/centré/droit/décimal/barre), points de suite, Définir, Effacer, Effacer tout, par défaut | OK | P1 | pas de dialogue ; taquets posés/retirés à la règle (`Ruler.tsx`, logique `features/tabstops.ts` testée) ; rendu des taquets personnalisés absent du corps (STATUS) ; boîte Tabulations (format/TabsDialog.tsx), e2e : taquet droit à 8 cm mesuré |
| Puces et numéros / Définir une puce / Définir un format de numérotation / Liste à plusieurs niveaux | symbole, police, image, alignement, retrait, valeur de départ, niveaux 1-9 | Partiel | P2 | bibliothèques courtes dans le ruban seulement ; 2026-11-07 : format/ListDefineDialog.tsx : liste à plusieurs niveaux (format, gabarit, début, retraits) prouvée ; reste puce image/police |
| Bordures et trame | Bordures (cadre, tout, grille, personnalisé, style, couleur, épaisseur, appliquer à, options) ; Bordure de page ; Trame de fond | Partiel | P2 | seul `PageBorderDialog` (style, épaisseur, couleur) pour la page ; format/BordersDialog.tsx : bordures de paragraphe + trame ; pas de bordure de texte ni de page ici |
| Bordure de page | cadre, art, appliquer à, options de marges | Partiel | P2 | `PageBorderDialog` |
| Mise en page | Marges (haut, bas, gauche, droite, reliure, position reliure, orientation, plusieurs pages) ; Papier (taille, largeur/hauteur, alimentation) ; Disposition (début de section, en-têtes pages paires/impaires, première page différente, alignement vertical, numéros de ligne, bordures) ; Appliquer à ; Par défaut | Partiel | P1 | `PageSetupDialog` : marges (+ reliure, en-tête/pied), papier, colonnes, appliquer à la section/au document ; manque Disposition, Par défaut, plusieurs pages ; 2026-11-07 : + alignement vertical (haut, centré, bas, rendu de pagination mesuré), début de section (nouvelle page, continu, paire, impaire), première page différente, pages paires/impaires ; reste reliure, plusieurs pages, papier avancé |
| Colonnes | présélections, nombre, largeur/espacement, ligne séparatrice, appliquer à | Partiel | P2 | dans `PageSetupDialog` (nombre, espacement, ligne) ; pas de colonnes de largeurs inégales à saisir |
| Insérer un tableau | nombre de colonnes/lignes, largeur (fixe/auto/fenêtre), mémoriser | Partiel | P1 | `TableDialog` : lignes et colonnes seulement |
| Propriétés du tableau | Tableau, Ligne, Colonne, Cellule, Texte de remplacement | OK | P1 | ; tables/PropsDialog.tsx, e2e : hauteur, largeur, alignement, titre |
| Insérer des cellules / Supprimer les cellules / Fractionner les cellules / Fractionner le tableau |  | Partiel | P2 | ; Fractionner le tableau fait ; pas Insérer des cellules |
| Propriétés de l'image / Mise en forme de l'image / Disposition (Position, Habillage, Taille) | Habillage (6 modes + distances), Position (horizontale/verticale), Taille (hauteur/largeur, rotation, verrouiller proportions, échelle), Texte de remplacement | Absent | P1 | pas de dialogue : habillage et taille dans l'onglet Format de l'image, poignées (ImageOverlay) |
| Rechercher et remplacer | Rechercher / Remplacer / Atteindre ; Plus : respecter la casse, mot entier, caractères génériques, sons identiques, toutes les formes, ignorer ponctuation/espaces, Format…, Spécial…, Rechercher dans (sélection, pied de page…), Surligner tout | Partiel | P1 | `FindDialog` : respecter la casse, mot entier, expressions régulières, ignorer les accents, suivant/précédent, remplacer/tout (test find.test) ; manque Format…, Spécial… (seulement `^t`, `^s`), surligner tout ; 2026-11-07 : Format (gras, italique, souligné, barré, surligné), Spécial et ^p ajoutés |
| Atteindre | Page, Section, Ligne, Signet, Commentaire, Note de bas de page, Note de fin, Champ, Tableau, Graphique, Équation, Objet, Titre | Partiel | P2 | `GotoDialog` : numéro de page seulement ; navigation/GotoDialog.tsx : page, titre, signet, commentaire, notes, tableau, image |
| Symbole | Symboles (police, sous-ensemble, code, caractères récents, Correction automatique, Touche de raccourci) ; Caractères spéciaux | Partiel | P2 | `SymbolDialog` : jeux (latin, grec, maths, flèches, monnaies, divers) + récents |
| Lien hypertexte | Fichier ou page web existant, Emplacement dans ce document, Créer un document, Adresse de messagerie ; Info-bulle ; Cadre cible | Partiel | P1 | `LinkDialog` : texte, adresse (http/https/mailto/tel/ftp), emplacement, info-bulle ; manque création de document, cadre cible |
| Signet | nom, trier, ajouter, atteindre, supprimer, signets masqués | À vérifier | P2 | `BookmarkDialog` (liste, atteindre, validation du nom) ; pas de signets masqués |
| Renvoi | type (Numéroté, Titre, Signet, Note…, Figure, Tableau, Équation), insérer (texte, numéro de page, numéro de paragraphe, au-dessus/au-dessous), hyperlien, liste des éléments | Partiel | P2 | `CrossRefDialog` : type, élément, lien hypertexte |
| Légende | légende, étiquette (Figure/Tableau/Équation), position, Nouvelle étiquette, Numérotation, exclure l'étiquette, Légende automatique | Partiel | P2 | `CaptionDialog` : étiquette + texte |
| Table des matières | Table des matières : afficher les numéros de page, aligner à droite, caractère de suite, formats, afficher les niveaux, Options, Modifier | Partiel | P2 | pas de dialogue (modèle automatique unique) ; références/TocDialog.tsx : niveaux, numéros, caractère de suite, liens ; pas de formats ni Options |
| Index et tables | Index : Marquer l'entrée, type, colonnes, langue, tri ; Table des matières ; Table des illustrations ; Table des autorités | Partiel | P3 | `IndexDialog` : marquer une entrée ; l'insertion de l'index non prouvée |
| Citation / Gérer les sources / Bibliographie | sources, type de source, champs, style | Partiel | P3 | `CitationDialog` : auteur, titre, année, éditeur |
| Publipostage (Assistant pas à pas) | Type de document, Document de départ, Destinataires, Écrire la lettre, Aperçu, Fin ; Fusionner vers un nouveau document / l'imprimante / courrier | Absent | P2 | pas d'assistant ; ruban seul avec liste CSV (`act.loadCsv`, `finishMerge`) |
| Options Word | Général, Affichage, Vérification, Enregistrement, Langue, Options d'ergonomie, Options avancées, Personnaliser le ruban, Barre d'outils Accès rapide, Compléments, Centre de gestion de la confidentialité | Partiel | P1 | page Options du Backstage : auteur, thème, curseur, mini-barre, orthographe ; manque ~95 % des catégories |
| Style (Modifier / Nouveau style) | nom, type, basé sur, style du paragraphe suivant, mise en forme, Format… (Police, Paragraphe, Tabulations, Bordure, Langue, Cadre, Numérotation, Raccourci clavier, Effets de texte), ajouter à la galerie, nouveaux documents | Partiel | P1 | `StyleDialog` : nom + « basé sur la mise en forme du texte sélectionné » ; pas de modification d'un style existant ; 2026-11-06 : styles/StyleEditDialog.tsx : nom, base, suivant, police, paragraphe, galerie ; reste Format… (tabulations, bordure, numérotation) ; 2026-11-07 : Format : Tabulations… et Bordure… prouvés (hérités par les paragraphes) ; reste Numérotation, Langue, Cadre, Raccourci clavier |
| Gestion des styles | Modifier, Recommander, Restreindre, Importer/Exporter, tri, aperçu | Partiel | P2 | volet Styles simple (liste, application) ; 2026-11-06 : volet Styles avec aperçu, Modifier, Supprimer, Mettre à jour, Effacer tout ; pas d’import/export ni de restriction ; 2026-11-07 : import (ajout / remplacement) depuis un .docx/.dotx et export vers un .docx de styles prouvés ; reste recommander / restreindre |
| Protéger le document / Restreindre la modification | restrictions de mise en forme, modifications (révisions, commentaires, formulaires, aucune), exceptions, Oui démarrer l'application, mot de passe, chiffrer par mot de passe | Partiel | P2 | bascule « marqué comme final » (lecture seule) ; pas de mot de passe ni de restrictions fines ; 2026-11-07 : mot de passe SHA-512 salé (lecture seule ou suivi obligatoire), accepté par le vrai Word (Unprotect) ; reste exceptions, formulaires, commentaires seuls ; 2026-11-07 : + commentaires seulement et remplissage de formulaires (contrôles de contenu) ; reste exceptions par utilisateur |
| Collage spécial | Coller / Coller avec liaison, Texte mis en forme (RTF), Texte non mis en forme, Image, HTML, Unicode | Partiel | P2 | `PasteSpecialDialog` : HTML mis en forme, texte brut |
| Trier le texte | Trier par (3 niveaux), type (texte, nombre, date), ordre, options (séparateurs, respecter la casse, langue), avec en-tête | Partiel | P3 | `SortDialog` : ordre croissant/décroissant |
| Date et heure | formats (≈15 en français), langue, calendrier, mettre à jour automatiquement, Par défaut | À vérifier | P2 | `DateDialog` (formats, mise à jour auto) |
| Champ | catégories, noms de champs, propriétés, options de champ, conserver la mise en forme | Partiel | P3 | `FieldDialog` : code de champ libre |
| Filigrane imprimé | aucun, image (échelle, estompé), texte (langue, texte, police, taille, couleur, semi-transparent, disposition diagonale/horizontale) | Partiel | P2 | `WatermarkDialog` : texte, couleur, diagonale ; stocké en propriété personnalisée |
| Statistiques | pages, mots, caractères (avec/sans espaces), paragraphes, lignes, inclure les zones de texte/notes | À vérifier | P2 | `StatsDialog` (test stats) |
| Correction automatique / Options de correction automatique | Correction automatique, Mise en forme automatique en cours de frappe, Insertion automatique, Corrections automatiques mathématiques | Absent | P1 | aucun module |
| Grammaire et orthographe (volet/dialogue) | Orthographe, Grammaire, Ignorer, Ajouter, Changer, Options | Partiel | P1 | `SpellingDialog` : information + activation/désactivation du soulignement natif ; proofing/SpellingDialog.tsx : suspects, Changer, Ignorer, Ajouter ; pas de grammaire |
| Comparer les documents | original, révisé, étiquetage, options, afficher les modifications (niveau caractère/mot), dans un nouveau document | Partiel | P2 | `compareWith` (diff de mots, document avec révisions) ; fichier demandé par dialogue système |
| Zoom | pourcentage, largeur de page, pages, plusieurs pages, aperçu | OK | P2 | menu de 5 niveaux + barre d'état (10-500 %) ; view/ZoomDialog.tsx, e2e : 75 %, largeur de page, 130 % |
| Personnaliser le clavier / Personnaliser le ruban | catégories, commandes, nouvelle touche de raccourci | Absent | P3 |  |
| Insérer un fichier (Texte d'un fichier) / Objet… |  | Absent | P3 |  |
| Enveloppes et étiquettes / Options d'étiquettes |  | Absent | P3 |  |
| Notes de bas de page et de fin | emplacement, format de numérotation, début, numérotation (continue/par section/par page), convertir | Partiel | P2 | ; 2026-11-07 : references/NotesFormatDialog.tsx : format et début, rendu + .docx (w:footnotePr) prouvés ; reste emplacement, redémarrage par page/section, conversion ; 2026-11-07 : + conversion bas de page <-> fin prouvée ; reste emplacement et redémarrage par page/section à l’affichage |
| Options de coupure de mots / Numérotation de lignes |  | Absent | P3 | bascule automatique seulement (ruban) |
| Propriétés avancées du document | Général, Statistiques, Contenu, Personnalisation | Partiel | P3 | propriétés de base dans Backstage > Informations |
| Orientation du texte / Marges de cellule |  | Absent | P3 |  |
| Enregistrer sous / Ouvrir / Imprimer (boîte système ou Backstage) |  | Partiel | P1 | voir section 7 |

## 5. Raccourcis clavier

Source des raccourcis Word FRANÇAIS : colonne « Accélérateur » de l'arbre UI Automation du vrai Word 365 (marqué **[UIA]**) sinon connaissance. Statuts : liaisons de `editor/setup.ts` (`wordKeymap`, ProseMirror) + `App.tsx` + `ui/` (Ruban, TitleBar). **Écarts avec Word français : ForgeOffice reprend plusieurs raccourcis ANGLAIS (Ctrl+L/R, Ctrl+Maj+C/V, Alt+Maj+T, Ctrl+Alt+F/D).**

| Raccourci (Word FR) | Action | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Ctrl+N | Nouveau document | À vérifier | P1 | `Mod-n` |
| Ctrl+O | Ouvrir | À vérifier | P1 | `Mod-o` |
| Ctrl+S | Enregistrer | À vérifier | P1 | `Mod-s` |
| F12 | Enregistrer sous | À vérifier | P1 |  |
| Ctrl+P | Imprimer | À vérifier | P1 | ouvre la page Imprimer du Backstage |
| Ctrl+F2 | Aperçu avant impression | Absent | P3 |  |
| Ctrl+W (ou Ctrl+F4) | Fermer le document | À vérifier | P2 | `Mod-w` |
| Ctrl+Z | Annuler | À vérifier | P1 | `Mod-z`, historique 500 |
| Ctrl+Y / F4 | Rétablir / Répéter la dernière action | OK | P1 | Ctrl+Y rétablit ; F4 « Répéter » absent ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+X / Ctrl+C / Ctrl+V **[UIA]** | Couper / Copier / Coller | À vérifier | P1 | natifs du navigateur |
| Ctrl+Alt+V | Collage spécial | Absent | P2 | affiché dans le menu, non lié |
| Alt+Ctrl+C / Alt+Ctrl+V **[UIA]** | Copier / coller la mise en forme | OK | P2 | ForgeOffice lie `Mod-Shift-c` / `Mod-Shift-v` (raccourcis anglais) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+A **[UIA]** | Sélectionner tout | À vérifier | P1 | `baseKeymap` |
| Ctrl+F **[UIA]** | Rechercher (volet Navigation) | À vérifier | P1 |  |
| Ctrl+H **[UIA]** | Remplacer | À vérifier | P1 |  |
| Ctrl+B **[UIA]** / F5 | Atteindre | Partiel | P2 | ForgeOffice : F5 seulement ; Ctrl+B (FR) lié au gras (Mod-b) |
| Ctrl+K **[UIA]** | Insérer un lien | À vérifier | P1 |  |
| Ctrl+G **[UIA]** | Gras | À vérifier | P1 | + Ctrl+B |
| Ctrl+I **[UIA]** | Italique | À vérifier | P1 |  |
| Ctrl+U | Souligné | À vérifier | P1 |  |
| Ctrl+Maj+W | Souligner les mots seulement | À vérifier | P3 |  |
| Ctrl+Maj+D (EN : double soulignement) | double soulignement | Partiel | P3 | **conflit** : en Word FR Ctrl+Maj+D = Aligner à droite **[UIA]**, ForgeOffice lie le double soulignement |
| Ctrl+Maj+K | Petites majuscules | À vérifier | P3 |  |
| Ctrl+Maj+A | Majuscules | À vérifier | P3 |  |
| Ctrl+Maj+H | Texte masqué | À vérifier | P3 |  |
| Ctrl+= **[UIA]** | Indice | À vérifier | P2 |  |
| Ctrl+Maj++ **[UIA]** | Exposant | À vérifier | P2 |  |
| Ctrl+Espace | Effacer la mise en forme du texte | À vérifier | P2 |  |
| Ctrl+Maj+> / Ctrl+< **[UIA]** | Agrandir / réduire la police | À vérifier | P1 | + Ctrl+] et Ctrl+[ |
| Ctrl+Maj+F / Ctrl+Maj+P | Liste Police / Taille | Absent | P2 | affichés en infobulle, non liés |
| Ctrl+D | Boîte Police | À vérifier | P1 |  |
| Maj+F3 | Changer la casse | À vérifier | P2 | seulement vers MAJUSCULES (pas de rotation des 3 états) |
| Ctrl+Maj+G **[UIA]** | Aligner à gauche | OK | P1 | ForgeOffice lie Ctrl+L (EN) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+E **[UIA]** | Centrer | À vérifier | P1 |  |
| Ctrl+Maj+D **[UIA]** | Aligner à droite | OK | P1 | ForgeOffice lie Ctrl+R (EN) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+J **[UIA]** | Justifier | À vérifier | P1 |  |
| Ctrl+M / Ctrl+Maj+M | Augmenter / diminuer le retrait | À vérifier | P2 |  |
| Ctrl+T / Ctrl+Maj+T | Retrait suspendu | À vérifier | P3 |  |
| Ctrl+Q | Réinitialiser le paragraphe | À vérifier | P3 |  |
| Ctrl+1 / Ctrl+2 / Ctrl+5 | Interligne simple / double / 1,5 | À vérifier | P2 |  |
| Ctrl+0 | Espace avant 12 pt (basculer) | Partiel | P3 | **conflit** : l'arbre UIA donne Ctrl+0 = Zoom 100 % ; ForgeOffice l'utilise pour l'espacement |
| Alt+Ctrl+1 / 2 / 3 | Titre 1 / 2 / 3 | À vérifier | P1 |  |
| Ctrl+Maj+N | Style Normal | À vérifier | P2 |  |
| Ctrl+Maj+L | Liste à puces | À vérifier | P2 |  |
| Alt+Ctrl+Maj+S **[UIA]** | Volet Styles | Absent | P2 | ; volet ouvrable par le lanceur Styles, raccourci non lié |
| Ctrl+Maj+S | Appliquer un style (zone) | Absent | P3 |  |
| Alt+Maj+← / → | Hausser / abaisser le niveau | OK | P2 | ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Alt+Maj+↑ / ↓ | Déplacer le paragraphe | OK | P2 | ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+Entrée **[UIA]** | Saut de page | OK | P1 | testé (commandes) |
| Ctrl+Maj+Entrée | Saut de colonne | À vérifier | P3 |  |
| Maj+Entrée | Saut de ligne | À vérifier | P1 |  |
| Ctrl+Maj+Espace | Espace insécable | OK | P2 | ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+- / Ctrl+Maj+- | Trait d'union conditionnel / insécable | Absent | P3 |  |
| Alt+Ctrl+B **[UIA]** | Note de bas de page | OK | P1 | ForgeOffice : Ctrl+Alt+F (anglais) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Alt+Ctrl+F **[UIA]** | Note de fin | OK | P2 | ForgeOffice : Ctrl+Alt+D (anglais) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Alt+Ctrl+M | Nouveau commentaire | À vérifier | P1 |  |
| Alt+Maj+D | Insérer la date | À vérifier | P2 |  |
| Alt+Maj+H | Insérer l'heure | OK | P3 | ForgeOffice : Alt+Maj+T (anglais) ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Alt+Maj+P | Champ numéro de page | Absent | P3 |  |
| Alt+= | Équation | Absent | P3 |  |
| F9 / Maj+F9 / Alt+F9 | Mettre à jour les champs / codes de champ / tous | Partiel | P2 | ; F9 lié ; Maj+F9 et Alt+F9 absents |
| F7 | Grammaire et orthographe | À vérifier | P2 | ouvre la boîte d'info |
| Maj+F7 | Dictionnaire des synonymes | Absent | P3 |  |
| Ctrl+Maj+E | Suivi des modifications | OK | P1 | affiché en infobulle, non lié ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+8 **[UIA]** | Afficher tout | OK | P2 | infobulle `Ctrl+*`, non lié ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+Alt+P / Ctrl+Alt+O / Ctrl+Alt+N | Vue Page / Plan / Brouillon | OK | P3 | ; prouvé 2026-11-06 : tests/keymap.test.ts + frappe réelle (CDP) |
| Ctrl+0 **[UIA]** | Zoom 100 % | Absent | P3 |  |
| Ctrl+molette / Ctrl+Alt+molette | Zoom | À vérifier | P2 | pincement implémenté ; molette non prouvée |
| Ctrl+F1 / F10 / Alt | Réduire le ruban / KeyTips | À vérifier | P2 | `Ribbon.tsx` |
| Alt+Q **[UIA]** | Rechercher une commande | À vérifier | P1 | TitleBar |
| Alt (KeyTips : L, N, P, R… ) | Navigation par KeyTips | Partiel | P2 | KeyTips présents mais **différents de Word** : Insertion N (Word S), Conception G (Ç), Références S (É), Publipostage M (G), Affichage A (N) |
| Échap | Quitter le mode Focus / fermer | À vérifier | P2 |  |
| Tab / Maj+Tab dans un tableau | Cellule suivante / précédente (Tab en fin : nouvelle ligne) | À vérifier | P1 | `goToNextCell` ; ajout de ligne en fin de tableau non prouvé |
| Tab / Maj+Tab dans une liste | Niveau suivant / précédent | À vérifier | P1 |  |
| Ctrl+Retour arrière / Ctrl+Suppr | Supprimer le mot précédent / suivant | À vérifier | P2 | natifs |
| Ctrl+Début / Ctrl+Fin / Ctrl+←→ / Ctrl+↑↓ / PgPréc / PgSuiv | Navigation | À vérifier | P1 | natifs du navigateur ; Ctrl+↑/↓ (paragraphe) non prouvé |
| Maj+F5 | Retourner à la dernière modification | Absent | P3 |  |
| F8 / Maj+F8 | Mode extension de sélection | Absent | P3 |  |
| Alt+F3 / F3 | Insertion automatique / nouvelle Insertion automatique | Absent | P3 |  |
| Alt+F11 / Alt+F8 | Macros / Visual Basic | Absent | P3 | VBA : non |
| F6 / Ctrl+F6 | Changer de volet / de fenêtre | Absent | P3 |  |
| F1 | Aide | Absent | P3 |  |

## 6. Volets de tâches

| Volet | Contenu / fonctions Word | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Navigation : onglets Titres / Pages / Résultats | recherche dans le document ; plan par titres avec glisser-déposer, clic droit (Hausser, Abaisser, Nouveau titre…, Supprimer, Tout développer/réduire) ; miniatures de pages ; résultats de recherche | Partiel | P1 | `Panes.tsx` NavPane : champ de recherche + liste des titres (clic = atteindre) ; pas d'onglets Pages ni Résultats, pas de glisser-déposer, pas de menu |
| Navigation : options de recherche (Rechercher des figures, tableaux, équations, notes, commentaires…) | menu loupe | Absent | P3 |  |
| Styles (Alt+Ctrl+Maj+S) | liste, aperçu, Nouveau style, Inspecteur de style, Gérer les styles, Options, Désactiver les liens | Partiel | P1 | `StylesPane` : liste + application ; manque Nouveau, Inspecteur, Gérer, Options |
| Recherche (Alt+Q) | recherche de commandes, aide | À vérifier | P2 | `TitleBar` (collectCommands) |
| Vérifications (révisions) | liste des modifications, résumé, détails | Absent | P2 |  |
| Commentaires | fils, Répondre, Résoudre/Rouvrir, Supprimer, filtrer, @mentions | Partiel | P1 | `CommentsPane` : fils, répondre, résoudre/rouvrir, supprimer (capture STATUS) ; pas de filtre ni @mentions |
| Notes (bas de page/de fin) |  | À vérifier | P2 | `NotesPane` éditable |
| Presse-papiers Office | 24 éléments | Absent | P3 |  |
| Sélection | liste des objets, afficher/masquer, ordre | Absent | P3 |  |
| Texte de remplacement | description, marquer comme décoratif | Partiel | P2 | boîte AltDialog (pas décoratif) |
| Éditeur | score, orthographe, grammaire, clarté, concision | Absent | P2 |  |
| Vérificateur d'accessibilité | erreurs, avertissements, conseils | Absent | P2 |  |
| Mise en forme de l'image / de la forme / du graphique | remplissage, ligne, effets, disposition, texte | Absent | P1 |  |
| Statistiques avancées | lisibilité, temps, mots fréquents | Extra | P3 | `StatsPane` |
| Concepteur / Copilot / Réutiliser les fichiers / Aide |  | Absent | P3 | hors périmètre |

## 7. Backstage (onglet Fichier)

Source : arbre UI Automation du vrai Word 365 (liste de navigation : Précédent, Accueil, Nouveau, Ouvrir, Partager, Informations, Enregistrer, Enregistrer sous, Historique, Imprimer, Exporter, Fermer, Compte, Options ; page Accueil lue : modèles + récents). Contenu des autres pages : connaissance. ForgeOffice : `ui/BackstagePages.tsx` + `Backstage.tsx` du paquet ui.

| Page / fonction | Contenu Word | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Accueil | « Bonjour », Nouveau (Document vierge + modèles), Récents / Favoris | OK | P1 | capture « Backstage Accueil » (STATUS) |
| Nouveau | modèles Microsoft (rechercher, catégories) | Partiel | P2 | 5 modèles locaux (vierge, lettre, CV, rapport, compte rendu) |
| Ouvrir | Récent, Ce PC, OneDrive, SharePoint, Parcourir, Épingler | Partiel | P1 | récents + Parcourir ; pas d'épinglage dans cette page |
| Partager | Partager, Envoyer une copie, Joindre à un message, Présenter en ligne, Publier | Absent | P3 | page absente de la liste (hors périmètre : local) |
| Informations | Protéger le document, Inspecter le document, Vérifier l'accessibilité, Gérer le document (versions), Propriétés (titre, étiquettes, catégories, auteur…), Dates, Personnes associées | Partiel | P1 | `Info` : marquer comme final, supprimer les infos personnelles, propriétés (7 champs), statistiques ; « Récupération » = texte sans action |
| Enregistrer |  | OK | P1 | capture « enregistrer puis rouvrir » (STATUS) |
| Enregistrer sous | Emplacements, nom, type (docx, docm, dotx, doc, pdf, odt, rtf, html, txt…), Plus d'options | Partiel | P1 | nom + type (docx, docm, dotx, dotm, odt, rtf, html, md, txt) ; pas de sélecteur d'emplacement |
| Historique | historique des versions | Absent | P2 |  |
| Imprimer | aperçu pleine page + zoom ; copies, imprimante, paramètres (pages, recto-verso, assemblé, orientation, taille, marges, pages/feuille) ; Mise en page | Partiel | P1 | aperçu en vignettes (lecture seule), bouton Imprimer (fenêtre d'impression du système) ; aucun paramètre |
| Exporter | Créer PDF/XPS, Changer le type de fichier | Partiel | P2 | PDF via impression ; md, html, txt, odt, rtf |
| Fermer |  | À vérifier | P2 |  |
| Compte | utilisateur, thème Office, arrière-plan, connexions, produit | Partiel | P3 | texte « suite locale » ; thème dans Options |
| Commentaires |  | Absent | P3 | hors périmètre |
| Options | 11 catégories | Partiel | P1 | voir section 4 |

## 8. Barre d'état et modes d'affichage

Source Word : arbre UIA (barre d'état par défaut : Numéro de page, Statistiques, Mode de co-édition, Vérificateur d'accessibilité, Focus, Mode Lecture, Mode Page, Mode Web, Zoom arrière, curseur Zoom, Zoom avant, Zoom %). ForgeOffice : `ui/src/components/StatusBar.tsx` + `App.tsx` (propriétés left/views/zoom).

| Élément | Comportement Word | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Numéro de page « Page X sur Y » | clic = Atteindre | À vérifier | P1 | ouvre GotoDialog |
| Nombre de mots (« 12 mots », « 3 sur 12 mots » avec sélection) | clic = Statistiques | À vérifier | P1 |  |
| Vérification de l'orthographe (icône) | clic = ouvre Éditeur | Partiel | P2 | ouvre la boîte d'info |
| Langue | clic = Définir la langue | À vérifier | P2 | menu des langues |
| Suivi des modifications | indicateur | À vérifier | P3 |  |
| Mode de co-édition |  | Absent | P3 | non applicable (pas de co-édition) |
| Vérificateur d'accessibilité |  | Absent | P3 |  |
| Focus | bouton | Absent | P3 | accessible par le ruban Affichage |
| Mode Lecture / Page / Web (boutons) |  | À vérifier | P1 | `views` |
| Zoom arrière / curseur / avant / pourcentage (clic = dialogue Zoom) |  | À vérifier | P1 | zoom 10-500 %, presets « Largeur de la page » et « Une page » |
| Personnalisation de la barre d'état (clic droit) | ~25 indicateurs | Absent | P3 |  |
| Indicateurs masqués par défaut : Section, Page verticale, Numéro de ligne, Colonne, Insertion/Refrappe, Macro, Mode de sélection |  | Absent | P3 |  |
| Mode Lecture (affichage) | pages côte à côte, outils (Rechercher, Imprimer, Tools : Largeur de colonne, Couleur de page, Disposition) | Partiel | P2 | `is-read` : lecture simple + minuteur ; pas de menu Outils/Affichage de Lecture |
| Mode Page (affichage) | pages avec marges, règles, en-têtes | OK | P1 | captures |
| Mode Web |  | À vérifier | P3 |  |
| Mode Plan | niveaux, hausser/abaisser, réorganiser | Partiel | P2 | onglet Mode Plan : 4 commandes (hausser, abaisser, corps de texte, niveau) |
| Mode Brouillon |  | À vérifier | P3 |  |
| Mode Focus |  | OK | P2 | capture |
| Lecteur immersif | outils d'apprentissage (espacement, largeur, lecture à voix haute, syllabes, parties du discours) | Partiel | P3 | mode Lecture + minuteur |
| Plusieurs pages / Aperçu avant impression |  | Partiel | P2 | vignettes lecture seule |

## 9. Fonctions « invisibles »

Fonctions « invisibles » : elles ne se voient qu'en écrivant. Statut = lecture du code (`editor/setup.ts` : aucune règle de saisie ProseMirror, aucun module de correction automatique ; recherches `autocorrect`, `inputrules`, `predict`, `dictat`, `thesaur` : 0 résultat dans `packages/word/src`).

| Fonction | Détail Word | Statut | Prio | Note ForgeOffice |
|---|---|---|---|---|
| Correction automatique : options | Corriger 2 majuscules, majuscule en début de phrase / de cellule, jours, aLORS (verrouillage majuscules), remplacer pendant la frappe, exceptions | Absent | P1 |  |
| Correction automatique : remplacements (≈ 100 : (c)→©, (r)→®, :)→☺, ->→→, « teh »→« the »…) | liste modifiable | Absent | P1 |  |
| Corrections automatiques mathématiques | \alpha → α, etc. | Absent | P3 |  |
| Mise en forme automatique en cours de frappe : guillemets droits → « typographiques » |  | Absent | P1 |  |
| Mise en forme automatique : espaces insécables avant ; : ! ? » (français) |  | Absent | P1 |  |
| Mise en forme automatique : fractions (1/2→½), ordinaux (1er → exposant), traits d'union → tirets |  | Absent | P2 |  |
| Mise en forme automatique : *gras*, _italique_ |  | Absent | P3 |  |
| Mise en forme automatique : adresses Internet et réseau → liens |  | Absent | P1 |  |
| Mise en forme automatique : listes automatiques (« 1. » ou « - » + Espace) |  | Absent | P1 | seul « Entrée sur puce vide termine la liste » (setup.ts) |
| Mise en forme automatique : lignes de bordure (--- ↵), tableaux (+---+) |  | Absent | P3 |  |
| Insertion automatique (AutoText, F3, suggestion des jours/mois) |  | Absent | P3 |  |
| Texte prédictif (« Saisie semi-automatique ») |  | Absent | P2 |  |
| Dictée vocale (Dicter) |  | Absent | P2 |  |
| Éditeur / grammaire / clarté |  | Absent | P1 | le soulignement orthographique vient du navigateur |
| Vérification orthographique pendant la frappe | soulignement rouge, langue par paragraphe | Partiel | P1 | attribut `spellcheck` du navigateur + langue par paragraphe (`lang.ts`) ; dictionnaire du moteur (WebView), pas d'ajout personnel |
| Détection automatique de la langue |  | Absent | P3 |  |
| Accessibilité : vérificateur, texte de remplacement obligatoire, ordre de lecture |  | Partiel | P2 | texte de remplacement seul |
| Modèles : .dotx / .dotm, modèle Normal, nouveau document depuis un modèle |  | Partiel | P2 | 5 modèles internes (`features/templates.ts`, testés) ; enregistrement en .dotx déclaré dans Enregistrer sous (non prouvé) |
| Macros | VBA, enregistreur | Absent | P3 | décision : VBA non |
| Co-édition en temps réel |  | Absent | P3 | décision : non (local) |
| Versions / historique |  | Partiel | P2 | récupération automatique toutes les 30 s (capture) ; pas d'historique consultable |
| Protection | mot de passe d'ouverture/modification, marqué comme final, restriction | Partiel | P2 | « marqué comme final » seulement |
| Propriétés du document | titre, auteur, mots-clés, etc. | À vérifier | P2 | Backstage > Informations |
| Suppression des informations personnelles à l'enregistrement |  | Partiel | P3 | bouton « Supprimer les informations personnelles » |
| Récupération après plantage |  | OK | P1 | capture « récupération après plantage » (STATUS) |
| Glisser-déposer de texte / copier avec Ctrl |  | À vérifier | P2 | comportement natif ProseMirror |
| Navigation clavier du ruban (Alt, flèches) |  | À vérifier | P2 | `Ribbon.tsx`, `KeytipLayer.tsx` |
| Thème sombre / contraste élevé |  | OK | P2 | capture « thème sombre » |

## 10. AU-DELÀ D'OFFICE

Idées qui dépasseraient Word et que l'architecture de ForgeOffice (ProseMirror + modèle `@forgeoffice/docx` + Tauri/Rust + modules frères Tableur, Base de données, PDF, Notes, tout en local) permet. Une ligne de justification chacune.

1. **Grammaire et style hors ligne** (moteur type LanguageTool/Hunspell en WASM, dictionnaire personnel local) : pas de cloud, confidentialité totale, et comble le plus gros trou (Éditeur).
2. **Dictée locale** (Whisper.cpp en sidecar Tauri) : même qualité de dictée que Word sans envoyer l'audio.
3. **Lecture à voix haute locale** (voix système + surbrillance mot à mot) : Word exige un compte ; ici la Web Speech/SAPI suffit.
4. **Typographie française automatique complète** (espaces insécables, guillemets, tirets, « 1er », fractions, ligatures œ) : Word n'en fait qu'une partie ; le moteur de saisie est à écrire de toute façon.
5. **Historique de versions local type Git** (instantanés, diff visuel mot à mot, retour arrière par paragraphe) : réutilise `compare.ts` ; Word a un historique cloud seulement.
6. **Fusion à trois voies** (base, version A, version B) avec résolution des conflits par bloc : le modèle `docx` et la comparaison existent déjà.
7. **Rechercher/remplacer dans tout un dossier** (documents Texte, Notes, PDF) avec aperçu des changements : Word ne cherche que dans le document ouvert.
8. **Rechercher/remplacer par mise en forme et par style en lot**, avec expressions rationnelles et captures : `find.ts` gère déjà les regex et `$1`.
9. **Export natif multi-formats** (PDF/A et PDF balisé, EPUB, LaTeX, Markdown, Typst) depuis le modèle, sans passer par l'impression : crates `pdf`, `convert`, `docx`, `md` présents.
10. **Chiffrement réel du fichier** (AES-GCM + mot de passe, clés locales) au lieu de la simple « restriction » de Word : crypto Rust disponible.
11. **Signature numérique locale** (X.509/PAdES, horodatage) et vérification d'intégrité du document : aucun service tiers.
12. **Plan-manuscrit à la Scrivener** (fiches, réorganisation de sections par glisser-déposer, objectifs par section) : le mode Plan et le modèle de sections existent.
13. **Statistiques de productivité** (objectif de mots, séries, temps d'écriture par session, graphique) : `features/stats.ts` calcule déjà lisibilité et mots fréquents.
14. **Liaison vivante avec le Tableur** (tableau ou graphique collé « lié » qui se met à jour depuis un classeur ForgeOffice) : modules frères dans le même dépôt.
15. **Publipostage depuis XLSX, SQLite (module Base de données) et CSV** avec aperçu et filtres : Word n'a besoin d'Excel/Access installés.
16. **Bibliothèque de blocs réutilisables** partagée entre modules (signatures, en-têtes, clauses) : remplace QuickPart avec recherche plein texte.
17. **Scripts d'automatisation sûrs** (JS/WASM en bac à sable, API documentée) au lieu de VBA : productivité des macros sans le risque de sécurité.
18. **Assistant d'écriture IA local optionnel** (modèle via Ollama/llama.cpp : reformuler, résumer, traduire) : équivalent Copilot, hors ligne, désactivable.
19. **Traduction hors ligne** (modèles Opus-MT/Bergamot en WASM) : Word envoie le texte aux serveurs Microsoft.
20. **Import BibTeX/Zotero/CSL** pour citations et bibliographie (des centaines de styles) : le dialogue de citation actuel n'a que 4 champs.
21. **Liens bidirectionnels et graphe** entre documents et notes (module Notes) : navigation de type wiki locale.
22. **Édition multi-curseurs et sélection par colonne** : ProseMirror le permet ; absent de Word en dehors de Alt+glisser.
23. **Audit d'accessibilité WCAG automatique** avec correctifs en un clic (contrastes, alternatives, ordre de lecture) : plus complet que le vérificateur de Word.
24. **Mode « relecture structurée »** (liste filtrable de toutes les modifications et commentaires par auteur/type/date, accepter par lots) : le volet Vérifications de Word est limité.
25. **Prévisualisation multi-sorties en direct** (docx, PDF, EPUB, mobile) côte à côte avec ajustement de pagination : le moteur de pagination calculé est déjà isolé du DOM.

