-- B10: private, resumable Takeout import batches. The original archive is never stored.

create type public.import_batch_state as enum ('active', 'cancelled');
create type public.import_row_state as enum ('pending', 'saved', 'duplicate', 'skipped');

create table private.import_batches (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  input_digest text not null,
  source_kind text not null default 'takeout_saved_csv',
  parser_version text not null,
  state public.import_batch_state not null default 'active',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_input_digest_format_check check (input_digest ~ '^[a-f0-9]{64}$'),
  constraint import_batches_source_kind_check check (source_kind = 'takeout_saved_csv'),
  constraint import_batches_parser_version_length_check check (char_length(btrim(parser_version)) between 1 and 64),
  constraint import_batches_expiry_after_creation_check check (expires_at > created_at),
  constraint import_batches_user_digest_unique unique (user_id, input_digest, source_kind)
);

create index import_batches_user_state_idx on private.import_batches (user_id, state, updated_at desc);

create table private.import_rows (
  batch_id uuid not null references private.import_batches (id) on delete cascade,
  source_row_key text not null,
  normalized_input jsonb not null,
  selected_region_id uuid references public.region_nodes (id) on delete restrict,
  state public.import_row_state not null default 'pending',
  result_saved_id uuid references public.saved_places (id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (batch_id, source_row_key),
  constraint import_rows_source_row_key_length_check check (char_length(btrim(source_row_key)) between 1 and 256),
  constraint import_rows_normalized_input_object_check check (jsonb_typeof(normalized_input) = 'object'),
  constraint import_rows_error_code_length_check check (error_code is null or char_length(error_code) <= 64),
  constraint import_rows_result_state_check check (
    (state in ('saved', 'duplicate') and result_saved_id is not null and error_code is null)
    or (state in ('pending', 'skipped') and result_saved_id is null)
  )
);

create index import_rows_batch_state_idx on private.import_rows (batch_id, state, created_at);

alter table private.import_batches enable row level security;
alter table private.import_rows enable row level security;

revoke all on table private.import_batches from anon, authenticated;
revoke all on table private.import_rows from anon, authenticated;

create trigger import_batches_touch_updated_at
before update on private.import_batches
for each row execute function private.touch_updated_at();

create trigger import_rows_touch_updated_at
before update on private.import_rows
for each row execute function private.touch_updated_at();

create or replace function private.assert_active_import_owner(batch_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  batch_user_id uuid;
  batch_state public.import_batch_state;
  batch_expires_at timestamptz;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  select user_id, state, expires_at
  into batch_user_id, batch_state, batch_expires_at
  from private.import_batches
  where id = batch_id_input
  for update;

  if batch_user_id is null or batch_user_id <> current_user_id then
    raise exception using errcode = 'P0002', message = 'Import batch is unavailable';
  end if;

  if batch_state <> 'active' or batch_expires_at <= now() then
    raise exception using errcode = 'P0002', message = 'Import batch is unavailable';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.begin_takeout_import_batch(
  batch_id_input uuid,
  input_digest_input text,
  parser_version_input text
)
returns table (
  batch_id uuid,
  batch_state public.import_batch_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  normalized_digest text;
  normalized_version text;
begin
  current_user_id := (select auth.uid());
  normalized_digest := lower(btrim(input_digest_input));
  normalized_version := btrim(parser_version_input);

  if current_user_id is null
    or not (select private.current_account_is_active()) then
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  if batch_id_input is null
    or normalized_digest !~ '^[a-f0-9]{64}$'
    or char_length(normalized_version) not between 1 and 64 then
    raise exception using errcode = '22023', message = 'Invalid import batch input';
  end if;

  insert into private.import_batches (
    id,
    user_id,
    input_digest,
    source_kind,
    parser_version,
    state,
    expires_at
  )
  values (
    batch_id_input,
    current_user_id,
    normalized_digest,
    'takeout_saved_csv',
    normalized_version,
    'active',
    now() + interval '7 days'
  )
  on conflict (user_id, input_digest, source_kind) do update
  set
    state = 'active',
    expires_at = excluded.expires_at,
    updated_at = now()
  returning id, state into batch_id, batch_state;

  return next;
end;
$$;

create or replace function public.list_takeout_import_rows(batch_id_input uuid)
returns table (
  source_row_key text,
  row_state public.import_row_state,
  result_saved_id uuid
)
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
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  if not exists (
    select 1
    from private.import_batches
    where id = batch_id_input
      and user_id = current_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'Import batch is unavailable';
  end if;

  return query
  select row.source_row_key, row.state, row.result_saved_id
  from private.import_rows as row
  where row.batch_id = batch_id_input
  order by row.created_at, row.source_row_key;
end;
$$;

create or replace function public.commit_takeout_import_row(
  batch_id_input uuid,
  source_row_key_input text,
  search_ticket_id uuid,
  input_title_input text default null,
  input_url_input text default null,
  personal_note_input text default null,
  tags_input jsonb default '[]'::jsonb,
  region_id_input uuid default null
)
returns table (
  saved_id uuid,
  result_state public.import_row_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  normalized_row_key text;
  normalized_title text;
  normalized_url text;
  normalized_note text;
  normalized_tags jsonb;
  existing_row_state public.import_row_state;
  existing_row_saved_id uuid;
  ticket_place_id text;
  ticket_expires_at timestamptz;
  ticket_used_at timestamptz;
  ticket_result_saved_id uuid;
  referenced_place_id uuid;
  matching_saved_id uuid;
  row_was_created boolean;
begin
  current_user_id := private.assert_active_import_owner(batch_id_input);
  normalized_row_key := btrim(source_row_key_input);
  normalized_title := nullif(btrim(input_title_input), '');
  normalized_url := nullif(btrim(input_url_input), '');
  normalized_note := nullif(btrim(personal_note_input), '');

  if normalized_row_key is null
    or char_length(normalized_row_key) not between 1 and 256
    or search_ticket_id is null
    or (normalized_title is not null and char_length(normalized_title) > 500)
    or (normalized_url is not null and char_length(normalized_url) > 10_000)
    or (normalized_note is not null and char_length(normalized_note) > 10_000)
    or tags_input is null
    or jsonb_typeof(tags_input) <> 'array'
    or jsonb_array_length(tags_input) > 100 then
    raise exception using errcode = '22023', message = 'Invalid import row input';
  end if;

  if normalized_title is null and normalized_url is null then
    raise exception using errcode = '22023', message = 'An import row needs a title or URL';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(tags_input) as tag(value)
    where jsonb_typeof(tag.value) <> 'string'
      or char_length(btrim(tag.value #>> '{}')) not between 1 and 100
  ) then
    raise exception using errcode = '22023', message = 'Invalid import tags';
  end if;

  if region_id_input is not null and not exists (
    select 1 from public.region_nodes where id = region_id_input
  ) then
    raise exception using errcode = 'P0002', message = 'Region is unavailable';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(btrim(tag.value #>> '{}'))),
    '[]'::jsonb
  )
  into normalized_tags
  from jsonb_array_elements(tags_input) as tag(value);

  insert into private.import_rows (
    batch_id,
    source_row_key,
    normalized_input,
    selected_region_id,
    state
  )
  values (
    batch_id_input,
    normalized_row_key,
    jsonb_strip_nulls(jsonb_build_object(
      'input_title', normalized_title,
      'input_url', normalized_url,
      'own_note', normalized_note,
      'input_tags', normalized_tags
    )),
    region_id_input,
    'pending'
  )
  on conflict (batch_id, source_row_key) do nothing;

  select state, result_saved_id
  into existing_row_state, existing_row_saved_id
  from private.import_rows
  where batch_id = batch_id_input
    and source_row_key = normalized_row_key
  for update;

  if existing_row_state in ('saved', 'duplicate') then
    saved_id := existing_row_saved_id;
    result_state := existing_row_state;
    return next;
    return;
  end if;

  select provider_place_id, expires_at, used_at, result_saved_id
  into ticket_place_id, ticket_expires_at, ticket_used_at, ticket_result_saved_id
  from private.place_search_tickets
  where id = search_ticket_id
    and user_id = current_user_id
  for update;

  if ticket_place_id is null
    or ticket_expires_at <= now()
    or ticket_used_at is not null
    or ticket_result_saved_id is not null then
    raise exception using errcode = 'P0002', message = 'Search ticket is unavailable';
  end if;

  insert into public.place_refs as place_ref (provider, provider_place_id, id_checked_at)
  values ('google', ticket_place_id, now())
  on conflict (provider, provider_place_id) do update
  set id_checked_at = excluded.id_checked_at
  returning id into referenced_place_id;

  select id
  into matching_saved_id
  from public.saved_places
  where user_id = current_user_id
    and place_ref_id = referenced_place_id
    and resolution_state = 'resolved'
  for update;

  row_was_created := matching_saved_id is null;
  if row_was_created then
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
      'want',
      false
    )
    returning id into matching_saved_id;

    insert into public.saved_private (
      saved_id,
      personal_note,
      tags,
      input_provenance,
      original_url,
      imported_notes
    )
    values (
      matching_saved_id,
      normalized_note,
      normalized_tags,
      'google_takeout',
      normalized_url,
      case
        when normalized_note is null then '{}'::jsonb
        else jsonb_build_object(normalized_row_key, normalized_note)
      end
    );
  elsif normalized_note is not null then
    update public.saved_private
    set imported_notes = coalesce(imported_notes, '{}'::jsonb) || jsonb_build_object(normalized_row_key, normalized_note)
    where saved_id = matching_saved_id;
  end if;

  if region_id_input is not null then
    insert into public.saved_regions (saved_id, region_id, origin)
    values (matching_saved_id, region_id_input, 'user_selected')
    on conflict do nothing;
  end if;

  update private.import_rows
  set
    normalized_input = jsonb_strip_nulls(jsonb_build_object(
      'input_title', normalized_title,
      'input_url', normalized_url,
      'own_note', normalized_note,
      'input_tags', normalized_tags
    )),
    selected_region_id = region_id_input,
    state = case when row_was_created then 'saved' else 'duplicate' end,
    result_saved_id = matching_saved_id,
    error_code = null
  where batch_id = batch_id_input
    and source_row_key = normalized_row_key;

  update private.place_search_tickets
  set used_at = now(), result_saved_id = matching_saved_id
  where id = search_ticket_id;

  saved_id := matching_saved_id;
  result_state := case when row_was_created then 'saved' else 'duplicate' end;
  return next;
end;
$$;

create or replace function public.skip_takeout_import_row(
  batch_id_input uuid,
  source_row_key_input text,
  normalized_input jsonb
)
returns public.import_row_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_row_key text;
  current_row_state public.import_row_state;
begin
  perform private.assert_active_import_owner(batch_id_input);
  normalized_row_key := btrim(source_row_key_input);

  if normalized_row_key is null
    or char_length(normalized_row_key) not between 1 and 256
    or normalized_input is null
    or jsonb_typeof(normalized_input) <> 'object'
    or exists (
      select 1
      from jsonb_object_keys(normalized_input) as input_key(key)
      where input_key.key not in ('input_title', 'input_url', 'own_note', 'input_tags')
    )
    or (normalized_input ? 'input_title' and (
      jsonb_typeof(normalized_input -> 'input_title') <> 'string'
      or char_length(btrim(normalized_input ->> 'input_title')) > 500
    ))
    or (normalized_input ? 'input_url' and (
      jsonb_typeof(normalized_input -> 'input_url') <> 'string'
      or char_length(btrim(normalized_input ->> 'input_url')) > 10_000
    ))
    or (normalized_input ? 'own_note' and (
      jsonb_typeof(normalized_input -> 'own_note') <> 'string'
      or char_length(btrim(normalized_input ->> 'own_note')) > 10_000
    ))
    or (normalized_input ? 'input_tags' and (
      jsonb_typeof(normalized_input -> 'input_tags') <> 'array'
      or jsonb_array_length(normalized_input -> 'input_tags') > 100
      or exists (
        select 1
        from jsonb_array_elements(normalized_input -> 'input_tags') as tag(value)
        where jsonb_typeof(tag.value) <> 'string'
          or char_length(btrim(tag.value #>> '{}')) not between 1 and 100
      )
    )) then
    raise exception using errcode = '22023', message = 'Invalid import row input';
  end if;

  insert into private.import_rows (batch_id, source_row_key, normalized_input, state)
  values (batch_id_input, normalized_row_key, normalized_input, 'skipped')
  on conflict (batch_id, source_row_key) do nothing;

  select state
  into current_row_state
  from private.import_rows
  where batch_id = batch_id_input
    and source_row_key = normalized_row_key
  for update;

  if current_row_state = 'pending' then
    update private.import_rows
    set state = 'skipped', error_code = null
    where batch_id = batch_id_input
      and source_row_key = normalized_row_key;
    return 'skipped';
  end if;

  return current_row_state;
end;
$$;

create or replace function public.cancel_takeout_import_batch(batch_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_active_import_owner(batch_id_input);

  update private.import_batches
  set state = 'cancelled'
  where id = batch_id_input;
end;
$$;

revoke all on function private.assert_active_import_owner(uuid) from public;
revoke all on function public.begin_takeout_import_batch(uuid, text, text) from public;
revoke all on function public.list_takeout_import_rows(uuid) from public;
revoke all on function public.commit_takeout_import_row(uuid, text, uuid, text, text, text, jsonb, uuid) from public;
revoke all on function public.skip_takeout_import_row(uuid, text, jsonb) from public;
revoke all on function public.cancel_takeout_import_batch(uuid) from public;

grant execute on function public.begin_takeout_import_batch(uuid, text, text) to authenticated;
grant execute on function public.list_takeout_import_rows(uuid) to authenticated;
grant execute on function public.commit_takeout_import_row(uuid, text, uuid, text, text, text, jsonb, uuid) to authenticated;
grant execute on function public.skip_takeout_import_row(uuid, text, jsonb) to authenticated;
grant execute on function public.cancel_takeout_import_batch(uuid) to authenticated;
