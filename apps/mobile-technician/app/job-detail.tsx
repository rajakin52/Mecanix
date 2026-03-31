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
  Image,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiGet, apiPost, apiPatch } from '../src/lib/api';
import PhotoAnnotator from '../src/components/PhotoAnnotator';
import VoiceTextInput from '../src/components/VoiceTextInput';
import PartsRequestCard from '../src/components/PartsRequestCard';

const PRIMARY = '#0087FF';
const ACCENT = '#D4992A';

const STATUS_COLORS: Record<string, string> = {
  received: '#2196F3',
  diagnosing: '#9C27B0',
  awaiting_approval: '#FF9800',
  insurance_review: '#FF5722',
  in_progress: '#0087FF',
  awaiting_parts: '#FFC107',
  quality_check: '#00BCD4',
  ready: '#8BC34A',
  invoiced: '#607D8B',
};

interface JobData {
  id: string;
  job_number: string;
  status: string;
  reported_problem: string;
  internal_notes: string | null;
  is_insurance: boolean;
  labels: string[];
  created_at: string;
  vehicle?: {
    id: string;
    plate: string;
    make: string;
    model: string;
    year: number | null;
  };
  customer?: {
    id: string;
    full_name: string;
    phone: string;
  };
  primary_technician?: {
    id: string;
    full_name: string;
  };
}

