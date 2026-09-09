import { z } from 'zod';

export const visibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof visibilitySchema>;

export const visitStatusSchema = z.enum(['want', 'visited']);
export type VisitStatus = z.infer<typeof visitStatusSchema>;

export const importedRowSchema = z.object({
  sourceRowKey: z.string().min(1).max(256),
  sourceKind: z.enum(['takeout_saved_csv', 'app_json_v1', 'google_url']),
  collectionName: z.string().max(200).optional(),
  inputTitle: z.string().max(500).optional(),
  inputUrl: z.url().optional(),
  ownNote: z.string().max(10_000).optional(),
  inputTags: z.array(z.string().max(100)).max(100).optional(),
  explicitRegionId: z.uuid().optional(),
  explicitPlaceId: z.string().max(512).optional(),
});

export type ImportedRow = z.infer<typeof importedRowSchema>;

export const sharedLinkPayloadSchema = z.object({
  id: z.string().min(1).max(128),
  mimeType: z.string().min(1).max(100),
  receivedAt: z.number().int().nonnegative(),
  type: z.enum(['text', 'url']),
  value: z.string().min(1).max(10_000),
});

export type SharedLinkPayload = z.infer<typeof sharedLinkPayloadSchema>;

export type SharedPlaceInboxCandidate = Readonly<{
  host: string;
  payloadId: string;
  receivedAt: number;
  row: ImportedRow;
}>;

export type SharedPlaceInboxResult = Readonly<{
  candidates: SharedPlaceInboxCandidate[];
  clearPayloadIds: string[];
}>;

export const shareInboxRetentionMs = 7 * 24 * 60 * 60 * 1_000;

const takeoutColumnAliases = {
  inputTitle: new Set(['title']),
  inputUrl: new Set(['item_content_url', 'url']),
  ownNote: new Set(['note']),
  inputTags: new Set(['tags']),
  comment: new Set(['comment']),
} as const;

type TakeoutColumn = keyof typeof takeoutColumnAliases;

export type TakeoutParseWarning = Readonly<{
  code: 'ROW_INVALID' | 'ROW_MISSING_PLACE_INPUT' | 'ROW_URL_IGNORED';
  rowNumber: number;
}>;

export type TakeoutParseFailure = Readonly<{
  code: 'CSV_MALFORMED' | 'INVALID_COLLECTION_NAME' | 'UNSUPPORTED_HEADER';
  rowNumber?: number;
}>;

export type TakeoutParseResult =
  | Readonly<{
      headerRowNumber: number;
      rows: ImportedRow[];
      success: true;
      warnings: TakeoutParseWarning[];
    }>
  | Readonly<{
      failure: TakeoutParseFailure;
      success: false;
    }>;

type CsvRecord = Readonly<{
  cells: string[];
  rowNumber: number;
}>;

type CsvParseResult =
  | Readonly<{ records: CsvRecord[]; success: true }>
  | Readonly<{ failure: TakeoutParseFailure; success: false }>;

const optionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeHeader = (value: string): string =>
  value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_');

const parseCsvRecords = (csv: string): CsvParseResult => {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let isCellStart = true;
  let justClosedQuote = false;
  let rowNumber = 1;

  const finishCell = () => {
    cells.push(currentCell);
    currentCell = '';
    isCellStart = true;
    justClosedQuote = false;
  };

  const finishRecord = () => {
    finishCell();
    records.push({ cells, rowNumber });
    cells = [];
    rowNumber += 1;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (inQuotes && csv[index + 1] === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (inQuotes) {
        inQuotes = false;
        isCellStart = false;
        justClosedQuote = true;
        continue;
      }

      if (isCellStart) {
        inQuotes = true;
        continue;
      }

      return { failure: { code: 'CSV_MALFORMED', rowNumber }, success: false };
    }

    if (!inQuotes && character === ',') {
      finishCell();
      continue;
    }

    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }
      finishRecord();
      continue;
    }

    if (!inQuotes && justClosedQuote) {
      return { failure: { code: 'CSV_MALFORMED', rowNumber }, success: false };
    }

    currentCell += character;
    isCellStart = false;
  }

  if (inQuotes) {
    return { failure: { code: 'CSV_MALFORMED', rowNumber }, success: false };
  }

  if (cells.length > 0 || currentCell.length > 0) {
    finishRecord();
  }

  return { records, success: true };
};

const findHeader = (records: CsvRecord[]): { columns: Map<TakeoutColumn, number>; index: number } | undefined => {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || index >= 20) {
      break;
    }

    const columns = new Map<TakeoutColumn, number>();
    record.cells.forEach((cell, columnIndex) => {
      const normalized = normalizeHeader(cell);
      for (const [column, aliases] of Object.entries(takeoutColumnAliases) as Array<
        [TakeoutColumn, Set<string>]
      >) {
        if (aliases.has(normalized) && !columns.has(column)) {
          columns.set(column, columnIndex);
        }
      }
    });

    if (columns.has('inputTitle') || columns.has('inputUrl')) {
      return { columns, index };
    }
  }

  return undefined;
};

const valueFor = (record: CsvRecord, columns: Map<TakeoutColumn, number>, column: TakeoutColumn): string | undefined => {
  const index = columns.get(column);
  return index === undefined ? undefined : record.cells[index];
};

const parseTags = (value: string | undefined): string[] | undefined => {
  const tags = value
    ?.split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!tags?.length) {
    return undefined;
  }

  return [...new Set(tags)];
};

