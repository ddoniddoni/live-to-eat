package com.livetoeat.shareinbox

import android.content.Context
import android.content.Intent
import android.util.Patterns
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal object ShareInboxStore {
  private const val maxPendingPayloads = 20
  private const val maxTextLength = 10_000
  private const val preferencesName = "live_to_eat_share_inbox"
  private const val storageKey = "pending_payloads_v1"
  private const val retentionMilliseconds = 7L * 24L * 60L * 60L * 1_000L

  fun append(intent: Intent?, context: Context) {
    if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") {
      return
    }

    val value = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
    if (value.isBlank() || value.length > maxTextLength) {
      return
    }

    val payload = JSONObject().apply {
      put("id", UUID.randomUUID().toString())
      put("mimeType", "text/plain")
      put("receivedAt", System.currentTimeMillis())
      put("type", if (Patterns.WEB_URL.matcher(value).matches()) "url" else "text")
      put("value", value)
    }

    mutate(context) { payloads ->
      payloads.put(payload)
      trimToMaximum(payloads)
    }
  }

  fun getPendingPayloads(context: Context): List<Map<String, Any>> {
    val payloads = read(context)
    val retained = JSONArray()
    val records = mutableListOf<Map<String, Any>>()
    val cutoff = System.currentTimeMillis() - retentionMilliseconds

    for (index in 0 until payloads.length()) {
      val payload = payloads.optJSONObject(index) ?: continue
      val receivedAt = payload.optLong("receivedAt", 0L)
      val id = payload.optString("id")
      val mimeType = payload.optString("mimeType")
      val type = payload.optString("type")
      val value = payload.optString("value")

      if (
        id.isBlank() ||
        mimeType.isBlank() ||
        (type != "text" && type != "url") ||
        value.isBlank() ||
        value.length > maxTextLength ||
        receivedAt < cutoff
      ) {
        continue
      }

      retained.put(payload)
      records.add(
        mapOf(
          "id" to id,
          "mimeType" to mimeType,
          "receivedAt" to receivedAt,
          "type" to type,
          "value" to value,
        ),
      )
    }

    write(context, retained)
    return records
  }

  fun remove(payloadIds: List<String>, context: Context) {
    if (payloadIds.isEmpty()) {
      return
    }

    val ids = payloadIds.toSet()
    mutate(context) { payloads ->
      val retained = JSONArray()
      for (index in 0 until payloads.length()) {
        val payload = payloads.optJSONObject(index) ?: continue
        if (payload.optString("id") !in ids) {
          retained.put(payload)
        }
      }
      retained
    }
  }

  private fun mutate(context: Context, update: (JSONArray) -> Any) {
    synchronized(this) {
      val result = update(read(context))
      when (result) {
        is JSONArray -> write(context, result)
        else -> write(context, read(context))
      }
    }
  }

  private fun read(context: Context): JSONArray {
    val raw = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE).getString(storageKey, null)
      ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private fun write(context: Context, payloads: JSONArray) {
    context
      .getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      .edit()
      .putString(storageKey, payloads.toString())
      .apply()
  }

  private fun trimToMaximum(payloads: JSONArray): JSONArray {
    while (payloads.length() > maxPendingPayloads) {
      payloads.remove(0)
    }
    return payloads
  }
}
