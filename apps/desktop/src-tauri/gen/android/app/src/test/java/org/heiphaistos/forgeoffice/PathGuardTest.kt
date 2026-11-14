package org.heiphaistos.forgeoffice

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PathGuardTest {
  private val root = File(System.getProperty("java.io.tmpdir"), "pg-" + System.nanoTime()).apply { mkdirs() }

  @Test fun privatePathsRefused() {
    val data = File(root, "data").apply { mkdirs() }
    assertTrue(PathGuard.isUnderPrivateDir(File(data, "files/x.db").path, listOf(data)))
    assertTrue(PathGuard.isUnderPrivateDir(File(data, "files/../files/x").path, listOf(data)))
    assertTrue(PathGuard.isUnderPrivateDir(data.path, listOf(data, null)))
    assertFalse(PathGuard.isUnderPrivateDir(File(root, "data2/x").path, listOf(data)))
    assertFalse(PathGuard.isUnderPrivateDir(File(data, "../other/x").path, listOf(data)))
  }

  @Test fun apkNames() {
    assertTrue(PathGuard.isSafeFileName("forgeoffice-0.5.6-arm64.apk"))
    for (bad in listOf("", "../a.apk", "a/b.apk", "a\b.apk", "a..b.apk", "..", "a b.apk", "a\u0000.apk"))
      assertFalse(bad, PathGuard.isSafeFileName(bad))
  }
}
