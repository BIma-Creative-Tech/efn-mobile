import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { APP } from '../../src/config/brand';
import { T, font } from '../../src/ui/kit';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={typeof color === "string" ? color : T.text} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: T.scheme === 'dark' ? T.bg : T.card },
        headerTintColor: T.text,
        headerTitleStyle: { ...font.bold, color: T.text },
        tabBarStyle: { backgroundColor: T.scheme === 'dark' ? T.bg : T.card, borderTopColor: T.border, minHeight: 56 },
        tabBarActiveTintColor: T.scheme === 'dark' ? T.action : T.action,
        tabBarInactiveTintColor: T.muted,
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', headerShown: false, tabBarIcon: icon('home-outline'), tabBarAccessibilityLabel: 'Beranda' }} />
      <Tabs.Screen
        name="belanja"
        options={{ title: APP.catalogTabLabel, tabBarIcon: icon(APP.catalogTabLabel === 'Menu' ? 'restaurant-outline' : 'basket-outline'), tabBarAccessibilityLabel: APP.catalogTabLabel }}
      />
      <Tabs.Screen name="pesanan" options={{ title: 'Pesanan', tabBarIcon: icon('receipt-outline'), tabBarAccessibilityLabel: 'Pesanan' }} />
      <Tabs.Screen name="akun" options={{ title: 'Akun', tabBarIcon: icon('person-circle-outline'), tabBarAccessibilityLabel: 'Akun' }} />
    </Tabs>
  );
}
