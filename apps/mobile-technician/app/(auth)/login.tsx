import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (!error) router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MECANIX</Text>
      <Text style={styles.subtitle}>Technician</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.email')}
        placeholderTextColor="#636366"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        placeholderTextColor="#636366"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? t('common.loading') : t('auth.login')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#1C1C1E' },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center', color: '#4CAF50' },
  subtitle: { fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 48, color: '#AEAEB2' },
  input: { borderWidth: 1, borderColor: '#363638', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, color: '#fff', backgroundColor: '#2C2C2E' },
  button: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
