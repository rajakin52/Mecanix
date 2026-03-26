import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

export interface DamageEntry {
  location: string;
  type: string;
  description?: string;
}

const DAMAGE_TYPES = [
  'scratch',
  'dent',
  'crack',
  'paint',
  'missing',
  'broken',
] as const;

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  scratch: '#FF9800',
  dent: '#F44336',
  crack: '#9C27B0',
  paint: '#2196F3',
  missing: '#607D8B',
  broken: '#D32F2F',
};

// Top-down exploded view zones matching the reference image
interface Zone {
  id: string;
  label: string;
  path: string;
  cx: number;
  cy: number;
}

const ZONES: Zone[] = [
  // Front bumper (top of diagram)
  { id: 'front_bumper', label: 'Front Bumper', path: 'M120,10 L280,10 Q290,10 290,20 L290,45 L110,45 L110,20 Q110,10 120,10 Z', cx: 200, cy: 28 },
  // Hood
  { id: 'hood', label: 'Hood', path: 'M115,50 L285,50 L280,130 Q275,140 270,140 L130,140 Q125,140 120,130 Z', cx: 200, cy: 95 },
  // Windshield
  { id: 'windshield', label: 'Windshield', path: 'M135,145 L265,145 L255,195 Q250,200 245,200 L155,200 Q150,200 145,195 Z', cx: 200, cy: 172 },
  // Roof
  { id: 'roof', label: 'Roof', path: 'M148,205 L252,205 L252,310 L148,310 Z', cx: 200, cy: 258 },
  // Rear window
  { id: 'rear_window', label: 'Rear Window', path: 'M145,315 L255,315 L265,365 Q268,370 265,375 L135,375 Q132,370 135,365 Z', cx: 200, cy: 345 },
  // Trunk
  { id: 'trunk', label: 'Trunk', path: 'M120,380 L280,380 Q285,380 285,390 L280,460 L120,460 L115,390 Q115,380 120,380 Z', cx: 200, cy: 420 },
  // Rear bumper
  { id: 'rear_bumper', label: 'Rear Bumper', path: 'M115,465 L285,465 L290,495 Q290,505 280,505 L120,505 Q110,505 110,495 Z', cx: 200, cy: 485 },
  // Left front door (viewer's right side)
  { id: 'left_door_front', label: 'L Front Door', path: 'M290,95 L340,105 Q350,108 355,115 L355,205 L340,205 L290,200 Z', cx: 325, cy: 150 },
  // Left rear door
  { id: 'left_door_rear', label: 'L Rear Door', path: 'M290,210 L340,210 L355,210 L355,315 Q350,320 340,322 L290,315 Z', cx: 325, cy: 265 },
  // Right front door (viewer's left)
  { id: 'right_door_front', label: 'R Front Door', path: 'M110,95 L60,105 Q50,108 45,115 L45,205 L60,205 L110,200 Z', cx: 75, cy: 150 },
  // Right rear door
  { id: 'right_door_rear', label: 'R Rear Door', path: 'M110,210 L60,210 L45,210 L45,315 Q50,320 60,322 L110,315 Z', cx: 75, cy: 265 },
  // Wheels (circles)
  { id: 'front_left_wheel', label: 'FL Wheel', path: 'M355,80 A25,25 0 1,1 355,130 A25,25 0 1,1 355,80 Z', cx: 355, cy: 105 },
  { id: 'front_right_wheel', label: 'FR Wheel', path: 'M45,80 A25,25 0 1,1 45,130 A25,25 0 1,1 45,80 Z', cx: 45, cy: 105 },
  { id: 'rear_left_wheel', label: 'RL Wheel', path: 'M355,370 A25,25 0 1,1 355,420 A25,25 0 1,1 355,370 Z', cx: 355, cy: 395 },
  { id: 'rear_right_wheel', label: 'RR Wheel', path: 'M45,370 A25,25 0 1,1 45,420 A25,25 0 1,1 45,370 Z', cx: 45, cy: 395 },
  // Mirrors
  { id: 'left_mirror', label: 'L Mirror', path: 'M350,70 L375,60 L380,75 L355,85 Z', cx: 365, cy: 72 },
  { id: 'right_mirror', label: 'R Mirror', path: 'M50,70 L25,60 L20,75 L45,85 Z', cx: 35, cy: 72 },
];

interface Props {
  damages: DamageEntry[];
  onDamagesChange: (damages: DamageEntry[]) => void;
}

