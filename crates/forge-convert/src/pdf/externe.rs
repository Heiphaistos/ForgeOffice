//! Operations qui exigent un binaire externe (aucun equivalent pur Rust raisonnable) :
//! PDF/A (Ghostscript), OCR (ocrmypdf + Tesseract), rendu des pages en images
//! (MuPDF, sinon Poppler, sinon Ghostscript), Office vers PDF fidele (LibreOffice).
//! Les fichiers sont copies sous des noms fixes dans un dossier temporaire prive :
//! aucun nom fourni par l'utilisateur n'arrive sur la ligne de commande.

use crate::erreur::{param, ConvertError, Resultat};
use crate::fichiers::{extension, lire_entree, DossierTemp};
use crate::outils::{executer, Outil};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

fn ecrire(chemin: &Path, octets: &[u8]) -> Resultat<()> {
    std::fs::write(chemin, octets).map_err(|e| ConvertError::Ecriture(format!("fichier temporaire : {e}")))
}

fn lire(chemin: &Path, outil: Outil) -> Resultat<Vec<u8>> {
    std::fs::read(chemin)
        .map_err(|_| ConvertError::OutilEchec { outil: outil.nom().into(), detail: "aucun fichier produit".into() })
}

fn arg(s: &str) -> &OsStr {
    OsStr::new(s)
}

/// Convertit en PDF/A-2b avec Ghostscript.
pub fn pdf_a(pdf: &[u8]) -> Resultat<Vec<u8>> {
    let gs = Outil::Ghostscript.exiger("utilisez un PDF déjà conforme (aucune conversion PDF/A en pur Rust)")?;
    let tmp = DossierTemp::nouveau()?;
    let (e, s) = (tmp.fichier("entree.pdf"), tmp.fichier("sortie.pdf"));
    ecrire(&e, pdf)?;
    let sortie = format!("-sOutputFile={}", s.display());
    let args = [
        arg("-dPDFA=2"), arg("-dBATCH"), arg("-dNOPAUSE"), arg("-dQUIET"), arg("-dSAFER"),
        arg("-sColorConversionStrategy=RGB"), arg("-sDEVICE=pdfwrite"), arg("-dPDFACompatibilityPolicy=1"),
        arg(&sortie), e.as_os_str(),
    ];
    executer(Outil::Ghostscript, &gs, &args, &[])?;
    lire(&s, Outil::Ghostscript)
}

/// Langue Tesseract : « fra », « fra+eng »… (lettres, `_` et `+` seulement).
fn valider_langue(langue: &str) -> Resultat<&str> {
    let ok = !langue.is_empty()
        && langue.len() <= 40
        && !langue.starts_with('+')
        && langue.chars().all(|c| c.is_ascii_lowercase() || c == '+' || c == '_');
    if ok {
        Ok(langue)
    } else {
        Err(param(format!("langue OCR « {langue} » invalide (exemple : fra ou fra+eng)")))
    }
}

/// Reconnaissance de texte : ajoute une couche texte cherchable (ocrmypdf).
/// `forcer` : refaire l'OCR meme sur les pages qui ont deja du texte.
pub fn ocr(pdf: &[u8], langue: &str, forcer: bool) -> Resultat<Vec<u8>> {
    let langue = valider_langue(langue)?;
    let exe = Outil::Ocrmypdf.exiger("installez ocrmypdf et Tesseract avec la langue voulue")?;
    let tmp = DossierTemp::nouveau()?;
    let (e, s) = (tmp.fichier("entree.pdf"), tmp.fichier("sortie.pdf"));
    ecrire(&e, pdf)?;
    let mode = if forcer { "--force-ocr" } else { "--skip-text" };
    let args = [arg(mode), arg("-l"), arg(langue), e.as_os_str(), s.as_os_str()];
    executer(Outil::Ocrmypdf, &exe, &args, &[])?;
    lire(&s, Outil::Ocrmypdf)
}

/// Format des images rendues.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FormatImage {
    #[default]
    Png,
    Jpg,
}

