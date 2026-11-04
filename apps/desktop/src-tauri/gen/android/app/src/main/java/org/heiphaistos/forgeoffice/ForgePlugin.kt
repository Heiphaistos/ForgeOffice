package org.heiphaistos.forgeoffice

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors

@InvokeArg
class DirArgs {
  lateinit var dir: String
}

@InvokeArg
class ExportArgs {
  lateinit var src: String
  lateinit var name: String
}

@InvokeArg
class ShareArgs {
  lateinit var path: String
  lateinit var name: String
}

@InvokeArg
class ImmersiveArgs {
  var on: Boolean = false
}

@InvokeArg
class BarsArgs {
  var dark: Boolean = false
  var color: Int = 0
}

@InvokeArg
class PrintArgs {
  lateinit var title: String
}

/**
 * Pont Android de ForgeOffice : selecteur de documents (SAF), export, partage, « Ouvrir avec »,
 * impression, plein ecran et barres systeme. Les documents ne sortent jamais du telephone : tout
 * fichier choisi ou recu est copie dans la bibliotheque privee de l'appli (dossier fourni par Rust).
 */
@TauriPlugin
class ForgePlugin(private val activity: Activity) : Plugin(activity) {
  private var webView: WebView? = null
  private val pending = ArrayList<Uri>()
  private val io = Executors.newSingleThreadExecutor()

  override fun load(webView: WebView) {
    this.webView = webView
    queue(activity.intent)
  }

  override fun onNewIntent(intent: Intent) {
    if (queue(intent)) {
      activity.runOnUiThread { webView?.evaluateJavascript("window.dispatchEvent(new Event('fo-inbox'))", null) }
    }
  }

