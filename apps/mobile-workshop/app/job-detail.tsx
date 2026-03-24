import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';

const STATUS_COLORS: Record<string, string> = {
  received: '#2196F3',
  diagnosing: '#9C27B0',
  awaiting_approval: '#FF9800',
  insurance_review: '#FF5722',
  in_progress: '#4CAF50',
  awaiting_parts: '#FFC107',
  quality_check: '#00BCD4',
  ready: '#8BC34A',
  invoiced: '#607D8B',
};

// Mirrors backend VALID_TRANSITIONS
const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ['diagnosing', 'in_progress'],
  diagnosing: ['awaiting_approval', 'in_progress', 'insurance_review'],
  awaiting_approval: ['in_progress', 'received'],
  insurance_review: ['awaiting_approval', 'in_progress'],
  in_progress: ['awaiting_parts', 'quality_check'],
  awaiting_parts: ['in_progress'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced', 'in_progress'],
  invoiced: [],
};

interface JobDetail {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  internal_notes: string | null;
  is_insurance: boolean;
  insurance_company: string | null;
  policy_number: string | null;
  created_at: string;
  status_history?: Array<{
    from_status: string | null;
    to_status: string;
    changed_at: string;
    notes: string | null;
  }>;
  vehicle?: {
    id: string;
    plate: string;
    make: string;
    model: string;
    year: number;
  };
  customer?: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
  };
  primary_technician?: {
    id: string;
    full_name: string;
  };
}

interface InspectionSummary {
  id: string;
  mileage_in: number | null;
  fuel_level: string | null;
  exterior_damage: Array<{
    location: string;
    type: string;
    description?: string;
  }>;
  created_at: string;
}

