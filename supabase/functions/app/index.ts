import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

type PlaceSearchRequest = {
  action: 'search_places';
  languageCode: 'en' | 'ko';
  query: string;
};

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  id?: string;
  primaryType?: string;
};

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

const readRequest = async (request: Request): Promise<PlaceSearchRequest | null> => {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return null;

    const candidate = body as Record<string, unknown>;
    if (
      candidate.action !== 'search_places' ||
      (candidate.languageCode !== 'en' && candidate.languageCode !== 'ko') ||
      typeof candidate.query !== 'string'
    ) {
      return null;
    }

    return {
      action: 'search_places',
      languageCode: candidate.languageCode,
      query: candidate.query.trim(),
    };
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return error('NOT_FOUND', 404);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const googlePlacesKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !publishableKey || !secretKey || !authorization || !googlePlacesKey) {
    return error('PROVIDER_UNAVAILABLE', 503);
  }

  const payload = await readRequest(request);
  if (!payload || payload.query.length < 2 || payload.query.length > 160) {
    return error('INVALID_INPUT', 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) return error('UNAUTHENTICATED', 401);

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: quotaError } = await adminClient.rpc('consume_place_search_quota', {
    ticket_user_id: user.id,
  });

  if (quotaError) {
    return quotaError.code === 'P0001' ? error('RATE_LIMITED', 429) : error('PROVIDER_UNAVAILABLE', 503);
  }

  let googleResponse: Response;
  try {
    googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      body: JSON.stringify({
        languageCode: payload.languageCode,
        maxResultCount: 5,
        textQuery: payload.query,
      }),
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
  const candidates: Array<{
    address: string;
    displayName: string;
    primaryType: string | null;
    ticket: string;
  }> = [];

  for (const place of responseBody.places?.slice(0, 5) ?? []) {
    const placeId = typeof place.id === 'string' ? place.id : null;
    const displayName = typeof place.displayName?.text === 'string' ? place.displayName.text : null;
    const address = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
    if (!placeId || !displayName || !address) continue;

    const ticket = crypto.randomUUID();
    const { error: ticketError } = await adminClient.rpc('issue_place_search_ticket', {
      ticket_expires_at: expiresAt,
      ticket_id: ticket,
      ticket_provider_place_id: placeId,
      ticket_user_id: user.id,
    });
    if (ticketError) return error('PROVIDER_UNAVAILABLE', 503);

    candidates.push({
      address,
      displayName,
      primaryType: typeof place.primaryType === 'string' ? place.primaryType : null,
      ticket,
    });
  }

  return json({ candidates, provider: 'google' });
});
