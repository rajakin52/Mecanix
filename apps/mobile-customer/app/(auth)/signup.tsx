import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = fullName.trim().length >= 2
    && email.includes('@')
    && phone.trim().length >= 7
    && password.length >= 8;

  const handleSignUp = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/customer-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? t('auth.signupFailed'));
        return;
      }

      const data = json.data;
      const token = data.session?.accessToken;
      const refresh = data.session?.refreshToken;

      if (!token) {
        setError('Signup succeeded but no token received');
        return;
      }

      await SecureStore.setItemAsync('customer_auth_token', token);
      if (refresh) await SecureStore.setItemAsync('customer_refresh_token', refresh);
      if (data.user) await SecureStore.setItemAsync('customer_user', JSON.stringify(data.user));

      router.replace('/(tabs)');
    } catch {
      setError(t('auth.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>MECANIX</Text>
          <Text style={styles.subtitle}>{t('auth.createAccount')}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t('auth.fullName')}
          placeholderTextColor="#8E8E93"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor="#8E8E93"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.phone')}
          placeholderTextColor="#8E8E93"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor="#8E8E93"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading || !canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t('common.loading') : t('auth.createAccount')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.linkText}>{t('auth.alreadyHaveAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 36, alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#0087FF', letterSpacing: -1 },
  subtitle: { fontSize: 16, fontWeight: '500', color: '#8E8E93', marginTop: 4 },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#D32F2F', fontSize: 14, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F8F9FA',
  },
  hint: { fontSize: 12, color: '#8E8E93', marginTop: -8, marginBottom: 14, marginStart: 4 },
  button: {
    backgroundColor: '#0087FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0087FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#0087FF', fontSize: 15, fontWeight: '600' },
});