export default function CarDamageDiagram({ damages, onDamagesChange }: Props) {
  const { t } = useTranslation();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('scratch');
  const [description, setDescription] = useState('');

  const damagesByZone = damages.reduce<Record<string, DamageEntry[]>>(
    (acc, d) => {
      if (!acc[d.location]) acc[d.location] = [];
      acc[d.location]!.push(d);
      return acc;
    },
    {},
  );

  const handleZoneTap = (zoneId: string) => {
    setSelectedZone(zoneId);
    setSelectedType('scratch');
    setDescription('');
    setModalVisible(true);
  };

  const handleAddDamage = () => {
    if (!selectedZone) return;
    const entry: DamageEntry = {
      location: selectedZone,
      type: selectedType,
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    onDamagesChange([...damages, entry]);
    setModalVisible(false);
    setSelectedZone(null);
  };

  const handleRemoveDamage = (index: number) => {
    const updated = damages.filter((_, i) => i !== index);
    onDamagesChange(updated);
  };

  const getZoneFill = (zoneId: string) => {
    const isWheel = zoneId.includes('wheel');
    if (damagesByZone[zoneId]) return '#FEE2E2';
    return isWheel ? '#E5E7EB' : '#F3F4F6';
  };

  const getZoneStroke = (zoneId: string) => {
    if (damagesByZone[zoneId]) return '#EF4444';
    return '#9CA3AF';
  };

  const zoneLabel = (zone: Zone) => {
    return t(`inspection.damageZones.${zone.id}`, { defaultValue: zone.label });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t('inspection.tapToMarkDamage')}</Text>

      <View style={styles.svgContainer}>
        <Svg viewBox="0 0 400 520" width="100%" height={420}>
          {/* Direction labels */}
          <SvgText x={200} y={8} textAnchor="middle" fontSize={10} fill="#9CA3AF" fontWeight="600">FRONT</SvgText>
          <SvgText x={200} y={518} textAnchor="middle" fontSize={10} fill="#9CA3AF" fontWeight="600">REAR</SvgText>

          {/* Render all zones */}
          {ZONES.map((zone) => {
            const hasDamage = !!damagesByZone[zone.id];
            const isSmall = zone.id.includes('mirror') || zone.id.includes('wheel');
            return (
              <G key={zone.id}>
                <Path
                  d={zone.path}
                  fill={getZoneFill(zone.id)}
                  stroke={getZoneStroke(zone.id)}
                  strokeWidth={hasDamage ? 2.5 : 1.2}
                  onPress={() => handleZoneTap(zone.id)}
                />
                <SvgText
                  x={zone.cx} y={zone.cy + (isSmall ? 0 : 4)}
                  textAnchor="middle" fontSize={isSmall ? 6 : 8}
                  fill={hasDamage ? '#DC2626' : '#6B7280'}
                  fontWeight={hasDamage ? 'bold' : 'normal'}
                  onPress={() => handleZoneTap(zone.id)}
                >
                  {zone.label}
                </SvgText>
                {/* Damage count badge */}
                {hasDamage && (
                  <G onPress={() => handleZoneTap(zone.id)}>
                    <Circle cx={zone.cx} cy={zone.cy - 16} r={11} fill="#EF4444" stroke="#fff" strokeWidth={2} />
                    <SvgText x={zone.cx} y={zone.cy - 12} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">
                      {damagesByZone[zone.id]!.length}
                    </SvgText>
                  </G>
                )}
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Damage list */}
      {damages.length > 0 && (
        <View style={styles.damageList}>
          {damages.map((d, i) => (
            <View key={i} style={styles.damageItem}>
              <View
                style={[
                  styles.damageTypeDot,
                  { backgroundColor: DAMAGE_TYPE_COLORS[d.type] ?? '#F44336' },
                ]}
              />
              <View style={styles.damageItemContent}>
                <Text style={styles.damageLocation}>
                  {t(`inspection.damageZones.${d.location}`, d.location)}
                </Text>
                <Text style={styles.damageType}>
                  {t(`inspection.damageTypes.${d.type}`, d.type)}
                  {d.description ? ` — ${d.description}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveDamage(i)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.removeBtn}>{t('inspection.removeDamage')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {damages.length === 0 && (
        <Text style={styles.noDamage}>{t('inspection.noDamage')}</Text>
      )}

      {/* Damage type picker modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedZone
                ? t(`inspection.damageZones.${selectedZone}`, ZONES.find(z => z.id === selectedZone)?.label ?? selectedZone)
                : ''}
            </Text>

            <Text style={styles.modalSubtitle}>
              {t('inspection.addDamage')}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
              {DAMAGE_TYPES.map((dtype) => (
                <TouchableOpacity
                  key={dtype}
                  style={[
                    styles.typeChip,
                    selectedType === dtype && {
                      backgroundColor: DAMAGE_TYPE_COLORS[dtype],
                    },
                  ]}
                  onPress={() => setSelectedType(dtype)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === dtype && { color: '#fff' },
                    ]}
                  >
                    {t(`inspection.damageTypes.${dtype}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder={t('inspection.damageDescriptionPlaceholder')}
              placeholderTextColor="#8E8E93"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleAddDamage}
              >
                <Text style={styles.modalConfirmText}>
                  {t('inspection.addDamage')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  hint: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 13,
    marginBottom: 8,
  },
  svgContainer: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  damageList: { marginTop: 12 },
  damageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  damageTypeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginEnd: 10,
  },
  damageItemContent: { flex: 1 },
  damageLocation: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  damageType: { fontSize: 13, color: '#636366', marginTop: 1 },
  removeBtn: { color: '#D32F2F', fontSize: 13, fontWeight: '600' },
  noDamage: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 16,
  },
  typeRow: { marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    marginEnd: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  typeChipText: { fontSize: 14, fontWeight: '600', color: '#363638' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  modalCancelText: { color: '#636366', fontSize: 15, fontWeight: '500' },
  modalConfirm: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
