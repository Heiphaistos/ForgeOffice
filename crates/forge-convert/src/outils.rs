//! Binaires externes facultatifs (Ghostscript, MuPDF, Poppler, ocrmypdf, LibreOffice).
//! Detection dans le PATH (et emplacements d'installation usuels sous Windows),
//! execution SANS shell : arguments en liste, sorties redirigees dans un dossier
//! temporaire, delai maximal puis arret force.

use crate::erreur::{ConvertError, Resultat};
use crate::fichiers::DossierTemp;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Outils connus : (identifiant, noms d'executable candidats).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outil {
    Ghostscript,
    Mutool,
    Pdftoppm,
    Pdftotext,
    Ocrmypdf,
    LibreOffice,
}

impl Outil {
    pub fn nom(self) -> &'static str {
        match self {
            Outil::Ghostscript => "Ghostscript",
            Outil::Mutool => "MuPDF (mutool)",
            Outil::Pdftoppm => "Poppler (pdftoppm)",
            Outil::Pdftotext => "Poppler (pdftotext)",
            Outil::Ocrmypdf => "ocrmypdf",
            Outil::LibreOffice => "LibreOffice",
        }
    }

    fn executables(self) -> &'static [&'static str] {
        match self {
            Outil::Ghostscript => &["gs", "gswin64c", "gswin32c"],
            Outil::Mutool => &["mutool"],
            Outil::Pdftoppm => &["pdftoppm"],
            Outil::Pdftotext => &["pdftotext"],
            Outil::Ocrmypdf => &["ocrmypdf"],
            Outil::LibreOffice => &["soffice", "libreoffice"],
        }
    }

    /// Chemin de l'executable s'il est installe.
    pub fn trouver(self) -> Option<PathBuf> {
        let noms = self.executables();
        if let Some(path) = std::env::var_os("PATH") {
            for dossier in std::env::split_paths(&path) {
                if let Some(p) = noms.iter().find_map(|n| executable_dans(&dossier, n)) {
                    return Some(p);
                }
            }
        }
        dossiers_windows(self).into_iter().find_map(|d| noms.iter().find_map(|n| executable_dans(&d, n)))
    }

    /// Comme `trouver`, mais erreur francaise « outil absent » sinon.
    pub fn exiger(self, alternative: &str) -> Resultat<PathBuf> {
        self.trouver().ok_or_else(|| ConvertError::OutilAbsent {
            outil: self.nom().to_string(),
            alternative: alternative.to_string(),
        })
    }
}

fn executable_dans(dossier: &Path, nom: &str) -> Option<PathBuf> {
    let candidats = if cfg!(windows) {
        vec![dossier.join(format!("{nom}.exe")), dossier.join(format!("{nom}.com"))]
    } else {
        vec![dossier.join(nom)]
    };
    candidats.into_iter().find(|p| p.is_file())
}

/// Emplacements d'installation par defaut sous Windows (hors PATH).
fn dossiers_windows(outil: Outil) -> Vec<PathBuf> {
    if !cfg!(windows) {
        return Vec::new();
    }
    let racines: Vec<PathBuf> = ["ProgramFiles", "ProgramFiles(x86)"]
        .iter()
        .filter_map(|v| std::env::var_os(v).map(PathBuf::from))
        .collect();
    let mut res = Vec::new();
    for r in racines {
        match outil {
            Outil::LibreOffice => res.push(r.join("LibreOffice").join("program")),
            Outil::Ghostscript => {
                // C:\Program Files\gs\gs10.xx\bin : on prend toutes les versions installees.
                if let Ok(it) = std::fs::read_dir(r.join("gs")) {
                    let mut v: Vec<PathBuf> = it.filter_map(|e| e.ok().map(|e| e.path().join("bin"))).collect();
                    v.sort();
                    v.reverse();
                    res.extend(v);
                }
            }
            Outil::Mutool => res.push(r.join("MuPDF")),
            _ => {}
        }
    }
    res
}

/// Delai maximal d'un outil externe.
pub const DELAI_OUTIL: Duration = Duration::from_secs(600);

/// Lance `exe args…` sans shell ; erreur francaise si code de sortie non nul
/// (sauf codes tolerés) ou si le delai est depasse.
pub fn executer(outil: Outil, exe: &Path, args: &[&std::ffi::OsStr], codes_ok: &[i32]) -> Resultat<()> {
    let tmp = DossierTemp::nouveau()?;
    let journal = tmp.fichier("sortie.txt");
    let f = std::fs::File::create(&journal).map_err(|e| ConvertError::Ecriture(e.to_string()))?;
    let f2 = f.try_clone().map_err(|e| ConvertError::Ecriture(e.to_string()))?;
    let mut enfant = Command::new(exe)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::from(f))
        .stderr(Stdio::from(f2))
        .spawn()
        .map_err(|e| ConvertError::OutilEchec { outil: outil.nom().into(), detail: format!("lancement : {e}") })?;
    let debut = Instant::now();
    let statut = loop {
        match enfant.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if debut.elapsed() > DELAI_OUTIL => {
                let _ = enfant.kill();
                let _ = enfant.wait();
                return Err(ConvertError::OutilEchec {
                    outil: outil.nom().into(),
                    detail: "délai dépassé, traitement interrompu".into(),
                });
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(e) => return Err(ConvertError::OutilEchec { outil: outil.nom().into(), detail: e.to_string() }),
        }
    };
    let code = statut.code().unwrap_or(-1);
    if code == 0 || codes_ok.contains(&code) {
        return Ok(());
    }
    let texte = std::fs::read(&journal).unwrap_or_default();
    let texte = String::from_utf8_lossy(&texte);
    let fin: String = texte.trim().chars().rev().take(600).collect::<Vec<_>>().into_iter().rev().collect();
    Err(ConvertError::OutilEchec { outil: outil.nom().into(), detail: format!("code {code} : {fin}") })
}
