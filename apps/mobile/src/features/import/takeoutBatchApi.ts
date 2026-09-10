import * as Crypto from 'expo-crypto';

import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import type { TakeoutPreview, TakeoutPreviewRow } from '@/features/import/takeoutImportApi';
import type { PlaceSearchCandidate } from '@/features/places/placeSearchApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

export type TakeoutImportRowState = 'pending' | 'saved' | 'duplicate' | 'skipped';

export type TakeoutImportBatch = Readonly<{
  id: string;
  isPreview: boolean;
  stateBySourceRowKey: Readonly<Record<string, TakeoutImportRowState>>;
}>;

type BeginBatchResponse = {
  batch_id?: unknown;
  batch_state?: unknown;
};

type ListRowsResponse = {
  result_saved_id?: unknown;
  row_state?: unknown;
  source_row_key?: unknown;
};

type CommitRowResponse = {
  result_state?: unknown;
  saved_id?: unknown;
};

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const isRowState = (value: unknown): value is TakeoutImportRowState =>
  value === 'pending' || value === 'saved' || value === 'duplicate' || value === 'skipped';

const firstResult = <T extends object>(value: unknown): T | undefined =>
  Array.isArray(value) && value[0] && typeof value[0] === 'object' ? (value[0] as T) : undefined;

const stableDigestInput = (preview: TakeoutPreview): string =>
  JSON.stringify(
    preview.rows.map(({ row, sourceFileName }) => ({
      collectionName: row.collectionName,
      explicitPlaceId: row.explicitPlaceId,
      explicitRegionId: row.explicitRegionId,
      inputTags: row.inputTags,
      inputTitle: row.inputTitle,
      inputUrl: row.inputUrl,
      ownNote: row.ownNote,
      sourceFileName,
      sourceKind: row.sourceKind,
      sourceRowKey: row.sourceRowKey,
    })),
  );

const digestPreview = async (preview: TakeoutPreview): Promise<string> =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, stableDigestInput(preview));

const toStateMap = (rows: unknown): Record<string, TakeoutImportRowState> => {
  if (!Array.isArray(rows)) throw new AuthFlowError('REQUEST_FAILED');

  return rows.reduce<Record<string, TakeoutImportRowState>>((result, item) => {
    const row = item as ListRowsResponse;
    if (typeof row.source_row_key !== 'string' || !isRowState(row.row_state)) {
      throw new AuthFlowError('REQUEST_FAILED');
    }

    result[row.source_row_key] = row.row_state;
    return result;
  }, {});
};

const normalizedInputFor = (previewRow: TakeoutPreviewRow): Record<string, unknown> => {
  const { row } = previewRow;
  const input: Record<string, unknown> = { input_tags: row.inputTags ?? [] };

  if (row.inputTitle) input.input_title = row.inputTitle;
  if (row.inputUrl) input.input_url = row.inputUrl;
  if (row.ownNote) input.own_note = row.ownNote;

  return input;
};

export const beginTakeoutImport = async (preview: TakeoutPreview): Promise<TakeoutImportBatch> => {
  const digest = await digestPreview(preview);

  if (isAuthPreviewMode()) {
    return {
      id: `preview-import-${digest.slice(0, 12)}`,
      isPreview: true,
      stateBySourceRowKey: {},
    };
  }

  const { data, error } = await configuredClient().rpc('begin_takeout_import_batch', {
    batch_id_input: Crypto.randomUUID(),
    input_digest_input: digest,
    parser_version_input: 'takeout_csv_v1',
  });
  if (error) throw toAuthFailure(error);

  const batch = firstResult<BeginBatchResponse>(data);
  if (!batch || typeof batch.batch_id !== 'string' || batch.batch_state !== 'active') {
    throw new AuthFlowError('REQUEST_FAILED');
  }

  const { data: rows, error: rowsError } = await configuredClient().rpc('list_takeout_import_rows', {
    batch_id_input: batch.batch_id,
  });
  if (rowsError) throw toAuthFailure(rowsError);

  return {
    id: batch.batch_id,
    isPreview: false,
    stateBySourceRowKey: toStateMap(rows),
  };
};

export const commitTakeoutImportRow = async ({
  batch,
  candidate,
  previewRow,
  regionId,
}: {
  batch: TakeoutImportBatch;
  candidate: PlaceSearchCandidate;
  previewRow: TakeoutPreviewRow;
  regionId: string | null;
}): Promise<TakeoutImportRowState> => {
  if (batch.isPreview) return 'saved';
  if (candidate.isPreview) throw new AuthFlowError('REQUEST_FAILED');

  const { row } = previewRow;
  const { data, error } = await configuredClient().rpc('commit_takeout_import_row', {
    batch_id_input: batch.id,
    input_title_input: row.inputTitle ?? null,
    input_url_input: row.inputUrl ?? null,
    personal_note_input: row.ownNote ?? null,
    region_id_input: regionId,
    search_ticket_id: candidate.ticket,
    source_row_key_input: row.sourceRowKey,
    tags_input: row.inputTags ?? [],
  });
  if (error) throw toAuthFailure(error);

  const result = firstResult<CommitRowResponse>(data);
  if (!result || typeof result.saved_id !== 'string' || (result.result_state !== 'saved' && result.result_state !== 'duplicate')) {
    throw new AuthFlowError('REQUEST_FAILED');
  }

  return result.result_state;
};

export const skipTakeoutImportRow = async ({
  batch,
  previewRow,
}: {
  batch: TakeoutImportBatch;
  previewRow: TakeoutPreviewRow;
}): Promise<TakeoutImportRowState> => {
  if (batch.isPreview) return 'skipped';

  const { data, error } = await configuredClient().rpc('skip_takeout_import_row', {
    batch_id_input: batch.id,
    normalized_input: normalizedInputFor(previewRow),
    source_row_key_input: previewRow.row.sourceRowKey,
  });
  if (error) throw toAuthFailure(error);
  if (!isRowState(data)) throw new AuthFlowError('REQUEST_FAILED');

  return data;
};

export const cancelTakeoutImport = async (batch: TakeoutImportBatch): Promise<void> => {
  if (batch.isPreview) return;

  const { error } = await configuredClient().rpc('cancel_takeout_import_batch', { batch_id_input: batch.id });
  if (error) throw toAuthFailure(error);
};
