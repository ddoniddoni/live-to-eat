import { AuthFlowError } from '@/features/auth/authApi';
import type { SavedPlaceDraft } from '@/features/places/placeSearchApi';
import { getSupabaseClient, isAuthPreviewMode } from '@/lib/supabase/client';

type MapResponse = {
  places?: unknown;
  totalCount?: unknown;
  unavailableCount?: unknown;
};

export type MyMapSnapshot = Readonly<{
  places: SavedPlaceDraft[];
  totalCount: number;
  unavailableCount: number;
}>;

const previewSnapshot: MyMapSnapshot = {
  places: [
    {
      address: '서울 성동구 성수이로 7길',
      collectionId: null,
      collectionName: null,
      coordinate: { latitude: 37.5446, longitude: 127.0557 },
      displayName: '성수 미리보기 식당',
      isRecommended: true,
      note: '창가 자리가 좋아요.',
      regionPath: [
        { id: 'preview-kr', label: '대한민국' },
        { id: 'preview-seoul', label: '서울' },
        { id: 'preview-seongsu', label: '성수동' },
      ],
      savedId: 'preview-seongsu-restaurant',
      tags: ['파스타'],
      version: 1,
      visitStatus: 'visited',
      visibility: 'private',
    },
    {
      address: '서울 마포구 동교로',
      collectionId: null,
      collectionName: null,
      coordinate: { latitude: 37.5616, longitude: 126.924 },
      displayName: '연남 미리보기 카페',
      isRecommended: false,
      note: '',
      regionPath: [
        { id: 'preview-kr', label: '대한민국' },
        { id: 'preview-seoul', label: '서울' },
        { id: 'preview-yeonnam', label: '연남동' },
      ],
      savedId: 'preview-yeonnam-cafe',
      tags: ['커피'],
      version: 1,
      visitStatus: 'want',
      visibility: 'private',
    },
    {
      address: '주소를 확인하지 못했어요',
      collectionId: null,
      collectionName: null,
      coordinate: null,
      displayName: '위치 미확인 미리보기',
      isRecommended: false,
      note: '',
      regionPath: [],
      savedId: 'preview-unlocated',
      tags: [],
      version: 1,
      visitStatus: 'want',
      visibility: 'private',
    },
  ],
  totalCount: 3,
  unavailableCount: 1,
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

const isRegionPath = (value: unknown): value is Array<{ id: string; label: string }> =>
  Array.isArray(value) &&
  value.every(
    (region) =>
      Boolean(region) &&
      typeof region === 'object' &&
      typeof (region as Record<string, unknown>).id === 'string' &&
      typeof (region as Record<string, unknown>).label === 'string',
  );

const isSavedPlace = (value: unknown): value is SavedPlaceDraft => {
  if (!value || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;

  return (
    typeof place.address === 'string' &&
    (typeof place.collectionId === 'string' || place.collectionId === null) &&
    (typeof place.collectionName === 'string' || place.collectionName === null) &&
    (isCoordinate(place.coordinate) || place.coordinate === null) &&
    typeof place.displayName === 'string' &&
    typeof place.isRecommended === 'boolean' &&
    typeof place.note === 'string' &&
    isRegionPath(place.regionPath) &&
    typeof place.savedId === 'string' &&
    Array.isArray(place.tags) &&
    place.tags.every((tag) => typeof tag === 'string') &&
    typeof place.version === 'number' &&
    (place.visitStatus === 'visited' || place.visitStatus === 'want') &&
    (place.visibility === 'private' || place.visibility === 'public' || place.visibility === 'unlisted')
  );
};

export const loadMyMap = async (languageCode: 'en' | 'ko'): Promise<MyMapSnapshot> => {
  if (isAuthPreviewMode()) return previewSnapshot;

  const { data, error } = await configuredClient().functions.invoke<MapResponse>('app', {
    body: { action: 'get_my_map', languageCode },
  });
  if (
    error ||
    !data ||
    typeof data.totalCount !== 'number' ||
    data.totalCount < 0 ||
    typeof data.unavailableCount !== 'number' ||
    data.unavailableCount < 0
  ) {
    throw new AuthFlowError('REQUEST_FAILED');
  }

  return {
    places: Array.isArray(data.places) ? data.places.filter(isSavedPlace) : [],
    totalCount: data.totalCount,
    unavailableCount: data.unavailableCount,
  };
};
