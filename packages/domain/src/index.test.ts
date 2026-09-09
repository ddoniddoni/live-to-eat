import { describe, expect, it } from 'vitest';

import {
  canRecommend,
  createNewSavedPlace,
  importedRowSchema,
  parseTakeoutSavedCsv,
  prepareSharedPlaceInbox,
  shareInboxRetentionMs,
} from './index';

describe('saved place defaults', () => {
  it('starts private and unvisited', () => {
    expect(createNewSavedPlace()).toEqual({
      isRecommended: false,
      visibility: 'private',
      visitStatus: 'want',
    });
  });

  it('allows recommendations only for visited places', () => {
    expect(canRecommend('want')).toBe(false);
    expect(canRecommend('visited')).toBe(true);
  });
});

describe('imported row contract', () => {
  it('rejects unknown fields instead of guessing their meaning', () => {
    const result = importedRowSchema.strict().safeParse({
      sourceRowKey: 'takeout:0',
      sourceKind: 'takeout_saved_csv',
      guessedLatitude: 37.5,
    });

    expect(result.success).toBe(false);
  });
});

describe('Google Takeout saved CSV parser', () => {
  it('skips a description and blank row, then preserves quoted personal input', () => {
    const result = parseTakeoutSavedCsv(
      'Saved places from a private list\n\n\uFEFFTitle,URL,Note,Tags,Comment\n"Cafe, Green",https://maps.google.com/?q=cafe,"Window seat\nPlease return",coffee;bakery,"Only for me"',
      { collectionName: 'Seoul weekend' },
    );

    expect(result).toEqual({
      headerRowNumber: 3,
      rows: [
        {
          collectionName: 'Seoul weekend',
          inputTags: ['coffee', 'bakery'],
          inputTitle: 'Cafe, Green',
          inputUrl: 'https://maps.google.com/?q=cafe',
          ownNote: 'Window seat\nPlease return\n\nOnly for me',
          sourceKind: 'takeout_saved_csv',
          sourceRowKey: 'takeout_saved_csv:4',
        },
      ],
      success: true,
      warnings: [],
    });
  });

  it('keeps a title when a malformed URL cannot be trusted', () => {
    const result = parseTakeoutSavedCsv('Title,URL\nBlue Bottle,not a URL');

    expect(result).toEqual({
      headerRowNumber: 1,
      rows: [
        {
          inputTitle: 'Blue Bottle',
          sourceKind: 'takeout_saved_csv',
          sourceRowKey: 'takeout_saved_csv:2',
        },
      ],
      success: true,
      warnings: [{ code: 'ROW_URL_IGNORED', rowNumber: 2 }],
    });
  });

  it('rejects an unsupported header rather than guessing its meaning', () => {
    expect(parseTakeoutSavedCsv('장소,주소\n카페,서울')).toEqual({
      failure: { code: 'UNSUPPORTED_HEADER' },
      success: false,
    });
  });

  it('rejects malformed quoted CSV before normalizing any rows', () => {
    expect(parseTakeoutSavedCsv('Title,URL\n"Cafe,https://maps.google.com')).toEqual({
      failure: { code: 'CSV_MALFORMED', rowNumber: 2 },
      success: false,
    });

    expect(parseTakeoutSavedCsv('Title\n"Cafe" has trailing text')).toEqual({
      failure: { code: 'CSV_MALFORMED', rowNumber: 2 },
      success: false,
    });
  });
});

describe('shared place inbox', () => {
  it('normalizes a shared HTTPS URL without resolving it or deriving a place ID', () => {
    const result = prepareSharedPlaceInbox(
      [
        {
          id: 'share-1',
          mimeType: 'text/plain',
          receivedAt: 1_000,
          type: 'url',
          value: 'https://maps.app.goo.gl/Example?cid=123',
        },
      ],
      { now: 2_000 },
    );

    expect(result.clearPayloadIds).toEqual([]);
    expect(result.candidates).toEqual([
      {
        host: 'maps.app.goo.gl',
        payloadId: 'share-1',
        receivedAt: 1_000,
        row: {
          inputUrl: 'https://maps.app.goo.gl/Example?cid=123',
          sourceKind: 'google_url',
          sourceRowKey: 'google_url:2752ff49',
        },
      },
    ]);
  });

  it('keeps one candidate for the same URL and clears the duplicate payload', () => {
    const result = prepareSharedPlaceInbox(
      [
        {
          id: 'share-1',
          mimeType: 'text/plain',
          receivedAt: 1_000,
          type: 'text',
          value: 'Try https://maps.google.com/?q=coffee today',
        },
        {
          id: 'share-2',
          mimeType: 'text/plain',
          receivedAt: 2_000,
          type: 'url',
          value: 'https://maps.google.com/?q=coffee',
        },
      ],
      { now: 3_000 },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.clearPayloadIds).toEqual(['share-2']);
  });

  it('clears expired and non-HTTP(S) payloads without creating an import row', () => {
    const now = 20 * shareInboxRetentionMs;
    const result = prepareSharedPlaceInbox(
      [
        {
          id: 'old',
          mimeType: 'text/plain',
          receivedAt: now - shareInboxRetentionMs - 1,
          type: 'url',
          value: 'https://maps.google.com/?q=old',
        },
        {
          id: 'file',
          mimeType: 'text/plain',
          receivedAt: now,
          type: 'url',
          value: 'file:///private/place',
        },
      ],
      { now },
    );

    expect(result).toEqual({ candidates: [], clearPayloadIds: ['old', 'file'] });
  });
});
