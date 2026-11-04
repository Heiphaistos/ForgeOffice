//! Lecture EPUB sans dependance GPL (le crate `epub` l'est) : `zip` + `quick-xml`.
//! META-INF/container.xml -> fichier OPF -> manifest + spine (ordre de lecture)
//! -> chapitres XHTML ; titre et auteur depuis les metadonnees Dublin Core.
//! Les chemins de parties sont normalises (jamais de `..` hors de l'archive) et
//! toutes les lectures sont bornees (la taille declaree d'un zip peut mentir).

use super::{lire_texte_max, MAX_ENTREE_ARCHIVE};
use crate::{xml_entity, xml_text};
use anyhow::{anyhow, Result};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use std::collections::HashMap;

/// Total decompresse maximal lu dans un EPUB (1 Gio).
const MAX_TOTAL: u64 = 1024 * 1024 * 1024;

/// Contenu lisible d'un EPUB : metadonnees et chapitres XHTML dans l'ordre du spine.
pub(crate) struct Livre {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub chapitres: Vec<String>,
}

#[derive(Default)]
struct Opf {
    titre: Option<String>,
    auteur: Option<String>,
    /// id -> href (brut, relatif au dossier de l'OPF)
    manifest: HashMap<String, String>,
    spine: Vec<String>,
}

pub(crate) fn lire_epub(chemin: &str) -> Result<Livre> {
    lire_epub_max(chemin, MAX_ENTREE_ARCHIVE, MAX_TOTAL)
}

struct Parties {
    archive: zip::ZipArchive<std::fs::File>,
    max_entree: u64,
    restant: u64,
}

impl Parties {
    /// Texte d'une partie, `None` si elle est absente de l'archive.
    fn lire(&mut self, nom: &str) -> Result<Option<String>> {
        let entree = match self.archive.by_name(nom) {
            Ok(e) => e,
            Err(zip::result::ZipError::FileNotFound) => return Ok(None),
            Err(e) => return Err(anyhow!("EPUB invalide : lecture de '{nom}' impossible ({e})")),
        };
        let texte = lire_texte_max(entree, nom, self.max_entree.min(self.restant))
            .map_err(|e| anyhow!("EPUB refusé : {e}"))?;
        self.restant = self.restant.saturating_sub(texte.len() as u64);
        Ok(Some(texte))
    }
}

fn lire_epub_max(chemin: &str, max_entree: u64, max_total: u64) -> Result<Livre> {
    let fichier = std::fs::File::open(chemin).map_err(|e| anyhow!("Ouverture '{chemin}' : {e}"))?;
    let archive = zip::ZipArchive::new(fichier).map_err(|e| anyhow!("EPUB invalide '{chemin}' : {e}"))?;
    let mut parties = Parties { archive, max_entree, restant: max_total };

    let container = parties
        .lire("META-INF/container.xml")?
        .ok_or_else(|| anyhow!("EPUB invalide : META-INF/container.xml absent"))?;
    let chemin_opf = chemin_opf(&container)
        .ok_or_else(|| anyhow!("EPUB invalide : container.xml ne désigne aucun fichier OPF"))?;
    let chemin_opf = normaliser("", &chemin_opf)?;
    let opf_xml = parties
        .lire(&chemin_opf)?
        .ok_or_else(|| anyhow!("EPUB invalide : fichier OPF '{chemin_opf}' absent de l'archive"))?;
    let opf = analyser_opf(&opf_xml);
    if opf.spine.is_empty() {
        return Err(anyhow!("EPUB invalide : ordre de lecture (spine) absent ou vide"));
    }

    let dossier = chemin_opf.rsplit_once('/').map_or("", |(d, _)| d).to_string();
    let mut chapitres = Vec::new();
    for idref in &opf.spine {
        let Some(href) = opf.manifest.get(idref) else { continue };
        let partie = normaliser(&dossier, href)?;
        if let Some(contenu) = parties.lire(&partie)? {
            chapitres.push(contenu);
        }
    }
    if chapitres.is_empty() {
        return Err(anyhow!("EPUB sans contenu lisible"));
    }
    Ok(Livre { titre: opf.titre, auteur: opf.auteur, chapitres })
}

fn attribut(e: &BytesStart<'_>, nom: &[u8]) -> Option<String> {
    e.attributes()
        .flatten()
        .find(|a| a.key.local_name().as_ref() == nom)
        .map(|a| {
            let brut = String::from_utf8_lossy(&a.value).into_owned();
            quick_xml::escape::unescape(&brut).map(|v| v.into_owned()).unwrap_or(brut)
        })
}

