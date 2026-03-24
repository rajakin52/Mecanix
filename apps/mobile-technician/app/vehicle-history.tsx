import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, Stack } from 'expo-router';
import { apiGet } from '../src/lib/api';

const PRIMARY = '#0087FF';

const STATUS_COLORS: Record<string, string> = {
  received: '#2196F3',
  diagnosing: '#9C27B0',
  awaiting_approval: '#FF9800',
  in_progress: '#0087FF',
  awaiting_parts: '#FFC107',
  quality_check: '#00BCD4',
  ready: '#8BC34A',
  invoiced: '#607D8B',
};

interface HistoryJob {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  created_at: string;
  grand_total: number;
  parts_lines: Array<{
    id: string;
    part_name: string;
    part_number: string | null;
    quantity: number;
  }>;
}

interface PartsHistoryItem {
  part_name: string;
  part_number: string | null;
  last_installed: string;
  install_count: number;
  jobs: string[];
}

interface VehicleHistory {
  jobs: HistoryJob[];
  parts_history: PartsHistoryItem[];
}

type Tab = 'repairs' | 'parts';

export default function VehicleHistoryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    vehicleId: string;
    vehiclePlate?: string;
  }>();

  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('repairs');

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiGet<VehicleHistory>(
        `/vehicles/${params.vehicleId}/history`,
      );
      setHistory(data);
    } catch {
      Alert.alert(t('common.error'), t('vehicleHistory.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.vehicleId, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{ title: params.vehiclePlate ?? t('vehicleHistory.title') }}
        />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const jobs = history?.jobs ?? [];
  const parts = history?.parts_history ?? [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${params.vehiclePlate ?? ''} — ${t('vehicleHistory.title')}`,
          headerBackTitle: t('common.back'),
        }}
      />

      {/* Tab selector */}
      <View style={styles.tabRow}>
        <View style={[styles.tab, tab === 'repairs' && styles.tabActive]}>
          <Text
            style={[styles.tabText, tab === 'repairs' && styles.tabTextActive]}
            onPress={() => setTab('repairs')}
          >
            {t('vehicleHistory.repairHistory')}
          </Text>
        </View>
        <View style={[styles.tab, tab === 'parts' && styles.tabActive]}>
          <Text
            style={[styles.tabText, tab === 'parts' && styles.tabTextActive]}
            onPress={() => setTab('parts')}
          >
            {t('vehicleHistory.partsHistory')}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHistory();
            }}
            tintColor={PRIMARY}
          />
        }
        contentContainerStyle={styles.content}
      >
        {tab === 'repairs' && (
          <>
            {jobs.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('vehicleHistory.noHistory')}
              </Text>
            ) : (
              jobs.map((job) => (
                <View key={job.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.jobNumber}>{job.job_number}</Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            STATUS_COLORS[job.status] ?? '#636366',
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {t(`status.${job.status}`, job.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.problem} numberOfLines={2}>
                    {job.reported_problem}
                  </Text>
                  <Text style={styles.date}>
                    {new Date(job.created_at).toLocaleDateString()}
                  </Text>
                  {job.parts_lines.length > 0 && (
                    <View style={styles.partsInJob}>
                      {job.parts_lines.map((pl) => (
                        <Text key={pl.id} style={styles.partLine}>
                          {pl.part_name}
                          {pl.part_number ? ` (${pl.part_number})` : ''} x
                          {pl.quantity}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {tab === 'parts' && (
          <>
            {parts.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('vehicleHistory.noPartsHistory')}
              </Text>
            ) : (
              parts.map((part, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.partName}>{part.part_name}</Text>
                  {part.part_number && (
                    <Text style={styles.partNumber}>{part.part_number}</Text>
                  )}
                  <Text style={styles.partMeta}>
                    {t('vehicleHistory.lastInstalled')}:{' '}
                    {new Date(part.last_installed).toLocaleDateString()}
                  </Text>
                  <Text style={styles.partMeta}>
                    {t('vehicleHistory.totalInstalled', {
                      count: part.install_count,
                      jobs: part.jobs.length,
                    })}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0C',
  },
  content: { padding: 16, paddingTop: 0 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#2C2C2E' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: PRIMARY },

  // Cards
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobNumber: { fontSize: 17, fontWeight: '700', color: '#fff' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  problem: { fontSize: 14, color: '#AEAEB2', lineHeight: 20, marginBottom: 4 },
  date: { fontSize: 12, color: '#8E8E93' },
  partsInJob: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#363638',
  },
  partLine: { fontSize: 13, color: '#AEAEB2', paddingVertical: 2 },

  // Parts tab
  partName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  partNumber: { fontSize: 13, color: '#8E8E93', marginBottom: 4 },
  partMeta: { fontSize: 13, color: '#AEAEB2', marginTop: 2 },

  emptyText: {
    textAlign: 'center',
    color: '#636366',
    fontSize: 16,
    marginTop: 48,
  },
});
