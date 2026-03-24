import { Stack } from 'expo-router';
import '../src/lib/i18n';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="new-job"
        options={{ headerShown: true, presentation: 'modal' }}
      />
      <Stack.Screen
        name="job-detail"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="inspection"
        options={{ headerShown: true, presentation: 'modal' }}
      />
      <Stack.Screen
        name="vehicle-detail"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="parts"
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="gate-pass"
        options={{ headerShown: true }}
      />
    </Stack>
  );
}
