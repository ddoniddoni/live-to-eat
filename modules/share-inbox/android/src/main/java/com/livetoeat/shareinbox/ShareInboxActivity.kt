package com.livetoeat.shareinbox

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class ShareInboxActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ShareInboxStore.append(intent, applicationContext)
    openMainApplication()
    finish()
  }

  private fun openMainApplication() {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    startActivity(launchIntent)
  }
}
