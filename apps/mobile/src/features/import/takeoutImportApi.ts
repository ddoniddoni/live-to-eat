import { parseTakeoutSavedCsv, type ImportedRow, type TakeoutParseWarning } from '@live-to-eat/domain';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { strFromU8, Unzip, UnzipInflate } from 'fflate';

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 1_000;
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 1_000;

const zipEndOfCentralDirectory = 0x0605_4b50;
const zipCentralDirectoryHeader = 0x0201_4b50;
const zipLocalFileHeader = 0x0403_4b50;

export type TakeoutImportErrorCode =
  | 'CSV_MALFORMED'
  | 'INVALID_COLLECTION_NAME'
  | 'CSV_TOO_LARGE'
  | 'FILE_TOO_LARGE'
  | 'READ_FAILED'
  | 'TOO_MANY_FILES'
  | 'TOO_MANY_ROWS'
  | 'TOTAL_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'UNSUPPORTED_HEADER'
  | 'ZIP_ENCRYPTED'
  | 'ZIP_INVALID'
  | 'ZIP_NESTED'
  | 'ZIP_NO_SAVED_LIST'
  | 'ZIP_PATH_UNSAFE'
  | 'ZIP_UNSUPPORTED_COMPRESSION';

export type TakeoutPreviewWarning = Readonly<{
  code: TakeoutParseWarning['code'];
  rowNumber: number;
  sourceFileName: string;
}>;

export type TakeoutPreviewRow = Readonly<{
  row: ImportedRow;
  sourceFileName: string;
}>;

export type TakeoutPreview = Readonly<{
  files: ReadonlyArray<Readonly<{ name: string; size: number }>>;
  rows: TakeoutPreviewRow[];
  warnings: TakeoutPreviewWarning[];
}>;

type PickedFile = Readonly<{
  name: string;
  size: number;
  uri: string;
}>;

type LoadedCsv = Readonly<{
  contents: string;
  size: number;
}>;

type ZipEntry = Readonly<{
  name: string;
  uncompressedSize: number;
}>;

class TakeoutImportError extends Error {
  constructor(readonly code: TakeoutImportErrorCode) {
    super(code);
  }
}

const fail = (code: TakeoutImportErrorCode): never => {
  throw new TakeoutImportError(code);
};

const hasCsvExtension = (name: string): boolean => name.toLocaleLowerCase('en-US').endsWith('.csv');

const hasZipExtension = (name: string): boolean => name.toLocaleLowerCase('en-US').endsWith('.zip');

const isSafeZipPath = (name: string): boolean => {
  if (!name || name.includes('\u0000') || name.includes('\\') || name.startsWith('/') || name.startsWith('~')) {
    return false;
  }

  if (/^[a-z]:/iu.test(name)) {
    return false;
  }

  return !name.split('/').some((part) => part === '..' || part === '.');
};

const concatChunks = (chunks: Uint8Array[], size: number): Uint8Array => {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const findEndOfCentralDirectory = (bytes: Uint8Array): number | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = Math.max(0, bytes.byteLength - 65_557);

  for (let index = bytes.byteLength - 22; index >= start; index -= 1) {
    if (view.getUint32(index, true) !== zipEndOfCentralDirectory) continue;
    const commentLength = view.getUint16(index + 20, true);
    if (index + 22 + commentLength === bytes.byteLength) return index;
  }

  return undefined;
};

