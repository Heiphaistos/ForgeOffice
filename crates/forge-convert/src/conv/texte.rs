use anyhow::{anyhow, Result};
use crate::pdf_engine::{save_pdf, text_ops};
use printpdf::{BuiltinFont, Mm, PdfDocument, PdfPage};

// ── Constantes PDF (printpdf attend des f32) ───────────────────────────────────

const PAGE_W: f32 = 210.0;
const PAGE_H: f32 = 297.0;
const MARGIN: f32 = 18.0;
const FONT_SIZE: f32 = 10.0;
const LINE_H_MM: f32 = 5.0; // hauteur de ligne en mm

fn lines_per_page() -> usize {
    ((PAGE_H - 2.0 * MARGIN) / LINE_H_MM) as usize
}

// ── Word wrap à 95 colonnes (Courier monospace) ────────────────────────────────

fn char_byte_index(s: &str, char_count: usize) -> usize {
    s.char_indices().nth(char_count).map(|(i, _)| i).unwrap_or(s.len())
}

/// Découpe le texte en lignes de `max_cols` colonnes max (safe UTF-8).
pub(crate) fn wrap_text(text: &str, max_cols: usize) -> Vec<String> {
    let mut result = Vec::new();
    for raw_line in text.lines() {
        if raw_line.chars().count() <= max_cols {
            result.push(raw_line.to_string());
        } else {
            let mut remaining = raw_line;
            while remaining.chars().count() > max_cols {
                let safe_end = char_byte_index(remaining, max_cols);
                let cut = remaining[..safe_end].rfind(' ').unwrap_or(safe_end);
                result.push(remaining[..cut].to_string());
                remaining = remaining[cut..].trim_start();
            }
            if !remaining.is_empty() {
                result.push(remaining.to_string());
            }
        }
    }
    result
}

fn wrap_lines(text: &str) -> Vec<String> {
    wrap_text(text, 95)
}

// ── TXT → PDF ─────────────────────────────────────────────────────────────────

pub fn txt_to_pdf(input_path: &str, output_path: &str) -> Result<()> {
    let raw = std::fs::read_to_string(input_path)
        .map_err(|e| anyhow!("Lecture '{}': {}", input_path, e))?;
    create_pdf_from_text(&raw, output_path)
}

pub fn create_pdf_from_text(text: &str, output_path: &str) -> Result<()> {
    let all_lines = wrap_lines(text);
    let lpp = lines_per_page();

    let mut pages: Vec<PdfPage> = all_lines
        .chunks(lpp)
        .map(|chunk| {
            let refs: Vec<&str> = chunk.iter().map(String::as_str).collect();
            let ops = text_ops(
                BuiltinFont::Courier, FONT_SIZE, Mm(MARGIN), Mm(PAGE_H - MARGIN),
                LINE_H_MM * 2.835, None, &refs, // mm → pt
            );
            PdfPage::new(Mm(PAGE_W), Mm(PAGE_H), ops)
        })
        .collect();
    if pages.is_empty() {
        // Fichier vide → page blanche
        pages.push(PdfPage::new(Mm(PAGE_W), Mm(PAGE_H), Vec::new()));
    }
    save_pdf(&mut PdfDocument::new("UniversalConverter"), pages, output_path)
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
