//! Entrees/sorties sures : toute entree est hostile.
//! - lecture plafonnee (taille verifiee avant lecture) ;
//! - sortie confinee au dossier choisi (nom simple, pas de separateur ni de `..`),
//!   ecrite dans un fichier temporaire du meme dossier puis renommee (atomique,
//!   ne suit pas un lien symbolique deja present) ;
//! - dossiers temporaires prives supprimes a la destruction (RAII).

use crate::erreur::{param, ConvertError, Resultat};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Taille maximale d'un fichier d'entree (512 Mio).
pub const MAX_ENTREE: u64 = 512 * 1024 * 1024;
/// Taille maximale d'un fichier produit (1 Gio, anti-amplification).
pub const MAX_SORTIE: u64 = 1024 * 1024 * 1024;

/// Lit un fichier d'entree en refusant ce qui depasse `MAX_ENTREE`.
pub fn lire_entree(chemin: &Path) -> Resultat<Vec<u8>> {
    verifier_entree(chemin)?;
    std::fs::read(chemin).map_err(|e| ConvertError::Lecture(format!("{} : {e}", chemin.display())))
}

/// Verifie qu'une entree est un fichier ordinaire de taille acceptable.
pub fn verifier_entree(chemin: &Path) -> Resultat<()> {
    let meta = std::fs::metadata(chemin)
        .map_err(|e| ConvertError::Lecture(format!("{} : {e}", chemin.display())))?;
    if !meta.is_file() {
        return Err(ConvertError::Lecture(format!("{} n'est pas un fichier", chemin.display())));
    }
    if meta.len() > MAX_ENTREE {
        return Err(ConvertError::TropVolumineux { taille: meta.len(), limite: MAX_ENTREE });
    }
    Ok(())
}

/// Extension en minuscules d'un chemin (vide si absente).
pub fn extension(chemin: &Path) -> String {
    chemin.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase()
}

/// Destination d'une sortie : un dossier choisi par l'utilisateur et un nom simple.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Cible {
    pub dossier: PathBuf,
    pub nom: String,
    /// Remplacer un fichier existant (faux par defaut).
    #[serde(default)]
    pub ecraser: bool,
}

const NOMS_RESERVES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

const INTERDITS: [char; 9] = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Refuse tout nom qui n'est pas un simple nom de fichier portable.
pub fn valider_nom(nom: &str) -> Resultat<()> {
    let refus = |m: &str| Err(ConvertError::CheminRefuse(format!("« {nom} » : {m}")));
    if nom.is_empty() || nom.len() > 200 {
        return refus("nom vide ou trop long");
    }
    if nom == "." || nom == ".." || nom.ends_with('.') || nom.ends_with(' ') {
        return refus("nom invalide");
    }
    if nom.chars().any(|c| c.is_control() || INTERDITS.contains(&c)) {
        return refus("caractère interdit (séparateur ou caractère réservé)");
    }
    let base = nom.split('.').next().unwrap_or("").trim().to_ascii_uppercase();
    if NOMS_RESERVES.contains(&base.as_str()) {
        return refus("nom réservé par Windows");
    }
    Ok(())
}

impl Cible {
    pub fn nouvelle(dossier: impl Into<PathBuf>, nom: impl Into<String>) -> Self {
        Cible { dossier: dossier.into(), nom: nom.into(), ecraser: false }
    }

    /// Dossier canonique (doit exister et etre un dossier).
    fn dossier_canonique(&self) -> Resultat<PathBuf> {
        let d = std::fs::canonicalize(&self.dossier).map_err(|e| {
            ConvertError::CheminRefuse(format!("dossier {} inaccessible : {e}", self.dossier.display()))
        })?;
        if !d.is_dir() {
            return Err(ConvertError::CheminRefuse(format!("{} n'est pas un dossier", d.display())));
        }
        Ok(d)
    }

    /// Chemin final valide pour le nom donne (confine au dossier).
    pub fn chemin_pour(&self, nom: &str) -> Resultat<PathBuf> {
        valider_nom(nom)?;
        let chemin = self.dossier_canonique()?.join(nom);
        if !self.ecraser && std::fs::symlink_metadata(&chemin).is_ok() {
            return Err(ConvertError::CheminRefuse(format!(
                "{} existe déjà (cochez « Remplacer » pour l'écraser)",
                chemin.display()
            )));
        }
        Ok(chemin)
    }

