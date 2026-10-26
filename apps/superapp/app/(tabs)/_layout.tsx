import { Tabs } from 'expo-router/js-tabs';
import { APP } from '../../src/config/brand';
import { T } from '../../src/ui/kit';
import { AppTabBar, TabHeader } from '../../src/ui/nav';

export default function TabsLayout() {
  return (
    <Tabs
      // Riwayat tab: tombol kembali di header tab membawa ke tab sebelumnya.
      backBehavior="history"
      tabBar={(p) => <AppTabBar {...p} />}
      screenOptions={{
        header: (p) => <TabHeader options={p.options} navigation={p.navigation} />,
        sceneStyle: { backgroundColor: T.bg },
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', headerShown: false, tabBarAccessibilityLabel: 'Beranda' }} />
      <Tabs.Screen name="belanja" options={{ title: APP.catalogTabLabel, tabBarAccessibilityLabel: APP.catalogTabLabel }} />
      <Tabs.Screen name="pesanan" options={{ title: 'Pesanan', tabBarAccessibilityLabel: 'Pesanan' }} />
      <Tabs.Screen name="akun" options={{ title: 'Akun', tabBarAccessibilityLabel: 'Akun' }} />
    </Tabs>
  );
}
