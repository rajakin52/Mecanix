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
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function CustomersScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${API_URL}/customers${queryParams}`, { headers });
      const json = await response.json();
      const list = json.data ?? json;
      setCustomers(Array.isArray(list) ? list : []);
    } catch {
      Alert.alert(t('common.error'), t('customers.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchCustomers]);

  const handleCreate = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('common.error'), t('customers.nameRequired'));
      return;
    }

    setFormLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), email: email.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        Alert.alert(t('common.error'), errData?.error?.message ?? t('customers.createError'));
        return;
      }

      // Reset form and refresh
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
      customer.fullName,
      [
        `${t('customers.phone')}: ${customer.phone || '-'}`,
        `${t('customers.email')}: ${customer.email || '-'}`,
        `ID: ${customer.id}`,
      ].join('\n'),
    );
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleCustomerPress(item)} activeOpacity={0.7}>
      <Text style={styles.cardName}>{item.fullName}</Text>
      {item.phone ? <Text style={styles.cardDetail}>{item.phone}</Text> : null}
      {item.email ? <Text style={styles.cardDetail}>{item.email}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder={t('customers.searchPlaceholder')}
        placeholderTextColor="#8E8E93"
        value={search}
        onChangeText={setSearch}
      />

      {showForm && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>{t('customers.addNew')}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('customers.fullName')}
                placeholderTextColor="#8E8E93"
                value={fullName}
                onChangeText={setFullName}
              />
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
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleCreate}
                  disabled={formLoading}
                >
                  <Text style={styles.submitButtonText}>
                    {formLoading ? t('common.loading') : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          ListEmptyComponent={<Text style={styles.empty}>{t('common.noResults')}</Text>}
          contentContainerStyle={customers.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {!showForm && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  loader: { marginTop: 48 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48, fontSize: 15 },
  emptyContainer: { flexGrow: 1 },

  // Card
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  cardName: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  cardDetail: { fontSize: 14, color: '#636366', marginTop: 2 },

  // Form
  formContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  formInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  cancelButtonText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '400', marginTop: -2 },
});
