-- B05 foundation: account state, private saved-place records, and an international region catalog.
-- The Data API exposes only the public schema. Sensitive data remains in private, and public
-- tables receive explicit authenticated grants plus row-level policies.

create schema if not exists private;

revoke all on schema public from anon;
revoke create on schema public from public;
revoke all on schema private from public;

create type public.account_state as enum ('onboarding', 'active', 'suspended', 'deleting');
create type public.place_provider as enum ('google');
create type public.saved_resolution_state as enum ('resolved', 'unresolved');
create type public.saved_visibility as enum ('private', 'unlisted', 'public');
create type public.visit_status as enum ('want', 'visited');
create type public.collection_origin as enum ('manual', 'takeout');
create type public.saved_region_origin as enum ('user_selected', 'independent_source');

create table private.account_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state public.account_state not null default 'onboarding',
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text,
  public_map_enabled boolean not null default false,
  locale text not null default 'en',
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format_check
    check (handle ~ '^[a-z0-9][a-z0-9_]{2,29}$'),
  constraint profiles_display_name_length_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 280),
  constraint profiles_locale_length_check
    check (char_length(btrim(locale)) between 1 and 35),
  constraint profiles_time_zone_length_check
    check (char_length(btrim(time_zone)) between 1 and 64)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  terms_version text,
  privacy_notice_version text,
  age_gate_version text,
  age_confirmed boolean not null default false,
  analytics_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_terms_version_length_check
    check (terms_version is null or char_length(terms_version) <= 64),
  constraint user_settings_privacy_notice_version_length_check
    check (privacy_notice_version is null or char_length(privacy_notice_version) <= 64),
  constraint user_settings_age_gate_version_length_check
    check (age_gate_version is null or char_length(age_gate_version) <= 64)
);

create table public.place_refs (
  id uuid primary key default gen_random_uuid(),
  provider public.place_provider not null default 'google',
  provider_place_id text not null,
  replacement_ref_id uuid references public.place_refs (id) on delete set null,
  id_checked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint place_refs_provider_place_id_length_check
    check (char_length(btrim(provider_place_id)) between 1 and 512),
  constraint place_refs_provider_place_id_unique unique (provider, provider_place_id)
);

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_ref_id uuid references public.place_refs (id) on delete restrict,
  resolution_state public.saved_resolution_state not null,
  visibility public.saved_visibility not null default 'private',
  visit_status public.visit_status not null default 'want',
  is_recommended boolean not null default false,
  public_note text,
  exposure_epoch integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_places_resolution_reference_check
    check (
      (resolution_state = 'resolved' and place_ref_id is not null)
      or (resolution_state = 'unresolved' and place_ref_id is null)
    ),
  constraint saved_places_unresolved_visibility_check
    check (resolution_state = 'resolved' or visibility = 'private'),
  constraint saved_places_recommendation_requires_visit_check
    check (not is_recommended or visit_status = 'visited'),
  constraint saved_places_public_note_length_check
    check (public_note is null or char_length(public_note) <= 280),
  constraint saved_places_exposure_epoch_check check (exposure_epoch >= 0),
  constraint saved_places_version_check check (version >= 1)
);

create unique index saved_places_one_resolved_place_per_user_idx
  on public.saved_places (user_id, place_ref_id)
  where resolution_state = 'resolved';

create index saved_places_user_created_at_idx
  on public.saved_places (user_id, created_at desc, id desc);

create index saved_places_user_visibility_idx
  on public.saved_places (user_id, visibility)
  where resolution_state = 'resolved';

create index saved_places_place_ref_id_idx on public.saved_places (place_ref_id);
create index place_refs_replacement_ref_id_idx on public.place_refs (replacement_ref_id);

