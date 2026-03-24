import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '../../src/lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await apiGet<UserProfile>('/auth/profile');
        setProfile(data);
      } catch {
        // If profile fetch fails, try to use cached user data
        try {
          const cached = await SecureStore.getItemAsync('customer_user');
          if (cached) {
            const parsed = JSON.parse(cached);
            setProfile({
              id: parsed.id,
              email: parsed.email,
              full_name: parsed.fullName,
              role: parsed.role,
              phone: null,
              avatar_url: null,
              is_active: true,
            });
          }
        } catch {
          // Ignore parse errors
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleLogout = () => {
    Alert.alert(t('common.logout'), t('common.logoutConfirm'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Avatar circle */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name
              ? profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : '?'}
          </Text>
        </View>
        <Text style={styles.nameText}>{profile?.full_name ?? '-'}</Text>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.email')}</Text>
          <Text style={styles.value}>{profile?.email ?? '-'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.phone')}</Text>
          <Text style={styles.value}>{profile?.phone ?? '-'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.role')}</Text>
          <Text style={styles.value}>{profile?.role ?? t('profile.customer')}</Text>
        </View>
      </View>

      {/* Quick links */}
      <View style={styles.quickLinks}>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/my-appointments')} activeOpacity={0.7}>
          <Text style={styles.quickLinkIcon}>📅</Text>
          <Text style={styles.quickLinkText}>{t('myAppointments.title')}</Text>
          <Text style={styles.quickLinkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/invoices')} activeOpacity={0.7}>
          <Text style={styles.quickLinkIcon}>🧾</Text>
          <Text style={styles.quickLinkText}>{t('invoices.title')}</Text>
          <Text style={styles.quickLinkArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0087FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0087FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginStart: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginHorizontal: 16,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },

  // Quick links
  quickLinks: { marginTop: 20, gap: 8 },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickLinkIcon: { fontSize: 22 },
  quickLinkText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  quickLinkArrow: { fontSize: 18, color: '#8E8E93' },
});
