// Documents a ouvrir dans une fenetre : ligne de commande, association de fichiers, seconde instance,
// ou « ouvrir dans une nouvelle fenetre ». La fenetre recoit un jeton opaque dans son URL
// (`index.html?app=word&token=...`) et echange ce jeton contre le document avec `take_launch`.

use std::collections::HashMap;
#[cfg(any(desktop, test))]
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::grants::lock;

/// Assez long pour un rechargement de la page (F5) apres l'ouverture.
pub const LAUNCH_TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LaunchFile {
    /// Chemin deja autorise : relu a la demande.
    Path(String),
    /// Octets deja lus par une autre fenetre (document sans chemin).
    Bytes { name: String, bytes: Vec<u8> },
}

struct Entry {
    file: LaunchFile,
    expires: Instant,
}

#[derive(Default)]
pub struct Launches {
    entries: Mutex<HashMap<String, Entry>>,
}

impl Launches {
    pub fn put(&self, file: LaunchFile) -> String {
        self.put_at(file, Instant::now())
    }

    pub fn get(&self, token: &str) -> Option<LaunchFile> {
        self.get_at(token, Instant::now())
    }

    fn put_at(&self, file: LaunchFile, now: Instant) -> String {
        let token = new_token();
        let mut entries = lock(&self.entries);
        entries.retain(|_, e| e.expires > now);
        entries.insert(token.clone(), Entry { file, expires: now + LAUNCH_TTL });
        token
    }

    fn get_at(&self, token: &str, now: Instant) -> Option<LaunchFile> {
        let mut entries = lock(&self.entries);
        entries.retain(|_, e| e.expires > now);
        entries.get(token).map(|e| e.file.clone())
    }
}

/// 128 bits aleatoires en hexadecimal.
pub fn new_token() -> String {
    let mut bytes = [0u8; 16];
    if getrandom::fill(&mut bytes).is_err() {
        // Pas de source aleatoire systeme (cas theorique) : horloge + compteur, unique dans le processus.
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
        bytes[..8].copy_from_slice(&n.to_le_bytes());
        bytes[8..].copy_from_slice(&(t as u64).to_le_bytes());
    }
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Fichiers designes par une ligne de commande (`argv` sans l'executable).
/// Les options (`-x`, `--y`) sont ignorees ; les chemins relatifs sont resolus depuis `cwd` ;
/// les URL `file://` (bureaux Linux) sont converties ; seuls les fichiers existants sont gardes.
#[cfg(any(desktop, test))]
pub fn files_from_args(args: &[String], cwd: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for arg in args {
        if arg.is_empty() || arg.starts_with('-') {
            continue;
        }
        let path = match arg.strip_prefix("file://") {
            Some(rest) => PathBuf::from(percent_decode(rest.strip_prefix("localhost").unwrap_or(rest))),
            None => PathBuf::from(arg),
        };
        let path = if path.is_absolute() { path } else { cwd.join(path) };
        if path.is_file() && !files.contains(&path) {
            files.push(path);
        }
    }
    files
}

pub fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok().filter(|h| h.bytes().all(|c| c.is_ascii_hexdigit()));
            if let Some(v) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    let decoded = String::from_utf8_lossy(&out).to_string();
    // `file:///C:/x` sous Windows : retirer la barre avant la lettre de lecteur.
    if cfg!(windows) && decoded.len() > 2 && decoded.starts_with('/') && decoded.as_bytes()[2] == b':' {
        return decoded[1..].to_string();
    }
    decoded
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn un_jeton_rend_son_document_jusqu_a_expiration() {
        let launches = Launches::default();
        let start = Instant::now();
        let token = launches.put_at(LaunchFile::Path("/a.docx".into()), start);
        assert_eq!(token.len(), 32);
        assert_eq!(launches.get_at(&token, start), Some(LaunchFile::Path("/a.docx".into())));
        // relisible (rechargement de la page) tant qu'il n'a pas expire
        assert!(launches.get_at(&token, start + LAUNCH_TTL / 2).is_some());
        assert!(launches.get_at(&token, start + LAUNCH_TTL).is_none());
        assert!(launches.get_at("inconnu", start).is_none());
    }

    #[test]
    fn les_jetons_sont_uniques() {
        let a = new_token();
        let b = new_token();
        assert_ne!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn la_ligne_de_commande_donne_les_fichiers_existants() {
        let dir = std::env::temp_dir().join(format!("fo-args-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let doc = dir.join("été 2026.docx");
        std::fs::write(&doc, b"x").unwrap();
        let args = vec![
            "--flag".to_string(),
            "été 2026.docx".to_string(),
            doc.to_string_lossy().to_string(),
            "absent.xlsx".to_string(),
            String::new(),
        ];
        let files = files_from_args(&args, &dir);
        assert_eq!(files, vec![dir.join("été 2026.docx")]);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn les_url_file_sont_decodees() {
        assert_eq!(percent_decode("/home/u/%C3%A9t%C3%A9.docx"), "/home/u/été.docx");
        assert_eq!(percent_decode("/a%2"), "/a%2");
        if cfg!(windows) {
            assert_eq!(percent_decode("/C:/Users/a.docx"), "C:/Users/a.docx");
        }
    }
}
