import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const PRIMARY = '#0087FF';

interface Props {
  icon: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dark?: boolean;
}

export default function EmptyState({
  icon,
  message,
  actionLabel,
  onAction,
  dark,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.message, dark && styles.messageDark]}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  message: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  messageDark: { color: '#636366' },
  actionBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
