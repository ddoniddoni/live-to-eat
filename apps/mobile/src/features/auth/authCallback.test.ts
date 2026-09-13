import { describe, expect, it } from 'vitest';

import { readEmailAuthLink } from './authCallback';

const targets = {
  confirmation: 'live-to-eat-dev://auth/confirm',
  recovery: 'live-to-eat-dev://auth/recovery',
} as const;

describe('readEmailAuthLink', () => {
  it('reads a recovery code and its matching PKCE flow id', () => {
    expect(
      readEmailAuthLink('live-to-eat-dev://auth/recovery?code=secret-code&sb_flow_id=flow_123', targets),
    ).toEqual({
      code: 'secret-code',
      flowId: 'flow_123',
      kind: 'exchange',
      linkKind: 'recovery',
    });
  });

  it('accepts fragment parameters returned by an auth error redirect', () => {
    expect(
      readEmailAuthLink('live-to-eat-dev://auth/confirm#error=access_denied&error_code=otp_expired', targets),
    ).toEqual({ kind: 'invalid', linkKind: 'confirmation' });
  });

  it('rejects the expected path when the callback has no code', () => {
    expect(readEmailAuthLink('live-to-eat-dev://auth/recovery', targets)).toEqual({
      kind: 'invalid',
      linkKind: 'recovery',
    });
  });

  it('ignores lookalike hosts and unrelated app links', () => {
    expect(readEmailAuthLink('live-to-eat-dev://attacker/recovery?code=secret-code', targets)).toEqual({
      kind: 'ignored',
    });
    expect(readEmailAuthLink('live-to-eat-dev://auth/place/123?code=secret-code', targets)).toEqual({
      kind: 'ignored',
    });
  });
});
