import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Switch,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography, spacing, radius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';

const APP_VERSION = '1.0.0';

interface Props {
  showBack?: boolean;
  onBack?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
}

export default function TopBar({ showBack, onBack, rightIcon, onRightPress }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, language, setLanguage, themeMode, setThemeMode, t, session } = useAppContext();

  const [menuVisible, setMenuVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const menuFade = useRef(new Animated.Value(0)).current;
  const menuSlide = useRef(new Animated.Value(300)).current;
  const profileFade = useRef(new Animated.Value(0)).current;
  const profileSlide = useRef(new Animated.Value(300)).current;

  const openSheet = (fade: Animated.Value, slide: Animated.Value, setVisible: (v: boolean) => void) => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
    ]).start();
  };

  const closeSheet = (fade: Animated.Value, slide: Animated.Value, setVisible: (v: boolean) => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const openMenu = () => openSheet(menuFade, menuSlide, setMenuVisible);
  const closeMenu = () => closeSheet(menuFade, menuSlide, setMenuVisible);
  const openProfile = () => openSheet(profileFade, profileSlide, setProfileVisible);
  const closeProfile = () => closeSheet(profileFade, profileSlide, setProfileVisible);

  const handleSignOut = () => {
    Alert.alert(
      t('profile_signout'),
      t('profile_signout_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('profile_signout'),
          style: 'destructive',
          onPress: async () => {
            closeProfile();
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const user = session?.user;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'U';
  const initials = fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const c = {
    container: { backgroundColor: colors.headerBg, borderBottomColor: isDark ? colors.outlineVariant : '#e5e7eb' },
    logo: { color: colors.primary },
    icon: colors.primary,
    sheet: { backgroundColor: colors.surfaceContainerLow },
    handle: { backgroundColor: colors.outlineVariant },
    sectionLabel: { color: colors.onSurfaceVariant },
    divider: { backgroundColor: isDark ? colors.outlineVariant : '#f0efef' },
    langBtnActive: { backgroundColor: colors.primary },
    langBtnInactive: { backgroundColor: colors.surfaceContainerHighest },
    langTextActive: { color: colors.onPrimary },
    langTextInactive: { color: colors.onSurfaceVariant },
    aboutBox: { backgroundColor: colors.surfaceContainer },
  };

  const Avatar = ({ size = 38 }: { size?: number }) => (
    avatarUrl ? (
      <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryFixed }]}>
        <Text style={[styles.avatarInitials, { color: colors.primary, fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
    )
  );

  return (
    <>
      <View style={[styles.container, c.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={c.icon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconBtn} onPress={openMenu} activeOpacity={0.7}>
              <Ionicons name="menu" size={24} color={c.icon} />
            </TouchableOpacity>
          )}
          <Text style={[styles.logo, c.logo]}>{t('app_name')}</Text>
        </View>
        <View style={styles.right}>
          {rightIcon && (
            <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
              <Ionicons name={rightIcon} size={22} color={c.icon} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={openProfile} activeOpacity={0.8} style={styles.avatarBtn}>
            <Avatar size={38} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hamburger menu */}
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu}>
        <Animated.View style={[menuStyles.overlay, { opacity: menuFade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <Animated.View style={[menuStyles.sheet, c.sheet, { transform: [{ translateY: menuSlide }] }]}>
            <View style={[menuStyles.handle, c.handle]} />

            <Text style={[menuStyles.sectionLabel, c.sectionLabel]}>{t('menu_language').toUpperCase()}</Text>
            <View style={menuStyles.langRow}>
              {(['es', 'en'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[menuStyles.langBtn, language === lang ? c.langBtnActive : c.langBtnInactive]}
                  onPress={() => setLanguage(lang)}
                  activeOpacity={0.8}
                >
                  <Text style={[menuStyles.langBtnText, language === lang ? c.langTextActive : c.langTextInactive]}>
                    {t(lang === 'es' ? 'language_es' : 'language_en')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[menuStyles.divider, c.divider]} />

            <View style={menuStyles.switchRow}>
              <View style={menuStyles.switchLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={colors.primary} />
                <Text style={[menuStyles.switchLabel, { color: colors.onSurface }]}>{t('menu_dark_mode')}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryFixed }}
                thumbColor={isDark ? colors.primary : colors.onSurfaceVariant}
                ios_backgroundColor={colors.surfaceContainerHighest}
              />
            </View>

            <View style={[menuStyles.divider, c.divider]} />

            <Text style={[menuStyles.sectionLabel, c.sectionLabel]}>{t('menu_about').toUpperCase()}</Text>
            <View style={[menuStyles.aboutBox, c.aboutBox]}>
              <Ionicons name="mic-circle" size={36} color={colors.primary} />
              <View style={menuStyles.aboutText}>
                <Text style={[menuStyles.aboutTitle, { color: colors.primary }]}>{t('app_name')}</Text>
                <Text style={[menuStyles.aboutSub, { color: colors.onSurfaceVariant }]}>{t('about_version', { version: APP_VERSION })}</Text>
                <Text style={[menuStyles.aboutSub, { color: colors.onSurfaceVariant }]}>{t('about_tagline')}</Text>
              </View>
            </View>

            <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Profile sheet */}
      <Modal visible={profileVisible} transparent animationType="none" onRequestClose={closeProfile}>
        <Animated.View style={[menuStyles.overlay, { opacity: profileFade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeProfile} />
          <Animated.View style={[menuStyles.sheet, c.sheet, { transform: [{ translateY: profileSlide }] }]}>
            <View style={[menuStyles.handle, c.handle]} />

            {/* Profile hero */}
            <View style={profileStyles.hero}>
              <Avatar size={72} />
              <View style={profileStyles.heroText}>
                <Text style={[profileStyles.name, { color: colors.onSurface }]} numberOfLines={1}>{fullName}</Text>
                <Text style={[profileStyles.email, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{user?.email}</Text>
                <View style={[profileStyles.badge, { backgroundColor: colors.primaryFixed }]}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                  <Text style={[profileStyles.badgeText, { color: colors.primary }]}>{t('profile_verified')}</Text>
                </View>
              </View>
            </View>

            <View style={[menuStyles.divider, c.divider]} />

            {/* Provider */}
            <View style={profileStyles.providerRow}>
              <View style={[profileStyles.providerIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
                <Ionicons
                  name={user?.app_metadata?.provider === 'google' ? 'logo-google' : 'mail-outline'}
                  size={16}
                  color={colors.onSurfaceVariant}
                />
              </View>
              <View>
                <Text style={[profileStyles.providerLabel, { color: colors.onSurfaceVariant }]}>{t('profile_signed_via')}</Text>
                <Text style={[profileStyles.providerValue, { color: colors.onSurface }]}>
                  {user?.app_metadata?.provider === 'google' ? 'Google' : t('profile_email_password')}
                </Text>
              </View>
            </View>

            <View style={[menuStyles.divider, c.divider]} />

            {/* Sign out */}
            <TouchableOpacity style={[profileStyles.signOutBtn, { backgroundColor: colors.errorContainer }]} onPress={handleSignOut} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={20} color={colors.onErrorContainer} />
              <Text style={[profileStyles.signOutText, { color: colors.onErrorContainer }]}>{t('profile_signout')}</Text>
            </TouchableOpacity>

            <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, paddingHorizontal: spacing.marginPage, paddingBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4, borderRadius: 999 },
  logo: { ...typography.h2, lineHeight: 28 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBtn: { borderRadius: 999 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: 'Inter_700Bold' },
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.marginPage, paddingTop: 12, gap: spacing.stackMd },
  handle: { width: 40, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing.stackSm },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, marginBottom: -4 },
  langRow: { flexDirection: 'row', gap: spacing.gutter },
  langBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.xl, alignItems: 'center' },
  langBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  divider: { height: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontFamily: 'Inter_500Medium', fontSize: 16 },
  aboutBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, borderRadius: radius.xl, padding: spacing.stackMd },
  aboutText: { flex: 1, gap: 2 },
  aboutTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  aboutSub: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});

const profileStyles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, paddingVertical: spacing.stackSm },
  heroText: { flex: 1, gap: 4 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  email: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, marginTop: 2 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd },
  providerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  providerLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  providerValue: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: radius.xl },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
