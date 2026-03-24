import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  created_at: string;
  vehicle?: { plate: string; make: string; model: string };
  customer?: { full_name: string };
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

const ACTIVE_STATUSES = [
  'received',
  'diagnosing',
  'awaiting_approval',
  'insurance_review',
  'in_progress',
  'awaiting_parts',
  'quality_check',
  'ready',
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await apiFetch<JobCard[] | { data: JobCard[] }>('/jobs');
      const list = Array.isArray(response) ? response : (response as { data: JobCard[] }).data ?? [];
      setJobs(list);
    } catch {
      // silent — dashboard degrades gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // Compute stats
  const openJobs = jobs.filter((j) =>
    ['received', 'diagnosing', 'in_progress', 'awaiting_approval', 'insurance_review'].includes(j.status),
  );
  const awaitingParts = jobs.filter((j) => j.status === 'awaiting_parts');
  const vehiclesInShop = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const todayStr = new Date().toISOString().slice(0, 10);
  const completedToday = jobs.filter(
    (j) => j.status === 'ready' && j.created_at?.slice(0, 10) === todayStr,
  );

  // Status breakdown for active jobs
  const statusCounts: Record<string, number> = {};
  for (const j of jobs) {
    if (ACTIVE_STATUSES.includes(j.status)) {
      statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
    }
  }

  const recentJobs = jobs.slice(0, 5);

  // Action required items
  const needsApproval = jobs.filter((j) => j.status === 'awaiting_approval');
  const flaggedBlocked = jobs.filter((j) =>
    ACTIVE_STATUSES.includes(j.status) && j.status === 'awaiting_parts',
  );
  const actionCount = needsApproval.length + flaggedBlocked.length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0087FF" />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome */}
      <Text style={styles.welcome}>{t('dashboard.welcome')}</Text>

      {/* Action Required banner */}
      {actionCount > 0 && (
        <TouchableOpacity
          style={styles.actionBanner}
          onPress={() => router.push('/(tabs)/jobs')}
          activeOpacity={0.8}
        >
          <View style={styles.actionBannerLeft}>
            <Text style={styles.actionBannerIcon}>⚠️</Text>
            <View>
              <Text style={styles.actionBannerTitle}>Action Required</Text>
              <Text style={styles.actionBannerDetail}>
                {needsApproval.length > 0
                  ? `${needsApproval.length} awaiting approval`
                  : ''}
                {needsApproval.length > 0 && flaggedBlocked.length > 0 ? ' · ' : ''}
                {flaggedBlocked.length > 0
                  ? `${flaggedBlocked.length} awaiting parts`
                  : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.actionBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Stats cards */}
      <Text style={styles.sectionTitle}>{t('dashboard.todayOverview')}</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#0087FF' }]}>
          <Text style={styles.statNumber}>{openJobs.length}</Text>
          <Text style={styles.statLabel}>{t('dashboard.openJobs')}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#2196F3' }]}>
          <Text style={styles.statNumber}>{vehiclesInShop.length}</Text>
          <Text style={styles.statLabel}>{t('dashboard.vehiclesInShop')}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#8BC34A' }]}>
          <Text style={styles.statNumber}>{completedToday.length}</Text>
          <Text style={styles.statLabel}>{t('dashboard.completedToday')}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#FFC107' }]}>
          <Text style={styles.statNumber}>{awaitingParts.length}</Text>
          <Text style={styles.statLabel}>{t('dashboard.awaitingParts')}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/new-job')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>+</Text>
          <Text style={styles.actionLabel}>{t('dashboard.newJob')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#E3F2FD' }]}
          onPress={() => router.push('/(tabs)/customers')}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionIcon, { color: '#1565C0' }]}>+</Text>
          <Text style={[styles.actionLabel, { color: '#1565C0' }]}>
            {t('dashboard.newCustomer')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Jobs by status */}
      {Object.keys(statusCounts).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('dashboard.jobsByStatus')}</Text>
          <View style={styles.statusBreakdown}>
            {Object.entries(statusCounts).map(([status, count]) => (
              <View key={status} style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: STATUS_COLORS[status] ?? '#8E8E93' },
                  ]}
                />
                <Text style={styles.statusLabel}>
                  {t(`jobs.status.${status}`, status)}
                </Text>
                <Text style={styles.statusCount}>{count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Recent jobs */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>{t('dashboard.recentJobs')}</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/jobs')}>
          <Text style={styles.viewAll}>{t('dashboard.viewAll')}</Text>
        </TouchableOpacity>
      </View>

      {recentJobs.length === 0 ? (
        <Text style={styles.empty}>{t('dashboard.noRecentJobs')}</Text>
      ) : (
        recentJobs.map((job) => (
          <TouchableOpacity
            key={job.id}
            style={styles.jobCard}
            onPress={() =>
              router.push({
                pathname: '/job-detail',
                params: { jobId: job.id, jobNumber: job.job_number },
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.jobCardHeader}>
              <Text style={styles.jobNumber}>{job.job_number}</Text>
              <View
                style={[
                  styles.jobStatusBadge,
                  { backgroundColor: STATUS_COLORS[job.status] ?? '#8E8E93' },
                ]}
              >
                <Text style={styles.jobStatusText}>
                  {t(`jobs.status.${job.status}`, job.status)}
                </Text>
              </View>
            </View>
            {job.vehicle && (
              <Text style={styles.jobVehicle}>
                {job.vehicle.plate} — {job.vehicle.make} {job.vehicle.model}
              </Text>
            )}
            {job.customer && (
              <Text style={styles.jobCustomer}>{job.customer.full_name}</Text>
            )}
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  // Action Required
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actionBannerIcon: { fontSize: 24 },
  actionBannerTitle: { fontSize: 15, fontWeight: '700', color: '#E65100' },
  actionBannerDetail: { fontSize: 13, color: '#BF360C', marginTop: 2 },
  actionBannerArrow: { fontSize: 20, color: '#E65100', fontWeight: '700' },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#636366',
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#1C1C1E' },
  statLabel: { fontSize: 13, color: '#636366', marginTop: 2, fontWeight: '500' },

  // Quick actions
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionIcon: { fontSize: 22, fontWeight: '700', color: '#0087FF' },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#0087FF' },

  // Status breakdown
  statusBreakdown: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginEnd: 10 },
  statusLabel: { flex: 1, fontSize: 14, color: '#363638' },
  statusCount: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },

  // Recent jobs
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: { color: '#0087FF', fontSize: 14, fontWeight: '600', marginTop: 6 },
  empty: { textAlign: 'center', color: '#8E8E93', fontSize: 15, marginTop: 16 },

  jobCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0087FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobNumber: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  jobStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  jobStatusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  jobVehicle: { fontSize: 14, fontWeight: '500', color: '#363638', marginBottom: 1 },
  jobCustomer: { fontSize: 13, color: '#636366' },
});
