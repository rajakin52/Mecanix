import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const PRIMARY = '#0087FF';
const LANGUAGES = ['en', 'pt-PT', 'pt-BR'] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('refresh_token');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Language */}
      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.langRow,
              currentLang === lang && styles.langRowActive,
            ]}
            onPress={() => changeLanguage(lang)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.langText,
                currentLang === lang && styles.langTextActive,
              ]}
            >
              {t(`settings.languageNames.${lang}`)}
            </Text>
            {currentLang === lang && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* About */}
      <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>MECANIX Technician</Text>
          <Text style={styles.aboutValue}>{t('settings.version')} 0.0.1</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>{t('auth.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  content: { padding: 20, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 4,
  },

  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#363638',
    minHeight: 52,
  },
  langRowActive: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  langText: { fontSize: 16, color: '#AEAEB2' },
  langTextActive: { color: PRIMARY, fontWeight: '600' },
  checkmark: { color: PRIMARY, fontSize: 18, fontWeight: '700' },

  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  aboutLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  aboutValue: { fontSize: 14, color: '#8E8E93' },

  logoutButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
    minHeight: 56,
    justifyContent: 'center',
  },
  logoutText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
