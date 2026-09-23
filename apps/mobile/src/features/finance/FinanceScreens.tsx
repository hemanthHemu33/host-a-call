import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Headset,
  IndianRupee,
  Landmark,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tag,
  TimerReset,
  UserCheck,
  Wallet,
  Zap,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  normalizeApiError,
  type Money,
  type Payment,
  type Transaction,
} from '@connecto/domain';

import { LottieIllustration } from '@/components/animations/LottieIllustration';
import { KeyboardScreen, ScrollScreen } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner } from '@/components/ui/feedback';
import { BackHeader } from '@/components/ui/navigation';
import {
  Card,
  EmptyState,
  ErrorState,
  GlassSurface,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { invalidateDomainQueries } from '@/data/query-client';
import { useHaptics } from '@/motion/MotionProvider';
import { appRoutes } from '@/navigation/routes';

import { formatCallSafetyDuration } from '../calls/call-safety';
import {
  financePaymentAdapter,
  pollVerifiedPayment,
  type CheckoutCallback,
} from './finance.adapters';
import {
  createInrMoney,
  detailIdFromParams,
  formatRupees,
  formatSignedTransactionAmount,
  parsePaymentRouteParams,
  parseRupeeAmount,
  pickPaymentCallReturnParams,
  quickAmountRupees,
  statusTone,
  terminalKindForPayment,
  transactionTitle,
  type PaymentMethod,
  type PaymentTerminalKind,
} from './finance.models';
import {
  mobileDataIds,
  useCustomerCallsQuery,
  useTransactionsQuery,
  useWalletQuery,
} from '../data/mobileDataHooks';

type QueryStateProps<T> = {
  children: (data: T) => React.ReactNode;
  empty?: (data: T) => boolean;
  emptyMessage: string;
  emptyTitle: string;
  query: {
    data: T | undefined;
    error: unknown;
    isError: boolean;
    isPending: boolean;
    refetch: () => void;
  };
  skeletonLines?: number;
};

type RouteTarget =
  | string
  | {
      params?: Record<string, string>;
      pathname: string;
    };

const routeWithReturnTo = (
  route: RouteTarget,
  returnTo: string,
): RouteTarget => {
  if (typeof route === 'string') {
    return { params: { returnTo }, pathname: route };
  }

  return {
    ...route,
    params: {
      ...route.params,
      returnTo,
    },
  };
};

const customerAddMoneyTransactionsPath = `${appRoutes.customerAddMoney.path}?initialScreen=transactions`;

const transactionDetailReturnPath = (transactionId: string) =>
  appRoutes.customerTransactionDetail.path.replace(
    '[transactionId]',
    encodeURIComponent(transactionId),
  );

function QueryState<T>({
  children,
  empty,
  emptyMessage,
  emptyTitle,
  query,
  skeletonLines = 4,
}: QueryStateProps<T>) {
  if (query.isPending) {
    return (
      <Card>
        <Skeleton lines={skeletonLines} />
      </Card>
    );
  }

  if (query.isError) {
    const error = normalizeApiError(query.error);

    return (
      <ErrorState
        message={error.message}
        onRetry={query.refetch}
        title={error.code === 'offline' ? 'Offline' : 'Could not load'}
      />
    );
  }

  if (query.data === undefined || empty?.(query.data) === true) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  return <>{children(query.data)}</>;
}

function moneyTextStyle(extra?: TextStyle): TextStyle[] {
  return [styles.tabular, extra ?? {}];
}

function AmountQuickButton({
  amount,
  badge,
  bonusLabel,
  onSelect,
  selected,
}: {
  amount: number;
  badge?: string;
  bonusLabel?: string;
  onSelect: (amount: number) => void;
  selected: boolean;
}) {
  return (
    <GlassSurface
      borderColor={selected ? ui.color.status.info : undefined}
      contentStyle={styles.glassPressableContent}
      overlayColor={selected ? 'rgba(62,111,217,0.18)' : undefined}
      radius={ui.radii.xl}
      shadow="soft"
      style={styles.quickAmount}
      variant="standard"
    >
      <Pressable
        accessibilityLabel={`Add ${formatRupees(createInrMoney(amount * 100))}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => {
          onSelect(amount);
        }}
        style={({ pressed }) => [
          styles.quickAmountPressable,
          pressed ? styles.pressed : null,
        ]}
        testID={`quick-amount-${String(amount)}`}
      >
        <View
          style={[
            styles.quickAmountContent,
            badge === undefined ? null : styles.quickAmountContentWithBadge,
          ]}
        >
          <Text
            style={[
              styles.quickAmountText,
              selected ? styles.quickAmountTextSelected : null,
              ...moneyTextStyle(),
            ]}
          >
            {formatRupees(createInrMoney(amount * 100))}
          </Text>
          {bonusLabel === undefined ? null : (
            <Text style={styles.quickAmountBonus}>{bonusLabel}</Text>
          )}
        </View>
        {badge === undefined ? null : (
          <View style={styles.quickAmountBadge}>
            <Text style={styles.quickAmountBadgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
    </GlassSurface>
  );
}

const rechargePacks = quickAmountRupees.map((amount) => {
  const extraPercent =
    amount >= 15_000
      ? 45
      : amount >= 1_900
        ? 40
        : amount >= 200
          ? 35
          : amount >= 140
            ? 20
            : amount >= 100
              ? 15
              : amount >= 50
                ? 6
                : 0;

  return {
    amount,
    badge:
      amount === 140 ? 'Value Pack' : amount === 300 ? 'Popular' : undefined,
    extraPercent,
  };
});

const packCreditPaise = (amountRupees: number) => {
  const pack = rechargePacks.find((item) => item.amount === amountRupees);
  const extraPercent = pack?.extraPercent ?? 0;

  return Math.round(amountRupees * 100 * (1 + extraPercent / 100));
};

const taxPaiseForRecharge = (amountRupees: number) =>
  Math.round(amountRupees * 100 * 0.28);

const formatDecimalRupees = (amountPaise: number) =>
  new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(amountPaise / 100);

type IconComponent = typeof Smartphone;

type CouponOption = {
  description: string;
  discountPaise: number;
  id: string;
  label: string;
};

const couponOptions = [
  {
    description: 'Instant discount on this recharge.',
    discountPaise: 0,
    id: 'none',
    label: 'No coupon',
  },
  {
    description: 'Save Rs 10 on UPI and QR payments.',
    discountPaise: 1_000,
    id: 'UPIFAST',
    label: 'UPIFAST',
  },
  {
    description: 'Save Rs 20 on cards, wallets, or net banking.',
    discountPaise: 2_000,
    id: 'PAY20',
    label: 'PAY20',
  },
  {
    description: 'Welcome offer up to Rs 30.',
    discountPaise: 3_000,
    id: 'WELCOME30',
    label: 'WELCOME30',
  },
] as const satisfies readonly CouponOption[];

const getCouponDiscountPaise = (
  couponId: string,
  payableBeforeDiscountPaise: number,
) => {
  const coupon = couponOptions.find((item) => item.id === couponId);

  if (coupon === undefined || coupon.id === 'none') {
    return 0;
  }

  return Math.min(
    coupon.discountPaise,
    Math.max(0, payableBeforeDiscountPaise),
  );
};

const upiApps = [
  { label: 'PhonePe', method: 'upi-phonepe' },
  { label: 'GPay', method: 'upi-google-pay' },
  { label: 'Paytm', method: 'upi-paytm' },
  { label: 'BHIM', method: 'upi-bhim' },
  { label: 'CRED', method: 'upi-cred' },
] as const satisfies readonly { label: string; method: PaymentMethod }[];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: 'Credit/Debit Card',
  'net-banking': 'Net Banking',
  'pay-later': 'Pay Later',
  qr: 'QR Scan & Pay',
  upi: 'Any UPI App',
  'upi-bhim': 'BHIM UPI',
  'upi-cred': 'CRED UPI',
  'upi-google-pay': 'Google Pay',
  'upi-paytm': 'Paytm UPI',
  'upi-phonepe': 'PhonePe UPI',
  wallet: 'Wallets',
};

const isUpiMethod = (method: PaymentMethod) => method.startsWith('upi');

const transactionTimestamp = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', ' -');

const walletTransactionTitle = (transaction: Transaction) => {
  if (transaction.type === 'wallet-credit') {
    return `Recharge of ${formatRupees(transaction.amount)}`;
  }

  return transactionTitle(transaction);
};

function WalletRechargeHeader({
  action,
  onAction,
  onBack,
  title,
}: {
  action?: 'help' | 'transactions';
  onAction?: () => void;
  onBack: () => void;
  title: string;
}) {
  return (
    <View style={styles.walletHeaderRow}>
      <View style={styles.walletHeaderTitleRow}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onBack}
          style={({ pressed }) => [
            styles.walletBackButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <ArrowLeft color={ui.color.text.primary} size={26} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.walletHeaderTitle}>
          {title}
        </Text>
      </View>
      {action === undefined ? null : (
        <Pressable
          accessibilityLabel={
            action === 'transactions' ? 'Open transactions' : 'Open help'
          }
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onAction}
          style={({ pressed }) => [
            action === 'transactions'
              ? styles.transactionsPill
              : styles.helpIconButton,
            pressed ? styles.pressed : null,
          ]}
        >
          {action === 'transactions' ? (
            <>
              <ReceiptText color={ui.color.status.info} size={20} />
              <Text style={styles.transactionsPillText}>Transactions</Text>
            </>
          ) : (
            <Headset color={ui.color.text.primary} size={26} />
          )}
        </Pressable>
      )}
    </View>
  );
}

function WalletBalanceStrip({
  balance,
  loading,
}: {
  balance?: Money;
  loading: boolean;
}) {
  return (
    <Card style={styles.walletBalanceStrip} variant="strong">
      <Text style={styles.walletBalanceLabel}>My Balance</Text>
      <Text style={styles.walletBalanceValue}>
        {loading || balance === undefined ? 'Loading' : formatRupees(balance)}
      </Text>
    </Card>
  );
}

function WalletHomeStyleActionButton({
  disabled,
  onPress,
  testID,
  title,
}: {
  disabled: boolean;
  onPress: () => void;
  testID: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.walletHomeActionButton,
        pressed ? styles.pressed : null,
        disabled ? styles.walletHomeActionButtonDisabled : null,
      ]}
      testID={testID}
    >
      <Text style={styles.walletHomeActionText}>{title}</Text>
    </Pressable>
  );
}

function TrustStrip() {
  const items = [
    { Icon: UserCheck, label: 'Verified Experts' },
    { Icon: ShieldCheck, label: '100% Safe' },
    { Icon: Landmark, label: 'Bank Approved' },
  ] as const;

  return (
    <View style={styles.trustStrip}>
      {items.map(({ Icon, label }, index) => (
        <View key={label} style={styles.trustItemWrap}>
          {index === 0 ? null : <View style={styles.trustDivider} />}
          <View style={styles.trustItem}>
            <Icon color={ui.color.text.primary} size={30} strokeWidth={2.1} />
            <Text style={styles.trustLabel}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function WalletTransactionCard({ transaction }: { transaction: Transaction }) {
  const credit =
    transaction.type === 'wallet-credit' ||
    transaction.type === 'referral-credit';

  return (
    <Card style={styles.walletTransactionCard} variant="standard">
      <View style={styles.walletTransactionCopy}>
        <Text numberOfLines={1} style={styles.walletTransactionTitle}>
          {walletTransactionTitle(transaction)}
        </Text>
        <Text numberOfLines={1} style={styles.walletTransactionMeta}>
          {transactionTimestamp(transaction.occurredAtIso)} · Txn ID:{' '}
          {transaction.referenceId.replace(/\D/g, '').slice(-8) ||
            transaction.referenceId}
        </Text>
      </View>
      <Text
        style={[
          styles.walletTransactionAmount,
          credit ? styles.creditText : styles.walletDebitText,
        ]}
      >
        {formatSignedTransactionAmount(transaction)}
      </Text>
    </Card>
  );
}

function TransactionsView({
  onBack,
  onSupport,
  transactions,
}: {
  onBack: () => void;
  onSupport: () => void;
  transactions: Transaction[] | undefined;
}) {
  return (
    <>
      <WalletRechargeHeader
        action="help"
        onAction={onSupport}
        onBack={onBack}
        title="Transactions"
      />
      {transactions === undefined ? (
        <Card variant="standard">
          <Skeleton lines={6} />
        </Card>
      ) : transactions.length === 0 ? (
        <EmptyState
          message="Recharge and call ledger entries will appear here."
          title="No transactions yet"
        />
      ) : (
        <View style={styles.walletTransactionStack}>
          {transactions.slice(0, 8).map((transaction) => (
            <WalletTransactionCard
              key={transaction.id}
              transaction={transaction}
            />
          ))}
        </View>
      )}
    </>
  );
}

function PaymentMethodOption({
  Icon,
  label,
  onPress,
  selected = false,
  subtitle,
}: {
  Icon: IconComponent;
  label: string;
  onPress: () => void;
  selected?: boolean;
  subtitle?: string;
}) {
  return (
    <GlassSurface
      borderColor={selected ? ui.color.brand.primary : undefined}
      contentStyle={styles.glassPressableContent}
      overlayColor={selected ? 'rgba(201,54,116,0.18)' : undefined}
      radius={ui.radii.xl}
      shadow="soft"
      style={styles.paymentMethodRow}
      variant="standard"
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.paymentMethodPressable,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.paymentMethodRowContent}>
          <Icon
            color={selected ? ui.color.brand.primary : ui.color.status.info}
            size={28}
            strokeWidth={2.2}
          />
          <View style={styles.paymentMethodCopy}>
            <Text style={styles.paymentMethodLabel}>{label}</Text>
            {subtitle === undefined ? null : (
              <Text style={styles.paymentMethodSubtitle}>{subtitle}</Text>
            )}
          </View>
          {selected ? (
            <CheckCircle2 color={ui.color.brand.primary} size={26} />
          ) : (
            <ChevronRight color={ui.color.text.primary} size={26} />
          )}
        </View>
      </Pressable>
    </GlassSurface>
  );
}

function UpiAppButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`Pay with ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.upiAppItem,
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        style={[styles.upiAppIcon, selected ? styles.upiAppIconSelected : null]}
      >
        <Text style={styles.upiAppInitial}>{label.slice(0, 1)}</Text>
        {selected ? (
          <View style={styles.upiAppCheck}>
            <CheckCircle2 color={ui.color.status.info} size={17} />
          </View>
        ) : null}
      </View>
      <Text style={styles.upiAppLabel}>{label}</Text>
    </Pressable>
  );
}

function CouponModal({
  onApply,
  onDismiss,
  payableBeforeDiscountPaise,
  selectedCouponId,
  visible,
}: {
  onApply: (couponId: string) => void;
  onDismiss: () => void;
  payableBeforeDiscountPaise: number;
  selectedCouponId: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.couponOverlay}>
        <Pressable
          accessibilityLabel="Close coupons"
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <GlassSurface
          radius={ui.radii.xxl}
          shadow="floating"
          style={styles.couponSheet}
          variant="modal"
        >
          <View style={styles.couponHandle} />
          <Text style={styles.couponTitle}>Available Coupons</Text>
          <View style={styles.couponStack}>
            {couponOptions.map((coupon) => {
              const discountPaise = getCouponDiscountPaise(
                coupon.id,
                payableBeforeDiscountPaise,
              );
              const selected = selectedCouponId === coupon.id;

              return (
                <Pressable
                  accessibilityLabel={`Apply ${coupon.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={coupon.id}
                  onPress={() => {
                    onApply(coupon.id);
                  }}
                  style={({ pressed }) => [
                    styles.couponCard,
                    selected ? styles.couponCardSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.couponCodeWrap}>
                    <Tag color={ui.color.brand.primary} size={20} />
                    <Text style={styles.couponCode}>{coupon.label}</Text>
                  </View>
                  <Text style={styles.couponDescription}>
                    {coupon.description}
                  </Text>
                  <View style={styles.couponFooter}>
                    <Text style={styles.couponSaving}>
                      {discountPaise === 0
                        ? 'No discount'
                        : `Save ${formatRupees(createInrMoney(discountPaise))}`}
                    </Text>
                    <Text style={styles.couponApply}>
                      {selected ? 'Applied' : 'Apply'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function PaymentMethodView({
  amountRupees,
  cashbackPaise,
  couponDiscountPaise,
  createOrderPending,
  method,
  onBack,
  onMethodChange,
  onOpenCoupons,
  payablePaise,
  payableBeforeDiscountPaise,
  selectedCouponId,
}: {
  amountRupees: number;
  cashbackPaise: number;
  couponDiscountPaise: number;
  createOrderPending: boolean;
  method: PaymentMethod;
  onBack: () => void;
  onMethodChange: (method: PaymentMethod) => void;
  onOpenCoupons: () => void;
  payablePaise: number;
  payableBeforeDiscountPaise: number;
  selectedCouponId: string;
}) {
  const taxPaise = taxPaiseForRecharge(amountRupees);
  const rechargePaise = amountRupees * 100;
  const selectedCoupon = couponOptions.find(
    (coupon) => coupon.id === selectedCouponId,
  );

  return (
    <>
      <WalletRechargeHeader onBack={onBack} title="Select Payment Method" />
      <Card style={styles.paymentBreakdownCard} variant="strong">
        <View style={styles.breakdownLine}>
          <Text style={styles.breakdownText}>Recharge Amount</Text>
          <Text style={styles.breakdownText}>
            {formatRupees(createInrMoney(rechargePaise))}
          </Text>
        </View>
        <View style={styles.breakdownLine}>
          <Text style={[styles.breakdownText, styles.dottedText]}>
            Taxes and other charges
          </Text>
          <Text style={styles.breakdownText}>
            {formatDecimalRupees(taxPaise)}
          </Text>
        </View>
        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownLine}>
          <Text style={styles.payableLabel}>Payable Amount</Text>
          <Text style={styles.payableValue}>
            {formatDecimalRupees(payablePaise)}
          </Text>
        </View>
      </Card>

      <PaymentMethodOption
        Icon={Tag}
        label={
          couponDiscountPaise > 0
            ? `${selectedCoupon?.label ?? 'Coupon'} applied`
            : 'View All Coupons'
        }
        onPress={onOpenCoupons}
        selected={couponDiscountPaise > 0}
        subtitle={
          couponDiscountPaise > 0
            ? `Saved ${formatRupees(createInrMoney(couponDiscountPaise))}`
            : 'Apply a coupon before payment.'
        }
      />

      <Card style={styles.cashbackNotice} variant="standard">
        <CheckCircle2 color={ui.color.status.success} size={28} />
        <Text style={styles.cashbackNoticeText}>
          You will get {formatRupees(createInrMoney(cashbackPaise))} in this
          recharge
        </Text>
      </Card>

      <Card style={styles.upiCard} variant="standard">
        <View style={styles.upiHeader}>
          <View style={styles.upiLogoMark}>
            <Text style={styles.upiLogoText}>UPI</Text>
          </View>
          <Text style={styles.upiTitle}>Pay by any UPI app</Text>
          <View style={styles.fastestTag}>
            <Zap color={ui.color.status.info} size={16} />
            <Text style={styles.fastestText}>Fastest</Text>
          </View>
        </View>
        <Text style={styles.upiPreference}>Preferred by 95% Users</Text>
        <View style={styles.upiAppsRow}>
          {upiApps.map((app) => (
            <UpiAppButton
              key={app.method}
              label={app.label}
              onPress={() => {
                onMethodChange(app.method);
              }}
              selected={method === app.method}
            />
          ))}
        </View>
      </Card>

      <PaymentMethodOption
        Icon={QrCode}
        label="QR to Scan & Pay"
        onPress={() => {
          onMethodChange('qr');
        }}
        selected={method === 'qr'}
        subtitle="Scan using any UPI or banking app."
      />
      <PaymentMethodOption
        Icon={CreditCard}
        label="Pay using Credit/Debit Card"
        onPress={() => {
          onMethodChange('card');
        }}
        selected={method === 'card'}
        subtitle="Visa, Mastercard, RuPay, credit and debit cards."
      />
      <PaymentMethodOption
        Icon={Landmark}
        label="Net Banking"
        onPress={() => {
          onMethodChange('net-banking');
        }}
        selected={method === 'net-banking'}
        subtitle="Choose your bank and complete secure login."
      />
      <PaymentMethodOption
        Icon={Wallet}
        label="Wallets"
        onPress={() => {
          onMethodChange('wallet');
        }}
        selected={method === 'wallet'}
        subtitle="Paytm Wallet, Amazon Pay, Mobikwik, and other wallets."
      />
      <PaymentMethodOption
        Icon={IndianRupee}
        label="Pay Later"
        onPress={() => {
          onMethodChange('pay-later');
        }}
        selected={method === 'pay-later'}
        subtitle="LazyPay, Simpl, ICICI PayLater, and provider options."
      />
      <TrustStrip />

      {couponDiscountPaise > 0 ? (
        <Text style={styles.paymentMethodSubtitle}>
          Coupon reduced payable amount from{' '}
          {formatDecimalRupees(payableBeforeDiscountPaise)} to{' '}
          {formatDecimalRupees(payablePaise)}.
        </Text>
      ) : null}

      {createOrderPending ? (
        <Text style={styles.paymentMethodSubtitle}>
          Preparing secure checkout...
        </Text>
      ) : null}
    </>
  );
}

function CashbackModal({
  cashbackPaise,
  onDismiss,
  visible,
}: {
  cashbackPaise: number;
  onDismiss: () => void;
  visible: boolean;
}) {
  const confetti = [
    ['#b8326a', 20, 42, 28],
    ['#f06f5f', 220, 70, -24],
    ['#3867d6', 50, 156, 12],
    ['#22a06b', 238, 172, -8],
    ['#9a5b08', 190, 28, 8],
    ['#b8326a', 258, 112, -18],
  ] as const;
  const [entrance] = useState(() => new Animated.Value(0));
  const [sparkle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      entrance.setValue(0);
      sparkle.setValue(0);
      return;
    }

    entrance.setValue(0);
    sparkle.setValue(0);
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(entrance, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(entrance, {
          damping: 7,
          mass: 0.8,
          stiffness: 160,
          toValue: 1.04,
          useNativeDriver: true,
        }),
        Animated.spring(entrance, {
          damping: 9,
          mass: 0.7,
          stiffness: 180,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkle, {
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle, {
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [entrance, sparkle, visible]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.cashbackOverlay}>
        <Animated.View
          style={[
            styles.cashbackModalMotion,
            {
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
                {
                  scale: entrance.interpolate({
                    inputRange: [0, 0.72, 1],
                    outputRange: [0.76, 1.08, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <GlassSurface
            shadow="modal"
            style={styles.cashbackModalCard}
            variant="modal"
          >
            <View style={styles.cashbackAnimationArea}>
              {confetti.map(([color, left, top, rotate], index) => (
                <Animated.View
                  key={`${color}-${String(index)}`}
                  style={[
                    styles.confettiPiece,
                    {
                      backgroundColor: color,
                      left,
                      top,
                      opacity: entrance,
                      transform: [
                        {
                          translateY: entrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [28 + index * 4, -20 - index * 8],
                          }),
                        },
                        {
                          rotate: sparkle.interpolate({
                            inputRange: [0, 1],
                            outputRange: [
                              `${String(rotate)}deg`,
                              `${String(rotate + 110)}deg`,
                            ],
                          }),
                        },
                        {
                          scale: entrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.4, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
              <Animated.View
                style={[
                  styles.cashbackMedal,
                  {
                    transform: [
                      {
                        rotate: sparkle.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['-4deg', '4deg'],
                        }),
                      },
                      {
                        scale: sparkle.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <SparkleBurst />
                <Text style={styles.cashbackModalExtra}>Unlocked Extra</Text>
                <Text style={styles.cashbackModalAmount}>
                  {formatRupees(createInrMoney(cashbackPaise))}
                </Text>
              </Animated.View>
            </View>
            <Text style={styles.cashbackModalBody}>Cashback applied!</Text>
            <Text style={styles.cashbackModalSubcopy}>
              Your recharge pack now carries bonus value.
            </Text>
            <Button
              onPress={onDismiss}
              style={styles.cashbackModalButton}
              title="Continue"
            />
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SparkleBurst() {
  return (
    <View style={styles.sparkleBurst} pointerEvents="none">
      {Array.from({ length: 10 }).map((_, index) => (
        <View
          key={String(index)}
          style={[
            styles.sparkleDot,
            {
              transform: [
                { rotate: `${String(index * 36)}deg` },
                { translateY: -54 },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AddMoneyScreen() {
  const params = useLocalSearchParams<{
    amountRupees?: string;
    callGraceEndsAtIso?: string;
    discoveryAutoConnect?: string;
    discoveryHostId?: string;
    discoveryHostLanguage?: string;
    discoveryHostName?: string;
    discoveryHostRank?: string;
    discoveryInitialState?: string;
    initialScreen?: string;
    origin?: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const wallet = useWalletQuery();
  const transactions = useTransactionsQuery();
  const [selectedAmount, setSelectedAmount] = useState(
    Number(params.amountRupees ?? '140'),
  );
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [screen, setScreen] = useState<'payment' | 'transactions' | 'wallet'>(
    params.initialScreen === 'payment' ? 'payment' : 'wallet',
  );
  const [couponVisible, setCouponVisible] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState('none');
  const [cashbackVisible, setCashbackVisible] = useState(false);
  const [graceNowMs, setGraceNowMs] = useState(() => Date.now());
  const callGraceRemainingMs =
    params.callGraceEndsAtIso === undefined
      ? null
      : Math.max(0, new Date(params.callGraceEndsAtIso).getTime() - graceNowMs);
  const amountValidation = parseRupeeAmount(String(selectedAmount));
  const cashbackPaise = packCreditPaise(selectedAmount);
  const taxPaise = taxPaiseForRecharge(selectedAmount);
  const payableBeforeDiscountPaise = selectedAmount * 100 + taxPaise;
  const couponDiscountPaise = getCouponDiscountPaise(
    selectedCouponId,
    payableBeforeDiscountPaise,
  );
  const payablePaise = Math.max(
    0,
    payableBeforeDiscountPaise - couponDiscountPaise,
  );
  const createOrder = useMutation({
    mutationFn: (money: Money) =>
      financePaymentAdapter.createOrder({
        amount: money,
        customerId: mobileDataIds.customerId,
        method,
      }),
    onSuccess: async (payment) => {
      await invalidateDomainQueries(queryClient, 'payment');
      router.replace({
        params: {
          amountPaise: String(payment.amount.amountPaise),
          ...pickPaymentCallReturnParams(params),
          method,
          origin: params.origin ?? 'add-money',
          paymentId: payment.id,
          returnTo: params.returnTo ?? appRoutes.customerAddMoney.path,
        },
        pathname: appRoutes.customerPaymentStates.path,
      });
    },
  });

  useEffect(() => {
    if (params.callGraceEndsAtIso === undefined) {
      return;
    }

    const intervalId = setInterval(() => {
      setGraceNowMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [params.callGraceEndsAtIso]);

  const submitDisabled =
    amountValidation.kind === 'invalid' || createOrder.isPending;
  const startPayment = () => {
    if (amountValidation.kind === 'valid') {
      createOrder.mutate(createInrMoney(payablePaise));
    }
  };

  return (
    <KeyboardScreen
      bottomAction={
        screen === 'transactions' ? undefined : (
          <View style={styles.walletBottomAction}>
            {screen === 'wallet' ? (
              <Text style={styles.walletBottomCashback}>
                Get{' '}
                {formatRupees(
                  createInrMoney(
                    Math.max(0, cashbackPaise - selectedAmount * 100),
                  ),
                )}{' '}
                Extra cashback on this pack
              </Text>
            ) : null}
            {screen === 'wallet' ? (
              <WalletHomeStyleActionButton
                disabled={submitDisabled}
                onPress={() => {
                  setScreen('payment');
                  setCashbackVisible(true);
                }}
                testID="start-payment"
                title="Add Balance"
              />
            ) : (
              <Button
                disabled={submitDisabled}
                loading={createOrder.isPending}
                onPress={startPayment}
                testID="start-payment"
                title={`Pay ${formatDecimalRupees(payablePaise)}`}
              />
            )}
          </View>
        )
      }
      contentStyle={styles.walletScreenContent}
      testID="add-money-screen"
    >
      {screen === 'transactions' ? (
        <TransactionsView
          onBack={() => {
            setScreen('wallet');
          }}
          onSupport={() => {
            router.push(
              routeWithReturnTo(
                appRoutes.customerSupport.path,
                customerAddMoneyTransactionsPath,
              ),
            );
          }}
          transactions={transactions.data}
        />
      ) : screen === 'payment' ? (
        <PaymentMethodView
          amountRupees={selectedAmount}
          cashbackPaise={cashbackPaise}
          couponDiscountPaise={couponDiscountPaise}
          createOrderPending={createOrder.isPending}
          method={method}
          onBack={() => {
            setScreen('wallet');
          }}
          onMethodChange={setMethod}
          onOpenCoupons={() => {
            setCouponVisible(true);
          }}
          payableBeforeDiscountPaise={payableBeforeDiscountPaise}
          payablePaise={payablePaise}
          selectedCouponId={selectedCouponId}
        />
      ) : (
        <>
          <WalletRechargeHeader
            action="transactions"
            onAction={() => {
              setScreen('transactions');
            }}
            onBack={() => {
              router.replace(params.returnTo ?? appRoutes.customerHome.path);
            }}
            title="Wallet"
          />
          <WalletBalanceStrip
            loading={wallet.isPending}
            {...(wallet.data?.balance === undefined
              ? {}
              : { balance: wallet.data.balance })}
          />
          {wallet.isError ? (
            <Banner
              message={normalizeApiError(wallet.error).message}
              title="Balance unavailable"
              tone="warning"
            />
          ) : null}
          {params.origin === 'call' && callGraceRemainingMs !== null ? (
            <Banner
              message={
                callGraceRemainingMs > 0
                  ? `This call can stay active for another ${formatCallSafetyDuration(
                      callGraceRemainingMs,
                    )} while payment verification continues.`
                  : 'The grace window has elapsed. Payment can still continue, but the active call may already have ended.'
              }
              title="Call top-up"
              tone={callGraceRemainingMs > 0 ? 'warning' : 'info'}
            />
          ) : null}
          <Text style={styles.addBalanceTitle}>Add Balance to Wallet</Text>
          <View style={styles.rechargeGrid}>
            {rechargePacks.map((pack) => (
              <AmountQuickButton
                amount={pack.amount}
                {...(pack.badge === undefined ? {} : { badge: pack.badge })}
                {...(pack.extraPercent === 0
                  ? {}
                  : { bonusLabel: `+${String(pack.extraPercent)}% Extra` })}
                key={pack.amount}
                onSelect={setSelectedAmount}
                selected={selectedAmount === pack.amount}
              />
            ))}
          </View>
          <TrustStrip />
          <View style={styles.walletTransactionsPreview}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewTitle}>Recent transactions</Text>
              <Pressable
                accessibilityLabel="View all transactions"
                accessibilityRole="button"
                onPress={() => {
                  setScreen('transactions');
                }}
                style={({ pressed }) => [
                  styles.previewLink,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.previewLinkText}>View all</Text>
              </Pressable>
            </View>
            {transactions.isPending ? (
              <Skeleton lines={4} />
            ) : transactions.isError ? (
              <Banner
                message={normalizeApiError(transactions.error).message}
                title="Transactions unavailable"
                tone="warning"
              />
            ) : (
              <View style={styles.walletTransactionStack}>
                {transactions.data.slice(0, 4).map((transaction) => (
                  <WalletTransactionCard
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
              </View>
            )}
          </View>
        </>
      )}
      {createOrder.isError ? (
        <Banner
          message={normalizeApiError(createOrder.error).message}
          title="Could not start payment"
          tone="error"
        />
      ) : null}
      <CashbackModal
        cashbackPaise={Math.max(0, cashbackPaise - selectedAmount * 100)}
        onDismiss={() => {
          setCashbackVisible(false);
        }}
        visible={cashbackVisible}
      />
      <CouponModal
        onApply={(couponId) => {
          setSelectedCouponId(couponId);
          setCouponVisible(false);
        }}
        onDismiss={() => {
          setCouponVisible(false);
        }}
        payableBeforeDiscountPaise={payableBeforeDiscountPaise}
        selectedCouponId={selectedCouponId}
        visible={couponVisible}
      />
    </KeyboardScreen>
  );
}

type PaymentPhase =
  | { kind: 'processing' }
  | { kind: 'verification-pending' }
  | { kind: PaymentTerminalKind; payment?: Payment };

const resultCopy = {
  cancelled: {
    body: 'No money was moved. You can retry with the same amount or return to the previous context.',
    title: 'Payment cancelled',
  },
  failure: {
    body: 'The mock verification result failed. The wallet balance was not changed.',
    title: 'Payment failed',
  },
  pending: {
    body: 'Verification is still pending. The wallet will update only after a verified success.',
    title: 'Verification pending',
  },
  success: {
    body: 'The verified mock result was consumed and the wallet ledger was refreshed.',
    title: 'Payment successful',
  },
  timeout: {
    body: 'Checkout timed out before verification. No wallet credit was applied.',
    title: 'Payment timed out',
  },
} as const satisfies Record<
  PaymentTerminalKind,
  { body: string; title: string }
>;

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  const Icon =
    isUpiMethod(method) || method === 'qr'
      ? Smartphone
      : method === 'card'
        ? CreditCard
        : method === 'wallet'
          ? Wallet
          : method === 'pay-later'
            ? IndianRupee
            : Landmark;

  return <Icon color={ui.color.brand.primary} size={22} />;
}

export function PaymentProcessingScreen() {
  const params = useLocalSearchParams<{
    amountPaise?: string;
    discoveryAutoConnect?: string;
    discoveryHostId?: string;
    discoveryHostLanguage?: string;
    discoveryHostName?: string;
    discoveryHostRank?: string;
    discoveryInitialState?: string;
    method?: string;
    origin?: string;
    paymentId?: string;
    returnTo?: string;
  }>();
  const parsedParams = useMemo(() => parsePaymentRouteParams(params), [params]);
  const queryClient = useQueryClient();
  const router = useRouter();
  const haptics = useHaptics();
  const [phase, setPhase] = useState<PaymentPhase>({ kind: 'processing' });
  const handledCallbacks = useRef<Set<string>>(new Set<string>());
  const returnToOrigin = () => {
    if (parsedParams.returnTo === appRoutes.callOutgoing.path) {
      router.replace({
        params: pickPaymentCallReturnParams(parsedParams),
        pathname: appRoutes.callOutgoing.path,
      });
      return;
    }

    if (
      parsedParams.returnTo === appRoutes.callVoice.path ||
      parsedParams.returnTo === appRoutes.callVideo.path ||
      parsedParams.returnTo === appRoutes.callReconnecting.path
    ) {
      router.replace(parsedParams.returnTo);
      return;
    }

    router.replace(appRoutes.customerAddMoney.path);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();

      if (parsedParams.paymentId.length === 0) {
        setPhase({ kind: 'failure' });
        return;
      }

      try {
        const checkout = await financePaymentAdapter.openCheckout({
          amount: createInrMoney(parsedParams.amountPaise),
          method: parsedParams.method,
          paymentId: parsedParams.paymentId,
          providerOrderId: parsedParams.paymentId,
        });

        if (cancelled) {
          return;
        }

        if (checkout.kind === 'cancelled') {
          haptics.paymentResult('failure');
          setPhase({ kind: 'cancelled' });
          return;
        }

        if (checkout.kind === 'timeout') {
          haptics.paymentResult('pending');
          setPhase({ kind: 'timeout' });
          return;
        }

        setPhase({ kind: 'verification-pending' });

        for (const callback of checkout.callbacks) {
          if (handledCallbacks.current.has(callback.callbackId)) {
            continue;
          }

          handledCallbacks.current.add(callback.callbackId);
          await handleCheckoutCallback({
            callback,
            cancelled: () => cancelled,
            haptics,
            queryClient,
            setPhase,
          });
        }
      } catch {
        if (!cancelled) {
          haptics.paymentResult('failure');
          setPhase({
            kind: 'failure',
            payment: {
              amount: createInrMoney(parsedParams.amountPaise),
              customerId: mobileDataIds.customerId,
              id: parsedParams.paymentId || 'payment_unknown',
              providerOrderId: parsedParams.paymentId || 'order_unknown',
              status: 'failure',
            },
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [haptics, parsedParams, queryClient]);

  const amount = createInrMoney(parsedParams.amountPaise);

  if (phase.kind === 'processing' || phase.kind === 'verification-pending') {
    return (
      <ScrollScreen testID="payment-processing-screen">
        <BackHeader
          onPress={() => {
            returnToOrigin();
          }}
          title="Payment"
        />
        <Card style={styles.processingCard}>
          <View style={styles.processingIconWrap}>
            {phase.kind === 'processing' ? (
              <TimerReset color={ui.color.brand.primary} size={34} />
            ) : (
              <RefreshCw color={ui.color.status.warning} size={34} />
            )}
          </View>
          <Text accessibilityRole="header" style={styles.resultTitle}>
            {phase.kind === 'processing'
              ? 'Opening secure checkout'
              : 'Verifying payment'}
          </Text>
          <Text style={styles.body}>
            {phase.kind === 'processing'
              ? 'The mock adapter is handing off to the selected payment method. You can leave this route; stale callbacks are ignored.'
              : 'Checkout returned. Wallet credit waits for the mocked verified result.'}
          </Text>
          <View style={styles.methodPill}>
            <PaymentMethodIcon method={parsedParams.method} />
            <Text style={styles.methodPillText}>
              {formatRupees(amount)} via{' '}
              {paymentMethodLabels[parsedParams.method]}
            </Text>
          </View>
        </Card>
      </ScrollScreen>
    );
  }

  const copy = resultCopy[phase.kind];
  const success = phase.kind === 'success';
  const pending = phase.kind === 'pending' || phase.kind === 'timeout';

  return (
    <ScrollScreen testID={`payment-${phase.kind}-screen`}>
      <BackHeader
        onPress={() => {
          returnToOrigin();
        }}
        title="Payment result"
      />
      <Card style={styles.resultCard}>
        <LottieIllustration
          assetId="connectoPulse"
          fallback={
            success ? (
              <CheckCircle2 color={ui.color.status.success} size={48} />
            ) : pending ? (
              <AlertCircle color={ui.color.status.warning} size={48} />
            ) : (
              <XCircle color={ui.color.status.error} size={48} />
            )
          }
          fallbackLabel={copy.title}
          loop={pending}
          playing
          style={styles.resultLottie}
        />
        <Text accessibilityRole="header" style={styles.resultTitle}>
          {copy.title}
        </Text>
        <Text style={styles.body}>{copy.body}</Text>
        <Text style={[styles.resultAmount, ...moneyTextStyle()]}>
          {formatRupees(phase.payment?.amount ?? amount)}
        </Text>
        <StatusBadge label={phase.kind} tone={statusTone(phase.kind)} />
      </Card>

      <View style={styles.actionRow}>
        {phase.kind === 'success' ? (
          <Button
            icon={Wallet}
            onPress={() => {
              if (parsedParams.origin === 'call') {
                returnToOrigin();
                return;
              }

              router.replace(appRoutes.customerAddMoney.path);
            }}
            testID="payment-result-primary-action"
            title={
              parsedParams.origin === 'call' ? 'Return to Call' : 'Add Money'
            }
          />
        ) : (
          <Button
            icon={RefreshCw}
            onPress={() => {
              router.replace({
                params: {
                  ...pickPaymentCallReturnParams(parsedParams),
                  origin: parsedParams.origin,
                  returnTo: parsedParams.returnTo,
                },
                pathname: appRoutes.customerAddMoney.path,
              });
            }}
            testID="payment-result-primary-action"
            title="Try Again"
          />
        )}
        <Button
          icon={ArrowLeft}
          onPress={() => {
            returnToOrigin();
          }}
          testID="payment-result-secondary-action"
          title={
            parsedParams.origin === 'call'
              ? 'Return to Call'
              : 'Return to Add Money'
          }
          variant="secondary"
        />
      </View>
    </ScrollScreen>
  );
}

async function handleCheckoutCallback(input: {
  callback: CheckoutCallback;
  cancelled: () => boolean;
  haptics: ReturnType<typeof useHaptics>;
  queryClient: ReturnType<typeof useQueryClient>;
  setPhase: (phase: PaymentPhase) => void;
}) {
  const result = await pollVerifiedPayment({
    adapter: financePaymentAdapter,
    delayMs: 650,
    isCancelled: input.cancelled,
    maxAttempts: 4,
    paymentId: input.callback.paymentId,
  });

  if (input.cancelled() || result.kind === 'cancelled') {
    return;
  }

  await invalidateDomainQueries(input.queryClient, 'payment');
  const terminalKind = terminalKindForPayment(result.payment);

  if (terminalKind === 'success') {
    input.haptics.paymentResult('success');
  } else if (terminalKind === 'pending') {
    input.haptics.paymentResult('pending');
  } else {
    input.haptics.paymentResult('failure');
  }

  input.setPhase({
    kind: terminalKind,
    payment: result.payment,
  });
}

export function TransactionDetailScreen() {
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
    transactionId?: string | string[];
  }>();
  const transactionId = detailIdFromParams(params, 'transactionId');
  const returnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const router = useRouter();
  const transactions = useTransactionsQuery();
  const calls = useCustomerCallsQuery();

  return (
    <ScrollScreen testID="transaction-detail-screen">
      <BackHeader
        onPress={() => {
          router.replace(returnTo ?? customerAddMoneyTransactionsPath);
        }}
        title="Transaction"
      />
      <QueryState
        emptyMessage="The selected ledger row is no longer available."
        emptyTitle="Transaction not found"
        query={transactions}
      >
        {(items) => {
          const transaction = items.find((item) => item.id === transactionId);

          if (transaction === undefined) {
            return (
              <EmptyState
                message="The selected ledger row is no longer available."
                title="Transaction not found"
              />
            );
          }

          const linkedCall = calls.data?.find(
            (call) => call.id === transaction.linkedCallId,
          );

          return (
            <View style={styles.stack}>
              <Card style={styles.stack}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.resultTitle}>
                    {transactionTitle(transaction)}
                  </Text>
                  <StatusBadge
                    label={transaction.status}
                    tone={statusTone(transaction.status)}
                  />
                </View>
                <Text style={[styles.detailAmount, ...moneyTextStyle()]}>
                  {formatSignedTransactionAmount(transaction)}
                </Text>
                <DetailLine label="Reference" value={transaction.referenceId} />
                <DetailLine
                  label="Timestamp"
                  value={transaction.occurredAtIso}
                />
                <DetailLine label="Type" value={transaction.type} />
                <DetailLine
                  label="Linked call"
                  value={transaction.linkedCallId ?? 'Not linked'}
                />
              </Card>
              {linkedCall === undefined ? null : (
                <Card style={styles.stack}>
                  <Text style={styles.cardTitle}>Linked call</Text>
                  <DetailLine
                    label="Host"
                    value={linkedCall.host.displayName}
                  />
                  <DetailLine
                    label="Duration"
                    value={`${String(linkedCall.timerSnapshot.billableSeconds)} seconds`}
                  />
                  <DetailLine label="End reason" value={linkedCall.endReason} />
                </Card>
              )}
              <Button
                icon={Headset}
                onPress={() => {
                  router.push(
                    routeWithReturnTo(
                      appRoutes.customerSupport.path,
                      transactionDetailReturnPath(transaction.id),
                    ),
                  );
                }}
                title="Contact Support"
                variant="secondary"
              />
            </View>
          );
        }}
      </QueryState>
    </ScrollScreen>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  addBalanceTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 23,
    lineHeight: 29,
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  breakdownDivider: {
    backgroundColor: ui.glass.border,
    height: 1,
    marginVertical: ui.spacing[3],
  },
  breakdownLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
    justifyContent: 'space-between',
  },
  breakdownText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  cashbackModalAmount: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 34,
    lineHeight: 40,
  },
  cashbackModalBody: {
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: 17,
    lineHeight: 23,
  },
  cashbackModalButton: {
    alignSelf: 'stretch',
  },
  cashbackModalCard: {
    alignItems: 'center',
    ...ui.shadow.floating,
    borderRadius: ui.radii.xxl,
    gap: ui.spacing[3],
    marginHorizontal: 0,
    maxWidth: 420,
    paddingHorizontal: ui.spacing[6],
    paddingVertical: ui.spacing[6],
    width: '86%',
  },
  cashbackAnimationArea: {
    alignItems: 'center',
    height: 204,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  cashbackModalExtra: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  cashbackModalMotion: {
    alignItems: 'center',
    width: '100%',
  },
  cashbackMedal: {
    alignItems: 'center',
    backgroundColor: ui.color.status.success,
    borderRadius: ui.radii.full,
    gap: ui.spacing[1],
    minHeight: 124,
    justifyContent: 'center',
    minWidth: 124,
    padding: ui.spacing[4],
  },
  cashbackModalSubcopy: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  cashbackNotice: {
    alignItems: 'center',
    ...ui.shadow.soft,
    backgroundColor: ui.glass.surface,
    borderColor: ui.color.status.success,
    borderRadius: ui.radii.xl,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 84,
    paddingHorizontal: ui.spacing[5],
  },
  cashbackNoticeText: {
    color: ui.color.status.success,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  cashbackOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(36, 22, 29, 0.42)',
    flex: 1,
    justifyContent: 'center',
  },
  confettiPiece: {
    borderRadius: 2,
    height: 22,
    position: 'absolute',
    width: 9,
  },
  couponApply: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  couponCard: {
    backgroundColor: ui.glass.surface,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    gap: ui.spacing[2],
    padding: ui.spacing[4],
  },
  couponCardSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  couponCode: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  couponCodeWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
  couponDescription: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  couponFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  couponHandle: {
    alignSelf: 'center',
    backgroundColor: ui.glass.borderStrong,
    borderRadius: ui.radii.full,
    height: 5,
    width: 56,
  },
  couponOverlay: {
    backgroundColor: 'rgba(36, 22, 29, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  couponSaving: {
    color: ui.color.status.success,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  couponSheet: {
    borderTopLeftRadius: ui.radii.xxl,
    borderTopRightRadius: ui.radii.xxl,
    gap: ui.spacing[4],
    padding: ui.spacing[5],
  },
  couponStack: {
    gap: ui.spacing[3],
  },
  couponTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  creditText: {
    color: ui.color.status.success,
  },
  debitText: {
    color: ui.color.status.error,
  },
  dottedText: {
    borderBottomColor: ui.color.text.tertiary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dotted',
  },
  detailAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  detailHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  detailLine: {
    borderColor: ui.glass.border,
    borderTopWidth: 1,
    gap: ui.spacing[1],
    paddingTop: ui.spacing[3],
  },
  detailValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  header: {
    gap: ui.spacing[2],
  },
  headerTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  helper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  methodPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[4],
  },
  methodPillText: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  pressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.99 }],
  },
  fastestTag: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[1],
    marginLeft: 'auto',
  },
  fastestText: {
    color: ui.color.status.info,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  helpIconButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  payableLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  payableValue: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  paymentBreakdownCard: {
    borderRadius: ui.radii.xxl,
    gap: ui.spacing[4],
    padding: ui.spacing[7],
  },
  paymentMethodCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  paymentMethodLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  paymentMethodRow: {
    borderRadius: ui.radii.xl,
    minHeight: 86,
    overflow: 'hidden',
    position: 'relative',
  },
  paymentMethodRowContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[4],
    paddingHorizontal: ui.spacing[5],
  },
  paymentMethodRowSelected: {
    backgroundColor: 'rgba(201,54,116,0.18)',
    borderColor: ui.color.brand.primary,
  },
  paymentMethodPressable: {
    flex: 1,
  },
  paymentMethodSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  processingCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
  },
  processingIconWrap: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  quickAmount: {
    borderRadius: ui.radii.xl,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 116,
    overflow: 'hidden',
    position: 'relative',
  },
  quickAmountContent: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ui.spacing[5],
    paddingVertical: ui.spacing[5],
  },
  quickAmountContentWithBadge: {
    paddingTop: ui.spacing[8],
  },
  quickAmountBadge: {
    backgroundColor: ui.color.accent.coral,
    borderRadius: ui.radii.full,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
    position: 'absolute',
    right: ui.spacing[3],
    top: ui.spacing[3],
  },
  quickAmountBadgeText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  quickAmountBonus: {
    color: ui.color.status.success,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    marginTop: ui.spacing[1],
  },
  quickAmountSelected: {
    backgroundColor: 'rgba(62,111,217,0.18)',
    borderColor: ui.color.status.info,
    borderWidth: 2,
  },
  quickAmountPressable: {
    flex: 1,
    minHeight: 116,
    position: 'relative',
  },
  glassPressableContent: {
    padding: 0,
  },
  quickAmountText: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: 20,
    lineHeight: 25,
  },
  quickAmountTextSelected: {
    color: ui.color.status.info,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  previewHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLink: {
    minHeight: ui.minTouch,
    justifyContent: 'center',
  },
  previewLinkText: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  previewTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  rechargeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[4],
  },
  resultAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  resultCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
  },
  resultLottie: {
    height: 112,
    width: 112,
  },
  resultTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  rowTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  stack: {
    gap: ui.spacing[4],
  },
  sparkleBurst: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sparkleDot: {
    backgroundColor: ui.color.text.inverse,
    borderRadius: ui.radii.full,
    height: 8,
    opacity: 0.86,
    position: 'absolute',
    width: 8,
  },
  transactionsPill: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.color.status.info,
    borderRadius: ui.radii.full,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: 52,
    paddingHorizontal: ui.spacing[4],
  },
  transactionsPillText: {
    color: ui.color.status.info,
    fontFamily: ui.font.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  trustDivider: {
    backgroundColor: ui.color.text.tertiary,
    height: 44,
    opacity: 0.44,
    width: 1,
  },
  trustItem: {
    alignItems: 'center',
    flex: 1,
    gap: ui.spacing[2],
  },
  trustItemWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  trustLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  trustStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
    justifyContent: 'space-between',
    paddingVertical: ui.spacing[4],
  },
  upiAppCheck: {
    backgroundColor: ui.glass.surfaceStrong,
    borderRadius: ui.radii.full,
    position: 'absolute',
    right: -2,
    top: -2,
  },
  upiAppIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  upiAppIconSelected: {
    backgroundColor: ui.color.brand.primary,
  },
  upiAppInitial: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  upiAppItem: {
    alignItems: 'center',
    flexBasis: '18%',
    flexGrow: 1,
    gap: ui.spacing[2],
    minHeight: 92,
  },
  upiAppLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textAlign: 'center',
  },
  upiAppsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  upiCard: {
    borderRadius: ui.radii.xxl,
    gap: ui.spacing[5],
    paddingHorizontal: ui.spacing[5],
    paddingVertical: ui.spacing[6],
  },
  upiHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  upiLogoMark: {
    borderColor: ui.color.status.success,
    borderRadius: ui.radii.sm,
    borderWidth: 1.5,
    paddingHorizontal: ui.spacing[2],
    paddingVertical: ui.spacing[1],
  },
  upiLogoText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  upiPreference: {
    color: ui.color.status.success,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  upiTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  walletBackButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  walletBalanceLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  walletBalanceStrip: {
    alignItems: 'center',
    borderRadius: ui.radii.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 96,
    paddingHorizontal: ui.spacing[7],
  },
  walletBalanceValue: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  walletBottomAction: {
    gap: ui.spacing[3],
  },
  walletBottomCashback: {
    color: ui.color.status.success,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  walletHomeActionButton: {
    alignItems: 'center',
    ...ui.shadow.button,
    backgroundColor: 'rgba(62,111,217,0.58)',
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  walletHomeActionButtonDisabled: {
    opacity: ui.opacity.disabled,
  },
  walletHomeActionText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  walletDebitText: {
    color: ui.color.text.primary,
  },
  walletHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  walletHeaderTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  walletHeaderTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: ui.spacing[2],
  },
  walletScreenContent: {
    gap: ui.spacing[5],
  },
  walletTransactionAmount: {
    color: ui.color.text.primary,
    flexShrink: 0,
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  walletTransactionCard: {
    alignItems: 'center',
    borderRadius: ui.radii.xl,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 88,
    paddingHorizontal: ui.spacing[5],
    paddingVertical: ui.spacing[4],
  },
  walletTransactionCopy: {
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 0,
  },
  walletTransactionMeta: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  walletTransactionStack: {
    gap: ui.spacing[3],
  },
  walletTransactionTitle: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  walletTransactionsPreview: {
    gap: ui.spacing[3],
  },
});
