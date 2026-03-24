import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { apiGet, apiPost } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  service_type: string;
  status: string;
  description: string | null;
  vehicle?: { plate: string; make: string; model: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#E3F2FD', text: '#1565C0' },
  confirmed: { bg: '#E8F5E9', text: '#2E7D32' },
  in_progress: { bg: '#FFF3E0', text: '#E65100' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  cancelled: { bg: '#FAFAFA', text: '#757575' },
  no_show: { bg: '#FFEBEE', text: '#C62828' },
};

export default function MyAppointmentsScreen() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await apiGet<Appointment[]>('/appointments');
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime(),
      );
      setAppointments(sorted);
    } catch { /* empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const handleCancel = (id: string) => {
    Alert.alert(t('myAppointments.cancel'), t('myAppointments.cancelConfirm'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiPost(`/appointments/${id}/status`, { status: 'cancelled' });
            fetchAppointments();
            Alert.alert(t('common.success'), t('myAppointments.cancelSuccess'));
          } catch {
            Alert.alert(t('common.error'), t('myAppointments.cancelError'));
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const statusStyle = STATUS_COLORS[item.status] ?? { bg: '#F5F5F7', text: '#8E8E93' };
    const canCancel = ['scheduled', 'confirmed'].includes(item.status);
    const date = new Date(item.scheduled_date).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardDate}>{date}</Text>
            <Text style={styles.cardTime}>{item.scheduled_time}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {t(`myAppointments.status.${item.status}`, item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceType}>
          {t(`booking.serviceTypes.${item.service_type}`, item.service_type)}
        </Text>

        {item.vehicle && (
          <Text style={styles.vehicleInfo}>
            {item.vehicle.plate} — {item.vehicle.make} {item.vehicle.model}
          </Text>
        )}

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancel(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>{t('myAppointments.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('myAppointments.title'), headerBackTitle: t('common.back') }} />
      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 48 }} />
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
              <Text style={styles.emptyText}>{t('myAppointments.empty')}</Text>
              <Text style={styles.emptyHint}>{t('myAppointments.emptyHint')}</Text>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardDate: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  cardTime: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  serviceType: { fontSize: 15, fontWeight: '600', color: '#363638', marginBottom: 4 },
  vehicleInfo: { fontSize: 14, color: '#636366', marginBottom: 4 },
  description: { fontSize: 13, color: '#8E8E93', marginBottom: 8 },
  cancelBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: '#FFEBEE' },
  cancelBtnText: { color: '#D32F2F', fontSize: 13, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#8E8E93', fontWeight: '600' },
  emptyHint: { fontSize: 14, color: '#AEAEB2', marginTop: 4, textAlign: 'center' },
});