/// Rend chaque page en image (« page-1.png »…). Resolution bornee a 36..600 ppp.
pub fn rendre_pages(pdf: &[u8], dpi: u32, format: FormatImage) -> Resultat<Vec<(String, Vec<u8>)>> {
    let dpi = dpi.clamp(36, 600).to_string();
    let tmp = DossierTemp::nouveau()?;
    let e = tmp.fichier("entree.pdf");
    ecrire(&e, pdf)?;
    let sorties = tmp.fichier("rendu");
    std::fs::create_dir(&sorties).map_err(|x| ConvertError::Ecriture(x.to_string()))?;
    let alt = "installez MuPDF, Poppler ou Ghostscript pour obtenir des images de pages";
    if let Some(exe) = Outil::Mutool.trouver() {
        let motif = sorties.join("page-%d.png");
        let args = [arg("draw"), arg("-o"), motif.as_os_str(), arg("-r"), arg(&dpi), e.as_os_str()];
        executer(Outil::Mutool, &exe, &args, &[])?;
    } else if let Some(exe) = Outil::Pdftoppm.trouver() {
        let base = sorties.join("page");
        let args = [arg("-png"), arg("-r"), arg(&dpi), e.as_os_str(), base.as_os_str()];
        executer(Outil::Pdftoppm, &exe, &args, &[])?;
    } else {
        let gs = Outil::Ghostscript.exiger(alt)?;
        let o = format!("-sOutputFile={}", sorties.join("page-%d.png").display());
        let r = format!("-r{dpi}");
        let args = [arg("-dSAFER"), arg("-dBATCH"), arg("-dNOPAUSE"), arg("-dQUIET"), arg("-sDEVICE=png16m"), arg(&r), arg(&o), e.as_os_str()];
        executer(Outil::Ghostscript, &gs, &args, &[])?;
    }
    let mut pages: Vec<(u32, PathBuf)> = std::fs::read_dir(&sorties)
        .map_err(|x| ConvertError::Lecture(x.to_string()))?
        .filter_map(|x| x.ok().map(|x| x.path()))
        .filter_map(|p| {
            let n = p.file_stem()?.to_str()?.rsplit('-').next()?.parse().ok()?;
            Some((n, p))
        })
        .collect();
    pages.sort();
    if pages.is_empty() {
        return Err(ConvertError::Echec("aucune page rendue".into()));
    }
    let mut res = Vec::new();
    for (i, (_, p)) in pages.into_iter().enumerate() {
        let png = lire_entree(&p)?;
        let octets = match format {
            FormatImage::Png => png,
            FormatImage::Jpg => {
                let img = super::images::decoder(&png)?.to_rgb8();
                let mut jpg = Vec::new();
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg, 90)
                    .encode_image(&img)
                    .map_err(|x| ConvertError::Echec(format!("encodage JPEG : {x}")))?;
                jpg
            }
        };
        let ext = if format == FormatImage::Png { "png" } else { "jpg" };
        res.push((format!("page-{}.{ext}", i + 1), octets));
    }
    Ok(res)
}

/// URL `file://` d'un dossier (profil LibreOffice isole).
fn url_fichier(p: &Path) -> String {
    let s = p.to_string_lossy().replace('\\', "/");
    if s.starts_with('/') {
        format!("file://{s}")
    } else {
        format!("file:///{s}")
    }
}

/// Office (docx, pptx, xlsx, odt…) vers PDF avec LibreOffice, mise en page conservee.
/// Le PDF produit est renvoye dans `dossier` (temporaire de l'appelant).
pub fn office_vers_pdf(entree: &Path, dossier: &Path) -> Resultat<PathBuf> {
    let exe = Outil::LibreOffice.exiger("décochez « haute fidélité » pour une conversion simplifiée en pur Rust")?;
    let copie = dossier.join(format!("document.{}", extension(entree)));
    ecrire(&copie, &lire_entree(entree)?)?;
    let profil = format!("-env:UserInstallation={}", url_fichier(&dossier.join("profil")));
    let args = [
        arg(&profil), arg("--headless"), arg("--norestore"), arg("--convert-to"), arg("pdf"),
        arg("--outdir"), dossier.as_os_str(), copie.as_os_str(),
    ];
    executer(Outil::LibreOffice, &exe, &args, &[])?;
    let pdf = dossier.join("document.pdf");
    if !pdf.is_file() {
        return Err(ConvertError::OutilEchec { outil: Outil::LibreOffice.nom().into(), detail: "aucun PDF produit".into() });
    }
    Ok(pdf)
}
