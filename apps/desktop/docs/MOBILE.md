# ForgeOffice sur Android et iOS

La meme crate (`apps/desktop/src-tauri`, bibliotheque `forgeoffice_lib`) sert au bureau et au mobile :
`src/lib.rs` porte `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, et tout ce qui n'a de sens que sur bureau est
sous `cfg(desktop)` ou dans `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
Le code propre a Android est sous `cfg(target_os = "android")` (`android.rs`) ; le projet Gradle est SUIVI par git
(`src-tauri/gen/android`, sauf `build/`, `.gradle/`, `local.properties`, `*.apk`, `*.aab`, `gen/schemas`).

| Fonction | Bureau | Android |
|---|---|---|
| Fenetres | une par document, barre de titre dessinee par la page | une seule vue ; la coquille web change de module sans recharger (`NAVIGATE_EVENT`) |
| Fichiers | chemins absolus autorises (`grants.rs`), ecriture atomique | **bibliotheque privee** (voir plus bas) ; les octets transitent par la page (256 Mo max) |
| Ouvrir avec / Partager vers | ligne de commande, associations | intent-filters `VIEW` / `SEND` -> `ForgePlugin.kt` -> `inbox_take` |
| Partager | - | feuille de partage Android (`FileProvider` limite a `cache/share/`), menu « ... » des fichiers recents de l'Accueil |
| Impression | dialogue du systeme | `PrintManager` (A4, « Enregistrer au format PDF ») via `print_window` |
| Retour | - | module -> Accueil (confirmation si modifie) ; Accueil -> quitter ; dialogue/menu/Backstage/diaporama -> Echap |
| Diaporama | plein ecran navigateur | mode immersif natif (`set_immersive`) : `requestFullscreen` est annule par la WebView Android, la page le remplace |
| Barres systeme | - | bord a bord ; contenu retaille aux barres, a l'encoche et au clavier (`MainActivity.kt`), icones claires/sombres suivant le theme (`set_system_bars`) |
| Mise a jour | `tauri-plugin-updater` | aucune dans l'appli : `Services.updater` vaut `null`, l'Accueil > Options l'indique ; on reinstalle l'APK par-dessus |
| Reseau | - | aucune permission (`INTERNET` n'existe que dans `src/debug/AndroidManifest.xml`), `allowBackup=false`, pas de trafic en clair |

## Architecture des fichiers (Android)

Android ne donne pas de chemin : le selecteur du systeme (SAF) renvoie des `content://`.

1. **Ouvrir** : `ForgePlugin.pickDocument` (ACTION_OPEN_DOCUMENT) copie le flux dans `files/library/.tmp`, Rust le range
   dans `files/library/<nom>` (`library.rs::adopt` : meme nom + meme contenu = reutilise, sinon `nom (2).ext`, jamais
   d'ecrasement), l'autorise (`grants`) et renvoie nom + octets + chemin reel. Tout le reste du code (recents,
   `read_path`, base de donnees `.fodb` ouverte par rusqlite) voit un chemin normal.
2. **Enregistrer** sur un document deja ouvert : ecriture atomique en place dans la bibliotheque.
3. **Enregistrer sous** / nouveau document : octets ecrits dans un fichier provisoire, `ForgePlugin.exportDocument`
   (ACTION_CREATE_DOCUMENT) les copie vers la destination choisie (Documents, Drive...), puis le fichier est range dans
   la bibliotheque sous le nom choisi : les « Enregistrer » suivants mettent a jour la copie de la bibliotheque
   (pas le fichier exporte : refaire « Enregistrer sous » ou « Partager » pour le sortir).
4. **Base de donnees** : `base_create` cree un `.fodb` dans la bibliotheque ; `base_copy` = export SAF.
5. **Recus** (Ouvrir avec, Partager vers) : copies dans la bibliotheque, ouverts dans le module de l'extension
   (`moduleForFile`) ; l'evenement `fo-inbox` previent la page quand l'appli tourne deja.
6. **Accueil > « Cet appareil »** = fichiers recents (chemins de la bibliotheque). Pas de permission de stockage :
   aucun document ne quitte l'appli sans geste de l'utilisateur.

Particularite IPC : la WebView Android ne transmet pas les corps binaires du protocole IPC de Tauri. La page envoie
les trames en base64 (`{ frame }`, `apps/web/src/platform/tauri.ts` `invokeShell`) ; `frame::request_bytes` accepte les deux.
pdf.js est charge dans sa version `legacy` (la WebView n'a pas `Uint8Array.toHex`).

## Prerequis locaux (Windows)

- SDK Android (`ANDROID_HOME`, platform 36, build-tools 36.0.0), NDK 27 (`NDK_HOME`), JDK 17 (`JAVA_HOME`).
- Cibles Rust : `rustup target add aarch64-linux-android x86_64-linux-android` (+ `armv7-linux-androideabi i686-linux-android` si besoin).
- `@tauri-apps/cli` (a la racine du monorepo), `npm install --ignore-scripts`.
- Disque : mettre `GRADLE_USER_HOME` et `CARGO_TARGET_DIR` hors du depot et de `C:` (ex. `D:\gradle-home`, `D:\cargo-target-android`).
- Memoire : sans fichier d'echange suffisant, vite/esbuild et l'emulateur peuvent mourir (« out of memory ») quand plusieurs
  compilations tournent ; arreter les demons Gradle (`./gradlew --stop`) ou construire avec
  `GRADLE_OPTS="-Dorg.gradle.daemon=false -Dkotlin.compiler.execution.strategy=in-process"`.
- Lancer depuis PowerShell : Gradle ne retrouve pas `npm` depuis certains environnements Git Bash.

## Commandes

```powershell
$env:ANDROID_HOME='C:\Android\sdk'; $env:NDK_HOME='C:\Android\sdk\ndk\27.0.12077973'
$env:GRADLE_USER_HOME='D:\gradle-home'; $env:CARGO_TARGET_DIR='D:\cargo-target-android'
$env:FORGEOFFICE_KEYSTORE_PROPERTIES='<dossier des secrets>\forgeoffice-android.keystore.properties'   # signature, voir plus bas
cd apps\desktop
npx tauri android build --apk --aab --split-per-abi --target aarch64 --target x86_64 --ci
```

Sorties : `src-tauri/gen/android/app/build/outputs/apk/<abi>/release/app-<abi>-release.apk` et `.../bundle/release/*.aab`.
`npx tauri android init` ne doit PAS etre relance (il ecraserait le projet suivi : manifeste, Kotlin, icones, signature).
`npm run android:dev` pour un appareil/emulateur branche ; `npm run check:android` verifie la compilation Rust.

- Identite : `org.heiphaistos.forgeoffice`, nom « ForgeOffice », minSdk 24, targetSdk 34, compileSdk 36, version = `tauri.conf.json`
  (`versionCode` derive : 0.1.0 -> 1000). Icone adaptative (vecteurs `res/drawable/ic_launcher_*.xml`, monochrome Android 13).
- Rotation libre ; tablette : la page reprend la disposition bureau au-dessus de ~720 px.

## Signature

Keystore PKCS12 de publication hors depot : `<dossier des secrets>\forgeoffice-android.keystore` (RSA 4096, alias `forgeoffice`,
10 000 jours), mot de passe dans `...keystore.password`, copie de sauvegarde sur un second disque. Gradle lit le fichier designe par
`FORGEOFFICE_KEYSTORE_PROPERTIES` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) ; sans variable, paquet non signe.
Verifier : `apksigner verify --print-certs <apk>`. Aucun secret, `.keystore`, `.jks` ni `keystore.properties` dans le depot
(`.gitignore`). CI : `.github/workflows/release.yml`, job `android`, secrets `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (le job ecrit le keystore dans `$RUNNER_TEMP`).

## Tests sur emulateur

AVD `forgeoffice_test` (Pixel 6, android-36 google_apis x86_64) dans `D:\android-avd` (`ANDROID_AVD_HOME`), lance sans fenetre :
`emulator -avd forgeoffice_test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot`.
Captures : `adb exec-out screencap -p > fichier.png` (`docs/captures/android-*.png`). Document de test :
`adb push x.docx /sdcard/Download/` puis Accueil > Ouvrir > selecteur systeme. Tablette : `adb shell wm size 1600x2560; adb shell wm density 320`
(`wm size reset; wm density reset` ensuite). Sous swiftshader, `dumpsys gfxinfo` n'est pas representatif de la fluidite reelle.

## Limites connues

- Pas de partage depuis l'interieur d'un module (Fichier > Partager) : seulement depuis l'Accueil ; « Enregistrer sous » permet
  d'envoyer vers Drive & co.
- Une copie exportee n'est pas resynchronisee : l'edition continue sur la copie de la bibliotheque.
- Le bouton Retour dans un module modifie propose « Rester » / « Fermer sans enregistrer » (pas « Enregistrer »).
- Un document recu pendant qu'un autre est modifie remplace le module affiche sans confirmation.
- Fichiers de plus de 256 Mo refuses. Convertisseur : pas de dossier de sortie sur mobile (resultats en memoire).
- WebView : Chrome >= 94 requis (cible ES2022) ; testee avec WebView 133.
- Ruban replie (« Afficher uniquement les onglets ») : plus de bouton pour le rouvrir sur telephone (UI tactile, lot mobile-ui).
- iOS : non construisible sous Windows. CI macOS (`macos-latest`) deja decrite dans `release.yml` ; il faudra un profil de
  signature Apple et verifier les documents (`file://` reels, pas de bibliotheque privee necessaire).

## iOS

macOS + Xcode obligatoires : `npm run ios:init`, `npm run ios:build` (profil de signature Apple requis).
Version minimale iOS 14 (`bundle.iOS.minimumSystemVersion`). Types de documents : `bundle.fileAssociations` -> `CFBundleDocumentTypes` ;
`fopub` et `fodb` sont des types exportes (`org.heiphaistos.forgeoffice.*`).
