import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import FilterBar, { type FilterChip } from '../../src/components/FilterBar';
import EmptyState from '../../src/components/EmptyState';
import { timeAgo } from '../../src/lib/timeAgo';

const PRIMARY = '#0087FF';

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  is_insurance: boolean;
  created_at: string;
  vehicle?: { id: string; plate: string; make: string; model: string };
  customer?: { id: string; full_name: string };
}

const STATUS_COLORS: Record<string, string> = {
  received: '#2196F3',
  diagnosing: '#9C27B0',
  awaiting_approval: '#FF9800',
  insurance_review: '#FF5722',
  in_progress: '#0087FF',
  awaiting_parts: '#FFC107',
  quality_check: '#00BCD4',
  ready: '#8BC34A',
  invoiced: '#607D8B',
};

export default function JobsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const statusChips: FilterChip[] = useMemo(
    () => [
      { key: 'received', label: t('jobs.status.received'), color: STATUS_COLORS.received },
      { key: 'in_progress', label: t('jobs.status.in_progress'), color: STATUS_COLORS.in_progress },
      { key: 'awaiting_approval', label: t('jobs.status.awaiting_approval'), color: STATUS_COLORS.awaiting_approval },
      { key: 'awaiting_parts', label: t('jobs.status.awaiting_parts'), color: STATUS_COLORS.awaiting_parts },
      { key: 'quality_check', label: t('jobs.status.quality_check'), color: STATUS_COLORS.quality_check },
      { key: 'ready', label: t('jobs.status.ready'), color: STATUS_COLORS.ready },
      { key: 'invoiced', label: t('jobs.status.invoiced'), color: STATUS_COLORS.invoiced },
    ],
    [t],
  );

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('pageSize', '100');
      const qs = params.toString();
      const response = await apiFetch<JobCard[] | { data: JobCard[] }>(`/jobs${qs ? `?${qs}` : ''}`);
      const list = Array.isArray(response) ? response : (response as { data: JobCard[] }).data ?? [];
      setJobs(list);
    } catch {
      Alert.alert(t('common.error'), t('jobs.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, t]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(fetchJobs, 300);
    return () => clearTimeout(debounce);
  }, [fetchJobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const handleJobPress = (job: JobCard) => {
    router.push({
      pathname: '/job-detail',
      params: { jobId: job.id, jobNumber: job.job_number },
    });
  };

  const renderJob = ({ item }: { item: JobCard }) => {
    const statusColor = STATUS_COLORS[item.status] ?? '#8E8E93';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleJobPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.jobNumber}>{item.job_number}</Text>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.timeAgo}>
              {timeAgo(item.created_at, t)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {t(`jobs.status.${item.status}`, item.status)}
              </Text>
            </View>
          </View>
        </View>

        {item.vehicle && (
          <Text style={styles.vehicleInfo}>
            {item.vehicle.plate} — {item.vehicle.make} {item.vehicle.model}
          </Text>
        )}

        {item.customer && (
          <Text style={styles.customerInfo}>{item.customer.full_name}</Text>
        )}

        <Text style={styles.problem} numberOfLines={2}>
          {item.reported_problem}
        </Text>

        {item.is_insurance && (
          <View style={styles.insuranceBadge}>
            <Text style={styles.insuranceText}>{t('jobs.insurance')}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('jobs.searchPlaceholder')}
        chips={statusChips}
        activeChip={statusFilter}
        onChipPress={setStatusFilter}
      />

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              message={t('jobs.noJobs')}
              actionLabel={t('jobs.newJob')}
              onAction={() => router.push('/new-job')}
            />
          }
          contentContainerStyle={jobs.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-job')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48, fontSize: 15 },
  emptyContainer: { flexGrow: 1 },

  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobNumber: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  timeAgo: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  vehicleInfo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#363638',
    marginBottom: 2,
  },
  customerInfo: { fontSize: 14, color: '#636366', marginBottom: 6 },
  problem: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  insuranceBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  insuranceText: { color: '#E65100', fontSize: 12, fontWeight: '600' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '400', marginTop: -2 },
});
