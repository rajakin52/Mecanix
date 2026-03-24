import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export type Severity = 'critical' | 'recommended' | 'good';

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string }> = {
  critical: { color: '#D32F2F', bg: '#FFEBEE' },
  recommended: { color: '#F57F17', bg: '#FFF8E1' },
  good: { color: '#2E7D32', bg: '#E8F5E9' },
};

interface Props {
  value: Severity;
  onChange: (severity: Severity) => void;
  compact?: boolean;
}

export default function SeverityPicker({ value, onChange, compact }: Props) {
  const { t } = useTranslation();

  const severities: Severity[] = ['critical', 'recommended', 'good'];

  if (compact) {
    return (
      <View style={styles.compactRow}>
        {severities.map((s) => {
          const config = SEVERITY_CONFIG[s];
          const isActive = value === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.compactDot,
                { backgroundColor: isActive ? config.color : '#E5E5EA' },
              ]}
              onPress={() => onChange(s)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {severities.map((s) => {
        const config = SEVERITY_CONFIG[s];
        const isActive = value === s;
        return (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? config.bg : '#F5F5F7',
                borderColor: isActive ? config.color : '#E5E5EA',
              },
            ]}
            onPress={() => onChange(s)}
            activeOpacity={0.7}
          >
            <View style={[styles.indicator, { backgroundColor: config.color }]} />
            <Text
              style={[
                styles.chipText,
                { color: isActive ? config.color : '#8E8E93' },
              ]}
            >
              {t(`inspection.severity.${s}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SeverityLegend() {
  const { t } = useTranslation();

  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#D32F2F' }]} />
        <Text style={styles.legendText}>{t('inspection.severity.critical')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#F57F17' }]} />
        <Text style={styles.legendText}>{t('inspection.severity.recommended')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
        <Text style={styles.legendText}>{t('inspection.severity.good')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 5,
    justifyContent: 'center',
  },
  indicator: { width: 10, height: 10, borderRadius: 5 },
  chipText: { fontSize: 12, fontWeight: '600' },

  compactRow: { flexDirection: 'row', gap: 6 },
  compactDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#8E8E93' },
});
