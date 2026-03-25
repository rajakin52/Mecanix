import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import '../src/lib/i18n';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('auth_token');
      setIsLoggedIn(!!token);
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isReady, isLoggedIn, segments, router]);

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
      <Stack.Screen name="new-job" options={{ headerShown: true, presentation: 'modal' }} />
      <Stack.Screen name="job-detail" options={{ headerShown: true }} />
      <Stack.Screen name="inspection" options={{ headerShown: true, presentation: 'modal' }} />
      <Stack.Screen name="vehicle-detail" options={{ headerShown: true }} />
      <Stack.Screen name="new-vehicle" options={{ headerShown: true, presentation: 'modal' }} />
      <Stack.Screen name="appointments" options={{ headerShown: true }} />
      <Stack.Screen name="parts" options={{ headerShown: true }} />
      <Stack.Screen name="gate-pass" options={{ headerShown: true }} />
      <Stack.Screen name="cash-register" options={{ headerShown: true }} />
    </Stack>
  );
}
