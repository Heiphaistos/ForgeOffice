package org.heiphaistos.forgeoffice

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import org.bouncycastle.crypto.digests.Blake2bDigest
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Une version plus recente que celle installee, annoncee par le flux signe. */
class UpdateOffer(val version: String, val notes: String, val name: String, val size: Long, val sha256: String)

/**
 * Mise a jour integree de l'APK (hors magasin) : le flux `ForgeOffice-android.json` est verifie (signature
 * minisign, la meme cle que la mise a jour du bureau), l'APK de la bonne architecture est telecharge puis controle
 * (taille, SHA-256, paquet, version, cle de signature identique a l'appli installee) et installe par
 * l'installeur du systeme. Personne n'a besoin d'aller sur GitHub : l'adresse du flux est celle du relais,
 * fournie a la construction (`FO_UPDATE_BASE`), jamais ecrite dans le depot public.
 */
object Updater {
  /** Cle publique minisign (base64 du fichier .pub) : celle de `plugins.updater.pubkey` dans tauri.conf.json. */
  private const val PUBLIC_KEY =
    "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEQyOEVCREIyQTREQzY3ODQKUldTRVo5eWtzcjJPMGorQTRoODM3SjVqUmpNMFB6ZmNYK1BqSVh0bjdGNDRwbTNCUU9LQWJ4dW8K"
  private const val FALLBACK_BASE = "https://github.com/Heiphaistos/ForgeOffice/releases/"
  private const val FEED = "ForgeOffice-android.json"

  private val base: String
    get() = BuildConfig.UPDATE_BASE.ifBlank { FALLBACK_BASE }.let { if (it.endsWith("/")) it else "$it/" }

  /** Flux signe -> offre, ou null si l'appli est a jour. Bloquant : a appeler hors du fil principal. */
  fun check(c: Context): UpdateOffer? {
    val installed = installedVersion(c) ?: return null
    val raw = readBytes("${base}latest/download/$FEED")
    val sig = String(readBytes("${base}latest/download/$FEED.sig"), Charsets.UTF_8).trim()
    if (!verifyMinisign(PUBLIC_KEY, raw, sig)) throw SecurityException("flux non verifie")
    val info = JSONObject(String(raw, Charsets.UTF_8))
    val latest = info.optString("version", "")
    if (!isNewer(latest, installed)) return null
    val apks = info.optJSONObject("apks") ?: return null
    val entry = Build.SUPPORTED_ABIS.firstNotNullOfOrNull { apks.optJSONObject(it) } ?: return null
    if (!PathGuard.isSafeFileName(entry.getString("name"))) throw SecurityException("nom d'APK invalide")
    return UpdateOffer(latest, info.optString("notes", ""), entry.getString("name"), entry.getLong("size"), entry.getString("sha256"))
  }

