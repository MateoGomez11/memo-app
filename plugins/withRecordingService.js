const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds FOREGROUND_SERVICE + FOREGROUND_SERVICE_MICROPHONE permissions and
 * declares RecordingForegroundService with foregroundServiceType="microphone".
 */
module.exports = function withRecordingService(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application[0];

    // Permissions
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const perms = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
    ];
    for (const name of perms) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // Service declaration
    if (!app.service) app.service = [];
    const svcName = 'expo.modules.recordingservice.RecordingForegroundService';
    if (!app.service.some((s) => s.$?.['android:name'] === svcName)) {
      app.service.push({
        $: {
          'android:name': svcName,
          'android:foregroundServiceType': 'microphone',
          'android:exported': 'false',
        },
      });
    }

    return modConfig;
  });
};
