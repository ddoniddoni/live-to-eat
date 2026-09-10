import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

type PlaceSearchRequest = {
  action: 'search_places';
  languageCode: 'en' | 'ko';
  query: string;
};

type GoogleLinkResolveRequest = {
  action: 'resolve_google_link';
  inputUrl: string;
  languageCode: 'en' | 'ko';
};

type GoogleLinkSearchRequest = {
  action: 'search_google_link_place';
  inputUrl: string;
  languageCode: 'en' | 'ko';
  query: string;
};

type AppRequest = GoogleLinkResolveRequest | GoogleLinkSearchRequest | PlaceSearchRequest;

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  id?: string;
  primaryType?: string;
};

type GoogleMapsLink =
  | Readonly<{ kind: 'manual' }>
  | Readonly<{ kind: 'place_id'; placeId: string }>;

const supportedGoogleMapsHosts = new Set(['goo.gl', 'maps.app.goo.gl', 'maps.google.com', 'www.google.com']);
const placeIdPattern = /^[A-Za-z0-9_-]{10,512}$/u;

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
    if (candidate.languageCode !== 'en' && candidate.languageCode !== 'ko') {
      return null;
    }

    if (candidate.action === 'search_places' && typeof candidate.query === 'string') {
      return {
        action: 'search_places',
        languageCode: candidate.languageCode,
        query: candidate.query.trim(),
      };
    }

    if (candidate.action === 'resolve_google_link' && typeof candidate.inputUrl === 'string') {
      return {
        action: 'resolve_google_link',
        inputUrl: candidate.inputUrl.trim(),
        languageCode: candidate.languageCode,
      };
    }

    if (
      candidate.action === 'search_google_link_place' &&
      typeof candidate.inputUrl === 'string' &&
      typeof candidate.query === 'string'
    ) {
      return {
        action: 'search_google_link_place',
        inputUrl: candidate.inputUrl.trim(),
        languageCode: candidate.languageCode,
        query: candidate.query.trim(),
      };
    }

    return null;
  } catch {
    return null;
  }
};

const parseGoogleMapsLink = (inputUrl: string): GoogleMapsLink | null => {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLocaleLowerCase('en-US');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !supportedGoogleMapsHosts.has(host)
  ) {
    return null;
  }

  // Short URLs are deliberately not followed. Only the documented Maps URL
  // parameter is used as a verified Place Details input.
  if ((host === 'www.google.com' || host === 'maps.google.com') && url.pathname.startsWith('/maps')) {
    const placeId = url.searchParams.get('query_place_id');
    if (placeId && placeIdPattern.test(placeId)) return { kind: 'place_id', placeId };
  }

  return { kind: 'manual' };
};

const sourceInputHash = async (inputUrl: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inputUrl));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
};

const consumeSearchQuota = async (adminClient: ReturnType<typeof createClient>, userId: string): Promise<Response | null> => {
  const { error: quotaError } = await adminClient.rpc('consume_place_search_quota', {
    ticket_user_id: userId,
  });

  if (!quotaError) return null;
  return quotaError.code === 'P0001' ? error('RATE_LIMITED', 429) : error('PROVIDER_UNAVAILABLE', 503);
};

const issueSearchTicket = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  placeId: string,
  expiresAt: string,
  googleLinkInputHash: string | null = null,
): Promise<string | null> => {
  const ticket = crypto.randomUUID();
  const { error: ticketError } = googleLinkInputHash
    ? await adminClient.rpc('issue_google_link_place_search_ticket', {
        ticket_expires_at: expiresAt,
        ticket_id: ticket,
        ticket_provider_place_id: placeId,
        ticket_source_input_hash: googleLinkInputHash,
        ticket_user_id: userId,
      })
    : await adminClient.rpc('issue_place_search_ticket', {
        ticket_expires_at: expiresAt,
        ticket_id: ticket,
        ticket_provider_place_id: placeId,
        ticket_user_id: userId,
      });

  return ticketError ? null : ticket;
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
  if (
    !payload ||
    ((payload.action === 'search_places' || payload.action === 'search_google_link_place') &&
      (payload.query.length < 2 || payload.query.length > 160)) ||
    ((payload.action === 'resolve_google_link' || payload.action === 'search_google_link_place') &&
      (payload.inputUrl.length < 1 || payload.inputUrl.length > 10_000))
  ) {
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
  if (payload.action === 'resolve_google_link') {
    const googleMapsLink = parseGoogleMapsLink(payload.inputUrl);
    if (!googleMapsLink) return error('INVALID_INPUT', 400);
    if (googleMapsLink.kind === 'manual') return json({ resolution: 'manual' });

    const quotaResponse = await consumeSearchQuota(adminClient, user.id);
    if (quotaResponse) return quotaResponse;

    let detailsResponse: Response;
    try {
      detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googleMapsLink.placeId)}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googlePlacesKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,primaryType',
        },
        method: 'GET',
      });
    } catch {
      return error('PROVIDER_UNAVAILABLE', 503);
    }

    if (!detailsResponse.ok) return error('PLACE_UNRESOLVED', 404);

    let place: GooglePlace;
    try {
      place = (await detailsResponse.json()) as GooglePlace;
    } catch {
      return error('PROVIDER_UNAVAILABLE', 503);
    }

    const placeId = typeof place.id === 'string' ? place.id : null;
    const displayName = typeof place.displayName?.text === 'string' ? place.displayName.text : null;
    const address = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
    if (!placeId || !displayName || !address) return error('PLACE_UNRESOLVED', 404);

    const ticket = await issueSearchTicket(
      adminClient,
      user.id,
      placeId,
      new Date(Date.now() + 5 * 60_000).toISOString(),
      await sourceInputHash(payload.inputUrl),
    );
    if (!ticket) return error('PROVIDER_UNAVAILABLE', 503);

    return json({
      candidate: {
        address,
        displayName,
        primaryType: typeof place.primaryType === 'string' ? place.primaryType : null,
        ticket,
      },
      resolution: 'resolved',
    });
  }

  let googleLinkInputHash: string | null = null;
  if (payload.action === 'search_google_link_place') {
    if (!parseGoogleMapsLink(payload.inputUrl)) return error('INVALID_INPUT', 400);
    googleLinkInputHash = await sourceInputHash(payload.inputUrl);
  }

  const quotaResponse = await consumeSearchQuota(adminClient, user.id);
  if (quotaResponse) return quotaResponse;

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

    const ticket = await issueSearchTicket(adminClient, user.id, placeId, expiresAt, googleLinkInputHash);
    if (!ticket) return error('PROVIDER_UNAVAILABLE', 503);

    candidates.push({
      address,
      displayName,
      primaryType: typeof place.primaryType === 'string' ? place.primaryType : null,
      ticket,
    });
  }

  return json({ candidates, provider: 'google' });
});
