import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const createAdminClient = (url: string, key: string) =>
  createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

type AdminClient = ReturnType<typeof createAdminClient>;

type GetMyMapRequest = {
  action: 'get_my_map';
  languageCode: 'en' | 'ko';
};

type DiscoverPublicMapsRequest = {
  action: 'discover_public_maps';
  languageCode: 'en' | 'ko';
};

type GetPublicMapRequest = {
  action: 'get_public_map';
  handle: string;
  languageCode: 'en' | 'ko';
};

type PlaceSearchRequest = {
  action: 'search_places';
  languageCode: 'en' | 'ko';
  query: string;
};

type AppRequest = DiscoverPublicMapsRequest | GetMyMapRequest | GetPublicMapRequest | PlaceSearchRequest;

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  id?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
};

type LiveGooglePlace = {
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
};

type SavedMapRow = {
  collection_items?: unknown;
  id?: unknown;
  is_recommended?: unknown;
  place_ref_id?: unknown;
  place_refs?: unknown;
  saved_private?: unknown;
  saved_regions?: unknown;
  version?: unknown;
  visit_status?: unknown;
  visibility?: unknown;
};

type SavedMapItem = {
  address: string;
  collectionId: string | null;
  collectionName: string | null;
  coordinate: { latitude: number; longitude: number };
  displayName: string;
  isRecommended: boolean;
  note: string;
  regionPath: Array<{ id: string; label: string }>;
  savedId: string;
  tags: string[];
  version: number;
  visitStatus: 'visited' | 'want';
  visibility: 'private' | 'public' | 'unlisted';
};

type DiscoverablePublicMapRow = {
  bio?: unknown;
  display_name?: unknown;
  handle?: unknown;
  owner_id?: unknown;
  public_place_count?: unknown;
};

type PublicMapRow = {
  bio?: unknown;
  display_name?: unknown;
  handle?: unknown;
  owner_id?: unknown;
  provider_place_id?: unknown;
  public_note?: unknown;
  public_place_count?: unknown;
  saved_id?: unknown;
};

type PublicMapItem = {
  address: string;
  coordinate: { latitude: number; longitude: number };
  displayName: string;
  publicNote: string | null;
  sourceSavedId: string;
};

const MAX_MAP_PLACES = 24;
const MAX_PARALLEL_PLACE_DETAILS = 4;
const handlePattern = /^[a-z0-9][a-z0-9_]{2,29}$/;

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    status,
  });

const error = (code: string, status: number): Response => json({ error: { code } }, status);

const parseKeyDictionary = (value: string | undefined): Record<string, string> => {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};

    const dictionary: Record<string, string> = {};
    for (const [key, candidate] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof candidate === 'string' && candidate.length > 0) dictionary[key] = candidate;
    }
    return dictionary;
  } catch {
    return {};
  }
};

const defaultKey = (dictionaryName: string, legacyName: string): string | null => {
  const dictionary = parseKeyDictionary(Deno.env.get(dictionaryName));
  return dictionary.default ?? Object.values(dictionary)[0] ?? Deno.env.get(legacyName) ?? null;
};

const readRequest = async (request: Request): Promise<AppRequest | null> => {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return null;

    const candidate = body as Record<string, unknown>;
    if (candidate.languageCode !== 'en' && candidate.languageCode !== 'ko') return null;
    if (candidate.action === 'get_my_map') return { action: 'get_my_map', languageCode: candidate.languageCode };
    if (candidate.action === 'discover_public_maps') {
      return { action: 'discover_public_maps', languageCode: candidate.languageCode };
    }
    if (candidate.action === 'get_public_map' && typeof candidate.handle === 'string') {
      const handle = candidate.handle.trim().toLowerCase();
      if (handlePattern.test(handle)) return { action: 'get_public_map', handle, languageCode: candidate.languageCode };
    }
    if (candidate.action === 'search_places' && typeof candidate.query === 'string') {
      return { action: 'search_places', languageCode: candidate.languageCode, query: candidate.query.trim() };
    }
    return null;
  } catch {
    return null;
  }
};

const getObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const firstObject = (value: unknown): Record<string, unknown> | null =>
  Array.isArray(value) ? getObject(value[0]) : getObject(value);

const getTags = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string').slice(0, 20) : [];

