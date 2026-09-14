import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configured: true,
  signInWithPassword: vi.fn(), signUp: vi.fn(), exchangeCodeForSession: vi.fn(),
}));
vi.mock('expo-apple-authentication', () => ({}));
vi.mock('expo-crypto', () => ({}));
vi.mock('expo-linking', () => ({ createURL: (path: string) => `live-to-eat-dev://${path}` }));
vi.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocks.configured ? { auth: mocks } : null }));

import { signInWithEmail, signUpWithEmail, exchangeEmailAuthLink } from './authProviders';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: 'test-user' }, session: null }, error: null });
  mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
});

describe('email authentication contracts without a backend', () => {
  it('normalizes emails but preserves password whitespace', async () => {
    await signInWithEmail({ email: ' Test@Example.com ', password: ' secret ' });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: ' secret ' });
  });
  it('keeps confirmation-required signups signed out', async () => {
    expect(await signUpWithEmail({ email: ' Test@Example.com ', password: 'password1' })).toBe(false);
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'test@example.com', password: 'password1',
      options: { emailRedirectTo: 'live-to-eat-dev://auth/confirm' },
    });
  });
  it('recognizes an immediately authenticated signup', async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { user: { id: 'test-user' }, session: { user: { id: 'test-user' } } }, error: null });
    expect(await signUpWithEmail({ email: 'test@example.com', password: 'password1' })).toBe(true);
  });
  it.each([['invalid_credentials', 'INVALID_CREDENTIALS'], ['email_not_confirmed', 'EMAIL_NOT_CONFIRMED']])('maps %s without exposing the raw error', async (code, expected) => {
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { code, message: 'private diagnostic' } });
    await expect(signInWithEmail({ email: 'test@example.com', password: 'password1' })).rejects.toMatchObject({ code: expected, message: expected });
  });
  it('never reports success or calls an API without configuration', async () => {
    mocks.configured = false;
    await expect(signUpWithEmail({ email: 'test@example.com', password: 'password1' })).rejects.toMatchObject({ code: 'CONFIGURATION_REQUIRED' });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('exchanges only expected callbacks using their flow id', async () => {
    await exchangeEmailAuthLink('live-to-eat-dev://auth/confirm?code=test-code&sb_flow_id=test-flow');
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('test-code', { flowId: 'test-flow' });
    mocks.exchangeCodeForSession.mockClear();
    expect(await exchangeEmailAuthLink('live-to-eat-dev://unrelated?code=test-code')).toBeNull();
    await expect(exchangeEmailAuthLink('live-to-eat-dev://auth/confirm?error=expired')).rejects.toMatchObject({ code: 'AUTH_LINK_INVALID' });
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
