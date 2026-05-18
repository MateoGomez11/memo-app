import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, t } = useAppContext();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoadingGoogle(true);
      setError('');
      const redirectTo = makeRedirectUri();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No auth URL');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const hashParams = new URLSearchParams(url.hash.replace('#', ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        }
      }
    } catch (e: any) {
      setError(e.message || t('login_error'));
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setError(t('login_fields_required')); return; }
    if (mode === 'register' && !fullName.trim()) { setError(t('login_name_required')); return; }
    try {
      setLoadingEmail(true);
      setError('');
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        setError(t('login_check_email'));
      }
    } catch (e: any) {
      setError(e.message || t('login_error'));
    } finally {
      setLoadingEmail(false);
    }
  };

  // Dark mode uses dark green header, light uses brand green
  const heroColor = isDark ? '#0d1f18' : colors.primary;
  const cardBg = isDark ? colors.surfaceContainerLow : '#ffffff';
  const inputBg = isDark ? colors.surfaceContainerHigh : '#f7f8f7';
  const isSuccess = error === t('login_check_email');

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: heroColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — colored top */}
        <View style={[styles.hero, { paddingTop: insets.top + 32 }]}>
          {/* Decorative circles */}
          <View style={[styles.circle1, { borderColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.circle2, { borderColor: 'rgba(255,255,255,0.06)' }]} />

          <View style={styles.logoWrap}>
            <View style={[styles.logoIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Ionicons name="mic" size={32} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.heroTitle}>{t('app_name')}</Text>
          <Text style={styles.heroSub}>{t('about_tagline')}</Text>

          {/* Feature pills */}
          <View style={styles.pillsRow}>
            {[t('login_feat_1'), t('login_feat_2'), t('login_feat_3')].map((feat) => (
              <View key={feat} style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.pillText}>{feat}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {mode === 'login' ? t('login_welcome_back') : t('login_create_account')}
          </Text>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: colors.outlineVariant, backgroundColor: inputBg }]}
            onPress={handleGoogleLogin}
            activeOpacity={0.85}
            disabled={loadingGoogle || loadingEmail}
          >
            {loadingGoogle ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={[styles.googleText, { color: colors.onSurface }]}>{t('login_google')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divRow}>
            <View style={[styles.divLine, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.divText, { color: colors.onSurfaceVariant }]}>{t('login_or_email')}</Text>
            <View style={[styles.divLine, { backgroundColor: colors.outlineVariant }]} />
          </View>

          {/* Nombre — solo en registro */}
          {mode === 'register' && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('login_name_label').toUpperCase()}</Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder={t('login_name_placeholder')}
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setError(''); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('login_email_label').toUpperCase()}</Text>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: colors.outlineVariant }]}>
              <TextInput
                style={[styles.input, { color: colors.onSurface }]}
                placeholder={t('login_email_placeholder')}
                placeholderTextColor={colors.onSurfaceVariant}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('login_password_label').toUpperCase()}</Text>
              {mode === 'login' && (
                <Text style={[styles.forgot, { color: colors.primary }]}>{t('login_forgot')}</Text>
              )}
            </View>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: colors.outlineVariant }]}>
              <TextInput
                style={[styles.input, { color: colors.onSurface }]}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceVariant}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          </View>

          {/* Feedback */}
          {error ? (
            <View style={[styles.feedbackBox, { backgroundColor: isSuccess ? colors.primaryFixed : colors.errorContainer }]}>
              <Ionicons name={isSuccess ? 'mail-outline' : 'alert-circle-outline'} size={15} color={isSuccess ? colors.primary : colors.onErrorContainer} />
              <Text style={[styles.feedbackText, { color: isSuccess ? colors.primary : colors.onErrorContainer }]}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleEmailAuth}
            activeOpacity={0.88}
            disabled={loadingEmail || loadingGoogle}
          >
            {loadingEmail ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitText, { color: colors.onPrimary }]}>
                {mode === 'login' ? t('login_btn') : t('register_btn')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch */}
          <TouchableOpacity
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={styles.switchRow}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchText, { color: colors.onSurfaceVariant }]}>
              {mode === 'login' ? t('login_no_account') : t('login_has_account')}{' '}
              <Text style={[styles.switchLink, { color: colors.primary }]}>
                {mode === 'login' ? t('login_register_free') : t('login_btn')}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>{t('login_privacy')}</Text>
            <Text style={[styles.footerDot, { color: colors.outlineVariant }]}>·</Text>
            <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>{t('login_terms')}</Text>
            <Text style={[styles.footerDot, { color: colors.outlineVariant }]}>·</Text>
            <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>{t('login_help')}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  circle1: {
    position: 'absolute', width: 320, height: 320,
    borderRadius: 160, borderWidth: 1,
    top: -60, right: -80,
  },
  circle2: {
    position: 'absolute', width: 220, height: 220,
    borderRadius: 110, borderWidth: 1,
    top: 20, left: -60,
  },
  logoWrap: { marginBottom: 4 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 36,
    color: '#ffffff', letterSpacing: -0.8,
  },
  heroSub: {
    fontFamily: 'Inter_400Regular', fontSize: 15,
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
  },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  // Card
  card: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12,
    gap: 16, flex: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 12,
  },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3, marginBottom: 4 },
  // Google
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
  },
  googleG: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#4285F4' },
  googleText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  // Divider
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1 },
  divText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  // Fields
  fieldGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.4 },
  forgot: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    overflow: 'hidden',
  },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, minWidth: 0 },
  // Feedback
  feedbackBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  feedbackText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  // Submit
  submitBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  // Switch
  switchRow: { alignItems: 'center' },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchLink: { fontFamily: 'Inter_700Bold' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 8 },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  footerDot: { fontSize: 14 },
});
