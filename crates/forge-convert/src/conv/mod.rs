//! Conversions de fichiers (documents, tableurs, donnees, images, archives, audio).
//! Aiguillage repris de ForgePDF (`dispatch::convert_bytes`) : meme table de
//! correspondances, mais l'entree est lue sur place (taille verifiee), la sortie
//! est produite dans un dossier temporaire prive puis deposee dans la `Cible`.

pub mod archives;
pub mod audio;
pub mod documents;
pub mod epub;
pub mod donnees;
mod ecriture_zip;
pub mod images;
pub mod office;
pub mod texte;

use crate::erreur::{ConvertError, Resultat};
use crate::fichiers::{extension, verifier_entree, Cible, DossierTemp};
use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Options de conversion (images : qualite JPEG, redimension, rotation ;
/// Office vers PDF : rendu fidele par LibreOffice si installe).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct OptionsConversion {
    #[serde(default)]
    pub qualite: Option<u8>,
    #[serde(default)]
    pub largeur: Option<u32>,
    #[serde(default)]
    pub hauteur: Option<u32>,
    #[serde(default)]
    pub rotation: Option<u32>,
    /// docx/pptx/xlsx/odt/odp/ods vers PDF par LibreOffice (mise en page conservee).
    /// Attention : LibreOffice peut suivre les liens externes d'un document hostile
    /// (images ou ressources distantes) ; a reserver aux documents de confiance.
    /// Un profil utilisateur temporaire et prive est utilise pour chaque appel.
    #[serde(default)]
    pub haute_fidelite: bool,
}

const IMAGES_ENTREE: &[&str] =
    &["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif", "tga", "pnm", "ppm", "hdr", "ico", "qoi", "exr", "dds", "ff"];
const IMAGES_SORTIE: &[&str] =
    &["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tga", "ico", "avif", "qoi", "exr", "ppm", "ff"];
const OFFICE_FIDELE: &[&str] = &["docx", "doc", "pptx", "ppt", "xlsx", "xls", "odt", "odp", "ods", "rtf"];
const DOCS_ENTREE: &[&str] =
    &["pdf", "txt", "md", "markdown", "html", "htm", "docx", "doc", "rtf", "epub", "odt", "pptx", "ppt", "odp"];
const DOCS_SORTIE: &[&str] = &["txt", "md", "html", "pdf", "docx", "epub", "rtf", "odt"];
const DONNEES: &[&str] = &["json", "yaml", "yml", "toml", "xml", "csv"];
const TABLEURS: &[&str] = &["xlsx", "xls", "ods"];

/// Indique si la conversion `de` -> `vers` est prise en charge (sans l'executer).
pub fn prise_en_charge(de: &str, vers: &str) -> bool {
    let (de, vers) = (de.to_ascii_lowercase(), vers.to_ascii_lowercase());
    let (d, v) = (de.as_str(), vers.as_str());
    let dans = |l: &[&str], x: &str| l.contains(&x);
    (dans(IMAGES_ENTREE, d) && (dans(IMAGES_SORTIE, v) || v == "pdf"))
        || (d == "svg" && matches!(v, "png" | "jpg" | "jpeg" | "webp" | "bmp" | "avif" | "qoi" | "pdf"))
        || (dans(DOCS_ENTREE, d) && dans(DOCS_SORTIE, v))
        || (dans(TABLEURS, d) && matches!(v, "csv" | "json" | "txt" | "pdf" | "yaml" | "html" | "md" | "toml" | "xml" | "xlsx"))
        || (dans(DONNEES, d) && matches!(v, "json" | "yaml" | "toml" | "xml" | "csv" | "txt" | "pdf" | "xlsx" | "md" | "html"))
        || (matches!(d, "srt" | "vtt") && matches!(v, "srt" | "vtt" | "txt"))
        || (matches!(d, "zip" | "tar" | "tgz" | "gz" | "7z") && matches!(v, "zip" | "tar" | "tgz"))
        || (matches!(d, "mp3" | "ogg" | "m4a" | "aac" | "wav" | "flac") && matches!(v, "wav" | "flac"))
}

/// Vrai si cette conversion passera par LibreOffice (option « haute fidelite »).
pub fn utilise_libreoffice(entree: &Path, vers: &str, options: &OptionsConversion) -> bool {
    options.haute_fidelite
        && vers.trim_start_matches('.').eq_ignore_ascii_case("pdf")
        && OFFICE_FIDELE.contains(&extension(entree).as_str())
}

