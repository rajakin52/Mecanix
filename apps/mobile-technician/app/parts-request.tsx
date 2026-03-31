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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { apiGet, apiPost } from '../src/lib/api';

const PRIMARY = '#0087FF';
const ACCENT = '#D4992A';

interface PartResult {
  id: string;
  part_number: string;
  description: string;
  stock_level: number;
}

interface CartItem {
  part: PartResult;
  quantity: number;
}

export default function PartsRequestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string; jobNumber?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PartResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await apiGet<PartResult[]>(
        `/parts?search=${encodeURIComponent(query.trim())}`
      );
      setSearchResults(data);
    } catch {
      // Silently fail search — user can retry
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const addToCart = (part: PartResult) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.part.id === part.id);
      if (existing) {
        return prev.map((item) =>
          item.part.id === part.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { part, quantity: 1 }];
    });
  };

  const updateQuantity = (partId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.part.id !== partId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert(t('common.error'), t('partsRequest.emptyCart', 'Add at least one part'));
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('/parts-requests', {
        jobCardId: params.jobId,
        priority,
        items: cart.map((item) => ({
          partId: item.part.id,
          quantity: item.quantity,
        })),
        oldPartNote: notes.trim() || undefined,
      });
      Alert.alert(t('common.success'), t('partsRequest.submitSuccess', 'Parts request submitted'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  const isInCart = (partId: string) => cart.some((item) => item.part.id === partId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: `${t('partsRequest.title')} — ${params.jobNumber ?? ''}`,
          headerBackTitle: t('common.back'),
        }}
      />

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('partsRequest.searchParts')}
            placeholderTextColor="#636366"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && (
            <ActivityIndicator
              style={styles.searchSpinner}
              size="small"
              color={PRIMARY}
            />
          )}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            {searchResults.map((part) => {
              const inCart = isInCart(part.id);
              return (
                <View key={part.id} style={styles.resultRow}>
                  <View style={styles.resultInfo}>
                    <Text style={styles.partNumber}>{part.part_number}</Text>
                    <Text style={styles.partDesc} numberOfLines={1}>
                      {part.description}
                    </Text>
                    <Text style={styles.stockText}>
                      Stock: {part.stock_level}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, inCart && styles.addBtnActive]}
                    onPress={() => addToCart(part)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addBtnText, inCart && styles.addBtnTextActive]}>
                      {inCart ? '+1' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {searchQuery.trim().length >= 2 &&
          !searching &&
          searchResults.length === 0 && (
            <Text style={styles.emptyHint}>{t('common.noResults')}</Text>
          )}

        {/* Cart */}
        {cart.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {t('partsRequest.cart')} ({cart.length})
            </Text>
            {cart.map((item) => (
              <View key={item.part.id} style={styles.cartRow}>
                <View style={styles.cartInfo}>
                  <Text style={styles.cartPartNumber}>
                    {item.part.part_number}
                  </Text>
                  <Text style={styles.cartPartDesc} numberOfLines={1}>
                    {item.part.description}
                  </Text>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.part.id, -1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.part.id, 1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Priority */}
        <Text style={styles.sectionTitle}>{t('partsRequest.priority')}</Text>
        <View style={styles.priorityRow}>
          <TouchableOpacity
            style={[
              styles.priorityBtn,
              priority === 'normal' && styles.priorityBtnActive,
            ]}
            onPress={() => setPriority('normal')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.priorityBtnText,
                priority === 'normal' && styles.priorityBtnTextActive,
              ]}
            >
              {t('partsRequest.normal')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.priorityBtn,
              priority === 'urgent' && styles.priorityBtnUrgent,
            ]}
            onPress={() => setPriority('urgent')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.priorityBtnText,
                priority === 'urgent' && { color: '#FF3B30' },
              ]}
            >
              {t('partsRequest.urgent')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>{t('partsRequest.notes')}</Text>
        <TextInput
          style={styles.notesInput}
          placeholder={t('partsRequest.notesPlaceholder', 'Additional notes...')}
          placeholderTextColor="#636366"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (cart.length === 0 || submitting) && { opacity: 0.4 },
          ]}
          onPress={handleSubmit}
          disabled={cart.length === 0 || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{t('partsRequest.submit')}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scrollArea: { flex: 1 },

  // Search
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#363638',
  },
  searchSpinner: {
    position: 'absolute',
    right: 14,
    top: 16,
  },

  // Results
  resultsContainer: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  resultInfo: { flex: 1, marginEnd: 10 },
  partNumber: { fontSize: 15, fontWeight: '700', color: '#fff' },
  partDesc: { fontSize: 13, color: '#AEAEB2', marginTop: 2 },
  stockText: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  addBtn: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#363638',
  },
  addBtnActive: {
    backgroundColor: ACCENT + '22',
    borderColor: ACCENT,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#AEAEB2' },
  addBtnTextActive: { color: ACCENT },

  emptyHint: {
    color: '#636366',
    fontSize: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    textAlign: 'center',
  },

  // Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Cart
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cartInfo: { flex: 1, marginEnd: 10 },
  cartPartNumber: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cartPartDesc: { fontSize: 13, color: '#AEAEB2', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#363638',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  qtyValue: { fontSize: 18, fontWeight: '800', color: '#fff', minWidth: 24, textAlign: 'center' },

  // Priority
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
  },
  priorityBtn: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#363638',
  },
  priorityBtnActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '18',
  },
  priorityBtnUrgent: {
    borderColor: '#FF3B30',
    backgroundColor: '#FF3B3018',
  },
  priorityBtnText: { fontSize: 15, fontWeight: '700', color: '#AEAEB2' },
  priorityBtnTextActive: { color: ACCENT },

  // Notes
  notesInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    marginHorizontal: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#363638',
  },

  // Submit
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
