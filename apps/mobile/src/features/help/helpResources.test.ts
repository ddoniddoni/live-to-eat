import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequest } from '@/lib/requests/request';
import { helpResource, openHelpResource, publicHttpsUrl, resolveResource } from './helpResources';

afterEach(() => vi.unstubAllEnvs());

describe('owner-configured help resources', () => {
  it('rejects missing, unsafe, local, and placeholder destinations', () => {
    for (const value of [undefined, '', 'http://support.livetoeat.app', 'javascript:alert(1)',
      'https://user:secret@support.livetoeat.app', ' https://support.livetoeat.app',
      'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://app.local',
      'https://example.invalid', 'https://docs.example.com', 'https://support.livetoeat.app:8080']) {
      expect(publicHttpsUrl(value)).toBeNull();
    }
  });

  it('keeps the configured language URL and adds no user context', () => {
    expect(publicHttpsUrl('https://support.livetoeat.app/ko?view=help#account'))
      .toBe('https://support.livetoeat.app/ko?view=help#account');
  });

  it('requires a real calendar date and a version before exposing a policy', () => {
    const url = 'https://support.livetoeat.app/terms/ko';
    expect(resolveResource('terms', { url })).toBeNull();
    expect(resolveResource('terms', { url, version: ' ', effectiveDate: '2026-09-16' })).toBeNull();
    expect(resolveResource('terms', { url, version: '1', effectiveDate: '2026-02-30' })).toBeNull();
    expect(resolveResource('privacy', { url, version: '1', effectiveDate: '16/09/2026' })).toBeNull();
    expect(resolveResource('terms', { url, version: ' 1.0 ', effectiveDate: '2026-09-16' }))
      .toEqual({ url, version: '1.0', effectiveDate: '2026-09-16' });
    expect(resolveResource('contact', { url })).toEqual({ url });
  });

  it('does not silently substitute a Korean document or contact page for missing English', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPPORT_URL', 'https://support.livetoeat.app/ko');
    vi.stubEnv('EXPO_PUBLIC_SUPPORT_URL_EN', '');
    vi.stubEnv('EXPO_PUBLIC_TERMS_URL_KO', 'https://support.livetoeat.app/terms/ko');
    vi.stubEnv('EXPO_PUBLIC_TERMS_URL_EN', '');
    vi.stubEnv('EXPO_PUBLIC_TERMS_VERSION', '1');
    vi.stubEnv('EXPO_PUBLIC_TERMS_EFFECTIVE_DATE', '2026-09-16');
    expect(helpResource('contact', 'ko')).not.toBeNull();
    expect(helpResource('terms', 'ko')).not.toBeNull();
    expect(helpResource('contact', 'en')).toBeNull();
    expect(helpResource('terms', 'en')).toBeNull();
  });
});

describe('browser launch and return', () => {
  const resource = { url: 'https://support.livetoeat.app/ko' };

  it('treats browser close as a normal return without a read or consent result', async () => {
    await Promise.all(['cancel', 'dismiss', 'opened'].map((type) =>
      expect(openHelpResource(resource, async () => ({ type }))).resolves.toBeUndefined()));
  });

  it('rejects an unsafe destination before invoking the browser', async () => {
    const open = vi.fn();
    await expect(openHelpResource({ url: 'http://support.livetoeat.app' }, open)).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });

  it('shows a failure for a locked browser and retries the same destination after a launch error', async () => {
    const request = createRequest();
    const open = vi.fn().mockResolvedValueOnce({ type: 'locked' })
      .mockRejectedValueOnce(new Error('native browser unavailable'))
      .mockResolvedValueOnce({ type: 'opened' });
    const launch = () => request.run(() => openHelpResource(resource, open));
    expect(await launch()).toBe(false);
    expect(request.getSnapshot().error).toBe('unknown');
    expect(await launch()).toBe(false);
    expect(request.getSnapshot().error).toBe('unknown');
    expect(await launch()).toBe(true);
    expect(request.getSnapshot()).toEqual({ busy: false, error: null });
    expect(open.mock.calls).toEqual([[resource.url], [resource.url], [resource.url]]);
  });

  it('blocks duplicate launches and ignores completion after leaving the reader', async () => {
    const request = createRequest();
    let finish!: (value: { type: string }) => void;
    const open = vi.fn(() => new Promise<{ type: string }>((resolve) => { finish = resolve; }));
    const completed = vi.fn();
    const pending = request.run(() => openHelpResource(resource, open), completed);
    await request.run(() => openHelpResource(resource, open));
    expect(open).toHaveBeenCalledTimes(1);
    request.cancel();
    finish({ type: 'cancel' });
    await pending;
    expect(completed).not.toHaveBeenCalled();
    expect(request.getSnapshot()).toEqual({ busy: false, error: null });
  });
});
