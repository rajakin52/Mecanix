import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import FilterBar, { type FilterChip } from '../../src/components/FilterBar';
import EmptyState from '../../src/components/EmptyState';

const PRIMARY = '#0087FF';

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  customer?: { id: string; full_name: string } | null;
  customers?: { full_name: string } | null;
}

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sortOptions: FilterChip[] = useMemo(
    () => [
      { key: 'created_at', label: t('filters.sortNewest') },
      { key: 'plate', label: t('filters.sortPlate') },
    ],
    [t],
  );

  const fetchVehicles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortBy === 'created_at' ? 'desc' : 'asc');
      params.set('pageSize', '100');
      const qs = params.toString();
      const data = await apiFetch<Vehicle[]>(`/vehicles${qs ? `?${qs}` : ''}`);
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert(t('common.error'), t('vehicles.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, sortBy, t]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(fetchVehicles, 300);
    return () => clearTimeout(debounce);
  }, [fetchVehicles]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVehicles();
  }, [fetchVehicles]);

  const handleVehiclePress = (vehicle: Vehicle) => {
    router.push({
      pathname: '/vehicle-detail',
      params: { vehicleId: vehicle.id, vehiclePlate: vehicle.plate },
    });
  };

  const customerName = (v: Vehicle) =>
    v.customer?.full_name ?? v.customers?.full_name ?? null;

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleVehiclePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardPlate}>{item.plate}</Text>
        {item.mileage != null && (
          <Text style={styles.mileage}>{item.mileage.toLocaleString()} km</Text>
        )}
      </View>
      <Text style={styles.cardMakeModel}>
        {[item.make, item.model].filter(Boolean).join(' ') || '-'}
        {item.year ? ` (${item.year})` : ''}
      </Text>
      {customerName(item) && (
        <Text style={styles.cardCustomer}>{customerName(item)}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('vehicles.searchPlaceholder')}
        sortOptions={sortOptions}
        activeSort={sortBy}
        onSortChange={setSortBy}
      />

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🚗"
              message={t('common.noResults')}
              actionLabel={t('vehicles.newVehicle')}
              onAction={() => router.push('/new-vehicle')}
            />
          }
          contentContainerStyle={vehicles.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-vehicle')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  loader: { marginTop: 48 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48, fontSize: 15 },
  emptyContainer: { flexGrow: 1 },

  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
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
  cardPlate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: 1,
  },
  mileage: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  cardMakeModel: { fontSize: 15, color: '#363638', marginBottom: 2 },
  cardCustomer: { fontSize: 13, color: '#636366', marginTop: 4 },

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
