import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';

const PRIMARY = '#0087FF';

interface UpsellItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  icon: string | null;
  category: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedItems: UpsellItem[]) => void;
  applicableTo?: 'appointment' | 'job_card';
}

export default function UpsellModal({
  visible,
  onClose,
  onConfirm,
  applicableTo = 'job_card',
}: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<UpsellItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fetchItems();
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
      setSelected(new Set());
    }
  }, [visible, slideAnim]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UpsellItem[]>(
        `/upsell-items?applicableTo=${applicableTo}`,
      );
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter((i) => selected.has(i.id));
  const totalPrice = selectedItems.reduce((s, i) => s + i.price, 0);

  const handleConfirm = () => {
    onConfirm(selectedItems);
  };

  const renderItem = ({ item, index }: { item: UpsellItem; index: number }) => {
    const isSelected = selected.has(item.id);
    return (
      <Animated.View
        style={{
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30 + index * 10, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={[styles.itemCard, isSelected && styles.itemCardSelected]}
          onPress={() => toggleItem(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.itemLeft}>
            <Text style={styles.itemIcon}>{item.icon ?? '🔧'}</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.itemDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemPrice}>
              {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <View
              style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
              ]}
            >
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>💎</Text>
            <Text style={styles.title}>{t('upsell.title')}</Text>
            <Text style={styles.subtitle}>{t('upsell.subtitle')}</Text>
          </View>

          {/* Items list */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={PRIMARY}
              style={{ marginVertical: 32 }}
            />
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>{t('common.noResults')}</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer with total and actions */}
          <View style={styles.footer}>
            {selected.size > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {t('upsell.selectedCount', { count: selected.size })}
                </Text>
                <Text style={styles.totalValue}>
                  +{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                <Text style={styles.skipBtnText}>{t('upsell.skip')}</Text>
              </TouchableOpacity>
              {selected.size > 0 && (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>
                    {t('upsell.confirmAdd')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
  },
  headerIcon: { fontSize: 36, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },

  // List
  list: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 400 },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 15,
    marginVertical: 32,
  },

  // Item card
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#E3F2FD',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  itemIcon: { fontSize: 28 },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  itemDesc: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  totalLabel: { fontSize: 14, color: '#636366', fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  buttonRow: { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 48,
    justifyContent: 'center',
  },
  skipBtnText: { color: '#636366', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