const inspectZip = (bytes: Uint8Array): ZipEntry[] => {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) fail('FILE_TOO_LARGE');
  if (bytes.byteLength < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail('ZIP_INVALID');

  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset === undefined) throw new TakeoutImportError('ZIP_INVALID');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endOffset + 6, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffff_ffff ||
    centralDirectoryOffset === 0xffff_ffff
  ) {
    fail('ZIP_INVALID');
  }

  if (entryCount > MAX_ARCHIVE_FILES || centralDirectoryOffset + centralDirectorySize > endOffset) {
    fail('TOO_MANY_FILES');
  }

  let offset = centralDirectoryOffset;
  let expandedBytes = 0;
  const csvEntries: ZipEntry[] = [];
  const entryNames = new Set<string>();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== zipCentralDirectoryHeader) fail('ZIP_INVALID');

    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;

    if (nextOffset > bytes.byteLength) fail('ZIP_INVALID');
    if (flags & 0x0001) fail('ZIP_ENCRYPTED');
    if (compression !== 0 && compression !== 8) fail('ZIP_UNSUPPORTED_COMPRESSION');

    const unixFileType = (externalAttributes >>> 16) & 0o170000;
    if (unixFileType === 0o120000) fail('ZIP_PATH_UNSAFE');

    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!isSafeZipPath(name)) fail('ZIP_PATH_UNSAFE');
    if (hasZipExtension(name)) fail('ZIP_NESTED');
    if (entryNames.has(name)) fail('ZIP_INVALID');
    entryNames.add(name);

    if (localHeaderOffset + 30 > centralDirectoryOffset || view.getUint32(localHeaderOffset, true) !== zipLocalFileHeader) {
      fail('ZIP_INVALID');
    }

    const localFlags = view.getUint16(localHeaderOffset + 6, true);
    const localCompression = view.getUint16(localHeaderOffset + 8, true);
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const localNameEnd = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (
      localNameEnd > centralDirectoryOffset ||
      localFlags & 0x0001 ||
      localCompression !== compression ||
      strFromU8(bytes.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength)) !== name
    ) {
      fail('ZIP_INVALID');
    }

    expandedBytes += uncompressedSize;
    if (expandedBytes > MAX_EXPANDED_BYTES) fail('TOTAL_TOO_LARGE');

    if (hasCsvExtension(name)) {
      if (uncompressedSize > MAX_CSV_BYTES) fail('CSV_TOO_LARGE');
      csvEntries.push({ name, uncompressedSize });
    }

    offset = nextOffset;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) fail('ZIP_INVALID');
  if (csvEntries.length === 0) fail('ZIP_NO_SAVED_LIST');

  return csvEntries;
};

const sourceKeyFor = (sourceFileName: string, sourceRowKey: string): string =>
  `takeout:${sourceFileName}:${sourceRowKey}`.slice(0, 256);

const addParsedCsv = (
  sourceFileName: string,
  csv: string,
  rows: TakeoutPreviewRow[],
  warnings: TakeoutPreviewWarning[],
): void => {
  const parsed = parseTakeoutSavedCsv(csv);
  if (parsed.success) {
    if (rows.length + parsed.rows.length > MAX_PREVIEW_ROWS) fail('TOO_MANY_ROWS');

    rows.push(
      ...parsed.rows.map((row) => ({
        row: Object.assign({}, row, { sourceRowKey: sourceKeyFor(sourceFileName, row.sourceRowKey) }),
        sourceFileName,
      })),
    );
    warnings.push(...parsed.warnings.map((warning) => Object.assign({}, warning, { sourceFileName })));
    return;
  }

  fail(parsed.failure.code);
};

const extractZipCsvs = (
  bytes: Uint8Array,
  entries: ZipEntry[],
  rows: TakeoutPreviewRow[],
  warnings: TakeoutPreviewWarning[],
): Promise<void> =>
  new Promise((resolve, reject) => {
    const expectedNames = new Set(entries.map((entry) => entry.name));
    let completeFiles = 0;
    let settled = false;

    const rejectOnce = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error instanceof TakeoutImportError ? error : new TakeoutImportError('ZIP_INVALID'));
    };

    const completeIfReady = (): void => {
      if (!settled && completeFiles === expectedNames.size) {
        settled = true;
        resolve();
      }
    };

    try {
      const unzip = new Unzip((entry) => {
        if (!expectedNames.has(entry.name)) return;

        let expandedSize = 0;
        const chunks: Uint8Array[] = [];
        entry.ondata = (error, chunk, final) => {
          if (settled) return;
          if (error) {
            rejectOnce(error);
            return;
          }

          expandedSize += chunk.byteLength;
          if (expandedSize > MAX_CSV_BYTES) {
            entry.terminate();
            rejectOnce(new TakeoutImportError('CSV_TOO_LARGE'));
            return;
          }

          chunks.push(chunk);
          if (!final) return;

          try {
            addParsedCsv(entry.name, strFromU8(concatChunks(chunks, expandedSize)), rows, warnings);
            completeFiles += 1;
            completeIfReady();
          } catch (parseError) {
            rejectOnce(parseError);
          }
        };
        entry.start();
      });
      unzip.register(UnzipInflate);
      unzip.push(bytes, true);
      completeIfReady();
    } catch (error) {
      rejectOnce(error);
    }
  });

