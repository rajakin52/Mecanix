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

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  customer?: { id: string; fullName: string } | null;
  customerId?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [customerId, setCustomerId] = useState('');

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${API_URL}/vehicles${queryParams}`, { headers });
      const json = await response.json();
      const list = json.data ?? json;
      setVehicles(Array.isArray(list) ? list : []);
    } catch {
      Alert.alert(t('common.error'), t('vehicles.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVehicles();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchVehicles]);

  const handleCreate = async () => {
    if (!plate.trim()) {
      Alert.alert(t('common.error'), t('vehicles.plateRequired'));
      return;
    }

    setFormLoading(true);
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        plate: plate.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
      };
      if (year.trim()) {
        body.year = parseInt(year.trim(), 10);
      }
      if (customerId.trim()) {
        body.customerId = customerId.trim();
      }

      const response = await fetch(`${API_URL}/vehicles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        Alert.alert(t('common.error'), errData?.error?.message ?? t('vehicles.createError'));
        return;
      }

      // Reset form and refresh
      setPlate('');
      setMake('');
      setModel('');
      setYear('');
      setCustomerId('');
      setShowForm(false);
      fetchVehicles();
    } catch {
      Alert.alert(t('common.error'), t('vehicles.createError'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleVehiclePress = (vehicle: Vehicle) => {
    const customerName = vehicle.customer?.fullName ?? '-';
    Alert.alert(
      vehicle.plate,
      [
        `${t('vehicles.make')}: ${vehicle.make || '-'}`,
        `${t('vehicles.model')}: ${vehicle.model || '-'}`,
        `${t('vehicles.year')}: ${vehicle.year || '-'}`,
        `${t('customers.title')}: ${customerName}`,
        `ID: ${vehicle.id}`,
      ].join('\n'),
    );
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleVehiclePress(item)} activeOpacity={0.7}>
      <Text style={styles.cardPlate}>{item.plate}</Text>
      <Text style={styles.cardMakeModel}>
        {[item.make, item.model].filter(Boolean).join(' ') || '-'}
        {item.year ? ` (${item.year})` : ''}
      </Text>
      {item.customer?.fullName ? (
        <Text style={styles.cardCustomer}>{item.customer.fullName}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder={t('vehicles.searchPlaceholder')}
        placeholderTextColor="#8E8E93"
        value={search}
        onChangeText={setSearch}
      />

      {showForm && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>{t('vehicles.addNew')}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('vehicles.plate')}
                placeholderTextColor="#8E8E93"
                value={plate}
                onChangeText={setPlate}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.formInput}
                placeholder={t('vehicles.make')}
                placeholderTextColor="#8E8E93"
                value={make}
                onChangeText={setMake}
              />
              <TextInput
                style={styles.formInput}
                placeholder={t('vehicles.model')}
                placeholderTextColor="#8E8E93"
                value={model}
                onChangeText={setModel}
              />
              <TextInput
                style={styles.formInput}
                placeholder={t('vehicles.year')}
                placeholderTextColor="#8E8E93"
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.formInput}
                placeholder={t('vehicles.customerId')}
                placeholderTextColor="#8E8E93"
                value={customerId}
                onChangeText={setCustomerId}
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
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          ListEmptyComponent={<Text style={styles.empty}>{t('common.noResults')}</Text>}
          contentContainerStyle={vehicles.length === 0 ? styles.emptyContainer : undefined}
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
  cardPlate: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 4, letterSpacing: 1 },
  cardMakeModel: { fontSize: 15, color: '#363638', marginBottom: 2 },
  cardCustomer: { fontSize: 13, color: '#636366', marginTop: 4 },

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
