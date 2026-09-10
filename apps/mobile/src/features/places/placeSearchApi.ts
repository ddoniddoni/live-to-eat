import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import type { PrivateCollection } from '@/features/places/collectionsApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

export type PlaceSearchCandidate = {
  address: string;
  displayName: string;
  isPreview: boolean;
  primaryType: string | null;
  ticket: string;
};

export type SavedPlaceDraft = {
  address: string;
  collectionId: string | null;
  collectionName: string | null;
  displayName: string;
  isRecommended: boolean;
  note: string;
  savedId: string;
  tags: string[];
  visitStatus: 'visited' | 'want';
  version: number;
};

type SearchResponse = {
  candidates?: Array<{
    address?: unknown;
    displayName?: unknown;
    primaryType?: unknown;
    ticket?: unknown;
  }>;
};

type SaveResponse = {
  saved_id?: unknown;
  saved_is_recommended?: unknown;
  saved_personal_note?: unknown;
  saved_tags?: unknown;
  saved_version?: unknown;
  saved_visit_status?: unknown;
};

const previewCandidates: PlaceSearchCandidate[] = [
  {
    address: '성수동 · 미리보기 주소',
    displayName: '성수 미리보기 식당',
    isPreview: true,
    primaryType: 'restaurant',
    ticket: 'preview-restaurant',
  },
  {
    address: '성수동 · 미리보기 주소',
    displayName: '성수 미리보기 카페',
    isPreview: true,
    primaryType: 'cafe',
    ticket: 'preview-cafe',
  },
  {
    address: '연남동 · 미리보기 주소',
    displayName: '연남 미리보기 베이커리',
    isPreview: true,
    primaryType: 'bakery',
    ticket: 'preview-bakery',
  },
];

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const isCandidate = (value: unknown): value is PlaceSearchCandidate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.address === 'string' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.ticket === 'string' &&
    (typeof candidate.primaryType === 'string' || candidate.primaryType === null)
  );
};

const isVisitStatus = (value: unknown): value is 'visited' | 'want' => value === 'visited' || value === 'want';

const isTagList = (value: unknown): value is string[] => Array.isArray(value) && value.every((tag) => typeof tag === 'string');

export const searchPlaces = async (query: string, languageCode: 'en' | 'ko'): Promise<PlaceSearchCandidate[]> => {
  if (query.trim().length < 2) throw new AuthFlowError('INVALID_ONBOARDING_INPUT');

  if (isAuthPreviewMode()) return previewCandidates;

  const { data, error } = await configuredClient().functions.invoke<SearchResponse>('app', {
    body: {
      action: 'search_places',
      languageCode,
      query: query.trim(),
    },
  });
  if (error) throw new AuthFlowError('REQUEST_FAILED');

  return (data?.candidates ?? []).filter(isCandidate).map(({ address, displayName, primaryType, ticket }) => ({
    address,
    displayName,
    isPreview: false,
    primaryType,
    ticket,
  }));
};

export const saveSearchCandidate = async ({
  candidate,
  collection,
  note,
  tags,
  visitStatus,
}: {
  candidate: PlaceSearchCandidate;
  collection: PrivateCollection | null;
  note: string;
  tags: string[];
  visitStatus: 'visited' | 'want';
}): Promise<SavedPlaceDraft> => {
  if (candidate.isPreview) {
    return {
      address: candidate.address,
      collectionId: collection?.id ?? null,
      collectionName: collection?.name ?? null,
      displayName: candidate.displayName,
      isRecommended: false,
      note,
      savedId: `preview-${candidate.ticket}`,
      tags,
      visitStatus,
      version: 1,
    };
  }

  const { data, error } = await configuredClient().rpc('create_saved_from_search_ticket', {
    collection_id_input: collection?.id ?? null,
    personal_note_input: note,
    search_ticket_id: candidate.ticket,
    tags_input: tags,
    visit_status_input: visitStatus,
  });
  if (error) throw toAuthFailure(error);

  const result = Array.isArray(data) ? (data[0] as SaveResponse | undefined) : undefined;
  if (
    !result ||
    typeof result.saved_id !== 'string' ||
    typeof result.saved_version !== 'number' ||
    !isVisitStatus(result.saved_visit_status) ||
    typeof result.saved_is_recommended !== 'boolean' ||
    (typeof result.saved_personal_note !== 'string' && result.saved_personal_note !== null) ||
    !isTagList(result.saved_tags)
  ) {
    throw new AuthFlowError('REQUEST_FAILED');
  }

  return {
    address: candidate.address,
    collectionId: collection?.id ?? null,
    collectionName: collection?.name ?? null,
    displayName: candidate.displayName,
    isRecommended: result.saved_is_recommended,
    note: result.saved_personal_note ?? '',
    savedId: result.saved_id,
    tags: result.saved_tags,
    visitStatus: result.saved_visit_status,
    version: result.saved_version,
  };
};

export const updateSavedPlace = async ({
  isRecommended,
  note,
  savedPlace,
  tags,
  visitStatus,
}: {
  isRecommended: boolean;
  note: string;
  savedPlace: SavedPlaceDraft;
  tags: string[];
  visitStatus: 'visited' | 'want';
}): Promise<SavedPlaceDraft> => {
  if (savedPlace.savedId.startsWith('preview-')) {
    return {
      ...savedPlace,
      isRecommended: visitStatus === 'visited' && isRecommended,
      note,
      tags,
      visitStatus,
      version: savedPlace.version + 1,
    };
  }

  const { data, error } = await configuredClient().rpc('update_private_saved_place', {
    expected_version_input: savedPlace.version,
    personal_note_input: note,
    recommended_input: visitStatus === 'visited' && isRecommended,
    saved_id_input: savedPlace.savedId,
    tags_input: tags,
    visit_status_input: visitStatus,
  });
  if (error) throw toAuthFailure(error);
  if (typeof data !== 'number' || data < 1) throw new AuthFlowError('REQUEST_FAILED');

  return {
    ...savedPlace,
    isRecommended: visitStatus === 'visited' && isRecommended,
    note,
    tags,
    visitStatus,
    version: data,
  };
};

export const deleteSavedPlace = async (savedPlace: SavedPlaceDraft): Promise<void> => {
  if (savedPlace.savedId.startsWith('preview-')) return;

  const { error } = await configuredClient().rpc('delete_private_saved_place', {
    saved_id_input: savedPlace.savedId,
  });
  if (error) throw toAuthFailure(error);
};
