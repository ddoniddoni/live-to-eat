import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { shareStatus, visibleSharePlaces, type ShareDraft } from '@live-to-eat/domain';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Empty, ui } from '@/components/ui/primitives';
import { colors } from '@/components/tokens';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { useRequest } from '@/lib/requests/useRequest';
import { RequestError } from '@/components/ui/RequestError';
export function ShareManager({
  book,
  onClose,
  onCreate,
}: {
  book: NotebookController;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const request = useRequest();
  const [selected, setSelected] = useState<ShareDraft | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }), [i18n.language]);
  const current = selected ? book.state.shares.find((s) => s.id === selected.id) : undefined;
  return (
    <Sheet
      title={t('sharing.manage')}
      subtitle={t('sharing.draftHint')}
      onClose={onClose}
      busy={request.busy}
      contentKey={request.error ?? 'manage'}
      footer={<Action disabled={request.busy} label={t('sharing.create')} onPress={onCreate} icon="plus" />}
    >
      <RequestError error={request.error} />
      {!book.state.shares.length ? (
        <Empty title={t('sharing.noShares')} body={t('sharing.noSharesHint')} />
      ) : null}
      {book.state.shares.map((s) => (
        <View
          key={s.id}
          style={{
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: colors.rule,
            padding: 20,
            borderRadius: 18,
            gap: 12,
          }}
        >
          <View style={ui.between}>
            <Text style={[ui.heading, { flex: 1 }]}>{s.title}</Text>
            <Text
              style={{
                fontSize: 11,
                color: shareStatus(s, now) === 'active' ? colors.success : colors.muted,
              }}
            >
              {t(`sharing.${shareStatus(s, now)}`)}
            </Text>
          </View>
          <Text style={ui.muted}>
            {t('sharing.placeCount', { count: visibleSharePlaces(s, book.state.places, now).length })} ·{' '}
            {dateFormatter.format(s.expiresAt)}{' '}
            {t('sharing.expires')}
          </Text>
          <Action secondary label={t('sharing.viewDraft')} onPress={() => setSelected(s)} />
          {shareStatus(s, now) === 'active' ? (
            <Action
              secondary
              label={t('sharing.revoke')}
              busy={request.busy}
              onPress={() => { void request.run(() =>
                book.update((b) => ({
                  ...b,
                  shares: b.shares.map((item) =>
                    item.id === s.id ? { ...item, revokedAt: Date.now() } : item,
                  ),
                }), 'share'));
              }}
            />
          ) : null}
        </View>
      ))}
      {current ? (
        <View style={{ backgroundColor: colors.sage, padding: 20, borderRadius: 18, gap: 14 }}>
          <Text accessibilityRole="header" style={ui.heading}>
            {current.title}
          </Text>
          {visibleSharePlaces(current, book.state.places, now).map((p) => (
            <View key={p.savedId}>
              <Text style={[ui.body, { fontWeight: '600' }]}>{p.displayName}</Text>
              <Text style={ui.muted}>{p.address}</Text>
              {p.publicNote ? <Text style={ui.body}>{p.publicNote}</Text> : null}
            </View>
          ))}
          {visibleSharePlaces(current, book.state.places, now).length === 0 ? (
            <Text style={ui.muted}>{t('sharing.unavailable')}</Text>
          ) : null}
          <Action secondary label={t('common.close')} onPress={() => setSelected(null)} />
        </View>
      ) : null}
    </Sheet>
  );
}