const getRegionPath = (value: unknown, languageCode: 'en' | 'ko'): Array<{ id: string; label: string }> => {
  if (!Array.isArray(value)) return [];

  const regions: Array<{ id: string; label: string }> = [];
  for (const candidate of value) {
    const savedRegion = getObject(candidate);
    const regionNode = firstObject(savedRegion?.region_nodes);
    const names = getObject(regionNode?.localized_names);
    const label = names?.[languageCode] ?? names?.en ?? names?.ko ?? regionNode?.country_code;
    if (typeof savedRegion?.region_id === 'string' && typeof label === 'string') {
      regions.push({ id: savedRegion.region_id, label });
    }
  }
  return regions;
};

const getCollection = (value: unknown): { id: string | null; name: string | null } => {
  const collectionItem = firstObject(value);
  const collection = firstObject(collectionItem?.collections);
  return {
    id: typeof collection?.id === 'string' ? collection.id : null,
    name: typeof collection?.name === 'string' ? collection.name : null,
  };
};

const isLiveGooglePlace = (place: GooglePlace): place is LiveGooglePlace =>
  typeof place.displayName?.text === 'string' &&
  typeof place.formattedAddress === 'string' &&
  typeof place.location?.latitude === 'number' &&
  typeof place.location?.longitude === 'number';

