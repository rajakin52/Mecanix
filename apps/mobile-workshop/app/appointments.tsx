import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  service_type: string;
  status: string;
  description: string | null;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle?: { id: string; plate: string; make: string; model: string } | null;
  customer?: { id: string; full_name: string; phone: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#E3F2FD', text: '#1565C0' },
  confirmed: { bg: '#E8F5E9', text: '#2E7D32' },
  in_progress: { bg: '#FFF3E0', text: '#E65100' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  cancelled: { bg: '#FAFAFA', text: '#757575' },
  no_show: { bg: '#FFEBEE', text: '#C62828' },
};

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      isToday: i === 0,
    };
  });

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await apiFetch<Appointment[]>(`/appointments/date/${selectedDate}`);
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert(t('common.error'), t('appointments.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, t]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiFetch(`/appointments/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAppointments();
    } catch {
      Alert.alert(t('common.error'), t('appointments.fetchError'));
    }
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const statusStyle = STATUS_COLORS[item.status] ?? { bg: '#F5F5F7', text: '#8E8E93' };
    const customerName = item.customer?.full_name ?? item.customer_name ?? '—';
    const canStart = ['scheduled', 'confirmed'].includes(item.status);
    const canComplete = item.status === 'in_progress';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTime}>{item.scheduled_time}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {t(`appointments.${item.status}`, item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.customerName}>{customerName}</Text>
        {item.vehicle && (
          <Text style={styles.vehicleInfo}>
            {item.vehicle.plate} — {item.vehicle.make} {item.vehicle.model}
          </Text>
        )}
        <Text style={styles.serviceType}>
          {t(`appointments.serviceType`)}: {item.service_type}
        </Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {canStart && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}
              onPress={() => handleStatusChange(item.id, 'in_progress')}
            >
              <Text style={[styles.actionBtnText, { color: '#2E7D32' }]}>
                {t('appointments.createJobFromAppointment')}
              </Text>
            </TouchableOpacity>
          )}
          {canComplete && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]}
              onPress={() => handleStatusChange(item.id, 'completed')}
            >
              <Text style={[styles.actionBtnText, { color: PRIMARY }]}>
                {t('appointments.completed')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('appointments.title'), headerBackTitle: t('common.back') }} />

      {/* Date picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow} contentContainerStyle={styles.dateRowContent}>
        {dateOptions.map((d) => (
          <TouchableOpacity
            key={d.value}
            style={[styles.dateChip, selectedDate === d.value && styles.dateChipSelected]}
            onPress={() => setSelectedDate(d.value)}
          >
            <Text style={[styles.dateChipText, selectedDate === d.value && styles.dateChipTextSelected]}>
              {d.label}
            </Text>
            {d.isToday && <View style={styles.todayDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointment}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} tintColor={PRIMARY} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>{t('appointments.noAppointments')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  dateRow: { borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  dateRowContent: { padding: 12, gap: 8 },
  dateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5F5F7', minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dateChipSelected: { backgroundColor: PRIMARY },
  dateChipText: { fontSize: 14, fontWeight: '600', color: '#636366' },
  dateChipTextSelected: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: PRIMARY, marginTop: 2 },
  list: { padding: 16 },
  card: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: PRIMARY, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTime: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  customerName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 2 },
  vehicleInfo: { fontSize: 14, color: '#636366', marginBottom: 2 },
  serviceType: { fontSize: 13, color: '#8E8E93', marginBottom: 4 },
  description: { fontSize: 13, color: '#8E8E93', fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minHeight: 40, justifyContent: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#8E8E93' },
});
