import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, Stack } from 'expo-router';
import { apiGet } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  line_type: string;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  lines: InvoiceLine[];
  job_card?: { job_number: string };
  customer?: { full_name: string };
  vehicle?: { plate: string; make: string; model: string };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#F5F5F7', text: '#8E8E93' },
  sent: { bg: '#E3F2FD', text: '#1565C0' },
  paid: { bg: '#E8F5E9', text: '#2E7D32' },
  partial: { bg: '#FFF8E1', text: '#F57F17' },
  overdue: { bg: '#FFEBEE', text: '#C62828' },
  void: { bg: '#F5F5F7', text: '#8E8E93' },
};

export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ invoiceId: string }>();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    try {
      const data = await apiGet<InvoiceData>(`/invoices/${params.invoiceId}`);
      setInvoice(data);
    } catch {
      Alert.alert(t('common.error'), t('invoices.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [params.invoiceId, t]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('invoice.title') }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('invoice.title') }} />
        <Text style={styles.empty}>{t('common.noResults')}</Text>
      </View>
    );
  }

  const statusStyle = STATUS_COLORS[invoice.status] ?? { bg: '#F5F5F7', text: '#8E8E93' };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: invoice.invoice_number, headerBackTitle: t('common.back') }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {t(`invoices.${invoice.status}`, invoice.status)}
            </Text>
          </View>
        </View>

        {/* Dates & info */}
        <View style={styles.infoCard}>
          {invoice.job_card && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Job</Text>
              <Text style={styles.infoValue}>{invoice.job_card.job_number}</Text>
            </View>
          )}
          {invoice.vehicle && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('jobs.vehicle')}</Text>
              <Text style={styles.infoValue}>
                {invoice.vehicle.plate} — {invoice.vehicle.make} {invoice.vehicle.model}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('invoices.date')}</Text>
            <Text style={styles.infoValue}>
              {new Date(invoice.issue_date).toLocaleDateString()}
            </Text>
          </View>
          {invoice.due_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('invoices.dueDate')}</Text>
              <Text style={styles.infoValue}>
                {new Date(invoice.due_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Line items */}
        <View style={styles.linesCard}>
          {invoice.lines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <View style={styles.lineLeft}>
                <Text style={styles.lineDesc}>{line.description}</Text>
                <Text style={styles.lineQty}>
                  {line.quantity} x {line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <Text style={styles.lineTotal}>
                {line.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('invoices.subtotal')}</Text>
            <Text style={styles.totalValue}>
              {invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {invoice.tax_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('invoices.tax')}</Text>
              <Text style={styles.totalValue}>
                {invoice.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>{t('invoices.total')}</Text>
            <Text style={styles.grandValue}>
              {invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {invoice.balance_due > 0 && (
            <View style={styles.dueRow}>
              <Text style={styles.dueLabel}>{t('invoices.amountDue')}</Text>
              <Text style={styles.dueValue}>
                {invoice.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  empty: { color: '#8E8E93', fontSize: 16 },
  content: { padding: 16 },

  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  invoiceNumber: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 13, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F7',
  },
  infoLabel: { fontSize: 14, color: '#8E8E93' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },

  linesCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F7',
  },
  lineLeft: { flex: 1 },
  lineDesc: { fontSize: 15, color: '#1C1C1E', fontWeight: '500' },
  lineQty: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  lineTotal: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },

  totalsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 15, color: '#636366' },
  totalValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  grandRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  grandLabel: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  grandValue: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  dueLabel: { fontSize: 15, fontWeight: '600', color: '#C62828' },
  dueValue: { fontSize: 18, fontWeight: '800', color: '#C62828' },
});
