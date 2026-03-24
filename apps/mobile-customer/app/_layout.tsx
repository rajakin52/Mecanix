import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import '../src/lib/i18n';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from '../src/lib/notifications';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications();

    // Handle notification tap — navigate to relevant screen
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
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="job-detail"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="vehicle-detail"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="book-appointment"
        options={{ headerShown: true, presentation: 'modal' }}
      />
      <Stack.Screen
        name="invoice-detail"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="invoices"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="my-appointments"
        options={{ headerShown: true }}
      />
    </Stack>
  );
}
