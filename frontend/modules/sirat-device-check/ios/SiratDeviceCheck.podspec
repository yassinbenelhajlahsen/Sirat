Pod::Spec.new do |s|
  s.name           = 'SiratDeviceCheck'
  s.version        = '1.0.0'
  s.summary        = 'DeviceCheck token for the Sirat chat quota'
  s.description    = 'Generates the DeviceCheck token the chat server uses to limit free messages per device.'
  s.author         = ''
  s.homepage       = 'https://sirat.dev'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks     = 'DeviceCheck'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
