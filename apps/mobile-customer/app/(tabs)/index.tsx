import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { apiGet } from '../../src/lib/api';

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vin: string | null;
  mileage: number | null;
  customer_id: string;
}

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string | null;
  created_at: string;
  grand_total: number | null;
}

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchVehicles = useCallback(async () => {
    try {
      setError('');
      const response = await apiGet<Vehicle[] | { data: Vehicle[] }>('/vehicles?pageSize=100');
      const list = Array.isArray(response) ? response : (response as { data: Vehicle[] }).data ?? [];
      setVehicles(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVehicles();
  }, [fetchVehicles]);

  const handleVehicleTap = (vehicle: Vehicle) => {
    router.push({
      pathname: '/vehicle-detail',
      params: { vehicleId: vehicle.id, vehiclePlate: vehicle.plate },
    });
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleVehicleTap(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.plate}>{item.plate}</Text>
        {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
      </View>
      <Text style={styles.makeModel}>
        {item.make} {item.model}
      </Text>
      <View style={styles.cardDetails}>
        {item.color ? (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('vehicles.color')}</Text>
            <Text style={styles.detailValue}>{item.color}</Text>
          </View>
        ) : null}
        {item.mileage != null ? (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('vehicles.mileage')}</Text>
            <Text style={styles.detailValue}>{item.mileage.toLocaleString()} km</Text>
          </View>
        ) : null}
        {item.vin ? (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('vehicles.vin')}</Text>
            <Text style={styles.detailValueMono}>{item.vin}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchVehicles}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0087FF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'\u{1F697}'}</Text>
            <Text style={styles.emptyText}>{t('vehicles.empty')}</Text>
          </View>
        }
      />

      {/* Book Service FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/book-appointment')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>{t('booking.bookService')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  plate: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: 1,
  },
  year: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  makeModel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#48484A',
    marginBottom: 12,
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
    paddingTop: 12,
    gap: 6,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  detailValueMono: {
    fontSize: 12,
    color: '#1C1C1E',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0087FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#0087FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0087FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
