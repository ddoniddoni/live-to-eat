Pod::Spec.new do |spec|
  spec.name = 'LiveToEatShareInbox'
  spec.version = '0.1.0'
  spec.summary = 'Private shared-link inbox for LiveToEat.'
  spec.description = 'Receives a single shared place link without opening the iOS main app.'
  spec.license = { :type => 'MIT' }
  spec.author = 'LiveToEat'
  spec.homepage = 'https://github.com/ddoniddoni/live-to-eat'
  spec.platforms = { :ios => '16.4' }
  spec.swift_version = '5.9'
  spec.source = { :git => 'https://github.com/ddoniddoni/live-to-eat.git' }
  spec.static_framework = true

  spec.dependency 'ExpoModulesCore'
  spec.source_files = '**/*.{h,m,mm,swift}'
  spec.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
