import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import type { PlaceSearchCandidate, SavedPlaceDraft } from '@/features/places/placeSearchApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

type GoogleLinkResolutionResponse = {
  candidate?: unknown;
  resolution?: unknown;
};

type GoogleLinkSearchResponse = {
  candidates?: unknown;
};

type SaveResponse = {
  saved_id?: unknown;
  saved_is_recommended?: unknown;
  saved_personal_note?: unknown;
  saved_tags?: unknown;
  saved_version?: unknown;
  saved_visit_status?: unknown;
};

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

const isTagList = (value: unknown): value is string[] => Array.isArray(value) && value.every((tag) => typeof tag === 'string');

const isVisitStatus = (value: unknown): value is 'visited' | 'want' => value === 'visited' || value === 'want';

const firstResult = <T extends object>(value: unknown): T | undefined =>
  Array.isArray(value) && value[0] && typeof value[0] === 'object' ? (value[0] as T) : undefined;

const previewCandidate: PlaceSearchCandidate = {
  address: '공유 링크 · 미리보기 주소',
  displayName: '공유 받은 미리보기 식당',
  isPreview: true,
  primaryType: 'restaurant',
  ticket: 'preview-shared-link',
};

export const resolveGoogleLink = async (
  inputUrl: string,
  languageCode: 'en' | 'ko',
): Promise<PlaceSearchCandidate | null> => {
  if (inputUrl.trim().length < 1 || inputUrl.trim().length > 10_000) {
    throw new AuthFlowError('INVALID_ONBOARDING_INPUT');
  }

  if (isAuthPreviewMode()) return previewCandidate;

  const { data, error } = await configuredClient().functions.invoke<GoogleLinkResolutionResponse>('app', {
    body: {
      action: 'resolve_google_link',
      inputUrl: inputUrl.trim(),
      languageCode,
    },
  });
  if (error) throw new AuthFlowError('REQUEST_FAILED');
  if (data?.resolution === 'manual') return null;
  if (data?.resolution !== 'resolved' || !isCandidate(data.candidate)) throw new AuthFlowError('REQUEST_FAILED');

  return { ...data.candidate, isPreview: false };
};

export const searchGoogleLinkPlaces = async (
  inputUrl: string,
  query: string,
  languageCode: 'en' | 'ko',
): Promise<PlaceSearchCandidate[]> => {
  if (inputUrl.trim().length < 1 || inputUrl.trim().length > 10_000 || query.trim().length < 2) {
    throw new AuthFlowError('INVALID_ONBOARDING_INPUT');
  }

  if (isAuthPreviewMode()) {
    return [{ ...previewCandidate, ticket: `preview-shared-link-search-${query.trim().toLocaleLowerCase('en-US')}` }];
  }

  const { data, error } = await configuredClient().functions.invoke<GoogleLinkSearchResponse>('app', {
    body: {
      action: 'search_google_link_place',
      inputUrl: inputUrl.trim(),
      languageCode,
      query: query.trim(),
    },
  });
  if (error) throw new AuthFlowError('REQUEST_FAILED');

  const rawCandidates = data?.candidates;
  if (!Array.isArray(rawCandidates)) return [];

  const candidates: PlaceSearchCandidate[] = [];
  for (const candidate of rawCandidates) {
    if (!isCandidate(candidate)) continue;

    candidates.push({
      address: candidate.address,
      displayName: candidate.displayName,
      isPreview: false,
      primaryType: candidate.primaryType,
      ticket: candidate.ticket,
    });
  }

  return candidates;
};

export const saveGoogleLinkCandidate = async ({
  candidate,
  inputUrl,
}: {
  candidate: PlaceSearchCandidate;
  inputUrl: string;
}): Promise<SavedPlaceDraft> => {
  if (candidate.isPreview) {
    return {
      address: candidate.address,
      collectionId: null,
      collectionName: null,
      displayName: candidate.displayName,
      isRecommended: false,
      note: '',
      savedId: `preview-google-link-${candidate.ticket}`,
      tags: [],
      version: 1,
      visitStatus: 'want',
    };
  }

  const { data, error } = await configuredClient().rpc('create_saved_from_google_link_ticket', {
    input_url_input: inputUrl.trim(),
    search_ticket_id: candidate.ticket,
  });
  if (error) throw toAuthFailure(error);

  const result = firstResult<SaveResponse>(data);
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
    collectionId: null,
    collectionName: null,
    displayName: candidate.displayName,
    isRecommended: result.saved_is_recommended,
    note: result.saved_personal_note ?? '',
    savedId: result.saved_id,
    tags: result.saved_tags,
    version: result.saved_version,
    visitStatus: result.saved_visit_status,
  };
};
