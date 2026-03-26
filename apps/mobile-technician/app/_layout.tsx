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
  }, [segments]);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0C' }}>
        <ActivityIndicator size="large" color="#0087FF" />
      </View>
    );
  }

  const darkHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: '#1C1C1E' },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '700' as const },
  };

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job-detail" options={darkHeader} />
      <Stack.Screen name="vehicle-history" options={darkHeader} />
    </Stack>
  );
}
