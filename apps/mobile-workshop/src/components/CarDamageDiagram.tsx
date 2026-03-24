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
import Svg, { Path, Rect, Circle, Ellipse, G, Text as SvgText } from 'react-native-svg';
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

// Car zone definitions — positions on a top-down car SVG (300x500 viewBox)
interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ZONES: Zone[] = [
  // Front
  { id: 'front_bumper', x: 75, y: 10, width: 150, height: 35 },
  { id: 'hood', x: 75, y: 45, width: 150, height: 70 },
  { id: 'windshield', x: 85, y: 115, width: 130, height: 45 },
  // Roof
  { id: 'roof', x: 85, y: 160, width: 130, height: 100 },
  // Rear
  { id: 'rear_window', x: 85, y: 260, width: 130, height: 45 },
  { id: 'trunk', x: 75, y: 305, width: 150, height: 70 },
  { id: 'rear_bumper', x: 75, y: 375, width: 150, height: 35 },
  // Left side
  { id: 'left_fender_front', x: 30, y: 45, width: 45, height: 70 },
  { id: 'left_door_front', x: 30, y: 125, width: 55, height: 90 },
  { id: 'left_door_rear', x: 30, y: 215, width: 55, height: 90 },
  { id: 'left_fender_rear', x: 30, y: 305, width: 45, height: 70 },
  // Right side
  { id: 'right_fender_front', x: 225, y: 45, width: 45, height: 70 },
  { id: 'right_door_front', x: 215, y: 125, width: 55, height: 90 },
  { id: 'right_door_rear', x: 215, y: 215, width: 55, height: 90 },
  { id: 'right_fender_rear', x: 225, y: 305, width: 45, height: 70 },
  // Mirrors
  { id: 'left_mirror', x: 15, y: 115, width: 20, height: 25 },
  { id: 'right_mirror', x: 265, y: 115, width: 20, height: 25 },
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

  const getZoneColor = (zoneId: string) => {
    const zoneDamages = damagesByZone[zoneId];
    if (!zoneDamages || zoneDamages.length === 0) return '#E8F5E9';
    // Use the last damage type color
    return DAMAGE_TYPE_COLORS[zoneDamages[zoneDamages.length - 1]!.type] ?? '#F44336';
  };

  const getZoneOpacity = (zoneId: string) => {
    return damagesByZone[zoneId] ? 0.6 : 0.3;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t('inspection.tapToMarkDamage')}</Text>

      {/* Top-down car diagram */}
      <View style={styles.svgContainer}>
        <Svg viewBox="0 0 300 420" width="100%" height={380}>
          {/* Car body outline */}
          <G>
            {/* Main body */}
            <Path
              d="M75,45 Q60,45 55,55 L40,115 Q30,125 30,140 L30,305 Q30,375 75,380 L75,410 Q150,425 225,410 L225,380 Q270,375 270,305 L270,140 Q270,125 260,115 L245,55 Q240,45 225,45 Z"
              fill="#F5F5F7"
              stroke="#C7C7CC"
              strokeWidth={1.5}
            />
            {/* Hood lines */}
            <Path d="M90,50 L90,110" stroke="#E5E5EA" strokeWidth={0.8} />
            <Path d="M210,50 L210,110" stroke="#E5E5EA" strokeWidth={0.8} />
            {/* Windshield */}
            <Path
              d="M90,115 Q150,108 210,115 L200,155 Q150,150 100,155 Z"
              fill="#D6EAF8"
              stroke="#AEB6BF"
              strokeWidth={0.8}
            />
            {/* Rear window */}
            <Path
              d="M100,265 Q150,260 200,265 L210,300 Q150,305 90,300 Z"
              fill="#D6EAF8"
              stroke="#AEB6BF"
              strokeWidth={0.8}
            />
            {/* Front bumper */}
            <Path
              d="M75,20 Q150,5 225,20 L230,45 Q150,38 70,45 Z"
              fill="#F5F5F7"
              stroke="#C7C7CC"
              strokeWidth={1.5}
            />
            {/* Rear bumper */}
            <Path
              d="M75,380 Q150,395 225,380 L230,405 Q150,418 70,405 Z"
              fill="#F5F5F7"
              stroke="#C7C7CC"
              strokeWidth={1.5}
            />
            {/* Headlights */}
            <Ellipse cx={95} cy={25} rx={15} ry={8} fill="#FFF9C4" stroke="#FDD835" strokeWidth={1} />
            <Ellipse cx={205} cy={25} rx={15} ry={8} fill="#FFF9C4" stroke="#FDD835" strokeWidth={1} />
            {/* Taillights */}
            <Ellipse cx={95} cy={395} rx={12} ry={7} fill="#FFCDD2" stroke="#E53935" strokeWidth={1} />
            <Ellipse cx={205} cy={395} rx={12} ry={7} fill="#FFCDD2" stroke="#E53935" strokeWidth={1} />
            {/* Side mirrors */}
            <Ellipse cx={25} cy={127} rx={10} ry={12} fill="#F5F5F7" stroke="#C7C7CC" strokeWidth={1} />
            <Ellipse cx={275} cy={127} rx={10} ry={12} fill="#F5F5F7" stroke="#C7C7CC" strokeWidth={1} />
            {/* Wheels */}
            <Rect x={32} y={65} width={18} height={35} rx={6} fill="#424242" />
            <Rect x={250} y={65} width={18} height={35} rx={6} fill="#424242" />
            <Rect x={32} y={320} width={18} height={35} rx={6} fill="#424242" />
            <Rect x={250} y={320} width={18} height={35} rx={6} fill="#424242" />
          </G>

          {/* Tappable zones overlayed */}
          {ZONES.map((zone) => (
            <G key={zone.id}>
              <Rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx={4}
                fill={getZoneColor(zone.id)}
                opacity={getZoneOpacity(zone.id)}
                stroke={damagesByZone[zone.id] ? '#D32F2F' : 'transparent'}
                strokeWidth={damagesByZone[zone.id] ? 2 : 0}
                onPress={() => handleZoneTap(zone.id)}
              />
              {damagesByZone[zone.id] && (
                <G onPress={() => handleZoneTap(zone.id)}>
                  <Circle
                    cx={zone.x + zone.width - 8}
                    cy={zone.y + 8}
                    r={10}
                    fill="#D32F2F"
                  />
                  <SvgText
                    x={zone.x + zone.width - 8}
                    y={zone.y + 12}
                    fontSize={11}
                    fontWeight="bold"
                    fill="#fff"
                    textAnchor="middle"
                  >
                    {damagesByZone[zone.id]!.length}
                  </SvgText>
                </G>
              )}
            </G>
          ))}
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
                ? t(`inspection.damageZones.${selectedZone}`, selectedZone)
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

  // Damage list
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

  // Modal
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
