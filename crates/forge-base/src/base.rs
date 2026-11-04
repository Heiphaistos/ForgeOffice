//! La base ouverte : fichier `.fodb` (SQLite), securite, transactions, maintenance.

use std::cmp::Ordering as Ordre;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rusqlite::config::DbConfig;
use rusqlite::functions::FunctionFlags;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use rusqlite::limits::Limit;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use crate::erreur::{ErreurBase, Resultat};
use crate::ident::PREFIXE_INTERNE;
use crate::meta;

/// Extension conseillee des fichiers de base ForgeOffice.
pub const EXTENSION: &str = "fodb";

/// Delai par defaut d'une requete SQL interactive.
pub const DELAI_SQL_DEFAUT: Duration = Duration::from_secs(30);
/// Valeur de `delai_defaut_ms` qui signifie « pas de delai ».
const SANS_DELAI: u64 = u64::MAX;

const MODE_INTERNE: u8 = 0;
const MODE_UTILISATEUR: u8 = 1;
const MODE_SAUVEGARDE: u8 = 2;

/// PRAGMA d'inspection autorises au SQL utilisateur (l'argument est un nom de table ou d'index).
const PRAGMAS_INSPECTION: [&str; 11] = [
    "table_info", "table_xinfo", "table_list", "index_list", "index_info", "index_xinfo",
    "foreign_key_list", "foreign_key_check", "integrity_check", "quick_check", "optimize",
];

/// PRAGMA autorises au SQL utilisateur seulement sans valeur (lecture d'un reglage).
const PRAGMAS_LECTURE: [&str; 15] = [
    "collation_list", "function_list", "page_count", "page_size", "freelist_count",
    "user_version", "schema_version", "data_version", "compile_options", "encoding", "journal_mode",
    "foreign_keys", "secure_delete", "synchronous", "auto_vacuum",
];

/// Base de donnees ouverte (une connexion SQLite gardee).
pub struct Base {
    conn: Connection,
    chemin: Option<PathBuf>,
    lecture_seule: bool,
    mode: Arc<AtomicU8>,
    /// Echeance de la requete en cours (lue par le gestionnaire de progression de SQLite).
    echeance: Arc<Mutex<Option<Instant>>>,
    /// Delai par defaut des requetes interactives, en millisecondes.
    delai_defaut_ms: AtomicU64,
}

/// Retire l'echeance de la requete en cours quand elle sort de portee.
pub(crate) struct GardeDelai<'a> {
    echeance: &'a Mutex<Option<Instant>>,
    ancienne: Option<Instant>,
}

impl Drop for GardeDelai<'_> {
    fn drop(&mut self) {
        if let Ok(mut e) = self.echeance.lock() {
            *e = self.ancienne;
        }
    }
}

/// Remet le mode de securite precedent quand il sort de portee.
pub(crate) struct GardeMode<'a> {
    mode: &'a AtomicU8,
    ancien: u8,
}

impl Drop for GardeMode<'_> {
    fn drop(&mut self) {
        self.mode.store(self.ancien, Ordering::SeqCst);
    }
}

/// Informations generales (Fichier > Informations).
#[derive(Serialize, Debug, Clone)]
pub struct InfosBase {
    /// Chemin du fichier (absent en memoire).
    pub chemin: Option<String>,
    /// Ouverte en lecture seule.
    pub lecture_seule: bool,
    /// Taille en octets.
    pub taille_octets: i64,
    /// Version de SQLite.
    pub version_sqlite: String,
    /// Version du schema des metadonnees ForgeOffice.
    pub version_schema: Option<String>,
    /// Date de creation enregistree.
    pub cree_le: Option<String>,
    /// Mode de journalisation.
    pub journal: String,
    /// Nombre de tables utilisateur.
    pub nb_tables: i64,
    /// Transaction explicite en cours.
    pub transaction_en_cours: bool,
}

/// Resultat de « Compacter et reparer ».
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct RapportCompactage {
    /// Taille avant (octets).
    pub taille_avant: i64,
    /// Taille apres (octets).
    pub taille_apres: i64,
}

