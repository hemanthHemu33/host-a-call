import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { AlertTriangle, IndianRupee } from 'lucide-react-native';
import type { RefObject } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BottomSheetWrapper, Button } from '@/components/ui';
import { Card, StatusBadge } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { usePulseStyle } from '@/motion/reanimated';

import { quickAmountRupees } from '../finance/finance.models';

type LowBalanceNoticeCardProps = {
  currentRateLabel: string;
  estimatedRemainingTimeLabel: string;
  onAddMoney: () => void;
  pulse: boolean;
  remainingBalanceLabel: string;
  testID?: string;
};

export function LowBalanceNoticeCard({
  currentRateLabel,
  estimatedRemainingTimeLabel,
  onAddMoney,
  pulse,
  remainingBalanceLabel,
  testID,
}: LowBalanceNoticeCardProps) {
  const pulseStyle = usePulseStyle(pulse);

  return (
    <Animated.View style={pulseStyle} testID={testID}>
      <Card style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <View style={styles.warningIcon}>
            <AlertTriangle color={ui.color.status.warning} size={22} />
          </View>
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>Low balance</Text>
            <Text style={styles.warningBody}>
              About {estimatedRemainingTimeLabel} remains at {currentRateLabel}.
              Wallet balance is estimated to reach {remainingBalanceLabel} if
              this call continues at the current rate.
            </Text>
          </View>
          <StatusBadge label={estimatedRemainingTimeLabel} tone="warning" />
        </View>
        <Button
          compact
          icon={IndianRupee}
          onPress={onAddMoney}
          testID="call-low-balance-add-money"
          title="Add Money"
          variant="secondary"
        />
      </Card>
    </Animated.View>
  );
}

type AddMoneyDuringCallSheetProps = {
  currentRateLabel: string;
  onDismiss?: () => void;
  graceRemainingLabel: string;
  onClose: () => void;
  onContinue: () => void;
  onSelectAmount: (amount: number) => void;
  selectedAmount: number;
  sheetRef: RefObject<BottomSheetModal | null>;
};

export function AddMoneyDuringCallSheet({
  currentRateLabel,
  graceRemainingLabel,
  onDismiss,
  onClose,
  onContinue,
  onSelectAmount,
  selectedAmount,
  sheetRef,
}: AddMoneyDuringCallSheetProps) {
  return (
    <BottomSheetWrapper
      onDismiss={onDismiss ?? onClose}
      ref={sheetRef}
      snapPoints={['72%', '92%']}
    >
      <ScrollView
        contentContainerStyle={styles.sheetStack}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.sheetCard} variant="strong">
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            Add money without dropping the call
          </Text>
          <Text style={styles.sheetBody}>
            The call can stay active for the next {graceRemainingLabel} while
            the wallet top-up flow completes. Current voice or video pricing
            remains {currentRateLabel}.
          </Text>
          <View style={styles.quickGrid}>
            {quickAmountRupees.map((amount) => {
              const selected = selectedAmount === amount;

              return (
                <Button
                  compact
                  key={amount}
                  onPress={() => {
                    onSelectAmount(amount);
                  }}
                  testID={`call-add-money-amount-${String(amount)}`}
                  title={`Rs ${String(amount)}`}
                  variant={selected ? 'primary' : 'secondary'}
                />
              );
            })}
          </View>
          <View style={styles.sheetActions}>
            <Button
              onPress={onClose}
              testID="call-add-money-cancel"
              title="Keep calling"
              variant="secondary"
            />
            <Button
              icon={IndianRupee}
              onPress={onContinue}
              testID="call-add-money-continue"
              title={`Continue with Rs ${String(selectedAmount)}`}
            />
          </View>
        </Card>
      </ScrollView>
    </BottomSheetWrapper>
  );
}

const styles = StyleSheet.create({
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  sheetActions: {
    gap: ui.spacing[3],
  },
  sheetBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  sheetCard: {
    gap: ui.spacing[4],
  },
  sheetStack: {
    gap: ui.spacing[4],
    paddingBottom: ui.spacing[6],
  },
  sheetTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  warningBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  warningCard: {
    borderColor: ui.color.status.warning,
    borderWidth: 1,
    gap: ui.spacing[3],
  },
  warningCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  warningHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  warningIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.status.warningSoft,
    borderRadius: ui.radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  warningTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
});
