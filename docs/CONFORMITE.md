# Banc de conformité des commandes

Teste CHAQUE commande du ruban de CHAQUE application (Texte, Tableur, Présentation, Publication, Bloc-notes, PDF, Convertisseur) par de vrais clics
envoyés au navigateur (protocole CDP), puis mesure ce qui a réellement changé : le modèle du document, l'interface, les erreurs JavaScript.
Résultats : `docs/conformite/<module>.json` et `.md`, résumé `docs/conformite/RESUME.md` (mode téléphone : `docs/conformite/mobile/`).

## Lancer

```bash
npm install --ignore-scripts --no-audit --no-fund --prefer-offline
node apps/web/tests/conformity/run.mjs                  # tous les modules (le banc est lancé tout seul sur le port 5401 s'il est absent)
node apps/web/tests/conformity/run.mjs word excel       # certains modules
node apps/web/tests/conformity/run.mjs word --only=home # un onglet (ou un préfixe d'identifiant) ; --limit=30 pour les 30 premières
node apps/web/tests/conformity/run.mjs --mobile         # téléphone tactile 390x844, touchers CDP, ruban simplifié
node --test apps/web/tests/conformity.test.ts           # tests de la logique pure
```

Options : `--port=5401` (banc), `--cdp=9661` (débogage du navigateur). Variable `CHROME` : navigateur (sinon Chromium de Playwright, sinon Edge).
Un seul navigateur à la fois, profil temporaire supprimé à la fin. Durée : environ 2 s par commande (Texte : une quinzaine de minutes).

## Ce que fait le banc

1. **Crochet de test `window.__FO__`** (`apps/web/src/debug/hook.ts`), chargé seulement en développement (`import.meta.env.DEV`) : le build de production ne
   l'embarque pas (vérifié : aucune occurrence de `__FO__` ni de `registerProbe` dans `apps/web/dist`). Il expose :
   `commands()` (liste plate des commandes du schéma de ruban : identifiant `onglet.groupe.contrôle[#entrée/sous-entrée]`, chemin, libellé, type, état),
   `invoke(id, arg?)` (exécute sans souris), `snapshot()` (JSON du modèle de document, jamais du DOM), `select(préréglage)`, `presets()`,
   `reset(nom, base64)` (recharge le document de test), `consoleErrors()`, `ui(zones)` (signature de l'interface hors document).
   Chaque module déclare son `snapshot`/`select` par `registerProbe` (`probe.ts` de chaque paquet, appelé derrière `import.meta.env.DEV`).
   Le ruban expose ses onglets (`packages/ui/src/probe.ts`) et ses contrôles portent `data-cmd` / `data-cmd-item` pour être localisés.
2. **Documents de test** fabriqués par code (`apps/web/tests/conformity/fixtures-*.ts`) avec les paquets de formats.
3. **Boucle par commande** (`driver.mjs`) : document rechargé, sélection préparée (texte, mot, paragraphe, tableau, cellule, plage, forme, image, page...),
   clic réel sur l'onglet puis sur le contrôle (menus et galeries : ouverture puis clic de l'entrée ; couleurs : palette ; listes : option ; nombres : flèche),
   boîtes de dialogue remplies avec des valeurs plausibles puis validées, mesures avant/après.
4. **Contrôles complémentaires** : une commande à bascule exécutée deux fois doit revenir à l'état initial ; une boîte fermée par Échap ne doit rien changer ;
   les commandes de mise en forme sont comparées à la valeur attendue dans le snapshot (`expect-*.mjs`).
5. **Faux positifs réduits** : une commande classée AUCUN_EFFET, DESACTIVEE ou INACCESSIBLE est rejouée dans d'autres contextes de sélection avant d'être retenue.

## Classes

| Classe | Sens |
|---|---|
| EFFET_DOCUMENT | le snapshot du document a changé |
| EFFET_UI | boîte de dialogue, menu, palette, volet, bascule d'affichage, notification |
| AUCUN_EFFET | ni document, ni interface, ni plateforme, dans tous les contextes essayés : **suspect, option qui ne fait rien** |
| ERREUR | exception JavaScript, rejet de promesse non géré ou `console.error` pendant la commande |
| DESACTIVEE | contrôle désactivé alors que le contexte était préparé (annuler/rétablir/coller à vide : attendu, non compté) |
| EXIGE_PLATEFORME | sélecteur de fichier, impression, presse-papiers système, téléchargement : noté, pas un échec |
| INACCESSIBLE | contrôle du schéma introuvable dans le DOM (onglet contextuel jamais affiché, groupe non déployable) |
| NON_TESTE | contrôle de rendu libre sans bouton |

Défauts = ERREUR + AUCUN_EFFET + DESACTIVEE suspecte + INACCESSIBLE + valeur de format absente + bascule qui ne revient pas + Échap qui casse l'état.
Taux fonctionnel = commandes avec effet constaté et sans défaut associé / commandes testables (EXIGE_PLATEFORME et NON_TESTE exclus).

## Limites connues

- Base de données : le banc navigateur n'a pas de moteur natif (mode démonstration en lecture seule) ; ce qui exige la coquille est marqué ainsi dans le rapport.
- Seul le ruban est parcouru (pas le Backstage, les menus contextuels ni les raccourcis clavier).
- Les presse-papiers (copier/coller) et la sélection de fichiers dépendent de la plateforme : classés EXIGE_PLATEFORME.
- Une commande sans effet *visible dans le modèle* (par exemple un réglage purement visuel du rendu) apparaît en AUCUN_EFFET si l'interface ne change pas non plus :
  vérifier à la main avant de corriger (voir la mesure des faux positifs dans le rapport de livraison).