fn chemin_opf(container: &str) -> Option<String> {
    let mut lecteur = Reader::from_str(container);
    loop {
        match lecteur.read_event() {
            Ok(Event::Start(e) | Event::Empty(e)) if e.local_name().as_ref() == b"rootfile" => {
                if let Some(p) = attribut(&e, b"full-path").filter(|p| !p.trim().is_empty()) {
                    return Some(p);
                }
            }
            Ok(Event::Eof) | Err(_) => return None,
            _ => {}
        }
    }
}

fn analyser_opf(xml: &str) -> Opf {
    let mut opf = Opf::default();
    let mut lecteur = Reader::from_str(xml);
    let mut dans_metadata = false;
    // 0 = rien, 1 = titre, 2 = auteur
    let mut cible = 0u8;
    let mut tampon = String::new();
    loop {
        match lecteur.read_event() {
            Ok(Event::Start(e)) => match e.local_name().as_ref() {
                b"metadata" => dans_metadata = true,
                b"title" if dans_metadata && opf.titre.is_none() => (cible, tampon) = (1, String::new()),
                b"creator" if dans_metadata && opf.auteur.is_none() => (cible, tampon) = (2, String::new()),
                b"item" => ajouter_item(&mut opf, &e),
                b"itemref" => ajouter_itemref(&mut opf, &e),
                _ => {}
            },
            Ok(Event::Empty(e)) => match e.local_name().as_ref() {
                b"item" => ajouter_item(&mut opf, &e),
                b"itemref" => ajouter_itemref(&mut opf, &e),
                _ => {}
            },
            Ok(Event::Text(t)) if cible != 0 => tampon.push_str(&xml_text(&t)),
            Ok(Event::GeneralRef(r)) if cible != 0 => tampon.push_str(&xml_entity(&r)),
            Ok(Event::End(e)) => match e.local_name().as_ref() {
                b"metadata" => dans_metadata = false,
                b"title" | b"creator" if cible != 0 => {
                    let v = tampon.trim().to_string();
                    let valeur = (!v.is_empty()).then_some(v);
                    if cible == 1 {
                        opf.titre = valeur;
                    } else {
                        opf.auteur = valeur;
                    }
                    cible = 0;
                }
                _ => {}
            },
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }
    opf
}

fn ajouter_item(opf: &mut Opf, e: &BytesStart<'_>) {
    if let (Some(id), Some(href)) = (attribut(e, b"id"), attribut(e, b"href")) {
        opf.manifest.insert(id, href);
    }
}

fn ajouter_itemref(opf: &mut Opf, e: &BytesStart<'_>) {
    if let Some(id) = attribut(e, b"idref") {
        opf.spine.push(id);
    }
}

fn decoder_pourcent(s: &str) -> String {
    let b = s.as_bytes();
    let hex = |i: usize| b.get(i).and_then(|c| (*c as char).to_digit(16));
    let mut sortie = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match (b[i], hex(i + 1), hex(i + 2)) {
            (b'%', Some(h), Some(l)) => {
                sortie.push((h * 16 + l) as u8);
                i += 3;
            }
            (c, _, _) => {
                sortie.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&sortie).into_owned()
}

/// Chemin de partie absolu dans l'archive (`dossier` + `href`), sans `.` ni `..`.
/// Un href qui remonte au-dela de la racine de l'archive est refuse.
fn normaliser(dossier: &str, href: &str) -> Result<String> {
    let sans_ancre = href.split(['#', '?']).next().unwrap_or("");
    let href = decoder_pourcent(sans_ancre).replace('\\', "/");
    let mut parts: Vec<&str> =
        if href.starts_with('/') { Vec::new() } else { dossier.split('/').filter(|s| !s.is_empty()).collect() };
    for seg in href.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                if parts.pop().is_none() {
                    return Err(anyhow!("EPUB refusé : le chemin '{href}' sort de l'archive"));
                }
            }
            s => parts.push(s),
        }
    }
    Ok(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn zip_de(d: &std::path::Path, parties: &[(&str, &str)]) -> String {
        let p = d.join("t.epub");
        let mut z = zip::ZipWriter::new(std::fs::File::create(&p).unwrap());
        for (nom, contenu) in parties {
            z.start_file(*nom, zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(contenu.as_bytes()).unwrap();
        }
        z.finish().unwrap();
        p.to_str().unwrap().to_string()
    }

    const CONTAINER: &str = r#"<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#;

    fn opf(manifest_href: &str, spine: &str) -> String {
        format!(
            r#"<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Mon &amp; livre</dc:title><dc:creator>Ada</dc:creator></metadata><manifest><item id="c1" href="{manifest_href}" media-type="application/xhtml+xml"/><item id="c2" href="absent.xhtml" media-type="application/xhtml+xml"/></manifest><spine>{spine}</spine></package>"#
        )
    }

    #[test]
    fn epub_minimal_valide_titre_auteur_chapitres_dans_l_ordre() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(
            d.path(),
            &[
                ("META-INF/container.xml", CONTAINER),
                ("OEBPS/content.opf", &opf("text/ch%201.xhtml", r#"<itemref idref="c2"/><itemref idref="c1"/>"#)),
                ("OEBPS/text/ch 1.xhtml", "<html><body><p>é Bonjour</p></body></html>"),
            ],
        );
        let l = lire_epub(&p).unwrap();
        assert_eq!(l.titre.as_deref(), Some("Mon & livre"));
        assert_eq!(l.auteur.as_deref(), Some("Ada"));
        // c2 est absent de l'archive : ignore, c1 est lu
        assert_eq!(l.chapitres.len(), 1);
        assert!(l.chapitres[0].contains("é Bonjour"));
    }

    #[test]
    fn epub_construit_par_epub_builder_se_relit() {
        let d = tempfile::tempdir().unwrap();
        let src = d.path().join("a.txt");
        std::fs::write(&src, "Premier paragraphe\n\nSecond paragraphe").unwrap();
        let sortie = d.path().join("a.epub");
        super::super::documents::txt_to_epub(src.to_str().unwrap(), sortie.to_str().unwrap()).unwrap();
        let l = lire_epub(sortie.to_str().unwrap()).unwrap();
        let tout = l.chapitres.join("\n");
        assert!(tout.contains("Premier paragraphe") && tout.contains("Second paragraphe"), "{tout}");
    }

    #[test]
    fn epub_sans_spine_est_refuse() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(d.path(), &[("META-INF/container.xml", CONTAINER), ("OEBPS/content.opf", &opf("a.xhtml", ""))]);
        let e = lire_epub(&p).err().unwrap().to_string();
        assert!(e.contains("spine"), "{e}");
    }

    #[test]
    fn epub_sans_container_est_refuse() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(d.path(), &[("OEBPS/content.opf", &opf("a.xhtml", r#"<itemref idref="c1"/>"#))]);
        let e = lire_epub(&p).err().unwrap().to_string();
        assert!(e.contains("container.xml absent"), "{e}");
    }

    #[test]
    fn epub_chemin_piege_est_refuse() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(
            d.path(),
            &[
                ("META-INF/container.xml", CONTAINER),
                ("OEBPS/content.opf", &opf("../../x", r#"<itemref idref="c1"/>"#)),
                ("x", "<p>secret</p>"),
            ],
        );
        let e = lire_epub(&p).err().unwrap().to_string();
        assert!(e.contains("sort de l'archive"), "{e}");
    }

    #[test]
    fn epub_chapitre_manquant_donne_une_erreur_claire() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(
            d.path(),
            &[
                ("META-INF/container.xml", CONTAINER),
                ("OEBPS/content.opf", &opf("n-existe-pas.xhtml", r#"<itemref idref="c1"/>"#)),
            ],
        );
        let e = lire_epub(&p).err().unwrap().to_string();
        assert!(e.contains("sans contenu lisible"), "{e}");
    }

    #[test]
    fn epub_lecture_bornee() {
        let d = tempfile::tempdir().unwrap();
        let p = zip_de(
            d.path(),
            &[
                ("META-INF/container.xml", CONTAINER),
                ("OEBPS/content.opf", &opf("a.xhtml", r#"<itemref idref="c1"/>"#)),
                ("OEBPS/a.xhtml", &"a".repeat(2 * 1024 * 1024)),
            ],
        );
        assert!(lire_epub_max(&p, 4 << 20, 8 << 20).is_ok());
        let e = lire_epub_max(&p, 1 << 20, 8 << 20).err().unwrap().to_string();
        assert!(e.contains("refusé"), "{e}");
    }

    #[test]
    fn normaliser_gere_les_cas_tordus() {
        assert_eq!(normaliser("OEBPS", "a/../b.xhtml#x").unwrap(), "OEBPS/b.xhtml");
        assert_eq!(normaliser("OEBPS", "/r.xhtml").unwrap(), "r.xhtml");
        assert!(normaliser("OEBPS", "%2e%2e/%2e%2e/x").is_err());
        assert!(normaliser("", "..\\x").is_err());
    }
}
