import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  values: new Map<string, string>(),
  get: vi.fn(), set: vi.fn(), remove: vi.fn(),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: native.get, setItemAsync: native.set, deleteItemAsync: native.remove,
}));
import { secureSessionStorage } from './secureSessionStorage';

const validateKey = (key: string) => {
  if (!/^[\w.-]+$/.test(key)) throw new Error('Invalid SecureStore key');
};
beforeEach(() => {
  native.values.clear();
  native.get.mockReset().mockImplementation(async (key: string) => {
    validateKey(key);
    return native.values.get(key) ?? null;
  });
  native.set.mockReset().mockImplementation(async (key: string, value: string) => {
    validateKey(key);
    native.values.set(key, value);
  });
  native.remove.mockReset().mockImplementation(async (key: string) => {
    validateKey(key);
    native.values.delete(key);
  });
});

describe('native session storage', () => {
  it('round-trips large Unicode sessions using only Expo-supported keys and bounded chunks', async () => {
    const value = JSON.stringify({ testSession: '한글🥘'.repeat(800) });
    await secureSessionStorage.setItem('live-to-eat.auth.session.v1', value);
    expect(await secureSessionStorage.getItem('live-to-eat.auth.session.v1')).toBe(value);
    for (const [key, stored] of native.values) {
      expect(key).toMatch(/^[\w.-]+$/);
      expect(new TextEncoder().encode(stored).length).toBeLessThanOrEqual(1800);
    }
    await secureSessionStorage.removeItem('live-to-eat.auth.session.v1');
    expect(native.values.size).toBe(0);
    expect(await secureSessionStorage.getItem('live-to-eat.auth.session.v1')).toBeNull();
  });

  it('keeps PKCE key names distinct when they contain punctuation', async () => {
    await secureSessionStorage.setItem('auth:verifier', 'first');
    await secureSessionStorage.setItem('auth_verifier', 'second');
    expect(await secureSessionStorage.getItem('auth:verifier')).toBe('first');
    expect(await secureSessionStorage.getItem('auth_verifier')).toBe('second');
  });

  it('retains the prior complete session if committing a replacement fails', async () => {
    await secureSessionStorage.setItem('auth', 'old-session');
    const previous = new Map(native.values);
    native.set.mockImplementation(async (key: string, value: string) => {
      validateKey(key);
      if (key.endsWith('.manifest')) throw new Error('storage full');
      native.values.set(key, value);
    });
    await expect(secureSessionStorage.setItem('auth', 'replacement')).rejects.toThrow('storage full');
    expect(await secureSessionStorage.getItem('auth')).toBe('old-session');
    expect(native.values).toEqual(previous);
  });

  it('waits for pending chunk writes before cleaning a failed generation', async () => {
    await secureSessionStorage.setItem('auth', 'old-session');
    const previous = new Map(native.values);
    native.set.mockImplementation(async (key: string, value: string) => {
      if (key.endsWith('.chunk.0')) throw new Error('write failed');
      await new Promise((resolve) => setTimeout(resolve, 5));
      native.values.set(key, value);
    });
    await expect(secureSessionStorage.setItem('auth', 'x'.repeat(4000))).rejects.toThrow('write failed');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(native.values).toEqual(previous);
  });

  it('reports failed deletion and keeps enough metadata for a successful retry', async () => {
    await secureSessionStorage.setItem('auth', 'test-session');
    native.remove.mockRejectedValueOnce(new Error('device locked'));
    await expect(secureSessionStorage.removeItem('auth')).rejects.toThrow('device locked');
    await secureSessionStorage.removeItem('auth');
    expect(native.values.size).toBe(0);
  });
});
