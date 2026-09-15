import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '@/components/tokens';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Chip, ui } from '@/components/ui/primitives';
import { useRequest } from '@/lib/requests/useRequest';
import { helpResource, openHelpResource, type HelpLocale, type PolicyId, type ResourceId } from './helpResources';

const questions = ['saving', 'search', 'sharing', 'account', 'report', 'demo'] as const;
type QuestionId = typeof questions[number];
export type HelpPage = 'home' | ResourceId | QuestionId;
const sectionIds: Record<PolicyId, readonly string[]> = {
  terms: ['records', 'community', 'changes'],
  privacy: ['private', 'shared', 'control'],
};

function HelpRow({ title, description, icon, onPress, testID }: {
  title: string; description?: string; icon?: IconName; onPress: () => void; testID: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {icon ? <View style={styles.rowIcon}><Icon name={icon} size={20} color={colors.success} /></View> : null}
      <View style={styles.rowCopy}>
        <Text style={[ui.body, styles.strong]}>{title}</Text>
        {description ? <Text style={ui.muted}>{description}</Text> : null}
      </View>
      <Icon name="chevron" size={16} color={colors.muted} />
    </Pressable>
  );
}

function HelpHome({ t, navigate }: { t: TFunction; navigate: (page: HelpPage) => void }) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroMark}><Icon name="help" color={colors.success} size={28} /></View>
        <Text accessibilityRole="header" style={ui.title}>{t('help.welcome')}</Text>
        <Text style={ui.body}>{t('help.intro')}</Text>
      </View>
      <View>
        <Text accessibilityRole="header" style={ui.label}>{t('help.faqLabel')}</Text>
        {questions.map((id) => <HelpRow key={id} title={t(`help.faq.${id}.title`)}
          testID={`help-faq-${id}`} onPress={() => navigate(id)} />)}
      </View>
      <HelpRow title={t('help.contact.title')} description={t('help.contact.teaser')}
        icon="help" testID="help-contact" onPress={() => navigate('contact')} />
      <View>
        <Text accessibilityRole="header" style={ui.label}>{t('help.documents')}</Text>
        <HelpRow title={t('help.terms.title')} icon="list" testID="help-terms" onPress={() => navigate('terms')} />
        <HelpRow title={t('help.privacy.title')} icon="lock" testID="help-privacy" onPress={() => navigate('privacy')} />
      </View>
    </>
  );
}

function ResourceLink({ id, locale, t }: { id: ResourceId; locale: HelpLocale; t: TFunction }) {
  const resource = helpResource(id, locale);
  const request = useRequest();
  const open = () => {
    if (!resource) return;
    void request.run(() => openHelpResource(resource, (url) => WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.canvas, controlsColor: colors.tomato, dismissButtonStyle: 'close',
      showTitle: true, createTask: false, enableBarCollapsing: false,
    })));
  };
  return (
    <View style={[styles.resource, request.error ? styles.failed : null]} testID="help-resource">
      <Text accessibilityRole="header" style={ui.heading}>
        {t(id === 'contact' ? 'help.contact.channel' : 'help.original')}
      </Text>
      {resource ? (
        <>
          {resource.version ? <Text style={ui.muted}>{t('help.version', { version: resource.version, date: resource.effectiveDate })}</Text> : null}
          <Text selectable style={ui.body}>{new URL(resource.url).hostname}</Text>
          <Text style={ui.muted}>{t('help.browserHint')}</Text>
          {request.error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="help-link-error" style={styles.section}>
            <Text style={[ui.body, styles.strong]}>{t('help.linkErrorTitle')}</Text>
            <Text style={ui.body}>{t('help.linkErrorBody')}</Text>
          </View> : null}
          <Action label={t(request.error ? 'common.retry' : id === 'contact' ? 'help.contact.open' : 'help.openOriginal')}
            busy={request.busy} icon="arrow" onPress={open} testID="help-open-resource" />
        </>
      ) : (
        <View style={styles.section} testID="help-resource-unavailable">
          <Text style={styles.status}>{t('help.preparing')}</Text>
          <Text style={ui.body}>{t(id === 'contact' ? 'help.contact.unavailable' : 'help.documentUnavailable')}</Text>
        </View>
      )}
    </View>
  );
}

