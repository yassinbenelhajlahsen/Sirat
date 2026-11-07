Pod::Spec.new do |s|
  s.name           = 'SiratContextMenu'
  s.version        = '1.0.0'
  s.summary        = 'Native hold menu for Sirat chat answers'
  s.description    = 'Wraps React Native children in a UIContextMenuInteraction, so holding a chat answer lifts it and shows Copy and Report.'
  s.author         = ''
  s.homepage       = 'https://sirat.dev'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
