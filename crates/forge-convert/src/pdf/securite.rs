//! Chiffrement AES-256 (sans qpdf : rien ne passe en ligne de commande) et
//! metadonnees du document.

use crate::erreur::{param, ConvertError, Resultat};
use lopdf::encryption::crypt_filters::{Aes256CryptFilter, CryptFilter};
use lopdf::{Document, EncryptionState, EncryptionVersion, Object, Permissions};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

/// Autorisations accordees au lecteur qui n'a que le mot de passe d'ouverture.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Autorisations {
    pub imprimer: bool,
    pub copier: bool,
    pub modifier: bool,
    pub annoter: bool,
    pub remplir_formulaires: bool,
}

impl Default for Autorisations {
    fn default() -> Self {
        Autorisations { imprimer: true, copier: true, modifier: false, annoter: true, remplir_formulaires: true }
    }
}

impl Autorisations {
    fn drapeaux(self) -> Permissions {
        let mut p = Permissions::COPYABLE_FOR_ACCESSIBILITY;
        if self.imprimer {
            p |= Permissions::PRINTABLE | Permissions::PRINTABLE_IN_HIGH_QUALITY;
        }
        if self.copier {
            p |= Permissions::COPYABLE;
        }
        if self.modifier {
            p |= Permissions::MODIFIABLE | Permissions::ASSEMBLABLE;
        }
        if self.annoter {
            p |= Permissions::ANNOTABLE;
        }
        if self.remplir_formulaires {
            p |= Permissions::FILLABLE;
        }
        p
    }
}

/// Chiffre le document en AES-256 (PDF 2.0, R6). Proprietaire = utilisateur si vide.
pub fn chiffrer(doc: &mut Document, utilisateur: &str, proprietaire: &str, autorisations: Autorisations) -> Resultat<()> {
    if utilisateur.is_empty() {
        return Err(param("mot de passe d'ouverture requis"));
    }
    if utilisateur.len() > 127 || proprietaire.len() > 127 {
        return Err(param("mot de passe trop long (127 octets maximum)"));
    }
    let proprietaire = if proprietaire.is_empty() { utilisateur } else { proprietaire };
    let mut cle = [0u8; 32];
    getrandom::fill(&mut cle).map_err(|e| ConvertError::Echec(format!("générateur aléatoire indisponible : {e}")))?;
    let filtre: Arc<dyn CryptFilter> = Arc::new(Aes256CryptFilter);
    let version = EncryptionVersion::V5 {
        encrypt_metadata: true,
        crypt_filters: BTreeMap::from([(b"StdCF".to_vec(), filtre)]),
        file_encryption_key: &cle,
        stream_filter: b"StdCF".to_vec(),
        string_filter: b"StdCF".to_vec(),
        owner_password: proprietaire,
        user_password: utilisateur,
        permissions: autorisations.drapeaux(),
    };
    let etat = EncryptionState::try_from(version)?;
    doc.encrypt(&etat)?;
    Ok(())
}

/// Metadonnees du dictionnaire Info.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Metadonnees {
    pub titre: Option<String>,
    pub auteur: Option<String>,
    pub sujet: Option<String>,
    pub mots_cles: Option<String>,
    pub createur: Option<String>,
    pub producteur: Option<String>,
    /// Lecture seule (renseigne a la lecture).
    #[serde(default)]
    pub pages: u32,
}

const CLES: [(&[u8], usize); 6] =
    [(b"Title", 0), (b"Author", 1), (b"Subject", 2), (b"Keywords", 3), (b"Creator", 4), (b"Producer", 5)];

impl Metadonnees {
    fn champ(&mut self, i: usize) -> &mut Option<String> {
        match i {
            0 => &mut self.titre,
            1 => &mut self.auteur,
            2 => &mut self.sujet,
            3 => &mut self.mots_cles,
            4 => &mut self.createur,
            _ => &mut self.producteur,
        }
    }
}

fn info_id(doc: &Document) -> Option<lopdf::ObjectId> {
    doc.trailer.get(b"Info").and_then(Object::as_reference).ok()
}

/// Lit les metadonnees.
pub fn lire_metadonnees(doc: &Document) -> Metadonnees {
    let mut m = Metadonnees { pages: doc.get_pages().len() as u32, ..Default::default() };
    let info = info_id(doc).and_then(|id| doc.get_dictionary(id).ok()).or_else(|| doc.trailer.get(b"Info").and_then(Object::as_dict).ok());
    if let Some(info) = info {
        for (cle, i) in CLES {
            if let Ok(v) = info.get(cle) {
                *m.champ(i) = lopdf::decode_text_string(v).ok().filter(|s| !s.is_empty());
            }
        }
    }
    m
}

/// Ecrit les metadonnees : `Some("")` efface le champ, `None` le laisse intact.
pub fn ecrire_metadonnees(doc: &mut Document, mut m: Metadonnees) -> Resultat<()> {
    let id = match info_id(doc) {
        Some(id) if doc.get_dictionary(id).is_ok() => id,
        _ => {
            let id = doc.add_object(lopdf::Dictionary::new());
            doc.trailer.set("Info", Object::Reference(id));
            id
        }
    };
    let info = doc.get_dictionary_mut(id)?;
    for (cle, i) in CLES {
        match m.champ(i).take() {
            Some(v) if v.is_empty() => {
                info.remove(cle);
            }
            Some(v) => {
                if v.chars().count() > 4096 {
                    return Err(param("métadonnée trop longue (4096 caractères maximum)"));
                }
                info.set(cle.to_vec(), lopdf::text_string(&v));
            }
            None => {}
        }
    }
    Ok(())
}
