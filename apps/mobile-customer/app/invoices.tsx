import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { apiGet } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  balance_due: number;
  job_card?: { job_number: string } | null;
  vehicle?: { plate: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  paid: { bg: '#E8F5E9', text: '#2E7D32' },
  sent: { bg: '#E3F2FD', text: '#1565C0' },
  draft: { bg: '#F5F5F7', text: '#8E8E93' },
  partial: { bg: '#FFF8E1', text: '#F57F17' },
  overdue: { bg: '#FFEBEE', text: '#C62828' },
  void: { bg: '#F5F5F7', text: '#8E8E93' },
};

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await apiGet<Invoice[] | { data: Invoice[] }>('/invoices?pageSize=100');
      const list = Array.isArray(response) ? response : (response as { data: Invoice[] }).data ?? [];
      setInvoices(list);
    } catch { /* empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const style = STATUS_STYLES[item.status] ?? { bg: '#F5F5F7', text: '#8E8E93' };
    const isOverdue = item.status === 'overdue' || (item.balance_due > 0 && item.due_date && new Date(item.due_date) < new Date());

    return (
      <TouchableOpacity
        style={[styles.card, isOverdue && styles.cardOverdue]}
        onPress={() => router.push({ pathname: '/invoice-detail', params: { invoiceId: item.id } })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
            <Text style={[styles.statusText, { color: style.text }]}>
              {t(`invoices.${item.status}`, item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {item.vehicle && <Text style={styles.vehiclePlate}>{item.vehicle.plate}</Text>}
          {item.job_card && <Text style={styles.jobRef}>{item.job_card.job_number}</Text>}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {new Date(item.issue_date).toLocaleDateString()}
          </Text>
          <Text style={styles.totalText}>
            {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {item.balance_due > 0 && (
          <View style={styles.dueBanner}>
            <Text style={styles.dueText}>
              {t('invoices.amountDue')}: {item.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('invoices.title'), headerBackTitle: t('common.back') }} />
      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoice}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInvoices(); }} tintColor={PRIMARY} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyText}>{t('invoices.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: PRIMARY, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardOverdue: { borderLeftColor: '#D32F2F' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  invoiceNumber: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardBody: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  vehiclePlate: { fontSize: 14, fontWeight: '600', color: '#363638' },
  jobRef: { fontSize: 14, color: '#8E8E93' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 13, color: '#8E8E93' },
  totalText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  dueBanner: { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 8, marginTop: 10, alignItems: 'center' },
  dueText: { color: '#C62828', fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#8E8E93', fontWeight: '600' },
});