const fileSize = (asset: DocumentPicker.DocumentPickerAsset): number => {
  const knownSize = asset.size ?? new File(asset.uri).size;
  return Number.isFinite(knownSize) && knownSize >= 0 ? knownSize : 0;
};

const selectedFiles = async (): Promise<PickedFile[] | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: [
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
      'application/vnd.ms-excel',
      'application/zip',
      'application/x-zip-compressed',
    ],
  });

  if (result.canceled) return null;
  if (result.assets.length === 0 || result.assets.length > MAX_ARCHIVE_FILES) fail('TOO_MANY_FILES');

  return result.assets.map((asset) => ({
    name: asset.name,
    size: fileSize(asset),
    uri: asset.uri,
  }));
};

const readCsv = async (file: PickedFile): Promise<LoadedCsv> => {
  if (!hasCsvExtension(file.name)) fail('UNSUPPORTED_FILE');
  if (file.size > MAX_CSV_BYTES) fail('CSV_TOO_LARGE');

  try {
    const bytes = new Uint8Array(await new File(file.uri).arrayBuffer());
    if (bytes.byteLength > MAX_CSV_BYTES) fail('CSV_TOO_LARGE');
    return { contents: strFromU8(bytes), size: bytes.byteLength };
  } catch (error) {
    if (error instanceof TakeoutImportError) throw error;
    throw new TakeoutImportError('READ_FAILED');
  }
};

const readZipBytes = async (file: PickedFile): Promise<Uint8Array> => {
  try {
    return new Uint8Array(await new File(file.uri).arrayBuffer());
  } catch {
    throw new TakeoutImportError('READ_FAILED');
  }
};

const previewZip = async (
  file: PickedFile,
  rows: TakeoutPreviewRow[],
  warnings: TakeoutPreviewWarning[],
): Promise<ReadonlyArray<Readonly<{ name: string; size: number }>>> => {
  if (file.size > MAX_ARCHIVE_BYTES) fail('FILE_TOO_LARGE');

  const bytes = await readZipBytes(file);

  const entries = inspectZip(bytes);
  await extractZipCsvs(bytes, entries, rows, warnings);
  return entries.map((entry) => ({ name: entry.name, size: entry.uncompressedSize }));
};

export const pickAndPreviewTakeout = async (): Promise<TakeoutPreview | null> => {
  const files = await selectedFiles();
  if (!files) return null;

  const zipFiles = files.filter((file) => hasZipExtension(file.name));
  if (zipFiles.length > 0 && files.length > 1) fail('UNSUPPORTED_FILE');
  if (files.some((file) => !hasCsvExtension(file.name) && !hasZipExtension(file.name))) fail('UNSUPPORTED_FILE');

  const rows: TakeoutPreviewRow[] = [];
  const warnings: TakeoutPreviewWarning[] = [];

  if (zipFiles.length === 1) {
    const zip = zipFiles[0];
    if (!zip) throw new TakeoutImportError('UNSUPPORTED_FILE');
    return { files: await previewZip(zip, rows, warnings), rows, warnings };
  }

  let directCsvBytes = 0;
  for (const file of files) {
    // oxlint-disable-next-line no-await-in-loop -- Process one user file at a time to retain the import memory bound.
    const csv = await readCsv(file);
    directCsvBytes += csv.size;
    if (directCsvBytes > MAX_EXPANDED_BYTES) fail('TOTAL_TOO_LARGE');
    addParsedCsv(file.name, csv.contents, rows, warnings);
  }

  return { files: files.map(({ name, size }) => ({ name, size })), rows, warnings };
};

export const isTakeoutImportError = (error: unknown): error is TakeoutImportError => error instanceof TakeoutImportError;
