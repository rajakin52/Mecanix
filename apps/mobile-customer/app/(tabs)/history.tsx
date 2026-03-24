import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../../src/lib/api';

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string | null;
  grand_total: number | null;
  created_at: string;
  updated_at: string;
  vehicle?: {
    id: string;
    plate: string;
    make: string;
    model: string;
  } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  invoiced: { bg: '#E0F2F1', text: '#00695C' },
  cancelled: { bg: '#FAFAFA', text: '#757575' },
};

export default function HistoryScreen() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      setError('');
      const data = await apiGet<{ items: JobCard[]; total: number }>('/jobs?pageSize=100');
      // Filter to completed/invoiced jobs
      const completedJobs = (data.items ?? []).filter((j) =>
        ['completed', 'invoiced'].includes(j.status),
      );
      // Sort by updated_at descending
      completedJobs.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setJobs(completedJobs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderJob = ({ item }: { item: JobCard }) => {
    const statusColor = STATUS_COLORS[item.status] ?? { bg: '#E8F5E9', text: '#2E7D32' };
    const statusLabel = t(`jobs.status.${item.status}`, { defaultValue: item.status });

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.dateText}>{formatDate(item.updated_at)}</Text>
            <Text style={styles.jobNumber}>
              {t('jobs.jobNumber', { number: item.job_number })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>{statusLabel}</Text>
          </View>
        </View>

        {item.vehicle ? (
          <View style={styles.vehicleRow}>
            <Text style={styles.vehiclePlate}>{item.vehicle.plate}</Text>
            <Text style={styles.vehicleName}>
              {item.vehicle.make} {item.vehicle.model}
            </Text>
          </View>
        ) : null}

        {item.reported_problem ? (
          <Text style={styles.serviceText} numberOfLines={2}>
            {item.reported_problem}
          </Text>
        ) : null}

        {item.grand_total != null && item.grand_total > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('history.cost')}</Text>
            <Text style={styles.totalValue}>{item.grand_total.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0087FF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'\u{1F4CB}'}</Text>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
  },
  jobNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginStart: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  vehiclePlate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: 0.5,
  },
  vehicleName: {
    fontSize: 13,
    color: '#636366',
  },
  serviceText: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0087FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