/// Resultat de la verification d'integrite.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct RapportIntegrite {
    /// Aucun probleme.
    pub ok: bool,
    /// Problemes de structure signales par SQLite.
    pub problemes: Vec<String>,
    /// Enregistrements orphelins (table, rowid, table parent).
    pub orphelins: Vec<(String, i64, String)>,
}

/// Tables internes ForgeOffice (le catalogue SQLite est deja protege par le mode defensif,
/// et SQLite y signale lui-meme ses ecritures lors d'un CREATE ou d'un DROP).
fn protegee(nom: &str) -> bool {
    nom.to_ascii_lowercase().starts_with(PREFIXE_INTERNE)
}

fn autoriser(mode: u8, ctx: &AuthContext<'_>) -> Authorization {
    use Authorization::{Allow, Deny};
    match ctx.action {
        AuthAction::Function { function_name } if function_name.eq_ignore_ascii_case("load_extension") => Deny,
        AuthAction::Attach { .. } | AuthAction::Detach { .. } => {
            if mode == MODE_SAUVEGARDE { Allow } else { Deny }
        }
        _ if mode != MODE_UTILISATEUR => Allow,
        AuthAction::Pragma { pragma_name, pragma_value } => {
            let nom = pragma_name.to_ascii_lowercase();
            let lecture = pragma_value.is_none() && PRAGMAS_LECTURE.contains(&nom.as_str());
            if lecture || PRAGMAS_INSPECTION.contains(&nom.as_str()) {
                Allow
            } else {
                Deny
            }
        }
        AuthAction::Insert { table_name }
        | AuthAction::Delete { table_name }
        | AuthAction::Update { table_name, .. }
        | AuthAction::DropTable { table_name }
        | AuthAction::CreateTable { table_name }
        | AuthAction::AlterTable { table_name, .. }
        | AuthAction::CreateIndex { table_name, .. }
        | AuthAction::DropIndex { table_name, .. }
        | AuthAction::CreateTrigger { table_name, .. }
        | AuthAction::DropTrigger { table_name, .. }
            if protegee(table_name) => Deny,
        AuthAction::CreateView { view_name } | AuthAction::DropView { view_name } if protegee(view_name) => Deny,
        _ => Allow,
    }
}

/// Supprime les accents courants et met en minuscules (recherche et tri a la francaise).
pub fn plier(texte: &str) -> String {
    texte
        .chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => 'a',
            'ç' => 'c',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'ì' | 'í' | 'î' | 'ï' => 'i',
            'ñ' => 'n',
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => 'o',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            'ý' | 'ÿ' => 'y',
            'œ' => 'o',
            'æ' => 'a',
            c => c,
        })
        .collect()
}

fn comparer_fr(a: &str, b: &str) -> Ordre {
    plier(a).cmp(&plier(b)).then_with(|| a.cmp(b))
}

fn verifier_entete(chemin: &Path) -> Resultat<()> {
    let mut f = fs::File::open(chemin)?;
    let mut entete = [0u8; 16];
    let lus = f.read(&mut entete)?;
    if lus == 0 {
        return Ok(());
    }
    if lus < 16 || &entete != b"SQLite format 3\0" {
        return Err(ErreurBase::msg(format!(
            "« {} » n'est pas une base de données ForgeOffice (.fodb) ou SQLite.",
            chemin.display()
        )));
    }
    Ok(())
}

