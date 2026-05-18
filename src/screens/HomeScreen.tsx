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
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { typography, spacing, radius } from '../theme';
import {
  getMeetings, deleteMeeting, toggleMeetingFavorite,
  getActiveRecording, clearActiveRecording, ActiveRecordingData,
  getFolders, saveFolder, deleteFolder, updateMeetingFolder,
} from '../services/storage';
import { Meeting, Folder } from '../types';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import MemoCard from '../components/MemoCard';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

const FAVORITES_FOLDER_ID = '__favorites__';

const FOLDER_COLORS = [
  '#6C63FF', '#3B82F6', '#06B6D4', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6',
  '#F97316', '#14B8A6',
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { colors, t } = useAppContext();
  const insets = useSafeAreaInsets();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recoveryData, setRecoveryData] = useState<ActiveRecordingData | null>(null);
  const recoverySlide = useRef(new Animated.Value(300)).current;
  const recoveryFade = useRef(new Animated.Value(0)).current;

  // Create folder sheet
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const createSlide = useRef(new Animated.Value(300)).current;
  const createFade = useRef(new Animated.Value(0)).current;

  const openSheet = (slide: Animated.Value, fade: Animated.Value) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
    ]).start();
  };

  const closeSheet = (slide: Animated.Value, fade: Animated.Value, cb?: () => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => cb?.());
  };

  const load = useCallback(async () => {
    const [data, folderData] = await Promise.all([getMeetings(), getFolders()]);
    const sorted = [...data].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    setMeetings(sorted);
    setFolders(folderData.sort((a, b) => a.createdAt - b.createdAt));
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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder: Folder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      color: newFolderColor,
      createdAt: Date.now(),
    };
    await saveFolder(folder);
    closeSheet(createSlide, createFade, () => {
      setShowCreateFolder(false);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0]);
      load();
    });
  };

  const handleDeleteFolder = (folder: Folder) => {
    const isEs = t('cancel') === 'Cancelar';
    Alert.alert(
      `${t('folder_delete')} "${folder.name}"`,
      isEs
        ? 'Los memos en esta carpeta quedarán sin carpeta asignada.'
        : 'Memos in this folder will become unassigned.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            await deleteFolder(folder.id);
            if (selectedFolderId === folder.id) setSelectedFolderId(null);
            await load();
          },
        },
      ]
    );
  };

  const handleMoveToFolder = async (meetingId: string, folderId: string | null) => {
    await updateMeetingFolder(meetingId, folderId);
    await load();
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

  const displayedMeetings = selectedFolderId === FAVORITES_FOLDER_ID
    ? meetings.filter(m => m.favorite)
    : selectedFolderId
    ? meetings.filter(m => m.folderId === selectedFolderId)
    : meetings;

  const featured = displayedMeetings[0];
  const rest = displayedMeetings.slice(1);

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

        {/* Folder tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folderTabsContent}
          style={styles.folderTabs}
        >
          {/* "Todos" — always visible */}
          <TouchableOpacity
            style={[
              styles.folderChip,
              {
                backgroundColor: selectedFolderId === null ? colors.primary : colors.surfaceContainerHigh,
                borderColor: selectedFolderId === null ? colors.primary : colors.outlineVariant,
              },
            ]}
            onPress={() => setSelectedFolderId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.folderChipText, { color: selectedFolderId === null ? colors.onPrimary : colors.onSurface }]}>
              {t('folder_all')}
            </Text>
          </TouchableOpacity>

          {/* "Favoritos" — virtual folder, always visible */}
          <TouchableOpacity
            style={[
              styles.folderChip,
              {
                backgroundColor: selectedFolderId === FAVORITES_FOLDER_ID ? '#F59E0B' : colors.surfaceContainerHigh,
                borderColor: selectedFolderId === FAVORITES_FOLDER_ID ? '#F59E0B' : colors.outlineVariant,
              },
            ]}
            onPress={() => setSelectedFolderId(FAVORITES_FOLDER_ID)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedFolderId === FAVORITES_FOLDER_ID ? 'star' : 'star-outline'}
              size={12}
              color={selectedFolderId === FAVORITES_FOLDER_ID ? '#fff' : '#F59E0B'}
            />
            <Text style={[styles.folderChipText, { color: selectedFolderId === FAVORITES_FOLDER_ID ? '#fff' : colors.onSurface }]}>
              {t('folder_favorites')}
            </Text>
          </TouchableOpacity>

          {folders.map(folder => {
            const isActive = selectedFolderId === folder.id;
            return (
              <TouchableOpacity
                key={folder.id}
                style={[
                  styles.folderChip,
                  {
                    backgroundColor: isActive ? folder.color : colors.surfaceContainerHigh,
                    borderColor: isActive ? folder.color : colors.outlineVariant,
                  },
                ]}
                onPress={() => setSelectedFolderId(folder.id)}
                onLongPress={() => handleDeleteFolder(folder)}
                activeOpacity={0.7}
              >
                {!isActive && <View style={[styles.folderDot, { backgroundColor: folder.color }]} />}
                <Text style={[styles.folderChipText, { color: isActive ? '#fff' : colors.onSurface }]}>
                  {folder.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.folderAddChip, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
            onPress={() => {
              createSlide.setValue(300);
              createFade.setValue(0);
              setShowCreateFolder(true);
              openSheet(createSlide, createFade);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </ScrollView>

        {/* Memo list */}
        {displayedMeetings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name={
                selectedFolderId === FAVORITES_FOLDER_ID ? 'star-outline'
                : selectedFolderId ? 'folder-open-outline'
                : 'mic-circle-outline'
              }
              size={72}
              color={selectedFolderId === FAVORITES_FOLDER_ID ? '#F59E0B' : colors.primaryFixed}
            />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              {selectedFolderId === FAVORITES_FOLDER_ID
                ? (t('cancel') === 'Cancelar' ? 'Sin favoritos aún' : 'No favorites yet')
                : selectedFolderId
                ? (t('cancel') === 'Cancelar' ? 'Carpeta vacía' : 'Empty folder')
                : t('empty_title')}
            </Text>
            <Text style={[styles.emptySub, { color: colors.outline }]}>
              {selectedFolderId === FAVORITES_FOLDER_ID
                ? (t('cancel') === 'Cancelar' ? 'Marca memos como favoritos con la estrella desde el menú de tres puntos.' : 'Mark memos as favorites from the three-dot menu.')
                : selectedFolderId
                ? (t('cancel') === 'Cancelar' ? 'Mueve memos aquí desde los tres puntos de cada memo.' : 'Move memos here from the three-dot menu on each memo.')
                : t('empty_sub')}
            </Text>
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
                onMoveToFolder={(folderId) => handleMoveToFolder(featured.id, folderId)}
                folders={folders}
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
                onMoveToFolder={(folderId) => handleMoveToFolder(m.id, folderId)}
                folders={folders}
              />
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: Platform.OS === 'android' ? 96 + insets.bottom : 96,
          },
        ]}
        onPress={() => navigation.navigate('ActiveRecording')}
        activeOpacity={0.85}
      >
        <Ionicons name="mic" size={22} color={colors.onPrimary} />
        <Text style={[styles.fabLabel, { color: colors.onPrimary }]}>{t('record_btn')}</Text>
      </TouchableOpacity>

      <BottomNav />

      {/* Create Folder Sheet */}
      <Modal
        visible={showCreateFolder}
        transparent
        animationType="none"
        onRequestClose={() => closeSheet(createSlide, createFade, () => setShowCreateFolder(false))}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
          <Animated.View style={[sheetStyles.overlay, { opacity: createFade }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => {
              Keyboard.dismiss();
              closeSheet(createSlide, createFade, () => {
                setShowCreateFolder(false);
                setNewFolderName('');
                setNewFolderColor(FOLDER_COLORS[0]);
              });
            }} />
            <Pressable onPress={Keyboard.dismiss}>
          <Animated.View style={[sheetStyles.sheet, { backgroundColor: colors.surfaceContainerLow, transform: [{ translateY: createSlide }] }]}>
            <View style={[sheetStyles.handle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[sheetStyles.sheetTitle, { color: colors.onSurface }]}>{t('folder_new')}</Text>

            <TextInput
              style={[sheetStyles.input, { backgroundColor: colors.surfaceContainerHighest, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder={t('folder_name_placeholder')}
              placeholderTextColor={colors.outline}
              value={newFolderName}
              onChangeText={setNewFolderName}
              maxLength={30}
              autoFocus
            />

            <Text style={[sheetStyles.colorLabel, { color: colors.onSurfaceVariant }]}>{t('folder_color_label')}</Text>
            <View style={sheetStyles.colorGrid}>
              {FOLDER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[sheetStyles.colorDot, { backgroundColor: color }, newFolderColor === color && sheetStyles.colorDotActive]}
                  onPress={() => setNewFolderColor(color)}
                  activeOpacity={0.8}
                >
                  {newFolderColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={sheetStyles.btns}>
              <TouchableOpacity
                style={[sheetStyles.cancelBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                onPress={() => closeSheet(createSlide, createFade, () => {
                  setShowCreateFolder(false);
                  setNewFolderName('');
                  setNewFolderColor(FOLDER_COLORS[0]);
                })}
                activeOpacity={0.8}
              >
                <Text style={[sheetStyles.btnText, { color: colors.onSurfaceVariant }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sheetStyles.saveBtn, { backgroundColor: newFolderName.trim() ? colors.primary : colors.surfaceContainerHighest }]}
                onPress={handleCreateFolder}
                activeOpacity={0.8}
                disabled={!newFolderName.trim()}
              >
                <Text style={[sheetStyles.btnText, { color: newFolderName.trim() ? colors.onPrimary : colors.outline }]}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

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
  hero: { gap: spacing.stackSm, marginBottom: spacing.stackMd },
  heroTitle: { ...typography.h1 },
  heroSub: { ...typography.bodyLg },
  folderTabs: { marginHorizontal: -spacing.marginPage, marginBottom: spacing.stackMd },
  folderTabsContent: { paddingHorizontal: spacing.marginPage, gap: 8, paddingVertical: 4 },
  folderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
  },
  folderDot: { width: 8, height: 8, borderRadius: 4 },
  folderChipText: { ...typography.labelCaps, fontSize: 12 },
  folderAddChip: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  grid: { gap: spacing.gutter },
  empty: { alignItems: 'center', paddingTop: spacing.sectionGap, gap: spacing.stackMd },
  emptyTitle: { ...typography.h2, textAlign: 'center' },
  emptySub: { ...typography.bodyMd, textAlign: 'center' },
  fab: {
    position: 'absolute', right: spacing.stackLg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 28, paddingVertical: 18, borderRadius: radius.full,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 8,
  },
  fabLabel: { ...typography.button, textTransform: 'uppercase', letterSpacing: 1.5 },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.marginPage, paddingBottom: 40, paddingTop: 12,
    gap: spacing.stackMd,
  },
  handle: { width: 40, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing.stackSm },
  sheetTitle: { ...typography.h2 },
  input: {
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    ...typography.bodyMd,
  },
  colorLabel: { ...typography.labelCaps, fontSize: 11 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)', elevation: 4 },
  btns: { flexDirection: 'row', gap: spacing.gutter },
  cancelBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  btnText: { ...typography.button },
  noFolders: { alignItems: 'center', gap: spacing.stackMd, paddingVertical: spacing.stackLg },
  noFoldersText: { ...typography.bodyMd, textAlign: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.full },
  folderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderRadius: radius.lg },
  folderItemDot: { width: 12, height: 12, borderRadius: 6 },
  folderItemText: { ...typography.bodyMd, fontFamily: 'Inter_500Medium', flex: 1 },
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
