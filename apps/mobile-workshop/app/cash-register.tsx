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
  FlatList,
  Modal,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Register {
  id: string;
  status: string;
  opened_at: string;
  opened_by: string;
  opening_float: number;
  closed_at: string | null;
  closing_cash: number | null;
  expected_cash: number | null;
  discrepancy: number | null;
  total_cash_in: number;
  total_card_in: number;
  total_mobile_in: number;
  total_transfer_in: number;
  total_refunds: number;
  total_petty_out: number;
  total_deposits: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  payment_method: string;
  amount: number;
  description: string | null;
  reference: string | null;
  created_at: string;
}

const PAYMENT_METHODS = ['cash', 'card', 'mpesa', 'multicaixa', 'emola', 'pix', 'mbway', 'multibanco', 'transfer'] as const;
const TX_TYPES = ['payment', 'refund', 'petty_cash', 'adjustment'] as const;

const TX_COLORS: Record<string, string> = {
  payment: '#4CAF50',
  refund: '#F44336',
  petty_cash: '#FF9800',
  deposit: '#2196F3',
  adjustment: '#9C27B0',
  float: '#8BC34A',
};

export default function CashRegisterScreen() {
  const { t } = useTranslation();
  const [register, setRegister] = useState<Register | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Open form
  const [openingFloat, setOpeningFloat] = useState('');
  // Close form
  const [showClose, setShowClose] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  // Add transaction
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState<string>('payment');
  const [txMethod, setTxMethod] = useState<string>('cash');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txRef, setTxRef] = useState('');
  // Bank deposit
  const [showDeposit, setShowDeposit] = useState(false);
  const [depAmount, setDepAmount] = useState('');
  const [depBank, setDepBank] = useState('');
  const [depRef, setDepRef] = useState('');
  const [depNotes, setDepNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [reg, txs] = await Promise.all([
        apiFetch<Register | null>('/cash-register/current'),
        apiFetch<Transaction[]>('/cash-register/transactions').catch(() => []),
      ]);
      setRegister(reg);
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch { /* empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpen = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/cash-register/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat: parseFloat(openingFloat) || 0 }),
      });
      setOpeningFloat('');
      Alert.alert(t('common.success'), t('cashRegister.openSuccess'));
      fetchData();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally { setSubmitting(false); }
  };

  const handleClose = async () => {
    if (!closingCash.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/cash-register/close', {
        method: 'POST',
        body: JSON.stringify({
          closingCash: parseFloat(closingCash),
          closeNotes: closeNotes.trim() || undefined,
        }),
      });
      setShowClose(false);
      setClosingCash('');
      setCloseNotes('');
      Alert.alert(t('common.success'), t('cashRegister.closeSuccess'));
      fetchData();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally { setSubmitting(false); }
  };

  const handleAddTx = async () => {
    if (!txAmount.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/cash-register/transactions', {
        method: 'POST',
        body: JSON.stringify({
          transactionType: txType,
          paymentMethod: txMethod,
          amount: parseFloat(txAmount),
          description: txDesc.trim() || undefined,
          reference: txRef.trim() || undefined,
        }),
      });
      setShowAddTx(false);
      setTxAmount(''); setTxDesc(''); setTxRef('');
      fetchData();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally { setSubmitting(false); }
  };

  const handleDeposit = async () => {
    if (!depAmount.trim() || !depBank.trim() || !depRef.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/cash-register/bank-deposits', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(depAmount),
          bankName: depBank.trim(),
          depositReference: depRef.trim(),
          notes: depNotes.trim() || undefined,
        }),
      });
      setShowDeposit(false);
      setDepAmount(''); setDepBank(''); setDepRef(''); setDepNotes('');
      Alert.alert(t('common.success'), t('cashRegister.depositSuccess'));
      fetchData();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('cashRegister.title') }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const isOpen = register?.status === 'open';

  // Compute running totals from transactions
  const runningTotals: Record<string, number> = {};
  let totalIn = 0;
  let totalOut = 0;
  for (const tx of transactions) {
    const amt = Number(tx.amount);
    const method = tx.payment_method;
    if (amt > 0) {
      runningTotals[method] = (runningTotals[method] ?? 0) + amt;
      totalIn += amt;
    } else {
      totalOut += Math.abs(amt);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('cashRegister.title'), headerBackTitle: t('common.back') }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PRIMARY} />}
        contentContainerStyle={styles.content}
      >
        {/* Status card */}
        <View style={[styles.statusCard, isOpen ? styles.statusOpen : styles.statusClosed]}>
          <Text style={styles.statusIcon}>{isOpen ? '🟢' : '🔴'}</Text>
          <Text style={styles.statusText}>
            {isOpen ? t('cashRegister.open') : t('cashRegister.closed')}
          </Text>
          {isOpen && register && (
            <Text style={styles.statusSince}>
              {new Date(register.opened_at).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Not open — show open form */}
        {!isOpen && (
          <View style={styles.openForm}>
            <Text style={styles.formTitle}>{t('cashRegister.openRegister')}</Text>
            <Text style={styles.fieldLabel}>{t('cashRegister.openingFloat')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('cashRegister.floatPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={openingFloat}
              onChangeText={setOpeningFloat}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleOpen} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>{t('cashRegister.openRegister')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Open — show dashboard */}
        {isOpen && (
          <>
            {/* Running totals by method */}
            <Text style={styles.sectionTitle}>{t('cashRegister.receiptsByMethod')}</Text>
            <View style={styles.methodsGrid}>
              {Object.entries(runningTotals).map(([method, amount]) => (
                <View key={method} style={styles.methodCard}>
                  <Text style={styles.methodName}>{t(`cashRegister.methods.${method}`, method)}</Text>
                  <Text style={styles.methodAmount}>{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
              ))}
              {Object.keys(runningTotals).length === 0 && (
                <Text style={styles.noData}>{t('cashRegister.noTransactions')}</Text>
              )}
            </View>

            {/* Summary row */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderLeftColor: '#4CAF50' }]}>
                <Text style={styles.summaryLabel}>{t('cashRegister.totalReceipts')}</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>+{totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: '#F44336' }]}>
                <Text style={styles.summaryLabel}>{t('cashRegister.totalOutflows')}</Text>
                <Text style={[styles.summaryValue, { color: '#F44336' }]}>-{totalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => setShowAddTx(true)}>
                <Text style={styles.actionIcon}>💰</Text>
                <Text style={[styles.actionLabel, { color: '#2E7D32' }]}>{t('cashRegister.addTransaction')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]} onPress={() => setShowDeposit(true)}>
                <Text style={styles.actionIcon}>🏦</Text>
                <Text style={[styles.actionLabel, { color: PRIMARY }]}>{t('cashRegister.bankDeposit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => setShowClose(true)}>
                <Text style={styles.actionIcon}>🔒</Text>
                <Text style={[styles.actionLabel, { color: '#D32F2F' }]}>{t('cashRegister.closeRegister')}</Text>
              </TouchableOpacity>
            </View>

            {/* Recent transactions */}
            <Text style={styles.sectionTitle}>{t('cashRegister.transactions')}</Text>
            {transactions.length === 0 ? (
              <Text style={styles.noData}>{t('cashRegister.noTransactions')}</Text>
            ) : (
              transactions.slice(0, 20).map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={[styles.txDot, { backgroundColor: TX_COLORS[tx.transaction_type] ?? '#8E8E93' }]} />
                  <View style={styles.txContent}>
                    <Text style={styles.txType}>{t(`cashRegister.${tx.transaction_type === 'petty_cash' ? 'pettyExpense' : tx.transaction_type}`, tx.transaction_type)}</Text>
                    {tx.description && <Text style={styles.txDesc}>{tx.description}</Text>}
                    <Text style={styles.txTime}>{new Date(tx.created_at).toLocaleTimeString()}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: tx.amount >= 0 ? '#4CAF50' : '#F44336' }]}>
                      {tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.txMethod}>{t(`cashRegister.methods.${tx.payment_method}`, tx.payment_method)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal visible={showAddTx} transparent animationType="slide" onRequestClose={() => setShowAddTx(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('cashRegister.addTransaction')}</Text>

            {/* Type chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {TX_TYPES.map((type) => (
                <TouchableOpacity key={type} style={[styles.chip, txType === type && styles.chipActive]} onPress={() => setTxType(type)}>
                  <Text style={[styles.chipText, txType === type && styles.chipTextActive]}>
                    {t(`cashRegister.${type === 'petty_cash' ? 'pettyExpense' : type}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Method chips */}
            <Text style={styles.fieldLabel}>{t('cashRegister.paymentMethod')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity key={m} style={[styles.chip, txMethod === m && styles.chipActive]} onPress={() => setTxMethod(m)}>
                  <Text style={[styles.chipText, txMethod === m && styles.chipTextActive]}>
                    {t(`cashRegister.methods.${m}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput style={styles.modalInput} placeholder={t('cashRegister.amount')} placeholderTextColor="#8E8E93" value={txAmount} onChangeText={setTxAmount} keyboardType="numeric" />
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.description')} placeholderTextColor="#8E8E93" value={txDesc} onChangeText={setTxDesc} />
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.reference')} placeholderTextColor="#8E8E93" value={txRef} onChangeText={setTxRef} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddTx(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddTx} disabled={submitting || !txAmount.trim()}>
                <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close Register Modal */}
      <Modal visible={showClose} transparent animationType="slide" onRequestClose={() => setShowClose(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('cashRegister.closeRegister')}</Text>
            <Text style={styles.fieldLabel}>{t('cashRegister.closingCash')}</Text>
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.closingCashPlaceholder')} placeholderTextColor="#8E8E93" value={closingCash} onChangeText={setClosingCash} keyboardType="numeric" autoFocus />
            <Text style={styles.fieldLabel}>{t('cashRegister.closeNotes')}</Text>
            <TextInput style={[styles.modalInput, { minHeight: 60 }]} placeholder={t('cashRegister.closeNotesPlaceholder')} placeholderTextColor="#8E8E93" value={closeNotes} onChangeText={setCloseNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowClose(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: '#D32F2F' }]} onPress={handleClose} disabled={submitting || !closingCash.trim()}>
                <Text style={styles.modalConfirmText}>{t('cashRegister.closeRegister')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank Deposit Modal */}
      <Modal visible={showDeposit} transparent animationType="slide" onRequestClose={() => setShowDeposit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('cashRegister.bankDeposit')}</Text>
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.amount')} placeholderTextColor="#8E8E93" value={depAmount} onChangeText={setDepAmount} keyboardType="numeric" />
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.bankName')} placeholderTextColor="#8E8E93" value={depBank} onChangeText={setDepBank} />
            <TextInput style={styles.modalInput} placeholder={t('cashRegister.depositRef')} placeholderTextColor="#8E8E93" value={depRef} onChangeText={setDepRef} />
            <TextInput style={[styles.modalInput, { minHeight: 50 }]} placeholder={t('cashRegister.closeNotes')} placeholderTextColor="#8E8E93" value={depNotes} onChangeText={setDepNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeposit(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleDeposit} disabled={submitting || !depAmount.trim() || !depBank.trim() || !depRef.trim()}>
                <Text style={styles.modalConfirmText}>{t('common.save')}</Text>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  content: { padding: 16 },

  // Status
  statusCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 20, marginBottom: 16, gap: 12 },
  statusOpen: { backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: '#4CAF50' },
  statusClosed: { backgroundColor: '#FFEBEE', borderWidth: 2, borderColor: '#D32F2F' },
  statusIcon: { fontSize: 24 },
  statusText: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', flex: 1 },
  statusSince: { fontSize: 14, color: '#636366' },

  // Open form
  openForm: { backgroundColor: '#F8F9FA', borderRadius: 14, padding: 20, marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#636366', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#fff' },
  primaryBtn: { backgroundColor: PRIMARY, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, minHeight: 52, justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Sections
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 },
  noData: { color: '#8E8E93', fontSize: 14, textAlign: 'center', paddingVertical: 16 },

  // Methods grid
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  methodCard: { backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, minWidth: '30%', flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA' },
  methodName: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
  methodAmount: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 14, borderLeftWidth: 4 },
  summaryLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },

  // Actions
  actionsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', minHeight: 70, justifyContent: 'center' },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Transactions
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, marginBottom: 6, gap: 10 },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txContent: { flex: 1 },
  txType: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  txDesc: { fontSize: 12, color: '#636366', marginTop: 1 },
  txTime: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '700' },
  txMethod: { fontSize: 11, color: '#8E8E93', marginTop: 1 },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  chipsRow: { marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#E5E5EA', marginEnd: 6 },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 13, fontWeight: '600', color: '#636366' },
  chipTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  modalCancelText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  modalConfirm: { backgroundColor: PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
