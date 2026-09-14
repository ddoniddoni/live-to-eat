import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequest, RequestFailure } from './request';
import { createDemoFailures } from '@/features/notebook/demoRequests';
afterEach(() => vi.useRealTimers());

describe('request lifecycle', () => {
  it('keeps a slow write locked instead of retrying an unconfirmed mutation', async () => {
    vi.useFakeTimers();
    const task = createRequest<void>();
    let finish!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const result = task.run(write);
    await vi.advanceTimersByTimeAsync(60000);
    expect(task.getSnapshot().busy).toBe(true);
    expect(await task.run(write)).toBe(false);
    finish();
    await result;
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('blocks duplicate taps before React has rendered a loading state', async () => {
    const task = createRequest<void>();
    let finish!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const success = vi.fn();
    const first = task.run(write, success);
    expect(await task.run(write, success)).toBe(false);
    finish();
    expect(await first).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledTimes(1);
  });
  it('preserves a newer search and ignores late completion of the old one', async () => {
    const task = createRequest<string>({ latest: true });
    let finish!: (value: string) => void;
    const success = vi.fn();
    const old = task.run(() => new Promise((resolve) => { finish = resolve; }), success);
    await task.run(async () => 'new region', success);
    finish('old region');
    await old;
    expect(success.mock.calls).toEqual([['new region']]);
  });
  it('times out a hanging read and permits retry without accepting its late response', async () => {
    vi.useFakeTimers();
    const task = createRequest<string>({ latest: true, timeoutMs: 100 });
    let finish!: (value: string) => void;
    const success = vi.fn();
    const old = task.run(() => new Promise((resolve) => { finish = resolve; }), success);
    await vi.advanceTimersByTimeAsync(100);
    expect(await old).toBe(false);
    expect(task.getSnapshot()).toEqual({ busy: false, error: 'timeout' });
    await task.run(async () => 'retry', success);
    finish('late');
    await Promise.resolve();
    expect(success.mock.calls).toEqual([['retry']]);
    expect(task.getSnapshot().error).toBeNull();
  });
  it('suppresses callbacks and errors after closing a screen', async () => {
    const task = createRequest<string>();
    let fail!: (error: Error) => void;
    const success = vi.fn();
    const result = task.run(() => new Promise((_, reject) => { fail = reject; }), success);
    task.cancel();
    fail(new Error('late error'));
    expect(await result).toBe(false);
    expect(success).not.toHaveBeenCalled();
    expect(task.getSnapshot()).toEqual({ busy: false, error: null });
  });
  it('reports known failures without exposing raw errors and supports a successful retry', async () => {
    const task = createRequest<void>();
    await task.run(async () => { throw new RequestFailure('offline'); });
    expect(task.getSnapshot().error).toBe('offline');
    await task.run(async () => { throw new Error('private server details'); });
    expect(task.getSnapshot().error).toBe('unknown');
    expect(await task.run(async () => {})).toBe(true);
    expect(task.getSnapshot().error).toBeNull();
  });
  it('only injects explicitly enabled one-shot demo failures', async () => {
    const disabled = createDemoFailures('save:storage', false);
    await disabled('save');
    const enabled = createDemoFailures('search:offline,save:storage', true);
    await expect(enabled('search')).rejects.toMatchObject({ kind: 'offline' });
    await enabled('search');
    await expect(enabled('save')).rejects.toMatchObject({ kind: 'storage' });
    await enabled('save');
  });
});
