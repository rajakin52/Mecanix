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
import { Stack } from 'expo-router';
import { apiFetch } from '../src/lib/api';
import FilterBar, { type FilterChip } from '../src/components/FilterBar';

const PRIMARY = '#0087FF';

interface Part {
  id: string;
  part_number: string;
  description: string;
  unit_cost: number;
  sell_price: number;
  stock_qty: number;
  reorder_point: number;
  category: string | null;
  location: string | null;
  is_active: boolean;
}

export default function PartsScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filterChips: FilterChip[] = useMemo(
    () => [
      { key: 'low_stock', label: t('parts.lowStock'), color: '#D32F2F' },
    ],
    [t],
  );

  const fetchParts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (showLowStock) params.set('lowStock', 'true');
      params.set('pageSize', '200');
      const qs = params.toString();
      const response = await apiFetch<Part[] | { data: Part[] }>(`/parts${qs ? `?${qs}` : ''}`);
      const list = Array.isArray(response) ? response : (response as { data: Part[] }).data ?? [];
      setParts(list);
    } catch {
      Alert.alert(t('common.error'), t('parts.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, showLowStock, t]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(fetchParts, 300);
    return () => clearTimeout(debounce);
  }, [fetchParts]);

  const lowStockCount = parts.filter(
    (p) => p.stock_qty <= p.reorder_point,
  ).length;

  const renderPart = ({ item }: { item: Part }) => {
    const isLow = item.stock_qty <= item.reorder_point;
    return (
      <View style={[styles.card, isLow && styles.cardLow]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.partName}>{item.description}</Text>
            <Text style={styles.partNumber}>{item.part_number}</Text>
          </View>
          <View style={styles.stockBadge}>
            <Text
              style={[
                styles.stockText,
                isLow ? styles.stockTextLow : styles.stockTextOk,
              ]}
            >
              {item.stock_qty}
            </Text>
            <Text style={styles.stockLabel}>{t('parts.stockQty')}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          {item.category && (
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>{item.category}</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>{item.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.pricesRow}>
          <Text style={styles.priceLabel}>
            {t('parts.unitCost')}: {item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.priceLabel}>
            {t('parts.sellPrice')}: {item.sell_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.reorderLabel}>
            {t('parts.reorderPoint')}: {item.reorder_point}
          </Text>
        </View>

        {isLow && (
          <View style={styles.lowStockBanner}>
            <Text style={styles.lowStockText}>⚠️ {t('parts.lowStock')}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: t('parts.title'), headerBackTitle: t('common.back') }}
      />

      {/* Low stock alert */}
      {lowStockCount > 0 && !showLowStock && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => setShowLowStock(true)}
        >
          <Text style={styles.alertText}>
            ⚠️ {t('parts.lowStockAlert', { count: lowStockCount })}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.filterContainer}>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('parts.searchPlaceholder')}
          chips={filterChips}
          activeChip={showLowStock ? 'low_stock' : null}
          onChipPress={(key) => setShowLowStock(key === 'low_stock')}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          renderItem={renderPart}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchParts(); }}
              tintColor={PRIMARY}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('parts.empty')}</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filterContainer: { paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, paddingTop: 0 },
  loader: { marginTop: 48 },
  empty: { textAlign: 'center', color: '#8E8E93', fontSize: 15, marginTop: 48 },

  // Alert banner
  alertBanner: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertText: { fontSize: 14, fontWeight: '600', color: '#E65100' },

  // Card
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLow: { borderLeftColor: '#D32F2F' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardLeft: { flex: 1 },
  partName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  partNumber: { fontSize: 13, color: '#8E8E93', fontFamily: 'monospace' },
  stockBadge: { alignItems: 'center', marginStart: 12 },
  stockText: { fontSize: 24, fontWeight: '800' },
  stockTextOk: { color: '#2E7D32' },
  stockTextLow: { color: '#D32F2F' },
  stockLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },

  detailsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  detailPill: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailPillText: { fontSize: 12, color: '#636366', fontWeight: '500' },

  pricesRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  priceLabel: { fontSize: 13, color: '#636366' },
  reorderLabel: { fontSize: 13, color: '#8E8E93' },

  lowStockBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    padding: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  lowStockText: { fontSize: 12, fontWeight: '600', color: '#C62828' },
});
