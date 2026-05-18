import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';

type Tab = 'Home' | 'ActiveRecording' | 'ImportAudio';

export default function BottomNav() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { colors, t } = useAppContext();
  const insets = useSafeAreaInsets();

  const active = route.name as Tab;

  const tabs: { key: Tab; labelKey: 'tab_meetings' | 'tab_record' | 'tab_import'; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'Home', labelKey: 'tab_meetings', icon: 'list-outline', iconActive: 'list' },
    { key: 'ActiveRecording', labelKey: 'tab_record', icon: 'mic-outline', iconActive: 'mic' },
    { key: 'ImportAudio', labelKey: 'tab_import', icon: 'cloud-upload-outline', iconActive: 'cloud-upload' },
  ];

  return (
    <View style={[styles.container, {
      backgroundColor: colors.surfaceContainerLow,
      borderTopColor: colors.outlineVariant,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12 + insets.bottom,
    }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => navigation.navigate(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.outline}
            />
            <Text style={[styles.label, { color: isActive ? colors.primary : colors.outline }]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: spacing.marginPage,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
