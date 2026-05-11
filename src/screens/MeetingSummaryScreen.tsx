import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, spacing, radius, shadow } from '../theme';
import { getMeeting, updateActionItem, deleteMeeting, updateMeetingTitle } from '../services/storage';
import { Meeting, RootStackParamList } from '../types';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

type SummaryRoute = RouteProp<RootStackParamList, 'MeetingSummary'>;

const AI_COLORS = ['#6C63FF', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6C63FF'] as const;

export default function MeetingSummaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<SummaryRoute>();
  const { meetingId } = route.params;
  const { colors, t } = useAppContext();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<TextInput>(null);

  const categoryColors = {
    Work:     { bg: colors.primaryFixed,       text: colors.onPrimaryFixed,         label: t('cat_work') },
    Personal: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer,   label: t('cat_personal') },
    Draft:    { bg: colors.tertiaryFixed,      text: colors.onTertiaryFixedVariant, label: t('cat_draft') },
  };

  useEffect(() => {
    getMeeting(meetingId).then((m) => {
      if (!m) { navigation.goBack(); return; }
      setMeeting(m);
      setEditedTitle(m.title);
    });
  }, [meetingId]);

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (!meeting || !editedTitle.trim() || editedTitle.trim() === meeting.title) return;
    await updateMeetingTitle(meeting.id, editedTitle.trim());
    setMeeting((prev) => prev ? { ...prev, title: editedTitle.trim() } : prev);
  };

  const handleToggleAction = async (actionId: string, done: boolean) => {
    if (!meeting) return;
    await updateActionItem(meeting.id, actionId, done);
    setMeeting((prev) =>
      prev ? { ...prev, actionItems: prev.actionItems.map((ai) => ai.id === actionId ? { ...ai, done } : ai) } : prev
    );
  };

  const handleShare = async () => {
    if (!meeting) return;
    const text = [
      `# ${meeting.title}`,
      `${meeting.date} • ${meeting.duration}`,
      '',
      `${t('share_text_summary')}${meeting.tldr}`,
      '',
      `${t('share_text_keypoints')}${meeting.keyPoints.map((p) => `• ${p}`).join('\n')}`,
      '',
      `${t('share_text_tasks')}${meeting.actionItems.map((a) => `☐ ${a.text}${a.assignee ? ` (${a.assignee})` : ''}`).join('\n')}`,
      '',
      `${t('share_text_transcript')}${meeting.transcript}`,
    ].join('\n');
    await Share.share({ message: text, title: meeting.title });
  };

  const handleShareAudio = async () => {
    if (!meeting?.audioUri) { Alert.alert(t('no_audio'), t('no_audio_msg')); return; }
    await Sharing.shareAsync(meeting.audioUri, { mimeType: 'audio/mp4', dialogTitle: t('share') });
  };

  const handleProcess = () => {
    if (!meeting?.audioUri) {
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

  const handleDelete = () => {
    Alert.alert(t('delete_memo_title'), t('delete_memo_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { await deleteMeeting(meetingId); navigation.navigate('Home'); } },
    ]);
  };

  if (!meeting) return null;

  const needsProcessing = meeting.processed === false;
  const cat = categoryColors[meeting.category as keyof typeof categoryColors] ?? categoryColors.Work;
  const confidence = meeting.confidenceScore ?? 100;
  const showQualityWarning = confidence < 70;
  const hasPendingDates = (meeting.pendingDates ?? []).length > 0;
  const timeStr = new Date(meeting.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const transcriptLines = (meeting.transcript ?? '').split('\n').filter(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopBar showBack onBack={() => navigation.goBack()} rightIcon="trash-outline" onRightPress={handleDelete} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header meta */}
        <View style={styles.headerMeta}>
          <View style={[styles.tag, { backgroundColor: cat.bg }]}>
            <Text style={[styles.tagText, { color: cat.text }]}>{cat.label}</Text>
          </View>
          <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>{meeting.date.toUpperCase()} {timeStr} • {meeting.duration}</Text>
        </View>

        {/* Editable title */}
        <TouchableOpacity onPress={() => { setIsEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }} activeOpacity={0.8}>
          {isEditingTitle ? (
            <TextInput
              ref={titleInputRef}
              style={[styles.pageTitleInput, { color: colors.primary, borderBottomColor: colors.primary }]}
              value={editedTitle}
              onChangeText={setEditedTitle}
              onBlur={handleTitleBlur}
              multiline
              autoFocus
            />
          ) : (
            <View style={styles.titleRow}>
              <Text style={[styles.pageTitle, { color: colors.primary }]}>{meeting.title}</Text>
              <Ionicons name="pencil-outline" size={18} color={colors.outline} style={{ marginTop: 6 }} />
            </View>
          )}
        </TouchableOpacity>

        {/* Unprocessed — AI card */}
        {needsProcessing && (
          <View style={[styles.aiCardGradient, { borderColor: colors.primaryFixedDim }]}>
            <View style={[styles.aiCard, { backgroundColor: colors.surfaceContainerLow }]}>
              <View style={styles.aiCardTop}>
                <Ionicons name="sparkles" size={18} color="#6C63FF" />
                <Text style={[styles.aiCardTitle, { color: colors.onSurface }]}>{t('unprocessed_title')}</Text>
              </View>
              <Text style={[styles.aiCardBody, { color: colors.onSurfaceVariant }]}>
                {t('unprocessed_body')}
              </Text>
              <LinearGradient colors={AI_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiProcessBtnGradient}>
                <TouchableOpacity style={[styles.aiProcessBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={handleProcess} activeOpacity={0.85}>
                  <Ionicons name="sparkles" size={15} color="#6C63FF" />
                  <Text style={[styles.aiProcessBtnText, { color: colors.onSurface }]}>{t('process_ai')}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Attendees */}
        {!needsProcessing && !!meeting.attendees && (
          <View style={styles.attendeesRow}>
            <Ionicons name="people-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={[styles.attendeesText, { color: colors.onSurfaceVariant }]}>{meeting.attendees}</Text>
          </View>
        )}

        {/* Key Theme */}
        {!needsProcessing && !!meeting.keyTheme && (
          <View style={[styles.themeCard, { backgroundColor: colors.primary }]}>
            <View style={styles.themeIconBg}>
              <Ionicons name="bulb-outline" size={22} color={colors.onPrimary} />
            </View>
            <View style={styles.themeTextBlock}>
              <Text style={styles.themeLabel}>{t('theme_label')}</Text>
              <Text style={[styles.themeValue, { color: colors.onPrimary }]}>{meeting.keyTheme}</Text>
            </View>
          </View>
        )}

        {/* Quality warning */}
        {!needsProcessing && showQualityWarning && (
          <View style={[styles.qualityWarning, { backgroundColor: colors.errorContainer }]}>
            <Ionicons name="warning-outline" size={18} color={colors.error} />
            <Text style={[styles.qualityWarningText, { color: colors.onErrorContainer }]}>
              {t('quality_warning')}
            </Text>
          </View>
        )}

        {/* TL;DR */}
        {!needsProcessing && (
          <View style={[styles.card, shadow.ambient, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={20} color={colors.primaryContainer} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('section_summary')}</Text>
            </View>
            <Text style={[styles.tldrText, { color: colors.onSurface }]}>{meeting.tldr}</Text>
          </View>
        )}

        {/* Key Points */}
        {!needsProcessing && (
          <View style={styles.keyPointsSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={20} color={colors.primaryContainer} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('section_key_points')}</Text>
            </View>
            <View style={styles.keyPointsList}>
              {meeting.keyPoints.map((pt, i) => (
                <View key={i} style={styles.keyPointRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.primaryContainer }]} />
                  <Text style={[styles.keyPointText, { color: colors.onSurface }]}>{pt}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Items */}
        {!needsProcessing && meeting.actionItems.length > 0 && (
          <View style={[styles.card, shadow.ambient, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primaryContainer} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('section_tasks')}</Text>
            </View>
            <View style={styles.actionList}>
              {meeting.actionItems.map((ai) => (
                <TouchableOpacity key={ai.id} style={styles.actionItem} onPress={() => handleToggleAction(ai.id, !ai.done)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, { borderColor: colors.outlineVariant }, ai.done && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {ai.done && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionText, { color: colors.onSurface }, ai.done && styles.actionTextDone]}>{ai.text}</Text>
                    {(ai.assignee || ai.dueDate) && (
                      <Text style={[styles.actionMeta, { color: colors.onSurfaceVariant }]}>{[ai.assignee, ai.dueDate].filter(Boolean).join(' • ')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Pending Dates */}
        {!needsProcessing && hasPendingDates && (
          <View style={[styles.card, shadow.ambient, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={20} color={colors.primaryContainer} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('section_dates')}</Text>
            </View>
            <View style={styles.actionList}>
              {(meeting.pendingDates ?? []).map((pd, i) => (
                <View key={i} style={styles.pendingDateRow}>
                  <View style={[styles.pendingDateIcon, { backgroundColor: colors.primaryFixed }]}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.pendingDateContent}>
                    <Text style={[styles.pendingDateDesc, { color: colors.onSurface }]}>{pd.description}</Text>
                    <Text style={[styles.pendingDateValue, { color: colors.primary }]}>{pd.date}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Full Transcript */}
        {!needsProcessing && (
          <TouchableOpacity
            style={[styles.card, shadow.ambient, styles.transcriptHeader, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
            onPress={() => setTranscriptOpen((o) => !o)}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.primaryContainer} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('section_transcript')}</Text>
            </View>
            <Ionicons name={transcriptOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.outline} />
          </TouchableOpacity>
        )}

        {!needsProcessing && transcriptOpen && (
          <View style={[styles.transcriptBody, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            {transcriptLines.length > 0 ? transcriptLines.map((line, i) => {
              const match = line.match(/^([^\[]+)\[(\d+:\d+)\]:\s*(.+)$/);
              if (match) {
                return (
                  <View key={i} style={[styles.transcriptBlock, { borderBottomColor: colors.outlineVariant }]}>
                    <View style={styles.transcriptMeta}>
                      <Text style={[styles.transcriptSpeaker, { color: colors.primary }]}>{match[1].trim()}</Text>
                      <Text style={[styles.transcriptTime, { color: colors.outline }]}>[{match[2]}]</Text>
                    </View>
                    <Text style={[styles.transcriptLine, { color: colors.onSurface }]}>{match[3]}</Text>
                  </View>
                );
              }
              return <Text key={i} style={[styles.transcriptLine, { color: colors.onSurface }]}>{line}</Text>;
            }) : (
              <Text style={[styles.transcriptEmpty, { color: colors.outline }]}>{t('transcript_empty')}</Text>
            )}
          </View>
        )}

        {/* Buttons row */}
        <View style={styles.btnRow}>
          {!needsProcessing && (
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn, { backgroundColor: colors.primaryContainer }]} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={18} color={colors.onPrimaryContainer} />
              <Text style={[styles.shareBtnText, { color: colors.onPrimaryContainer }]}>{t('share_summary')}</Text>
            </TouchableOpacity>
          )}
          {!!meeting.audioUri && (
            <TouchableOpacity style={[styles.actionBtn, styles.audioBtn, { backgroundColor: colors.surfaceContainer }]} onPress={handleShareAudio} activeOpacity={0.85}>
              <Ionicons name="musical-note-outline" size={18} color={colors.onSurfaceVariant} />
              <Text style={[styles.audioBtnText, { color: colors.onSurfaceVariant }]}>Memo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.marginPage, paddingTop: spacing.stackLg, gap: spacing.stackLg },

  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  tagText: { ...typography.labelCaps, fontSize: 11 },
  metaText: { ...typography.labelCaps, fontSize: 11 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pageTitle: { ...typography.h1, flex: 1 },
  pageTitleInput: { ...typography.h1, borderBottomWidth: 2, paddingVertical: 4, paddingHorizontal: 0 },

  attendeesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendeesText: { ...typography.bodyMd },

  themeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd,
    borderRadius: radius.xl, paddingVertical: spacing.stackMd + 4, paddingHorizontal: spacing.stackLg,
  },
  themeIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  themeTextBlock: { flex: 1, gap: 4 },
  themeLabel: { ...typography.labelCaps, color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  themeValue: { fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 28 },

  qualityWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  qualityWarningText: { ...typography.bodyMd, fontSize: 14, flex: 1 },

  card: { borderRadius: radius.xl, padding: spacing.stackLg, borderWidth: 1, gap: spacing.stackMd },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { ...typography.h2, fontSize: 20 },

  tldrText: { ...typography.bodyLg, fontStyle: 'italic', lineHeight: 28 },

  keyPointsSection: { gap: spacing.stackMd },
  keyPointsList: { gap: spacing.stackMd },
  keyPointRow: { flexDirection: 'row', gap: spacing.stackMd, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  keyPointText: { ...typography.bodyMd, flex: 1 },

  actionList: { gap: spacing.stackMd },
  actionItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  actionContent: { flex: 1, gap: 2 },
  actionText: { ...typography.bodyMd },
  actionTextDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  actionMeta: { ...typography.labelCaps, fontSize: 11 },

  pendingDateRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pendingDateIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pendingDateContent: { flex: 1, gap: 2 },
  pendingDateDesc: { ...typography.bodyMd, fontFamily: 'Inter_500Medium' },
  pendingDateValue: { ...typography.labelCaps, fontSize: 12 },

  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.stackMd },
  transcriptBody: { borderRadius: radius.xl, padding: spacing.stackLg, borderWidth: 1, gap: spacing.stackMd },
  transcriptBlock: { gap: 4, paddingBottom: spacing.stackSm, borderBottomWidth: 1 },
  transcriptMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transcriptSpeaker: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  transcriptTime: { ...typography.labelCaps, fontSize: 11 },
  transcriptLine: { ...typography.bodyMd, lineHeight: 24 },
  transcriptEmpty: { ...typography.bodyMd, fontStyle: 'italic' },

  btnRow: { flexDirection: 'row', gap: spacing.gutter },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg },
  shareBtn: { flex: 1 },
  shareBtnText: { ...typography.button, fontSize: 15 },
  audioBtn: { paddingHorizontal: 20 },
  audioBtnText: { ...typography.button, fontSize: 15 },

  aiCardGradient: { borderRadius: radius.xl, borderWidth: 1.5 },
  aiCard: { borderRadius: radius.xl, padding: spacing.stackLg, gap: spacing.stackMd },
  aiCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiCardTitle: { ...typography.bodyMd, fontFamily: 'Inter_600SemiBold' },
  aiCardBody: { ...typography.bodyMd, lineHeight: 22 },
  aiProcessBtnGradient: { borderRadius: radius.xl, marginTop: spacing.stackSm, padding: 2 },
  aiProcessBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.xl - 2, paddingVertical: 14 },
  aiProcessBtnText: { ...typography.button, fontSize: 16 },
});
