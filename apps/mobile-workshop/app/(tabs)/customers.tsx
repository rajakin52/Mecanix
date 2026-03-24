import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../src/lib/api';
import FilterBar, { type FilterChip } from '../../src/components/FilterBar';
import EmptyState from '../../src/components/EmptyState';

const PRIMARY = '#0087FF';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at?: string;
}

export default function CustomersScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const sortOptions: FilterChip[] = useMemo(
    () => [
      { key: 'created_at', label: t('filters.sortNewest') },
      { key: 'full_name', label: t('filters.sortName') },
    ],
    [t],
  );

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortBy === 'created_at' ? 'desc' : 'asc');
      params.set('pageSize', '100');
      const qs = params.toString();
      const response = await apiFetch<Customer[] | { data: Customer[] }>(`/customers?${qs}`);
      const list = Array.isArray(response) ? response : (response as { data: Customer[] }).data ?? [];
      setCustomers(list);
    } catch {
      Alert.alert(t('common.error'), t('customers.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, sortBy, t]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [fetchCustomers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreate = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('common.error'), t('customers.nameRequired'));
      return;
    }

    setFormLoading(true);
    try {
      await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      setFullName('');
      setPhone('');
      setEmail('');
      setShowForm(false);
      fetchCustomers();
    } catch {
      Alert.alert(t('common.error'), t('customers.createError'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCustomerPress = (customer: Customer) => {
    Alert.alert(
      customer.full_name,
      [
        `${t('customers.phone')}: ${customer.phone || '-'}`,
        `${t('customers.email')}: ${customer.email || '-'}`,
      ].join('\n'),
    );
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleCustomerPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{item.full_name}</Text>
          {item.phone ? (
            <Text style={styles.cardDetail}>{item.phone}</Text>
          ) : null}
          {item.email ? (
            <Text style={styles.cardDetail}>{item.email}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('customers.searchPlaceholder')}
        sortOptions={sortOptions}
        activeSort={sortBy}
        onSortChange={setSortBy}
      />

      {/* Bottom sheet form modal */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowForm(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.formTitle}>{t('customers.addNew')}</Text>
            <TextInput
              style={styles.formInput}
              placeholder={t('customers.fullName')}
              placeholderTextColor="#8E8E93"
              value={fullName}
              onChangeText={setFullName}
              autoFocus
            />
            {fullName.length > 0 && fullName.trim().length < 2 && (
              <Text style={styles.fieldError}>{t('common.required')}</Text>
            )}
            <TextInput
              style={styles.formInput}
              placeholder={t('customers.phone')}
              placeholderTextColor="#8E8E93"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.formInput}
              placeholder={t('customers.email')}
              placeholderTextColor="#8E8E93"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !fullName.trim() && { opacity: 0.4 },
                ]}
                onPress={handleCreate}
                disabled={formLoading || !fullName.trim()}
              >
                <Text style={styles.submitButtonText}>
                  {formLoading ? t('common.loading') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="👤"
              message={t('common.noResults')}
              actionLabel={t('customers.addNew')}
              onAction={() => setShowForm(true)}
            />
          }
          contentContainerStyle={
            customers.length === 0 ? styles.emptyContainer : undefined
          }
        />
      )}

      {!showForm && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowForm(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  empty: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 48,
    fontSize: 15,
  },
  emptyContainer: { flexGrow: 1 },

  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardContent: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', marginBottom: 2 },
  cardDetail: { fontSize: 14, color: '#636366', marginTop: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 16,
  },
  fieldError: {
    color: '#D32F2F',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
    marginStart: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  cancelButtonText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  submitButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

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
