import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { typography, spacing, radius, shadow } from '../theme';
import { getMeetings } from '../services/storage';
import { Meeting } from '../types';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

const ACCEPTED_TYPES = ['audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/x-m4a', 'audio/*'];

export default function ImportAudioScreen() {
  const navigation = useNavigation<any>();
  const { colors, t } = useAppContext();
  const [recentImports, setRecentImports] = useState<Meeting[]>([]);

  useFocusEffect(
    useCallback(() => {
      getMeetings().then((m) => setRecentImports(m.slice(0, 3)));
    }, [])
  );

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;

      let fileDuration: string | undefined;
      try {
        const { sound, status } = await Audio.Sound.createAsync({ uri: asset.uri }, {}, null, false);
        if (status.isLoaded && status.durationMillis) {
          const totalSec = Math.floor(status.durationMillis / 1000);
          const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
          const ss = String(totalSec % 60).padStart(2, '0');
          fileDuration = `${mm}:${ss}`;
        }
        await sound.unloadAsync();
      } catch {
        // duration estimated by AI if unavailable
      }

      navigation.navigate('Processing', { audioUri: asset.uri, recordedDuration: fileDuration });
    } catch {
      Alert.alert(t('error'), t('import_error'));
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.primary }]}>{t('tab_import')}</Text>
          <Text style={[styles.pageSub, { color: colors.onSurfaceVariant }]}>{t('import_desc')}</Text>
        </View>

        <TouchableOpacity style={[styles.dropZone, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={handlePick} activeOpacity={0.85}>
          <View style={[styles.uploadIconBg, { backgroundColor: colors.primaryFixed }]}>
            <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.dropTitle, { color: colors.onSurface }]}>{t('import_pick')}</Text>
          <Text style={[styles.dropSub, { color: colors.onSurfaceVariant }]}>{t('import_supported')}</Text>
          <TouchableOpacity style={[styles.chooseBtn, { backgroundColor: colors.primary }]} onPress={handlePick} activeOpacity={0.85}>
            <Text style={[styles.chooseBtnText, { color: colors.onPrimary }]}>{t('import_pick')}</Text>
          </TouchableOpacity>

          <View style={styles.formatRow}>
            {['WhatsApp', 'M4A', 'MP3', 'WAV'].map((fmt, i) => (
              <View key={fmt} style={styles.formatItem}>
                <Ionicons
                  name={(['chatbubble-outline', 'musical-note-outline', 'disc-outline', 'volume-medium-outline'] as const)[i]}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
                <Text style={[styles.formatLabel, { color: colors.onSurfaceVariant }]}>{fmt}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {recentImports.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={[styles.recentLabel, { color: colors.onSurfaceVariant }]}>{t('import_recent').toUpperCase()}</Text>
            <View style={styles.recentList}>
              {recentImports.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.recentItem, shadow.ambient, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
                  onPress={() => navigation.navigate('MeetingSummary', { meetingId: m.id })}
                  activeOpacity={0.8}
                >
                  <View style={styles.recentLeft}>
                    <View style={[styles.recentIcon, { backgroundColor: colors.secondaryContainer }]}>
                      <Ionicons name="document-text-outline" size={22} color={colors.onSecondaryContainer} />
                    </View>
                    <View>
                      <Text style={[styles.recentTitle, { color: colors.primary }]} numberOfLines={1}>{m.title}</Text>
                      <Text style={[styles.recentMeta, { color: colors.onSurfaceVariant }]}>{m.date} • {m.duration}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.outline} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.marginPage, paddingTop: spacing.stackLg },
  titleSection: { gap: spacing.stackSm, marginBottom: spacing.stackLg },
  pageTitle: { ...typography.h1 },
  pageSub: { ...typography.bodyLg },
  dropZone: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.xl,
    padding: spacing.stackLg, alignItems: 'center', minHeight: 300,
    justifyContent: 'center', gap: spacing.stackMd, ...shadow.ambient,
  },
  uploadIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { ...typography.h2 },
  dropSub: { ...typography.bodyMd, textAlign: 'center', maxWidth: 260 },
  chooseBtn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: radius.lg, ...shadow.card },
  chooseBtnText: { ...typography.button },
  formatRow: { flexDirection: 'row', gap: spacing.stackLg, marginTop: spacing.stackMd, opacity: 0.6 },
  formatItem: { alignItems: 'center', gap: 4 },
  formatLabel: { ...typography.labelCaps, fontSize: 10 },
  recentSection: { marginTop: spacing.sectionGap },
  recentLabel: { ...typography.labelCaps, marginBottom: spacing.stackSm },
  recentList: { gap: spacing.stackSm },
  recentItem: { borderRadius: radius.xl, padding: spacing.stackMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, flex: 1 },
  recentIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  recentTitle: { ...typography.bodyMd, fontFamily: 'Inter_600SemiBold', maxWidth: 220 },
  recentMeta: { ...typography.labelCaps, fontSize: 11, marginTop: 2 },
});
