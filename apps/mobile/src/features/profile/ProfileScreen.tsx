import { useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { exportCsv, exportRecords } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Action, Chip, Field, IconButton, Notice, ui } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { setPublicMapEnabled } from '@/features/discover/publicMapApi';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { saveExport } from './exportFile';
import { DeleteAccountSheet } from './DeleteAccountSheet';
import { SignOutSheet } from '@/features/auth/SignOutSheet';

type Panel = 'edit' | 'language' | 'export' | 'privacy' | 'blocked' | 'help' | 'about' | 'signout' | 'delete' | null;
export function ProfileScreen({
  book,
  isDemo,
  onFolders,
  onShares,
  onSignOut,
}: {
  book: NotebookController;
  isDemo: boolean;
  onFolders: () => void;
  onShares: () => void;
  onSignOut: (() => Promise<void>) | undefined;
}) {
  const { t, i18n } = useTranslation();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const visited = book.state.places.filter((p) => p.visitStatus === 'visited').length;
  const open = (p: Panel) => {
    setError(false);
    setPanel(p);
  };
  const toggle = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const enabled = isDemo ? value : await setPublicMapEnabled(value);
      book.update((b) => ({ ...b, profile: { ...b.profile, publicMapEnabled: enabled } }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 110, gap: 24 }}
      >
        <View style={[ui.between, { paddingTop: 8 }]}>
          <Text accessibilityRole="header" style={ui.title}>
            {t('profile.title')}
          </Text>
          {isDemo ? <IconButton name="edit" label={t('profile.edit')} onPress={() => open('edit')} /> : null}
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 14, gap: 10 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 31,
              backgroundColor: colors.blush,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-5deg' }],
            }}
          >
            <Icon name="utensils" size={41} color={colors.tomato} />
          </View>
          <Text style={[ui.heading, { marginTop: 8, fontSize: 23 }]}>
            {book.state.profile.displayName || t('profile.defaultName')}
          </Text>
          <Text style={ui.muted}>{book.state.profile.bio || t('profile.defaultBio')}</Text>
          {isDemo ? (
            <Text style={{ fontSize: 11, color: colors.tomato, marginTop: 2 }}>{t('profile.demo')}</Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: 20,
            paddingVertical: 22,
          }}
        >
          {[
            { value: book.total, label: 'saved' },
            { value: visited, label: 'visited' },
            { value: book.state.collections.length, label: 'folders' },
          ].map((stat, index) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                borderLeftWidth: index ? 1 : 0,
                borderColor: colors.rule,
              }}
            >
              <Text style={{ fontSize: 25, fontWeight: '700', color: colors.ink }}>{stat.value}</Text>
              <Text style={ui.muted}>{t(`profile.${stat.label}`)}</Text>
            </View>
          ))}
        </View>
        <View style={{ padding: 20, backgroundColor: colors.sage, borderRadius: 20, gap: 10 }}>
          <View style={ui.between}>
            <View style={ui.row}>
              <Icon name="globe" size={20} color={colors.success} />
              <Text style={[ui.body, { fontWeight: '700' }]}>{t('profile.publicMap')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('profile.publicMap')}
              value={book.state.profile.publicMapEnabled}
              disabled={busy}
              onValueChange={(v) => void toggle(v)}
              trackColor={{ false: '#C7D2C1', true: colors.success }}
            />
          </View>
          <Text style={ui.muted}>
            {t('profile.publicHint', {
              count: book.state.places.filter((p) => p.visibility === 'public').length,
            })}
          </Text>
        </View>
        {error ? <Notice>{t('common.saveError')}</Notice> : null}
        <View>
          <Text style={ui.label}>{t('profile.myRecords')}</Text>
          <SettingRow icon="folder" label={t('profile.folders')} onPress={onFolders} />
          <SettingRow icon="share" label={t('sharing.manage')} onPress={onShares} />
          <SettingRow icon="download" label={t('profile.export')} onPress={() => open('export')} />
        </View>
        <View>
          <Text style={ui.label}>{t('profile.settings')}</Text>
          <SettingRow
            icon="globe"
            label={t('profile.language')}
            value={i18n.language.startsWith('ko') ? '한국어' : 'English'}
            onPress={() => open('language')}
          />
          <SettingRow icon="lock" label={t('profile.privacy')} onPress={() => open('privacy')} />
          {isDemo ? (
            <SettingRow
              icon="shield"
              label={t('profile.blocked')}
              value={String(book.state.blockedHandles.length)}
              onPress={() => open('blocked')}
            />
          ) : null}
          <SettingRow icon="help" label={t('profile.help')} onPress={() => open('help')} />
          <SettingRow icon="compass" label={t('profile.about')} value="0.1.0" onPress={() => open('about')} />
          {onSignOut ? (
            <SettingRow icon="logout" label={t('auth.signOut')} onPress={() => open('signout')} />
          ) : null}
          <SettingRow icon="trash" label={t('deletion.title')} onPress={() => open('delete')} />
        </View>
        <Text style={[ui.muted, { textAlign: 'center', fontSize: 11 }]}>
          LiveToEat · {t('profile.footer')}
        </Text>
      </ScrollView>
      {panel === 'edit' ? <ProfileEditor book={book} onClose={() => setPanel(null)} /> : null}
      {panel === 'delete' ? <DeleteAccountSheet onClose={() => setPanel(null)} onExport={() => setPanel('export')} /> : null}
      {panel === 'signout' && onSignOut ? <SignOutSheet onClose={() => setPanel(null)} onSignOut={onSignOut} /> : null}
      {panel && panel !== 'edit' && panel !== 'delete' && panel !== 'signout' ? (
        <ProfilePanel
          panel={panel}
          book={book}
          isDemo={isDemo}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </>
  );
}
function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        ui.row,
        {
          minHeight: 61,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderColor: colors.rule,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={icon} color={colors.muted} size={20} />
      <Text style={[ui.body, { flex: 1, marginLeft: 4 }]}>{label}</Text>
      {value ? <Text style={ui.muted}>{value}</Text> : null}
      <Icon name="chevron" size={15} color={colors.muted} />
    </Pressable>
  );
}
function Info({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={ui.heading}>{title}</Text>
      <Text style={ui.body}>{body}</Text>
    </View>
  );
}
function ProfileEditor({ book, onClose }: { book: NotebookController; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(book.state.profile.displayName);
  const [bio, setBio] = useState(book.state.profile.bio);
  return (
    <Sheet
      title={t('profile.edit')}
      onClose={onClose}
      footer={
        <Action
          label={t('editor.save')}
          disabled={!name.trim()}
          onPress={() => {
            book.update((b) => ({
              ...b,
              profile: { ...b.profile, displayName: name.trim(), bio: bio.trim() },
            }));
            onClose();
          }}
        />
      }
    >
      <Field label={t('auth.displayName')} value={name} onChangeText={setName} maxLength={60} />
      <Field label={t('profile.bio')} value={bio} onChangeText={setBio} maxLength={280} multiline />
      <Text style={ui.muted}>{t('profile.editHint')}</Text>
    </Sheet>
  );
}

function ProfilePanel({
  panel,
  book,
  isDemo,
  onClose,
}: {
  panel: Exclude<Panel, 'edit' | 'delete' | 'signout' | null>;
  book: NotebookController;
  isDemo: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [exported, setExported] = useState(false);
  const exportData = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const content =
        format === 'csv'
          ? exportCsv(book.state.places, includeNotes)
          : JSON.stringify(
              {
                version: 1,
                exportedAt: new Date().toISOString(),
                source: isDemo ? 'demo' : 'loaded-records',
                records: exportRecords(book.state.places, includeNotes),
              },
              null,
              2,
            );
      await saveExport(content, format);
      setExported(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t(`profile.panel_${panel}`)} onClose={onClose}>
      {panel === 'language' ? (
        <>
          <Text style={ui.muted}>{t('profile.languageHint')}</Text>
          {(['ko', 'en'] as const).map((locale) => (
            <Chip
              key={locale}
              label={locale === 'ko' ? '한국어' : 'English'}
              selected={i18n.language.startsWith(locale)}
              onPress={() => {
                void i18n.changeLanguage(locale);
                book.update((b) => ({ ...b, locale }));
              }}
            />
          ))}
        </>
      ) : null}
      {panel === 'export' ? (
        <>
          <Text style={ui.body}>{t('profile.exportHint')}</Text>
          {!isDemo ? (
            <Notice>
              {t('profile.exportPartial', { count: book.state.places.length, total: book.total })}
            </Notice>
          ) : null}
          <View style={ui.row}>
            {(['json', 'csv'] as const).map((f) => (
              <Chip key={f} label={f.toUpperCase()} selected={format === f} onPress={() => setFormat(f)} />
            ))}
          </View>
          <View style={ui.between}>
            <Text style={[ui.body, { flex: 1 }]}>{t('profile.includeNotes')}</Text>
            <Switch
              accessibilityLabel={t('profile.includeNotes')}
              value={includeNotes}
              onValueChange={setIncludeNotes}
              trackColor={{ false: colors.rule, true: colors.success }}
            />
          </View>
          {includeNotes ? <Notice>{t('profile.notesWarning')}</Notice> : null}
          <Action
            label={t('profile.exportFile')}
            icon="download"
            busy={busy}
            onPress={() => void exportData()}
          />
          {exported ? (
            <Text accessibilityRole="alert" style={ui.body}>
              {t('profile.exported')}
            </Text>
          ) : null}
          {error ? <Notice>{t('common.saveError')}</Notice> : null}
        </>
      ) : null}
      {panel === 'privacy' ? (
        <>
          <Info title={t('profile.privacyTitle')} body={t('profile.privacyBody')} />
          <Info title={t('profile.sharingTitle')} body={t('profile.sharingBody')} />
          <Info title={t('profile.locationTitle')} body={t('profile.locationBody')} />
          {isDemo ? <Notice>{t('profile.demoPrivacy')}</Notice> : null}
        </>
      ) : null}
      {panel === 'blocked' ? (
        <>
          <Text style={ui.muted}>{t('profile.blockedHint')}</Text>
          {book.state.blockedHandles.length ? (
            book.state.blockedHandles.map((handle) => (
              <View key={handle} style={ui.between}>
                <Text style={ui.body}>@{handle}</Text>
                <Action
                  label={t('profile.unblock')}
                  secondary
                  onPress={() =>
                    book.update((b) => ({
                      ...b,
                      blockedHandles: b.blockedHandles.filter((h) => h !== handle),
                    }))
                  }
                />
              </View>
            ))
          ) : (
            <Text style={ui.body}>{t('profile.noBlocked')}</Text>
          )}
        </>
      ) : null}
      {panel === 'help' ? (
        <>
          <Info title={t('profile.helpTitle')} body={t('profile.helpBody')} />
          <Info title={t('profile.accountTitle')} body={t('profile.accountBody')} />
          {process.env.EXPO_PUBLIC_SUPPORT_URL?.startsWith('https://') ? (
            <Action
              label={t('profile.contact')}
              icon="arrow"
              onPress={() => {
                void Linking.openURL(process.env.EXPO_PUBLIC_SUPPORT_URL!).catch(() => setError(true));
              }}
            />
          ) : (
            <Notice>{t('profile.supportNotConnected')}</Notice>
          )}
        </>
      ) : null}
      {panel === 'about' ? (
        <>
          <Text style={[ui.title, { color: colors.tomato }]}>LiveToEat</Text>
          <Text style={ui.body}>{t('profile.aboutBody')}</Text>
          <Text style={ui.muted}>{t('profile.version')}</Text>
          <Text style={ui.muted}>{t('profile.artwork')}</Text>
        </>
      ) : null}
    </Sheet>
  );
}
