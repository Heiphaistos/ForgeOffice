//! Texte, Markdown et HTML vers PDF/HTML/TXT (repris de ForgePDF `text_engine`).
//! La creation de PDF passe par `pdf::texte::texte_vers_pdf` (lopdf, plus de printpdf).

use anyhow::{anyhow, Result};

// ── TXT → PDF ─────────────────────────────────────────────────────────────────

pub fn txt_to_pdf(input_path: &str, output_path: &str) -> Result<()> {
    let raw = std::fs::read_to_string(input_path)
        .map_err(|e| anyhow!("Lecture '{}': {}", input_path, e))?;
    create_pdf_from_text(&raw, output_path)
}

pub fn create_pdf_from_text(text: &str, output_path: &str) -> Result<()> {
    let octets = crate::pdf::texte::texte_vers_pdf(text)?;
    std::fs::write(output_path, octets).map_err(|e| anyhow!("Écriture '{}': {}", output_path, e))
}

// ── Markdown → HTML ────────────────────────────────────────────────────────────

pub fn md_to_html(input_path: &str, output_path: &str) -> Result<()> {
    use pulldown_cmark::{html, Options, Parser};

    let md = std::fs::read_to_string(input_path)
        .map_err(|e| anyhow!("Lecture '{}': {}", input_path, e))?;

    let parser = Parser::new_ext(&md, Options::all());
    let mut body = String::new();
    html::push_html(&mut body, parser);

    let full = format!(
        "<!DOCTYPE html>\n<html>\n<head>\
        <meta charset=\"UTF-8\">\
        <style>body{{font-family:sans-serif;max-width:800px;margin:auto;padding:2rem}}</style>\
        </head>\n<body>\n{}\n</body>\n</html>",
        body
    );

    std::fs::write(output_path, full)
        .map_err(|e| anyhow!("Ecriture '{}': {}", output_path, e))?;

    Ok(())
}

// ── Markdown → TXT (stripping) ─────────────────────────────────────────────────

pub fn md_to_txt(input_path: &str, output_path: &str) -> Result<()> {
    let text = extract_text_from_md(input_path)?;
    std::fs::write(output_path, text)
        .map_err(|e| anyhow!("Ecriture '{}': {}", output_path, e))?;
    Ok(())
}

fn extract_text_from_md(input_path: &str) -> Result<String> {
    use pulldown_cmark::{Event, Options, Parser, TagEnd};

    let md = std::fs::read_to_string(input_path)
        .map_err(|e| anyhow!("Lecture '{}': {}", input_path, e))?;

    let parser = Parser::new_ext(&md, Options::all());
    let mut out = String::new();

    for event in parser {
        match event {
            Event::Text(t) | Event::Code(t) => out.push_str(&t),
            Event::SoftBreak | Event::HardBreak => out.push('\n'),
            Event::End(TagEnd::Paragraph) => out.push_str("\n\n"),
            Event::End(TagEnd::Heading(_)) => out.push_str("\n\n"),
            Event::End(TagEnd::Item) => out.push('\n'),
            Event::End(TagEnd::CodeBlock) => out.push('\n'),
            _ => {}
        }
    }

    Ok(out.trim().to_string())
}

// ── Markdown → PDF ─────────────────────────────────────────────────────────────

pub fn md_to_pdf(input_path: &str, output_path: &str) -> Result<()> {
    let text = extract_text_from_md(input_path)?;
    create_pdf_from_text(&text, output_path)
}

// ── HTML → TXT ─────────────────────────────────────────────────────────────────

pub fn html_to_txt(input_path: &str, output_path: &str) -> Result<()> {
    let content = extract_text_from_html(input_path)?;
    std::fs::write(output_path, content)
        .map_err(|e| anyhow!("Ecriture '{}': {}", output_path, e))?;
    Ok(())
}

fn extract_text_from_html(input_path: &str) -> Result<String> {
    let html = std::fs::read_to_string(input_path)
        .map_err(|e| anyhow!("Lecture '{}': {}", input_path, e))?;

    let mut result = String::new();
    let mut in_tag = false;
    let mut in_skip = false; // script / style / head → on ignore le contenu
    let mut tag_buf = String::new();

    for ch in html.chars() {
        match ch {
            '<' => {
                in_tag = true;
                tag_buf.clear();
            }
            '>' => {
                let tag = tag_buf.trim().to_lowercase();
                // Balises dont le contenu est à ignorer
                if tag.starts_with("script") || tag.starts_with("style") || tag.starts_with("head") {
                    in_skip = true;
                } else if tag.starts_with("/script") || tag.starts_with("/style") || tag.starts_with("/head") {
                    in_skip = false;
                } else if !in_skip {
                    // Balises structurelles → retour à la ligne
                    if tag.starts_with("br") || tag.starts_with("p") || tag.starts_with("/p")
                        || tag.starts_with("div") || tag.starts_with("/div")
                        || tag.starts_with("li") || tag.starts_with("h1") || tag.starts_with("h2")
                        || tag.starts_with("h3") || tag.starts_with("h4") || tag.starts_with("h5")
                        || tag.starts_with("h6") || tag.starts_with("tr")
                    {
                        result.push('\n');
                    }
                }
                in_tag = false;
            }
            _ if in_tag => tag_buf.push(ch),
            _ if !in_skip => result.push(ch),
            _ => {}
        }
    }

    // Normalise les espaces multiples
    let cleaned: String = result
        .lines()
        .map(|l| l.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(cleaned)
}

// ── HTML → PDF ─────────────────────────────────────────────────────────────────

pub fn html_to_pdf(input_path: &str, output_path: &str) -> Result<()> {
    let text = extract_text_from_html(input_path)?;
    create_pdf_from_text(&text, output_path)
}

#[cfg(test)]
mod tests {
    /// Les accents français doivent sortir en WinAnsi (é = 0xE9) dans le flux de page.
    #[test]
    fn text_pdf_keeps_french_accents() {
        let out = std::env::temp_dir().join(format!("fp_txt_{}.pdf", std::process::id()));
        let out_s = out.to_string_lossy().to_string();
        super::create_pdf_from_text("Été à Noël", &out_s).unwrap();
        let doc = lopdf::Document::load(&out_s).unwrap();
        let page = *doc.get_pages().get(&1).unwrap();
        let content = doc.get_page_content(page).unwrap();
        let _ = std::fs::remove_file(&out);
        let needle = [0xC9, b't', 0xE9, b' ', 0xE0, b' ', b'N', b'o', 0xEB, b'l'];
        let hex: String = needle.iter().map(|b| format!("{b:02X}")).collect();
        assert!(
            content.windows(needle.len()).any(|w| w == needle)
                || String::from_utf8_lossy(&content).to_uppercase().contains(&hex),
            "texte WinAnsi introuvable dans le flux"
        );
    }
}
