import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../../src/lib/api';

const LANGUAGES = ['en', 'pt-PT', 'pt-BR'] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ email?: string }>('/auth/profile')
      .then((profile) => setUserEmail(profile?.email ?? null))
      .catch(() => setUserEmail(null));
  }, []);

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  const handleLogout = () => {
    Alert.alert(t('common.logout'), t('common.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile */}
      <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.email}>{userEmail ?? '—'}</Text>
      </View>

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
          <Text style={styles.aboutLabel}>MECANIX Workshop</Text>
          <Text style={styles.aboutValue}>{t('settings.version')} 0.0.1</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>{t('common.logout')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },

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
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },

  // Profile
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0087FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  email: {
    textAlign: 'center',
    fontSize: 16,
    color: '#363638',
    fontWeight: '500',
  },

  // Language
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  langRowActive: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: -12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  langText: { fontSize: 16, color: '#363638' },
  langTextActive: { color: '#0052CC', fontWeight: '600' },
  checkmark: { color: '#0087FF', fontSize: 18, fontWeight: '700' },

  // About
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  aboutValue: { fontSize: 14, color: '#8E8E93' },

  // Logout
  logoutButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: { color: '#D32F2F', fontSize: 17, fontWeight: '700' },
});
