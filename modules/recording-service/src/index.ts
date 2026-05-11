import { Platform } from 'react-native';
import { EventEmitter } from 'expo-modules-core';

type Subscription = { remove: () => void };

let _native: any = null;
let _emitter: any = null;

if (Platform.OS === 'android') {
  try {
    const { requireNativeModule } = require('expo-modules-core');
    _native = requireNativeModule('RecordingService');
    _emitter = new EventEmitter(_native);
  } catch {
    // Dev build not installed yet — no-ops below
  }
}

export const RecordingService = {
  /** Start the foreground service. Call when app goes to background. */
  start(elapsed: number, paused: boolean): void {
    _native?.start(elapsed, paused);
  },
  /** Update elapsed/paused state shown in the notification. */
  update(elapsed: number, paused: boolean): void {
    _native?.update(elapsed, paused);
  },
  /** Stop the foreground service. Call when app returns to foreground or recording ends. */
  stop(): void {
    _native?.stop();
  },
  /** Fires when user taps ⏸ Pausar in the notification. */
  addPauseListener(callback: () => void): Subscription {
    return _emitter?.addListener('onPause', callback) ?? { remove: () => {} };
  },
  /** Fires when user taps ▶ Reanudar in the notification. */
  addResumeListener(callback: () => void): Subscription {
    return _emitter?.addListener('onResume', callback) ?? { remove: () => {} };
  },
};
