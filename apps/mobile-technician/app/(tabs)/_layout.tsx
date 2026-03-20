import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#636366',
        tabBarStyle: { backgroundColor: '#1C1C1E', borderTopColor: '#363638' },
        headerStyle: { backgroundColor: '#1C1C1E' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
