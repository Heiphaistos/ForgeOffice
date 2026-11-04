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
  du depot. Pour signer apres coup un fichier deja construit :
  `TAURI_SIGNING_PRIVATE_KEY_PATH=<cle> TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npx tauri signer sign <fichier>`
  (ecrit `<fichier>.sig`). Pour signer pendant le build, `TAURI_SIGNING_PRIVATE_KEY=<chemin ou contenu>`
  (le build ne lit pas `..._PATH`). Sans cle, ajouter `--config '{"bundle":{"createUpdaterArtifacts":false}}'`.
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
