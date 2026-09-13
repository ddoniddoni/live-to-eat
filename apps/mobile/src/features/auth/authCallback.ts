export type EmailAuthLinkKind = 'confirmation' | 'recovery';

export type EmailAuthLinkResult =
  | { kind: 'ignored' }
  | { kind: 'invalid'; linkKind: EmailAuthLinkKind }
  | { code: string; flowId: string | null; kind: 'exchange'; linkKind: EmailAuthLinkKind };

type EmailAuthLinkTargets = Record<EmailAuthLinkKind, string>;

const sameDestination = (candidate: URL, target: URL): boolean =>
  candidate.protocol === target.protocol &&
  candidate.hostname === target.hostname &&
  candidate.port === target.port &&
  candidate.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '');

const readParameters = (url: URL): URLSearchParams => {
  const parameters = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  url.searchParams.forEach((value, key) => parameters.set(key, value));
  return parameters;
};

export const readEmailAuthLink = (url: string, targets: EmailAuthLinkTargets): EmailAuthLinkResult => {
  let candidate: URL;

  try {
    candidate = new URL(url);
  } catch {
    return { kind: 'ignored' };
  }

  const linkKind = (Object.keys(targets) as EmailAuthLinkKind[]).find((kind) => {
    try {
      return sameDestination(candidate, new URL(targets[kind]));
    } catch {
      return false;
    }
  });

  if (!linkKind) return { kind: 'ignored' };

  const parameters = readParameters(candidate);
  if (parameters.has('error') || parameters.has('error_code')) return { kind: 'invalid', linkKind };

  const code = parameters.get('code')?.trim();
  if (!code) return { kind: 'invalid', linkKind };

  return {
    code,
    flowId: parameters.get('sb_flow_id')?.trim() || null,
    kind: 'exchange',
    linkKind,
  };
};
