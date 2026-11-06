//! API typee : une `Operation` serialisable (la coquille Tauri la recoit telle quelle
//! en JSON), executee par `run`, qui renvoie un `Output` ou une `ConvertError` francaise.
//! `capacites()` dit a l'interface ce qui est disponible sur cette machine.

use crate::conv::{self, OptionsConversion};
use crate::erreur::{param, ConvertError, Resultat};
use crate::fichiers::{lire_entree, Cible};
use crate::outils::Outil;
use crate::pdf::{
    self, annotations::Annotation, caviardage::Correctif, caviardage::RapportCaviardage, compression::BilanCompression,
    compression::NiveauCompression, externe::FormatImage, formulaires::ChampInfo, formulaires::NouveauChamp,
    pages::Decoupage, pages::PageOrdre, securite::Autorisations, securite::Metadonnees, tampons::Filigrane,
    tampons::TextePages, texte::Comparaison, texte::TextePage, Zone,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

/// Nombre maximal de fichiers par operation (fusion, images, zip).
const MAX_FICHIERS: usize = 500;

/// Transformation appliquee a un PDF charge (enchainables dans `Operation::Pdf`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ActionPdf {
    ExtrairePages { pages: String },
    SupprimerPages { pages: String },
    Reorganiser { ordre: Vec<PageOrdre> },
    Pivoter { degres: i64, #[serde(default)] pages: Option<String> },
    Filigrane(Filigrane),
    /// Numerotation, Bates, ou tout texte « {page} / {total } ».
    TextePages(TextePages),
    EntetePied { #[serde(default)] entete: Option<String>, #[serde(default)] pied: Option<String>, #[serde(default = "dix")] taille: f32 },
    Metadonnees(Metadonnees),
    /// Chiffrement AES-256 (a placer en dernier).
    Chiffrer { utilisateur: String, #[serde(default)] proprietaire: String, #[serde(default)] autorisations: Autorisations },
    Compresser { #[serde(default)] niveau: NiveauCompression },
    AjouterChamps { champs: Vec<NouveauChamp> },
    RemplirChamps { valeurs: BTreeMap<String, String>, #[serde(default)] aplatir: bool },
    Aplatir,
    Annoter { annotations: Vec<Annotation> },
    Caviarder { zones: Vec<Zone> },
    CorrigerTexte { correctifs: Vec<Correctif> },
}

fn dix() -> f32 {
    10.0
}
fn cent_cinquante() -> u32 {
    150
}
fn fra() -> String {
    "fra".into()
}

/// Operation complete. `mot_de_passe` : mot de passe d'ouverture du PDF d'entree
/// (un PDF ouvert avec son mot de passe puis enregistre sans `Chiffrer` = dechiffrement).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Operation {
    /// Charge, applique les actions dans l'ordre, enregistre.
    Pdf { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String>, actions: Vec<ActionPdf>, sortie: Cible },
    Infos { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String> },
    /// Fusion de PDF. `ordre` (facultatif) : indices 0-based dans `entrees`, uniques, dans l'ordre de
    /// fusion voulu (les fichiers non cites sont laisses de cote) ; sans `ordre`, l'ordre de `entrees`.
    /// `mots_de_passe` (facultatif) : mot de passe d'ouverture de chaque entree, dans l'ordre de `entrees`.
    Fusionner { entrees: Vec<PathBuf>, #[serde(default)] ordre: Option<Vec<usize>>, #[serde(default)] mots_de_passe: Vec<Option<String>>, sortie: Cible },
    /// `noms` (facultatif) : noms de base (sans extension) des fichiers produits, dans l'ordre.
    Decouper { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String>, mode: Decoupage, #[serde(default)] noms: Vec<String>, sortie: Cible },
    ListerChamps { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String> },
    ListerAnnotations { entree: PathBuf, page: u32 },
    ExtraireTexte { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String> },
    ExtraireImages { entree: PathBuf, #[serde(default)] mot_de_passe: Option<String>, #[serde(default)] noms: Vec<String>, sortie: Cible },
    Comparer { a: PathBuf, b: PathBuf },
    ImagesVersPdf { entrees: Vec<PathBuf>, sortie: Cible },
    PdfVersImages { entree: PathBuf, #[serde(default = "cent_cinquante")] dpi: u32, #[serde(default)] format: FormatImage, #[serde(default)] noms: Vec<String>, sortie: Cible },
    PdfA { entree: PathBuf, sortie: Cible },
    Ocr { entree: PathBuf, #[serde(default = "fra")] langue: String, #[serde(default)] forcer: bool, sortie: Cible },
    Convertir { entree: PathBuf, vers: String, #[serde(default)] options: OptionsConversion, sortie: Cible },
    Miniature { entree: PathBuf },
    /// `noms` (facultatif) : nom de chaque fichier DANS l'archive, dans l'ordre de `entrees`.
    Zipper { entrees: Vec<PathBuf>, #[serde(default)] noms: Vec<String>, sortie: Cible },
    Capacites,
}

/// Resultat d'une operation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Output {
    Fichiers {
        fichiers: Vec<PathBuf>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        caviardage: Option<RapportCaviardage>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        compression: Option<BilanCompression>,
        /// Mises en garde a afficher a l'utilisateur (ex. liens externes suivis par LibreOffice).
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        avertissements: Vec<String>,
    },
    Infos(Metadonnees),
    Champs { champs: Vec<ChampInfo> },
    Annotations { contenus: Vec<String> },
    Texte { texte: String, pages: Vec<TextePage> },
    Comparaison(Comparaison),
    /// Miniature PNG en data-URL.
    Image { data_url: String },
    Capacites(Capacites),
}

impl Output {
    fn fichiers(fichiers: Vec<PathBuf>) -> Self {
        Output::Fichiers { fichiers, caviardage: None, compression: None, avertissements: Vec::new() }
    }
}

/// Disponibilite d'une operation (pour griser l'interface).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Capacite {
    pub operation: String,
    pub disponible: bool,
    /// Outil externe requis (absent = pur Rust).
    pub outil: Option<String>,
    /// Message francais a afficher si indisponible.
    pub raison: Option<String>,
}

/// Outils externes detectes et operations disponibles.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Capacites {
    pub version: String,
    pub outils: BTreeMap<String, Option<PathBuf>>,
    pub operations: Vec<Capacite>,
}

const PUR_RUST: &[&str] = &[
    "fusionner", "decouper", "extraire_pages", "supprimer_pages", "reorganiser", "pivoter", "filigrane",
    "texte_pages", "entete_pied", "metadonnees", "chiffrer", "dechiffrer", "compresser", "ajouter_champs",
    "lister_champs", "remplir_champs", "aplatir", "annoter", "caviarder", "corriger_texte", "images_vers_pdf",
    "extraire_texte", "extraire_images", "comparer", "convertir", "miniature", "zipper", "infos",
];

/// Ce qui est disponible sur cette machine.
pub fn capacites() -> Capacites {
    let outils_connus =
        [Outil::Ghostscript, Outil::Mutool, Outil::Pdftoppm, Outil::Pdftotext, Outil::Ocrmypdf, Outil::LibreOffice];
    let outils: BTreeMap<String, Option<PathBuf>> = outils_connus.iter().map(|o| (o.nom().to_string(), o.trouver())).collect();
    let dispo = |o: Outil| outils.get(o.nom()).is_some_and(Option::is_some);
    let mut operations: Vec<Capacite> = PUR_RUST
        .iter()
        .map(|n| Capacite { operation: (*n).into(), disponible: true, outil: None, raison: None })
        .collect();
    let externe = |op: &str, outil: &str, ok: bool, raison: &str| Capacite {
        operation: op.into(),
        disponible: ok,
        outil: Some(outil.into()),
        raison: (!ok).then(|| raison.into()),
    };
    operations.push(externe("pdf_a", Outil::Ghostscript.nom(), dispo(Outil::Ghostscript), "Installez Ghostscript pour produire des PDF/A."));
    operations.push(externe("ocr", Outil::Ocrmypdf.nom(), dispo(Outil::Ocrmypdf), "Installez ocrmypdf et Tesseract pour la reconnaissance de texte."));
    // Toujours disponible : sans outil externe, le rendu simplifie en pur Rust prend le relais (avec avertissement).
    let c = externe("pdf_vers_images", "MuPDF, Poppler ou Ghostscript (sinon rendu simplifié intégré)", true, "");
    operations.push(c);
    operations.push(externe("office_haute_fidelite", Outil::LibreOffice.nom(), dispo(Outil::LibreOffice), "Installez LibreOffice pour une conversion Office vers PDF fidèle (sinon conversion simplifiée)."));
    Capacites { version: crate::VERSION.into(), outils, operations }
}

fn charger(chemin: &std::path::Path, mdp: &Option<String>) -> Resultat<lopdf::Document> {
    pdf::charger(&lire_entree(chemin)?, mdp.as_deref())
}

/// Ordre de fusion : indices valides et uniques (par defaut, tous les fichiers dans l'ordre).
fn ordre_fusion(ordre: Option<&[usize]>, n: usize) -> Resultat<Vec<usize>> {
    let Some(o) = ordre else { return Ok((0..n).collect()) };
    let mut vus = std::collections::HashSet::new();
    if o.is_empty() || o.iter().any(|&i| i >= n || !vus.insert(i)) {
        return Err(param(format!("ordre de fusion invalide (indices uniques de 0 à {} attendus)", n.saturating_sub(1))));
    }
    Ok(o.to_vec())
}

/// Noms personnalises : simples (aucun separateur) et sans doublon.
fn verifier_noms(noms: &[String]) -> Resultat<()> {
    if noms.len() > MAX_FICHIERS * 20 {
        return Err(param("trop de noms de sortie"));
    }
    let mut vus = std::collections::HashSet::new();
    for n in noms.iter().filter(|n| !n.trim().is_empty()) {
        crate::fichiers::valider_nom(n.trim())?;
        if !vus.insert(n.trim().to_lowercase()) {
            return Err(param(format!("nom de sortie en double : « {} »", n.trim())));
        }
    }
    Ok(())
}

/// Nom du i-eme fichier produit : le nom personnalise (extension ajoutee si absente), sinon « base-suffixe.ext ».
fn nom_produit(noms: &[String], i: usize, sortie: &Cible, suffixe: &str, ext: &str) -> String {
    match noms.get(i).map(|n| n.trim()).filter(|n| !n.is_empty()) {
        Some(n) if n.to_lowercase().ends_with(&format!(".{ext}")) => n.to_string(),
        Some(n) => format!("{n}.{ext}"),
        None => sortie.nom_derive(suffixe, ext),
    }
}

fn verifier_nombre(n: usize) -> Resultat<()> {
    if n == 0 {
        return Err(param("aucun fichier fourni"));
    }
    if n > MAX_FICHIERS {
        return Err(param(format!("trop de fichiers ({n}, maximum {MAX_FICHIERS})")));
    }
    Ok(())
}

/// Applique une action ; renvoie le rapport de caviardage / bilan de compression eventuels.
fn appliquer(doc: &mut lopdf::Document, a: &ActionPdf, cav: &mut Option<RapportCaviardage>, comp: &mut Option<BilanCompression>) -> Resultat<()> {
    use pdf::*;
    match a {
        ActionPdf::ExtrairePages { pages: p } => pages::extraire(doc, p)?,
        ActionPdf::SupprimerPages { pages: p } => pages::supprimer(doc, p)?,
        ActionPdf::Reorganiser { ordre } => pages::reorganiser(doc, ordre)?,
        ActionPdf::Pivoter { degres, pages: p } => pages::pivoter(doc, *degres, p.as_deref())?,
        ActionPdf::Filigrane(f) => tampons::filigraner(doc, f)?,
        ActionPdf::TextePages(t) => tampons::poser_texte_pages(doc, t)?,
        ActionPdf::EntetePied { entete, pied, taille } => tampons::entete_pied(doc, entete.as_deref(), pied.as_deref(), *taille)?,
        ActionPdf::Metadonnees(m) => securite::ecrire_metadonnees(doc, m.clone())?,
        ActionPdf::Chiffrer { utilisateur, proprietaire, autorisations } => {
            securite::chiffrer(doc, utilisateur, proprietaire, *autorisations)?
        }
        ActionPdf::Compresser { niveau } => *comp = Some(compression::compresser(doc, *niveau)?),
        ActionPdf::AjouterChamps { champs } => formulaires::ajouter_champs(doc, champs)?,
        ActionPdf::RemplirChamps { valeurs, aplatir } => {
            formulaires::remplir(doc, valeurs)?;
            if *aplatir {
                formulaires::aplatir(doc)?;
            }
        }
        ActionPdf::Aplatir => formulaires::aplatir(doc)?,
        ActionPdf::Annoter { annotations: l } => annotations::annoter(doc, l)?,
        ActionPdf::Caviarder { zones } => *cav = Some(caviardage::caviarder(doc, zones)?),
        ActionPdf::CorrigerTexte { correctifs } => *cav = Some(caviardage::corriger(doc, correctifs)?),
    }
    Ok(())
}

/// Execute une operation.
pub fn run(op: Operation) -> Result<Output, ConvertError> {
    match op {
        Operation::Pdf { entree, mot_de_passe, actions, sortie } => {
            if actions.len() > 100 {
                return Err(param("trop d'actions enchaînées (100 maximum)"));
            }
            if let Some(i) = actions.iter().position(|a| matches!(a, ActionPdf::Chiffrer { .. })) {
                if i + 1 != actions.len() {
                    return Err(param("le chiffrement doit être la dernière action"));
                }
            }
            let mut doc = charger(&entree, &mot_de_passe)?;
            let (mut cav, mut comp) = (None, None);
            for a in &actions {
                appliquer(&mut doc, a, &mut cav, &mut comp)?;
            }
            let chiffre = matches!(actions.last(), Some(ActionPdf::Chiffrer { .. }));
            let octets = if comp.is_some() && !chiffre {
                pdf::compression::enregistrer_compact(&mut doc)?
            } else {
                pdf::enregistrer(&mut doc)?
            };
            Ok(Output::Fichiers { fichiers: vec![sortie.ecrire(&octets)?], caviardage: cav, compression: comp, avertissements: Vec::new() })
        }
        Operation::Infos { entree, mot_de_passe } => Ok(Output::Infos(pdf::securite::lire_metadonnees(&charger(&entree, &mot_de_passe)?))),
        Operation::Fusionner { entrees, ordre, mots_de_passe, sortie } => {
            verifier_nombre(entrees.len())?;
            let ordre = ordre_fusion(ordre.as_deref(), entrees.len())?;
            let mdp = |i: usize| mots_de_passe.get(i).cloned().flatten();
            let docs = ordre.iter().map(|&i| charger(&entrees[i], &mdp(i))).collect::<Resultat<Vec<_>>>()?;
            let mut doc = pdf::pages::fusionner(docs)?;
            Ok(Output::fichiers(vec![sortie.ecrire(&pdf::enregistrer(&mut doc)?)?]))
        }
        Operation::Decouper { entree, mot_de_passe, mode, noms, sortie } => {
            verifier_noms(&noms)?;
            let doc = charger(&entree, &mot_de_passe)?;
            let mut fichiers = Vec::new();
            for (i, mut d) in pdf::pages::decouper(&doc, &mode)?.into_iter().enumerate() {
                let nom = nom_produit(&noms, i, &sortie, &format!("{}", i + 1), "pdf");
                fichiers.push(sortie.ecrire_sous(&nom, &pdf::enregistrer(&mut d)?)?);
            }
            Ok(Output::fichiers(fichiers))
        }
        Operation::ListerChamps { entree, mot_de_passe } => {
            Ok(Output::Champs { champs: pdf::formulaires::lister(&charger(&entree, &mot_de_passe)?) })
        }
        Operation::ListerAnnotations { entree, page } => {
            Ok(Output::Annotations { contenus: pdf::annotations::contenu_annotations(&charger(&entree, &None)?, page) })
        }
        Operation::ExtraireTexte { entree, mot_de_passe } => {
            let octets = lire_entree(&entree)?;
            let pages = pdf::texte::extraire_pages(&pdf::charger(&octets, mot_de_passe.as_deref())?);
            let texte = pdf::texte::extraire(&octets, mot_de_passe.as_deref())?;
            Ok(Output::Texte { texte, pages })
        }
        Operation::ExtraireImages { entree, mot_de_passe, noms, sortie } => {
            verifier_noms(&noms)?;
            let images = pdf::images::extraire_images(&charger(&entree, &mot_de_passe)?)?;
            let mut fichiers = Vec::new();
            for (i, img) in images.into_iter().enumerate() {
                let (stem, ext) = img.nom.rsplit_once('.').unwrap_or((img.nom.as_str(), "bin"));
                fichiers.push(sortie.ecrire_sous(&nom_produit(&noms, i, &sortie, stem, ext), &img.octets)?);
            }
            Ok(Output::fichiers(fichiers))
        }
        Operation::Comparer { a, b } => Ok(Output::Comparaison(pdf::texte::comparer(&lire_entree(&a)?, &lire_entree(&b)?)?)),
        Operation::ImagesVersPdf { entrees, sortie } => {
            verifier_nombre(entrees.len())?;
            let mut doc = pdf::images::images_vers_pdf(&entrees)?;
            Ok(Output::fichiers(vec![sortie.ecrire(&pdf::enregistrer(&mut doc)?)?]))
        }
        Operation::PdfVersImages { entree, dpi, format, noms, sortie } => {
            verifier_noms(&noms)?;
            let (pages, avertissements) = pdf::externe::rendre_pages(&lire_entree(&entree)?, dpi, format)?;
            let mut fichiers = Vec::new();
            for (i, (nom, octets)) in pages.into_iter().enumerate() {
                let (stem, ext) = nom.rsplit_once('.').unwrap_or((nom.as_str(), "png"));
                fichiers.push(sortie.ecrire_sous(&nom_produit(&noms, i, &sortie, stem, ext), &octets)?);
            }
            Ok(Output::Fichiers { fichiers, caviardage: None, compression: None, avertissements })
        }
        Operation::PdfA { entree, sortie } => Ok(Output::fichiers(vec![sortie.ecrire(&pdf::externe::pdf_a(&lire_entree(&entree)?)?)?])),
        Operation::Ocr { entree, langue, forcer, sortie } => {
            Ok(Output::fichiers(vec![sortie.ecrire(&pdf::externe::ocr(&lire_entree(&entree)?, &langue, forcer)?)?]))
        }
        Operation::Convertir { entree, vers, options, sortie } => {
            let libreoffice = conv::utilise_libreoffice(&entree, &vers, &options);
            let chemin = conv::convertir(&entree, &vers, &options, &sortie)?;
            let avertissements = if libreoffice { vec![pdf::externe::AVERTISSEMENT_LIBREOFFICE.to_string()] } else { Vec::new() };
            Ok(Output::Fichiers { fichiers: vec![chemin], caviardage: None, compression: None, avertissements })
        }
        Operation::Miniature { entree } => {
            crate::fichiers::verifier_entree(&entree)?;
            let p = entree.to_str().ok_or_else(|| ConvertError::CheminRefuse("chemin non UTF-8".into()))?;
            Ok(Output::Image { data_url: conv::images::generate_thumbnail(p)? })
        }
        Operation::Zipper { entrees, noms, sortie } => {
            verifier_nombre(entrees.len())?;
            verifier_noms(&noms)?;
            Ok(Output::fichiers(vec![sortie.ecrire(&zipper(&entrees, &noms)?)?]))
        }
        Operation::Capacites => Ok(Output::Capacites(capacites())),
    }
}

/// Archive ZIP des fichiers (noms dedoublonnes, taille totale bornee).
pub fn zipper(entrees: &[PathBuf], noms: &[String]) -> Resultat<Vec<u8>> {
    use std::io::Write;
    let mut tampon = std::io::Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut tampon);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut vus = std::collections::HashSet::new();
    let mut total = 0u64;
    for (i, e) in entrees.iter().enumerate() {
        let octets = lire_entree(e)?;
        total += octets.len() as u64;
        if total > crate::fichiers::MAX_SORTIE {
            return Err(ConvertError::TropVolumineux { taille: total, limite: crate::fichiers::MAX_SORTIE });
        }
        let base = match noms.get(i).filter(|n| !n.trim().is_empty()) {
            Some(n) => n.trim().to_string(),
            None => e.file_name().and_then(|n| n.to_str()).unwrap_or("fichier").to_string(),
        };
        let mut nom = base.clone();
        let mut i = 2;
        while !vus.insert(nom.clone()) {
            nom = format!("{i}-{base}");
            i += 1;
        }
        zip.start_file(nom, options).map_err(|x| ConvertError::Echec(format!("ZIP : {x}")))?;
        zip.write_all(&octets).map_err(|x| ConvertError::Echec(format!("ZIP : {x}")))?;
    }
    zip.finish().map_err(|x| ConvertError::Echec(format!("ZIP : {x}")))?;
    Ok(tampon.into_inner())
}
