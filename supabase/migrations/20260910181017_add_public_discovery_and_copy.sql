-- B12: Keep public discovery behind narrow server DTO functions. The mobile
-- client never receives a public table policy that could expose private fields.

create index saved_places_public_discovery_idx
  on public.saved_places (user_id, updated_at desc, id desc)
  where resolution_state = 'resolved' and visibility = 'public';

create table private.public_map_read_rate_windows (
  user_id uuid primary key references auth.users (id) on delete cascade,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  constraint public_map_read_rate_windows_request_count_check check (request_count >= 0)
);

alter table private.public_map_read_rate_windows enable row level security;
revoke all on table private.public_map_read_rate_windows from anon, authenticated;

create or replace function public.consume_public_map_read_quota(requesting_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_request_count integer;
begin
  if requesting_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid public map request';
  end if;

  insert into private.public_map_read_rate_windows as rate_window (
    user_id,
    request_count,
    window_started_at
  )
  values (requesting_user_id, 1, now())
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
    raise exception using errcode = 'P0001', message = 'Public map read rate limit reached';
  end if;
end;
$$;

create or replace function public.list_discoverable_public_maps()
returns table (
  owner_id uuid,
  handle text,
  display_name text,
  bio text,
  public_place_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.handle,
    profile.display_name,
    profile.bio,
    count(saved.id)
  from public.profiles as profile
  join private.account_states as account_state
    on account_state.user_id = profile.id
    and account_state.state = 'active'
  join public.saved_places as saved
    on saved.user_id = profile.id
    and saved.resolution_state = 'resolved'
    and saved.visibility = 'public'
  where profile.public_map_enabled
  group by profile.id, profile.handle, profile.display_name, profile.bio
  order by max(saved.updated_at) desc, profile.handle asc
  limit 20;
$$;

create or replace function public.read_public_map(public_handle text)
returns table (
  owner_id uuid,
  handle text,
  display_name text,
  bio text,
  saved_id uuid,
  provider_place_id text,
  public_note text,
  public_place_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.handle,
    profile.display_name,
    profile.bio,
    saved.id,
    place_ref.provider_place_id,
    saved.public_note,
    count(saved.id) over ()
  from public.profiles as profile
  join private.account_states as account_state
    on account_state.user_id = profile.id
    and account_state.state = 'active'
  join public.saved_places as saved
    on saved.user_id = profile.id
    and saved.resolution_state = 'resolved'
    and saved.visibility = 'public'
  join public.place_refs as place_ref on place_ref.id = saved.place_ref_id
  where profile.public_map_enabled
    and profile.handle = lower(btrim(public_handle))
  order by saved.updated_at desc, saved.id desc
  limit 24;
$$;

create or replace function public.set_public_map_enabled(enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null or not (select private.current_account_is_active()) then
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  update public.profiles
  set public_map_enabled = enabled
  where id = current_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile is unavailable';
  end if;

  return enabled;
end;
$$;

create or replace function public.set_saved_place_visibility(
  saved_id_input uuid,
  expected_version_input integer,
  visibility_input public.saved_visibility,
  public_note_input text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  next_version integer;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null or not (select private.current_account_is_active()) then
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  if saved_id_input is null
    or expected_version_input is null
    or expected_version_input < 1
    or visibility_input is null
    or (public_note_input is not null and char_length(btrim(public_note_input)) > 280) then
    raise exception using errcode = '22023', message = 'Invalid saved place visibility';
  end if;

  update public.saved_places
  set
    visibility = visibility_input,
    public_note = case
      when public_note_input is null then public_note
      else nullif(btrim(public_note_input), '')
    end,
    version = version + 1
  where id = saved_id_input
    and user_id = current_user_id
    and resolution_state = 'resolved'
    and version = expected_version_input
  returning version into next_version;

  if next_version is null then
    raise exception using errcode = 'P0002', message = 'Saved place is unavailable or changed';
  end if;

  return next_version;
end;
$$;

create or replace function public.copy_public_saved_place(source_saved_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  source_place_ref_id uuid;
  copied_saved_id uuid;
  was_created boolean := false;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null or not (select private.current_account_is_active()) then
    raise exception using errcode = '42501', message = 'An active account is required';
  end if;

  select source.place_ref_id
  into source_place_ref_id
  from public.saved_places as source
  join public.profiles as source_profile
    on source_profile.id = source.user_id
    and source_profile.public_map_enabled
  join private.account_states as source_account_state
    on source_account_state.user_id = source.user_id
    and source_account_state.state = 'active'
  where source.id = source_saved_id_input
    and source.user_id <> current_user_id
    and source.resolution_state = 'resolved'
    and source.visibility = 'public';

  if source_place_ref_id is null then
    raise exception using errcode = 'P0002', message = 'Public saved place is unavailable';
  end if;

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
    source_place_ref_id,
    'resolved',
    'private',
    'want',
    false
  )
  on conflict (user_id, place_ref_id) where resolution_state = 'resolved' do nothing
  returning id into copied_saved_id;

  was_created := copied_saved_id is not null;
  if copied_saved_id is null then
    select saved.id
    into copied_saved_id
    from public.saved_places as saved
    where saved.user_id = current_user_id
      and saved.place_ref_id = source_place_ref_id
      and saved.resolution_state = 'resolved';
  end if;

  if was_created then
    insert into public.saved_private (
      saved_id,
      personal_note,
      tags,
      input_provenance,
      imported_notes
    )
    values (
      copied_saved_id,
      null,
      '[]'::jsonb,
      'copied',
      '{}'::jsonb
    );
  end if;

  return copied_saved_id;
end;
$$;

revoke all on function public.list_discoverable_public_maps() from public;
revoke all on function public.read_public_map(text) from public;
revoke all on function public.consume_public_map_read_quota(uuid) from public;
revoke all on function public.set_public_map_enabled(boolean) from public;
revoke all on function public.set_saved_place_visibility(uuid, integer, public.saved_visibility, text) from public;
revoke all on function public.copy_public_saved_place(uuid) from public;

grant execute on function public.list_discoverable_public_maps() to service_role;
grant execute on function public.read_public_map(text) to service_role;
grant execute on function public.consume_public_map_read_quota(uuid) to service_role;
grant execute on function public.set_public_map_enabled(boolean) to authenticated;
grant execute on function public.set_saved_place_visibility(uuid, integer, public.saved_visibility, text) to authenticated;
grant execute on function public.copy_public_saved_place(uuid) to authenticated;
