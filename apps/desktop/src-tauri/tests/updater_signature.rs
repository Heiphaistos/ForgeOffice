//! Preuve que la mise a jour REFUSE un paquet dont la signature minisign est fausse ou dont les octets sont alteres.
//! `updates::desktop::install` passe par `Update::download` / `download_and_install` : c'est la que le plugin verifie.
//! Ici : vraie pile du plugin (UpdaterExt, appli factice) contre un serveur HTTP local, sans reseau reel. Cles de test
//! jetables (jamais celles de la release) : A = cle de confiance de la config, B = une autre.
#![cfg(desktop)]

use std::io::{Read, Write};
use std::net::TcpListener;

use tauri_plugin_updater::UpdaterExt;

const PAYLOAD: &[u8] = b"FORGEOFFICE-UPDATE-PAYLOAD-OK";
const PUBKEY_A: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgKHRlc3QpClJXU2VaWHNCcjhjN2JKZ29tRGpNZENYVlNER2VOK3pvb05UQkZQNm04OVdXbGE5SmpRVjRFRUVFCg==";
/// PAYLOAD signe par A, version 99.0.0.
const SIG_A_OK: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSAodGVzdCkKUlVTZVpYc0JyOGM3Ykkvc282b2thb3JUMVZ4SjJ4elFVb2oveUlDT1BRRm82RWt1dXBrTC9Gb3FRZitBOXJOTUlqK2FRdGxtSlZXb0x0MGRYNFduTXpIVEFoakIyYlNtN0FBPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxCWZpbGU6eAl2ZXJzaW9uOjk5LjAuMAoyb0EzNWlvV1J1bzZ3NnFxOWRnOUh3Rm1NSXlSY2E2UjFyQXV4NFRuY1J5SmpyVE1acE9FMWhFTlRTNVhhZ2JuWTZ5cUlkakxZZDNjZ0tXL1ZXR2VEZz09Cg==";
/// PAYLOAD signe par la cle B (inconnue de la config).
const SIG_B: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSAodGVzdCkKUlVUZ3Q3cHN4SEtLUHR1T3lkRzFIVTI1UTNnMDJHMHVFcEJ3a0VnNmRBODZrTDZXWmFZbTB1RTZTT0VVUWgyMDRnQlRLejJsOEdIdEFlZkhETWtweVFTTU9ZWTd2eVZaZFFzPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxCWZpbGU6eAl2ZXJzaW9uOjk5LjAuMApWdjBFM2Z3M3NWaHZaTDE2NTNMSTBBanA4NUdYdXgrU1k0aTR6UTdYaE1zNmpMVE1RSU1sM0xJbHhiZVkzRVdxVXdIOHNnTDR5TWxHS3cweDY3Z2lDUT09Cg==";

/// Sert `latest.json` (annonce `signature`) puis `payload` ; rend l'URL du manifeste.
fn serve(signature: &'static str, payload: &'static [u8]) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("port local");
    let port = listener.local_addr().expect("adresse").port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut s) = stream else { continue };
            let mut buf = [0u8; 2048];
            let n = s.read(&mut buf).unwrap_or(0);
            let first = String::from_utf8_lossy(&buf[..n]).lines().next().unwrap_or("").to_string();
            let body: Vec<u8> = if first.contains("latest.json") {
                let target = tauri_plugin_updater::target().expect("cible");
                format!(r#"{{"version":"99.0.0","platforms":{{"{target}":{{"url":"http://127.0.0.1:{port}/pkg","signature":"{signature}"}}}}}}"#).into_bytes()
            } else {
                payload.to_vec()
            };
            let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
            let _ = s.write_all(&body);
        }
    });
    format!("http://127.0.0.1:{port}/latest.json")
}

/// `check()` puis `download()` sur une appli factice dont la cle de confiance est A.
fn download(signature: &'static str, payload: &'static [u8]) -> Result<Vec<u8>, String> {
    let url = serve(signature, payload);
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({ "pubkey": PUBKEY_A, "endpoints": [url], "dangerousInsecureTransportProtocol": true }),
    );
    let app = tauri::test::mock_builder().plugin(tauri_plugin_updater::Builder::new().build()).build(context).map_err(|e| e.to_string())?;
    tauri::async_runtime::block_on(async {
        let update = app.handle().updater_builder().build().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?.ok_or("aucune mise a jour")?;
        update.download(|_, _| {}, || {}).await.map_err(|e| e.to_string())
    })
}

#[test]
fn signature_valide_acceptee() {
    assert_eq!(download(SIG_A_OK, PAYLOAD).expect("une signature valide doit passer (temoin : le test n'est pas vide)"), PAYLOAD);
}

#[test]
fn signature_d_une_autre_cle_refusee() {
    let e = download(SIG_B, PAYLOAD).expect_err("signature d'une autre cle : refus attendu");
    assert!(e.contains("different key"), "{e}");
}

#[test]
fn paquet_altere_refuse() {
    let e = download(SIG_A_OK, b"FORGEOFFICE-UPDATE-PAYLOAD-EVIL").expect_err("octets modifies : refus attendu");
    assert!(e.contains("verification failed"), "{e}");
}