const validUrl = (value: string | undefined): string | undefined => {
  const result = value ? z.url().safeParse(value.trim()) : undefined;
  return result?.success ? result.data : undefined;
};

type SharedHttpUrl = Readonly<{
  host: string;
  inputUrl: string;
}>;

const sharedHttpUrlPattern = /^https?:\/\/(?:[^/@\s]+@)?(\[[^\]]+\]|[^/:?#\s]+)(?::\d+)?(?:[/?#]|$)/iu;

const httpUrlFromSharedValue = (value: string): SharedHttpUrl | undefined => {
  const direct = value.trim();
  const candidates = [direct, ...direct.split(/\s+/u)];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = z.url().safeParse(candidate);
    if (!parsed.success) {
      continue;
    }

    const match = sharedHttpUrlPattern.exec(parsed.data);
    const host = match?.[1];
    if (host) {
      return {
        host: host.toLocaleLowerCase('en-US'),
        inputUrl: parsed.data,
      };
    }
  }

  return undefined;
};

const stableShareUrlKey = (url: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Converts only a received HTTP(S) link into the same confirmation input used
 * by manual Google-link paste. It deliberately does not follow redirects or
 * derive a Google Place ID; server-side validation owns those operations.
 */
export const prepareSharedPlaceInbox = (
  payloads: readonly unknown[],
  options: Readonly<{ now?: number }> = {},
): SharedPlaceInboxResult => {
  const now = options.now ?? Date.now();
  const candidates: SharedPlaceInboxCandidate[] = [];
  const clearPayloadIds: string[] = [];
  const seenSourceRowKeys = new Set<string>();

  for (const rawPayload of payloads) {
    const payload = sharedLinkPayloadSchema.safeParse(rawPayload);
    if (!payload.success) {
      continue;
    }

    if (payload.data.receivedAt + shareInboxRetentionMs < now) {
      clearPayloadIds.push(payload.data.id);
      continue;
    }

    const url = httpUrlFromSharedValue(payload.data.value);
    if (!url) {
      clearPayloadIds.push(payload.data.id);
      continue;
    }

    const sourceRowKey = `google_url:${stableShareUrlKey(url.inputUrl)}`;
    if (seenSourceRowKeys.has(sourceRowKey)) {
      clearPayloadIds.push(payload.data.id);
      continue;
    }

    const row = importedRowSchema.safeParse({
      inputUrl: url.inputUrl,
      sourceKind: 'google_url',
      sourceRowKey,
    });
    if (!row.success) {
      clearPayloadIds.push(payload.data.id);
      continue;
    }

    seenSourceRowKeys.add(sourceRowKey);
    candidates.push({
      host: url.host,
      payloadId: payload.data.id,
      receivedAt: payload.data.receivedAt,
      row: row.data,
    });
  }

  return { candidates, clearPayloadIds };
};

export const parseTakeoutSavedCsv = (
  csv: string,
  options: Readonly<{ collectionName?: string }> = {},
): TakeoutParseResult => {
  const collectionName = optionalText(options.collectionName);
  if (collectionName && collectionName.length > 200) {
    return { failure: { code: 'INVALID_COLLECTION_NAME' }, success: false };
  }

  const parsed = parseCsvRecords(csv);
  if (!parsed.success) {
    return parsed;
  }

  const header = findHeader(parsed.records);
  if (!header) {
    return { failure: { code: 'UNSUPPORTED_HEADER' }, success: false };
  }

  const rows: ImportedRow[] = [];
  const warnings: TakeoutParseWarning[] = [];

  for (const record of parsed.records.slice(header.index + 1)) {
    if (!record.cells.some((cell) => optionalText(cell))) {
      continue;
    }

    const inputTitle = optionalText(valueFor(record, header.columns, 'inputTitle'));
    const rawUrl = optionalText(valueFor(record, header.columns, 'inputUrl'));
    const inputUrl = validUrl(rawUrl);
    if (rawUrl && !inputUrl) {
      warnings.push({ code: 'ROW_URL_IGNORED', rowNumber: record.rowNumber });
    }

    if (!inputTitle && !inputUrl) {
      warnings.push({ code: 'ROW_MISSING_PLACE_INPUT', rowNumber: record.rowNumber });
      continue;
    }

    const note = optionalText(valueFor(record, header.columns, 'ownNote'));
    const comment = optionalText(valueFor(record, header.columns, 'comment'));
    const ownNote = [note, comment].filter((value): value is string => Boolean(value)).join('\n\n') || undefined;

    const candidate = {
      collectionName,
      inputTags: parseTags(valueFor(record, header.columns, 'inputTags')),
      inputTitle,
      inputUrl,
      ownNote,
      sourceKind: 'takeout_saved_csv' as const,
      sourceRowKey: `takeout_saved_csv:${record.rowNumber}`,
    };

    const normalized = importedRowSchema.safeParse(candidate);
    if (!normalized.success) {
      warnings.push({ code: 'ROW_INVALID', rowNumber: record.rowNumber });
      continue;
    }

    rows.push(normalized.data);
  }

  return {
    headerRowNumber: parsed.records[header.index]?.rowNumber ?? 1,
    rows,
    success: true,
    warnings,
  };
};

export type NewSavedPlace = Readonly<{
  isRecommended: false;
  visibility: 'private';
  visitStatus: 'want';
}>;

export const createNewSavedPlace = (): NewSavedPlace => ({
  isRecommended: false,
  visibility: 'private',
  visitStatus: 'want',
});

export const canRecommend = (visitStatus: VisitStatus): boolean => visitStatus === 'visited';
