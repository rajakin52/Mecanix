import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { apiGet, apiPost } from '../src/lib/api';

const PRIMARY = '#0087FF';

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface UpsellItem {
  id: string;
  name: string;
  price: number;
  icon: string | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

const SERVICE_TYPES = [
  'maintenance',
  'repair',
  'inspection',
  'body_work',
  'electrical',
  'diagnostics',
] as const;

export default function BookAppointmentScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [serviceType, setServiceType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [description, setDescription] = useState('');
  const [upsellItems, setUpsellItems] = useState<UpsellItem[]>([]);
  const [selectedUpsells, setSelectedUpsells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch vehicles on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Vehicle[]>('/vehicles?pageSize=100');
        setVehicles(Array.isArray(data) ? data : []);
      } catch { /* empty */ }
    })();
  }, []);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<TimeSlot[]>(`/appointments/slots/${selectedDate}`);
        setSlots(Array.isArray(data) ? data : []);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDate]);

  // Fetch upsell items for step 4
  useEffect(() => {
    if (step === 4) {
      (async () => {
        try {
          const data = await apiGet<UpsellItem[]>('/upsell-items?applicableTo=appointment');
          setUpsellItems(Array.isArray(data) ? data : []);
        } catch {
          setUpsellItems([]);
        }
      })();
    }
  }, [step]);

  const toggleUpsell = (id: string) => {
    setSelectedUpsells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Generate next 14 days
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  });

  const handleSubmit = async () => {
    if (!selectedVehicle || !serviceType || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const upsellNotes = upsellItems
        .filter((i) => selectedUpsells.has(i.id))
        .map((i) => i.name)
        .join(', ');

      await apiPost('/appointments', {
        vehicleId: selectedVehicle.id,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        serviceType,
        description: description.trim() || undefined,
        notes: upsellNotes ? `Add-ons: ${upsellNotes}` : undefined,
      });

      Alert.alert(t('common.success'), t('booking.bookingSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('booking.bookingError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 1) return !!selectedVehicle;
    if (step === 2) return !!serviceType;
    if (step === 3) return !!selectedDate && !!selectedTime;
    return true;
  };

  const progressWidth = `${(step / 5) * 100}%`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('booking.title'), headerBackTitle: t('common.back') }} />

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: progressWidth as unknown as number }]} />
        </View>
        <Text style={styles.progressText}>
          {t('booking.step', { current: step, total: 5 })}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* STEP 1: Select Vehicle */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>{t('booking.selectVehicle')}</Text>
            {vehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.optionCard, selectedVehicle?.id === v.id && styles.optionCardSelected]}
                onPress={() => setSelectedVehicle(v)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionTitle}>{v.plate}</Text>
                <Text style={styles.optionSubtext}>{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* STEP 2: Service Type */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>{t('booking.serviceType')}</Text>
            {SERVICE_TYPES.map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.optionCard, serviceType === st && styles.optionCardSelected]}
                onPress={() => setServiceType(st)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionTitle}>{t(`booking.serviceTypes.${st}`)}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* STEP 3: Date & Time */}
        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>{t('booking.selectDate')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
              {dateOptions.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.dateChip, selectedDate === d.value && styles.dateChipSelected]}
                  onPress={() => { setSelectedDate(d.value); setSelectedTime(''); }}
                >
                  <Text style={[styles.dateChipText, selectedDate === d.value && styles.dateChipTextSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedDate && (
              <>
                <Text style={[styles.stepTitle, { marginTop: 20 }]}>{t('booking.selectTime')}</Text>
                {loading ? (
                  <ActivityIndicator color={PRIMARY} style={{ marginTop: 16 }} />
                ) : slots.filter((s) => s.available).length === 0 ? (
                  <Text style={styles.noSlots}>{t('booking.noSlots')}</Text>
                ) : (
                  <View style={styles.slotsGrid}>
                    {slots.filter((s) => s.available).map((slot) => (
                      <TouchableOpacity
                        key={slot.time}
                        style={[styles.slotChip, selectedTime === slot.time && styles.slotChipSelected]}
                        onPress={() => setSelectedTime(slot.time)}
                      >
                        <Text style={[styles.slotText, selectedTime === slot.time && styles.slotTextSelected]}>
                          {slot.time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={[styles.stepTitle, { marginTop: 20 }]}>{t('booking.description')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('booking.descriptionPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </>
        )}

        {/* STEP 4: Upsell Add-ons */}
        {step === 4 && (
          <>
            <Text style={styles.stepTitle}>{t('booking.addOns')}</Text>
            {upsellItems.length === 0 ? (
              <Text style={styles.noSlots}>{t('common.noResults')}</Text>
            ) : (
              upsellItems.map((item) => {
                const isSelected = selectedUpsells.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.upsellCard, isSelected && styles.upsellCardSelected]}
                    onPress={() => toggleUpsell(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.upsellIcon}>{item.icon ?? '✨'}</Text>
                    <Text style={styles.upsellName}>{item.name}</Text>
                    <Text style={styles.upsellPrice}>
                      {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <View style={[styles.upsellCheck, isSelected && styles.upsellCheckSelected]}>
                      {isSelected && <Text style={styles.upsellCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* STEP 5: Review & Confirm */}
        {step === 5 && (
          <>
            <Text style={styles.stepTitle}>{t('booking.reviewBooking')}</Text>
            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>🚗 {t('booking.selectVehicle')}</Text>
                <Text style={styles.reviewValue}>{selectedVehicle?.plate}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>🔧 {t('booking.serviceType')}</Text>
                <Text style={styles.reviewValue}>{t(`booking.serviceTypes.${serviceType}`)}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>📅 {t('booking.selectDate')}</Text>
                <Text style={styles.reviewValue}>{selectedDate}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>🕐 {t('booking.selectTime')}</Text>
                <Text style={styles.reviewValue}>{selectedTime}</Text>
              </View>
              {description.trim() && (
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>📝 {t('booking.description')}</Text>
                  <Text style={styles.reviewValue}>{description}</Text>
                </View>
              )}
              {selectedUpsells.size > 0 && (
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>✨ {t('booking.addOns')}</Text>
                  <Text style={styles.reviewValue}>
                    {upsellItems.filter((i) => selectedUpsells.has(i.id)).map((i) => i.name).join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep((s) => (s - 1) as Step)}
          >
            <Text style={styles.backBtnText}>{t('booking.previous')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !canNext() && { opacity: 0.4 }]}
          onPress={() => {
            if (step === 5) handleSubmit();
            else setStep((s) => (s + 1) as Step);
          }}
          disabled={!canNext() || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 5 ? t('booking.confirmBooking') : t('booking.next')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 100 },

  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0, gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: '#E5E5EA', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 3 },
  progressText: { fontSize: 13, color: '#8E8E93', fontWeight: '600', minWidth: 60 },

  stepTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 16, marginTop: 8 },

  // Option cards
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  optionCardSelected: { borderColor: PRIMARY, backgroundColor: '#E3F2FD' },
  optionTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  optionSubtext: { fontSize: 14, color: '#636366', marginTop: 2 },

  // Date
  dateRow: { marginBottom: 8 },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginEnd: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateChipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dateChipText: { fontSize: 14, fontWeight: '600', color: '#363638' },
  dateChipTextSelected: { color: '#fff' },

  // Time slots
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 44,
    justifyContent: 'center',
  },
  slotChipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  slotText: { fontSize: 15, fontWeight: '600', color: '#363638' },
  slotTextSelected: { color: '#fff' },
  noSlots: { color: '#8E8E93', fontSize: 15, textAlign: 'center', marginTop: 16 },

  // Description
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    textAlignVertical: 'top',
  },

  // Upsell
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    gap: 12,
  },
  upsellCardSelected: { borderColor: PRIMARY, backgroundColor: '#E3F2FD' },
  upsellIcon: { fontSize: 24 },
  upsellName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  upsellPrice: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  upsellCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellCheckSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  upsellCheckmark: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Review
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  reviewLabel: { fontSize: 13, color: '#8E8E93', marginBottom: 4 },
  reviewValue: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },

  // Nav buttons
  navRow: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  backBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 52,
    justifyContent: 'center',
  },
  backBtnText: { color: '#636366', fontSize: 16, fontWeight: '600' },
  nextBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
