import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import UpsellModal from '../src/components/UpsellModal';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
}

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
}

type Step = 'customer' | 'vehicle' | 'details';

export default function NewJobScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<Step>('customer');

  // Customer selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Vehicle selection
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Job details
  const [reportedProblem, setReportedProblem] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isInsurance, setIsInsurance] = useState(false);
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [createdJobNumber, setCreatedJobNumber] = useState<string | null>(null);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const params = customerSearch
        ? `?search=${encodeURIComponent(customerSearch)}`
        : '';
      const data = await apiFetch<Customer[] | { data: Customer[] }>(`/customers${params}`);
      const list = Array.isArray(data) ? data : (data as { data: Customer[] }).data ?? [];
      setCustomers(list);
    } catch {
      // silent — user will see empty list
    } finally {
      setCustomersLoading(false);
    }
  }, [customerSearch]);

  useEffect(() => {
    if (step === 'customer') {
      const debounce = setTimeout(fetchCustomers, 300);
      return () => clearTimeout(debounce);
    }
  }, [fetchCustomers, step]);

  // Fetch vehicles for selected customer
  const fetchVehicles = useCallback(async () => {
    if (!selectedCustomer) return;
    setVehiclesLoading(true);
    try {
      const data = await apiFetch<Vehicle[] | { data: Vehicle[] }>(
        `/vehicles?customerId=${selectedCustomer.id}`,
      );
      const list = Array.isArray(data) ? data : (data as { data: Vehicle[] }).data ?? [];
      setVehicles(list);
    } catch {
      // silent
    } finally {
      setVehiclesLoading(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (step === 'vehicle' && selectedCustomer) {
      fetchVehicles();
    }
  }, [step, fetchVehicles, selectedCustomer]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStep('vehicle');
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setStep('details');
  };

  const navigateAfterJob = () => {
    if (!createdJobId || !selectedVehicle) return;
    // Go directly to inspection — no alert, inspection is mandatory
    router.replace({
      pathname: '/inspection',
      params: {
        jobId: createdJobId,
        vehicleId: selectedVehicle.id,
        jobNumber: createdJobNumber ?? '',
        vehiclePlate: selectedVehicle.plate,
        mandatory: '1',
      },
    });
  };

  const handleUpsellConfirm = async (selectedItems: Array<{ name: string; price: number }>) => {
    setShowUpsell(false);
    // Add selected upsell items as labour lines to the job
    if (createdJobId && selectedItems.length > 0) {
      try {
        for (const item of selectedItems) {
          await apiFetch(`/jobs/${createdJobId}/labour-lines`, {
            method: 'POST',
            body: JSON.stringify({
              description: item.name,
              hours: 1,
              rate: item.price,
            }),
          });
        }
      } catch {
        // Non-critical — continue even if upsell add fails
      }
    }
    navigateAfterJob();
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedVehicle) return;
    if (!reportedProblem.trim()) {
      Alert.alert(t('common.error'), t('common.required'));
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        reportedProblem: reportedProblem.trim(),
      };
      if (internalNotes.trim()) body.internalNotes = internalNotes.trim();
      if (isInsurance) {
        body.isInsurance = true;
        if (insuranceCompany.trim()) body.insuranceCompany = insuranceCompany.trim();
        if (policyNumber.trim()) body.policyNumber = policyNumber.trim();
      }

      const job = await apiFetch<{ id: string; job_number: string }>(
        '/jobs',
        { method: 'POST', body: JSON.stringify(body) },
      );

      // Show upsell modal before navigating
      setCreatedJobId(job.id);
      setCreatedJobNumber(job.job_number);
      setShowUpsell(true);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('jobs.createError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {(['customer', 'vehicle', 'details'] as Step[]).map((s, i) => (
        <View key={s} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              (['customer', 'vehicle', 'details'].indexOf(step) > i) && styles.stepDotDone,
            ]}
          >
            <Text style={styles.stepDotText}>{i + 1}</Text>
          </View>
          {i < 2 && <View style={styles.stepLine} />}
        </View>
      ))}
    </View>
  );

  // Step 1: Customer selection
  if (step === 'customer') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('jobs.selectCustomer'), headerBackTitle: t('common.back') }} />
        {renderStepIndicator()}
        <TextInput
          style={styles.searchInput}
          placeholder={t('customers.searchPlaceholder')}
          placeholderTextColor="#8E8E93"
          value={customerSearch}
          onChangeText={setCustomerSearch}
          autoFocus
        />
        {customersLoading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectCard}
                onPress={() => handleSelectCustomer(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectCardTitle}>{item.full_name}</Text>
                {item.phone ? (
                  <Text style={styles.selectCardDetail}>{item.phone}</Text>
                ) : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>{t('common.noResults')}</Text>
            }
          />
        )}
      </View>
    );
  }

  // Step 2: Vehicle selection
  if (step === 'vehicle') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('jobs.selectVehicle'), headerBackTitle: t('common.back') }} />
        {renderStepIndicator()}
        <TouchableOpacity
          style={styles.selectedBanner}
          onPress={() => { setStep('customer'); setSelectedCustomer(null); }}
        >
          <Text style={styles.selectedLabel}>{t('tabs.customers')}:</Text>
          <Text style={styles.selectedValue}>{selectedCustomer?.full_name}</Text>
          <Text style={styles.changeLink}>{t('common.edit')}</Text>
        </TouchableOpacity>

        {vehiclesLoading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : vehicles.length === 0 ? (
          <Text style={styles.empty}>{t('jobs.noVehiclesForCustomer')}</Text>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectCard}
                onPress={() => handleSelectVehicle(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectCardTitle}>{item.plate}</Text>
                <Text style={styles.selectCardDetail}>
                  {item.make} {item.model} {item.year ? `(${item.year})` : ''}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // Step 3: Job details
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: t('jobs.newJob'), headerBackTitle: t('common.back') }} />
      {renderStepIndicator()}
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Selected customer & vehicle */}
        <TouchableOpacity
          style={styles.selectedBanner}
          onPress={() => { setStep('customer'); setSelectedCustomer(null); setSelectedVehicle(null); }}
        >
          <Text style={styles.selectedLabel}>{t('tabs.customers')}:</Text>
          <Text style={styles.selectedValue}>{selectedCustomer?.full_name}</Text>
          <Text style={styles.changeLink}>{t('common.edit')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.selectedBanner}
          onPress={() => { setStep('vehicle'); setSelectedVehicle(null); }}
        >
          <Text style={styles.selectedLabel}>{t('tabs.vehicles')}:</Text>
          <Text style={styles.selectedValue}>
            {selectedVehicle?.plate} — {selectedVehicle?.make} {selectedVehicle?.model}
          </Text>
          <Text style={styles.changeLink}>{t('common.edit')}</Text>
        </TouchableOpacity>

        {/* Reported problem */}
        <Text style={styles.fieldLabel}>{t('jobs.reportedProblem')} *</Text>
        <TextInput
          style={[styles.textArea]}
          placeholder={t('jobs.reportedProblemPlaceholder')}
          placeholderTextColor="#8E8E93"
          value={reportedProblem}
          onChangeText={setReportedProblem}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Internal notes */}
        <Text style={styles.fieldLabel}>{t('jobs.internalNotes')}</Text>
        <TextInput
          style={[styles.textArea, { minHeight: 60 }]}
          placeholder={t('jobs.internalNotesPlaceholder')}
          placeholderTextColor="#8E8E93"
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Insurance toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>{t('jobs.insurance')}</Text>
          <Switch
            value={isInsurance}
            onValueChange={setIsInsurance}
            trackColor={{ true: '#4CAF50' }}
          />
        </View>

        {isInsurance && (
          <View style={styles.insuranceFields}>
            <TextInput
              style={styles.input}
              placeholder={t('jobs.insuranceCompany')}
              placeholderTextColor="#8E8E93"
              value={insuranceCompany}
              onChangeText={setInsuranceCompany}
            />
            <TextInput
              style={styles.input}
              placeholder={t('jobs.policyNumber')}
              placeholderTextColor="#8E8E93"
              value={policyNumber}
              onChangeText={setPolicyNumber}
            />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>{t('jobs.createJob')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Upsell Modal — Expedia-style add-on services */}
      <UpsellModal
        visible={showUpsell}
        applicableTo="job_card"
        onClose={() => {
          setShowUpsell(false);
          navigateAfterJob();
        }}
        onConfirm={handleUpsellConfirm}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  loader: { marginTop: 48 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48, fontSize: 15 },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#4CAF50' },
  stepDotDone: { backgroundColor: '#81C784' },
  stepDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 4,
  },

  // Selection cards
  selectCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectCardTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  selectCardDetail: { fontSize: 14, color: '#636366', marginTop: 2 },

  // Selected banner
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedLabel: { fontSize: 13, color: '#636366', marginEnd: 6 },
  selectedValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  changeLink: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },

  // Form fields
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    minHeight: 100,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  insuranceFields: { marginBottom: 8 },

  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
