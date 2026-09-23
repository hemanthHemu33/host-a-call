import {
  Bell,
  Camera,
  Home,
  Mic,
  Phone,
  Search,
  Settings,
  Video,
  Wallet,
  X,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScrollScreen } from '@/components/layout';
import {
  AppHeader,
  Avatar,
  BackHeader,
  Banner,
  BottomSheetWrapper,
  Button,
  CallControlButton,
  CallHistoryRow,
  Card,
  Checkbox,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  HostCard,
  IconButton,
  InlineError,
  LegalContent,
  ListRow,
  MetricCard,
  NotificationRow,
  OTPInput,
  PermissionExplainer,
  PhoneField,
  RadioCard,
  RankBadge,
  ReferralRow,
  SearchField,
  SectionHeader,
  SelectField,
  Skeleton,
  Snackbar,
  StatusBadge,
  SwitchRow,
  TabBar,
  TextArea,
  TextField,
  Toast,
  TransactionRow,
  WalletCard,
  WalletHeader,
} from '@/components/ui';
import { ui } from '@/components/ui/theme';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

function GallerySection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

export function ComponentGalleryScreen() {
  const [otp, setOtp] = useState('123');
  const [checked, setChecked] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [tab, setTab] = useState('home');
  const sheetRef = useRef<BottomSheetModal>(null);

  return (
    <ScrollScreen
      contentStyle={styles.content}
      testID="component-gallery-screen"
    >
      <AppHeader
        actionIcon={Bell}
        subtitle="Reusable mobile UI states"
        title="Component gallery"
      />

      <GallerySection title="Buttons">
        <View style={styles.wrap}>
          <Button title="Primary" />
          <Button title="Secondary" variant="secondary" />
          <Button title="Tonal" variant="tonal" />
          <Button title="Ghost" variant="ghost" />
          <Button title="Delete" variant="destructive" />
          <Button compact title="Compact" />
          <Button loading title="Loading" />
          <Button disabled title="Disabled" />
          <Button
            accessibilityLabel="Search"
            icon={Search}
            iconOnly
            title="Search"
          />
          <IconButton accessibilityLabel="Settings" icon={Settings} />
        </View>
      </GallerySection>

      <GallerySection title="Call controls">
        <View style={styles.row}>
          <CallControlButton icon={Mic} label="Mute" />
          <CallControlButton icon={Video} label="Video" selected />
          <CallControlButton icon={X} label="End" tone="destructive" />
        </View>
      </GallerySection>

      <GallerySection title="Forms">
        <TextField
          helperText="Shown below every editable field."
          label="Display name"
          placeholder="Enter your name"
        />
        <PhoneField label="Phone number" placeholder="+91 98765 43210" />
        <OTPInput onChange={setOtp} testID="gallery-otp" value={otp} />
        <SearchField placeholder="Search hosts" />
        <SelectField label="Language" value="Hindi" />
        <TextArea label="Support message" placeholder="Describe the issue" />
        <Checkbox
          checked={checked}
          label="I accept the calling rules"
          onPress={() => {
            setChecked((value) => !value);
          }}
        />
        <RadioCard
          description="Best for longer conversations."
          label="Voice call"
          selected
        />
        <SwitchRow
          label="Analytics enabled"
          onValueChange={setEnabled}
          value={enabled}
        />
        <InlineError message="Enter a valid phone number." />
      </GallerySection>

      <GallerySection title="Navigation">
        <BackHeader title="Back header" />
        <WalletHeader balance="₹1,250" />
        <TabBar
          activeKey={tab}
          items={[
            { icon: Home, key: 'home', label: 'Home' },
            { icon: Phone, key: 'calls', label: 'Calls' },
            { icon: Wallet, key: 'wallet', label: 'Wallet' },
          ]}
          onChange={setTab}
        />
      </GallerySection>

      <GallerySection title="Cards and badges">
        <Card>
          <Text style={styles.cardTitle}>Base card</Text>
          <Text style={styles.body}>Tokenized surface with readable text.</Text>
        </Card>
        <HostCard
          language="Hindi"
          name="Anjali Host"
          rank="gold"
          rate="₹18/min"
          status="Online"
        />
        <View style={styles.wrap}>
          <MetricCard label="Calls" trend="+12%" value="248" />
          <WalletCard balance="₹1,250" />
          <RankBadge rank="diamond" />
          <StatusBadge label="Verified" tone="success" />
          <Avatar label="Connecto Host" />
        </View>
      </GallerySection>

      <GallerySection title="States and feedback">
        <EmptyState
          actionLabel="Refresh"
          message="No calls match the current filter."
          title="Nothing here yet"
        />
        <ErrorState
          message="The mock provider returned a recoverable error."
          title="Could not load"
        />
        <Skeleton />
        <Banner message="Preview build using mock adapters." title="Preview" />
        <Toast>Saved locally</Toast>
        <Snackbar actionLabel="Undo" message="Referral copied" />
        <Button
          onPress={() => {
            setDialogVisible(true);
          }}
          title="Open confirmation"
          variant="secondary"
        />
        <Button
          onPress={() => {
            sheetRef.current?.present();
          }}
          title="Open bottom sheet"
          variant="tonal"
        />
        <ConfirmationDialog
          message="This confirms destructive and non-destructive dialog states."
          onCancel={() => {
            setDialogVisible(false);
          }}
          onConfirm={() => {
            setDialogVisible(false);
          }}
          title="Confirm action"
          visible={dialogVisible}
        />
        <BottomSheetWrapper ref={sheetRef}>
          <Text style={styles.cardTitle}>Bottom sheet</Text>
          <Text style={styles.body}>
            Gorhom wrapper with tokenized content padding.
          </Text>
        </BottomSheetWrapper>
      </GallerySection>

      <GallerySection title="Rows">
        <ListRow
          description="General row shell"
          icon={Camera}
          title="Profile photo"
        />
        <TransactionRow
          description="Wallet top-up"
          meta="+₹500"
          title="Payment"
        />
        <CallHistoryRow
          description="8 minutes"
          meta="₹144"
          title="Voice call"
        />
        <ReferralRow
          description="Qualified"
          meta="₹50"
          title="Referral reward"
        />
        <NotificationRow description="Payment completed" title="Notification" />
      </GallerySection>

      <GallerySection title="Explainers and legal">
        <PermissionExplainer
          actionLabel="Enable"
          body="Microphone permission is required before joining a paid voice call."
          title="Microphone access"
        />
        <LegalContent title="Legal content shell">
          <Text style={styles.body}>
            Legal copy uses the same spacing and type system as feature screens.
          </Text>
        </LegalContent>
      </GallerySection>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  content: {
    gap: ui.spacing[7],
  },
  row: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  section: {
    gap: ui.spacing[4],
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
});
