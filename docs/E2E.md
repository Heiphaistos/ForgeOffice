# Parcours entre applications (banc navigateur)

Les neuf applications ont chacune leurs tests ; ce banc vérifie leur **assemblage** : accueil, ouverture d'un fichier d'une
application dans une autre, conversions, presse-papiers, thème, téléphone, enregistrer / rouvrir.

## Lancer

```bash
cd /d/Projet/ForgeOffice
npm run dev -w apps/web -- --port 5321 &          # banc (à arrêter ensuite)
node apps/web/tests/e2e/flows.mjs                 # tous les parcours (environ 12 min)
node apps/web/tests/e2e/flows.mjs 1 4 7           # certains parcours seulement
```

- Aucune dépendance à installer : le pilote (`harness.mjs`) parle au navigateur par le protocole CDP (Node 24, `WebSocket` et `fetch` natifs).
  Navigateur : variable `CHROME`, sinon le Chromium de Playwright (`%LOCALAPPDATA%\ms-playwright`), sinon Edge.
- Variables : `FO_BASE` (défaut `http://127.0.0.1:5321`), `FO_CDP_PORT` (défaut 9581), `FO_SHOTS` (captures, défaut `docs/captures`),
  `FO_MOBILE_SHOTS` (une capture par application, défaut `.logs/e2e-mobile`).
- Un seul navigateur à la fois, en profil temporaire supprimé à la fin (`finally`). Code de sortie 1 s'il y a un échec.
- `prepare.ts` fabrique de **vrais fichiers** avec les paquets de la suite (`@forgeoffice/docx`, `xlsx`, `pptx`, `publisher`) et `pdf-lib` :
  `rapport.docx`, `chiffres.xlsx`/`.csv`, `expose.pptx`, `contrat.pdf`, `affiche.fopub`, `notes.md`, `script.py`, `inconnu.xyz`.
- Les gestes sont réels (souris, clavier, toucher par CDP). Seuls le sélecteur de fichiers du système et le téléchargement sont
  interceptés dans la page (le fichier choisi est injecté, le fichier téléchargé est relu) ; la grille du Tableur étant un canvas,
  son contenu est lu par la zone Nom et la barre de formule.

## Parcours

| N° | Contenu | Fichier |
|---|---|---|
| 1 | Vignettes « Nouveau », modèles, dépôt de 9 formats + format inconnu refusé, retour à l'Accueil depuis chaque application, rechargement de `?app=<chacun des 9>` | `flows.mjs` |
| 2 | « Ouvrir » inter-modules : les 6 applications de documents contre les 5 autres (29 couples) | `flows.mjs` |
| 3 | Bloc-notes > Convertir en Texte ; Texte > Exporter PDF ; Tableur > Exporter PDF ; Convertisseur .docx → .html / .txt puis ouverture du résultat | `flows.mjs` |
| 4 | Presse-papiers : Tableur → Texte (tableau), Tableur → Bloc-notes (texte tabulé), Texte → Tableur | `flows-b.mjs` |
| 5 | Console vide pour chaque application seule (1440 et 700 px), thème sombre depuis l'Accueil conservé partout | `flows-b.mjs` |
| 6 | Téléphone 400x860 tactile : débordements, contrôles hors écran, ruban compact ; planche `docs/captures/e2e-mobile-planche.png` | `flows-mobile.mjs` |
| 7 | Enregistrer (Ctrl+S) puis rouvrir : Texte, Tableur, Présentation, Publication, Bloc-notes | `flows-b.mjs` |

Chaque parcours se termine par un contrôle « console sans erreur ni avertissement pendant tout le parcours » (erreurs React comprises).

## Dernier passage (2026-11-04) : 161 contrôles, 161 OK, 0 échec

| N° | Contrôles | Résultat |
|---|---|---|
| 1 | 6 vignettes, 5 modèles, 9 dépôts (+ `.fodb`) avec lecture du contenu, format inconnu refusé, 8 retours à l'Accueil, 9 rechargements | OK (après correction : Bloc-notes n'avait aucun chemin de retour) |
| 2 | 29 couples « Ouvrir » inter-modules, bonne application + bon contenu | OK (après correction centrale dans `Shell.tsx` : sans elle Texte ouvrait un .xlsx comme document et Tableur échouait sur un .docx) |
| 3 | Bloc-notes → Texte, export PDF Texte et Tableur, Convertisseur .docx → .html et .txt puis « Ouvrir » | OK |
| 4 | Tableur → Texte (tableau 4x3), Tableur → Bloc-notes (tabulé), Texte → Tableur | OK |
| 5 | 18 chargements seuls (1440 et 700 px) sans message console, thème sombre sur les 9 applications | OK (après correction : imbrication `<button>` du Convertisseur, icône manquante) |
| 6 | 9 applications à 400 px : 27 contrôles automatiques + 7 changements d'onglet du ruban compact | OK (après corrections de mise en page, voir `MOBILE-UI.md`) |
| 7 | Enregistrer (Ctrl+S) puis rouvrir : Texte, Tableur (valeurs et formule), Présentation (3 diapositives), Publication, Bloc-notes | OK |

Un contrôle « console propre » termine chaque parcours : aucun avertissement React (clés, état) relevé.

## Particularités constatées (par conception, pas des défauts)

- Dans le navigateur, « Exporter en PDF » (Texte, Tableur) lance l'impression du navigateur (« Enregistrer au format PDF ») ; le PDF direct passe par le Convertisseur ou l'application de bureau.
- Publication ouvre aussi les `.pptx` depuis son propre « Ouvrir » (son filtre les propose) : ce couple reste dans Publication.
- Publication démarre sur la page Backstage « Nouveau » (choix du format de page), comme Publisher.
- Base de données : sans moteur natif, le navigateur n'affiche que la démonstration en lecture seule.
