import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Notice } from '@/components/ui/primitives';
import { SafetyIntro } from '@/features/safety/SafetyContent';

export function SignOutSheet({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => Promise<void> }) {
  const { t } = useTranslation();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await onSignOut();
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('auth.signOut')} onClose={() => { if (!pending.current) onClose(); }}>
      <SafetyIntro icon="logout" eyebrow="LiveToEat" title={t('auth.signOutTitle')} body={t('profile.signoutHint')} />
      {failed ? <Notice>{t('auth.signOutFailed')}</Notice> : null}
      <Action label={t('auth.signOut')} busy={busy} onPress={() => void confirm()} />
      <Action secondary label={t('common.cancel')} disabled={busy} onPress={onClose} />
    </Sheet>
  );
}
