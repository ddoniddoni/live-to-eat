import { useState } from 'react';
import { safety } from '@/features/safety/safetyStyles';
import { Keyboard, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Field, Notice, ui } from '@/components/ui/primitives';
import { SafetyChoice, SafetyIntro } from './SafetyContent';
import { canReviewReport, reportDetailLimit, reportReasons, type ReportReason, type ReportTarget } from './reportForm';

export function ReportSheet({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const canReview = canReviewReport(reason, details);
  const dirty = reason !== null || details.length > 0;

  return (
    <Sheet title={t('report.title')} subtitle={t(reviewing ? 'report.stepReview' : 'report.stepReason')} onClose={onClose}
      contentKey={String(reviewing)}
      unsavedChanges={dirty} {...(reviewing ? { onBack: () => { setReviewing(false); setUnavailable(false); } } : {})}
      footer={reviewing ? (
        <>
          {unavailable ? <Notice>{t('report.unavailable')}</Notice> : null}
          <Action label={t('report.send')} icon="shield" disabled={unavailable} onPress={() => setUnavailable(true)} />
          <Action secondary label={t('report.edit')} onPress={() => { setReviewing(false); setUnavailable(false); }} />
        </>
      ) : <Action label={t('report.review')} icon="arrow" disabled={!canReview} onPress={() => { Keyboard.dismiss(); setReviewing(true); }} />}
    >
      <SafetyIntro icon="shield" eyebrow={t('report.eyebrow')}
        title={t(reviewing ? 'report.reviewTitle' : 'report.introTitle')}
        body={t(reviewing ? 'report.reviewBody' : 'report.introBody')} />
      <ReportTargetCard target={target} reason={reviewing ? reason : null} details={details} />
      {!reviewing ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('report.reasonLabel')} style={safety.stack}>
            <Text style={ui.label}>{t('report.reasonLabel')}</Text>
            {reportReasons.map((option) => (
              <SafetyChoice key={option} selected={reason === option} label={t(`report.reasons.${option}`)} onPress={() => setReason(option)} />
            ))}
          </View>
          <View style={safety.stack}>
            <Field multiline label={t(reason === 'other' ? 'report.detailsRequired' : 'report.details')}
              maxLength={reportDetailLimit} value={details} onChangeText={setDetails}
              placeholder={t('report.detailsPlaceholder')} />
            <View style={ui.between}>
              <Text style={[safety.caption, { flex: 1 }]}>{t('report.detailsHint')}</Text>
              <Text style={safety.caption}>{details.length}/{reportDetailLimit}</Text>
            </View>
            {reason === 'other' && details.trim().length < 10 ? <Text style={safety.caption}>{t('report.otherHint')}</Text> : null}
          </View>
        </>
      ) : <Text style={ui.muted}>{t('report.reviewPrivacy')}</Text>}
      <Text style={safety.caption}>{t('report.previewNotice')}</Text>
    </Sheet>
  );
}

function ReportTargetCard({ target, reason, details }: { target: ReportTarget; reason: ReportReason | null; details: string }) {
  const { t } = useTranslation();
  return (
      <View style={safety.review}>
        <Text style={safety.eyebrow}>{t(target.kind === 'profile' ? 'report.targetProfile' : 'report.targetPlace')}</Text>
        <View style={safety.stack}>
          {target.kind === 'saved-place' ? <Text style={safety.rowTitle}>{target.placeName}</Text> : null}
          <Text style={ui.body}>{target.displayName} <Text style={ui.muted}>@{target.handle}</Text></Text>
        </View>
        {reason ? (
          <>
            <View style={ui.divider} />
            <Text style={safety.rowTitle}>{t(`report.reasons.${reason}`)}</Text>
            <Text style={ui.body}>{details.trim() || t('report.noDetails')}</Text>
          </>
        ) : null}
      </View>
  );
}