/// Convertit `entree` au format `vers` et depose le resultat dans `cible`.
pub fn convertir(entree: &Path, vers: &str, options: &OptionsConversion, cible: &Cible) -> Resultat<PathBuf> {
    verifier_entree(entree)?;
    let de = extension(entree);
    let vers = vers.trim_start_matches('.').to_ascii_lowercase();
    if !prise_en_charge(&de, &vers) {
        return Err(ConvertError::NonSupporte { de, vers });
    }
    let tmp = DossierTemp::nouveau()?;
    if options.haute_fidelite && vers == "pdf" && OFFICE_FIDELE.contains(&de.as_str()) {
        let pdf = crate::pdf::externe::office_vers_pdf(entree, tmp.chemin())?;
        return cible.deposer(&cible.nom, &pdf);
    }
    let sortie = tmp.fichier(&format!("sortie.{vers}"));
    let e = entree.to_str().ok_or_else(|| ConvertError::CheminRefuse("chemin non UTF-8".into()))?;
    let s = sortie.to_str().ok_or_else(|| ConvertError::CheminRefuse("dossier temporaire non UTF-8".into()))?;
    aiguiller(e, &de, s, &vers, options, &tmp)?;
    cible.deposer(&cible.nom, &sortie)
}

/// Texte d'un PDF designe par son chemin (pivot des conversions documents).
pub(crate) fn texte_pdf(chemin: &str) -> anyhow::Result<String> {
    Ok(crate::pdf::texte::extraire_fichier(Path::new(chemin))?)
}

fn ecrire(chemin: &str, contenu: impl AsRef<[u8]>) -> anyhow::Result<()> {
    std::fs::write(chemin, contenu).map_err(|e| anyhow!("Écriture '{chemin}' : {e}"))
}

/// Limite de lecture d'une entree d'archive decompressee (256 Mio) : la taille
/// declaree dans un zip peut etre falsifiee, seule la lecture bornee protege.
pub(crate) const MAX_ENTREE_ARCHIVE: u64 = 256 * 1024 * 1024;

/// Lit un flux en texte, en refusant tout ce qui depasse `MAX_ENTREE_ARCHIVE`.
pub(crate) fn lire_texte_borne(lecteur: impl std::io::Read, nom: &str) -> anyhow::Result<String> {
    lire_texte_max(lecteur, nom, MAX_ENTREE_ARCHIVE)
}

pub(crate) fn lire_texte_max(lecteur: impl std::io::Read, nom: &str, max: u64) -> anyhow::Result<String> {
    use std::io::Read;
    let mut octets = Vec::new();
    lecteur
        .take(max + 1)
        .read_to_end(&mut octets)
        .map_err(|e| anyhow!("Lecture '{nom}' : {e}"))?;
    if octets.len() as u64 > max {
        return Err(anyhow!(
            "'{nom}' dépasse la limite de {} Mio une fois décompressé : fichier refusé",
            max / (1024 * 1024)
        ));
    }
    Ok(String::from_utf8_lossy(&octets).into_owned())
}

fn lire(chemin: &str) -> anyhow::Result<String> {
    std::fs::read_to_string(chemin).map_err(|e| anyhow!("Lecture '{chemin}' : {e}"))
}

fn pdf_vers_html(texte: &str) -> String {
    let corps: String = texte
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let e = crate::pdf::texte::echapper_html(l);
            if l.starts_with("--- Page") {
                format!("<h2>{e}</h2>\n")
            } else {
                format!("<p>{e}</p>\n")
            }
        })
        .collect();
    format!(
        "<!DOCTYPE html>\n<html lang=\"fr\"><head><meta charset=\"UTF-8\"><style>body{{font-family:sans-serif;max-width:800px;\
margin:auto;padding:2rem;line-height:1.6}}h2{{color:#555;border-top:1px solid #ccc;padding-top:1em}}</style></head>\n<body>\n{corps}</body></html>"
    )
}

