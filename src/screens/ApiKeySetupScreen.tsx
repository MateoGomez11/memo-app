import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, radius, shadow } from '../theme';
import { saveApiKey, getApiKey, deleteApiKey } from '../services/storage';
import { Ionicons } from '@expo/vector-icons';

export default function ApiKeySetupScreen() {
  const navigation = useNavigation<any>();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [masked, setMasked] = useState(true);

  useEffect(() => {
    getApiKey().then((k) => {
      if (k) {
        setKey(k);
        setSaved(true);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!key.trim()) {
      Alert.alert('Ingresa tu clave de API de Gemini primero.');
      return;
    }
    await saveApiKey(key.trim());
    setSaved(true);
    Alert.alert('Guardado', 'Tu clave de API se guardó de forma segura.');
    navigation.goBack();
  };

  const handleDelete = async () => {
    Alert.alert('¿Eliminar clave de API?', 'Necesitarás ingresarla de nuevo para procesar memos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteApiKey();
          setKey('');
          setSaved(false);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.iconBg}>
          <Ionicons name="key-outline" size={40} color={colors.primary} />
        </View>

        <Text style={styles.title}>Clave de API Gemini</Text>
        <Text style={styles.sub}>
          Tu clave se guarda de forma segura en el dispositivo usando Expo SecureStore y nunca se envía a ningún servidor externo.
        </Text>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
          style={styles.getKeyLink}
        >
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text style={styles.getKeyText}>Obtén una clave gratis en Google AI Studio</Text>
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={setKey}
            placeholder="AIza..."
            placeholderTextColor={colors.outline}
            secureTextEntry={masked}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setMasked((m) => !m)} style={styles.eyeBtn}>
            <Ionicons
              name={masked ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.outline}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.saveBtnText}>Guardar clave de API</Text>
        </TouchableOpacity>

        {saved && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Text style={styles.deleteBtnText}>Eliminar clave guardada</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceVariant} />
          <Text style={styles.infoText}>
            Memo usa Groq. El memo se envía directamente desde tu dispositivo a la API — no se almacenan datos en ningún servidor externo.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.marginPage,
    paddingTop: spacing.stackLg,
    paddingBottom: spacing.sectionGap,
    gap: spacing.stackMd,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: spacing.stackSm,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.stackSm,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
  },
  sub: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  getKeyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  getKeyText: {
    ...typography.bodyMd,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.stackMd,
    marginTop: spacing.stackSm,
  },
  input: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 4,
  },
  saveBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.onPrimary,
  },
  deleteBtn: {
    paddingVertical: 8,
  },
  deleteBtnText: {
    ...typography.bodyMd,
    color: colors.error,
    textDecorationLine: 'underline',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.stackMd,
    marginTop: spacing.stackSm,
    alignItems: 'flex-start',
  },
  infoText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    flex: 1,
    fontSize: 14,
  },
});
