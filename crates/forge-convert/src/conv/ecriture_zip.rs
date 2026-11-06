//! Ecriture EPUB et DOCX maison avec notre `zip` (9.x corrige) : epub-builder (zip 6) et docx-rs
//! (zip 8) etaient retires pour ne plus lier de versions vulnerables du crate `zip`.
//! Les deux formats sont des archives : EPUB = `mimetype` non compresse en premier, container.xml,
//! OPF, navigation, chapitre ; DOCX = types de contenu, relations, document.xml.

use anyhow::{anyhow, Result};
use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Texte XML sur : entites echappees, caracteres interdits en XML 1.0 retires.
pub(crate) fn xml_echapper(s: &str) -> String {
    s.chars()
        .filter(|&c| matches!(c, '\t' | '\n' | '\r') || (c >= ' ' && c != '\u{FFFE}' && c != '\u{FFFF}'))
        .fold(String::with_capacity(s.len()), |mut o, c| {
            match c {
                '&' => o.push_str("&amp;"),
                '<' => o.push_str("&lt;"),
                '>' => o.push_str("&gt;"),
                '"' => o.push_str("&quot;"),
                autre => o.push(autre),
            }
            o
        })
}

/// Ecrit les parties dans une archive (compressees, sauf les `stockees`).
fn archive(parties: &[(&str, String, bool)]) -> Result<Vec<u8>> {
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    for (nom, contenu, stocke) in parties {
        let methode = if *stocke { CompressionMethod::Stored } else { CompressionMethod::Deflated };
        zip.start_file(*nom, SimpleFileOptions::default().compression_method(methode)).map_err(|e| anyhow!("ZIP '{nom}' : {e}"))?;
        zip.write_all(contenu.as_bytes()).map_err(|e| anyhow!("ZIP '{nom}' : {e}"))?;
    }
    Ok(zip.finish().map_err(|e| anyhow!("ZIP : {e}"))?.into_inner())
}

/// EPUB 3 a un chapitre (`corps_xhtml` = contenu du `<body>`, XHTML bien forme).
pub(crate) fn epub(titre: &str, auteur: &str, corps_xhtml: &str) -> Result<Vec<u8>> {
    let (t, a) = (xml_echapper(titre), xml_echapper(auteur));
    let id = crate::fichiers::jeton();
    let ns = "http://www.w3.org/1999/xhtml";
    let container = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#;
    let opf = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:forge:{id}</dc:identifier><dc:title>{t}</dc:title><dc:creator>{a}</dc:creator><dc:language>fr</dc:language><meta property="dcterms:modified">2000-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="content.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>"#
    );
    let nav = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="{ns}" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>{t}</title></head><body><nav epub:type="toc"><ol><li><a href="content.xhtml">{t}</a></li></ol></nav></body></html>"#
    );
    let contenu = format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<html xmlns=\"{ns}\">\n<head><title>{t}</title></head>\n<body>\n{corps_xhtml}\n</body>\n</html>");
    archive(&[
        ("mimetype", "application/epub+zip".into(), true),
        ("META-INF/container.xml", container.into(), false),
        ("OEBPS/content.opf", opf, false),
        ("OEBPS/nav.xhtml", nav, false),
        ("OEBPS/content.xhtml", contenu, false),
    ])
}

/// Paragraphe de DOCX : texte, taille en demi-points (None = defaut) et gras.
pub(crate) struct Paragraphe {
    pub texte: String,
    pub taille: Option<usize>,
    pub gras: bool,
}

/// DOCX minimal (paragraphes d'un seul « run »).
pub(crate) fn docx(paragraphes: &[Paragraphe]) -> Result<Vec<u8>> {
    let mut corps = String::new();
    for p in paragraphes {
        let mut props = String::new();
        if p.gras {
            props.push_str("<w:b/>");
        }
        if let Some(t) = p.taille {
            props.push_str(&format!("<w:sz w:val=\"{t}\"/>"));
        }
        let rpr = if props.is_empty() { String::new() } else { format!("<w:rPr>{props}</w:rPr>") };
        corps.push_str(&format!("<w:p><w:r>{rpr}<w:t xml:space=\"preserve\">{}</w:t></w:r></w:p>", xml_echapper(&p.texte)));
    }
    let types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"#;
    let rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"#;
    let document = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>{corps}<w:sectPr/></w:body></w:document>"
    );
    archive(&[("[Content_Types].xml", types.into(), false), ("_rels/.rels", rels.into(), false), ("word/document.xml", document, false)])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn epub_commence_par_mimetype_non_compresse() {
        let octets = epub("Titre & co", "Ada", "<p>Bonjour</p>").unwrap();
        let mut z = zip::ZipArchive::new(Cursor::new(octets)).unwrap();
        let mut premier = z.by_index(0).unwrap();
        assert_eq!(premier.name().unwrap(), "mimetype");
        assert_eq!(premier.compression(), CompressionMethod::Stored);
        let mut s = String::new();
        premier.read_to_string(&mut s).unwrap();
        assert_eq!(s, "application/epub+zip");
    }

    #[test]
    fn xml_echappe_et_filtre_les_caracteres_interdits() {
        assert_eq!(xml_echapper("a<b>&\"c\u{0}\u{8}d"), "a&lt;b&gt;&amp;&quot;cd");
    }
}
