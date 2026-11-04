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

## Commandes (a completer par la coquille)

```bash
cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi
cargo tauri build --target i686-pc-windows-msvc --bundles nsis,msi
```
