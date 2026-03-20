import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tabs.profile')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0A0A0C' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
});
