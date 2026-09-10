-- B11: A confirmed Google Maps link keeps only the user's original URL and a
-- verified search ticket. Google response content remains transient.

create extension if not exists pgcrypto with schema extensions;

alter table private.place_search_tickets
add column source_input_hash text;

alter table private.place_search_tickets
add constraint place_search_tickets_source_input_hash_format_check
check (source_input_hash is null or source_input_hash ~ '^[a-f0-9]{64}$');

create or replace function public.issue_google_link_place_search_ticket(
  ticket_id uuid,
  ticket_user_id uuid,
  ticket_provider_place_id text,
  ticket_expires_at timestamptz,
  ticket_source_input_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service role is required';
  end if;

  if ticket_id is null
    or ticket_user_id is null
    or ticket_provider_place_id is null
    or char_length(btrim(ticket_provider_place_id)) not between 1 and 512
    or ticket_source_input_hash is null
    or ticket_source_input_hash !~ '^[a-f0-9]{64}$'
    or ticket_expires_at <= now()
    or ticket_expires_at > now() + interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'Invalid Google link search ticket';
  end if;

  insert into private.place_search_tickets (
    id,
    user_id,
    provider_place_id,
    expires_at,
    source_input_hash
  )
  values (
    ticket_id,
    ticket_user_id,
    btrim(ticket_provider_place_id),
    ticket_expires_at,
    ticket_source_input_hash
  );
end;
$$;

create or replace function public.create_saved_from_google_link_ticket(
  search_ticket_id uuid,
  input_url_input text,
  personal_note_input text default null,
  tags_input jsonb default '[]'::jsonb,
  collection_id_input uuid default null,
  visit_status_input public.visit_status default 'want'
)
returns table (
  saved_id uuid,
  was_created boolean,
  saved_version integer,
  saved_visit_status public.visit_status,
  saved_is_recommended boolean,
  saved_personal_note text,
  saved_tags jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  normalized_url text;
  ticket_source_input_hash text;
begin
  normalized_url := btrim(input_url_input);
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active())
    or search_ticket_id is null
    or input_url_input is null
    or char_length(normalized_url) not between 1 and 10_000
    or normalized_url !~* '^https://(www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl)(/|$)' then
    raise exception using
      errcode = '22023',
      message = 'Invalid Google Maps link';
  end if;

  select source_input_hash
  into ticket_source_input_hash
  from private.place_search_tickets
  where id = search_ticket_id
    and user_id = current_user_id;

  if ticket_source_input_hash is null
    or ticket_source_input_hash <> encode(extensions.digest(normalized_url, 'sha256'), 'hex') then
    raise exception using
      errcode = 'P0002',
      message = 'Google link search ticket is unavailable';
  end if;

  select
    result.saved_id,
    result.was_created,
    result.saved_version,
    result.saved_visit_status,
    result.saved_is_recommended,
    result.saved_personal_note,
    result.saved_tags
  into
    saved_id,
    was_created,
    saved_version,
    saved_visit_status,
    saved_is_recommended,
    saved_personal_note,
    saved_tags
  from public.create_saved_from_search_ticket(
    search_ticket_id,
    personal_note_input,
    tags_input,
    collection_id_input,
    visit_status_input
  ) as result;

  if saved_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Saved place is unavailable';
  end if;

  if was_created then
    update public.saved_private as saved_private
    set
      input_provenance = 'google_link',
      original_url = normalized_url
    where saved_private.saved_id = create_saved_from_google_link_ticket.saved_id;
  end if;

  return next;
end;
$$;

revoke all on function public.create_saved_from_google_link_ticket(
  uuid,
  text,
  text,
  jsonb,
  uuid,
  public.visit_status
) from public;

revoke all on function public.issue_google_link_place_search_ticket(
  uuid,
  uuid,
  text,
  timestamptz,
  text
) from public;

grant execute on function public.create_saved_from_google_link_ticket(
  uuid,
  text,
  text,
  jsonb,
  uuid,
  public.visit_status
) to authenticated;

grant execute on function public.issue_google_link_place_search_ticket(
  uuid,
  uuid,
  text,
  timestamptz,
  text
) to service_role;
