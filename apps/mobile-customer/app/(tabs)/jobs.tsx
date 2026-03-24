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
  vehicle?: {
    id: string;
    plate: string;
    make: string;
    model: string;
  } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#E3F2FD', text: '#1565C0' },
  in_progress: { bg: '#FFF3E0', text: '#E65100' },
  waiting_parts: { bg: '#FCE4EC', text: '#C62828' },
  waiting_approval: { bg: '#F3E5F5', text: '#6A1B9A' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  invoiced: { bg: '#E0F2F1', text: '#00695C' },
  cancelled: { bg: '#FAFAFA', text: '#757575' },
};

const STATUS_ORDER = [
  'open',
  'in_progress',
  'waiting_parts',
  'waiting_approval',
  'completed',
  'invoiced',
];

export default function JobsScreen() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      setError('');
      const data = await apiGet<{ items: JobCard[]; total: number }>('/jobs?pageSize=50');
      // Filter to show only active (non-completed, non-invoiced, non-cancelled)
      const activeJobs = (data.items ?? []).filter(
        (j) => !['completed', 'invoiced', 'cancelled'].includes(j.status),
      );
      setJobs(activeJobs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const getStatusIndex = (status: string) => {
    const idx = STATUS_ORDER.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  const renderStatusDots = (currentStatus: string) => {
    const currentIdx = getStatusIndex(currentStatus);
    // Show first 4 steps for progress
    const steps = STATUS_ORDER.slice(0, 4);
    return (
      <View style={styles.progressRow}>
        {steps.map((step, i) => (
          <View key={step} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                i <= currentIdx ? styles.progressDotActive : styles.progressDotInactive,
              ]}
            />
            {i < steps.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  i < currentIdx ? styles.progressLineActive : styles.progressLineInactive,
                ]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderJob = ({ item }: { item: JobCard }) => {
    const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.open;
    const statusLabel = t(`jobs.status.${item.status}`, { defaultValue: item.status });

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.jobNumber}>
            {t('jobs.jobNumber', { number: item.job_number })}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>{statusLabel}</Text>
          </View>
        </View>

        {item.vehicle ? (
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleLabel}>{t('jobs.vehicle')}:</Text>
            <Text style={styles.vehiclePlate}>{item.vehicle.plate}</Text>
            <Text style={styles.vehicleName}>
              {item.vehicle.make} {item.vehicle.model}
            </Text>
          </View>
        ) : null}

        {item.reported_problem ? (
          <View style={styles.problemRow}>
            <Text style={styles.problemLabel}>{t('jobs.reportedProblem')}</Text>
            <Text style={styles.problemText}>{item.reported_problem}</Text>
          </View>
        ) : null}

        {renderStatusDots(item.status)}

        {item.grand_total != null && item.grand_total > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('jobs.total')}</Text>
            <Text style={styles.totalValue}>{item.grand_total.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchJobs}>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'\u{2705}'}</Text>
            <Text style={styles.emptyText}>{t('jobs.empty')}</Text>
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
    alignItems: 'center',
    marginBottom: 10,
  },
  jobNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  vehicleLabel: {
    fontSize: 13,
    color: '#8E8E93',
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
  problemRow: {
    marginBottom: 12,
  },
  problemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  problemText: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotActive: {
    backgroundColor: '#4CAF50',
  },
  progressDotInactive: {
    backgroundColor: '#E0E0E0',
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#4CAF50',
  },
  progressLineInactive: {
    backgroundColor: '#E0E0E0',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  totalValue: {
    fontSize: 18,
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
    backgroundColor: '#4CAF50',
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
