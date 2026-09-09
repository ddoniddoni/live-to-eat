const fs = require('node:fs');
const path = require('node:path');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const extensionTargetName = 'LiveToEatShareInbox';
const extensionGroupName = 'Embed Foundation Extensions';

const xmlEscape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const mergeAppGroup = (entitlements, appGroupId) => {
  const current = entitlements['com.apple.security.application-groups'] ?? [];
  if (!Array.isArray(current)) {
    throw new Error('LiveToEat share inbox requires an array of iOS App Groups.');
  }

  entitlements['com.apple.security.application-groups'] = current.includes(appGroupId)
    ? current
    : [...current, appGroupId];
};

const addEasExtensionConfig = (config, bundleIdentifier, appGroupId) => {
  const existingExtensions = config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? [];
  const extensionIndex = existingExtensions.findIndex((extension) => extension.targetName === extensionTargetName);
  const appExtensions = [...existingExtensions];

  if (extensionIndex < 0) {
    appExtensions.push({
      bundleIdentifier,
      entitlements: {
        'com.apple.security.application-groups': [appGroupId],
      },
      targetName: extensionTargetName,
    });
  } else {
    const extension = { ...appExtensions[extensionIndex] };
    const entitlements = { ...(extension.entitlements ?? {}) };
    mergeAppGroup(entitlements, appGroupId);
    extension.entitlements = entitlements;
    appExtensions[extensionIndex] = extension;
  }

  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions,
          },
        },
      },
    },
  };
};

const extensionInfoPlist = (appGroupId) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>AppGroupId</key>
  <string>${xmlEscape(appGroupId)}</string>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>LiveToEat</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>NSExtensionActivationRule</key>
      <dict>
        <key>NSExtensionActivationSupportsText</key>
        <true/>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
        <integer>1</integer>
      </dict>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).LiveToEatShareInboxViewController</string>
  </dict>
</dict>
</plist>
`;

const extensionEntitlements = (appGroupId) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${xmlEscape(appGroupId)}</string>
  </array>
</dict>
</plist>
`;

const extensionViewControllerSource = `import Foundation
import Social
import UniformTypeIdentifiers

final class LiveToEatShareInboxViewController: SLComposeServiceViewController {
  private let appGroupStorageKey = "live_to_eat_share_inbox_v1"
  private let maximumPayloadCount = 20
  private let maximumValueLength = 10_000
  private let retentionMilliseconds: Int64 = 7 * 24 * 60 * 60 * 1_000

  private var appGroupId: String? {
    Bundle.main.object(forInfoDictionaryKey: "AppGroupId") as? String
  }

  override func isContentValid() -> Bool {
    true
  }

  override func didSelectPost() {
    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      if let payload = await firstPayload() {
        append(payload)
      }

      extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
  }

  override func configurationItems() -> [Any]! {
    []
  }

  private func firstPayload() async -> PendingPayload? {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      return nil
    }

    for item in items {
      for provider in item.attachments ?? [] {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           let value = await loadURL(provider),
           let payload = makePayload(value: value, type: "url") {
          return payload
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier),
           let value = await loadText(provider),
           let payload = makePayload(value: value, type: "text") {
          return payload
        }
      }
    }

    return nil
  }

  private func loadURL(_ provider: NSItemProvider) async -> String? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
        if let url = item as? URL {
          continuation.resume(returning: url.absoluteString)
        } else if let value = item as? String {
          continuation.resume(returning: value)
        } else {
          continuation.resume(returning: nil)
        }
      }
    }
  }

  private func loadText(_ provider: NSItemProvider) async -> String? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { item, _ in
        if let value = item as? String {
          continuation.resume(returning: value)
        } else if let value = item as? NSString {
          continuation.resume(returning: value as String)
        } else {
          continuation.resume(returning: nil)
        }
      }
    }
  }

  private func makePayload(value: String, type: String) -> PendingPayload? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed.count <= maximumValueLength else {
      return nil
    }

    return PendingPayload(
      id: UUID().uuidString,
      mimeType: "text/plain",
      receivedAt: Int64(Date().timeIntervalSince1970 * 1_000),
      type: type,
      value: trimmed
    )
  }

  private func append(_ payload: PendingPayload) {
    guard let appGroupId, let defaults = UserDefaults(suiteName: appGroupId) else {
      return
    }

    let existing = read(defaults)
    let cutoff = Int64(Date().timeIntervalSince1970 * 1_000) - retentionMilliseconds
    let retained = existing.filter { $0.receivedAt >= cutoff }
    let next = Array((retained + [payload]).suffix(maximumPayloadCount))
    guard let encoded = try? JSONEncoder().encode(next) else {
      return
    }

    defaults.set(encoded, forKey: appGroupStorageKey)
    defaults.synchronize()
  }

  private func read(_ defaults: UserDefaults) -> [PendingPayload] {
    guard
      let data = defaults.data(forKey: appGroupStorageKey),
      let payloads = try? JSONDecoder().decode([PendingPayload].self, from: data)
    else {
      return []
    }
    return payloads
  }
}

private struct PendingPayload: Codable {
  let id: String
  let mimeType: String
  let receivedAt: Int64
  let type: String
  let value: String
}
`;

