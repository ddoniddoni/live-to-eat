export type HelpLocale = 'ko' | 'en';
export type PolicyId = 'terms' | 'privacy';
export type ResourceId = PolicyId | 'contact';
export type Resource = { url: string; version?: string; effectiveDate?: string };
type ResourceInput = { url?: string | undefined; version?: string | undefined; effectiveDate?: string | undefined };

// Public, owner-approved destinations only. Never add account data or tokens.
export function publicHttpsUrl(raw: string | undefined): string | null {
  if (!raw || /\s/.test(raw) || !raw.startsWith('https://')) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.username || url.password || url.port || !host.includes('.') ||
      /^(\d+\.){3}\d+$/.test(host) || host.includes(':') ||
      /\.(invalid|localhost|local|test)$/.test(host) ||
      /(^|\.)example\.(com|org|net)$/.test(host)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveResource(id: ResourceId, input: ResourceInput): Resource | null {
  const url = publicHttpsUrl(input.url);
  if (!url) return null;
  if (id === 'contact') return { url };
  const version = input.version?.trim();
  const date = input.effectiveDate;
  if (!version || version.length > 60 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return { url, version, effectiveDate: date };
}

export function helpResource(id: ResourceId, locale: HelpLocale): Resource | null {
  // Expo inlines only statically accessed EXPO_PUBLIC_ variables.
  if (id === 'contact') return resolveResource(id, {
    url: locale === 'ko' ? process.env.EXPO_PUBLIC_SUPPORT_URL : process.env.EXPO_PUBLIC_SUPPORT_URL_EN,
  });
  if (id === 'terms') return resolveResource(id, {
    url: locale === 'ko' ? process.env.EXPO_PUBLIC_TERMS_URL_KO : process.env.EXPO_PUBLIC_TERMS_URL_EN,
    version: process.env.EXPO_PUBLIC_TERMS_VERSION,
    effectiveDate: process.env.EXPO_PUBLIC_TERMS_EFFECTIVE_DATE,
  });
  return resolveResource(id, {
    url: locale === 'ko' ? process.env.EXPO_PUBLIC_PRIVACY_URL_KO : process.env.EXPO_PUBLIC_PRIVACY_URL_EN,
    version: process.env.EXPO_PUBLIC_PRIVACY_VERSION,
    effectiveDate: process.env.EXPO_PUBLIC_PRIVACY_EFFECTIVE_DATE,
  });
}

export async function openHelpResource(
  resource: Resource,
  open: (url: string) => Promise<{ type: string }>,
): Promise<void> {
  const url = publicHttpsUrl(resource.url);
  if (!url) throw new Error('HELP_LINK_UNAVAILABLE');
  const result = await open(url);
  // Closing the browser is a normal return, never proof of reading or consent.
  if (!['opened', 'cancel', 'dismiss'].includes(result.type)) throw new Error('HELP_LINK_NOT_OPENED');
}
