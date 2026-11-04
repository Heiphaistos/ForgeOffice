# Livraison de ForgeOffice (exigences du proprietaire, 2026-11-03)

ForgeOffice est une application LOCALE d'abord : tout fonctionne hors ligne, sans serveur, les documents restent sur la machine.
Le banc navigateur (`apps/web` lance seul) sert aux tests ; un site web pourra s'appuyer dessus plus tard, en option.

## Windows (prioritaire)

| Livrable | Architecture | Format |
|---|---|---|
| Installeur | 64 bits (x86_64-pc-windows-msvc) | `.exe` NSIS par utilisateur, sans droits administrateur |
| Installeur | 64 bits | `.msi` (WiX) pour deploiement en entreprise |
| Installeur | 32 bits (i686-pc-windows-msvc) | `.exe` NSIS |
| Installeur | 32 bits | `.msi` |
| Portable | 64 bits et 32 bits | `.exe` unique (interface embarquee dans l'executable), reglages a cote de l'exe si un fichier `portable.flag` est present |

- WebView2 : present sur Windows 10/11 ; l'installeur embarque le bootstrapper pour les machines qui ne l'ont pas. Le portable signale clairement son absence.
- Mise a jour automatique dans les trois variantes (le portable remplace son propre exe), signature minisign verifiee avant installation.
- Associations de fichiers et entree « Ouvrir avec ForgeOffice » dans les installeurs.
- Fermeture propre : aucun processus restant (regle commune a toutes les applis du proprietaire).

## Autres systemes

- Linux : AppImage + .deb + .rpm (toujours les trois).
- macOS : .dmg (Apple silicon et Intel).
- Android : .apk/.aab ; iOS : via macOS (CI).

## Commandes Windows (verifiees le 2026-11-04)

```bash
cd apps/desktop
npm run build:win64      # NSIS puis MSI 64 bits (le MSI se construit avec src-tauri/windows/msi.conf.json)
npm run build:win32      # idem 32 bits
npm run portable:win64   # target/x86_64-pc-windows-msvc/release/forgeoffice.exe (a renommer ForgeOffice_<v>_x64_portable.exe)
npm run portable:win32
```

- NSIS et MSI ne se construisent PAS dans la meme commande : le MSI est produit sans `fileAssociations`
  (voir « Associations » ci-dessous), d'ou deux appels `tauri build`.
- Signature des paquets de mise a jour : la cle privee se passe par variable d'environnement, jamais dans un fichier
  du depot. Pour signer apres coup un fichier deja construit (depuis bash, qui garde les variables vides ; la cle v2 a un mot de passe) :
  `TAURI_SIGNING_PRIVATE_KEY_PATH=<cle> TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat <fichier mot de passe>)" npx tauri signer sign <fichier>`
  (ecrit `<fichier>.sig`). Pour signer pendant le build, `TAURI_SIGNING_PRIVATE_KEY=<chemin ou contenu>`
  (le build ne lit pas `..._PATH`). Sans cle, ajouter `--config '{"bundle":{"createUpdaterArtifacts":false}}'`.
  Cle de production : `D:\MDP\forgeoffice-updater-v2.key` (+ `.password`, `.key.pub` = `plugins.updater.pubkey`).

## Signature en deux temps (verifie le 2026-11-04) : Authenticode PUIS minisign

L'ordre compte : signer en Authenticode MODIFIE le fichier, donc la signature minisign (`.sig`), `SHA256SUMS` et `latest.json`
se font apres, sur le fichier final.

1. Authenticode (certificat auto-signe `CN=Heiphaistos`, empreinte `E017A7FB...98EE`, magasin `Cert:\CurrentUser\My` ; fiche
   `reference_signature_code_windows.md`, outil `D:\Projet\outils\signer\signer.ps1`) :
   - installeurs NSIS et MSI : Tauri signe tout seul l'exe de l'application, les greffons NSIS, le setup et le `.msi` quand on ajoute
     UNE CONFIG DE BUILD hors depot (jamais l'empreinte dans `tauri.conf.json`) : `--config .logs/build/sign.conf.json` =
     `{"bundle":{"windows":{"certificateThumbprint":"E017...98EE","digestAlgorithm":"sha256","timestampUrl":"http://timestamp.digicert.com"}}}`.
     Le meme jeu d'options sert au NSIS et au MSI. `bundle.windows.signCommand` (avec `powershell -File signer.ps1 %1`) NE marche PAS
     (« failed to run powershell », puis « program not found » avec un `.cmd`) : ne pas perdre de temps dessus.
   - portables (`--no-bundle`, non signes par Tauri) : `powershell -File D:\Projet\outils\signer\signer.ps1 <exe>` sur la copie finale.
   - L'horodatage (RFC 3161, DigiCert) est un appel reseau sortant, necessaire : sans lui la signature expire avec le certificat (2031).
2. minisign : `npx tauri signer sign` sur chaque `.exe` d'installation et chaque portable (pas les MSI).
3. `sha256sum *.exe *.msi > SHA256SUMS` puis `node scripts/make-latest-json.mjs --dir <livrables> --version 0.1.0 --base-url <URL> [--strict]`.
4. Verifier : `Get-AuthenticodeSignature` = `UnknownError` (certificat dont la racine n'est pas installee : normal ; `HashMismatch` ou
   `NotSigned` serait une erreur), `.sig` plus recent que le fichier.

Pieges (cycle du 2026-11-04) :
- Sous Git Bash, `setup.exe /S` est converti en `S:/` (conversion de chemins MSYS) : le setup s'ouvre en mode graphique et attend.
  Lancer depuis PowerShell (`Start-Process ... -ArgumentList '/S' -Wait`) ou avec `MSYS_NO_PATHCONV=1`.
- Chaque jeu de `--config` different (ou version differente) recompile la coquille (5 a 10 min) : garder les memes options entre NSIS
  et MSI quand c'est possible. Le LTO complet + `codegen-units = 1` echoue avec `rustc-LLVM ERROR: out of memory` quand le PC est
  charge par d'autres sessions (fichier d'echange petit) : relancer plus tard (reessayer en boucle) ; pour les builds de TEST
  seulement (pas les livrables) `CARGO_PROFILE_RELEASE_LTO=off CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16` suffit.
- La config de test de mise a jour ne doit changer que `plugins.updater.endpoints` et `dangerousInsecureTransportProtocol` : la fusion
  garde la cle publique de production (`.logs/build/test-update2.conf.json`). L'appli de test lit son endpoint a la compilation :
  il faut donc une 0.1.0 DE TEST (meme code, autre endpoint), pas la 0.1.0 finale.
- Premier build : Tauri telecharge NSIS, WiX et le bootstrapper WebView2 (normal) ; un build complet par cible
  prend 5 a 10 min (LTO, `codegen-units = 1`).
- Le frontal (`apps/web/dist`) est construit par `beforeBuildCommand` ; chemins relatifs (`base: './'`), worker
  pdf.js en `.mjs` servi en `text/javascript` par le protocole Tauri ; aucune police externe.

## Associations de fichiers Windows (corrige le 2026-11-04)

Constate en vrai sur le PC de dev : les modeles de Tauri abimaient les associations du systeme.

| Paquet | Defaut d'origine (Tauri 2.10) | Correctif |
|---|---|---|
| NSIS | prend le defaut HKCU des 59 extensions ; a la desinstallation ecrit un defaut VIDE qui masque HKLM (`.docx` sans Word, `.txt` sans Bloc-notes) ; une mise a jour perd la sauvegarde d'origine | crochets `src-tauri/windows/hooks.nsh` (generes par `npm run associations`) |
| MSI | extensions « annoncees » : remplace le defaut HKLM (Word, Excel...) et, a la desinstallation, Windows Installer SUPPRIME les cles `HKLM\Software\Classes\.<ext>` entieres (37 cles perdues pendant le test, restaurees depuis un cliche) | MSI construit sans `fileAssociations` + fragment `src-tauri/windows/associations.wxs` (ProgID + « Ouvrir avec » seulement) |

Resultat :
- NSIS : ForgeOffice devient le defaut (HKCU) des formats bureautiques et de ses formats propres ; les formats
  generiques (`.txt .json .csv .html .db`... rang `Alternate`) gardent leur programme et proposent ForgeOffice dans
  « Ouvrir avec » ; verbe « Ouvrir avec ForgeOffice » ; desinstallation = registre identique a l'avant (verifie).
- MSI : aucun defaut modifie sauf `.fodb` / `.fopub` ; « Ouvrir avec » pour tout le reste ; desinstallation = registre
  identique a l'avant (verifie, 64 et 32 bits). Le choix des defauts reste a l'administrateur (strategie de groupe).
- La desinstallation NSIS oublie le dossier d'installation (`HKCU\Software\Heiphaistos\ForgeOffice`), sinon un MSI
  installe ensuite reprenait `%LOCALAPPDATA%\ForgeOffice` au lieu de `Program Files`.

## Tester la mise a jour sans reseau externe (verifie le 2026-11-04)

Configuration de TEST separee, la production n'est jamais modifiee (`.logs/build/test-update.conf.json`, hors depot) :
`plugins.updater.endpoints = ["http://127.0.0.1:8765/latest.json"]`, `dangerousInsecureTransportProtocol = true`, et la cle
publique d'une paire JETABLE (`npx tauri signer generate -w <dossier>/test.key -p "" --ci`).

1. Construire 0.1.0 et 0.1.1 avec `--config <test-update.conf.json> --config {"version":"X"}` (NSIS : `--bundles nsis` ;
   portable : `--no-bundle --features portable`).
2. Signer les paquets 0.1.1 avec la cle jetable (`TAURI_SIGNING_PRIVATE_KEY_PATH=<test.key> TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npx tauri signer sign <fichier>`).
3. `latest.json` : `windows-x86_64` (installeur NSIS) et `windows-x86_64-portable` (exe), `url` en `http://127.0.0.1:8765/...`
   et `signature` = contenu du `.sig` (cle jetable, ou la cle v2 de production avec la config `test-update2.conf.json` : verifie le 2026-11-04). Servir avec `python -I -m http.server 8765 --bind 127.0.0.1`.
4. Installer 0.1.0, Accueil > Options > « Rechercher une mise a jour » puis « Installer et redemarrer ».
5. Negatif : mettre dans le manifeste le `.sig` d'un AUTRE fichier : l'installation est refusee, la version reste 0.1.0.

Resultat : NSIS 0.1.0 -> 0.1.1 (relance en 0.1.1, ARP 0.1.1), portable 0.1.0 -> 0.1.1 (exe remplace, `.old` supprime),
signature fausse refusee.

La paire v2 (`forgeoffice-updater-v2.key`) a ete prouvee le 2026-11-04 : signature des paquets avec le mot de passe, verification par l'application (NSIS et portable, voir `apps/desktop/STATUS.md`). La paire v1 (`forgeoffice-updater.key`) n'est plus utilisee.
