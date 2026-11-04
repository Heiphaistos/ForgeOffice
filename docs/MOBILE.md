# ForgeOffice sur Android et iOS

La meme crate (`apps/desktop/src-tauri`, bibliotheque `forgeoffice_lib`) sert au bureau et au mobile :
`src/lib.rs` porte `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, et tout ce qui n'a de sens que sur
bureau est sous `cfg(desktop)` ou dans `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.

| Fonction | Bureau | Mobile |
|---|---|---|
| Fenetres | une par document, barre de titre dessinee par la page | une seule vue, le module est charge par navigation (`open_module` renvoie l'URL) |
| Instance unique | `tauri-plugin-single-instance` | sans objet (le systeme gere) |
| Mise a jour | `tauri-plugin-updater` (signature minisign) | boutique d'applications ; `update_check` renvoie une erreur explicite, `Services.updater` vaut `null` |
| Ouvrir avec / partage | ligne de commande, associations | evenement `RunEvent::Opened` (URL `content://` sur Android) ; lecture et ecriture par `tauri-plugin-fs` |
| Barre de titre | `Services.windowControls` | `null` (barre systeme) |

## Prerequis locaux (Windows, deja installes sur le PC de dev)

- SDK Android : `C:\Android\sdk` (`ANDROID_HOME`), NDK `C:\Android\sdk\ndk\27.0.12077973` (`NDK_HOME`).
- JDK 17 : `JAVA_HOME` (Microsoft OpenJDK 17).
- Cibles Rust : `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.
- `@tauri-apps/cli` (deja a la racine du monorepo).

## Android

```bash
cd /d/Projet/ForgeOffice/apps/desktop
npm run android:init      # une fois : genere src-tauri/gen/android (projet Gradle)
npm run android:dev       # appareil ou emulateur branche (adb devices)
npm run android:build     # .apk + .aab dans src-tauri/gen/android/app/build/outputs
npm run check:android     # verification rapide de la compilation Rust (aarch64)
```

- Version minimale : Android 7 (API 24, `bundle.android.minSdkVersion`).
- Signature de publication : keystore hors depot (`D:\MDP\`), declaree dans `gen/android/keystore.properties`
  (jamais commitee). Sans keystore, `android:build` produit un paquet non signe.
- Associations « Ouvrir avec » : apres `android:init`, ajouter les `intent-filter` (ACTION_VIEW + ACTION_SEND,
  types MIME de `bundle.fileAssociations`) dans `gen/android/app/src/main/AndroidManifest.xml`.

## iOS

macOS + Xcode obligatoires : la construction se fait sur un Mac ou en CI (`macos-latest`).

```bash
npm run ios:init
npm run ios:build         # .ipa (profil de signature Apple requis)
```

- Version minimale : iOS 14 (`bundle.iOS.minimumSystemVersion`).
- Types de documents : `bundle.fileAssociations` alimente `CFBundleDocumentTypes` ; `fopub` et `fodb` sont
  declares comme types exportes (`org.heiphaistos.forgeoffice.*`).

---

Copie de `apps/desktop/docs/MOBILE.md` (l'original est conservé à côté de la coquille). Voir aussi [`ARCHITECTURE.md`](ARCHITECTURE.md), [`PACKAGING.md`](PACKAGING.md) et, pour la signature Android et iOS, [`DECISIONS-A-PRENDRE.md`](DECISIONS-A-PRENDRE.md) (§6). Le workflow `.github/workflows/release.yml` construit l'`.apk` (non signé) avec `tauri android init --ci` puis `tauri android build --apk`.