create table public.saved_private (
  saved_id uuid primary key references public.saved_places (id) on delete cascade,
  personal_note text,
  tags jsonb not null default '[]'::jsonb,
  visited_on date,
  user_label text,
  input_provenance text not null default 'manual',
  original_url text,
  imported_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_private_tags_array_check check (jsonb_typeof(tags) = 'array'),
  constraint saved_private_imported_notes_object_check check (jsonb_typeof(imported_notes) = 'object'),
  constraint saved_private_user_label_length_check
    check (user_label is null or char_length(user_label) <= 120),
  constraint saved_private_input_provenance_check
    check (input_provenance in ('manual', 'google_link', 'google_takeout', 'copied')),
  constraint saved_private_original_url_length_check
    check (original_url is null or char_length(original_url) <= 10_000)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  origin public.collection_origin not null default 'manual',
  import_source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_name_length_check check (char_length(btrim(name)) between 1 and 120),
  constraint collections_import_source_key_length_check
    check (import_source_key is null or char_length(import_source_key) <= 512),
  constraint collections_takeout_source_key_check
    check (origin <> 'takeout' or import_source_key is not null)
);

create index collections_user_created_at_idx
  on public.collections (user_id, created_at desc, id desc);

create unique index collections_user_import_source_key_idx
  on public.collections (user_id, import_source_key)
  where import_source_key is not null;

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  saved_id uuid not null references public.saved_places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, saved_id)
);

create index collection_items_saved_id_idx on public.collection_items (saved_id);

create table public.region_nodes (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  parent_id uuid references public.region_nodes (id) on delete restrict,
  kind text not null,
  source_key text not null,
  source_id text not null,
  localized_names jsonb not null default '{}'::jsonb,
  source_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint region_nodes_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint region_nodes_kind_length_check check (char_length(btrim(kind)) between 1 and 64),
  constraint region_nodes_source_key_length_check check (char_length(btrim(source_key)) between 1 and 128),
  constraint region_nodes_source_id_length_check check (char_length(btrim(source_id)) between 1 and 256),
  constraint region_nodes_source_version_length_check
    check (char_length(btrim(source_version)) between 1 and 128),
  constraint region_nodes_localized_names_object_check check (jsonb_typeof(localized_names) = 'object'),
  constraint region_nodes_country_is_root_check check (kind <> 'country' or parent_id is null),
  constraint region_nodes_source_identity_unique unique (source_key, source_id)
);

create index region_nodes_parent_id_idx on public.region_nodes (parent_id);
create index region_nodes_country_parent_idx on public.region_nodes (country_code, parent_id);

create table public.region_closure (
  ancestor_id uuid not null references public.region_nodes (id) on delete cascade,
  descendant_id uuid not null references public.region_nodes (id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id),
  constraint region_closure_depth_check check (depth >= 0)
);

create index region_closure_descendant_ancestor_idx
  on public.region_closure (descendant_id, ancestor_id);

create table public.saved_regions (
  saved_id uuid not null references public.saved_places (id) on delete cascade,
  region_id uuid not null references public.region_nodes (id) on delete restrict,
  origin public.saved_region_origin not null,
  selected_at timestamptz not null default now(),
  primary key (saved_id, region_id)
);

