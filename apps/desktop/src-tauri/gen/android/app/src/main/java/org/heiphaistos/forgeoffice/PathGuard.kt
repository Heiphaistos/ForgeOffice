package org.heiphaistos.forgeoffice

import java.io.File

/** Controles purs (testables en JVM) des entrees non fiables : chemins `file:` et noms d'APK. */
object PathGuard {
  private val SAFE_NAME = Regex("[A-Za-z0-9._-]{1,128}")

  /** Vrai si [path] (canonique, liens resolus) est sous l'un des dossiers prives [roots]. */
  fun isUnderPrivateDir(path: String, roots: List<File?>): Boolean {
    val target = try { File(path).canonicalFile } catch (e: java.io.IOException) { return true }
    return roots.filterNotNull().any { root ->
      val r = try { root.canonicalFile } catch (e: java.io.IOException) { return@any true }
      target == r || target.path.startsWith(r.path + File.separator)
    }
  }

  /** Nom de fichier sur : pas de separateur, pas de `..`, pas de nom cache vide. */
  fun isSafeFileName(name: String): Boolean = SAFE_NAME.matches(name) && !name.contains("..")
}
