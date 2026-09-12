import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

export type PublicMapSummary = Readonly<{
  bio: string | null;
  displayName: string;
  handle: string;
  publicPlaceCount: number;
}>;

export type PublicMapPlace = Readonly<{
  address: string;
  coordinate: { latitude: number; longitude: number } | null;
  displayName: string;
  publicNote: string | null;
  sourceSavedId: string;
}>;

export type PublicMapSnapshot = Readonly<{
  places: PublicMapPlace[];
  profile: PublicMapSummary;
  unavailableCount: number;
}>;

type DiscoverResponse = {
  maps?: unknown;
};

type PublicMapResponse = {
  places?: unknown;
  profile?: unknown;
  unavailableCount?: unknown;
};

const previewMaps: PublicMapSummary[] = [
  {
    bio: '서울에서 오래 남는 식탁을 기록해요.',
    displayName: '수진의 저녁',
    handle: 'sujin_eats',
    publicPlaceCount: 2,
  },
  {
    bio: '빵과 커피를 따라 천천히 걷습니다.',
    displayName: '민호',
    handle: 'crumbs_minho',
    publicPlaceCount: 1,
  },
];

const previewSnapshots: Record<string, PublicMapSnapshot> = {
  sujin_eats: {
    places: [
      {
        address: '서울 성동구 성수이로 7길',
        coordinate: { latitude: 37.5446, longitude: 127.0557 },
        displayName: '성수의 저녁 식탁',
        publicNote: '저녁 시간에는 창가 자리가 특히 좋아요.',
        sourceSavedId: 'preview-public-seongsu-table',
      },
      {
        address: '서울 마포구 동교로',
        coordinate: { latitude: 37.5616, longitude: 126.924 },
        displayName: '연남의 작은 베이커리',
        publicNote: null,
        sourceSavedId: 'preview-public-yeonnam-bakery',
      },
    ],
    profile: previewMaps[0]!,
    unavailableCount: 0,
  },
  crumbs_minho: {
    places: [
      {
        address: '서울 종로구 자하문로',
        coordinate: { latitude: 37.5805, longitude: 126.9691 },
        displayName: '서촌의 아침 커피',
        publicNote: '오전 산책 뒤에 들르기 좋아요.',
        sourceSavedId: 'preview-public-seochon-coffee',
      },
    ],
    profile: previewMaps[1]!,
    unavailableCount: 0,
  },
};

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const isCoordinate = (value: unknown): value is { latitude: number; longitude: number } => {
  if (!value || typeof value !== 'object') return false;
  const coordinate = value as Record<string, unknown>;

  return (
    typeof coordinate.latitude === 'number' &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    typeof coordinate.longitude === 'number' &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
};

const isPublicMapSummary = (value: unknown): value is PublicMapSummary => {
  if (!value || typeof value !== 'object') return false;
  const map = value as Record<string, unknown>;

  return (
    (typeof map.bio === 'string' || map.bio === null) &&
    typeof map.displayName === 'string' &&
    typeof map.handle === 'string' &&
    typeof map.publicPlaceCount === 'number' &&
    map.publicPlaceCount > 0
  );
};

const isPublicMapPlace = (value: unknown): value is PublicMapPlace => {
  if (!value || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;

  return (
    typeof place.address === 'string' &&
    (isCoordinate(place.coordinate) || place.coordinate === null) &&
    typeof place.displayName === 'string' &&
    (typeof place.publicNote === 'string' || place.publicNote === null) &&
    typeof place.sourceSavedId === 'string'
  );
};

export const loadDiscoverablePublicMaps = async (languageCode: 'en' | 'ko'): Promise<PublicMapSummary[]> => {
  if (isAuthPreviewMode()) return previewMaps;

  const { data, error } = await configuredClient().functions.invoke<DiscoverResponse>('app', {
    body: { action: 'discover_public_maps', languageCode },
  });
  if (error || !data) throw new AuthFlowError('REQUEST_FAILED');
  return Array.isArray(data.maps) ? data.maps.filter(isPublicMapSummary) : [];
};

export const loadPublicMap = async ({
  handle,
  languageCode,
}: {
  handle: string;
  languageCode: 'en' | 'ko';
}): Promise<PublicMapSnapshot> => {
  if (isAuthPreviewMode()) {
    const snapshot = previewSnapshots[handle];
    if (!snapshot) throw new AuthFlowError('REQUEST_FAILED');
    return snapshot;
  }

  const { data, error } = await configuredClient().functions.invoke<PublicMapResponse>('app', {
    body: { action: 'get_public_map', handle, languageCode },
  });
  if (error || !data || !isPublicMapSummary(data.profile) || typeof data.unavailableCount !== 'number') {
    throw new AuthFlowError('REQUEST_FAILED');
  }

  return {
    places: Array.isArray(data.places) ? data.places.filter(isPublicMapPlace) : [],
    profile: data.profile,
    unavailableCount: data.unavailableCount,
  };
};

export const copyPublicPlace = async (sourceSavedId: string): Promise<string> => {
  if (sourceSavedId.startsWith('preview-public-')) return `preview-owned-${sourceSavedId}`;

  const { data, error } = await configuredClient().rpc('copy_public_saved_place', {
    source_saved_id_input: sourceSavedId,
  });
  if (error || typeof data !== 'string') throw toAuthFailure(error);
  return data;
};

export const setPublicMapEnabled = async (enabled: boolean): Promise<boolean> => {
  if (isAuthPreviewMode()) return enabled;

  const { data, error } = await configuredClient().rpc('set_public_map_enabled', { enabled });
  if (error || typeof data !== 'boolean') throw toAuthFailure(error);
  return data;
};

export const getOwnPublicMapEnabled = async (): Promise<boolean> => {
  if (isAuthPreviewMode()) return false;

  const { data, error } = await configuredClient().from('profiles').select('public_map_enabled').maybeSingle();
  if (error || typeof data?.public_map_enabled !== 'boolean') throw toAuthFailure(error);
  return data.public_map_enabled;
};

export const setSavedPlaceVisibility = async ({
  expectedVersion,
  publicNote,
  savedId,
  visibility,
}: {
  expectedVersion: number;
  publicNote?: string | null;
  savedId: string;
  visibility: 'private' | 'public' | 'unlisted';
}): Promise<number> => {
  if (savedId.startsWith('preview-')) return expectedVersion + 1;

  const { data, error } = await configuredClient().rpc('set_saved_place_visibility', {
    expected_version_input: expectedVersion,
    public_note_input: publicNote,
    saved_id_input: savedId,
    visibility_input: visibility,
  });
  if (error || typeof data !== 'number') throw toAuthFailure(error);
  return data;
};