  /** Telecharge l'APK (reprend le fichier deja verifie), controle tout, rend le fichier pret a installer. */
  fun download(c: Context, offer: UpdateOffer, onProgress: (Double) -> Unit): File {
    if (!PathGuard.isSafeFileName(offer.name)) throw SecurityException("nom d'APK invalide")
    val installed = installedVersion(c)
    val dir = File(c.cacheDir, "updates")
    if (!dir.isDirectory && !dir.mkdirs()) throw IllegalStateException("cache")
    dir.listFiles()?.forEach { if (it.name.endsWith(".part") || (installed != null && !isNewer(versionOf(it.name), installed))) it.delete() }
    val apk = File(dir, offer.name)
    if (apk.isFile && apk.length() == offer.size && offer.sha256.equals(sha256Of(apk), true) && verified(c, apk, offer.version)) {
      onProgress(1.0)
      return apk
    }
    val part = File(dir, offer.name + ".part")
    val conn = URL("${base}download/v${offer.version}/${offer.name}").openConnection() as HttpURLConnection
    conn.connectTimeout = 15000
    conn.readTimeout = 30000
    try {
      conn.inputStream.use { input ->
        FileOutputStream(part).use { out ->
          val buf = ByteArray(65536)
          var done = 0L
          while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            out.write(buf, 0, n)
            done += n
            if (offer.size > 0) onProgress((done.toDouble() / offer.size).coerceAtMost(0.99))
          }
        }
      }
    } finally {
      conn.disconnect()
    }
    if (part.length() != offer.size || !offer.sha256.equals(sha256Of(part), true)) {
      part.delete()
      throw SecurityException("APK corrompu ou remplace entre-temps")
    }
    if (!part.renameTo(apk)) throw IllegalStateException("rename")
    if (!verified(c, apk, offer.version)) {
      apk.delete()
      throw SecurityException("APK d'une autre origine")
    }
    onProgress(1.0)
    return apk
  }

  /** Vrai si l'installation est lancee ; faux si l'autorisation « applications inconnues » manque (ecran des reglages ouvert). */
  fun install(c: Context, apk: File): Boolean {
    if (Build.VERSION.SDK_INT >= 26 && !c.packageManager.canRequestPackageInstalls()) {
      val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${c.packageName}"))
      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      c.startActivity(settings)
      return false
    }
    val installer = c.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    params.setAppPackageName(c.packageName)
    if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    val id = installer.createSession(params)
    installer.openSession(id).use { session ->
      FileInputStream(apk).use { input ->
        session.openWrite("base.apk", 0, apk.length()).use { out ->
          input.copyTo(out)
          session.fsync(out)
        }
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
      session.commit(PendingIntent.getBroadcast(c, id, Intent(c, InstallReceiver::class.java), flags).intentSender)
    }
    return true
  }

  fun installedVersion(c: Context): String? =
    try { c.packageManager.getPackageInfo(c.packageName, 0).versionName } catch (e: Exception) { null }

  /** Meme paquet, version annoncee et meme cle de signature que l'appli installee. */
  private fun verified(c: Context, apk: File, version: String): Boolean {
    val pm = c.packageManager
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
    val archive = pm.getPackageArchiveInfo(apk.path, flags) ?: return false
    if (archive.packageName != c.packageName || archive.versionName != version) return false
    return try {
      signers(pm.getPackageInfo(c.packageName, flags)).toList() == signers(archive).toList()
    } catch (e: Exception) {
      false
    }
  }

  @Suppress("DEPRECATION")
  private fun signers(p: android.content.pm.PackageInfo): Array<Signature> =
    (if (Build.VERSION.SDK_INT >= 28) p.signingInfo?.apkContentsSigners else p.signatures) ?: emptyArray()

  /** « 0.10.1 » > « 0.9.3 » : comparaison numerique composante par composante. */
  fun isNewer(candidate: String, installed: String): Boolean {
    val a = candidate.split('.', '-').map { it.toIntOrNull() ?: 0 }
    val b = installed.split('.', '-').map { it.toIntOrNull() ?: 0 }
    for (i in 0 until maxOf(a.size, b.size)) {
      val x = a.getOrElse(i) { 0 }
      val y = b.getOrElse(i) { 0 }
      if (x != y) return x > y
    }
    return false
  }

  private fun versionOf(fileName: String): String =
    Regex("""_(\d+(?:\.\d+)*)_""").find(fileName)?.groupValues?.get(1) ?: "0"

  /**
   * Signature minisign (fichier .sig de `tauri signer sign` : base64 du fichier minisign) de `message`.
   * BouncyCastle plutot que le fournisseur de la plateforme : Ed25519 n'existe qu'a partir d'Android 13 et l'appli tourne des Android 7.
   * Algorithme « ED » = Ed25519 sur le BLAKE2b-512 du message.
   */
  fun verifyMinisign(publicKeyB64: String, message: ByteArray, sigFileB64: String): Boolean {
    return try {
      val pub = Base64.decode(secondLine(publicKeyB64), Base64.DEFAULT)
      val sig = Base64.decode(secondLine(sigFileB64), Base64.DEFAULT)
      if (pub.size != 42 || sig.size != 74 || pub[0] != 'E'.code.toByte() || pub[1] != 'd'.code.toByte()) return false
      if (sig[0] != 'E'.code.toByte() || (sig[1] != 'D'.code.toByte() && sig[1] != 'd'.code.toByte())) return false
      if (!pub.copyOfRange(2, 10).contentEquals(sig.copyOfRange(2, 10))) return false
      val data = if (sig[1] == 'D'.code.toByte()) blake2b512(message) else message
      val verifier = Ed25519Signer()
      verifier.init(false, Ed25519PublicKeyParameters(pub, 10))
      verifier.update(data, 0, data.size)
      verifier.verifySignature(sig.copyOfRange(10, 74))
    } catch (e: RuntimeException) {
      false // cle ou signature mal formee
    }
  }

  /** Les fichiers minisign sont stockes en base64 (comme dans tauri.conf.json) : 2e ligne = la cle ou la signature. */
  private fun secondLine(b64: String): String =
    String(Base64.decode(b64.trim(), Base64.DEFAULT), Charsets.UTF_8).lines()[1].trim()

  private fun blake2b512(data: ByteArray): ByteArray {
    val d = Blake2bDigest(512)
    d.update(data, 0, data.size)
    return ByteArray(64).also { d.doFinal(it, 0) }
  }

  private fun readBytes(url: String): ByteArray {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 8000
    conn.readTimeout = 8000
    conn.setRequestProperty("Cache-Control", "no-cache")
    try {
      val out = ByteArrayOutputStream()
      conn.inputStream.use { it.copyBounded(out, 65536) }
      return out.toByteArray()
    } finally {
      conn.disconnect()
    }
  }

  /** Copie bornee : un flux plus gros que `limit` est refuse. */
  private fun InputStream.copyBounded(out: ByteArrayOutputStream, limit: Int) {
    val buf = ByteArray(4096)
    while (true) {
      val n = read(buf)
      if (n <= 0) break
      out.write(buf, 0, n)
      if (out.size() > limit) throw SecurityException("flux trop gros")
    }
  }

  private fun sha256Of(f: File): String {
    val md = MessageDigest.getInstance("SHA-256")
    FileInputStream(f).use { input ->
      val buf = ByteArray(65536)
      while (true) {
        val n = input.read(buf)
        if (n <= 0) break
        md.update(buf, 0, n)
      }
    }
    return md.digest().joinToString("") { ((it.toInt() and 0xff) + 0x100).toString(16).substring(1) }
  }
}
