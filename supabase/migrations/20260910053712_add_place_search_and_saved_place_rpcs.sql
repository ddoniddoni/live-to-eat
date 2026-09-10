-- B07: Search results are transient Google content. The server issues a short-lived ticket that
-- represents a verified Place ID; the mobile client may only turn its own unused ticket into a
-- private saved place. Raw table writes remain unavailable through the Data API.

create table private.place_search_rate_windows (
  user_id uuid primary key references auth.users (id) on delete cascade,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  constraint place_search_rate_windows_request_count_check check (request_count >= 0)
);

create table private.place_search_tickets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.place_provider not null default 'google',
  provider_place_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  result_saved_id uuid references public.saved_places (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint place_search_tickets_provider_place_id_length_check
    check (char_length(btrim(provider_place_id)) between 1 and 512),
  constraint place_search_tickets_expiry_after_creation_check check (expires_at > created_at)
);

create index place_search_tickets_user_expiry_idx
  on private.place_search_tickets (user_id, expires_at desc)
  where used_at is null;

alter table private.place_search_rate_windows enable row level security;
alter table private.place_search_tickets enable row level security;

revoke all on table private.place_search_rate_windows from anon, authenticated;
revoke all on table private.place_search_tickets from anon, authenticated;

create or replace function public.consume_place_search_quota(ticket_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_request_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service role is required';
  end if;

  if ticket_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid search quota request';
  end if;

  insert into private.place_search_rate_windows as rate_window (
    user_id,
    request_count,
    window_started_at
  )
  values (ticket_user_id, 1, now())
  on conflict (user_id) do update
  set
    request_count = case
      when rate_window.window_started_at <= now() - interval '1 minute' then 1
      else rate_window.request_count + 1
    end,
    window_started_at = case
      when rate_window.window_started_at <= now() - interval '1 minute' then now()
      else rate_window.window_started_at
    end
  returning request_count into next_request_count;

  if next_request_count > 12 then
    raise exception using
      errcode = 'P0001',
      message = 'Place search rate limit reached';
  end if;
end;
$$;

create or replace function public.issue_place_search_ticket(
  ticket_id uuid,
  ticket_user_id uuid,
  ticket_provider_place_id text,
  ticket_expires_at timestamptz
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
    or ticket_expires_at <= now()
    or ticket_expires_at > now() + interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'Invalid search ticket';
  end if;

  insert into private.place_search_tickets (
    id,
    user_id,
    provider_place_id,
    expires_at
  )
  values (
    ticket_id,
    ticket_user_id,
    btrim(ticket_provider_place_id),
    ticket_expires_at
  );
end;
$$;

create or replace function public.create_saved_from_search_ticket(
  search_ticket_id uuid,
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
  ticket_place_id text;
  ticket_expires_at timestamptz;
  ticket_result_saved_id uuid;
  ticket_used_at timestamptz;
  referenced_place_id uuid;
  existing_saved_id uuid;
  normalized_tags jsonb;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  if search_ticket_id is null
    or (personal_note_input is not null and char_length(personal_note_input) > 2_000)
    or visit_status_input is null
    or tags_input is null
    or jsonb_typeof(tags_input) <> 'array'
    or jsonb_array_length(tags_input) > 20 then
    raise exception using
      errcode = '22023',
      message = 'Invalid saved-place input';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(tags_input) as tag(value)
    where jsonb_typeof(tag.value) <> 'string'
      or char_length(btrim(tag.value #>> '{}')) not between 1 and 60
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid saved-place tags';
  end if;

  select provider_place_id, expires_at, result_saved_id, used_at
  into ticket_place_id, ticket_expires_at, ticket_result_saved_id, ticket_used_at
  from private.place_search_tickets
  where id = search_ticket_id
    and user_id = current_user_id
  for update;

  if ticket_place_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Search ticket is unavailable';
  end if;

  if ticket_result_saved_id is not null then
    select
      saved.version,
      saved.visit_status,
      saved.is_recommended,
      private.personal_note,
      private.tags
    into
      saved_version,
      saved_visit_status,
      saved_is_recommended,
      saved_personal_note,
      saved_tags
    from public.saved_places as saved
    join public.saved_private as private on private.saved_id = saved.id
    where saved.id = ticket_result_saved_id
      and saved.user_id = current_user_id;

    if saved_version is null then
      raise exception using
        errcode = 'P0002',
        message = 'Saved place is unavailable';
    end if;

    saved_id := ticket_result_saved_id;
    was_created := false;
    return next;
  end if;

  if ticket_expires_at <= now() or ticket_used_at is not null then
    raise exception using
      errcode = 'P0002',
      message = 'Search ticket is unavailable';
  end if;

  if collection_id_input is not null and not exists (
    select 1
    from public.collections
    where id = collection_id_input
      and user_id = current_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Collection is unavailable';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(btrim(tag.value #>> '{}'))),
    '[]'::jsonb
  )
  into normalized_tags
  from jsonb_array_elements(tags_input) as tag(value);

  insert into public.place_refs as place_ref (provider, provider_place_id, id_checked_at)
  values ('google', ticket_place_id, now())
  on conflict (provider, provider_place_id) do update
  set id_checked_at = excluded.id_checked_at
  returning id into referenced_place_id;

  select id
  into existing_saved_id
  from public.saved_places
  where user_id = current_user_id
    and place_ref_id = referenced_place_id
    and resolution_state = 'resolved'
  for update;

  if existing_saved_id is null then
    insert into public.saved_places (
      user_id,
      place_ref_id,
      resolution_state,
      visibility,
      visit_status,
      is_recommended
    )
    values (
      current_user_id,
      referenced_place_id,
      'resolved',
      'private',
      visit_status_input,
      false
    )
    returning id into existing_saved_id;

    insert into public.saved_private (
      saved_id,
      personal_note,
      tags,
      input_provenance,
      imported_notes
    )
    values (
      existing_saved_id,
      nullif(btrim(personal_note_input), ''),
      normalized_tags,
      'manual',
      '{}'::jsonb
    );

    was_created := true;
  else
    was_created := false;
  end if;

  if collection_id_input is not null then
    insert into public.collection_items (collection_id, saved_id)
    values (collection_id_input, existing_saved_id)
    on conflict do nothing;
  end if;

  update private.place_search_tickets
  set used_at = now(), result_saved_id = existing_saved_id
  where id = search_ticket_id;

  select
    saved.version,
    saved.visit_status,
    saved.is_recommended,
    private.personal_note,
    private.tags
  into
    saved_version,
    saved_visit_status,
    saved_is_recommended,
    saved_personal_note,
    saved_tags
  from public.saved_places as saved
  join public.saved_private as private on private.saved_id = saved.id
  where saved.id = existing_saved_id
    and saved.user_id = current_user_id;

  if saved_version is null then
    raise exception using
      errcode = 'P0002',
      message = 'Saved place is unavailable';
  end if;

  saved_id := existing_saved_id;
  return next;
end;
$$;

create or replace function public.create_manual_collection(collection_name_input text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  created_collection_id uuid;
  normalized_name text;
begin
  current_user_id := (select auth.uid());
  normalized_name := btrim(collection_name_input);

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  if char_length(normalized_name) not between 1 and 120 then
    raise exception using
      errcode = '22023',
      message = 'Invalid collection name';
  end if;

  insert into public.collections (user_id, name, origin)
  values (current_user_id, normalized_name, 'manual')
  returning id into created_collection_id;

  return created_collection_id;
end;
$$;

create or replace function public.rename_private_collection(
  collection_id_input uuid,
  collection_name_input text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  normalized_name text;
begin
  current_user_id := (select auth.uid());
  normalized_name := btrim(collection_name_input);

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  if collection_id_input is null
    or char_length(normalized_name) not between 1 and 120 then
    raise exception using
      errcode = '22023',
      message = 'Invalid collection input';
  end if;

  update public.collections
  set name = normalized_name
  where id = collection_id_input
    and user_id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Collection is unavailable';
  end if;
end;
$$;

create or replace function public.delete_private_collection(collection_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  delete from public.collections
  where id = collection_id_input
    and user_id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Collection is unavailable';
  end if;
end;
$$;

create or replace function public.update_private_saved_place(
  saved_id_input uuid,
  expected_version_input integer,
  visit_status_input public.visit_status,
  recommended_input boolean,
  personal_note_input text,
  tags_input jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_version integer;
  normalized_tags jsonb;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  if saved_id_input is null
    or expected_version_input is null
    or expected_version_input < 1
    or visit_status_input is null
    or recommended_input is null
    or (recommended_input and visit_status_input <> 'visited')
    or (personal_note_input is not null and char_length(personal_note_input) > 2_000)
    or tags_input is null
    or jsonb_typeof(tags_input) <> 'array'
    or jsonb_array_length(tags_input) > 20 then
    raise exception using
      errcode = '22023',
      message = 'Invalid saved-place update';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(tags_input) as tag(value)
    where jsonb_typeof(tag.value) <> 'string'
      or char_length(btrim(tag.value #>> '{}')) not between 1 and 60
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid saved-place tags';
  end if;

  select version
  into current_version
  from public.saved_places
  where id = saved_id_input
    and user_id = current_user_id
  for update;

  if current_version is null then
    raise exception using
      errcode = 'P0002',
      message = 'Saved place is unavailable';
  end if;

  if current_version <> expected_version_input then
    raise exception using
      errcode = 'P0001',
      message = 'Saved place changed';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(btrim(tag.value #>> '{}'))),
    '[]'::jsonb
  )
  into normalized_tags
  from jsonb_array_elements(tags_input) as tag(value);

  update public.saved_places
  set
    visit_status = visit_status_input,
    is_recommended = recommended_input,
    version = version + 1
  where id = saved_id_input;

  update public.saved_private
  set
    personal_note = nullif(btrim(personal_note_input), ''),
    tags = normalized_tags
  where saved_id = saved_id_input;

  return current_version + 1;
end;
$$;

create or replace function public.delete_private_saved_place(saved_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using
      errcode = '42501',
      message = 'An active account is required';
  end if;

  delete from public.saved_places
  where id = saved_id_input
    and user_id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Saved place is unavailable';
  end if;
end;
$$;

revoke all on function public.consume_place_search_quota(uuid) from public;
revoke all on function public.issue_place_search_ticket(uuid, uuid, text, timestamptz) from public;
revoke all on function public.create_saved_from_search_ticket(uuid, text, jsonb, uuid, public.visit_status) from public;
revoke all on function public.create_manual_collection(text) from public;
revoke all on function public.rename_private_collection(uuid, text) from public;
revoke all on function public.delete_private_collection(uuid) from public;
revoke all on function public.update_private_saved_place(uuid, integer, public.visit_status, boolean, text, jsonb) from public;
revoke all on function public.delete_private_saved_place(uuid) from public;

grant execute on function public.consume_place_search_quota(uuid) to service_role;
grant execute on function public.issue_place_search_ticket(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.create_saved_from_search_ticket(uuid, text, jsonb, uuid, public.visit_status) to authenticated;
grant execute on function public.create_manual_collection(text) to authenticated;
grant execute on function public.rename_private_collection(uuid, text) to authenticated;
grant execute on function public.delete_private_collection(uuid) to authenticated;
grant execute on function public.update_private_saved_place(uuid, integer, public.visit_status, boolean, text, jsonb) to authenticated;
grant execute on function public.delete_private_saved_place(uuid) to authenticated;
