import ExpoModulesCore
import Foundation

public final class LiveToEatShareInboxModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveToEatShareInbox")

    Function("getPendingPayloads") {
      guard let appGroupId = Self.appGroupId else {
        return [[String: Any]]()
      }

      return LiveToEatShareInboxStore.read(appGroupId: appGroupId).map(\.record)
    }

    Function("removePayloads") { (payloadIds: [String]) in
      guard let appGroupId = Self.appGroupId else {
        return
      }

      LiveToEatShareInboxStore.remove(payloadIds: Set(payloadIds), appGroupId: appGroupId)
    }
  }

  private static var appGroupId: String? {
    Bundle.main.object(forInfoDictionaryKey: "LiveToEatShareInboxAppGroupId") as? String
  }
}

private struct LiveToEatShareInboxPayload: Codable {
  let id: String
  let mimeType: String
  let receivedAt: Int64
  let type: String
  let value: String

  var record: [String: Any] {
    [
      "id": id,
      "mimeType": mimeType,
      "receivedAt": receivedAt,
      "type": type,
      "value": value,
    ]
  }
}

private enum LiveToEatShareInboxStore {
  private static let maximumPayloadCount = 20
  private static let maximumValueLength = 10_000
  private static let retentionMilliseconds: Int64 = 7 * 24 * 60 * 60 * 1_000
  private static let storageKey = "live_to_eat_share_inbox_v1"

  static func read(appGroupId: String) -> [LiveToEatShareInboxPayload] {
    guard
      let defaults = UserDefaults(suiteName: appGroupId),
      let data = defaults.data(forKey: storageKey),
      let payloads = try? JSONDecoder().decode([LiveToEatShareInboxPayload].self, from: data)
    else {
      return []
    }

    let cutoff = currentMilliseconds() - retentionMilliseconds
    let retained = payloads.filter {
      !$0.id.isEmpty &&
        !$0.mimeType.isEmpty &&
        ($0.type == "text" || $0.type == "url") &&
        !$0.value.isEmpty &&
        $0.value.count <= maximumValueLength &&
        $0.receivedAt >= cutoff
    }
    if retained.count != payloads.count {
      write(retained, appGroupId: appGroupId)
    }
    return retained
  }

  static func remove(payloadIds: Set<String>, appGroupId: String) {
    guard !payloadIds.isEmpty else {
      return
    }

    write(read(appGroupId: appGroupId).filter { !payloadIds.contains($0.id) }, appGroupId: appGroupId)
  }

  private static func write(_ payloads: [LiveToEatShareInboxPayload], appGroupId: String) {
    guard
      let defaults = UserDefaults(suiteName: appGroupId),
      let encoded = try? JSONEncoder().encode(Array(payloads.suffix(maximumPayloadCount)))
    else {
      return
    }

    defaults.set(encoded, forKey: storageKey)
    defaults.synchronize()
  }

  private static func currentMilliseconds() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1_000)
  }
}
