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
    Alert.alert(t('common.logout'), t('common.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('customer_auth_token');
          await SecureStore.deleteItemAsync('customer_refresh_token');
          await SecureStore.deleteItemAsync('customer_user');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[styles.langRow, currentLang === lang && styles.langRowActive]}
            onPress={() => changeLanguage(lang)}
            activeOpacity={0.7}
          >
            <Text style={[styles.langText, currentLang === lang && styles.langTextActive]}>
              {t(`settings.languageNames.${lang}`)}
            </Text>
            {currentLang === lang && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>MECANIX Customer</Text>
          <Text style={styles.aboutValue}>{t('settings.version')} 0.0.1</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{t('common.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  langRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA', minHeight: 50 },
  langRowActive: { backgroundColor: '#E3F2FD', borderRadius: 8, borderBottomWidth: 0 },
  langText: { fontSize: 16, color: '#363638' },
  langTextActive: { color: PRIMARY, fontWeight: '600' },
  checkmark: { color: PRIMARY, fontSize: 18, fontWeight: '700' },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  aboutLabel: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  aboutValue: { fontSize: 14, color: '#8E8E93' },
  logoutButton: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32, borderWidth: 1, borderColor: '#FFCDD2' },
  logoutText: { color: '#D32F2F', fontSize: 17, fontWeight: '700' },
});
