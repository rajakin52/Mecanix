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
import { apiGet, apiPost } from '../src/lib/api';
import RepairTracker from '../src/components/RepairTracker';
import TieredQuote from '../src/components/TieredQuote';

const PRIMARY = '#0087FF';

const STATUS_STEPS = [
  'received',
  'diagnosing',
  'awaiting_approval',
  'in_progress',
  'quality_check',
  'ready',
  'invoiced',
];

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

interface LabourLine {
  id: string;
  description: string;
  hours: number;
  rate: number;
  subtotal: number;
}

interface PartsLine {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  sell_price: number;
  subtotal: number;
}

interface JobData {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  internal_notes: string | null;
  is_insurance: boolean;
  labour_total: number;
  parts_total: number;
  tax_amount: number;
  grand_total: number;
  created_at: string;
  vehicle?: { id: string; plate: string; make: string; model: string; year: number | null };
  customer?: { id: string; full_name: string; phone: string };
  labour_lines: LabourLine[];
  parts_lines: PartsLine[];
  status_history?: Array<{ from_status: string | null; to_status: string; changed_at: string; notes: string | null }>;
}

export default function JobDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string; jobNumber?: string }>();

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const data = await apiGet<JobData>(`/jobs/${params.jobId}`);
      setJob(data);
    } catch {
      Alert.alert(t('common.error'), t('jobDetail.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.jobId, t]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleApprove = () => {
    Alert.alert(t('jobDetail.approveQuote'), t('jobDetail.approveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiPost(`/jobs/${params.jobId}/status`, { status: 'in_progress', notes: 'Approved by customer' });
            await fetchJob();
            Alert.alert(t('common.success'), t('jobDetail.approveSuccess'));
          } catch {
            Alert.alert(t('common.error'), t('jobDetail.statusError'));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = () => {
    Alert.alert(t('jobDetail.rejectQuote'), t('jobDetail.rejectConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiPost(`/jobs/${params.jobId}/status`, { status: 'received', notes: 'Rejected by customer' });
            await fetchJob();
            Alert.alert(t('common.success'), t('jobDetail.rejectSuccess'));
          } catch {
            Alert.alert(t('common.error'), t('jobDetail.statusError'));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: params.jobNumber ?? t('jobDetail.title') }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('jobDetail.title') }} />
        <Text style={styles.empty}>{t('common.noResults')}</Text>
      </View>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(job.status);
  const isAwaitingApproval = job.status === 'awaiting_approval';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: job.job_number, headerBackTitle: t('common.back') }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJob(); }} tintColor={PRIMARY} />}
      >
        {/* Animated Repair Tracker */}
        <RepairTracker currentStatus={job.status} />

        {/* Tiered Quote Approval */}
        {isAwaitingApproval && (
          <TieredQuote
            labourLines={job.labour_lines}
            partsLines={job.parts_lines}
            labourTotal={job.labour_total}
            partsTotal={job.parts_total}
            taxAmount={job.tax_amount}
            grandTotal={job.grand_total}
            onSelectTier={(_tier) => handleApprove()}
            actionLoading={actionLoading}
          />
        )}

        {/* Vehicle */}
        {job.vehicle && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/vehicle-detail', params: { vehicleId: job.vehicle!.id, vehiclePlate: job.vehicle!.plate } })}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('jobDetail.vehicleInfo')}</Text>
              <Text style={styles.historyLink}>{t('jobDetail.viewVehicleHistory')}</Text>
            </View>
            <Text style={styles.plateText}>{job.vehicle.plate}</Text>
            <Text style={styles.cardSubtext}>
              {job.vehicle.make} {job.vehicle.model}{job.vehicle.year ? ` (${job.vehicle.year})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Problem */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('jobDetail.problem')}</Text>
          <Text style={styles.problemText}>{job.reported_problem}</Text>
        </View>

        {/* Cost breakdown */}
        {job.grand_total > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('jobDetail.costBreakdown')}</Text>
            {job.labour_lines.length > 0 && (
              <>
                <Text style={styles.lineGroupTitle}>{t('jobDetail.labourLines')}</Text>
                {job.labour_lines.map((l) => (
                  <View key={l.id} style={styles.lineRow}>
                    <Text style={styles.lineDesc}>{l.description}</Text>
                    <Text style={styles.lineAmount}>{l.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                ))}
              </>
            )}
            {job.parts_lines.length > 0 && (
              <>
                <Text style={styles.lineGroupTitle}>{t('jobDetail.partsLines')}</Text>
                {job.parts_lines.map((p) => (
                  <View key={p.id} style={styles.lineRow}>
                    <Text style={styles.lineDesc}>{p.part_name} x{p.quantity}</Text>
                    <Text style={styles.lineAmount}>{p.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                ))}
              </>
            )}
            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('jobDetail.labour')}</Text>
                <Text style={styles.totalValue}>{job.labour_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('jobDetail.parts')}</Text>
                <Text style={styles.totalValue}>{job.parts_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              {job.tax_amount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('jobDetail.tax')}</Text>
                  <Text style={styles.totalValue}>{job.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>{t('jobDetail.grandTotal')}</Text>
                <Text style={styles.grandTotalValue}>{job.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
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

  // Stepper
  stepperContainer: { backgroundColor: '#fff', margin: 16, borderRadius: 14, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  stepperLabel: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  stepper: { },
  stepItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDotCurrent: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  stepCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 13, color: '#8E8E93', marginStart: 10, flex: 1 },
  stepLine: { position: 'absolute', left: 11, top: 24, width: 2, height: 14, backgroundColor: '#E5E5EA' },

  // Approval banner
  approvalBanner: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD54F',
    alignItems: 'center',
  },
  approvalTitle: { fontSize: 16, fontWeight: '700', color: '#F57F17', marginBottom: 8 },
  approvalTotal: { fontSize: 32, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  approvalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  rejectBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 2, borderColor: '#D32F2F', alignItems: 'center', minHeight: 48 },
  rejectBtnText: { color: '#D32F2F', fontSize: 15, fontWeight: '700' },
  approveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#4CAF50', alignItems: 'center', minHeight: 48, justifyContent: 'center', shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  approveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 },
  historyLink: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  plateText: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', letterSpacing: 1, marginBottom: 2 },
  cardSubtext: { fontSize: 15, color: '#636366' },
  problemText: { fontSize: 15, color: '#363638', lineHeight: 22 },

  // Cost lines
  lineGroupTitle: { fontSize: 14, fontWeight: '700', color: '#363638', marginTop: 12, marginBottom: 6 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#F5F5F7' },
  lineDesc: { fontSize: 14, color: '#636366', flex: 1 },
  lineAmount: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  totalSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 14, color: '#636366' },
  totalValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  grandTotalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
});
