import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), removeItem: vi.fn() }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('react-native', () => ({ AppState: {} }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock('@/lib/supabase/secureSessionStorage', () => ({
  secureSessionStorage: { removeItem: mocks.removeItem },
}));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.invalid');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-placeholder');
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.removeItem.mockReset().mockResolvedValue(undefined);
});
describe('clearSupabaseSession', () => {
  it('signs out this session and removes the local session', async () => {
    const { clearSupabaseSession } = await import('./client');
    await clearSupabaseSession();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.removeItem).toHaveBeenCalledWith('live-to-eat.auth.session.v1');
  });
  it('attempts local deletion even when signOut throws', async () => {
    const { clearSupabaseSession } = await import('./client');
    mocks.signOut.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(clearSupabaseSession()).rejects.toThrow('network unavailable');
    expect(mocks.removeItem).toHaveBeenCalledWith('live-to-eat.auth.session.v1');
  });
  it('does not claim success when local deletion fails', async () => {
    const { clearSupabaseSession } = await import('./client');
    mocks.removeItem.mockRejectedValueOnce(new Error('device locked'));
    await expect(clearSupabaseSession()).rejects.toThrow('device locked');
  });
});
