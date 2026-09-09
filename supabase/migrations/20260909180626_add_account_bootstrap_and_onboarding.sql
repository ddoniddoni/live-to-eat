-- B06: authenticated callers can only initialize their own account and finish onboarding.
-- Profile and account-state writes remain unavailable as raw Data API table operations.

create or replace function public.bootstrap_account()
returns public.account_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_state public.account_state;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  insert into private.account_states (user_id, state)
  values (current_user_id, 'onboarding')
  on conflict (user_id) do nothing;

  select state
  into current_state
  from private.account_states
  where user_id = current_user_id;

  return current_state;
end;
$$;

create or replace function public.complete_onboarding(
  profile_handle text,
  profile_display_name text,
  profile_locale text,
  profile_time_zone text,
  accepted_terms_version text,
  accepted_privacy_notice_version text,
  accepted_age_gate_version text,
  age_confirmed boolean
)
returns public.account_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_state public.account_state;
  normalized_handle text;
  normalized_display_name text;
  normalized_locale text;
  normalized_time_zone text;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  normalized_handle := lower(btrim(profile_handle));
  normalized_display_name := btrim(profile_display_name);
  normalized_locale := btrim(profile_locale);
  normalized_time_zone := btrim(profile_time_zone);

  if profile_handle is null
    or profile_display_name is null
    or profile_locale is null
    or profile_time_zone is null
    or accepted_terms_version is null
    or accepted_privacy_notice_version is null
    or accepted_age_gate_version is null
    or normalized_handle !~ '^[a-z0-9][a-z0-9_]{2,29}$'
    or char_length(normalized_display_name) not between 1 and 80
    or char_length(normalized_locale) not between 1 and 35
    or char_length(normalized_time_zone) not between 1 and 64
    or char_length(btrim(accepted_terms_version)) not between 1 and 64
    or char_length(btrim(accepted_privacy_notice_version)) not between 1 and 64
    or char_length(btrim(accepted_age_gate_version)) not between 1 and 64
    or age_confirmed is not true then
    raise exception using
      errcode = '22023',
      message = 'Invalid onboarding input';
  end if;

  insert into private.account_states (user_id, state)
  values (current_user_id, 'onboarding')
  on conflict (user_id) do nothing;

  select state
  into current_state
  from private.account_states
  where user_id = current_user_id
  for update;

  if current_state in ('suspended', 'deleting') then
    raise exception using
      errcode = 'P0001',
      message = 'This account cannot be activated';
  end if;

  if current_state = 'active' then
    return current_state;
  end if;

  insert into public.profiles (
    id,
    handle,
    display_name,
    locale,
    time_zone
  )
  values (
    current_user_id,
    normalized_handle,
    normalized_display_name,
    normalized_locale,
    normalized_time_zone
  );

  insert into public.user_settings (
    user_id,
    terms_version,
    privacy_notice_version,
    age_gate_version,
    age_confirmed
  )
  values (
    current_user_id,
    btrim(accepted_terms_version),
    btrim(accepted_privacy_notice_version),
    btrim(accepted_age_gate_version),
    true
  );

  update private.account_states
  set state = 'active', changed_at = now()
  where user_id = current_user_id;

  return 'active';
end;
$$;

revoke all on function public.bootstrap_account() from public;
revoke all on function public.complete_onboarding(text, text, text, text, text, text, text, boolean) from public;

grant execute on function public.bootstrap_account() to authenticated;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text, boolean) to authenticated;
