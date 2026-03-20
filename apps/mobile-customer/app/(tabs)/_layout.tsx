import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#4CAF50' }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.vehicles') }} />
      <Tabs.Screen name="jobs" options={{ title: t('tabs.jobs') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
