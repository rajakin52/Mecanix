import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#0087FF';

interface LabourLine {
  description: string;
  subtotal: number;
}

interface PartsLine {
  part_name: string;
  subtotal: number;
}

interface Props {
  labourLines: LabourLine[];
  partsLines: PartsLine[];
  labourTotal: number;
  partsTotal: number;
  taxAmount: number;
  grandTotal: number;
  onSelectTier: (tier: 'essential' | 'recommended' | 'complete') => void;
  actionLoading: boolean;
}

export default function TieredQuote({
  labourLines,
  partsLines,
  labourTotal,
  partsTotal,
  taxAmount,
  grandTotal,
  onSelectTier,
  actionLoading,
}: Props) {
  const { t } = useTranslation();

  // Split items into tiers based on cost (heuristic: top 40% = essential, next 30% = recommended, rest = complete)
  // In a real implementation, items would be tagged with severity from the inspection
  const allItems = [
    ...labourLines.map((l) => ({ name: l.description, cost: l.subtotal, type: 'labour' as const })),
    ...partsLines.map((p) => ({ name: p.part_name, cost: p.subtotal, type: 'parts' as const })),
  ].sort((a, b) => b.cost - a.cost);

  const essentialCount = Math.max(1, Math.ceil(allItems.length * 0.4));
  const recommendedCount = Math.max(essentialCount, Math.ceil(allItems.length * 0.7));

  const essentialItems = allItems.slice(0, essentialCount);
  const recommendedItems = allItems.slice(0, recommendedCount);
  const completeItems = allItems;

  const essentialTotal = essentialItems.reduce((s, i) => s + i.cost, 0);
  const recommendedTotal = recommendedItems.reduce((s, i) => s + i.cost, 0);
  const completeTotal = grandTotal;

  const tiers = [
    {
      key: 'essential' as const,
      label: t('jobDetail.tiers.essential'),
      desc: t('jobDetail.tiers.essentialDesc'),
      items: essentialItems,
      total: essentialTotal,
      color: '#FF9800',
      highlight: false,
    },
    {
      key: 'recommended' as const,
      label: t('jobDetail.tiers.recommended'),
      desc: t('jobDetail.tiers.recommendedDesc'),
      items: recommendedItems,
      total: recommendedTotal,
      color: PRIMARY,
      highlight: true,
    },
    {
      key: 'complete' as const,
      label: t('jobDetail.tiers.complete'),
      desc: t('jobDetail.tiers.completeDesc'),
      items: completeItems,
      total: completeTotal,
      color: '#8BC34A',
      highlight: false,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('jobDetail.tiers.title')}</Text>

      {tiers.map((tier) => (
        <TouchableOpacity
          key={tier.key}
          style={[
            styles.tierCard,
            tier.highlight && styles.tierCardHighlight,
            { borderColor: tier.color },
          ]}
          onPress={() => onSelectTier(tier.key)}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          {tier.highlight && (
            <View style={[styles.popularBadge, { backgroundColor: tier.color }]}>
              <Text style={styles.popularText}>{t('jobDetail.tiers.mostPopular')}</Text>
            </View>
          )}

          <View style={styles.tierHeader}>
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            <Text style={styles.tierPrice}>
              {tier.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <Text style={styles.tierDesc}>{tier.desc}</Text>

          <View style={styles.tierItems}>
            {tier.items.slice(0, 4).map((item, i) => (
              <View key={i} style={styles.tierItemRow}>
                <Text style={styles.tierItemDot}>•</Text>
                <Text style={styles.tierItemName} numberOfLines={1}>{item.name}</Text>
              </View>
            ))}
            {tier.items.length > 4 && (
              <Text style={styles.tierMoreItems}>
                +{tier.items.length - 4} more items
              </Text>
            )}
          </View>

          <View style={[styles.selectBtn, { backgroundColor: tier.color }]}>
            <Text style={styles.selectBtnText}>{t('jobDetail.tiers.selectPlan')}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 16 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 16,
  },

  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tierCardHighlight: {
    borderWidth: 3,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    left: '30%',
  },
  popularText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierLabel: { fontSize: 18, fontWeight: '800' },
  tierPrice: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  tierDesc: { fontSize: 13, color: '#8E8E93', marginBottom: 12 },

  tierItems: { marginBottom: 14 },
  tierItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  tierItemDot: { fontSize: 14, color: '#8E8E93' },
  tierItemName: { fontSize: 14, color: '#363638', flex: 1 },
  tierMoreItems: { fontSize: 13, color: '#8E8E93', fontStyle: 'italic', marginTop: 4 },

  selectBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  selectBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
