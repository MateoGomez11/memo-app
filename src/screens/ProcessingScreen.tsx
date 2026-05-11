import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { typography, spacing, radius } from '../theme';
import { processAudio } from '../services/gemini';
import { saveMeeting, getMeeting, getApiKey } from '../services/storage';
import { Meeting } from '../types';
import { RootStackParamList } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

type ProcessingRoute = RouteProp<RootStackParamList, 'Processing'>;

export default function ProcessingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ProcessingRoute>();
  const { audioUri, title, recordedDuration, meetingId } = route.params;
  const { colors, t } = useAppContext();

  const STEPS = [
    t('processing_step_1'),
    t('processing_step_2'),
    t('processing_step_3'),
    t('processing_step_4'),
    t('processing_step_5'),
  ];

  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    run();
  }, []);

  const run = async () => {
    try {
      const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
      const storedKey = envKey || (await getApiKey());
      if (!storedKey) {
        navigation.replace('ApiKeySetup');
        return;
      }

      const result = await processAudio(audioUri, storedKey, (pct) => {
        setProgress(pct);
      });

      let meeting: Meeting;
      if (meetingId) {
        const existing = await getMeeting(meetingId);
        meeting = {
          id: meetingId,
          title: (title ? existing?.title : undefined) || result.title || (t('cancel') === 'Cancelar' ? 'Memo sin título' : 'Untitled memo'),
          date: existing?.date ?? new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
          duration: existing?.duration || recordedDuration || result.duration,
          audioUri: existing?.audioUri ?? audioUri,
          createdAt: existing?.createdAt ?? Date.now(),
          favorite: existing?.favorite,
          category: result.category,
          tldr: result.tldr,
          keyPoints: result.keyPoints,
          actionItems: result.actionItems,
          pendingDates: result.pendingDates ?? [],
          transcript: result.transcript,
          confidenceScore: result.confidenceScore,
          keyTheme: result.keyTheme,
          attendees: result.attendees,
          processed: true,
        };
      } else {
        meeting = {
          id: `meeting_${Date.now()}`,
          title: result.title || title || (t('cancel') === 'Cancelar' ? 'Reunión sin título' : 'Untitled meeting'),
          date: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
          duration: recordedDuration || result.duration,
          category: result.category,
          tldr: result.tldr,
          keyPoints: result.keyPoints,
          actionItems: result.actionItems,
          pendingDates: result.pendingDates ?? [],
          transcript: result.transcript,
          audioUri,
          confidenceScore: result.confidenceScore,
          keyTheme: result.keyTheme,
          attendees: result.attendees,
          createdAt: Date.now(),
          processed: true,
        };
      }

      await saveMeeting(meeting);
      navigation.replace('MeetingSummary', { meetingId: meeting.id });
    } catch (e: any) {
      setError(e?.message ?? t('processing_error_default'));
    }
  };

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface }]}>
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.error }]}>{t('processing_error_title')}</Text>
          <Text style={[styles.errorMsg, { color: colors.onSurfaceVariant }]}>{error}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.gutter, marginTop: spacing.stackLg }}>
            <View style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
              <Text
                style={[styles.retryText, { color: colors.onPrimary }]}
                onPress={() => { setError(null); setProgress(0); run(); }}
              >
                {t('retry')}
              </Text>
            </View>
            <View style={[styles.backBtn, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.backText, { color: colors.onSurfaceVariant }]} onPress={() => navigation.goBack()}>
                {t('back')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.bgGradient, { pointerEvents: 'none', backgroundColor: colors.primaryFixed }]} />

      <View style={styles.content}>
        <View style={[styles.iconRing, { borderColor: colors.primaryFixed }]}>
          <View style={[styles.iconInner, { backgroundColor: colors.primaryFixed }]}>
            <Ionicons name="sparkles" size={36} color={colors.primary} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.primary }]}>{t('processing_title')}</Text>
        <Text style={[styles.step, { color: colors.onSurfaceVariant }]}>{STEPS[stepIdx]}</Text>

        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Animated.View
            style={[
              styles.progressBar,
              { backgroundColor: colors.primary },
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.pct, { color: colors.onSurfaceVariant }]}>{Math.round(progress)}%</Text>

        <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>{t('processing_hint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.08 },
  content: { alignItems: 'center', paddingHorizontal: spacing.marginPage, gap: spacing.stackMd },
  iconRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.stackMd },
  iconInner: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, textAlign: 'center' },
  step: { ...typography.bodyLg, textAlign: 'center' },
  progressTrack: { width: '100%', maxWidth: 320, height: 8, borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.stackSm },
  progressBar: { height: '100%', borderRadius: radius.full },
  pct: { ...typography.labelCaps },
  hint: { ...typography.bodyMd, textAlign: 'center', fontStyle: 'italic', marginTop: spacing.stackSm },
  errorBox: { alignItems: 'center', paddingHorizontal: spacing.stackLg, gap: spacing.stackMd },
  errorTitle: { ...typography.h2 },
  errorMsg: { ...typography.bodyMd, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.lg },
  retryText: { ...typography.button },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.lg },
  backText: { ...typography.button },
});
