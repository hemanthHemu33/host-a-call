import { CustomerSettingsScreen } from '@/features/customer/CustomerAccountScreens';
import { appRoutes } from '@/navigation/routes';

export default function HostSettingsRoute() {
  return (
    <CustomerSettingsScreen
      backRoute={appRoutes.hostDashboard.path}
      settingsRoute={appRoutes.hostSettings.path}
      testID="host-settings-screen"
    />
  );
}
