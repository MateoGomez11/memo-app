import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  InteractionManager,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import {
  saveMeeting,
  saveActiveRecording,
  clearActiveRecording,
} from '../services/storage';
import { RecordingService } from '../../modules/recording-service';
import { colors, typography, spacing, radius, shadow } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';

// Suppress notification popups while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const BAR_HEIGHTS = [16, 28, 40, 52, 64, 52, 40, 28, 16];

const LOW_STORAGE_MB = 200;
const CRITICAL_STORAGE_MB = 50;
const STORAGE_CHECK_MS = 30_000;
const STATUS_CHECK_MS = 5_000;
const NOTIF_ID = 'memo-recording';
const CATEGORY_ACTIVE = 'memo-recording-active';
const CATEGORY_PAUSED = 'memo-recording-paused';

type BannerVariant = 'info' | 'warning' | 'error';
type BannerInfo = { icon: string; message: string; variant: BannerVariant } | null;

const AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
};

export default function ActiveRecordingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, t } = useAppContext();

  const [title, setTitle] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [bannerInfo, setBannerInfo] = useState<BannerInfo>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const discardSlide = useRef(new Animated.Value(300)).current;
  const discardFade = useRef(new Animated.Value(0)).current;
  const [showStopModal, setShowStopModal] = useState(false);
  const [confirmDiscardAudio, setConfirmDiscardAudio] = useState(false);
  const stopSlide = useRef(new Animated.Value(300)).current;
  const stopFade = useRef(new Animated.Value(0)).current;

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meterAnim = useRef(new Animated.Value(0.05)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const isRecordingActiveRef = useRef(false);
  const unexpectedStopFiredRef = useRef(false);
  const isInBackgroundRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const notifPermGrantedRef = useRef(false);
  const pausedForModalRef = useRef(false);
  const elapsedRef = useRef(0);
  const bgServiceSubsRef = useRef<{ remove: () => void }[]>([]);
  const fgServiceRunningRef = useRef(false);

  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setup().catch((e) => {
        Alert.alert(t('error'), (e as any)?.message ?? String(e));
        navigation.goBack();
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
      stopAllIntervals();
      dismissBgNotification();
      bgServiceSubsRef.current.forEach((s) => s.remove());
      bgServiceSubsRef.current = [];
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationAction);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // ─── Notification setup ──────────────────────────────────────────────────────

  const setupNotifications = async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('[Notif] permission status:', status);

    if (Platform.OS === 'android') {
      // FGS manages its own notification; categories with opensAppToForeground:false
      // crash on Android without a registered BroadcastReceiver.
      return true;
    }

    if (status !== 'granted') {
      showBanner({ icon: 'notifications-off-outline', message: t('notif_perm'), variant: 'warning' }, 6000);
      return false;
    }

    try {
      await Notifications.setNotificationCategoryAsync(CATEGORY_ACTIVE, [
        { identifier: 'pause', buttonTitle: '⏸ Pausar', options: { opensAppToForeground: false } },
      ]);
      await Notifications.setNotificationCategoryAsync(CATEGORY_PAUSED, [
        { identifier: 'resume', buttonTitle: '▶ Reanudar', options: { opensAppToForeground: false } },
      ]);
    } catch {}

    return true;
  };

  const showOrUpdateNotification = async (paused: boolean) => {
    console.log('[Notif] showOrUpdateNotification paused:', paused);
    try { await Notifications.cancelScheduledNotificationAsync(NOTIF_ID); } catch {}
    try { await Notifications.dismissNotificationAsync(NOTIF_ID); } catch {}
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID,
        content: {
          title: paused ? t('notif_paused_title') : t('notif_recording_title'),
          body: paused ? t('notif_paused_body') : t('notif_recording_body'),
          categoryIdentifier: notifPermGrantedRef.current ? (paused ? CATEGORY_PAUSED : CATEGORY_ACTIVE) : undefined,
          data: {},
          ...(Platform.OS === 'android' && { channelId: 'recording' }),
        },
        // Delay 2s so the app is fully in background when the notification fires.
        // If trigger: null is used during the iOS 'inactive' transition, the
        // foreground handler suppresses it before the OS can display it.
        trigger: Platform.OS === 'ios' ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, repeats: false } : null,
      });
    } catch (e) {
      console.warn('[Notif] scheduleNotificationAsync failed:', e);
    }
  };

  const dismissBgNotification = async () => {
    if (Platform.OS === 'android' && fgServiceRunningRef.current) {
      fgServiceRunningRef.current = false;
      console.log('[Notif] stopping FGS');
      try { RecordingService.stop(); } catch (e) { console.warn('[Notif] stop error:', e); }
    }
    try { await Notifications.cancelScheduledNotificationAsync(NOTIF_ID); } catch {}
    try { await Notifications.dismissNotificationAsync(NOTIF_ID); } catch {}
  };

  // ─── Notification action handler (pause / resume from the notification) ─────

  const handleNotificationAction = async (response: Notifications.NotificationResponse) => {
    const actionId = response.actionIdentifier;
    const rec = recordingRef.current;
    if (!rec) return;

    if (actionId === 'pause' && !isPausedRef.current) {
      isPausedRef.current = true;
      isRecordingActiveRef.current = false;
      try {
        await rec.pauseAsync();
        setIsPaused(true);
        await showOrUpdateNotification(true);
      } catch {
        isPausedRef.current = false;
        isRecordingActiveRef.current = true;
      }
    } else if (actionId === 'resume' && isPausedRef.current) {
      isPausedRef.current = false;
      isRecordingActiveRef.current = true;
      try {
        await Audio.setAudioModeAsync(AUDIO_MODE);
        await rec.startAsync();
        setIsPaused(false);
        await showOrUpdateNotification(false);
      } catch {
        isPausedRef.current = true;
        isRecordingActiveRef.current = false;
      }
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const showBanner = (info: BannerInfo, autoDismissMs?: number) => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    setBannerInfo(info);
    if (autoDismissMs && info) {
      bannerTimeoutRef.current = setTimeout(() => setBannerInfo(null), autoDismissMs);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // ─── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // ─── Storage monitor ────────────────────────────────────────────────────────

  const checkStorage = async (): Promise<'ok' | 'low' | 'critical'> => {
    try {
      const free = await FileSystem.getFreeDiskStorageAsync();
      const freeMB = free / (1024 * 1024);
      if (freeMB < CRITICAL_STORAGE_MB) return 'critical';
      if (freeMB < LOW_STORAGE_MB) return 'low';
    } catch {}
    return 'ok';
  };

  const startStorageMonitor = () => {
    storageIntervalRef.current = setInterval(async () => {
      const level = await checkStorage();
      if (level === 'critical') {
        showBanner({ icon: 'warning', message: t('storage_critical'), variant: 'error' });
        await finalizeAndSave();
      } else if (level === 'low') {
        showBanner({ icon: 'warning-outline', message: t('storage_low', { mb: LOW_STORAGE_MB }), variant: 'warning' });
      }
    }, STORAGE_CHECK_MS);
  };

  const startStatusMonitor = () => {
    statusIntervalRef.current = setInterval(async () => {
      if (isPausedRef.current || !isRecordingActiveRef.current) return;
      if (appStateRef.current !== 'active') return;
      const rec = recordingRef.current;
      if (!rec) return;
      try {
        const status = await rec.getStatusAsync();
        if (!status.isRecording) await tryAutoResume();
      } catch {}
    }, STATUS_CHECK_MS);
  };

  const stopAllIntervals = () => {
    stopTimer();
    if (storageIntervalRef.current) { clearInterval(storageIntervalRef.current); storageIntervalRef.current = null; }
    if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
  };

  // ─── Auto-resume ────────────────────────────────────────────────────────────

  const tryAutoResume = async (context?: 'background' | 'headphone') => {
    const rec = recordingRef.current;
    if (!rec || isPausedRef.current || !isRecordingActiveRef.current) return;
    try {
      await Audio.setAudioModeAsync(AUDIO_MODE);
      await rec.startAsync();
      isRecordingActiveRef.current = true;
      unexpectedStopFiredRef.current = false;
      startTimer();
      const message = context === 'background'
        ? t('resume_banner')
        : context === 'headphone'
          ? t('resume_headphone')
          : t('resume_auto');
      showBanner({ icon: 'checkmark-circle-outline', message, variant: 'info' }, 6000);
      if (isInBackgroundRef.current) {
        await showOrUpdateNotification(false);
      }
    } catch {
      showBanner({ icon: 'pause-circle-outline', message: t('paused_interrupt'), variant: 'warning' });
      if (isInBackgroundRef.current) {
        await showOrUpdateNotification(true);
      }
    }
  };

  // ─── AppState ────────────────────────────────────────────────────────────────

  const startBgTracking = async () => {
    if (isInBackgroundRef.current) return;
    isInBackgroundRef.current = true;
    stopAllIntervals();
    if (Platform.OS === 'android') {
      console.log('[Notif] going background — fgsRunning:', fgServiceRunningRef.current, 'elapsed:', elapsedRef.current);
      if (fgServiceRunningRef.current) {
        try {
          RecordingService.update(elapsedRef.current, isPausedRef.current);
          console.log('[Notif] FGS updated');
        } catch (e) { console.warn('[Notif] FGS update error:', e); }
      }
    } else if (notifPermGrantedRef.current) {
      await showOrUpdateNotification(isPausedRef.current);
    }
  };

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    const prev = appStateRef.current;
    appStateRef.current = nextState;

    // iOS: active → inactive → background. Start bg tracking on inactive so
    // we don't miss the window if 'background' fires late or not at all.
    if (nextState === 'inactive' && prev === 'active') {
      await startBgTracking();
    }

    // Android / iOS catch-all for background
    else if (nextState === 'background') {
      await startBgTracking();
    }

    // Returning to foreground
    else if (nextState === 'active' && prev !== 'active') {
      if (isInBackgroundRef.current) {
        isInBackgroundRef.current = false;
        // Android: foreground service keeps running while recording — don't stop it.
        // iOS: dismiss the scheduled notification.
        if (Platform.OS !== 'android') {
          dismissBgNotification();
        }
      }

      const rec = recordingRef.current;
      if (!rec || isPausedRef.current) {
        startStorageMonitor();
        startStatusMonitor();
        return;
      }

      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording) {
          setElapsed(Math.floor((status.durationMillis ?? 0) / 1000));
          startTimer();
        } else {
          setElapsed(Math.floor((status.durationMillis ?? 0) / 1000));
          await tryAutoResume('background');
        }
      } catch {}

      startStorageMonitor();
      startStatusMonitor();
    }
  };

  // ─── Metering ────────────────────────────────────────────────────────────────

  const collapseWaveform = () => {
    Animated.spring(meterAnim, {
      toValue: 0.05,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
      mass: 0.5,
    }).start();
  };

  const onMeteringUpdate = (status: Audio.RecordingStatus) => {
    if (status.isRecording) {
      unexpectedStopFiredRef.current = false;
      if (status.metering != null && !isPausedRef.current) {
        const level = Math.max(0.05, Math.min(1, (status.metering + 60) / 60));
        Animated.spring(meterAnim, {
          toValue: level,
          useNativeDriver: false,
          damping: 12,
          stiffness: 280,
          mass: 0.4,
        }).start();
      }
    } else if (!isPausedRef.current && isRecordingActiveRef.current && !unexpectedStopFiredRef.current && appStateRef.current === 'active') {
      unexpectedStopFiredRef.current = true;
      stopTimer();
      collapseWaveform();
      tryAutoResume();
    }
  };

  // ─── Setup ───────────────────────────────────────────────────────────────────

  const setup = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(t('perm_required'), t('perm_mic'));
        navigation.goBack();
        return;
      }
    } catch {
      navigation.goBack();
      return;
    }

    const storageLevel = await checkStorage();
    if (storageLevel === 'critical') {
      Alert.alert(t('storage_insufficient'), t('storage_min', { mb: CRITICAL_STORAGE_MB }));
      navigation.goBack();
      return;
    }

    try { notifPermGrantedRef.current = await setupNotifications(); } catch {}

    if (Platform.OS === 'android') {
      try {
        const pauseSub = RecordingService.addPauseListener(async () => {
          const rec = recordingRef.current;
          if (!rec || isPausedRef.current) return;
          isPausedRef.current = true;
          isRecordingActiveRef.current = false;
          try {
            await rec.pauseAsync();
            setIsPaused(true);
          } catch {
            isPausedRef.current = false;
            isRecordingActiveRef.current = true;
          }
        });
        const resumeSub = RecordingService.addResumeListener(async () => {
          const rec = recordingRef.current;
          if (!rec || !isPausedRef.current) return;
          isPausedRef.current = false;
          isRecordingActiveRef.current = true;
          try {
            await Audio.setAudioModeAsync(AUDIO_MODE);
            await rec.startAsync();
            setIsPaused(false);
          } catch {
            isPausedRef.current = true;
            isRecordingActiveRef.current = false;
          }
        });
        bgServiceSubsRef.current = [pauseSub, resumeSub];
      } catch {}
    }

    await startRecording();
    if (storageLevel === 'low') {
      showBanner({ icon: 'warning-outline', message: t('storage_low', { mb: LOW_STORAGE_MB }), variant: 'warning' });
    }
    startStorageMonitor();
    startStatusMonitor();
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync(AUDIO_MODE);
      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        onMeteringUpdate,
        50
      );
      recordingRef.current = recording;
      isRecordingActiveRef.current = true;
      unexpectedStopFiredRef.current = false;
      await saveActiveRecording({ uri: recording.getURI() ?? '', startedAt: Date.now(), title: '' });
      if (Platform.OS === 'android') {
        try {
          console.log('[Notif] starting FGS');
          RecordingService.start(0, false);
          fgServiceRunningRef.current = true;
          console.log('[Notif] FGS started OK');
        } catch (e) { console.warn('[Notif] FGS start error:', e); }
      }
      startTimer();
    } catch (e) {
      Alert.alert(t('error'), t('error_start', { msg: (e as any)?.message ?? e }));
    }
  };

  // ─── Finalization helpers ────────────────────────────────────────────────────

  const finalize = async (): Promise<{ permanentUri: string; duration: string } | null> => {
    stopAllIntervals();
    dismissBgNotification();
    isRecordingActiveRef.current = false;
    isInBackgroundRef.current = false;
    const rec = recordingRef.current;
    if (!rec) return null;
    try {
      const snapshotElapsed = elapsed;
      await rec.stopAndUnloadAsync();
      recordingRef.current = null;
      const tempUri = rec.getURI();
      if (!tempUri) return null;
      const permanentUri = `${FileSystem.documentDirectory}memo_${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
      await clearActiveRecording();
      return { permanentUri, duration: formatTime(snapshotElapsed) };
    } catch {
      return null;
    }
  };

  const saveAsUnprocessed = async (permanentUri: string, duration: string) => {
    const id = `meeting_${Date.now()}`;
    await saveMeeting({
      id,
      title: title.trim() || `Memo ${new Date().toLocaleDateString('es-CO')}`,
      date: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
      duration,
      category: 'Draft',
      tldr: '', keyPoints: [], actionItems: [], pendingDates: [],
      transcript: '', audioUri: permanentUri,
      confidenceScore: 0, keyTheme: '', attendees: '',
      createdAt: Date.now(),
      processed: false,
    });
    return id;
  };

  const finalizeAndProcess = async () => {
    closeStopModal();
    const result = await finalize();
    if (!result) { Alert.alert(t('error'), t('save_error')); return; }

    const net = await NetInfo.fetch();
    const isConnected = net.isConnected && net.isInternetReachable !== false;

    if (!isConnected) {
      await saveAsUnprocessed(result.permanentUri, result.duration);
      Alert.alert(
        t('no_internet_title'),
        t('no_internet_msg'),
        [{ text: t('understand'), onPress: () => navigation.goBack() }]
      );
      return;
    }

    const meetingId = await saveAsUnprocessed(result.permanentUri, result.duration);
    navigation.replace('Processing', {
      audioUri: result.permanentUri,
      meetingId,
      title: title.trim() || undefined,
      recordedDuration: result.duration,
    });
  };

  const finalizeAndShare = async () => {
    closeStopModal();
    const result = await finalize();
    if (!result) { Alert.alert(t('error'), t('save_error')); return; }
    await Sharing.shareAsync(result.permanentUri, { mimeType: 'audio/mp4', dialogTitle: t('share') });
  };

  const finalizeAndSave = async () => {
    closeStopModal();
    const result = await finalize();
    if (!result) { Alert.alert(t('error'), t('save_error')); return; }
    await saveAsUnprocessed(result.permanentUri, result.duration);
    navigation.goBack();
  };

  const finalizeAndDiscard = async () => {
    closeStopModal();
    stopAllIntervals();
    dismissBgNotification();
    isRecordingActiveRef.current = false;
    await clearActiveRecording();
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    navigation.goBack();
  };

  // ─── Stop modal ──────────────────────────────────────────────────────────────

  const openStopModal = async () => {
    setConfirmDiscardAudio(false);
    pausedForModalRef.current = false;

    if (!isPausedRef.current && isRecordingActiveRef.current) {
      pausedForModalRef.current = true;
      const rec = recordingRef.current;
      if (rec) {
        isPausedRef.current = true;
        isRecordingActiveRef.current = false;
        try {
          await rec.pauseAsync();
          stopTimer();
          setIsPaused(true);
          collapseWaveform();
        } catch {
          isPausedRef.current = false;
          isRecordingActiveRef.current = true;
          pausedForModalRef.current = false;
        }
      }
    }

    setShowStopModal(true);
    Animated.parallel([
      Animated.timing(stopFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(stopSlide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
    ]).start();
  };

  const closeStopModal = () => {
    Animated.parallel([
      Animated.timing(stopFade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(stopSlide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => { setShowStopModal(false); setConfirmDiscardAudio(false); });
  };

  const handleCancelStop = () => {
    Animated.parallel([
      Animated.timing(stopFade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(stopSlide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(async () => {
      setShowStopModal(false);
      setConfirmDiscardAudio(false);
      if (pausedForModalRef.current) {
        pausedForModalRef.current = false;
        const rec = recordingRef.current;
        if (rec) {
          try {
            await Audio.setAudioModeAsync(AUDIO_MODE);
            await rec.startAsync();
            setIsPaused(false);
            isPausedRef.current = false;
            isRecordingActiveRef.current = true;
            unexpectedStopFiredRef.current = false;
            startTimer();
          } catch {}
        }
      }
    });
  };

  // ─── Discard modal ───────────────────────────────────────────────────────────

  const openDiscardModal = () => {
    setShowDiscardModal(true);
    Animated.parallel([
      Animated.timing(discardFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(discardSlide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
    ]).start();
  };

  const closeDiscardModal = () => {
    Animated.parallel([
      Animated.timing(discardFade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(discardSlide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowDiscardModal(false));
  };

  const confirmDiscard = async () => {
    closeDiscardModal();
    stopAllIntervals();
    dismissBgNotification();
    isRecordingActiveRef.current = false;
    await clearActiveRecording();
    try { await recordingRef.current?.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    navigation.goBack();
  };

  // ─── Pause ───────────────────────────────────────────────────────────────────

  const handlePause = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    if (isPaused) {
      try {
        await Audio.setAudioModeAsync(AUDIO_MODE);
        await rec.startAsync();
        startTimer();
        setIsPaused(false);
        isPausedRef.current = false;
        isRecordingActiveRef.current = true;
        unexpectedStopFiredRef.current = false;
        showBanner(null);
      } catch (e) {
        Alert.alert(t('error'), t('error_resume', { msg: (e as any)?.message ?? e }));
      }
    } else {
      // Set refs BEFORE await to prevent race condition with onMeteringUpdate
      isPausedRef.current = true;
      isRecordingActiveRef.current = false;
      try {
        await rec.pauseAsync();
        stopTimer();
        setIsPaused(true);
        collapseWaveform();
      } catch {
        isPausedRef.current = false;
        isRecordingActiveRef.current = true;
        Alert.alert(t('error'), t('error_pause'));
      }
    }
  };

  // ─── Banner colors ───────────────────────────────────────────────────────────

  const bannerBg: Record<BannerVariant, string> = {
    info: colors.primaryFixed,
    warning: colors.tertiaryFixed,
    error: colors.errorContainer,
  };
  const bannerColor: Record<BannerVariant, string> = {
    info: colors.onPrimaryFixed,
    warning: colors.onTertiaryFixed,
    error: colors.onErrorContainer,
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <View style={[styles.bgGradient, { pointerEvents: 'none', backgroundColor: colors.primaryFixed }]} />
      <View style={styles.content}>

        <View style={styles.header}>
          <View style={styles.recordingBadge}>
            <Animated.View style={[styles.recordingDot, { opacity: isPaused ? 0.35 : 1, backgroundColor: colors.error }]} />
            <Text style={[styles.recordingLabel, { color: colors.onSurfaceVariant }]}>{isPaused ? t('paused_status') : t('recording_status')}</Text>
          </View>

          {bannerInfo && (
            <TouchableOpacity
              style={[styles.banner, { backgroundColor: bannerBg[bannerInfo.variant] }]}
              onPress={() => setBannerInfo(null)}
              activeOpacity={0.85}
            >
              <Ionicons name={bannerInfo.icon as any} size={16} color={bannerColor[bannerInfo.variant]} />
              <Text style={[styles.bannerText, { color: bannerColor[bannerInfo.variant] }]}>
                {bannerInfo.message}
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={[styles.titleInput, { color: colors.primary, borderBottomColor: colors.outlineVariant }]}
            placeholder={t('title_placeholder')}
            placeholderTextColor={colors.outline}
            value={title}
            onChangeText={setTitle}
            textAlign="center"
          />
        </View>

        <View style={styles.center}>
          <Text style={[styles.timer, { color: colors.primary }]}>{formatTime(elapsed)}</Text>
          <Text style={[styles.timerLabel, { color: colors.onSurfaceVariant }]}>
            {Math.floor(elapsed / 3600) > 0 ? t('time_recorded') : t('minutes_recorded')}
          </Text>
          <View style={styles.waveform}>
            {BAR_HEIGHTS.map((maxH, i) => (
              <Animated.View
                key={i}
                style={[styles.waveBar, {
                  opacity: isPaused ? 0.3 : 0.85,
                  height: meterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, maxH],
                  }),
                }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.stopBtn} onPress={openStopModal} activeOpacity={0.85}>
            <View style={[styles.stopOuter, { borderColor: colors.error, backgroundColor: colors.surfaceContainerHighest }]}>
              <View style={[styles.stopInner, { backgroundColor: colors.error }]}>
                <Ionicons name="stop" size={48} color={colors.onPrimary} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={[styles.stopHint, { color: colors.onSurfaceVariant }]}>{t('stop_hint')}</Text>
          <View style={styles.auxRow}>
            <TouchableOpacity style={[styles.auxBtn, { backgroundColor: colors.surfaceContainer }]} onPress={handlePause} activeOpacity={0.7}>
              <Ionicons name={isPaused ? 'play' : 'pause'} size={20} color={colors.primaryContainer} />
              <Text style={[styles.auxLabel, { color: colors.primaryContainer }]}>{isPaused ? t('resume') : t('pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.auxBtn, { backgroundColor: colors.errorContainer }]} onPress={openDiscardModal} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.auxLabel, { color: colors.error }]}>{t('discard')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Stop action modal ─────────────────────────────────────────────── */}
      <Modal visible={showStopModal} transparent animationType="none" onRequestClose={closeStopModal}>
        <Animated.View style={[sheetStyles.overlay, { opacity: stopFade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeStopModal} />
          <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.surfaceContainerLow, transform: [{ translateY: stopSlide }] }]}>
            <View style={[sheetStyles.handle, { backgroundColor: colors.outlineVariant }]} />
            {!confirmDiscardAudio ? (
              <>
                <View style={sheetStyles.durationBlock}>
                  <Text style={[sheetStyles.durationBig, { color: colors.onSurface }]}>{formatTime(elapsed)}</Text>
                  <Text style={[sheetStyles.durationSub, { color: colors.onSurfaceVariant }]}>{t('recorded_label')}</Text>
                </View>

                <TouchableOpacity style={[sheetStyles.primaryAction, { backgroundColor: colors.primaryFixed }]} onPress={finalizeAndProcess} activeOpacity={0.85}>
                  <View style={[sheetStyles.actionIcon, { backgroundColor: colors.primary }]}>
                    <Ionicons name="sparkles" size={22} color={colors.onPrimary} />
                  </View>
                  <View style={sheetStyles.actionText}>
                    <Text style={[sheetStyles.actionLabel, { color: colors.primary }]}>{t('analyze_ai')}</Text>
                    <Text style={[sheetStyles.actionSub, { color: colors.onSurfaceVariant }]}>{t('analyze_sub')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={[sheetStyles.discardAction, { backgroundColor: colors.errorContainer }]} onPress={() => setConfirmDiscardAudio(true)} activeOpacity={0.8}>
                  <View style={[sheetStyles.actionIcon, { backgroundColor: colors.errorContainer }]}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                  </View>
                  <View style={sheetStyles.actionText}>
                    <Text style={[sheetStyles.actionLabel, { color: colors.error }]}>{t('discard_recording')}</Text>
                    <Text style={[sheetStyles.actionSub, { color: colors.onSurfaceVariant }]}>{t('discard_sub')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.error} />
                </TouchableOpacity>

                <TouchableOpacity style={[sheetStyles.cancelBtn, { backgroundColor: colors.surfaceContainer }]} onPress={handleCancelStop} activeOpacity={0.8}>
                  <Ionicons name="mic" size={16} color={colors.primary} />
                  <Text style={[sheetStyles.cancelText, { color: colors.onSurfaceVariant }]}>{t('cancel_keep')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={sheetStyles.confirmBox}>
                <View style={[sheetStyles.actionIcon, { backgroundColor: colors.errorContainer, width: 72, height: 72, borderRadius: 36 }]}>
                  <Ionicons name="trash-outline" size={32} color={colors.error} />
                </View>
                <Text style={[sheetStyles.confirmTitle, { color: colors.onSurface }]}>{t('confirm_discard_title')}</Text>
                <Text style={[sheetStyles.confirmSub, { color: colors.onSurfaceVariant }]}>
                  {t('confirm_discard_sub')}
                </Text>
                <View style={sheetStyles.confirmBtns}>
                  <TouchableOpacity style={[sheetStyles.confirmCancelBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={handleCancelStop} activeOpacity={0.8}>
                    <Text style={[sheetStyles.confirmCancelText, { color: colors.onSurfaceVariant }]}>{t('keep_recording')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[sheetStyles.confirmDeleteBtn, { backgroundColor: colors.error }]} onPress={finalizeAndDiscard} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={18} color={colors.onError} />
                    <Text style={[sheetStyles.confirmDeleteText, { color: colors.onError }]}>{t('discard')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Discard-during-recording modal ───────────────────────────────── */}
      <Modal visible={showDiscardModal} transparent animationType="none" onRequestClose={closeDiscardModal}>
        <Animated.View style={[sheetStyles.overlay, { opacity: discardFade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDiscardModal} />
          <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.surfaceContainerLow, transform: [{ translateY: discardSlide }] }]}>
            <View style={[sheetStyles.handle, { backgroundColor: colors.outlineVariant }]} />
            <View style={{ marginBottom: 4 }}>
              <View style={[sheetStyles.actionIcon, { backgroundColor: colors.errorContainer, width: 72, height: 72, borderRadius: 36, alignSelf: 'center' }]}>
                <Ionicons name="trash-outline" size={32} color={colors.error} />
              </View>
            </View>
            <Text style={[sheetStyles.confirmTitle, { color: colors.onSurface }]}>{t('discard_during_title')}</Text>
            <Text style={[sheetStyles.confirmSub, { color: colors.onSurfaceVariant }]}>
              {t('discard_during_sub')}
            </Text>
            <View style={[sheetStyles.durationChip, { alignSelf: 'center', marginTop: 4, backgroundColor: colors.primaryFixed }]}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[sheetStyles.durationText, { color: colors.primary }]}>{formatTime(elapsed)} {t('recorded_label')}</Text>
            </View>
            <View style={sheetStyles.confirmBtns}>
              <TouchableOpacity style={[sheetStyles.confirmCancelBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={closeDiscardModal} activeOpacity={0.8}>
                <Text style={[sheetStyles.confirmCancelText, { color: colors.onSurfaceVariant }]}>{t('keep_recording')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sheetStyles.confirmDeleteBtn, { backgroundColor: colors.error }]} onPress={confirmDiscard} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={18} color={colors.onError} />
                <Text style={[sheetStyles.confirmDeleteText, { color: colors.onError }]}>{t('discard')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: colors.primaryFixed, opacity: 0.12 },
  content: { flex: 1, paddingHorizontal: spacing.marginPage, paddingTop: spacing.stackMd, paddingBottom: spacing.stackLg, justifyContent: 'space-between', alignItems: 'center' },
  header: { alignItems: 'center', gap: spacing.stackSm, width: '100%' },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  recordingLabel: { ...typography.labelCaps, color: colors.onSurfaceVariant },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 340 },
  bannerText: { ...typography.bodyMd, fontSize: 13, flex: 1 },
  titleInput: { width: '100%', maxWidth: 360, ...typography.h2, color: colors.primary, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, paddingVertical: 8, textAlign: 'center' },
  center: { alignItems: 'center', gap: spacing.stackLg, flex: 1, justifyContent: 'center' },
  timer: { fontFamily: 'Inter_700Bold', fontSize: 64, lineHeight: 70, letterSpacing: -2, color: colors.primary },
  timerLabel: { ...typography.labelCaps, color: colors.onSurfaceVariant },
  waveform: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 5, height: 72 },
  waveBar: { width: 5, borderRadius: 3, backgroundColor: colors.primary },
  footer: { alignItems: 'center', gap: spacing.stackMd },
  stopBtn: { alignItems: 'center', justifyContent: 'center' },
  stopOuter: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: colors.error, opacity: 0.9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerHighest, ...shadow.card },
  stopInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  stopHint: { ...typography.button, color: colors.onSurfaceVariant, fontFamily: 'Inter_500Medium' },
  auxRow: { flexDirection: 'row', gap: spacing.gutter },
  auxBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.full, backgroundColor: colors.surfaceContainer },
  discardBtn: { backgroundColor: colors.errorContainer },
  auxLabel: { ...typography.button, fontSize: 15, color: colors.primaryContainer },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.marginPage, paddingBottom: 40, paddingTop: 12, gap: 4 },
  handle: { width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.outlineVariant, alignSelf: 'center', marginBottom: spacing.stackMd },
  headerRow: { alignItems: 'center', marginBottom: 6 },
  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryFixed, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full },
  durationText: { ...typography.labelCaps, color: colors.primary, fontSize: 12 },
  sheetTitle: { ...typography.h2, color: colors.onSurface, marginBottom: spacing.stackSm },
  divider: { height: 1, backgroundColor: colors.surfaceContainerHighest, marginVertical: spacing.stackSm },
  dividerLight: { height: 1, backgroundColor: colors.surfaceContainerLow, marginVertical: 4 },
  durationBlock: { alignItems: 'center', paddingVertical: spacing.stackMd, gap: 2 },
  durationBig: { fontFamily: 'Inter_700Bold', fontSize: 48, lineHeight: 52, letterSpacing: -1.5, color: colors.onSurface },
  durationSub: { ...typography.labelCaps, color: colors.onSurfaceVariant, fontSize: 12 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: colors.primaryFixed, borderRadius: radius.xl, marginBottom: 4 },
  discardAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: colors.errorContainer, borderRadius: radius.xl, marginBottom: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, paddingVertical: 12, paddingHorizontal: 4 },
  actionIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionLabel: { ...typography.bodyMd, fontFamily: 'Inter_600SemiBold', color: colors.onSurface },
  actionSub: { ...typography.bodyMd, fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
  cancelBtn: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: spacing.stackSm },
  cancelText: { ...typography.button, color: colors.onSurfaceVariant, fontSize: 15 },
  confirmBox: { alignItems: 'center', gap: spacing.stackSm, paddingVertical: spacing.stackMd },
  confirmTitle: { ...typography.h2, color: colors.onSurface, textAlign: 'center', marginTop: 4 },
  confirmSub: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
  confirmBtns: { flexDirection: 'row', gap: spacing.gutter, marginTop: spacing.stackMd, width: '100%' },
  confirmCancelBtn: { flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  confirmCancelText: { ...typography.button, color: colors.onSurfaceVariant, fontSize: 15 },
  confirmDeleteBtn: { flex: 1, backgroundColor: colors.error, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  confirmDeleteText: { ...typography.button, color: colors.onError, fontSize: 15 },
});
