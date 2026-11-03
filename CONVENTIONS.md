# Conventions ForgeOffice (a lire avant toute modification)

ForgeOffice est une suite bureautique ecrite de A a Z : Texte (equivalent Word), Tableur (Excel),
Presentation (PowerPoint), Publication (Publisher), Base de donnees (Access), PDF.
Esthetique cible : Microsoft Office 2024 / Microsoft 365 (Fluent 2), interface 100 % francaise.
Plateformes : Windows, Linux, macOS (Tauri 2 bureau), Android et iOS (Tauri 2 mobile), navigateur (banc de test).

## Arborescence

| Dossier | Role |
|---|---|
| `packages/core` | Contrats partages (`Services`, `ModuleProps`), implementation navigateur, pile annuler/retablir |
| `packages/opc` | Lecture/ecriture sures des paquets OOXML (zip + XML + relations), sans dependance XML |
| `packages/ui` | Systeme de design Office 2024 : barre de titre, ruban, Backstage (Fichier), barre d'etat, dialogues, icones Fluent |
| `packages/formulas` | Moteur de formules Excel (analyse, evaluation, recalcul, formats de nombre, noms francais) |
| `packages/docx`, `xlsx`, `pptx` | Modeles de document + lecture/ecriture des formats Office |
| `packages/word`, `excel`, `powerpoint`, `publisher`, `access`, `pdf`, `hub` | Les applications |
| `apps/web` | Application Vite unique qui charge le module demande (`?app=word`) ; sert aussi de banc de test navigateur |
| `apps/desktop/src-tauri` | Coquille Tauri 2 (bureau + mobile), mise a jour automatique, fenetres par module |
| `crates/forge-base` | Moteur SQLite (rusqlite) du module Base de donnees |

## Regles de code

- TypeScript strict (`tsconfig.base.json`). Interdit : `any`, `@ts-ignore`, `enum`, `namespace`, proprietes de parametres de constructeur (syntaxe effacable seulement : les tests tournent avec `node --test` qui retire les types).
- Imports relatifs AVEC l'extension `.ts` / `.tsx`. Imports entre paquets par le nom du paquet (`@forgeoffice/core`) qui pointe sur `src/index.ts`.
- Un fichier vise 800 lignes, 1000 maximum : au-dela, decouper par responsabilite sans perdre de fonction.
- Aucun texte visible en dur dans les composants : tout texte d'interface vit dans `src/strings.ts` du paquet (objet `const` en francais).
- Pas de code mort, pas de `try/catch` vide, pas de `console.log` laisse.
- Toute donnee venant d'un fichier est hostile : limites de taille, pas d'`eval`, pas de `innerHTML` non nettoye (DOMPurify), liens `javascript:` refuses, chemins zip valides.
- Tests : `packages/<p>/tests/*.test.ts` avec `node:test` + `node:assert/strict`. Lancer : `node --test packages/<p>/tests/*.test.ts`. Code teste = code sans DOM ; le code DOM se verifie dans le navigateur.
- React 19 avec composants fonctions et hooks. CSS : fichiers `.css` par composant avec les variables de `packages/ui/src/tokens.css`. Pas de Tailwind.

## Dependances

Deja installees a la racine : react, react-dom, prosemirror-*, jszip, dompurify, @tauri-apps/*, vite, @vitejs/plugin-react, typescript, @fluentui/svg-icons (MIT).
Ajouter une dependance seulement si quelques lignes ne suffisent pas, et toujours sous verrou (plusieurs agents travaillent en meme temps) :

```bash
cd /d/Projet/ForgeOffice && until mkdir .npm-lock 2>/dev/null; do sleep 3; done; npm install --ignore-scripts --no-audit --no-fund <paquet> -w packages/<p>; rmdir .npm-lock
```

Jamais de `git` (l'orchestrateur commite), jamais de publication, jamais de suppression hors de son propre dossier.

## Verification visuelle (exigence de Momo)

Tout travail visuel se verifie les yeux sur le rendu : lancer le banc `npm run dev -w apps/web -- --port <port libre>` en arriere-plan,
ouvrir `http://127.0.0.1:<port>/?app=<module>` dans un onglet Chrome cree pour soi (outils claude-in-chrome, `tabs_create_mcp`),
faire une capture, la comparer a Office 2024, corriger, recapturer. Enregistrer les captures finales dans `docs/captures/<module>-<sujet>.png`
(capture `save_to_disk` puis copie). Fermer son onglet et arreter son serveur a la fin.

## Couleurs d'application (Fluent)

Texte `#185ABD` · Tableur `#107C41` · Presentation `#C43E1C` · Publication `#077568` · Base de donnees `#A4373A` · PDF `#B30B00`.
