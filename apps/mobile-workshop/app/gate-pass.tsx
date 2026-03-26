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
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface GatePass {
  id: string;
  pass_number: string;
  pass_type: string;
  mileage: number | null;
  notes: string | null;
  authorized_by: string | null;
  created_at: string;
}

export default function GatePassScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    jobId: string;
    jobNumber?: string;
    vehicleId?: string;
    customerId?: string;
  }>();

  const [passes, setPasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form
  const [passType, setPassType] = useState<'entry' | 'exit'>('entry');
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchPasses = useCallback(async () => {
    try {
      const data = await apiFetch<GatePass[]>(
        `/gate-passes?jobCardId=${params.jobId}`,
      );
      const list = Array.isArray(data) ? data : (data as { data: GatePass[] }).data ?? [];
      setPasses(list);
    } catch {
      Alert.alert(t('common.error'), t('gatePass.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.jobId, t]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        jobCardId: params.jobId,
        vehicleId: params.vehicleId,
        customerId: params.customerId,
        passType,
      };
      if (mileage.trim()) body.mileage = parseInt(mileage, 10);
      if (notes.trim()) body.notes = notes.trim();

      await apiFetch('/gate-passes', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setShowForm(false);
      setMileage('');
      setNotes('');
      Alert.alert(t('common.success'), t('gatePass.createSuccess'));
      fetchPasses();
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('gatePass.createError'),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${t('gatePass.title')} — ${params.jobNumber ?? ''}`,
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPasses(); }}
            tintColor={PRIMARY}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Create buttons */}
        {!showForm && (
          <View style={styles.createRow}>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}
              onPress={() => { setPassType('entry'); setShowForm(true); }}
            >
              <Text style={styles.createIcon}>📥</Text>
              <Text style={[styles.createText, { color: '#2E7D32' }]}>
                {t('gatePass.createEntry')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: '#E3F2FD', borderColor: PRIMARY }]}
              onPress={() => { setPassType('exit'); setShowForm(true); }}
            >
              <Text style={styles.createIcon}>📤</Text>
              <Text style={[styles.createText, { color: PRIMARY }]}>
                {t('gatePass.createExit')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {passType === 'entry' ? t('gatePass.entry') : t('gatePass.exit')}
            </Text>
            <Text style={styles.fieldLabel}>{t('gatePass.mileage')}</Text>
            <TextInput
              style={styles.input}
              placeholder="km"
              placeholderTextColor="#8E8E93"
              value={mileage}
              onChangeText={setMileage}
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>{t('gatePass.notes')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder={t('gatePass.notesPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pass list */}
        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 32 }} />
        ) : passes.length === 0 ? (
          <Text style={styles.empty}>{t('gatePass.noPassesYet')}</Text>
        ) : (
          passes.map((pass) => (
            <View
              key={pass.id}
              style={[
                styles.passCard,
                {
                  borderLeftColor:
                    pass.pass_type === 'entry' ? '#4CAF50' : PRIMARY,
                },
              ]}
            >
              <View style={styles.passHeader}>
                <Text style={styles.passNumber}>{pass.pass_number}</Text>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor:
                        pass.pass_type === 'entry' ? '#E8F5E9' : '#E3F2FD',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      {
                        color:
                          pass.pass_type === 'entry' ? '#2E7D32' : PRIMARY,
                      },
                    ]}
                  >
                    {pass.pass_type === 'entry'
                      ? t('gatePass.entry')
                      : t('gatePass.exit')}
                  </Text>
                </View>
              </View>
              {pass.mileage != null && (
                <Text style={styles.passDetail}>
                  {t('gatePass.mileage')}: {pass.mileage.toLocaleString()} km
                </Text>
              )}
              {pass.notes && (
                <Text style={styles.passDetail}>{pass.notes}</Text>
              )}
              <Text style={styles.passDate}>
                {new Date(pass.created_at).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },

  // Create buttons
  createRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  createBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    minHeight: 80,
    justifyContent: 'center',
  },
  createIcon: { fontSize: 28, marginBottom: 6 },
  createText: { fontSize: 14, fontWeight: '700' },

  // Form
  formCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 14 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#636366', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 12,
  },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  cancelBtnText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  submitBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Pass cards
  passCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  passNumber: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  passDetail: { fontSize: 14, color: '#636366', marginTop: 2 },
  passDate: { fontSize: 12, color: '#8E8E93', marginTop: 6 },

  empty: { textAlign: 'center', color: '#8E8E93', fontSize: 15, marginTop: 32 },
});
