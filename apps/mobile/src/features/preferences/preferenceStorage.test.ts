import { beforeEach, describe, expect, it, vi } from 'vitest';
const disk = vi.hoisted(() => ({ files: new Map<string, string>(), failMove: false }));
vi.mock('expo-file-system', () => ({
  Paths: { document: 'document' },
  File: class {
    path: string;
    constructor(parent: string, name: string) { this.path = `${parent}/${name}`; }
    get exists() { return disk.files.has(this.path); }
    async text() { return disk.files.get(this.path); }
    write(raw: string) { disk.files.set(this.path, raw); }
    async move(destination: { path: string }, options?: { overwrite?: boolean }) {
      await Promise.resolve();
      if (disk.failMove) throw new Error('Move failed');
      if (disk.files.has(destination.path) && !options?.overwrite) throw new Error('Destination exists');
      disk.files.set(destination.path, disk.files.get(this.path)!);
      disk.files.delete(this.path);
    }
  },
}));
import { preferenceStorage } from './preferenceStorage';
import { preferenceStorage as webStorage } from './preferenceStorage.web';

beforeEach(() => { disk.files.clear(); disk.failMove = false; });
describe('view preferences device adapters', () => {
  it('keeps account A, account B, demo and the notebook in separate files', async () => {
    disk.files.set('document/livetoeat-demo-v1.json', 'notebook remains intact');
    const a = preferenceStorage('account-a');
    const b = preferenceStorage('account-b');
    const demo = preferenceStorage('demo');
    await Promise.all([a.write('A'), b.write('B'), demo.write('Demo')]);
    expect(await preferenceStorage('account-a').read()).toBe('A');
    expect(await b.read()).toBe('B');
    expect(await demo.read()).toBe('Demo');
    expect(disk.files.get('document/livetoeat-demo-v1.json')).toBe('notebook remains intact');
  });
  it('preserves the previous file if replacement fails and permits a later retry', async () => {
    const storage = preferenceStorage('demo');
    expect(await storage.read()).toBeNull();
    await storage.write('before');
    disk.failMove = true;
    await expect(storage.write('after')).rejects.toThrow('Move failed');
    expect(await storage.read()).toBe('before');
    disk.failMove = false;
    await storage.write('after');
    expect(await storage.read()).toBe('after');
  });
  it('scopes web settings identically and propagates unavailable storage', async () => {
    const values = new Map<string, string>();
    const local = { getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, raw: string) => { values.set(key, raw); }) };
    vi.stubGlobal('localStorage', local);
    try {
      await webStorage('account-a').write('A');
      expect(await webStorage('account-b').read()).toBeNull();
      expect(await webStorage('account-a').read()).toBe('A');
      local.getItem.mockImplementationOnce(() => { throw new Error('blocked'); });
      await expect(webStorage('account-a').read()).rejects.toThrow('blocked');
      expect(await webStorage('account-a').read()).toBe('A');
    } finally { vi.unstubAllGlobals(); }
  });
});
