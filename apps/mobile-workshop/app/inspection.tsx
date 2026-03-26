import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import CarDamageDiagram, {
  type DamageEntry,
} from '../src/components/CarDamageDiagram';
import CollapsibleSection from '../src/components/CollapsibleSection';
import { apiFetch } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

const PHOTO_ANGLES = [
  'front',
  'rear',
  'left',
  'right',
  'roof',
  'interior',
] as const;
type PhotoAngle = (typeof PHOTO_ANGLES)[number];

const FUEL_LEVELS = [
  'empty',
  'quarter',
  'half',
  'three_quarter',
  'full',
] as const;

interface EquipmentState {
  spareTire: boolean;
  jack: boolean;
  tools: boolean;
  radio: boolean;
  mats: boolean;
  hubcaps: boolean;
  antenna: boolean;
  documents: boolean;
}

async function uploadPhoto(
  uri: string,
  jobId: string,
  angle: string,
): Promise<string | null> {
  try {
    const fileName = `inspections/${jobId}/${angle}_${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await supabase.storage
      .from('inspection-photos')
      .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn(`Photo upload failed for ${angle}:`, error.message);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('inspection-photos').getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.warn(`Photo upload error for ${angle}:`, err);
    return null;
  }
}

export default function InspectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    vehicleId: string;
    jobNumber?: string;
    vehiclePlate?: string;
    mandatory?: string;
  }>();

  const isMandatory = params.mandatory === '1';

  // Photos — one per angle
  const [photos, setPhotos] = useState<Record<PhotoAngle, string | null>>({
    front: null,
    rear: null,
    left: null,
    right: null,
    roof: null,
    interior: null,
  });

  // Damage entries
  const [damages, setDamages] = useState<DamageEntry[]>([]);

  // Vehicle details
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState<string>('');

  // Equipment checklist
  const [equipment, setEquipment] = useState<EquipmentState>({
    spareTire: false,
    jack: false,
    tools: false,
    radio: false,
    mats: false,
    hubcaps: false,
    antenna: false,
    documents: false,
  });

  // Notes
  const [personalItems, setPersonalItems] = useState('');
  const [notes, setNotes] = useState('');

  // Signature
  const signatureRef = useRef<SignatureViewRef>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const capturePhoto = async (angle: PhotoAngle) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotos((prev) => ({ ...prev, [angle]: uri }));
    }
  };

  const toggleEquipment = (key: keyof EquipmentState) => {
    setEquipment((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSignatureOK = (signature: string) => {
    setSignatureData(signature);
    setShowSignaturePad(false);
  };

  const handleSignatureClear = () => {
    signatureRef.current?.clearSignature();
    setSignatureData(null);
  };

  const REQUIRED_OUTSIDE_PHOTOS: PhotoAngle[] = ['front', 'rear', 'left', 'right'];

  const handleSubmit = async () => {
    if (!params.jobId || !params.vehicleId) {
      Alert.alert(t('common.error'), 'Missing job or vehicle ID');
      return;
    }

    // Validate mandatory fields
    if (isMandatory || true) {
      const missingPhotos = REQUIRED_OUTSIDE_PHOTOS.filter((angle) => !photos[angle]);
      if (missingPhotos.length > 0) {
        Alert.alert(
          t('common.error'),
          `Please take the following exterior photos: ${missingPhotos.map((a) => t(`inspection.photoAngles.${a}`)).join(', ')}`,
        );
        return;
      }
      if (!mileage.trim()) {
        Alert.alert(t('common.error'), 'Odometer reading is required');
        return;
      }
      if (!fuelLevel) {
        Alert.alert(t('common.error'), 'Fuel level is required');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Upload photos to Supabase storage
      const photoEntries = Object.entries(photos).filter(
        ([, uri]) => uri !== null,
      ) as [PhotoAngle, string][];

      const uploadedUrls: string[] = [];

      if (photoEntries.length > 0) {
        setUploadProgress(t('common.uploadingPhotos'));

        const uploadResults = await Promise.all(
          photoEntries.map(([angle, uri]) =>
            uploadPhoto(uri, params.jobId, angle),
          ),
        );

        for (const url of uploadResults) {
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length < photoEntries.length) {
          // Some uploads failed — warn but continue
          Alert.alert(t('common.error'), t('common.photoUploadError'));
        }
      }

      setUploadProgress('');

      // Build inspection payload
      const body: Record<string, unknown> = {
        jobCardId: params.jobId,
        vehicleId: params.vehicleId,
        exteriorDamage: damages,
        hasSpareTire: equipment.spareTire,
        hasJack: equipment.jack,
        hasTools: equipment.tools,
        hasRadio: equipment.radio,
        hasMats: equipment.mats,
        hasHubcaps: equipment.hubcaps,
        hasAntenna: equipment.antenna,
        hasDocuments: equipment.documents,
      };

      if (mileage.trim()) body.mileageIn = parseInt(mileage, 10);
      if (fuelLevel) body.fuelLevel = fuelLevel;
      if (personalItems.trim()) body.personalItems = personalItems.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (signatureData) body.customerSignature = signatureData;

      // Note: photos array is stored separately in the DB photos column
      // The backend inspection service would need a minor update to accept photos
      // For now, append photo URLs to notes as a workaround
      if (uploadedUrls.length > 0) {
        const photoNote = `Photos: ${uploadedUrls.join(', ')}`;
        body.notes = body.notes
          ? `${body.notes}\n${photoNote}`
          : photoNote;
      }

      await apiFetch('/inspections', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      Alert.alert(t('common.success'), t('inspection.saveSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('inspection.saveError'),
      );
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: t('inspection.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header info */}
        {(params.jobNumber || params.vehiclePlate) && (
          <View style={styles.headerBanner}>
            {params.jobNumber && (
              <Text style={styles.headerText}>{params.jobNumber}</Text>
            )}
            {params.vehiclePlate && (
              <Text style={styles.headerPlate}>{params.vehiclePlate}</Text>
            )}
          </View>
        )}

        {/* ─── PROGRESS BAR ─── */}
        {(() => {
          const photoCount = Object.values(photos).filter(Boolean).length;
          const hasDamageData = damages.length > 0;
          const hasVehicleData = !!(mileage.trim() || fuelLevel);
          const hasEquipmentData = Object.values(equipment).some(Boolean);
          const hasNotesData = !!(personalItems.trim() || notes.trim());
          const hasSig = !!signatureData;
          const completed = [photoCount > 0, hasDamageData, hasVehicleData, hasEquipmentData, hasNotesData, hasSig].filter(Boolean).length;
          return (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(completed / 6) * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{completed}/6 sections</Text>
            </View>
          );
        })()}

        {/* ─── SECTION 1: PHOTOS (Required: front, rear, left, right) ─── */}
        <CollapsibleSection
          title={`${t('inspection.section.photos')} *`}
          defaultOpen={true}
          badge={`${Object.values(photos).filter(Boolean).length}/6`}
        >
        <View style={styles.photoGrid}>
          {PHOTO_ANGLES.map((angle) => {
            const isRequired = REQUIRED_OUTSIDE_PHOTOS.includes(angle);
            const isTaken = !!photos[angle];
            return (
            <TouchableOpacity
              key={angle}
              style={[
                styles.photoCard,
                isRequired && !isTaken && styles.photoCardRequired,
                isTaken && styles.photoCardDone,
              ]}
              onPress={() => capturePhoto(angle)}
              activeOpacity={0.7}
            >
              {photos[angle] ? (
                <View style={styles.photoWrapper}>
                  <Image
                    source={{ uri: photos[angle]! }}
                    style={styles.photoImage}
                  />
                  <Text style={styles.photoRetake}>
                    {t('inspection.retakePhoto')}
                  </Text>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.cameraIcon}>📷</Text>
                  <Text style={styles.photoLabel}>
                    {t(`inspection.photoAngles.${angle}`)}
                  </Text>
                  <Text style={styles.photoTap}>
                    {t('inspection.tapToCapture')}
                  </Text>
                </View>
              )}
              <Text style={styles.photoAngleLabel}>
                {t(`inspection.photoAngles.${angle}`)}
                {isRequired ? ' *' : ''}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View>

        </CollapsibleSection>

        {/* ─── SECTION 2: DAMAGE MAP ─── */}
        <CollapsibleSection
          title={t('inspection.section.damage')}
          defaultOpen={true}
          badge={damages.length > 0 ? `${damages.length}` : undefined}
        >
        <View style={{ paddingHorizontal: 16 }}>
          <CarDamageDiagram damages={damages} onDamagesChange={setDamages} />
        </View>
        </CollapsibleSection>

        {/* ─── SECTION 3: VEHICLE DETAILS ─── */}
        <CollapsibleSection
          title={`${t('inspection.section.vehicle')} *`}
          defaultOpen={true}
          badge={mileage.trim() && fuelLevel ? '✓' : undefined}
        >
        <Text style={styles.fieldLabel}>{t('inspection.mileage')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('inspection.mileagePlaceholder')}
          placeholderTextColor="#8E8E93"
          value={mileage}
          onChangeText={setMileage}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>{t('inspection.fuelLevel')} *</Text>
        <View style={styles.fuelRow}>
          {FUEL_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.fuelChip,
                fuelLevel === level && styles.fuelChipActive,
              ]}
              onPress={() => setFuelLevel(level)}
            >
              <Text
                style={[
                  styles.fuelChipText,
                  fuelLevel === level && styles.fuelChipTextActive,
                ]}
              >
                {t(`inspection.fuelLevels.${level}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        </CollapsibleSection>

        {/* ─── SECTION 4: EQUIPMENT ─── */}
        <CollapsibleSection
          title={t('inspection.section.equipment')}
          badge={Object.values(equipment).some(Boolean) ? '✓' : undefined}
        >
        <View style={styles.checklistContainer}>
          {(Object.keys(equipment) as (keyof EquipmentState)[]).map((key) => (
            <View key={key} style={styles.checklistRow}>
              <Text style={styles.checklistLabel}>
                {t(`inspection.equipmentItems.${key}`)}
              </Text>
              <Switch
                value={equipment[key]}
                onValueChange={() => toggleEquipment(key)}
                trackColor={{ true: '#4CAF50', false: '#E5E5EA' }}
                thumbColor={equipment[key] ? '#fff' : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        </CollapsibleSection>

        {/* ─── SECTION 5: NOTES ─── */}
        <CollapsibleSection
          title={t('inspection.section.notes')}
        >

        <Text style={styles.fieldLabel}>{t('inspection.personalItems')}</Text>
        <TextInput
          style={styles.textArea}
          placeholder={t('inspection.personalItemsPlaceholder')}
          placeholderTextColor="#8E8E93"
          value={personalItems}
          onChangeText={setPersonalItems}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>{t('inspection.notes')}</Text>
        <TextInput
          style={styles.textArea}
          placeholder={t('inspection.notesPlaceholder')}
          placeholderTextColor="#8E8E93"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        </CollapsibleSection>

        {/* ─── SECTION 6: CUSTOMER SIGNATURE ─── */}
        <CollapsibleSection
          title={t('inspection.section.signature')}
          badge={signatureData ? '✓' : undefined}
        >
        <Text style={styles.signatureHint}>
          {t('inspection.signatureHint')}
        </Text>

        {signatureData ? (
          <View style={styles.signaturePreview}>
            <Image
              source={{ uri: signatureData }}
              style={styles.signatureImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.clearSignatureBtn}
              onPress={() => {
                setSignatureData(null);
                setShowSignaturePad(false);
              }}
            >
              <Text style={styles.clearSignatureText}>
                {t('inspection.clearSignature')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : showSignaturePad ? (
          <View style={styles.signaturePadContainer}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleSignatureOK}
              onClear={handleSignatureClear}
              autoClear={false}
              descriptionText=""
              clearText={t('inspection.clearSignature')}
              confirmText={t('common.confirm')}
              webStyle={`
                .m-signature-pad { box-shadow: none; border: 1px solid #E5E5EA; border-radius: 10px; }
                .m-signature-pad--body { border: none; }
                .m-signature-pad--footer { display: flex; justify-content: space-between; padding: 8px 16px; }
                .m-signature-pad--footer .button { background-color: #4CAF50; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; }
                .m-signature-pad--footer .button.clear { background-color: #F5F5F7; color: #636366; }
              `}
              style={styles.signaturePad}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.openSignatureBtn}
            onPress={() => setShowSignaturePad(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.openSignatureIcon}>✍️</Text>
            <Text style={styles.openSignatureText}>
              {t('inspection.signature')}
            </Text>
          </TouchableOpacity>
        )}

        </CollapsibleSection>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator color="#fff" />
              {uploadProgress ? (
                <Text style={styles.uploadProgressText}>
                  {uploadProgress}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.submitButtonText}>
              {t('inspection.saveInspection')}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 14,
    margin: 16,
    marginBottom: 0,
    gap: 12,
  },
  headerText: { fontSize: 17, fontWeight: '700', color: '#1B5E20' },
  headerPlate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0087FF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    minWidth: 70,
  },

  // Sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
    letterSpacing: -0.3,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  photoCard: {
    width: '31%',
    aspectRatio: 0.85,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  photoCardRequired: {
    borderColor: '#FF9800',
    borderWidth: 2,
    backgroundColor: '#FFF8E1',
  },
  photoCardDone: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  photoWrapper: { flex: 1 },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  photoRetake: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 4,
    fontWeight: '600',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  cameraIcon: { fontSize: 28, marginBottom: 4 },
  photoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636366',
    textAlign: 'center',
  },
  photoTap: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  photoAngleLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Fields
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
    marginHorizontal: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    minHeight: 70,
  },

  // Fuel
  fuelRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  fuelChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fuelChipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  fuelChipText: { fontSize: 13, fontWeight: '600', color: '#636366' },
  fuelChipTextActive: { color: '#fff' },

  // Equipment checklist
  checklistContainer: {
    marginHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  checklistLabel: { fontSize: 15, color: '#1C1C1E' },

  // Signature
  signatureHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  signaturePadContainer: {
    marginHorizontal: 16,
    height: 250,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  signaturePad: { flex: 1 },
  signaturePreview: {
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  signatureImage: {
    width: '100%',
    height: 150,
  },
  clearSignatureBtn: {
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  clearSignatureText: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '600',
  },
  openSignatureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    gap: 8,
  },
  openSignatureIcon: { fontSize: 24 },
  openSignatureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636366',
  },

  // Submit
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  submitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
