import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
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

const CATEGORY_COLORS: Record<string, string> = {
  mechanical: '#0087FF',
  body_work: '#FF9800',
  electrical: '#9C27B0',
  maintenance: '#00BCD4',
};

interface VehicleInfo {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  fuel_type: string | null;
  mileage: number | null;
  vin: string | null;
}

interface HistoryJob {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  created_at: string;
  grand_total: number;
  labour_total: number;
  parts_total: number;
  parts_lines: Array<{ id: string; part_name: string; part_number: string | null; quantity: number }>;
}

interface CostCategory {
  labour: number;
  parts: number;
  total: number;
  count: number;
}

interface CostSummary {
  total_spent: number;
  labour_total: number;
  parts_total: number;
  job_count: number;
  by_category: Record<string, CostCategory>;
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
  cost_summary: CostSummary;
}

type Tab = 'history' | 'costs' | 'parts';

export default function VehicleDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId: string; vehiclePlate?: string }>();

  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('history');

  const fetchData = useCallback(async () => {
    try {
      const [v, h] = await Promise.all([
        apiGet<VehicleInfo>(`/vehicles/${params.vehicleId}`),
        apiGet<VehicleHistory>(`/vehicles/${params.vehicleId}/history`),
      ]);
      setVehicle(v);
      setHistory(h);
    } catch {
      Alert.alert(t('common.error'), t('vehicleDetail.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.vehicleId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: params.vehiclePlate ?? t('vehicleDetail.title') }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('vehicleDetail.title') }} />
        <Text style={styles.empty}>{t('common.noResults')}</Text>
      </View>
    );
  }

  const jobs = history?.jobs ?? [];
  const parts = history?.parts_history ?? [];
  const costs = history?.cost_summary;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: vehicle.plate, headerBackTitle: t('common.back') }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PRIMARY} />}
      >
        {/* Vehicle card */}
        <View style={styles.vehicleCard}>
          <Text style={styles.plate}>{vehicle.plate}</Text>
          <Text style={styles.makeModel}>
            {vehicle.make} {vehicle.model}{vehicle.year ? ` (${vehicle.year})` : ''}
          </Text>
          <View style={styles.infoRow}>
            {vehicle.mileage != null && (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>{vehicle.mileage.toLocaleString()} km</Text>
              </View>
            )}
            {vehicle.color && (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>{vehicle.color}</Text>
              </View>
            )}
            {vehicle.fuel_type && (
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>{vehicle.fuel_type}</Text>
              </View>
            )}
          </View>
          {costs && (
            <Text style={styles.jobCountText}>
              {t('vehicleDetail.jobCount', { count: costs.job_count })}
            </Text>
          )}
        </View>

        {/* Cost summary card */}
        {costs && costs.total_spent > 0 && (
          <View style={styles.costCard}>
            <Text style={styles.costCardTitle}>{t('vehicleDetail.costSummary')}</Text>
            <Text style={styles.totalSpent}>
              {costs.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.totalSpentLabel}>{t('vehicleDetail.totalSpent')}</Text>

            {/* Labour vs Parts bar */}
            <View style={styles.costBarContainer}>
              <View style={styles.costBar}>
                {costs.labour_total > 0 && (
                  <View
                    style={[styles.costBarSegment, {
                      flex: costs.labour_total,
                      backgroundColor: PRIMARY,
                      borderTopLeftRadius: 6,
                      borderBottomLeftRadius: 6,
                    }]}
                  />
                )}
                {costs.parts_total > 0 && (
                  <View
                    style={[styles.costBarSegment, {
                      flex: costs.parts_total,
                      backgroundColor: '#FF9800',
                      borderTopRightRadius: 6,
                      borderBottomRightRadius: 6,
                    }]}
                  />
                )}
              </View>
              <View style={styles.costLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: PRIMARY }]} />
                  <Text style={styles.legendText}>
                    {t('vehicleDetail.labourCost')} — {costs.labour_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.legendText}>
                    {t('vehicleDetail.partsCost')} — {costs.parts_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            {/* By category */}
            {Object.keys(costs.by_category).length > 0 && (
              <>
                <Text style={styles.byCategoryTitle}>{t('vehicleDetail.byCategory')}</Text>
                {Object.entries(costs.by_category).map(([cat, data]) => (
                  <View key={cat} style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[cat] ?? '#8E8E93' }]} />
                    <Text style={styles.categoryName}>
                      {t(`vehicleDetail.categories.${cat}`, cat)}
                    </Text>
                    <Text style={styles.categoryCount}>{data.count} job(s)</Text>
                    <Text style={styles.categoryTotal}>
                      {data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Tab selector */}
        <View style={styles.tabRow}>
          {(['history', 'costs', 'parts'] as Tab[]).map((t_) => (
            <TouchableOpacity
              key={t_}
              style={[styles.tab, tab === t_ && styles.tabActive]}
              onPress={() => setTab(t_)}
            >
              <Text style={[styles.tabText, tab === t_ && styles.tabTextActive]}>
                {t_ === 'history' ? t('vehicleDetail.repairHistory')
                  : t_ === 'costs' ? t('vehicleDetail.costSummary')
                  : t('vehicleDetail.partsHistory')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Repair History */}
        {tab === 'history' && (
          <View style={styles.tabContent}>
            {jobs.length === 0 ? (
              <Text style={styles.emptyTab}>{t('vehicleDetail.noHistory')}</Text>
            ) : (
              jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.historyCard}
                  onPress={() => router.push({ pathname: '/job-detail', params: { jobId: job.id, jobNumber: job.job_number } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyJobNum}>{job.job_number}</Text>
                    <View style={[styles.historyBadge, { backgroundColor: STATUS_COLORS[job.status] ?? '#8E8E93' }]}>
                      <Text style={styles.historyBadgeText}>{t(`jobs.status.${job.status}`, job.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyProblem} numberOfLines={2}>{job.reported_problem}</Text>
                  <View style={styles.historyFooter}>
                    <Text style={styles.historyDate}>{new Date(job.created_at).toLocaleDateString()}</Text>
                    {job.grand_total > 0 && (
                      <Text style={styles.historyTotal}>{job.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Cost detail per job */}
        {tab === 'costs' && (
          <View style={styles.tabContent}>
            {jobs.length === 0 ? (
              <Text style={styles.emptyTab}>{t('vehicleDetail.noHistory')}</Text>
            ) : (
              jobs.filter((j) => j.grand_total > 0).map((job) => (
                <View key={job.id} style={styles.costJobCard}>
                  <View style={styles.costJobHeader}>
                    <Text style={styles.costJobNum}>{job.job_number}</Text>
                    <Text style={styles.costJobTotal}>{job.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.costJobBreakdown}>
                    <Text style={styles.costJobLine}>{t('jobDetail.labour')}: {job.labour_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    <Text style={styles.costJobLine}>{t('jobDetail.parts')}: {job.parts_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <Text style={styles.historyDate}>{new Date(job.created_at).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Parts history */}
        {tab === 'parts' && (
          <View style={styles.tabContent}>
            {parts.length === 0 ? (
              <Text style={styles.emptyTab}>{t('vehicleDetail.noPartsHistory')}</Text>
            ) : (
              parts.map((part, i) => (
                <View key={i} style={styles.partCard}>
                  <Text style={styles.partName}>{part.part_name}</Text>
                  {part.part_number && <Text style={styles.partNumber}>{part.part_number}</Text>}
                  <Text style={styles.partMeta}>
                    {t('vehicleDetail.lastInstalled')}: {new Date(part.last_installed).toLocaleDateString()}
                  </Text>
                  <Text style={styles.partMeta}>
                    {t('vehicleDetail.totalInstalled', { count: part.install_count, jobs: part.jobs.length })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  empty: { color: '#8E8E93', fontSize: 16 },

  // Vehicle card
  vehicleCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 14,
    padding: 20,
    borderLeftWidth: 5,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  plate: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', letterSpacing: 2, marginBottom: 4 },
  makeModel: { fontSize: 17, color: '#636366', marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  infoPill: { backgroundColor: '#F5F5F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA' },
  infoPillText: { fontSize: 13, fontWeight: '600', color: '#363638' },
  jobCountText: { fontSize: 13, color: PRIMARY, fontWeight: '600', marginTop: 4 },

  // Cost card
  costCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  costCardTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  totalSpent: { fontSize: 32, fontWeight: '800', color: '#1C1C1E' },
  totalSpentLabel: { fontSize: 14, color: '#8E8E93', marginBottom: 16 },
  costBarContainer: { marginBottom: 16 },
  costBar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  costBarSegment: { height: '100%' },
  costLegend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: '#636366' },
  byCategoryTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 10 },
  categoryName: { flex: 1, fontSize: 14, color: '#363638' },
  categoryCount: { fontSize: 12, color: '#8E8E93', marginEnd: 12 },
  categoryTotal: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 10, backgroundColor: '#fff', padding: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#E3F2FD' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: PRIMARY },
  tabContent: { paddingHorizontal: 16 },
  emptyTab: { textAlign: 'center', color: '#8E8E93', fontSize: 15, marginTop: 32 },

  // History cards
  historyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: PRIMARY, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyJobNum: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  historyBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  historyProblem: { fontSize: 14, color: '#636366', lineHeight: 20, marginBottom: 6 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  historyDate: { fontSize: 12, color: '#8E8E93' },
  historyTotal: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },

  // Cost per job
  costJobCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  costJobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costJobNum: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  costJobTotal: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  costJobBreakdown: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  costJobLine: { fontSize: 13, color: '#636366' },

  // Parts
  partCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#00BCD4', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  partName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 2 },
  partNumber: { fontSize: 13, color: '#8E8E93', marginBottom: 4 },
  partMeta: { fontSize: 13, color: '#636366', marginTop: 2 },
});
