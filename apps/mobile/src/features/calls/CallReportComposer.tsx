import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flag, ShieldAlert } from 'lucide-react-native';

import { normalizeApiError } from '@connecto/domain';

import { Button, RadioCard, TextArea } from '@/components/ui';
import { Banner, InlineError } from '@/components/ui/feedback';
import { Card, Skeleton, StatusBadge } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { useHaptics } from '@/motion/MotionProvider';

import {
  callReportAdapter,
  callReportCategories,
  clearCallReportDraft,
  createCallReportDraft,
  formatCallSafetyDuration,
  formatPaise,
  isCallReportDraftForContext,
  loadCallReportDraft,
  persistCallReportDraft,
  type CallReportCategory,
  type CallReportContext,
  type CallReportDraft,
  updateCallReportDraft,
} from './call-safety';

type CallReportComposerProps = {
  context: CallReportContext;
  onCancel?: () => void;
  onSubmitted?: (result: { endedCall: boolean }) => void;
  showSubmitAndEnd: boolean;
};

type SubmissionMode = 'submit' | 'submit-and-end' | null;

export function CallReportComposer({
  context,
  onCancel,
  onSubmitted,
  showSubmitAndEnd,
}: CallReportComposerProps) {
  const haptics = useHaptics();
  const [draft, setDraft] = useState<CallReportDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(null);
  const draftEvidenceSeedRef = useRef({
    connectedDurationMs: context.connectedDurationMs,
    remainingBalancePaise: context.remainingBalancePaise,
  });

  const loading = submissionMode !== null;
  const draftReady =
    draft ??
    createCallReportDraft({
      ...context,
      connectedDurationMs: context.connectedDurationMs,
      remainingBalancePaise: context.remainingBalancePaise,
    });

  useEffect(() => {
    draftEvidenceSeedRef.current = {
      connectedDurationMs: context.connectedDurationMs,
      remainingBalancePaise: context.remainingBalancePaise,
    };
  }, [context.connectedDurationMs, context.remainingBalancePaise]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setDraftLoading(true);

      try {
        const stored = await loadCallReportDraft();

        if (cancelled) {
          return;
        }

        if (
          stored !== null &&
          isCallReportDraftForContext(stored, {
            callId: context.callId,
            sessionId: context.sessionId,
          })
        ) {
          setDraft(stored);
          return;
        }

        setDraft(
          createCallReportDraft({
            callId: context.callId,
            connectedDurationMs:
              draftEvidenceSeedRef.current.connectedDurationMs,
            customerId: context.customerId,
            hostId: context.hostId,
            hostName: context.hostName,
            mediaMode: context.mediaMode,
            remainingBalancePaise:
              draftEvidenceSeedRef.current.remainingBalancePaise,
            sessionId: context.sessionId,
          }),
        );
      } finally {
        if (!cancelled) {
          setDraftLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    context.callId,
    context.customerId,
    context.hostId,
    context.hostName,
    context.mediaMode,
    context.sessionId,
  ]);

  useEffect(() => {
    if (draft === null) {
      return;
    }

    void persistCallReportDraft(draft);
  }, [draft]);

  const metaBadges = useMemo(
    () => [
      {
        label: context.mediaMode === 'video' ? 'Video active' : 'Voice active',
      },
      {
        label: `Connected ${formatCallSafetyDuration(
          context.connectedDurationMs,
        )}`,
      },
      { label: `Est. balance ${formatPaise(context.remainingBalancePaise)}` },
    ],
    [
      context.connectedDurationMs,
      context.mediaMode,
      context.remainingBalancePaise,
    ],
  );

  const updateCategory = (category: CallReportCategory) => {
    setDraft((current) =>
      current === null
        ? updateCallReportDraft(createCallReportDraft(context), { category })
        : updateCallReportDraft(current, { category }),
    );
    setCategoryError(null);
    setSubmitError(null);
  };

  const updateComments = (comments: string) => {
    setDraft((current) =>
      current === null
        ? updateCallReportDraft(createCallReportDraft(context), { comments })
        : updateCallReportDraft(current, { comments }),
    );
    setSubmitError(null);
  };

  const submit = async (mode: Exclude<SubmissionMode, null>) => {
    const currentDraft = draft ?? createCallReportDraft(context);

    if (currentDraft.category === null) {
      setCategoryError('Choose a report category.');
      haptics.reject();
      return;
    }

    setSubmissionMode(mode);
    setSubmitError(null);

    try {
      const preparedDraft = updateCallReportDraft(currentDraft, {
        comments: currentDraft.comments,
      });

      setDraft(preparedDraft);
      await persistCallReportDraft(preparedDraft);
      await callReportAdapter.submitReport({
        draft: preparedDraft,
        reporterId: context.customerId,
      });
      await clearCallReportDraft();
      setDraft(null);
      haptics.success();
      onSubmitted?.({ endedCall: mode === 'submit-and-end' });
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
      haptics.reject();
    } finally {
      setSubmissionMode(null);
    }
  };

  if (draftLoading) {
    return (
      <Card style={styles.loadingCard}>
        <Skeleton lines={5} />
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <ShieldAlert color={ui.color.status.warning} size={22} />
          </View>
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              Report this call
            </Text>
            <Text style={styles.body}>
              Tell safety what happened with {context.hostName}. The captured
              call evidence stays attached to this draft until submission
              succeeds.
            </Text>
          </View>
        </View>
        <View style={styles.badgesRow}>
          {metaBadges.map((badge) => (
            <StatusBadge key={badge.label} label={badge.label} tone="warning" />
          ))}
        </View>
      </Card>

      <View accessibilityRole="radiogroup" style={styles.stack}>
        <Text style={styles.sectionTitle}>Category</Text>
        {callReportCategories.map((option) => (
          <RadioCard
            description={option.description}
            disabled={loading}
            key={option.value}
            label={option.label}
            onPress={() => {
              updateCategory(option.value);
            }}
            selected={draftReady.category === option.value}
            testID={`call-report-category-${option.value}`}
          />
        ))}
        {categoryError === null ? null : (
          <InlineError message={categoryError} />
        )}
      </View>

      <TextArea
        editable={!loading}
        helperText="Include names, call behaviour, or timing details that help support review this faster."
        label="Comments"
        maxLength={500}
        onChangeText={updateComments}
        placeholder="Add the details you want safety to review."
        testID="call-report-comments"
        value={draftReady.comments}
      />

      {submitError === null ? null : (
        <Banner message={submitError} title="Report not sent" tone="error" />
      )}

      <View style={styles.actions}>
        {onCancel === undefined ? null : (
          <Button
            disabled={loading}
            onPress={onCancel}
            testID="call-report-cancel"
            title="Cancel"
            variant="secondary"
          />
        )}
        <Button
          disabled={loading}
          icon={Flag}
          loading={submissionMode === 'submit'}
          onPress={() => {
            void submit('submit');
          }}
          testID="call-report-submit"
          title="Submit report"
          variant="secondary"
        />
        {showSubmitAndEnd ? (
          <Button
            icon={Flag}
            loading={submissionMode === 'submit-and-end'}
            onPress={() => {
              void submit('submit-and-end');
            }}
            testID="call-report-submit-end"
            title="Submit and end"
            variant="destructive"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: ui.spacing[3],
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  heroCard: {
    gap: ui.spacing[4],
  },
  heroCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.status.warningSoft,
    borderRadius: ui.radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  loadingCard: {
    gap: ui.spacing[3],
  },
  sectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  stack: {
    gap: ui.spacing[4],
  },
});
