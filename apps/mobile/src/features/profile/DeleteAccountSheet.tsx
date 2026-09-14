import { useState } from 'react';
import { safety } from '@/features/safety/safetyStyles';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Notice, ui } from '@/components/ui/primitives';
import { SafetyChoice, SafetyIntro, SafetyRow } from '@/features/safety/SafetyContent';

export function DeleteAccountSheet({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  return (
    <Sheet title={t('deletion.title')} subtitle={t(reviewing ? 'deletion.stepConfirm' : 'deletion.stepInfo')} onClose={onClose}
      footer={reviewing ? (
        <>
          {unavailable ? <Notice>{t('deletion.unavailable')}</Notice> : null}
          <Action danger icon="shield" label={t('deletion.verify')} disabled={!understood || !confirmed || unavailable}
            onPress={() => setUnavailable(true)} />
          <Action secondary label={t('deletion.keepAccount')} onPress={onClose} />
        </>
      ) : <Action label={t('deletion.continue')} icon="arrow" onPress={() => setReviewing(true)} />}
    >
      <SafetyIntro icon={reviewing ? 'shield' : 'folder'} eyebrow={t('deletion.eyebrow')}
        title={t(reviewing ? 'deletion.confirmTitle' : 'deletion.introTitle')}
        body={t(reviewing ? 'deletion.confirmBody' : 'deletion.introBody')} />
      {!reviewing ? (
        <>
          <View style={safety.card}>
            <SafetyRow icon="person" title={t('deletion.accountTitle')} body={t('deletion.accountBody')} />
            <View style={ui.divider} />
            <SafetyRow icon="map" title={t('deletion.recordsTitle')} body={t('deletion.recordsBody')} />
            <View style={ui.divider} />
            <SafetyRow icon="link" title={t('deletion.linksTitle')} body={t('deletion.linksBody')} />
          </View>
          <View style={safety.inset}>
            <Text style={safety.rowTitle}>{t('deletion.exportTitle')}</Text>
            <Text style={ui.muted}>{t('deletion.exportBody')}</Text>
            <Action secondary icon="download" label={t('profile.export')} onPress={onExport} />
          </View>
          <Text style={safety.caption}>{t('deletion.copyLimit')}</Text>
        </>
      ) : (
        <>
          <View style={safety.review}>
            <Text style={safety.rowTitle}>{t('deletion.summaryTitle')}</Text>
            <Text style={ui.body}>{t('deletion.summaryBody')}</Text>
            <View style={ui.divider} />
            <Text style={ui.muted}>{t('deletion.verificationHint')}</Text>
          </View>
          <SafetyChoice checkbox selected={understood} label={t('deletion.understood')}
            onPress={() => { setUnderstood((v) => !v); setUnavailable(false); }} />
          <SafetyChoice checkbox selected={confirmed} label={t('deletion.confirmed')}
            onPress={() => { setConfirmed((v) => !v); setUnavailable(false); }} />
          <Action secondary label={t('common.back')} onPress={() => { setReviewing(false); setUnavailable(false); }} />
        </>
      )}
      <Text style={safety.caption}>{t('deletion.previewNotice')}</Text>
    </Sheet>
  );
}
