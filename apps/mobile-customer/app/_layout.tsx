import { Stack } from 'expo-router';
import '../src/lib/i18n';

export default function RootLayout() {
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
    </Stack>
  );
}
