import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import '../src/lib/i18n';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from '../src/lib/notifications';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check auth on mount
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('customer_auth_token');
      setIsLoggedIn(!!token);
      setIsReady(true);
    })();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isReady, isLoggedIn, segments, router]);

  // Push notifications
  useEffect(() => {
    if (!isLoggedIn) return;
    registerForPushNotifications();

    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.jobId) {
        router.push({
          pathname: '/job-detail',
          params: { jobId: data.jobId as string },
        });
      } else if (data?.invoiceId) {
        router.push({
          pathname: '/invoice-detail',
          params: { invoiceId: data.invoiceId as string },
        });
      }
    });

    return () => subscription.remove();
  }, [isLoggedIn, router]);

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
