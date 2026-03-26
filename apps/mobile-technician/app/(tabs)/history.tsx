import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../src/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TimeEntry {
  id: string;
  job_id: string;
  technician_id: string;
  status: string;
  started_at: string;
  stopped_at?: string;
  total_seconds?: number;
  job?: {
    job_number?: string;
    vehicle?: { plate_number?: string };
  };
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HistoryScreen() {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [techId, setTechId] = useState<string | null>(null);

  const resolveTechnician = useCallback(async (): Promise<string | null> => {
    try {
      const techsRaw = await apiGet<Technician[] | { data: Technician[] }>('/technicians');
      const techs = Array.isArray(techsRaw) ? techsRaw : (techsRaw as { data: Technician[] }).data ?? [];
      const first = techs[0];
      if (first) {
        setTechId(first.id);
        return first.id;
      }
    } catch (_e) {
      // ignore
    }
    return null;
  }, []);

  const fetchEntries = useCallback(async (tid?: string | null) => {
    const id = tid ?? techId;
    if (!id) return;
    try {
      const raw = await apiGet<TimeEntry[] | { data: TimeEntry[] }>(`/time?technician_id=${id}&status=STOPPED`);
      const data = Array.isArray(raw) ? raw : (raw as { data: TimeEntry[] }).data ?? [];
      // Sort newest first
      const sorted = data.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
      setEntries(sorted);
    } catch (_e) {
      // If the endpoint doesn't support query params, just get all
      try {
        const allRaw = await apiGet<TimeEntry[] | { data: TimeEntry[] }>('/time');
        const all = Array.isArray(allRaw) ? allRaw : (allRaw as { data: TimeEntry[] }).data ?? [];
        const filtered = all
          .filter((e) => e.status === 'STOPPED')
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        setEntries(filtered);
      } catch (_e2) {
        setEntries([]);
      }
    }
  }, [techId]);

  useEffect(() => {
    (async () => {
      const tid = await resolveTechnician();
      await fetchEntries(tid);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  };

  /* ---- Compute totals ---- */
  const todayEntries = entries.filter((e) => isToday(e.started_at));
  const weekEntries = entries.filter((e) => isThisWeek(e.started_at));
  const todaySeconds = todayEntries.reduce((sum, e) => sum + (e.total_seconds ?? 0), 0);
  const weekSeconds = weekEntries.reduce((sum, e) => sum + (e.total_seconds ?? 0), 0);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const renderEntry = ({ item }: { item: TimeEntry }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.jobNumber}>
          {item.job?.job_number ?? item.job_id.slice(0, 8)}
        </Text>
        <Text style={styles.duration}>
          {item.total_seconds != null ? formatDuration(item.total_seconds) : '--'}
        </Text>
      </View>
      {item.job?.vehicle?.plate_number && (
        <Text style={styles.plate}>{item.job.vehicle.plate_number}</Text>
      )}
      <Text style={styles.date}>{formatDate(item.started_at)}</Text>
    </View>
  );

  const ListHeader = () => (
    <View>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('common.today')}</Text>
          <Text style={styles.summaryValue}>{formatDuration(todaySeconds)}</Text>
          <Text style={styles.summaryCount}>
            {todayEntries.length} {t('jobs.assignedJobs').toLowerCase()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('common.thisWeek')}</Text>
          <Text style={styles.summaryValue}>{formatDuration(weekSeconds)}</Text>
          <Text style={styles.summaryCount}>
            {weekEntries.length} {t('jobs.assignedJobs').toLowerCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('history.completedEntries')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('history.noEntries')}</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CAF50"
            colors={['#0087FF']}
          />
        }
      />

      {/* Total at bottom */}
      {entries.length > 0 && (
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>{t('common.totalHours')}</Text>
          <Text style={styles.totalValue}>{formatDuration(weekSeconds)}</Text>
        </View>
      )}
    </View>
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
  list: {
    padding: 16,
    paddingBottom: 80,
  },

  /* Summary */
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AEAEB2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0087FF',
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  summaryCount: {
    fontSize: 12,
    color: '#8E8E93',
  },

  /* Section */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },

  /* Cards */
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  duration: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0087FF',
    fontVariant: ['tabular-nums'],
  },
  plate: {
    fontSize: 13,
    color: '#AEAEB2',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },

  /* Total bar */
  totalBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#363638',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#AEAEB2',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0087FF',
    fontVariant: ['tabular-nums'],
  },

  emptyText: {
    textAlign: 'center',
    color: '#636366',
    fontSize: 16,
    marginTop: 48,
  },
});