fn json_vers_csv(json: &str, sortie: &str) -> anyhow::Result<()> {
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| anyhow!("JSON invalide : {e}"))?;
    let lignes = v.as_array().ok_or_else(|| anyhow!("le JSON doit être un tableau d'objets"))?;
    let entetes: Vec<String> =
        lignes.first().and_then(|l| l.as_object()).map(|o| o.keys().cloned().collect()).unwrap_or_default();
    let mut csv = entetes.iter().map(|h| office::csv_cell(h)).collect::<Vec<_>>().join(",");
    csv.push('\n');
    for l in lignes.iter().filter_map(|l| l.as_object()) {
        let cellules: Vec<String> = entetes
            .iter()
            .map(|h| match l.get(h) {
                Some(serde_json::Value::String(s)) => office::csv_cell(s),
                Some(serde_json::Value::Null) | None => String::new(),
                Some(autre) => office::csv_cell(&autre.to_string()),
            })
            .collect();
        csv.push_str(&cellules.join(","));
        csv.push('\n');
    }
    ecrire(sortie, csv)
}

/// Table de correspondance (identique a ForgePDF, PDF produits par lopdf).
fn aiguiller(e: &str, de: &str, s: &str, vers: &str, o: &OptionsConversion, tmp: &DossierTemp) -> Resultat<()> {
    use documents::*;
    use donnees::*;
    use office::*;
    use texte::*;
    let t = |nom: &str| tmp.fichier(nom).to_string_lossy().into_owned();
    let img = images::ImageOptions {
        quality: o.qualite,
        resize_width: o.largeur,
        resize_height: o.hauteur,
        rotation: o.rotation,
    };
    match (de, vers) {
        (i, "pdf") if IMAGES_ENTREE.contains(&i) || i == "svg" => {
            let mut doc = crate::pdf::images::images_vers_pdf(&[PathBuf::from(e)])?;
            ecrire(s, crate::pdf::enregistrer(&mut doc)?)?;
        }
        (i, f) if IMAGES_ENTREE.contains(&i) => {
            images::convert_image_file(e, s, &images::OutputFormat::analyser(f)?, &img)?
        }
        ("svg", f) => images::convert_svg_to_image(e, s, &images::OutputFormat::analyser(f)?, &img)?,

        ("pdf", "txt" | "md") => ecrire(s, texte_pdf(e)?)?,
        ("pdf", "html") => ecrire(s, pdf_vers_html(&texte_pdf(e)?))?,
        ("txt", "pdf") => txt_to_pdf(e, s)?,
        ("txt", "html") => txt_to_html(e, s)?,
        ("txt", "md") => ecrire(s, lire(e)?)?,
        ("txt", "docx") => txt_to_docx(e, s)?,
        ("txt", "epub") => txt_to_epub(e, s)?,
        ("md" | "markdown", "html") => md_to_html(e, s)?,
        ("md" | "markdown", "txt") => md_to_txt(e, s)?,
        ("md" | "markdown", "pdf") => md_to_pdf(e, s)?,
        ("md" | "markdown", "docx") => md_to_docx(e, s)?,
        ("md" | "markdown", "epub") => md_to_epub(e, s)?,
        ("html" | "htm", "txt") => html_to_txt(e, s)?,
        ("html" | "htm", "pdf") => html_to_pdf(e, s)?,
        ("html" | "htm", "md") => html_to_md(e, s)?,
        ("html" | "htm", "epub") => html_to_epub(e, s)?,
        ("html" | "htm", "docx") => {
            html_to_txt(e, &t("p.txt"))?;
            txt_to_docx(&t("p.txt"), s)?
        }
        ("docx" | "doc", "html") => docx_to_html(e, s)?,
        ("docx" | "doc", "md") => {
            docx_to_html(e, &t("p.html"))?;
            html_to_md(&t("p.html"), s)?
        }
        ("docx" | "doc", "epub") => {
            docx_to_html(e, &t("p.html"))?;
            html_to_epub(&t("p.html"), s)?
        }
        ("rtf", "txt") => rtf_to_text(e, s)?,
        ("epub", "txt") => epub_to_text(e, s)?,
        ("epub", "html") => epub_to_html(e, s)?,
        ("epub", "md") => {
            epub_to_html(e, &t("p.html"))?;
            html_to_md(&t("p.html"), s)?
        }
        ("xlsx" | "xls" | "ods", "csv") => excel_to_csv(e, s)?,
        ("xlsx" | "xls" | "ods", "json") => excel_to_json(e, s)?,
        ("xlsx" | "xls" | "ods", "txt") => excel_to_txt(e, s)?,
        ("xlsx" | "xls" | "ods", "pdf") => {
            excel_to_txt(e, &t("p.txt"))?;
            txt_to_pdf(&t("p.txt"), s)?
        }
        ("xlsx" | "xls" | "ods", "html" | "md") => {
            excel_to_csv(e, &t("p.csv"))?;
            if vers == "html" {
                csv_to_html_table(&t("p.csv"), s)?
            } else {
                csv_to_markdown(&t("p.csv"), s)?
            }
        }
        ("xlsx" | "xls" | "ods", "yaml" | "toml" | "xml") => {
            excel_to_json(e, &t("p.json"))?;
            convert_data(&t("p.json"), "json", s, vers)?
        }
        ("xls" | "ods", "xlsx") => {
            excel_to_csv(e, &t("p.csv"))?;
            csv_to_xlsx(&t("p.csv"), s)?
        }
        ("xlsx", "xlsx") => ecrire(s, std::fs::read(e).map_err(|x| ConvertError::Lecture(x.to_string()))?)?,
        ("csv", "json") => csv_to_json(e, s)?,
        ("csv", "xlsx") => csv_to_xlsx(e, s)?,
        ("csv", "txt") => csv_to_txt(e, s)?,
        ("csv", "md") => csv_to_markdown(e, s)?,
        ("csv", "html") => csv_to_html_table(e, s)?,
        ("csv", "pdf") => {
            csv_to_txt(e, &t("p.txt"))?;
            txt_to_pdf(&t("p.txt"), s)?
        }
        ("json", "csv") => json_vers_csv(&lire(e)?, s)?,
        ("json", "txt" | "pdf") => {
            let v: serde_json::Value = serde_json::from_str(&lire(e)?).map_err(|x| anyhow!("JSON invalide : {x}"))?;
            let joli = serde_json::to_string_pretty(&v).map_err(|x| anyhow!("{x}"))?;
            if vers == "pdf" {
                create_pdf_from_text(&joli, s)?
            } else {
                ecrire(s, joli)?
            }
        }
        (d, "xlsx") if DONNEES.contains(&d) => {
            convert_data(e, d, &t("p.csv"), "csv")?;
            csv_to_xlsx(&t("p.csv"), s)?
        }
        (d, "pdf") if DONNEES.contains(&d) => {
            convert_data(e, d, &t("p.txt"), "txt")?;
            txt_to_pdf(&t("p.txt"), s)?
        }
        (d, "md" | "html") if DONNEES.contains(&d) => {
            convert_data(e, d, &t("p.csv"), "csv")?;
            if vers == "html" {
                csv_to_html_table(&t("p.csv"), s)?
            } else {
                csv_to_markdown(&t("p.csv"), s)?
            }
        }
        (d, f) if DONNEES.contains(&d) => convert_data(e, d, s, f)?,
        ("srt", "vtt") => srt_to_vtt(e, s)?,
        ("vtt", "srt") => vtt_to_srt(e, s)?,
        ("srt" | "vtt", "txt") => subtitles_to_text(e, s)?,
        ("srt", "srt") | ("vtt", "vtt") => ecrire(s, lire(e)?)?,
        (a, f) if matches!(a, "zip" | "tar" | "tgz" | "gz" | "7z") => archives::convert_archive(e, a, s, f)?,
        (a, f) if matches!(a, "mp3" | "ogg" | "m4a" | "aac" | "wav" | "flac") => audio::convert_audio(e, a, s, f)?,
        // Pivot texte pour toutes les autres combinaisons de documents.
        (d, f) => text_to_doc(&doc_to_text(e, d)?, "document", s, f)?,
    }
    Ok(())
}

#[cfg(test)]
mod tests_bornes {
    use super::lire_texte_max;

    #[test]
    fn lecture_bornee_refuse_un_flux_infini() {
        let infini = std::io::repeat(b'a');
        let e = lire_texte_max(infini, "x.xml", 1024).unwrap_err().to_string();
        assert!(e.contains("dépasse la limite"), "{e}");
        assert_eq!(lire_texte_max(&b"abc"[..], "x", 1024).unwrap(), "abc");
    }
}
