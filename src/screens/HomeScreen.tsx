import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Animated,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { typography, spacing, radius } from '../theme';
import {
  getMeetings, deleteMeeting, toggleMeetingFavorite,
  getActiveRecording, clearActiveRecording, ActiveRecordingData,
} from '../services/storage';
import { Meeting } from '../types';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import MemoCard from '../components/MemoCard';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { colors, t } = useAppContext();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recoveryData, setRecoveryData] = useState<ActiveRecordingData | null>(null);
  const recoverySlide = useRef(new Animated.Value(300)).current;
  const recoveryFade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const data = await getMeetings();
    const sorted = [...data].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    setMeetings(sorted);
  }, []);

  const checkCrashRecovery = useCallback(async () => {
    const active = await getActiveRecording();
    if (!active) return;
    try {
      const info = await FileSystem.getInfoAsync(active.uri);
      if (info.exists && info.size && info.size > 0) {
        setRecoveryData(active);
        Animated.parallel([
          Animated.timing(recoveryFade, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(recoverySlide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
        ]).start();
      } else {
        await clearActiveRecording();
      }
    } catch {
      await clearActiveRecording();
    }
  }, []);

  const closeRecoveryModal = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(recoveryFade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(recoverySlide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setRecoveryData(null);
      callback?.();
    });
  };

  const handleRecoveryProcess = () => {
    if (!recoveryData) return;
    const uri = recoveryData.uri;
    closeRecoveryModal(async () => {
      await clearActiveRecording();
      navigation.navigate('Processing', { audioUri: uri });
    });
  };

  const handleRecoveryDiscard = async () => {
    if (!recoveryData) return;
    try { await FileSystem.deleteAsync(recoveryData.uri, { idempotent: true }); } catch {}
    await clearActiveRecording();
    closeRecoveryModal();
  };

  const formatRecoveryAge = (startedAt: number) => {
    const diffMin = Math.floor((Date.now() - startedAt) / 60_000);
    if (diffMin < 1) return t('greeting_morning') === 'Buenos días' ? 'hace un momento' : 'just now';
    if (diffMin < 60) return t('greeting_morning') === 'Buenos días' ? `hace ${diffMin} min` : `${diffMin} min ago`;
    const h = Math.floor(diffMin / 60);
    return t('greeting_morning') === 'Buenos días' ? `hace ${h}h` : `${h}h ago`;
  };

  const handleDelete = async (id: string) => {
    await deleteMeeting(id);
    await load();
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleMeetingFavorite(id);
    await load();
  };

  const handleProcess = (meeting: Meeting) => {
    if (!meeting.audioUri) {
      Alert.alert(t('no_audio'), t('no_audio_msg'));
      return;
    }
    navigation.navigate('Processing', {
      audioUri: meeting.audioUri,
      meetingId: meeting.id,
      title: meeting.title,
      recordedDuration: meeting.duration,
    });
  };

  useFocusEffect(
    useCallback(() => {
      load();
      checkCrashRecovery();
    }, [load, checkCrashRecovery])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greeting_morning') : hour < 17 ? t('greeting_afternoon') : t('greeting_evening');

  const memoCountText = meetings.length === 1
    ? t('memos_count_one')
    : t('memos_count_many', { count: meetings.length });

  const featured = meetings[0];
  const rest = meetings.slice(1);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.primary }]}>{greeting}.</Text>
          <Text style={[styles.heroSub, { color: colors.secondary }]}>
            {meetings.length > 0 ? memoCountText : t('no_memos_sub')}
          </Text>
        </View>

        {meetings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mic-circle-outline" size={72} color={colors.primaryFixed} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{t('empty_title')}</Text>
            <Text style={[styles.emptySub, { color: colors.outline }]}>{t('empty_sub')}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {featured && (
              <MemoCard
                meeting={featured}
                featured
                onPress={() => navigation.navigate('MeetingSummary', { meetingId: featured.id })}
                onDelete={() => handleDelete(featured.id)}
                onToggleFavorite={() => handleToggleFavorite(featured.id)}
                onProcess={() => handleProcess(featured)}
              />
            )}
            {rest.map((m) => (
              <MemoCard
                key={m.id}
                meeting={m}
                onPress={() => navigation.navigate('MeetingSummary', { meetingId: m.id })}
                onDelete={() => handleDelete(m.id)}
                onToggleFavorite={() => handleToggleFavorite(m.id)}
                onProcess={() => handleProcess(m)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('ActiveRecording')}
        activeOpacity={0.85}
      >
        <Ionicons name="mic" size={22} color={colors.onPrimary} />
        <Text style={[styles.fabLabel, { color: colors.onPrimary }]}>{t('record_btn')}</Text>
      </TouchableOpacity>

      <BottomNav />

      {/* Crash recovery modal */}
      <Modal visible={!!recoveryData} transparent animationType="none" onRequestClose={() => closeRecoveryModal()}>
        <Animated.View style={[recoveryStyles.overlay, { opacity: recoveryFade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeRecoveryModal()} />
          <Animated.View style={[recoveryStyles.sheet, { backgroundColor: colors.surfaceContainerLow, transform: [{ translateY: recoverySlide }] }]}>
            <View style={[recoveryStyles.handle, { backgroundColor: colors.outlineVariant }]} />

            <View style={[recoveryStyles.iconBg, { backgroundColor: colors.primaryFixed }]}>
              <Ionicons name="mic" size={32} color={colors.primary} />
            </View>

            <Text style={[recoveryStyles.title, { color: colors.onSurface }]}>{t('recovery_title')}</Text>
            <Text style={[recoveryStyles.sub, { color: colors.onSurfaceVariant }]}>
              {t('recovery_sub', { age: recoveryData ? `(${formatRecoveryAge(recoveryData.startedAt)})` : '' })}
            </Text>

            <View style={recoveryStyles.btns}>
              <TouchableOpacity style={[recoveryStyles.discardBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={handleRecoveryDiscard} activeOpacity={0.8}>
                <Text style={[recoveryStyles.discardText, { color: colors.onSurfaceVariant }]}>{t('recovery_discard')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[recoveryStyles.processBtn, { backgroundColor: colors.primary }]} onPress={handleRecoveryProcess} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
                <Text style={[recoveryStyles.processText, { color: colors.onPrimary }]}>{t('recovery_process')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.marginPage, paddingTop: spacing.stackLg },
  hero: { gap: spacing.stackSm, marginBottom: spacing.sectionGap },
  heroTitle: { ...typography.h1 },
  heroSub: { ...typography.bodyLg },
  grid: { gap: spacing.gutter },
  empty: { alignItems: 'center', paddingTop: spacing.sectionGap, gap: spacing.stackMd },
  emptyTitle: { ...typography.h2, textAlign: 'center' },
  emptySub: { ...typography.bodyMd, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 96, right: spacing.stackLg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 28, paddingVertical: 18, borderRadius: radius.full,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 8,
  },
  fabLabel: { ...typography.button, textTransform: 'uppercase', letterSpacing: 1.5 },
});

const recoveryStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.marginPage, paddingBottom: 40, paddingTop: 12,
    alignItems: 'center', gap: spacing.stackSm,
  },
  handle: { width: 40, height: 4, borderRadius: radius.full, marginBottom: spacing.stackMd },
  iconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { ...typography.h2, textAlign: 'center', marginTop: 4 },
  sub: { ...typography.bodyMd, textAlign: 'center', lineHeight: 22 },
  btns: { flexDirection: 'row', gap: spacing.gutter, marginTop: spacing.stackMd, width: '100%' },
  discardBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  discardText: { ...typography.button, fontSize: 15 },
  processBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  processText: { ...typography.button, fontSize: 15 },
});