const getLivePlace = async ({
  googlePlacesKey,
  languageCode,
  providerPlaceId,
}: {
  googlePlacesKey: string;
  languageCode: 'en' | 'ko';
  providerPlaceId: string;
}): Promise<LiveGooglePlace | null> => {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(providerPlaceId)}?languageCode=${languageCode}`,
      {
        headers: {
          'X-Goog-Api-Key': googlePlacesKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
        },
      },
    );
    if (!response.ok) return null;
    const place = (await response.json()) as GooglePlace;
    return isLiveGooglePlace(place) ? place : null;
  } catch {
    return null;
  }
};

const asMapItem = async ({
  googlePlacesKey,
  languageCode,
  row,
}: {
  googlePlacesKey: string;
  languageCode: 'en' | 'ko';
  row: SavedMapRow;
}): Promise<SavedMapItem | null> => {
  if (
    typeof row.id !== 'string' ||
    typeof row.place_ref_id !== 'string' ||
    (row.visit_status !== 'visited' && row.visit_status !== 'want') ||
    typeof row.is_recommended !== 'boolean' ||
    typeof row.version !== 'number'
  ) {
    return null;
  }

  const placeReference = firstObject(row.place_refs);
  const privateRecord = firstObject(row.saved_private);
  if (!placeReference || typeof placeReference.provider_place_id !== 'string') return null;

  const livePlace = await getLivePlace({
    googlePlacesKey,
    languageCode,
    providerPlaceId: placeReference.provider_place_id,
  });
  if (!livePlace) return null;

  const collection = getCollection(row.collection_items);
  return {
    address: livePlace.formattedAddress,
    collectionId: collection.id,
    collectionName: collection.name,
    coordinate: { latitude: livePlace.location.latitude, longitude: livePlace.location.longitude },
    displayName: livePlace.displayName.text,
    isRecommended: row.is_recommended,
    note: typeof privateRecord?.personal_note === 'string' ? privateRecord.personal_note : '',
    regionPath: getRegionPath(row.saved_regions, languageCode),
    savedId: row.id,
    tags: getTags(privateRecord?.tags),
    version: row.version,
    visitStatus: row.visit_status,
    visibility:
      row.visibility === 'public' || row.visibility === 'unlisted' || row.visibility === 'private'
        ? row.visibility
        : 'private',
  };
};

const asPublicMapItem = async ({
  googlePlacesKey,
  languageCode,
  row,
}: {
  googlePlacesKey: string;
  languageCode: 'en' | 'ko';
  row: PublicMapRow;
}): Promise<PublicMapItem | null> => {
  if (typeof row.provider_place_id !== 'string' || typeof row.saved_id !== 'string') return null;

  const livePlace = await getLivePlace({
    googlePlacesKey,
    languageCode,
    providerPlaceId: row.provider_place_id,
  });
  if (!livePlace) return null;

  return {
    address: livePlace.formattedAddress,
    coordinate: { latitude: livePlace.location.latitude, longitude: livePlace.location.longitude },
    displayName: livePlace.displayName.text,
    publicNote: typeof row.public_note === 'string' ? row.public_note : null,
    sourceSavedId: row.saved_id,
  };
};

const consumeSearchQuota = async (adminClient: AdminClient, userId: string): Promise<Response | null> => {
  const { error: quotaError } = await adminClient.rpc('consume_place_search_quota', {
    ticket_user_id: userId,
  });
  if (!quotaError) return null;
  return quotaError.code === 'P0001' ? error('RATE_LIMITED', 429) : error('PROVIDER_UNAVAILABLE', 503);
};

const issueSearchTicket = async (
  adminClient: AdminClient,
  userId: string,
  placeId: string,
  expiresAt: string,
): Promise<string | null> => {
  const ticket = crypto.randomUUID();
  const { error: ticketError } = await adminClient.rpc('issue_place_search_ticket', {
    ticket_expires_at: expiresAt,
    ticket_id: ticket,
    ticket_provider_place_id: placeId,
    ticket_user_id: userId,
  });
  return ticketError ? null : ticket;
};

const loadMyMap = async ({
  adminClient,
  googlePlacesKey,
  languageCode,
  userId,
}: {
  adminClient: AdminClient;
  googlePlacesKey: string | null;
  languageCode: 'en' | 'ko';
  userId: string;
}): Promise<Response> => {
  const [{ count, error: countError }, { data, error: savedError }] = await Promise.all([
    adminClient
      .from('saved_places')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolution_state', 'resolved'),
    adminClient
      .from('saved_places')
      .select(
        'id, place_ref_id, visit_status, is_recommended, version, visibility, place_refs(provider_place_id), saved_private(personal_note, tags), saved_regions(region_id, region_nodes(country_code, localized_names)), collection_items(collections(id, name))',
      )
      .eq('user_id', userId)
      .eq('resolution_state', 'resolved')
      .order('created_at', { ascending: false })
      .limit(MAX_MAP_PLACES),
  ]);
  if (countError || savedError) return error('PROVIDER_UNAVAILABLE', 503);

  const rows = (data ?? []) as SavedMapRow[];
  if (rows.length === 0) return json({ places: [], totalCount: count ?? 0, unavailableCount: 0 });
  if (!googlePlacesKey) return json({ places: [], totalCount: count ?? 0, unavailableCount: rows.length });

  const { error: quotaError } = await adminClient.rpc('consume_my_map_refresh_quota', {
    refresh_user_id: userId,
  });
  if (quotaError) return quotaError.code === 'P0001' ? error('RATE_LIMITED', 429) : error('PROVIDER_UNAVAILABLE', 503);

  const places: SavedMapItem[] = [];
  for (let offset = 0; offset < rows.length; offset += MAX_PARALLEL_PLACE_DETAILS) {
    const batch = await Promise.all(
      rows.slice(offset, offset + MAX_PARALLEL_PLACE_DETAILS).map((row) =>
        asMapItem({ googlePlacesKey, languageCode, row }),
      ),
    );
    for (const place of batch) if (place) places.push(place);
  }

  return json({
    places,
    totalCount: count ?? 0,
    unavailableCount: rows.length - places.length,
  });
};

const loadDiscoverablePublicMaps = async ({
  adminClient,
  userId,
}: {
  adminClient: AdminClient;
  userId: string;
}): Promise<Response> => {
  const { data, error: discoveryError } = await adminClient.rpc('list_discoverable_public_maps');
  if (discoveryError) return error('PROVIDER_UNAVAILABLE', 503);

  const maps = ((data ?? []) as DiscoverablePublicMapRow[]).flatMap((row) => {
    if (
      row.owner_id === userId ||
      typeof row.handle !== 'string' ||
      typeof row.display_name !== 'string' ||
      typeof row.public_place_count !== 'number' ||
      row.public_place_count < 1
    ) {
      return [];
    }
    return [
      {
        bio: typeof row.bio === 'string' ? row.bio : null,
        displayName: row.display_name,
        handle: row.handle,
        publicPlaceCount: row.public_place_count,
      },
    ];
  });

  return json({ maps });
};

const loadPublicMap = async ({
  adminClient,
  googlePlacesKey,
  handle,
  languageCode,
  userId,
}: {
  adminClient: AdminClient;
  googlePlacesKey: string | null;
  handle: string;
  languageCode: 'en' | 'ko';
  userId: string;
}): Promise<Response> => {
  const { data, error: publicMapError } = await adminClient.rpc('read_public_map', { public_handle: handle });
  if (publicMapError) return error('PROVIDER_UNAVAILABLE', 503);

  const rows = (data ?? []) as PublicMapRow[];
  const [firstRow] = rows;
  if (
    !firstRow ||
    firstRow.owner_id === userId ||
    typeof firstRow.handle !== 'string' ||
    typeof firstRow.display_name !== 'string'
  ) {
    return error('NOT_FOUND', 404);
  }

  const profile = {
    bio: typeof firstRow.bio === 'string' ? firstRow.bio : null,
    displayName: firstRow.display_name,
    handle: firstRow.handle,
    publicPlaceCount: typeof firstRow.public_place_count === 'number' ? firstRow.public_place_count : rows.length,
  };
  if (!googlePlacesKey) return json({ profile, places: [], unavailableCount: rows.length });

  const { error: quotaError } = await adminClient.rpc('consume_public_map_read_quota', {
    requesting_user_id: userId,
  });
  if (quotaError) return quotaError.code === 'P0001' ? error('RATE_LIMITED', 429) : error('PROVIDER_UNAVAILABLE', 503);

  const places: PublicMapItem[] = [];
  for (let offset = 0; offset < rows.length; offset += MAX_PARALLEL_PLACE_DETAILS) {
    const batch = await Promise.all(
      rows.slice(offset, offset + MAX_PARALLEL_PLACE_DETAILS).map((row) =>
        asPublicMapItem({ googlePlacesKey, languageCode, row }),
      ),
    );
    for (const place of batch) if (place) places.push(place);
  }

  return json({ profile, places, unavailableCount: rows.length - places.length });
};

const searchPlaces = async ({
  adminClient,
  googlePlacesKey,
  languageCode,
  query,
  userId,
}: {
  adminClient: AdminClient;
  googlePlacesKey: string;
  languageCode: 'en' | 'ko';
  query: string;
  userId: string;
}): Promise<Response> => {
  if (query.length < 2 || query.length > 160) return error('INVALID_INPUT', 400);
  const quotaResponse = await consumeSearchQuota(adminClient, userId);
  if (quotaResponse) return quotaResponse;

  let googleResponse: Response;
  try {
    googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      body: JSON.stringify({ languageCode, maxResultCount: 5, textQuery: query }),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googlePlacesKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType',
      },
      method: 'POST',
    });
  } catch {
    return error('PROVIDER_UNAVAILABLE', 503);
  }
  if (!googleResponse.ok) return error('PROVIDER_UNAVAILABLE', 503);

  let responseBody: { places?: GooglePlace[] };
  try {
    responseBody = (await googleResponse.json()) as { places?: GooglePlace[] };
  } catch {
    return error('PROVIDER_UNAVAILABLE', 503);
  }

  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const candidates: Array<{ address: string; displayName: string; primaryType: string | null; ticket: string }> = [];
  for (const place of responseBody.places?.slice(0, 5) ?? []) {
    const placeId = typeof place.id === 'string' ? place.id : null;
    const displayName = typeof place.displayName?.text === 'string' ? place.displayName.text : null;
    const address = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
    if (!placeId || !displayName || !address) continue;

    const ticket = await issueSearchTicket(adminClient, userId, placeId, expiresAt);
    if (!ticket) return error('PROVIDER_UNAVAILABLE', 503);
    candidates.push({
      address,
      displayName,
      primaryType: typeof place.primaryType === 'string' ? place.primaryType : null,
      ticket,
    });
  }

  return json({ candidates, provider: 'google' });
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return error('NOT_FOUND', 404);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY') ?? null;
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization) return error('PROVIDER_UNAVAILABLE', 503);

  const payload = await readRequest(request);
  if (!payload) return error('INVALID_INPUT', 400);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return error('UNAUTHENTICATED', 401);

  const { data: accountState, error: accountStateError } = await userClient.rpc('current_account_state');
  if (accountStateError || accountState !== 'active') return error('ACCOUNT_UNAVAILABLE', 403);

  const adminClient = createAdminClient(supabaseUrl, secretKey);
  if (payload.action === 'get_my_map') {
    return loadMyMap({ adminClient, googlePlacesKey, languageCode: payload.languageCode, userId: user.id });
  }
  if (payload.action === 'discover_public_maps') {
    return loadDiscoverablePublicMaps({ adminClient, userId: user.id });
  }
  if (payload.action === 'get_public_map') {
    return loadPublicMap({
      adminClient,
      googlePlacesKey,
      handle: payload.handle,
      languageCode: payload.languageCode,
      userId: user.id,
    });
  }
  if (!googlePlacesKey) return error('PROVIDER_UNAVAILABLE', 503);

  return searchPlaces({
    adminClient,
    googlePlacesKey,
    languageCode: payload.languageCode,
    query: payload.query,
    userId: user.id,
  });
});
