import { beforeEach, describe, expect, it, vi } from 'vitest';
const disk = vi.hoisted(() => ({ files: new Map<string, string>(), failMove: false }));
vi.mock('expo-file-system', () => ({
  Paths: { document: 'document' },
  File: class {
    path: string;
    constructor(parent: string, name: string) {
      this.path = `${parent}/${name}`;
    }
    get exists() {
      return disk.files.has(this.path);
    }
    async text() {
      return disk.files.get(this.path);
    }
    write(value: string) {
      disk.files.set(this.path, value);
    }
    async move(destination: { path: string }, options?: { overwrite?: boolean }) {
      await Promise.resolve();
      if (disk.failMove) throw new Error('Move failed');
      if (disk.files.has(destination.path) && !options?.overwrite) throw new Error('Destination exists');
      disk.files.set(destination.path, disk.files.get(this.path)!);
      disk.files.delete(this.path);
    }
  },
}));
import { readDemo, writeDemo } from './demoStorage';
import { createDemoNotebook } from './demoData';
beforeEach(() => {
  disk.files.clear();
  disk.failMove = false;
});
describe('device demo storage', () => {
  it('retains the newest edit across repeated saves and reloads', async () => {
    const original = createDemoNotebook();
    await writeDemo(original);
    const updated = { ...original, profile: { ...original.profile, displayName: 'Changed' } };
    await writeDemo(updated);
    expect((await readDemo())?.profile.displayName).toBe('Changed');
  });
  it('propagates asynchronous persistence failures and keeps the prior file', async () => {
    const original = createDemoNotebook();
    await writeDemo(original);
    disk.failMove = true;
    await expect(writeDemo({ ...original, welcomed: true })).rejects.toThrow('Move failed');
    expect((await readDemo())?.welcomed).toBe(false);
  });
  it('rejects damaged data instead of silently replacing saved records', async () => {
    disk.files.set('document/livetoeat-demo-v1.json', '{"version":99}');
    await expect(readDemo()).rejects.toThrow();
  });
});
