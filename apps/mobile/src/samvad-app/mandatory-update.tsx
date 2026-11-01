import { Linking } from 'react-native';

import { useSamvadAuthStore } from '@/samvad/auth-state';

import { Body, Notice, PrimaryButton, SamvadScreen, Title } from '@/samvad/ui';

export default function MandatoryUpdateScreen() {
  const updateUrl = useSamvadAuthStore((state) => state.updateUrl);
  return (
    <SamvadScreen>
      <Title>Update required</Title>
      <Body>
        Install the latest supported Connecto version before continuing.
      </Body>
      {updateUrl === null || updateUrl.length === 0 ? (
        <Notice error>The app-store update URL is not configured.</Notice>
      ) : null}
      <PrimaryButton
        disabled={updateUrl === null || updateUrl.length === 0}
        onPress={() => {
          if (updateUrl !== null) void Linking.openURL(updateUrl);
        }}
      >
        Open app store
      </PrimaryButton>
    </SamvadScreen>
  );
}