create index saved_regions_region_saved_idx on public.saved_regions (region_id, saved_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger user_settings_touch_updated_at
before update on public.user_settings
for each row execute function private.touch_updated_at();

create trigger saved_places_touch_updated_at
before update on public.saved_places
for each row execute function private.touch_updated_at();

create trigger saved_private_touch_updated_at
before update on public.saved_private
for each row execute function private.touch_updated_at();

create trigger collections_touch_updated_at
before update on public.collections
for each row execute function private.touch_updated_at();

create trigger region_nodes_touch_updated_at
before update on public.region_nodes
for each row execute function private.touch_updated_at();

create or replace function private.ensure_region_parent_is_acyclic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  would_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception using
      errcode = '23514',
      message = 'A region cannot be its own parent';
  end if;

  with recursive lineage as (
    select id, parent_id
    from public.region_nodes
    where id = new.parent_id

    union all

    select parent.id, parent.parent_id
    from public.region_nodes as parent
    join lineage on lineage.parent_id = parent.id
  )
  select exists (select 1 from lineage where id = new.id)
  into would_cycle;

  if would_cycle then
    raise exception using
      errcode = '23514',
      message = 'A region parent assignment cannot create a cycle';
  end if;

  return new;
end;
$$;

create trigger region_nodes_prevent_cycles
before insert or update of parent_id on public.region_nodes
for each row execute function private.ensure_region_parent_is_acyclic();

create or replace function private.enforce_collection_item_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.collections as collection
    join public.saved_places as saved on saved.id = new.saved_id
    where collection.id = new.collection_id
      and collection.user_id = saved.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A collection can contain only its owner''s saved places';
  end if;

  return new;
end;
$$;

create constraint trigger collection_items_require_matching_owner
after insert or update of collection_id, saved_id on public.collection_items
deferrable initially immediate
for each row execute function private.enforce_collection_item_owner();

create or replace function private.rebuild_region_closure()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.region_closure;

  insert into public.region_closure (ancestor_id, descendant_id, depth)
  with recursive paths as (
    select id as ancestor_id, id as descendant_id, 0 as depth
    from public.region_nodes

    union all

    select paths.ancestor_id, child.id, paths.depth + 1
    from paths
    join public.region_nodes as child on child.parent_id = paths.descendant_id
  )
  select ancestor_id, descendant_id, depth
  from paths;
end;
$$;

create or replace function private.current_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.account_states
    where user_id = (select auth.uid())
      and state = 'active'
  );
$$;

create or replace function public.current_account_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select state::text
  from private.account_states
  where user_id = (select auth.uid());
$$;

revoke all on function private.touch_updated_at() from public;
revoke all on function private.ensure_region_parent_is_acyclic() from public;
revoke all on function private.enforce_collection_item_owner() from public;
revoke all on function private.rebuild_region_closure() from public;
revoke all on function private.current_account_is_active() from public;
revoke all on function public.current_account_state() from public;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_account_is_active() to authenticated;
grant execute on function public.current_account_state() to authenticated;

revoke all on table private.account_states from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
revoke all on table public.place_refs from anon, authenticated;
revoke all on table public.saved_places from anon, authenticated;
revoke all on table public.saved_private from anon, authenticated;
revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_items from anon, authenticated;
revoke all on table public.region_nodes from anon, authenticated;
revoke all on table public.region_closure from anon, authenticated;
revoke all on table public.saved_regions from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.user_settings to authenticated;
grant select on table public.saved_places to authenticated;
grant select on table public.saved_private to authenticated;
grant select on table public.collections to authenticated;
grant select on table public.collection_items to authenticated;
grant select on table public.region_nodes to authenticated;
grant select on table public.saved_regions to authenticated;

alter table private.account_states enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.place_refs enable row level security;
alter table public.saved_places enable row level security;
alter table public.saved_private enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.region_nodes enable row level security;
alter table public.region_closure enable row level security;
alter table public.saved_regions enable row level security;

create policy profiles_owner_select_active
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  and (select private.current_account_is_active())
);

create policy user_settings_owner_select_active
on public.user_settings
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_account_is_active())
);

create policy saved_places_owner_select_active
on public.saved_places
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_account_is_active())
);

create policy saved_private_owner_select_active
on public.saved_private
for select
to authenticated
using (
  (select private.current_account_is_active())
  and exists (
    select 1
    from public.saved_places
    where saved_places.id = saved_private.saved_id
      and saved_places.user_id = (select auth.uid())
  )
);

create policy collections_owner_select_active
on public.collections
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_account_is_active())
);

create policy collection_items_owner_select_active
on public.collection_items
for select
to authenticated
using (
  (select private.current_account_is_active())
  and exists (
    select 1
    from public.collections
    where collections.id = collection_items.collection_id
      and collections.user_id = (select auth.uid())
  )
);

create policy region_nodes_authenticated_catalog_select
on public.region_nodes
for select
to authenticated
using (true);

create policy saved_regions_owner_select_active
on public.saved_regions
for select
to authenticated
using (
  (select private.current_account_is_active())
  and exists (
    select 1
    from public.saved_places
    where saved_places.id = saved_regions.saved_id
      and saved_places.user_id = (select auth.uid())
  )
);