    /// Nom derive « base-suffixe.ext » pour les sorties multiples.
    pub fn nom_derive(&self, suffixe: &str, ext: &str) -> String {
        let base = Path::new(&self.nom).file_stem().and_then(|s| s.to_str()).unwrap_or("sortie");
        format!("{base}-{suffixe}.{ext}")
    }

    /// Ecrit `octets` sous le nom principal.
    pub fn ecrire(&self, octets: &[u8]) -> Resultat<PathBuf> {
        self.ecrire_sous(&self.nom, octets)
    }

    /// Ecrit `octets` sous `nom` dans le dossier de la cible (atomique).
    pub fn ecrire_sous(&self, nom: &str, octets: &[u8]) -> Resultat<PathBuf> {
        if octets.len() as u64 > MAX_SORTIE {
            return Err(ConvertError::TropVolumineux { taille: octets.len() as u64, limite: MAX_SORTIE });
        }
        let final_ = self.chemin_pour(nom)?;
        let tmp = final_.with_file_name(format!(".{nom}.{}.part", jeton()));
        let res = (|| {
            let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&tmp)?;
            f.write_all(octets)?;
            f.sync_all()?;
            drop(f);
            std::fs::rename(&tmp, &final_)
        })();
        if let Err(e) = res {
            let _ = std::fs::remove_file(&tmp);
            return Err(ConvertError::Ecriture(format!("{} : {e}", final_.display())));
        }
        Ok(final_)
    }

    /// Copie un fichier produit (dans un dossier temporaire) vers la cible.
    pub fn deposer(&self, nom: &str, source: &Path) -> Resultat<PathBuf> {
        let taille = std::fs::metadata(source)
            .map_err(|e| ConvertError::Echec(format!("résultat introuvable : {e}")))?
            .len();
        if taille > MAX_SORTIE {
            return Err(ConvertError::TropVolumineux { taille, limite: MAX_SORTIE });
        }
        let final_ = self.chemin_pour(nom)?;
        let tmp = final_.with_file_name(format!(".{nom}.{}.part", jeton()));
        let res = std::fs::copy(source, &tmp).and_then(|_| std::fs::rename(&tmp, &final_));
        if let Err(e) = res {
            let _ = std::fs::remove_file(&tmp);
            return Err(ConvertError::Ecriture(format!("{} : {e}", final_.display())));
        }
        Ok(final_)
    }
}

/// Jeton aleatoire hexadecimal (noms temporaires imprevisibles).
pub fn jeton() -> String {
    let mut b = [0u8; 8];
    if getrandom::fill(&mut b).is_err() {
        // ponytail: repli sur l'horloge si le systeme refuse l'alea ; collision tres improbable.
        let n = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        return format!("{n:x}");
    }
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Dossier temporaire prive, supprime (avec son contenu) a la destruction.
pub struct DossierTemp(PathBuf);

impl DossierTemp {
    pub fn nouveau() -> Resultat<Self> {
        let p = std::env::temp_dir().join(format!("forge-convert-{}", jeton()));
        std::fs::create_dir(&p).map_err(|e| ConvertError::Ecriture(format!("dossier temporaire : {e}")))?;
        Ok(DossierTemp(p))
    }
    pub fn chemin(&self) -> &Path {
        &self.0
    }
    pub fn fichier(&self, nom: &str) -> PathBuf {
        self.0.join(nom)
    }
}

impl Drop for DossierTemp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Analyse une selection de pages « 1-3, 5, 8- » (1-based) bornee a `total`.
pub fn analyser_pages(selection: &str, total: u32) -> Resultat<Vec<u32>> {
    let mut pages = Vec::new();
    for morceau in selection.split(',').map(str::trim).filter(|m| !m.is_empty()) {
        let (debut, fin) = match morceau.split_once('-') {
            Some((a, b)) => {
                let (a, b) = (a.trim(), b.trim());
                let a = if a.is_empty() { 1 } else { nombre(a)? };
                let b = if b.is_empty() { total } else { nombre(b)? };
                (a, b)
            }
            None => {
                let n = nombre(morceau)?;
                (n, n)
            }
        };
        if debut < 1 || fin > total || debut > fin {
            return Err(param(format!("pages « {morceau} » hors limites (1 à {total})")));
        }
        pages.extend(debut..=fin);
    }
    if pages.is_empty() {
        return Err(param("aucune page sélectionnée"));
    }
    Ok(pages)
}

fn nombre(s: &str) -> Resultat<u32> {
    s.parse().map_err(|_| param(format!("« {s} » n'est pas un numéro de page")))
}