  /** Documents recus par « Ouvrir avec » ou « Partager vers » (ACTION_VIEW, ACTION_SEND). */
  @Suppress("DEPRECATION")
  private fun queue(intent: Intent?): Boolean {
    if (intent == null) return false
    val uris = ArrayList<Uri>()
    when (intent.action) {
      Intent.ACTION_VIEW -> intent.data?.let { uris.add(it) }
      Intent.ACTION_SEND -> intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.add(it) }
      Intent.ACTION_SEND_MULTIPLE -> intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
      else -> return false
    }
    // Un meme intent n'est pris qu'une fois (retour sur l'appli, nouveau onResume).
    intent.action = Intent.ACTION_MAIN
    synchronized(pending) { pending.addAll(uris) }
    return uris.isNotEmpty()
  }

  private fun displayName(uri: Uri): String {
    var name: String? = null
    if (uri.scheme == "content") {
      activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst()) name = it.getString(0)
      }
    }
    var clean = (name ?: uri.lastPathSegment ?: "document").substringAfterLast('/')
    clean = clean.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim().take(150).ifEmpty { "document" }
    if (!clean.contains('.')) {
      val ext = activity.contentResolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
      if (ext != null) clean = "$clean.$ext"
    }
    return clean
  }

  /** Copie le flux dans `dir` sous un nom temporaire ; renvoie {path, name}. */
  private fun importUri(uri: Uri, dir: String): JSObject {
    val folder = File(dir).apply { mkdirs() }
    val out = File(folder, UUID.randomUUID().toString() + ".part")
    try {
      val input = activity.contentResolver.openInputStream(uri) ?: throw IOException("flux introuvable")
      input.use { src ->
        out.outputStream().use { dst ->
          val buffer = ByteArray(64 * 1024)
          var total = 0L
          while (true) {
            val n = src.read(buffer)
            if (n < 0) break
            total += n
            if (total > MAX_BYTES) throw IOException("fichier trop volumineux")
            dst.write(buffer, 0, n)
          }
        }
      }
    } catch (e: Exception) {
      out.delete()
      throw e
    }
    return JSObject().put("path", out.absolutePath).put("name", displayName(uri))
  }

  @Command
  fun takeInbox(invoke: Invoke) {
    val args = invoke.parseArgs(DirArgs::class.java)
    val uris = synchronized(pending) { ArrayList(pending).also { pending.clear() } }
    io.execute {
      val files = JSArray()
      for (uri in uris) {
        try {
          files.put(importUri(uri, args.dir))
        } catch (e: Exception) {
          invoke.reject("Impossible de lire le document reçu : ${e.message}")
          return@execute
        }
      }
      invoke.resolve(JSObject().put("files", files))
    }
  }

  @Command
  fun pickDocument(invoke: Invoke) {
    invoke.parseArgs(DirArgs::class.java)
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
    }
    startActivityForResult(invoke, intent, "onPicked")
  }

  @ActivityCallback
  fun onPicked(invoke: Invoke, result: ActivityResult) {
    val uri = result.data?.data
    if (result.resultCode != Activity.RESULT_OK || uri == null) {
      invoke.resolve(JSObject())
      return
    }
    val args = invoke.parseArgs(DirArgs::class.java)
    io.execute {
      try {
        invoke.resolve(importUri(uri, args.dir))
      } catch (e: Exception) {
        invoke.reject("Impossible de lire le document : ${e.message}")
      }
    }
  }

  private fun mimeOf(name: String): String =
    MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase()) ?: "application/octet-stream"

  @Command
  fun exportDocument(invoke: Invoke) {
    val args = invoke.parseArgs(ExportArgs::class.java)
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = mimeOf(args.name)
      putExtra(Intent.EXTRA_TITLE, args.name)
    }
    startActivityForResult(invoke, intent, "onExported")
  }

  @ActivityCallback
  fun onExported(invoke: Invoke, result: ActivityResult) {
    val uri = result.data?.data
    if (result.resultCode != Activity.RESULT_OK || uri == null) {
      invoke.resolve(JSObject())
      return
    }
    val args = invoke.parseArgs(ExportArgs::class.java)
    io.execute {
      try {
        val output = activity.contentResolver.openOutputStream(uri, "wt") ?: throw IOException("destination introuvable")
        output.use { dst -> File(args.src).inputStream().use { it.copyTo(dst) } }
        invoke.resolve(JSObject().put("name", displayName(uri)))
      } catch (e: Exception) {
        invoke.reject("Impossible d'enregistrer le document : ${e.message}")
      }
    }
  }

  @Command
  fun shareDocument(invoke: Invoke) {
    val args = invoke.parseArgs(ShareArgs::class.java)
    try {
      val folder = File(activity.cacheDir, "share").apply { deleteRecursively(); mkdirs() }
      val copy = File(folder, args.name.replace('/', '_'))
      File(args.path).copyTo(copy, true)
      val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", copy)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeOf(args.name)
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TITLE, args.name)
        clipData = ClipData.newRawUri(args.name, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, null))
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Partage impossible : ${e.message}")
    }
  }

  @Command
  fun printPage(invoke: Invoke) {
    val args = invoke.parseArgs(PrintArgs::class.java)
    val view = webView
    if (view == null) {
      invoke.reject("Impression impossible : page indisponible")
      return
    }
    activity.runOnUiThread {
      try {
        val manager = activity.getSystemService(Activity.PRINT_SERVICE) as PrintManager
        val title = args.title.ifBlank { "ForgeOffice" }
        manager.print(title, view.createPrintDocumentAdapter(title), PrintAttributes.Builder().build())
        invoke.resolve()
      } catch (e: Exception) {
        invoke.reject("Impression impossible : ${e.message}")
      }
    }
  }

  @Command
  fun setImmersive(invoke: Invoke) {
    val args = invoke.parseArgs(ImmersiveArgs::class.java)
    activity.runOnUiThread {
      val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
      controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      if (args.on) controller.hide(WindowInsetsCompat.Type.systemBars()) else controller.show(WindowInsetsCompat.Type.systemBars())
      invoke.resolve()
    }
  }

  /** Icones des barres systeme claires ou sombres et couleur de fond derriere elles (suit le theme de la page). */
  @Command
  fun setBars(invoke: Invoke) {
    val args = invoke.parseArgs(BarsArgs::class.java)
    activity.runOnUiThread {
      val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
      controller.isAppearanceLightStatusBars = !args.dark
      controller.isAppearanceLightNavigationBars = !args.dark
      activity.window.decorView.setBackgroundColor(args.color)
      invoke.resolve()
    }
  }

  @Command
  fun exitApp(invoke: Invoke) {
    activity.runOnUiThread {
      activity.finish()
      invoke.resolve()
    }
  }

  companion object {
    /** Garde-fou memoire : meme limite que cote Rust (256 Mio sur mobile). */
    const val MAX_BYTES = 256L * 1024 * 1024
  }
}
