import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    setLoading(true);
    // TODO: Integrate with Supabase phone OTP
    setCodeSent(true);
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    // TODO: Verify OTP with Supabase
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MECANIX</Text>
      {!codeSent ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('common.loading') : t('auth.sendCode')}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('auth.otpPlaceholder')}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyCode} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('common.loading') : t('auth.verifyCode')}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 48, color: '#4CAF50' },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
