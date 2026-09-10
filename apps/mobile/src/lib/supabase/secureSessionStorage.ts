import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const MANIFEST_SUFFIX = ':manifest';
const CHUNK_BYTE_LIMIT = 1_800;

type SessionManifest = {
  byteLength: number;
  chunkCount: number;
  generation: string;
  version: 1;
};

const encoder = new TextEncoder();

const isSessionManifest = (value: unknown): value is SessionManifest => {
  if (!value || typeof value !== 'object') return false;

  const manifest = value as Record<string, unknown>;
  return (
    manifest.version === 1 &&
    typeof manifest.generation === 'string' &&
    manifest.generation.length > 0 &&
    typeof manifest.chunkCount === 'number' &&
    Number.isInteger(manifest.chunkCount) &&
    manifest.chunkCount > 0 &&
    typeof manifest.byteLength === 'number' &&
    Number.isInteger(manifest.byteLength) &&
    manifest.byteLength >= 0
  );
};

const manifestKey = (key: string): string => `${key}${MANIFEST_SUFFIX}`;

const chunkKey = (key: string, generation: string, index: number): string =>
  `${key}:${generation}:chunk:${index}`;

const splitUtf8 = (value: string): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentByteLength = 0;

  for (const character of value) {
    const characterByteLength = encoder.encode(character).byteLength;

    if (currentChunk && currentByteLength + characterByteLength > CHUNK_BYTE_LIMIT) {
      chunks.push(currentChunk);
      currentChunk = '';
      currentByteLength = 0;
    }

    currentChunk += character;
    currentByteLength += characterByteLength;
  }

  return chunks.length > 0 ? [...chunks, currentChunk] : [value];
};

const readManifest = async (key: string): Promise<SessionManifest | null> => {
  const rawManifest = await SecureStore.getItemAsync(manifestKey(key));
  if (!rawManifest) return null;

  try {
    const parsedManifest: unknown = JSON.parse(rawManifest);
    return isSessionManifest(parsedManifest) ? parsedManifest : null;
  } catch {
    return null;
  }
};

const removeChunks = async (key: string, manifest: SessionManifest): Promise<void> => {
  await Promise.allSettled(
    Array.from({ length: manifest.chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index)),
    ),
  );
};

const discardGeneration = async (key: string, generation: string, chunkCount: number): Promise<void> => {
  await Promise.allSettled(
    Array.from({ length: chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, generation, index)),
    ),
  );
};

const removeStoredItem = async (key: string): Promise<void> => {
  const manifest = await readManifest(key);
  await SecureStore.deleteItemAsync(manifestKey(key));
  if (manifest) await removeChunks(key, manifest);
};

/**
 * Encrypted storage for Supabase sessions. SecureStore values are deliberately kept below
 * the conservative per-item limit. A manifest is written last, so an interrupted write still
 * leaves the previous complete session available rather than a partial replacement.
 */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await readManifest(key);
    if (!manifest) return null;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, manifest.generation, index)),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      await removeStoredItem(key);
      return null;
    }

    const value = chunks.join('');
    if (encoder.encode(value).byteLength !== manifest.byteLength) {
      await removeStoredItem(key);
      return null;
    }

    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousManifest = await readManifest(key);
    const generation = Crypto.randomUUID();
    const chunks = splitUtf8(value);

    try {
      await Promise.all(
        chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, generation, index), chunk)),
      );

      const nextManifest: SessionManifest = {
        byteLength: encoder.encode(value).byteLength,
        chunkCount: chunks.length,
        generation,
        version: 1,
      };
      await SecureStore.setItemAsync(manifestKey(key), JSON.stringify(nextManifest));
    } catch (error) {
      await discardGeneration(key, generation, chunks.length);
      throw error;
    }

    if (previousManifest) await removeChunks(key, previousManifest);
  },

  async removeItem(key: string): Promise<void> {
    await removeStoredItem(key);
  },
};