export default function JobDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    jobNumber?: string;
  }>();

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [annotatingUri, setAnnotatingUri] = useState<string | null>(null);

  // Flags
  const [settingFlag, setSettingFlag] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Parts requests
  const [partsRequests, setPartsRequests] = useState<any[]>([]);
  const [issuingRequest, setIssuingRequest] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await apiGet<JobData>(`/jobs/${params.jobId}`);
      setJob(data);
      // Fetch parts requests for this job
      try {
        const requests = await apiGet<any[]>(
          `/parts-requests?jobCardId=${params.jobId}`
        );
        setPartsRequests(requests);
      } catch {
        // Non-critical — ignore if parts-requests endpoint not available
        setPartsRequests([]);
      }
    } catch {
      Alert.alert(t('common.error'), t('jobDetail.fetchError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.jobId, t]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJob();
  }, [fetchJob]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !job) return;
    setAddingNote(true);
    try {
      const currentNotes = job.internal_notes ?? '';
      const timestamp = new Date().toLocaleString();
      const newNotes = currentNotes
        ? `${currentNotes}\n\n[${timestamp}]\n${noteText.trim()}`
        : `[${timestamp}]\n${noteText.trim()}`;

      await apiPatch(`/jobs/${job.id}`, { internalNotes: newNotes });
      setNoteText('');
      await fetchJob();
      Alert.alert(t('common.success'), t('jobDetail.noteAdded'));
    } catch {
      Alert.alert(t('common.error'), t('jobDetail.noteError'));
    } finally {
      setAddingNote(false);
    }
  };

  const handleCapturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Camera permission required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      // Open annotator for the captured photo
      setAnnotatingUri(uri);
    }
  };

  const handleFlag = async (flag: 'parts_needed' | 'blocked') => {
    if (!job) return;
    setSettingFlag(true);
    try {
      const currentLabels = job.labels ?? [];
      if (!currentLabels.includes(flag)) {
        await apiPatch(`/jobs/${job.id}`, {
          labels: [...currentLabels, flag],
        });
        await fetchJob();
        Alert.alert(t('common.success'), t('jobDetail.flagSet'));
      }
    } catch {
      Alert.alert(t('common.error'), t('jobDetail.flagError'));
    } finally {
      setSettingFlag(false);
    }
  };

  const handleMarkComplete = () => {
    Alert.alert(t('jobDetail.markComplete'), t('jobDetail.markCompleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          if (!job) return;
          setCompleting(true);
          try {
            await apiPost(`/jobs/${job.id}/status`, {
              status: 'quality_check',
              notes: 'Marked complete by technician',
            });
            await fetchJob();
            Alert.alert(t('common.success'), t('jobDetail.markCompleteSuccess'));
          } catch {
            Alert.alert(t('common.error'), t('jobDetail.markCompleteError'));
          } finally {
            setCompleting(false);
          }
        },
      },
    ]);
  };

  const handleCollectParts = async (requestId: string) => {
    setIssuingRequest(requestId);
    try {
      await apiPost(`/parts-requests/${requestId}/issue`, {});
      await fetchJob();
      Alert.alert(t('common.success'), t('partsRequest.collectSuccess', 'Parts collected'));
    } catch {
      Alert.alert(t('common.error'), t('partsRequest.collectError', 'Failed to collect parts'));
    } finally {
      setIssuingRequest(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: params.jobNumber ?? t('jobDetail.title') }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('jobDetail.title') }} />
        <Text style={styles.empty}>{t('common.noResults')}</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[job.status] ?? '#8E8E93';
  const hasPartsFlag = job.labels?.includes('parts_needed');
  const hasBlockedFlag = job.labels?.includes('blocked');
  const canComplete = ['in_progress'].includes(job.status);
  const canRequestParts = ['received', 'diagnosing', 'in_progress', 'awaiting_parts'].includes(job.status);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: job.job_number, headerBackTitle: t('common.back') }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />
        }
      >
        {/* Status header */}
        <View style={styles.statusHeader}>
          <Text style={styles.jobNumberLarge}>{job.job_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {t(`status.${job.status}`, job.status)}
            </Text>
          </View>
        </View>

        {/* Vehicle — tappable for history */}
        {job.vehicle && (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/vehicle-history',
                params: { vehicleId: job.vehicle!.id, vehiclePlate: job.vehicle!.plate },
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>🚗  {t('jobDetail.vehicle')}</Text>
              <Text style={styles.historyLink}>
                {t('jobDetail.viewVehicleHistory')} →
              </Text>
            </View>
            <Text style={styles.plate}>{job.vehicle.plate}</Text>
            <Text style={styles.cardSubtext}>
              {job.vehicle.make} {job.vehicle.model}
              {job.vehicle.year ? ` (${job.vehicle.year})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Customer */}
        {job.customer && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤  {t('jobDetail.customer')}</Text>
            <Text style={styles.cardValue}>{job.customer.full_name}</Text>
            {job.customer.phone && (
              <Text style={styles.cardSubtext}>{job.customer.phone}</Text>
            )}
          </View>
        )}

        {/* Problem */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋  {t('jobDetail.problem')}</Text>
          <Text style={styles.problemText}>{job.reported_problem}</Text>
        </View>

        {/* ─── FLAGS ─── */}
        <Text style={styles.sectionTitle}>🚩  {t('jobDetail.flags')}</Text>
        <View style={styles.flagsRow}>
          <TouchableOpacity
            style={[
              styles.flagButton,
              hasPartsFlag && styles.flagActive,
              hasPartsFlag && { borderColor: '#FF9800' },
            ]}
            onPress={() => handleFlag('parts_needed')}
            disabled={settingFlag || hasPartsFlag}
            activeOpacity={0.7}
          >
            <Text style={styles.flagIcon}>🔧</Text>
            <Text style={[styles.flagLabel, hasPartsFlag && { color: '#FF9800' }]}>
              {t('jobDetail.partsNeeded')}
            </Text>
            <Text style={styles.flagDesc}>{t('jobDetail.partsNeededDesc')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.flagButton,
              hasBlockedFlag && styles.flagActive,
              hasBlockedFlag && { borderColor: '#F44336' },
            ]}
            onPress={() => handleFlag('blocked')}
            disabled={settingFlag || hasBlockedFlag}
            activeOpacity={0.7}
          >
            <Text style={styles.flagIcon}>🚫</Text>
            <Text style={[styles.flagLabel, hasBlockedFlag && { color: '#F44336' }]}>
              {t('jobDetail.blocked')}
            </Text>
            <Text style={styles.flagDesc}>{t('jobDetail.blockedDesc')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── PARTS REQUESTS ─── */}
        {canRequestParts && (
          <>
            <Text style={styles.sectionTitle}>🔧  {t('partsRequest.title')}</Text>
            <TouchableOpacity
              style={styles.requestPartsBtn}
              onPress={() =>
                router.push({
                  pathname: '/parts-request',
                  params: { jobId: params.jobId!, jobNumber: job.job_number },
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.requestPartsIcon}>🔧</Text>
              <Text style={styles.requestPartsBtnText}>{t('partsRequest.title')}</Text>
            </TouchableOpacity>
          </>
        )}

        {partsRequests.length > 0 && (
          <View style={styles.partsRequestsList}>
            {partsRequests.map((req: any) => (
              <View key={req.id}>
                <PartsRequestCard request={req} />
                {req.status === 'ready' && (
                  <TouchableOpacity
                    style={[
                      styles.collectPartsBtn,
                      issuingRequest === req.id && { opacity: 0.5 },
                    ]}
                    onPress={() => handleCollectParts(req.id)}
                    disabled={issuingRequest === req.id}
                    activeOpacity={0.7}
                  >
                    {issuingRequest === req.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.collectPartsBtnText}>
                        {t('partsRequest.collectParts')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ─── NOTES ─── */}
        <Text style={styles.sectionTitle}>📝  {t('jobDetail.notes')}</Text>
        {job.internal_notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{job.internal_notes}</Text>
          </View>
        ) : (
          <Text style={styles.emptyHint}>{t('jobDetail.noNotes')}</Text>
        )}

        <View style={styles.noteInputRow}>
          <VoiceTextInput
            style={styles.noteInput}
            placeholder={t('jobDetail.notePlaceholder')}
            value={noteText}
            onChangeText={setNoteText}
            multiline
          />
          <TouchableOpacity
            style={[styles.noteSubmitBtn, (!noteText.trim() || addingNote) && { opacity: 0.4 }]}
            onPress={handleAddNote}
            disabled={!noteText.trim() || addingNote}
          >
            {addingNote ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.noteSubmitText}>{t('jobDetail.addNote')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── PHOTOS ─── */}
        <Text style={styles.sectionTitle}>📷  {t('jobDetail.photos')}</Text>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photoThumb} />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyHint}>{t('jobDetail.noPhotos')}</Text>
        )}

        <TouchableOpacity
          style={styles.addPhotoBtn}
          onPress={handleCapturePhoto}
          disabled={uploadingPhoto}
          activeOpacity={0.7}
        >
          <Text style={styles.addPhotoIcon}>📷</Text>
          <Text style={styles.addPhotoText}>{t('jobDetail.addPhoto')}</Text>
        </TouchableOpacity>

        {/* ─── MARK COMPLETE ─── */}
        {canComplete && (
          <TouchableOpacity
            style={[styles.completeBtn, completing && { opacity: 0.5 }]}
            onPress={handleMarkComplete}
            disabled={completing}
            activeOpacity={0.8}
          >
            {completing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeBtnText}>
                {t('jobDetail.markComplete')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Annotation Modal */}
      {annotatingUri && (
        <PhotoAnnotator
          imageUri={annotatingUri}
          visible={true}
          onSave={(uri) => {
            setPhotos((prev) => [...prev, uri]);
            setAnnotatingUri(null);
            Alert.alert(t('common.success'), t('jobDetail.photoAdded'));
          }}
          onClose={() => {
            // Save without annotation
            setPhotos((prev) => [...prev, annotatingUri]);
            setAnnotatingUri(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0C',
  },
  empty: { color: '#636366', fontSize: 16 },

  // Status header
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  jobNumberLarge: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Cards
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyLink: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  plate: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 1, marginBottom: 2 },
  cardValue: { fontSize: 18, fontWeight: '600', color: '#fff' },
  cardSubtext: { fontSize: 14, color: '#AEAEB2', marginTop: 2 },
  problemText: { fontSize: 15, color: '#AEAEB2', lineHeight: 22 },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#AEAEB2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Flags
  flagsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  flagButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#363638',
    minHeight: 100,
    justifyContent: 'center',
  },
  flagActive: { backgroundColor: '#1C1C1E' },
  flagIcon: { fontSize: 28, marginBottom: 6 },
  flagLabel: { fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },
  flagDesc: { fontSize: 11, color: '#8E8E93', textAlign: 'center', marginTop: 2 },

  // Notes
  notesBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  notesText: { fontSize: 14, color: '#AEAEB2', lineHeight: 20 },
  emptyHint: {
    color: '#636366',
    fontSize: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  noteInputRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    minHeight: 48,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#363638',
  },
  noteSubmitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  noteSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Photos
  photosRow: { marginHorizontal: 16, marginBottom: 10 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginEnd: 8,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#363638',
    borderStyle: 'dashed',
    minHeight: 52,
  },
  addPhotoIcon: { fontSize: 20 },
  addPhotoText: { fontSize: 15, fontWeight: '600', color: '#AEAEB2' },

  // Mark complete
  completeBtn: {
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  completeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // Parts requests
  requestPartsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    backgroundColor: ACCENT + '18',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: ACCENT,
    minHeight: 52,
  },
  requestPartsIcon: { fontSize: 20 },
  requestPartsBtnText: { fontSize: 16, fontWeight: '700', color: ACCENT },
  partsRequestsList: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  collectPartsBtn: {
    backgroundColor: '#00C853',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  collectPartsBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