const writeExtensionFiles = (platformProjectRoot, appGroupId) => {
  const extensionRoot = path.join(platformProjectRoot, extensionTargetName);
  fs.mkdirSync(extensionRoot, { recursive: true });
  fs.writeFileSync(path.join(extensionRoot, 'Info.plist'), extensionInfoPlist(appGroupId));
  fs.writeFileSync(path.join(extensionRoot, `${extensionTargetName}.entitlements`), extensionEntitlements(appGroupId));
  fs.writeFileSync(path.join(extensionRoot, 'LiveToEatShareInboxViewController.swift'), extensionViewControllerSource);
};

const extensionTargetExists = (project) =>
  Object.values(project.pbxNativeTargetSection()).some(
    (target) => target?.isa === 'PBXNativeTarget' && target.name === extensionTargetName,
  );

const addExtensionTarget = (project, config, extensionBundleIdentifier) => {
  if (extensionTargetExists(project)) {
    return;
  }

  const targetUuid = project.generateUuid();
  const configurationList = project.addXCConfigurationList(
    [
      {
        buildSettings: {
          CODE_SIGN_ENTITLEMENTS: `"${extensionTargetName}/${extensionTargetName}.entitlements"`,
          CURRENT_PROJECT_VERSION: `"${config.ios?.buildNumber ?? '1'}"`,
          GENERATE_INFOPLIST_FILE: 'NO',
          INFOPLIST_FILE: `"${extensionTargetName}/Info.plist"`,
          IPHONEOS_DEPLOYMENT_TARGET: '"16.4"',
          LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"', '"@executable_path/../../Frameworks"'],
          MARKETING_VERSION: config.version ?? '1.0',
          PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundleIdentifier}"`,
          PRODUCT_NAME: '"$(TARGET_NAME)"',
          SKIP_INSTALL: 'YES',
          SWIFT_VERSION: '5.0',
          TARGETED_DEVICE_FAMILY: '"1,2"',
        },
        name: 'Debug',
      },
      {
        buildSettings: {
          CODE_SIGN_ENTITLEMENTS: `"${extensionTargetName}/${extensionTargetName}.entitlements"`,
          COPY_PHASE_STRIP: 'NO',
          CURRENT_PROJECT_VERSION: `"${config.ios?.buildNumber ?? '1'}"`,
          GENERATE_INFOPLIST_FILE: 'NO',
          INFOPLIST_FILE: `"${extensionTargetName}/Info.plist"`,
          IPHONEOS_DEPLOYMENT_TARGET: '"16.4"',
          LD_RUNPATH_SEARCH_PATHS: ['"$(inherited)"', '"@executable_path/Frameworks"', '"@executable_path/../../Frameworks"'],
          MARKETING_VERSION: config.version ?? '1.0',
          PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundleIdentifier}"`,
          PRODUCT_NAME: '"$(TARGET_NAME)"',
          SKIP_INSTALL: 'YES',
          SWIFT_COMPILATION_MODE: 'wholemodule',
          SWIFT_VERSION: '5.0',
          TARGETED_DEVICE_FAMILY: '"1,2"',
        },
        name: 'Release',
      },
    ],
    'Release',
    `Build configuration list for PBXNativeTarget "${extensionTargetName}"`,
  );
  const productFile = project.addProductFile(extensionTargetName, {
    basename: `${extensionTargetName}.appex`,
    explicitFileType: 'wrapper.app-extension',
    group: extensionGroupName,
    includeInIndex: 0,
    path: `${extensionTargetName}.appex`,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
    sourceTree: 'BUILT_PRODUCTS_DIR',
  });
  const target = {
    pbxNativeTarget: {
      buildConfigurationList: configurationList.uuid,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
      isa: 'PBXNativeTarget',
      name: extensionTargetName,
      productName: extensionTargetName,
      productReference: productFile.fileRef,
      productType: '"com.apple.product-type.app-extension"',
    },
    uuid: targetUuid,
  };

  project.addToPbxNativeTargetSection(target);
  project.addToPbxProjectSection(target);
  const projectSection = project.pbxProjectSection()[project.getFirstProject().uuid];
  projectSection.attributes.TargetAttributes ??= {};
  projectSection.attributes.TargetAttributes[targetUuid] = {
    CreatedOnToolsVersion: '15.1',
    LastSwiftMigration: 1250,
    ProvisioningStyle: 'Automatic',
  };

  project.addBuildPhase(
    ['LiveToEatShareInboxViewController.swift'],
    'PBXSourcesBuildPhase',
    extensionGroupName,
    targetUuid,
    'app_extension',
    '""',
  );
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', extensionGroupName, targetUuid, 'app_extension', '""');
  project.addBuildPhase([], 'PBXResourcesBuildPhase', extensionGroupName, targetUuid, 'app_extension', '""');
  project.addBuildPhase(
    [],
    'PBXCopyFilesBuildPhase',
    extensionGroupName,
    project.getFirstTarget().uuid,
    'app_extension',
    '""',
  );
  project.buildPhaseObject('PBXCopyFilesBuildPhase', extensionGroupName, productFile.target).files.push({
    comment: `${productFile.basename} in ${productFile.group}`,
    value: productFile.uuid,
  });
  project.addToPbxBuildFileSection(productFile);

  const extensionFiles = [
    'LiveToEatShareInboxViewController.swift',
    `${extensionTargetName}.entitlements`,
    'Info.plist',
  ];
  const { uuid: groupUuid } = project.addPbxGroup(extensionFiles, extensionTargetName, extensionTargetName);
  if (groupUuid) {
    Object.keys(project.hash.project.objects.PBXGroup).forEach((groupKey) => {
      const group = project.hash.project.objects.PBXGroup[groupKey];
      if (!group.name && !group.path) {
        project.addToPbxGroup(groupUuid, groupKey);
      }
    });
  }
};

const withShareInbox = (config, props = {}) => {
  const appGroupId = props.appGroupId;
  const mainBundleIdentifier = config.ios?.bundleIdentifier;
  if (!appGroupId || !mainBundleIdentifier) {
    throw new Error('LiveToEat share inbox needs an iOS bundle identifier and App Group ID.');
  }

  const extensionBundleIdentifier = props.extensionBundleIdentifier ?? `${mainBundleIdentifier}.shareinbox`;
  addEasExtensionConfig(config, extensionBundleIdentifier, appGroupId);

  config = withEntitlementsPlist(config, (entitlementsConfig) => {
    mergeAppGroup(entitlementsConfig.modResults, appGroupId);
    return entitlementsConfig;
  });
  config = withInfoPlist(config, (infoConfig) => {
    infoConfig.modResults.LiveToEatShareInboxAppGroupId = appGroupId;
    return infoConfig;
  });
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      writeExtensionFiles(modConfig.modRequest.platformProjectRoot, appGroupId);
      return modConfig;
    },
  ]);
  return withXcodeProject(config, (xcodeConfig) => {
    addExtensionTarget(xcodeConfig.modResults, xcodeConfig, extensionBundleIdentifier);
    return xcodeConfig;
  });
};

module.exports = withShareInbox;
