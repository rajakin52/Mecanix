import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
}

export default function NewVehicleScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Customer picker
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = customerSearch
        ? `?search=${encodeURIComponent(customerSearch)}&pageSize=50`
        : '?pageSize=50';
      const data = await apiFetch<Customer[] | { data: Customer[] }>(`/customers${params}`);
      const list = Array.isArray(data) ? data : (data as { data: Customer[] }).data ?? [];
      setCustomers(list);
    } catch { /* empty */ }
  }, [customerSearch]);

  useEffect(() => {
    if (showCustomerPicker) {
      const debounce = setTimeout(fetchCustomers, 300);
      return () => clearTimeout(debounce);
    }
  }, [showCustomerPicker, fetchCustomers]);

  const handleSubmit = async () => {
    if (!plate.trim()) {
      Alert.alert(t('common.error'), t('newVehicle.plateRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        plate: plate.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
      };
      if (year.trim()) body.year = parseInt(year.trim(), 10);
      if (color.trim()) body.color = color.trim();
      if (fuelType.trim()) body.fuelType = fuelType.trim();
      if (vin.trim()) body.vin = vin.trim().toUpperCase();
      if (mileage.trim()) body.mileage = parseInt(mileage.trim(), 10);
      if (selectedCustomer) body.customerId = selectedCustomer.id;

      await apiFetch('/vehicles', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      Alert.alert(t('common.success'), t('newVehicle.createSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('newVehicle.createError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: t('newVehicle.title'), headerBackTitle: t('common.back') }} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.fieldLabel}>{t('newVehicle.plate')} *</Text>
        <TextInput style={styles.input} placeholder="AB-12-CD" placeholderTextColor="#8E8E93" value={plate} onChangeText={setPlate} autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>{t('newVehicle.make')}</Text>
        <TextInput style={styles.input} placeholder="Toyota" placeholderTextColor="#8E8E93" value={make} onChangeText={setMake} />

        <Text style={styles.fieldLabel}>{t('newVehicle.model')}</Text>
        <TextInput style={styles.input} placeholder="Hilux" placeholderTextColor="#8E8E93" value={model} onChangeText={setModel} />

        <Text style={styles.fieldLabel}>{t('newVehicle.year')}</Text>
        <TextInput style={styles.input} placeholder="2024" placeholderTextColor="#8E8E93" value={year} onChangeText={setYear} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>{t('newVehicle.color')}</Text>
        <TextInput style={styles.input} placeholder="" placeholderTextColor="#8E8E93" value={color} onChangeText={setColor} />

        <Text style={styles.fieldLabel}>{t('newVehicle.fuelType')}</Text>
        <TextInput style={styles.input} placeholder="Diesel / Gasoline" placeholderTextColor="#8E8E93" value={fuelType} onChangeText={setFuelType} />

        <Text style={styles.fieldLabel}>{t('newVehicle.vin')}</Text>
        <TextInput style={styles.input} placeholder="" placeholderTextColor="#8E8E93" value={vin} onChangeText={setVin} autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>{t('newVehicle.mileage')}</Text>
        <TextInput style={styles.input} placeholder="0" placeholderTextColor="#8E8E93" value={mileage} onChangeText={setMileage} keyboardType="numeric" />

        {/* Customer selector */}
        <Text style={styles.fieldLabel}>{t('newVehicle.selectCustomer')}</Text>
        <TouchableOpacity style={styles.customerSelector} onPress={() => setShowCustomerPicker(true)}>
          <Text style={selectedCustomer ? styles.customerSelected : styles.customerPlaceholder}>
            {selectedCustomer ? selectedCustomer.full_name : t('newVehicle.selectCustomer')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (!plate.trim() || submitting) && { opacity: 0.4 }]}
          onPress={handleSubmit}
          disabled={!plate.trim() || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Customer picker modal */}
      <Modal visible={showCustomerPicker} transparent animationType="slide" onRequestClose={() => setShowCustomerPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <TextInput
              style={styles.modalSearch}
              placeholder={t('customers.searchPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={customerSearch}
              onChangeText={setCustomerSearch}
              autoFocus
            />
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setSelectedCustomer(item); setShowCustomerPicker(false); }}
                >
                  <Text style={styles.modalItemName}>{item.full_name}</Text>
                  {item.phone && <Text style={styles.modalItemDetail}>{item.phone}</Text>}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCustomerPicker(false)}>
              <Text style={styles.modalCloseText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#636366', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#F8F9FA' },
  customerSelector: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 14, backgroundColor: '#F8F9FA' },
  customerSelected: { fontSize: 16, color: '#1C1C1E', fontWeight: '500' },
  customerPlaceholder: { fontSize: 16, color: '#8E8E93' },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, minHeight: 52, justifyContent: 'center', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 16 },
  modalSearch: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  modalItemName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  modalItemDetail: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  modalClose: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalCloseText: { color: '#636366', fontSize: 16, fontWeight: '500' },
});
