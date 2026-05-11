import React, { createContext, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { lightColors, darkColors } from '../theme';
import { getAppSettings, saveAppSettings } from '../services/storage';
import { Language, TranslationKey, getTranslator } from '../i18n';
import { supabase } from '../services/supabase';

type ThemeMode = 'light' | 'dark';
type Colors = typeof lightColors;

interface AppContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: Colors;
  isDark: boolean;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  session: Session | null;
  loadingAuth: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 3000);
    getAppSettings().then((s) => {
      setLanguageState(s.language);
      setThemeModeState(s.themeMode);
      setLoaded(true);
      clearTimeout(timeout);
    }).catch(() => setLoaded(true));
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setLoadingAuth(false), 5000);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
      clearTimeout(timeout);
    }).catch(() => setLoadingAuth(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoadingAuth(false);
    });

    const handleUrl = async (url: string) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const hash = new URLSearchParams(parsed.hash.replace('#', ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch {}
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveAppSettings({ language: lang });
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    saveAppSettings({ themeMode: mode });
  };

  const isDark = themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const t = getTranslator(language);

  // Always render the Provider — never block with null
  return (
    <AppContext.Provider value={{ language, setLanguage, themeMode, setThemeMode, colors, isDark, t, session, loadingAuth: loadingAuth || !loaded }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
