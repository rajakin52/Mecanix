import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '../../src/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  specialty?: string;
}

interface TimeEntry {
  id: string;
  status: string;
  started_at: string;
  total_seconds?: number;
  job_id: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function formatHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProfileScreen() {
  const { t } = useTranslation();

  const [technician, setTechnician] = useState<Technician | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const techs = await apiGet<Technician[]>('/technicians');
      const first = techs[0];
      if (first) {
        setTechnician(first);

        try {
          const timeEntries = await apiGet<TimeEntry[]>('/time');
          setEntries(timeEntries.filter((e) => e.status === 'STOPPED'));
        } catch (_e) {
          setEntries([]);
        }
      }
    } catch (_e) {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  /* Stats */
  const todayEntries = entries.filter((e) => isToday(e.started_at));
  const weekEntries = entries.filter((e) => isThisWeek(e.started_at));

  const todaySeconds = todayEntries.reduce((sum, e) => sum + (e.total_seconds ?? 0), 0);
  const weekSeconds = weekEntries.reduce((sum, e) => sum + (e.total_seconds ?? 0), 0);

  const todayJobs = new Set(todayEntries.map((e) => e.job_id)).size;
  const weekJobs = new Set(weekEntries.map((e) => e.job_id)).size;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar / Name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {technician
              ? `${technician.first_name[0]}${technician.last_name[0]}`
              : '?'}
          </Text>
        </View>
        <Text style={styles.name}>
          {technician
            ? `${technician.first_name} ${technician.last_name}`
            : t('profile.technician')}
        </Text>
        {technician?.specialty && (
          <Text style={styles.specialty}>{technician.specialty}</Text>
        )}
        {technician?.email && (
          <Text style={styles.email}>{technician.email}</Text>
        )}
      </View>

      {/* Today's Stats */}
      <Text style={styles.sectionTitle}>{t('profile.todayStats')}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatHours(todaySeconds)}</Text>
          <Text style={styles.statLabel}>{t('profile.hoursLogged')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayJobs}</Text>
          <Text style={styles.statLabel}>{t('profile.jobsWorked')}</Text>
        </View>
      </View>

      {/* Week Stats */}
      <Text style={styles.sectionTitle}>{t('profile.weekStats')}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatHours(weekSeconds)}</Text>
          <Text style={styles.statLabel}>{t('profile.hoursLogged')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{weekJobs}</Text>
          <Text style={styles.statLabel}>{t('profile.jobsWorked')}</Text>
        </View>
      </View>

      {/* Logout moved to Settings tab */}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0087FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  specialty: {
    fontSize: 14,
    color: '#0087FF',
    marginTop: 2,
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  /* Sections */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#AEAEB2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0087FF',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 13,
    color: '#AEAEB2',
    marginTop: 4,
  },

  /* Logout */
  logoutButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
