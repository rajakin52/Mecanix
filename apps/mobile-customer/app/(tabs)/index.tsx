import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function VehiclesScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tabs.vehicles')}</Text>
      <Text style={styles.empty}>{t('common.noResults')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48 },
});
