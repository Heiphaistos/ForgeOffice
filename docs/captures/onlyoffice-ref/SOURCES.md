# Références OnlyOffice (profil « OnlyOffice »)

OnlyOffice n'est pas installé sur ce PC. Références publiques (dépôt ONLYOFFICE/web-apps, branche master, relevé 2026-11-13) :

- `src/*.less`, `src/full-theme-*.json` : variables et couleurs (colors-table.less, colors-table-dark.less, variables.less, toolbar.less, buttons.less, thèmes d'exemple).
  Valeurs reprises : titre 28 px, onglets 32 px, barre d'outils 66 px, groupes 52 px, petits boutons 20 px, champs 22 px, barre d'état 25 px ;
  en-têtes Document #446995, Tableur #40865c, Présentation #be664f, PDF #aa5252 ; barre #f7f7f7, bordure #cbcbcb, survol #e0e0e0, appui #cbcbcb ;
  sombre : en-tête #2a2a2a, barre #404040, fond #333, bordure #616161, survol #555, appui #707070, zone de travail #555.
- `documenteditor/ spreadsheeteditor/ presentationeditor/ pdfeditor/` : captures d'aide officielles des Desktop Editors (`desktop_*.png`, images du dépôt, aide en anglais).
- `avant/` : rendu du profil avant ce travail ; `apres/` : rendu actuel (clair et sombre, 7 modules, vue Fichier, panneau Paramètres, mobile).
- Banc : `node apps/web/tests/e2e/oo-shots.mjs <port vite> <port cdp> <dossier> [modules]`.

Manque : captures officielles en français, icônes OnlyOffice (le profil garde les icônes Fluent de la suite).
