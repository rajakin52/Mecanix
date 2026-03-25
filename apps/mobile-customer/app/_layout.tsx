import { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import '../src/lib/i18n';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const checkAuth = useCallback(async () => {
    const token = await SecureStore.getItemAsync('customer_auth_token');
    setHasToken(!!token);
    setIsReady(true);
  }, []);

  // Check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-check when app comes to foreground (after login stores token)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAuth();
    });
    return () => sub.remove();
  }, [checkAuth]);

  // Also re-check when segments change (navigation happens)
  useEffect(() => {
    checkAuth();
  }, [segments, checkAuth]);

  // Redirect based on auth state
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!hasToken && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    // Don't auto-redirect FROM auth to tabs — let the login/signup handle it
  }, [isReady, hasToken, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job-detail" options={{ headerShown: true }} />
      <Stack.Screen name="vehicle-detail" options={{ headerShown: true }} />
      <Stack.Screen name="book-appointment" options={{ headerShown: true, presentation: 'modal' }} />
      <Stack.Screen name="invoice-detail" options={{ headerShown: true }} />
      <Stack.Screen name="invoices" options={{ headerShown: true }} />
      <Stack.Screen name="my-appointments" options={{ headerShown: true }} />
    </Stack>
  );
}
