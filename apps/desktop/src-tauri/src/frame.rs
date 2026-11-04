// Trame binaire des echanges de fichiers avec la page (pas de base64 dans du JSON) :
// [longueur de l'en-tete JSON : u32 petit-boutiste][en-tete JSON UTF-8][octets du fichier].
// Meme format dans les deux sens ; `apps/web/src/platform/tauri.ts` en est le miroir.

use std::borrow::Cow;

use base64::Engine as _;
use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

pub const MAX_HEADER: usize = 64 * 1024;

pub fn encode<T: Serialize>(header: &T, bytes: &[u8]) -> Vec<u8> {
    let json = serde_json::to_vec(header).unwrap_or_else(|_| b"{}".to_vec());
    let mut out = Vec::with_capacity(4 + json.len() + bytes.len());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    out.extend_from_slice(bytes);
    out
}

/// Corps binaire d'une requete. Android : la WebView ne transmet pas les corps binaires du protocole IPC,
/// la page envoie alors `{ "frame": "<base64>" }` (`apps/web/src/platform/tauri.ts`).
pub fn request_bytes<'a>(request: &'a Request<'_>) -> Result<Cow<'a, [u8]>, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(Cow::Borrowed(bytes)),
        InvokeBody::Json(value) => {
            let text = value.get("frame").and_then(serde_json::Value::as_str).ok_or("corps binaire attendu")?;
            base64::engine::general_purpose::STANDARD.decode(text).map(Cow::Owned).map_err(|e| format!("trame base64 invalide : {e}"))
        }
    }
}

pub fn decode<T: DeserializeOwned>(frame: &[u8]) -> Result<(T, &[u8]), String> {
    let Some(len_bytes) = frame.get(..4) else {
        return Err("trame trop courte".into());
    };
    let len = u32::from_le_bytes([len_bytes[0], len_bytes[1], len_bytes[2], len_bytes[3]]) as usize;
    if len > MAX_HEADER {
        return Err("en-tete de trame trop grand".into());
    }
    let Some(json) = frame.get(4..4 + len) else {
        return Err("trame tronquee".into());
    };
    let header = serde_json::from_slice(json).map_err(|e| format!("en-tete de trame invalide : {e}"))?;
    Ok((header, &frame[4 + len..]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Serialize, Deserialize, Debug, PartialEq)]
    struct Head {
        name: String,
        path: Option<String>,
    }

    #[test]
    fn aller_retour() {
        let head = Head { name: "été.docx".into(), path: None };
        let frame = encode(&head, &[0, 1, 2, 255]);
        let (back, bytes): (Head, &[u8]) = decode(&frame).unwrap();
        assert_eq!(back, head);
        assert_eq!(bytes, &[0, 1, 2, 255]);
    }

    /// Memes octets que `SHARED` dans apps/desktop/tests/tauri-bridge.test.ts (encodeFrame cote page).
    #[test]
    fn trame_commune_avec_la_page() {
        let mut shared = vec![24, 0, 0, 0];
        shared.extend_from_slice(br#"{"name":"a","path":null}"#);
        shared.extend_from_slice(&[1, 2]);
        let (head, bytes): (Head, &[u8]) = decode(&shared).unwrap();
        assert_eq!(head, Head { name: "a".into(), path: None });
        assert_eq!(bytes, &[1, 2]);
        assert_eq!(encode(&head, bytes), shared);
    }

    #[test]
    fn trames_invalides_refusees() {
        assert!(decode::<Head>(&[1, 0]).is_err());
        assert!(decode::<Head>(&[200, 0, 0, 0, b'{']).is_err());
        assert!(decode::<Head>(&[0, 0, 1, 0]).is_err());
        assert!(decode::<Head>(&[2, 0, 0, 0, b'[', b']']).is_err());
    }
}
