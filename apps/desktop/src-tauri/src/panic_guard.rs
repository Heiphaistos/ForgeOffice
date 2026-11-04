// Garde-fou des commandes lourdes : un fichier piege qui fait paniquer une bibliotheque ne doit pas
// tuer le processus (donc toutes les fenetres et les documents non enregistres). Le profil release
// compile en `panic = "unwind"` ; le detail du panic est deja consigne par le crochet de `lib.rs`
// (`install_panic_hook`) avant le deroulement de la pile, avec son emplacement dans le code.

use std::panic::{catch_unwind, AssertUnwindSafe};

pub const ERR_INTERNE: &str = "Erreur interne pendant l'opération : le fichier est peut-être endommagé. L'application reste ouverte.";

/// Execute `job` ; un panic devient l'erreur francaise `ERR_INTERNE`.
pub fn proteger<T>(job: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    catch_unwind(AssertUnwindSafe(job)).unwrap_or_else(|_| Err(ERR_INTERNE.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn un_panic_devient_une_erreur_sans_tuer_le_fil() {
        let r: Result<(), String> = proteger(|| panic!("fichier piege"));
        assert_eq!(r.unwrap_err(), ERR_INTERNE);
        assert_eq!(proteger(|| Ok(7)), Ok(7));
        assert_eq!(proteger::<()>(|| Err("refus".into())).unwrap_err(), "refus");
    }
}