impl Base {
    /// Cree un nouveau fichier de base. Refuse d'ecraser un fichier existant.
    pub fn creer(chemin: impl AsRef<Path>) -> Resultat<Self> {
        let chemin = chemin.as_ref();
        if chemin.exists() {
            return Err(ErreurBase::ExisteDeja(chemin.display().to_string()));
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(chemin, flags)?;
        Self::initialiser(conn, Some(chemin.to_path_buf()), false)
    }

    /// Ouvre un fichier existant en lecture-ecriture.
    pub fn ouvrir(chemin: impl AsRef<Path>) -> Resultat<Self> {
        let chemin = chemin.as_ref();
        if !chemin.is_file() {
            return Err(ErreurBase::Introuvable(chemin.display().to_string()));
        }
        verifier_entete(chemin)?;
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(chemin, flags)?;
        Self::initialiser(conn, Some(chemin.to_path_buf()), false)
    }

    /// Ouvre un fichier existant en lecture seule (aucune metadonnee n'est ecrite).
    pub fn ouvrir_lecture_seule(chemin: impl AsRef<Path>) -> Resultat<Self> {
        let chemin = chemin.as_ref();
        if !chemin.is_file() {
            return Err(ErreurBase::Introuvable(chemin.display().to_string()));
        }
        verifier_entete(chemin)?;
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(chemin, flags)?;
        Self::initialiser(conn, Some(chemin.to_path_buf()), true)
    }

    /// Base temporaire en memoire (tests, brouillons).
    pub fn en_memoire() -> Resultat<Self> {
        Self::initialiser(Connection::open_in_memory()?, None, false)
    }

    fn initialiser(mut conn: Connection, chemin: Option<PathBuf>, lecture_seule: bool) -> Resultat<Self> {
        conn.set_db_config(DbConfig::SQLITE_DBCONFIG_DEFENSIVE, true)?;
        conn.set_db_config(DbConfig::SQLITE_DBCONFIG_TRUSTED_SCHEMA, false)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        if !lecture_seule {
            if chemin.is_some() {
                conn.query_row("PRAGMA journal_mode=WAL", [], |_| Ok(()))?;
                conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
            }
            conn.execute_batch("PRAGMA secure_delete=ON;")?;
        }
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        let deterministe = FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC | FunctionFlags::SQLITE_INNOCUOUS;
        conn.create_scalar_function("fo_puissance", 2, deterministe, |ctx| {
            Ok(ctx.get::<Option<f64>>(0)?.zip(ctx.get::<Option<f64>>(1)?).map(|(a, b)| a.powf(b)).filter(|x| x.is_finite()))
        })?;
        conn.create_scalar_function("fo_racine", 1, deterministe, |ctx| {
            Ok(ctx.get::<Option<f64>>(0)?.filter(|x| *x >= 0.0).map(f64::sqrt))
        })?;
        conn.create_scalar_function("fo_plier", 1, deterministe, |ctx| {
            Ok(ctx.get::<Option<String>>(0)?.map(|t| plier(&t)))
        })?;
        conn.create_collation("FR", comparer_fr)?;
        let mode = Arc::new(AtomicU8::new(MODE_INTERNE));
        let partage = Arc::clone(&mode);
        conn.authorizer(Some(move |ctx: AuthContext<'_>| autoriser(partage.load(Ordering::SeqCst), &ctx)))?;
        // Limites raisonnables contre le SQL hostile ou accidentel.
        for (limite, valeur) in [
            (Limit::SQLITE_LIMIT_SQL_LENGTH, 10_000_000),
            (Limit::SQLITE_LIMIT_LENGTH, 256_000_000),
            (Limit::SQLITE_LIMIT_COLUMN, 1000),
            (Limit::SQLITE_LIMIT_EXPR_DEPTH, 200),
            (Limit::SQLITE_LIMIT_COMPOUND_SELECT, 100),
            (Limit::SQLITE_LIMIT_LIKE_PATTERN_LENGTH, 10_000),
        ] {
            conn.set_limit(limite, valeur)?;
        }
        // Delai d'execution : SQLite appelle ce gestionnaire toutes les 1000 operations.
        let echeance = Arc::new(Mutex::new(None::<Instant>));
        let surveille = Arc::clone(&echeance);
        conn.progress_handler(
            1000,
            Some(move || surveille.lock().map(|e| e.is_some_and(|t| Instant::now() >= t)).unwrap_or(false)),
        )?;
        let base = Self { conn, chemin, lecture_seule, mode, echeance, delai_defaut_ms: AtomicU64::new(DELAI_SQL_DEFAUT.as_millis() as u64) };
        if !lecture_seule {
            meta::installer(&base.conn)?;
            crate::relations::adopter_cles_etrangeres(&base)?;
        }
        Ok(base)
    }

    /// Ferme la base proprement (optimisation, point de controle WAL).
    /// Une transaction explicite non validee est annulee.
    pub fn fermer(self) -> Resultat<()> {
        if !self.conn.is_autocommit() {
            self.conn.execute_batch("ROLLBACK")?;
        }
        if !self.lecture_seule {
            self.conn.execute_batch("PRAGMA optimize;")?;
            if self.chemin.is_some() {
                self.conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
            }
        }
        self.conn.close().map_err(|(_, e)| ErreurBase::from(e))
    }

    /// Connexion SQLite (usage interne au moteur).
    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Chemin du fichier.
    pub fn chemin(&self) -> Option<&Path> {
        self.chemin.as_deref()
    }

    /// Ouverte en lecture seule.
    pub fn est_lecture_seule(&self) -> bool {
        self.lecture_seule
    }

    pub(crate) fn exiger_ecriture(&self) -> Resultat<()> {
        if self.lecture_seule {
            return Err(ErreurBase::Interdit("la base est ouverte en lecture seule.".into()));
        }
        Ok(())
    }

    fn garde(&self, mode: u8) -> GardeMode<'_> {
        let ancien = self.mode.swap(mode, Ordering::SeqCst);
        GardeMode { mode: &self.mode, ancien }
    }

    /// Passe en mode « SQL utilisateur » (ATTACH, PRAGMA d'ecriture et tables internes refuses).
    pub(crate) fn mode_utilisateur(&self) -> GardeMode<'_> {
        self.garde(MODE_UTILISATEUR)
    }

    /// Delai par defaut des requetes SQL interactives (`None` = sans delai).
    pub fn delai_sql(&self) -> Option<Duration> {
        match self.delai_defaut_ms.load(Ordering::SeqCst) {
            SANS_DELAI => None,
            ms => Some(Duration::from_millis(ms)),
        }
    }

    /// Regle le delai par defaut des requetes SQL interactives (`None` = sans delai).
    /// Une requete qui le depasse est interrompue et renvoie `ErreurBase::Delai`.
    pub fn definir_delai_sql(&self, delai: Option<Duration>) {
        let ms = delai.map_or(SANS_DELAI, |d| u64::try_from(d.as_millis()).unwrap_or(SANS_DELAI - 1));
        self.delai_defaut_ms.store(ms, Ordering::SeqCst);
    }

    /// Execute `f` avec une echeance (`None` = sans limite). Une interruption causee par
    /// l'echeance devient `ErreurBase::Delai` ; SQLite a deja annule l'instruction
    /// (et la transaction explicite si elle ecrivait), la connexion reste utilisable.
    pub(crate) fn avec_delai<T>(&self, delai: Option<Duration>, f: impl FnOnce() -> Resultat<T>) -> Resultat<T> {
        let fin = delai.and_then(|d| Instant::now().checked_add(d));
        let ancienne = match self.echeance.lock() {
            Ok(mut e) => std::mem::replace(&mut *e, fin),
            Err(_) => return f(),
        };
        let _garde = GardeDelai { echeance: &self.echeance, ancienne };
        match f() {
            Err(ErreurBase::Interrompu) if fin.is_some_and(|t| Instant::now() >= t) => {
                Err(ErreurBase::Delai(delai.map_or(0, |d| d.as_secs().max(1))))
            }
            autre => autre,
        }
    }

    /// Execute `f` dans un point de sauvegarde : tout ou rien, meme dans une transaction utilisateur.
    pub(crate) fn atomique<T>(&self, f: impl FnOnce() -> Resultat<T>) -> Resultat<T> {
        self.conn.execute_batch("SAVEPOINT fo_operation")?;
        match f() {
            Ok(v) => {
                self.conn.execute_batch("RELEASE fo_operation")?;
                Ok(v)
            }
            Err(e) => {
                self.conn.execute_batch("ROLLBACK TO fo_operation; RELEASE fo_operation")?;
                Err(e)
            }
        }
    }

    // ---------- transactions explicites ----------

    /// Commence une transaction explicite (les modifications attendent `valider_transaction`).
    pub fn commencer_transaction(&self) -> Resultat<()> {
        if self.en_transaction() {
            return Err(ErreurBase::msg("Une transaction est déjà en cours."));
        }
        self.conn.execute_batch("BEGIN IMMEDIATE")?;
        Ok(())
    }

    /// Valide la transaction en cours.
    pub fn valider_transaction(&self) -> Resultat<()> {
        if !self.en_transaction() {
            return Err(ErreurBase::msg("Aucune transaction en cours."));
        }
        self.conn.execute_batch("COMMIT")?;
        Ok(())
    }

    /// Annule la transaction en cours.
    pub fn annuler_transaction(&self) -> Resultat<()> {
        if !self.en_transaction() {
            return Err(ErreurBase::msg("Aucune transaction en cours."));
        }
        self.conn.execute_batch("ROLLBACK")?;
        Ok(())
    }

    /// Vrai si une transaction explicite est ouverte.
    pub fn en_transaction(&self) -> bool {
        !self.conn.is_autocommit()
    }

    // ---------- maintenance ----------

    fn taille(&self) -> Resultat<i64> {
        Ok(self.conn.query_row(
            "SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()",
            [],
            |r| r.get(0),
        )?)
    }

    /// Sauvegarde complete et coherente vers `destination` (`VACUUM INTO`).
    pub fn sauvegarder(&self, destination: impl AsRef<Path>, remplacer: bool) -> Resultat<()> {
        let dest = destination.as_ref();
        if let Some(source) = &self.chemin {
            let meme = fs::canonicalize(source).ok().zip(dest.parent().and_then(|p| fs::canonicalize(p).ok()))
                .is_some_and(|(s, p)| dest.file_name().is_some_and(|n| p.join(n) == s));
            if meme {
                return Err(ErreurBase::msg("La sauvegarde ne peut pas remplacer la base ouverte."));
            }
        }
        if dest.exists() {
            if !remplacer {
                return Err(ErreurBase::ExisteDeja(dest.display().to_string()));
            }
            fs::remove_file(dest)?;
        }
        let texte = dest
            .to_str()
            .ok_or_else(|| ErreurBase::msg("Chemin de sauvegarde non pris en charge."))?;
        let _g = self.garde(MODE_SAUVEGARDE);
        self.conn.execute("VACUUM INTO ?1", [texte])?;
        Ok(())
    }

    /// « Compacter et réparer » : reconstruit le fichier et met a jour les statistiques.
    pub fn compacter(&self) -> Resultat<RapportCompactage> {
        self.exiger_ecriture()?;
        if self.en_transaction() {
            return Err(ErreurBase::msg("Terminez d'abord la transaction en cours."));
        }
        let taille_avant = self.taille()?;
        {
            // VACUUM attache une base temporaire interne : autorise le temps de l'operation.
            let _g = self.garde(MODE_SAUVEGARDE);
            self.conn.execute_batch("VACUUM")?;
        }
        self.conn.execute_batch("PRAGMA optimize;")?;
        Ok(RapportCompactage { taille_avant, taille_apres: self.taille()? })
    }

    /// Verifie la structure du fichier et l'integrite referentielle.
    pub fn verifier_integrite(&self) -> Resultat<RapportIntegrite> {
        let mut stmt = self.conn.prepare("PRAGMA integrity_check")?;
        let problemes: Vec<String> = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .filter(|l| l != "ok")
            .collect();
        let mut stmt = self.conn.prepare("PRAGMA foreign_key_check")?;
        let orphelins = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<i64>>(1)?.unwrap_or(0), r.get::<_, String>(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(RapportIntegrite { ok: problemes.is_empty() && orphelins.is_empty(), problemes, orphelins })
    }

    /// Informations generales sur la base.
    pub fn infos(&self) -> Resultat<InfosBase> {
        let journal: String = self.conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
        let nb_tables: i64 = self.conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_\\_fo\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'",
            [],
            |r| r.get(0),
        )?;
        Ok(InfosBase {
            chemin: self.chemin.as_ref().map(|c| c.display().to_string()),
            lecture_seule: self.lecture_seule,
            taille_octets: self.taille()?,
            version_sqlite: rusqlite::version().to_string(),
            version_schema: meta::valeur_meta(&self.conn, "version_schema")?,
            cree_le: meta::valeur_meta(&self.conn, "cree_le")?,
            journal,
            nb_tables,
            transaction_en_cours: self.en_transaction(),
        })
    }
}
