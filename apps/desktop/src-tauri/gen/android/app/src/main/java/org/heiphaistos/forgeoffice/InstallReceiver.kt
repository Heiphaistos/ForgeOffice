package org.heiphaistos.forgeoffice

import android.app.NotificationChannel
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.widget.Toast

/** Resultat d'une session d'installation de mise a jour (Updater) : confirmation du systeme si Android la demande, notification « a jour » apres. */
class InstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        @Suppress("DEPRECATION")
        val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
        if (confirm != null) {
          confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(confirm)
        }
      }
      // L'installation a remplace (et ferme) l'appli et Android interdit de la rouvrir en arriere-plan : un appui la rouvre.
      PackageInstaller.STATUS_SUCCESS -> notifyUpdated(context)
      PackageInstaller.STATUS_FAILURE_ABORTED ->
        Toast.makeText(context, "Mise à jour annulée : Accueil > Options > Rechercher une mise à jour pour réessayer", Toast.LENGTH_LONG).show()
      else -> Toast.makeText(context, "Mise à jour impossible", Toast.LENGTH_LONG).show()
    }
  }

  private fun notifyUpdated(c: Context) {
    val nm = c.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "Mises à jour", NotificationManager.IMPORTANCE_DEFAULT))
    val open = c.packageManager.getLaunchIntentForPackage(c.packageName) ?: return
    val tap = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(c)
    nm.notify(
      42,
      builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setContentTitle("Forge Office est à jour (${Updater.installedVersion(c) ?: ""})")
        .setContentText("Touchez pour rouvrir l'application.")
        .setContentIntent(tap)
        .setAutoCancel(true)
        .build(),
    )
  }

  private companion object {
    const val CHANNEL = "updates"
  }
}