export default function JobDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string; jobNumber?: string }>();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [inspection, setInspection] = useState<InspectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status change modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedNextStatus, setSelectedNextStatus] = useState<string | null>(
    null,
  );
  const [statusNotes, setStatusNotes] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobData, inspectionData] = await Promise.all([
        apiFetch<JobDetail>(`/jobs/${params.jobId}`),
        apiFetch<InspectionSummary | null>(
          `/inspections/job/${params.jobId}`,
        ).catch(() => null),
      ]);
      setJob(jobData);
      setInspection(inspectionData);
    } catch {
      Alert.alert(t('common.error'), t('jobs.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.jobId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleStartInspection = () => {
    if (!job) return;
    router.push({
      pathname: '/inspection',
      params: {
        jobId: job.id,
        vehicleId: job.vehicle?.id ?? '',
        jobNumber: job.job_number,
        vehiclePlate: job.vehicle?.plate ?? '',
      },
    });
  };

  const handleStatusChange = async () => {
    if (!job || !selectedNextStatus) return;

    setChangingStatus(true);
    try {
      await apiFetch(`/jobs/${job.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: selectedNextStatus,
          ...(statusNotes.trim() ? { notes: statusNotes.trim() } : {}),
        }),
      });

      setStatusModalVisible(false);
      setSelectedNextStatus(null);
      setStatusNotes('');
      // Refresh to get updated data
      await fetchData();
      Alert.alert(t('common.success'), t('jobs.statusChangeSuccess'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('jobs.statusChangeError'),
      );
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{ title: params.jobNumber ?? t('jobs.title') }}
        />
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('jobs.title') }} />
        <Text style={styles.empty}>{t('common.noResults')}</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[job.status] ?? '#8E8E93';
  const allowedTransitions = VALID_TRANSITIONS[job.status] ?? [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: job.job_number,
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4CAF50"
          />
        }
      >
        {/* Status header */}
        <View style={styles.statusHeader}>
          <Text style={styles.jobNumberLarge}>{job.job_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {t(`jobs.status.${job.status}`, job.status)}
            </Text>
          </View>
        </View>

        {/* Status transition buttons */}
        {allowedTransitions.length > 0 && (
          <View style={styles.transitionSection}>
            <Text style={styles.transitionLabel}>{t('jobs.moveTo')}:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.transitionRow}
            >
              {allowedTransitions.map((nextStatus) => (
                <TouchableOpacity
                  key={nextStatus}
                  style={[
                    styles.transitionButton,
                    {
                      borderColor:
                        STATUS_COLORS[nextStatus] ?? '#8E8E93',
                    },
                  ]}
                  onPress={() => {
                    setSelectedNextStatus(nextStatus);
                    setStatusNotes('');
                    setStatusModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.transitionDot,
                      {
                        backgroundColor:
                          STATUS_COLORS[nextStatus] ?? '#8E8E93',
                      },
                    ]}
                  />
                  <Text style={styles.transitionText}>
                    {t(`jobs.status.${nextStatus}`, nextStatus)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Vehicle card — tappable to view vehicle history */}
        {job.vehicle && (
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() =>
              router.push({
                pathname: '/vehicle-detail',
                params: {
                  vehicleId: job.vehicle!.id,
                  vehiclePlate: job.vehicle!.plate,
                },
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.infoCardHeaderRow}>
              <Text style={styles.infoCardTitle}>{t('tabs.vehicles')}</Text>
              <Text style={styles.viewHistoryLink}>{t('vehicleDetail.repairHistory')} →</Text>
            </View>
            <Text style={styles.plate}>{job.vehicle.plate}</Text>
            <Text style={styles.vehicleDetail}>
              {job.vehicle.make} {job.vehicle.model}{' '}
              {job.vehicle.year ? `(${job.vehicle.year})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Customer card */}
        {job.customer && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{t('tabs.customers')}</Text>
            <Text style={styles.customerName}>{job.customer.full_name}</Text>
            {job.customer.phone && (
              <Text style={styles.customerDetail}>{job.customer.phone}</Text>
            )}
          </View>
        )}

        {/* Problem */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{t('jobs.reportedProblem')}</Text>
          <Text style={styles.problemText}>{job.reported_problem}</Text>
        </View>

        {/* Insurance */}
        {job.is_insurance && (
          <View style={[styles.infoCard, { borderLeftColor: '#FF9800' }]}>
            <Text style={styles.infoCardTitle}>{t('jobs.insurance')}</Text>
            {job.insurance_company && (
              <Text style={styles.customerDetail}>
                {t('jobs.insuranceCompany')}: {job.insurance_company}
              </Text>
            )}
            {job.policy_number && (
              <Text style={styles.customerDetail}>
                {t('jobs.policyNumber')}: {job.policy_number}
              </Text>
            )}
          </View>
        )}

        {/* Inspection status */}
        <View style={styles.inspectionCard}>
          <Text style={styles.inspectionTitle}>{t('inspection.title')}</Text>
          {inspection ? (
            <View>
              <Text style={styles.inspectionDone}>
                {inspection.mileage_in != null
                  ? `${t('inspection.mileage')}: ${inspection.mileage_in} km`
                  : ''}
                {inspection.fuel_level
                  ? `  |  ${t('inspection.fuelLevel')}: ${t(`inspection.fuelLevels.${inspection.fuel_level}`)}`
                  : ''}
              </Text>
              {inspection.exterior_damage.length > 0 && (
                <Text style={styles.damageCount}>
                  {inspection.exterior_damage.length}{' '}
                  {t('inspection.addDamage').toLowerCase()}(s)
                </Text>
              )}
              <TouchableOpacity
                style={styles.inspectionButton}
                onPress={handleStartInspection}
              >
                <Text style={styles.inspectionButtonText}>
                  {t('jobs.viewInspection')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.startInspectionButton}
              onPress={handleStartInspection}
              activeOpacity={0.8}
            >
              <Text style={styles.startInspectionText}>
                {t('jobs.startInspection')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status history */}
        {job.status_history && job.status_history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>
              {t('jobs.statusHistory')}
            </Text>
            {job.status_history.map((entry, i) => (
              <View key={i} style={styles.historyItem}>
                <View
                  style={[
                    styles.historyDot,
                    {
                      backgroundColor:
                        STATUS_COLORS[entry.to_status] ?? '#8E8E93',
                    },
                  ]}
                />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>
                    {entry.from_status
                      ? `${t(`jobs.status.${entry.from_status}`, entry.from_status)} → `
                      : ''}
                    {t(`jobs.status.${entry.to_status}`, entry.to_status)}
                  </Text>
                  {entry.notes && (
                    <Text style={styles.historyNotes}>{entry.notes}</Text>
                  )}
                  <Text style={styles.historyDate}>
                    {new Date(entry.changed_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Gate Pass */}
        <TouchableOpacity
          style={styles.gatePassBtn}
          onPress={() =>
            router.push({
              pathname: '/gate-pass',
              params: {
                jobId: job.id,
                jobNumber: job.job_number,
                vehicleId: job.vehicle?.id ?? '',
                customerId: job.customer?.id ?? '',
              },
            })
          }
          activeOpacity={0.7}
        >
          <Text style={styles.gatePassIcon}>🚧</Text>
          <Text style={styles.gatePassText}>{t('gatePass.title')}</Text>
          <Text style={styles.gatePassArrow}>→</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status change modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('jobs.changeStatus')}</Text>
            <Text style={styles.modalSubtitle}>
              {t(`jobs.status.${job.status}`)} →{' '}
              {selectedNextStatus
                ? t(`jobs.status.${selectedNextStatus}`)
                : ''}
            </Text>

            {selectedNextStatus && (
              <View
                style={[
                  styles.nextStatusPreview,
                  {
                    backgroundColor:
                      STATUS_COLORS[selectedNextStatus] ?? '#8E8E93',
                  },
                ]}
              >
                <Text style={styles.nextStatusText}>
                  {t(`jobs.status.${selectedNextStatus}`)}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder={t('jobs.statusNotesPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={statusNotes}
              onChangeText={setStatusNotes}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  changingStatus && { opacity: 0.6 },
                ]}
                onPress={handleStatusChange}
                disabled={changingStatus}
              >
                {changingStatus ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t('common.confirm')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Status header
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  jobNumberLarge: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Status transitions
  transitionSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  transitionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 8,
  },
  transitionRow: { gap: 8 },
  transitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
  },
  transitionDot: { width: 8, height: 8, borderRadius: 4 },
  transitionText: { fontSize: 14, fontWeight: '600', color: '#363638' },

  // Info cards
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewHistoryLink: {
    fontSize: 12,
    color: '#0087FF',
    fontWeight: '600',
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  plate: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  vehicleDetail: { fontSize: 15, color: '#636366' },
  customerName: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  customerDetail: { fontSize: 14, color: '#636366', marginTop: 2 },
  problemText: { fontSize: 15, color: '#363638', lineHeight: 22 },

  // Inspection
  inspectionCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  inspectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F57F17',
    marginBottom: 10,
  },
  inspectionDone: { fontSize: 14, color: '#636366', marginBottom: 4 },
  damageCount: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '600',
    marginBottom: 8,
  },
  inspectionButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  inspectionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  startInspectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 16,
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  startInspectionText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Status history
  historySection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginEnd: 10,
  },
  historyContent: { flex: 1 },
  historyStatus: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  historyNotes: {
    fontSize: 13,
    color: '#636366',
    fontStyle: 'italic',
    marginTop: 2,
  },
  historyDate: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#636366',
    marginBottom: 16,
  },
  nextStatusPreview: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 16,
  },
  nextStatusText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCancelText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  modalConfirm: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Gate pass
  gatePassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 10,
  },
  gatePassIcon: { fontSize: 22 },
  gatePassText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  gatePassArrow: { fontSize: 18, color: '#8E8E93' },
});
