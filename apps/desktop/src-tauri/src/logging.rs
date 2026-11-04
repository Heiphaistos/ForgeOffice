// Journal de la coquille : `<dossier de logs>/forgeoffice.log`, une ligne par evenement
// au format `[ISO8601] [NIVEAU] message`. Au-dela de 1 Mo, le fichier part dans `archive/`
// (5 archives gardees). La page web y ecrit aussi ses erreurs (commande `log_write`).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::grants::lock;

pub const MAX_LOG_BYTES: u64 = 1024 * 1024;
const KEEP_ARCHIVES: usize = 5;
const MAX_MESSAGE: usize = 8 * 1024;

pub struct Logger {
    file: PathBuf,
    guard: Mutex<()>,
}

impl Logger {
    pub fn new(dir: &Path) -> Self {
        let _ = fs::create_dir_all(dir); // sans dossier, chaque ecriture echouera en silence : le journal n'est jamais bloquant
        Logger { file: dir.join("forgeoffice.log"), guard: Mutex::new(()) }
    }

    pub fn info(&self, message: &str) {
        self.write("INFO", message);
    }

    pub fn warn(&self, message: &str) {
        self.write("WARN", message);
    }

    pub fn error(&self, message: &str) {
        self.write("ERROR", message);
    }

    pub fn write(&self, level: &str, message: &str) {
        let _guard = lock(&self.guard);
        self.rotate_if_needed();
        let line = format_line(&now_iso8601(), level, message);
        if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&self.file) {
            let _ = file.write_all(line.as_bytes()); // un journal plein ne doit pas faire echouer l'action journalisee
        }
    }

    fn rotate_if_needed(&self) {
        let size = fs::metadata(&self.file).map(|m| m.len()).unwrap_or(0);
        if size < MAX_LOG_BYTES {
            return;
        }
        let Some(dir) = self.file.parent() else { return };
        let archive = dir.join("archive");
        if fs::create_dir_all(&archive).is_err() {
            return;
        }
        let stamp = now_iso8601().replace([':', '-'], "").replace('.', "");
        let target = archive.join(format!("forgeoffice-{stamp}-{}.log", &crate::launch::new_token()[..6]));
        if fs::rename(&self.file, &target).is_err() {
            return;
        }
        let mut old: Vec<PathBuf> = fs::read_dir(&archive)
            .map(|rd| rd.filter_map(|e| e.ok().map(|e| e.path())).collect())
            .unwrap_or_default();
        old.sort();
        let excess = old.len().saturating_sub(KEEP_ARCHIVES);
        for path in old.into_iter().take(excess) {
            let _ = fs::remove_file(path); // archive deja retiree par une autre instance : rien a faire
        }
    }
}

pub fn format_line(time: &str, level: &str, message: &str) -> String {
    let level: String = level.chars().filter(|c| c.is_ascii_alphabetic()).take(8).collect::<String>().to_uppercase();
    let mut text: String = message.chars().take(MAX_MESSAGE).collect();
    // une entree = une ligne : les retours a la ligne d'une pile d'appels sont rendus visibles
    text = text.replace('\r', "").replace('\n', " | ");
    format!("[{time}] [{}] {text}\n", if level.is_empty() { "INFO" } else { &level })
}

pub fn now_iso8601() -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    iso8601(now.as_secs(), now.subsec_millis())
}

/// Date UTC `AAAA-MM-JJTHH:MM:SS.mmmZ` a partir de secondes Unix (algorithme jours -> civil de H. Hinnant).
pub fn iso8601(secs: u64, millis: u32) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_iso8601_utc() {
        assert_eq!(iso8601(0, 0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso8601(951_782_400, 5), "2000-02-29T00:00:00.005Z");
        assert_eq!(iso8601(1_793_750_400 + 3661, 999), "2026-11-04T01:01:01.999Z");
        assert_eq!(iso8601(4_107_542_399, 0), "2100-02-28T23:59:59.000Z");
    }

    #[test]
    fn une_entree_tient_sur_une_ligne() {
        let line = format_line("2026-11-03T10:00:00.000Z", "warn", "a\r\nb");
        assert_eq!(line, "[2026-11-03T10:00:00.000Z] [WARN] a | b\n");
        assert_eq!(format_line("t", "<script>", "x"), "[t] [SCRIPT] x\n");
        assert_eq!(format_line("t", "", "x"), "[t] [INFO] x\n");
    }

    #[test]
    fn le_journal_tourne_au_dela_de_1_mo() {
        let dir = std::env::temp_dir().join(format!("fo-log-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let log = Logger::new(&dir);
        log.info("premier");
        let content = fs::read_to_string(dir.join("forgeoffice.log")).unwrap();
        assert!(content.starts_with('[') && content.contains("] [INFO] premier"));
        fs::write(dir.join("forgeoffice.log"), vec![b'x'; MAX_LOG_BYTES as usize]).unwrap();
        log.error("apres rotation");
        let content = fs::read_to_string(dir.join("forgeoffice.log")).unwrap();
        assert!(content.ends_with("] [ERROR] apres rotation\n") && content.len() < 200);
        assert_eq!(fs::read_dir(dir.join("archive")).unwrap().count(), 1);
        for _ in 0..7 {
            fs::write(dir.join("forgeoffice.log"), vec![b'x'; MAX_LOG_BYTES as usize]).unwrap();
            log.warn("encore");
        }
        assert_eq!(fs::read_dir(dir.join("archive")).unwrap().count(), KEEP_ARCHIVES);
        fs::remove_dir_all(dir).unwrap();
    }
}
