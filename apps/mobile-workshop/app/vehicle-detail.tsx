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
import { apiFetch } from '../src/lib/api';
import { timeAgo } from '../src/lib/timeAgo';

const PRIMARY = '#0087FF';

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
  customers?: { full_name: string; phone: string } | null;
}

interface PartLine {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  created_at: string;
}

interface HistoryJob {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  created_at: string;
  date_closed: string | null;
  grand_total: number;
  customer?: { id: string; full_name: string } | null;
  primary_technician?: { id: string; full_name: string } | null;
  parts_lines: PartLine[];
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

type Tab = 'history' | 'parts';

export default function VehicleDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    vehicleId: string;
    vehiclePlate?: string;
  }>();

  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('history');

  const fetchData = useCallback(async () => {
    try {
      const [vehicleData, historyData] = await Promise.all([
        apiFetch<VehicleInfo>(`/vehicles/${params.vehicleId}`),
        apiFetch<VehicleHistory>(`/vehicles/${params.vehicleId}/history`),
      ]);
      setVehicle(vehicleData);
      setHistory(historyData);
    } catch {
      Alert.alert(t('common.error'), t('vehicleDetail.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.vehicleId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{
            title: params.vehiclePlate ?? t('vehicleDetail.title'),
          }}
        />
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
  const partsHistory = history?.parts_history ?? [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: vehicle.plate,
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
          />
        }
      >
        {/* Vehicle info card */}
        <View style={styles.vehicleCard}>
          <Text style={styles.plate}>{vehicle.plate}</Text>
          <Text style={styles.makeModel}>
            {vehicle.make} {vehicle.model}
            {vehicle.year ? ` (${vehicle.year})` : ''}
          </Text>

          <View style={styles.infoGrid}>
            {vehicle.mileage != null && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t('vehicleDetail.mileage')}
                </Text>
                <Text style={styles.infoValue}>
                  {vehicle.mileage.toLocaleString()} km
                </Text>
              </View>
            )}
            {vehicle.color && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t('vehicleDetail.color')}
                </Text>
                <Text style={styles.infoValue}>{vehicle.color}</Text>
              </View>
            )}
            {vehicle.fuel_type && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t('vehicleDetail.fuelType')}
                </Text>
                <Text style={styles.infoValue}>{vehicle.fuel_type}</Text>
              </View>
            )}
            {vehicle.vin && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('vehicleDetail.vin')}</Text>
                <Text style={[styles.infoValue, { fontSize: 12 }]}>
                  {vehicle.vin}
                </Text>
              </View>
            )}
          </View>

          {vehicle.customers?.full_name && (
            <View style={styles.ownerRow}>
              <Text style={styles.ownerLabel}>
                {t('vehicleDetail.owner')}:
              </Text>
              <Text style={styles.ownerName}>
                {vehicle.customers.full_name}
              </Text>
            </View>
          )}

          <Text style={styles.jobCount}>
            {t('vehicleDetail.jobCount', { count: jobs.length })}
          </Text>
        </View>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'history' && styles.tabTextActive,
              ]}
            >
              {t('vehicleDetail.repairHistory')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'parts' && styles.tabActive]}
            onPress={() => setActiveTab('parts')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'parts' && styles.tabTextActive,
              ]}
            >
              {t('vehicleDetail.partsHistory')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── REPAIR HISTORY TAB ─── */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            {jobs.length === 0 ? (
              <Text style={styles.emptyTab}>
                {t('vehicleDetail.noHistory')}
              </Text>
            ) : (
              jobs.map((job) => {
                const statusColor = STATUS_COLORS[job.status] ?? '#8E8E93';
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.historyCard}
                    onPress={() =>
                      router.push({
                        pathname: '/job-detail',
                        params: {
                          jobId: job.id,
                          jobNumber: job.job_number,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyJobNumber}>
                        {job.job_number}
                      </Text>
                      <View style={styles.historyHeaderRight}>
                        <Text style={styles.historyTimeAgo}>
                          {timeAgo(job.created_at, t)}
                        </Text>
                        <View
                          style={[
                            styles.historyBadge,
                            { backgroundColor: statusColor },
                          ]}
                        >
                          <Text style={styles.historyBadgeText}>
                            {t(`jobs.status.${job.status}`, job.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.historyProblem} numberOfLines={2}>
                      {job.reported_problem}
                    </Text>

                    <View style={styles.historyFooter}>
                      <Text style={styles.historyDate}>
                        {new Date(job.created_at).toLocaleDateString()}
                      </Text>
                      {job.parts_lines.length > 0 && (
                        <Text style={styles.historyParts}>
                          {t('vehicleDetail.partsUsed', {
                            count: job.parts_lines.length,
                          })}
                        </Text>
                      )}
                      {job.grand_total > 0 && (
                        <Text style={styles.historyTotal}>
                          {job.grand_total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      )}
                    </View>

                    {/* Parts used in this job */}
                    {job.parts_lines.length > 0 && (
                      <View style={styles.partsInJob}>
                        {job.parts_lines.map((pl) => (
                          <View key={pl.id} style={styles.partLineRow}>
                            <Text style={styles.partLineName}>
                              {pl.part_name}
                              {pl.part_number
                                ? ` (${pl.part_number})`
                                : ''}
                            </Text>
                            <Text style={styles.partLineQty}>
                              x{pl.quantity}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ─── PARTS HISTORY TAB ─── */}
        {activeTab === 'parts' && (
          <View style={styles.tabContent}>
            {partsHistory.length === 0 ? (
              <Text style={styles.emptyTab}>
                {t('vehicleDetail.noPartsHistory')}
              </Text>
            ) : (
              partsHistory.map((part, i) => (
                <View key={i} style={styles.partHistoryCard}>
                  <View style={styles.partHistoryHeader}>
                    <Text style={styles.partHistoryName}>
                      {part.part_name}
                    </Text>
                    {part.part_number && (
                      <Text style={styles.partHistoryNumber}>
                        {part.part_number}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.partHistoryLastInstalled}>
                    {t('vehicleDetail.lastInstalled')}:{' '}
                    {new Date(part.last_installed).toLocaleDateString()} (
                    {timeAgo(part.last_installed, t)})
                  </Text>
                  <Text style={styles.partHistoryTotal}>
                    {t('vehicleDetail.totalInstalled', {
                      count: part.install_count,
                      jobs: part.jobs.length,
                    })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  empty: { color: '#8E8E93', fontSize: 16 },

  // Vehicle card
  vehicleCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    borderLeftWidth: 5,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  plate: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: 2,
    marginBottom: 4,
  },
  makeModel: { fontSize: 17, color: '#636366', marginBottom: 16 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ownerLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '600' },
  ownerName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  jobCount: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 4,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: PRIMARY },
  tabContent: { paddingHorizontal: 16 },
  emptyTab: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 15,
    marginTop: 32,
  },

  // History cards
  historyCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyJobNumber: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  historyTimeAgo: { fontSize: 12, color: '#8E8E93' },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  historyBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  historyProblem: { fontSize: 14, color: '#636366', lineHeight: 20, marginBottom: 8 },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDate: { fontSize: 12, color: '#8E8E93' },
  historyParts: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  historyTotal: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },

  // Parts used in job
  partsInJob: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
  },
  partLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  partLineName: { fontSize: 13, color: '#636366', flex: 1 },
  partLineQty: { fontSize: 13, fontWeight: '600', color: '#363638' },

  // Parts history tab
  partHistoryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00BCD4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  partHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partHistoryName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  partHistoryNumber: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: '500',
  },
  partHistoryLastInstalled: { fontSize: 13, color: '#636366', marginBottom: 2 },
  partHistoryTotal: { fontSize: 12, color: '#8E8E93' },
});