function PolicyReader({ id, t, locale }: { id: PolicyId; t: TFunction; locale: HelpLocale }) {
  return (
    <>
      <View style={styles.summary}>
        <Text style={styles.status}>{t('help.guideLabel')}</Text>
        <Text style={ui.body}>{t('help.guideNotice')}</Text>
      </View>
      {sectionIds[id].map((section, index) => <View key={section} style={styles.section}>
        <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
        <Text accessibilityRole="header" style={ui.heading}>{t(`help.${id}.${section}Title`)}</Text>
        <Text selectable style={ui.body}>{t(`help.${id}.${section}Body`)}</Text>
      </View>)}
      <ResourceLink id={id} locale={locale} t={t} />
    </>
  );
}

function HelpContent({ page, locale, t, navigate }: {
  page: HelpPage; locale: HelpLocale; t: TFunction; navigate: (page: HelpPage) => void;
}) {
  if (page === 'home') return <HelpHome t={t} navigate={navigate} />;
  if (page === 'terms' || page === 'privacy') return <PolicyReader id={page} t={t} locale={locale} />;
  if (page === 'contact') return <>
    <Text style={ui.body}>{t('help.contact.body')}</Text>
    <View style={styles.summary}>
      <Text accessibilityRole="header" style={ui.heading}>{t('help.contact.checkTitle')}</Text>
      <Text selectable style={ui.body}>{t('help.contact.checkBody')}</Text>
      <Text style={ui.muted}>{t('help.contact.privateHint')}</Text>
    </View>
    <ResourceLink id="contact" locale={locale} t={t} />
  </>;
  return <>
    <Text style={styles.status}>{t('help.faqLabel')}</Text>
    <Text selectable style={ui.body}>{t(`help.faq.${page}.body`)}</Text>
    <View style={styles.summary}><Text style={ui.body}>{t(`help.faq.${page}.hint`)}</Text></View>
    <HelpRow title={t('help.contact.title')} icon="help" testID="help-related-contact" onPress={() => navigate('contact')} />
  </>;
}

export function HelpCenterSheet({ onClose, initialPage = 'home' }: { onClose: () => void; initialPage?: HelpPage }) {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<HelpLocale>(i18n.language.startsWith('ko') ? 'ko' : 'en');
  const [history, setHistory] = useState<HelpPage[]>([initialPage]);
  const page = history[history.length - 1]!;
  const t = i18n.getFixedT(locale);
  const navigate = (next: HelpPage) => setHistory((previous) => [...previous, next]);
  const back = () => history.length > 1 ? setHistory((previous) => previous.slice(0, -1)) : onClose();
  const title = page === 'home' ? t('help.title') : questions.includes(page as QuestionId)
    ? t(`help.faq.${page}.title`) : t(`help.${page}.title`);
  return (
    <Sheet title={title} subtitle="LiveToEat" onClose={onClose} onBack={back}
      closeLabel={t('common.close')} contentKey={`${locale}/${page}`} testID="help-sheet"
      footer={<Action secondary icon="back" label={t(history.length > 1 ? 'common.back' : 'common.close')}
        onPress={back} testID="help-back" />}>
      <View style={styles.languages}>
        <Chip label="한국어" selected={locale === 'ko'} onPress={() => setLocale('ko')} />
        <Chip label="English" selected={locale === 'en'} onPress={() => setLocale('en')} />
      </View>
      <HelpContent key={`${locale}/${page}`} page={page} locale={locale} t={t} navigate={navigate} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.sage, borderRadius: 24, padding: 24, gap: 14 },
  heroMark: { backgroundColor: colors.paper, borderRadius: 16, padding: 12, alignSelf: 'flex-start' },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.rule },
  rowIcon: { backgroundColor: colors.sage, padding: 10, borderRadius: 14 },
  rowCopy: { flex: 1, gap: 6 },
  strong: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
  summary: { padding: 20, gap: 10, backgroundColor: colors.sage, borderRadius: 20 },
  section: { gap: 10 },
  resource: { padding: 20, gap: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: 20 },
  failed: { backgroundColor: colors.blush },
  status: { color: colors.success, fontSize: 13, fontWeight: '700' },
  number: { color: colors.tomato, fontSize: 14, fontWeight: '700' },
});
