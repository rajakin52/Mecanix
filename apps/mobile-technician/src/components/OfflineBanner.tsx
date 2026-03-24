import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../lib/offline';

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useNetworkStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <View style={[styles.banner, !isOnline ? styles.offline : styles.syncing]}>
      <Text style={styles.icon}>{!isOnline ? '📡' : '🔄'}</Text>
      <Text style={styles.text}>
        {!isOnline
          ? `Offline — ${pendingCount} action(s) queued`
          : `Syncing ${pendingCount} action(s)...`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    justifyContent: 'center',
  },
  offline: { backgroundColor: '#D32F2F' },
  syncing: { backgroundColor: '#FF9800' },
  icon: { fontSize: 16 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
