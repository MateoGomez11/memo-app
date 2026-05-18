import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
} from 'react-native';
import { Meeting, Folder } from '../types';
import { lightColors, typography, spacing, radius, shadow } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../context/AppContext';

interface Props {
  meeting: Meeting;
  onPress: () => void;
  featured?: boolean;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onProcess?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  folders?: Folder[];
}

const AI_COLORS = ['#6C63FF', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6C63FF'] as const;

function AiButton({ onPress, label, colors }: { onPress?: () => void; label: string; colors: typeof lightColors }) {
  return (
    <LinearGradient colors={AI_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={aiStyles.gradient}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[aiStyles.inner, { backgroundColor: colors.surfaceContainerLowest }]}>
        <Ionicons name="sparkles" size={13} color="#6C63FF" />
        <Text style={[aiStyles.label, { color: colors.primary }]}>{label}</Text>
        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function ContextMenu({
  visible,
  meeting,
  onClose,
  onToggleFavorite,
  onDelete,
  onMoveToFolder,
  folders,
}: {
  visible: boolean;
  meeting: Meeting;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  folders?: Folder[];
}) {
  const { colors, t } = useAppContext();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setConfirmDelete(false);
      setShowFolderPicker(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleFavorite = () => { onToggleFavorite?.(); onClose(); };
  const handleDeleteConfirm = () => { onDelete?.(); onClose(); };
  const isEs = t('cancel') === 'Cancelar';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[menuStyles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[menuStyles.sheet, { backgroundColor: colors.surfaceContainerLow, transform: [{ translateY: slideAnim }] }]}>
          <View style={[menuStyles.handle, { backgroundColor: colors.outlineVariant }]} />

          {/* ── Folder Picker View ── */}
          {showFolderPicker ? (
            <>
              <TouchableOpacity style={menuStyles.backRow} onPress={() => setShowFolderPicker(false)} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
                <Text style={[menuStyles.sheetTitle, { color: colors.onSurface, marginBottom: 0 }]}>{t('folder_move')}</Text>
              </TouchableOpacity>
              <View style={[menuStyles.divider, { backgroundColor: colors.surfaceContainerHighest }]} />

              {!folders || folders.length === 0 ? (
                <View style={menuStyles.noFolders}>
                  <Ionicons name="folder-outline" size={36} color={colors.outline} />
                  <Text style={[menuStyles.noFoldersText, { color: colors.onSurfaceVariant }]}>
                    {t('folder_no_folders')}
                  </Text>
                </View>
              ) : (
                <>
                  {folders.map(folder => {
                    const isCurrent = meeting.folderId === folder.id;
                    return (
                      <TouchableOpacity
                        key={folder.id}
                        style={[menuStyles.folderItem, isCurrent && { backgroundColor: colors.surfaceContainerHigh }]}
                        onPress={() => { onMoveToFolder?.(folder.id); onClose(); }}
                        activeOpacity={0.7}
                      >
                        <View style={[menuStyles.folderDot, { backgroundColor: folder.color }]} />
                        <Text style={[menuStyles.itemLabel, { color: colors.onSurface, flex: 1 }]}>{folder.name}</Text>
                        {isCurrent && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                  {meeting.folderId && (
                    <TouchableOpacity
                      style={menuStyles.folderItem}
                      onPress={() => { onMoveToFolder?.(null); onClose(); }}
                      activeOpacity={0.7}
                    >
                      <View style={[menuStyles.folderDot, { backgroundColor: colors.outline }]} />
                      <Text style={[menuStyles.itemLabel, { color: colors.onSurfaceVariant, flex: 1 }]}>
                        {t('folder_remove_from')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity style={[menuStyles.closeBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={[menuStyles.closeBtnText, { color: colors.onSurfaceVariant }]}>{t('cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : confirmDelete ? (
            /* ── Delete Confirm View ── */
            <View style={menuStyles.confirmBox}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
              <Text style={[menuStyles.confirmTitle, { color: colors.onSurface }]}>
                {isEs ? '¿Eliminar este memo?' : 'Delete this memo?'}
              </Text>
              <Text style={[menuStyles.confirmSub, { color: colors.onSurfaceVariant }]}>
                {t('delete_memo_confirm')}
              </Text>
              <View style={menuStyles.confirmBtns}>
                <TouchableOpacity style={[menuStyles.cancelBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => setConfirmDelete(false)} activeOpacity={0.8}>
                  <Text style={[menuStyles.cancelBtnText, { color: colors.onSurfaceVariant }]}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[menuStyles.deleteBtn, { backgroundColor: colors.error }]} onPress={handleDeleteConfirm} activeOpacity={0.8}>
                  <Text style={[menuStyles.deleteBtnText, { color: colors.onError }]}>{t('delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Main Menu View ── */
            <>
              <Text style={[menuStyles.sheetTitle, { color: colors.onSurface }]} numberOfLines={2}>{meeting.title}</Text>
              <View style={[menuStyles.divider, { backgroundColor: colors.surfaceContainerHighest }]} />

              <TouchableOpacity style={menuStyles.item} onPress={handleFavorite} activeOpacity={0.7}>
                <View style={[menuStyles.itemIcon, { backgroundColor: colors.primaryFixed }]}>
                  <Ionicons name={meeting.favorite ? 'star' : 'star-outline'} size={20} color={colors.primary} />
                </View>
                <Text style={[menuStyles.itemLabel, { color: colors.onSurface }]}>
                  {meeting.favorite
                    ? (isEs ? 'Quitar de favoritos' : 'Remove from favorites')
                    : (isEs ? 'Marcar como favorito' : 'Mark as favorite')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={menuStyles.item} onPress={() => setShowFolderPicker(true)} activeOpacity={0.7}>
                <View style={[menuStyles.itemIcon, { backgroundColor: colors.secondaryContainer }]}>
                  <Ionicons name="folder-outline" size={20} color={colors.secondary} />
                </View>
                <Text style={[menuStyles.itemLabel, { color: colors.onSurface }]}>{t('folder_move')}</Text>
                {meeting.folderId && folders?.find(f => f.id === meeting.folderId) && (
                  <View style={[menuStyles.folderBadge, { backgroundColor: folders.find(f => f.id === meeting.folderId)!.color }]}>
                    <Text style={menuStyles.folderBadgeText} numberOfLines={1}>
                      {folders.find(f => f.id === meeting.folderId)!.name}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={menuStyles.item} onPress={() => setConfirmDelete(true)} activeOpacity={0.7}>
                <View style={[menuStyles.itemIcon, { backgroundColor: colors.errorContainer }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </View>
                <Text style={[menuStyles.itemLabel, { color: colors.error }]}>
                  {t('delete_memo_title')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[menuStyles.closeBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={[menuStyles.closeBtnText, { color: colors.onSurfaceVariant }]}>{t('cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function MemoCard({ meeting, onPress, featured, onDelete, onToggleFavorite, onProcess, onMoveToFolder, folders }: Props) {
  const { colors, t } = useAppContext();
  const needsProcessing = meeting.processed === false;
  const [menuVisible, setMenuVisible] = useState(false);

  const categoryColors = {
    Work:     { bg: colors.primaryContainer,   text: colors.onPrimaryContainer,   label: t('cat_work') },
    Personal: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer, label: t('cat_personal') },
    Draft:    { bg: colors.tertiaryFixed,       text: colors.onTertiaryFixedVariant, label: t('cat_draft') },
  };
  const cat = categoryColors[meeting.category as keyof typeof categoryColors] ?? categoryColors.Work;
  const cardBg = colors.surfaceContainerLow;
  const borderColor = colors.outlineVariant;

  if (featured) {
    return (
      <>
        <TouchableOpacity style={[styles.featured, shadow.ambient, { backgroundColor: cardBg, borderColor }]} onPress={onPress} activeOpacity={0.8}>
          <View style={styles.featuredTop}>
            <View style={styles.featuredLeft}>
              <View style={styles.tagRow}>
                <View style={[styles.tag, { backgroundColor: cat.bg }]}>
                  <Text style={[styles.tagText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                {meeting.favorite && <Ionicons name="star" size={14} color={colors.primary} />}
              </View>
              <Text style={[styles.featuredTitle, { color: colors.onSurface }]} numberOfLines={2}>{meeting.title}</Text>
            </View>
            <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.outline} />
            </TouchableOpacity>
          </View>

          <View style={styles.waveformRow}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={[styles.waveBar, { height: [12,24,32,16,40,48,28,36,16,44,32,20,40,28,36,12,40,48,24,32][i], backgroundColor: colors.primary }]} />
            ))}
          </View>

          {needsProcessing && <AiButton onPress={onProcess} label={t('process_ai')} colors={colors} />}

          <View style={[styles.featuredFooter, { borderTopColor: colors.outlineVariant }]}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.outline} />
              <Text style={[styles.metaText, { color: colors.outline }]}>{meeting.date}</Text>
              <Ionicons name="time-outline" size={16} color={colors.outline} style={{ marginLeft: 8 }} />
              <Text style={[styles.metaText, { color: colors.outline }]}>{meeting.duration}</Text>
            </View>
            <TouchableOpacity style={styles.reviewBtn} onPress={onPress}>
              <Text style={[styles.reviewText, { color: colors.primary }]}>
                {t('cancel') === 'Cancelar' ? 'Ver' : 'View'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <ContextMenu
          visible={menuVisible}
          meeting={meeting}
          onClose={() => setMenuVisible(false)}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
          onMoveToFolder={onMoveToFolder}
          folders={folders}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity style={[styles.card, shadow.ambient, { backgroundColor: cardBg, borderColor }]} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.cardTop}>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: cat.bg }]}>
              <Text style={[styles.tagText, { color: cat.text }]}>{cat.label}</Text>
            </View>
            {meeting.favorite && <Ionicons name="star" size={13} color={colors.primary} />}
          </View>
          <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.outline} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={2}>{meeting.title}</Text>
        {needsProcessing
          ? <AiButton onPress={onProcess} label={t('process_ai')} colors={colors} />
          : <Text style={[styles.cardSnippet, { color: colors.outline }]} numberOfLines={2}>{meeting.tldr}</Text>
        }
        <View style={styles.cardFooter}>
          <Text style={[styles.cardDate, { color: colors.outline }]}>{meeting.date}</Text>
          <Text style={[styles.cardDuration, { color: colors.onSurface }]}>{meeting.duration}</Text>
        </View>
      </TouchableOpacity>

      <ContextMenu
        visible={menuVisible}
        meeting={meeting}
        onClose={() => setMenuVisible(false)}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onMoveToFolder={onMoveToFolder}
        folders={folders}
      />
    </>
  );
}

const aiStyles = StyleSheet.create({
  gradient: { alignSelf: 'flex-start', borderRadius: radius.full, padding: 2, marginTop: spacing.stackMd },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  label: { ...typography.labelCaps, fontSize: 11 },
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.marginPage, paddingBottom: 36, paddingTop: 12, gap: spacing.stackSm },
  handle: { width: 40, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing.stackMd },
  sheetTitle: { ...typography.bodyLg, fontFamily: 'Inter_600SemiBold', marginBottom: spacing.stackSm },
  divider: { height: 1, marginBottom: spacing.stackSm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, marginBottom: spacing.stackSm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, paddingVertical: 14, paddingHorizontal: 4, borderRadius: radius.lg },
  itemIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { ...typography.bodyMd, fontFamily: 'Inter_500Medium' },
  folderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderRadius: radius.lg },
  folderDot: { width: 12, height: 12, borderRadius: 6 },
  folderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, maxWidth: 100 },
  folderBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#fff' },
  noFolders: { alignItems: 'center', gap: spacing.stackSm, paddingVertical: spacing.stackLg },
  noFoldersText: { ...typography.bodyMd, textAlign: 'center' },
  closeBtn: { marginTop: spacing.stackSm, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  closeBtnText: { ...typography.button },
  confirmBox: { alignItems: 'center', gap: spacing.stackSm, paddingVertical: spacing.stackMd },
  confirmTitle: { ...typography.bodyLg, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  confirmSub: { ...typography.bodyMd, textAlign: 'center' },
  confirmBtns: { flexDirection: 'row', gap: spacing.gutter, marginTop: spacing.stackMd, width: '100%' },
  cancelBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { ...typography.button },
  deleteBtn: { flex: 1, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  deleteBtnText: { ...typography.button },
});

const styles = StyleSheet.create({
  featured: { borderRadius: radius.xl, padding: spacing.stackLg, borderWidth: 1, minHeight: 220, justifyContent: 'space-between' },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  featuredLeft: { flex: 1, gap: 6 },
  featuredTitle: { ...typography.h2, marginTop: 4 },
  waveformRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48, opacity: 0.35, marginVertical: spacing.stackMd },
  waveBar: { width: 4, borderRadius: 2 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: spacing.stackMd },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.bodyMd, fontSize: 14 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewText: { ...typography.button, fontSize: 15 },
  card: { borderRadius: radius.xl, padding: spacing.stackLg, borderWidth: 1, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...typography.bodyLg, fontFamily: 'Inter_600SemiBold', marginTop: spacing.stackMd },
  cardSnippet: { ...typography.bodyMd, marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.stackLg },
  cardDate: { ...typography.bodyMd, fontSize: 13 },
  cardDuration: { ...typography.bodyMd, fontFamily: 'Inter_500Medium', fontSize: 13 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.md, alignSelf: 'flex-start' },
  tagText: { ...typography.labelCaps, fontSize: 11 },
});
