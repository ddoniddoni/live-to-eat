package com.livetoeat.shareinbox

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiveToEatShareInboxModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LiveToEatShareInbox")

    Function("getPendingPayloads") {
      return@Function ShareInboxStore.getPendingPayloads(context)
    }

    Function("removePayloads") { payloadIds: List<String> ->
      ShareInboxStore.remove(payloadIds, context)
    }
  }
}
