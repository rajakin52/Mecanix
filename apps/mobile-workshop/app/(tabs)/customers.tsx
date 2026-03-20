import { View, Text, FlatList, TextInput, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function CustomersScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder={t('customers.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={[]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => null}
        ListEmptyComponent={<Text style={styles.empty}>{t('common.noResults')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  searchInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, marginBottom: 16 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 48 },
});
