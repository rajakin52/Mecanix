import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

// SWOOP primary blue
const PRIMARY = '#0087FF';

export interface FilterChip {
  key: string;
  label: string;
  color?: string;
}

interface Props {
  search: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder: string;
  chips?: FilterChip[];
  activeChip?: string | null;
  onChipPress?: (key: string | null) => void;
  sortOptions?: FilterChip[];
  activeSort?: string;
  onSortChange?: (key: string) => void;
}

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  chips,
  activeChip,
  onChipPress,
  sortOptions,
  activeSort,
  onSortChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Search input */}
      <TextInput
        style={styles.searchInput}
        placeholder={searchPlaceholder}
        placeholderTextColor="#8E8E93"
        value={search}
        onChangeText={onSearchChange}
      />

      {/* Filter chips row */}
      {chips && chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {/* "All" chip */}
          <TouchableOpacity
            style={[
              styles.chip,
              !activeChip && styles.chipActive,
            ]}
            onPress={() => onChipPress?.(null)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                !activeChip && styles.chipTextActive,
              ]}
            >
              {t('filters.all')}
            </Text>
          </TouchableOpacity>

          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                activeChip === chip.key && {
                  backgroundColor: chip.color ?? PRIMARY,
                  borderColor: chip.color ?? PRIMARY,
                },
              ]}
              onPress={() =>
                onChipPress?.(activeChip === chip.key ? null : chip.key)
              }
              activeOpacity={0.7}
            >
              {chip.color && (
                <View
                  style={[styles.chipDot, { backgroundColor: chip.color }]}
                />
              )}
              <Text
                style={[
                  styles.chipText,
                  activeChip === chip.key && styles.chipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sort options */}
      {sortOptions && sortOptions.length > 0 && (
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{t('filters.sortBy')}:</Text>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortChip,
                activeSort === opt.key && styles.sortChipActive,
              ]}
              onPress={() => onSortChange?.(opt.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortChipText,
                  activeSort === opt.key && styles.sortChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
  },

  // Filter chips
  chipsRow: { marginBottom: 8 },
  chipsContent: { gap: 6, paddingEnd: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 5,
  },
  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#636366' },
  chipTextActive: { color: '#fff' },

  // Sort
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sortLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F5F5F7',
  },
  sortChipActive: { backgroundColor: '#E3F2FD' },
  sortChipText: { fontSize: 12, color: '#636366', fontWeight: '500' },
  sortChipTextActive: { color: PRIMARY, fontWeight: '600' },
});
