import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PartsRequestData {
  id: string;
  request_number: string;
  status: string;
  priority: string;
  items_count: number;
  created_at: string;
}

interface Props {
  request: PartsRequestData;
}

const STATUS_COLORS: Record<string, string> = {
  requested: '#2196F3',
  picking: '#FFB300',
  ready: '#00C853',
  issued: '#8E8E93',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function PartsRequestCard({ request }: Props) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[request.status] ?? '#8E8E93';
  const statusKey = `partsRequest.${request.status}` as const;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.requestNumber}>{request.request_number}</Text>
        <View style={styles.badgeRow}>
          {request.priority === 'urgent' && (
            <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
              <Text style={styles.badgeText}>{t('partsRequest.urgent')}</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{t(statusKey, request.status)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.meta}>
          {request.items_count} {request.items_count === 1 ? 'item' : 'items'}
        </Text>
        <Text style={styles.meta}>{timeAgo(request.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
