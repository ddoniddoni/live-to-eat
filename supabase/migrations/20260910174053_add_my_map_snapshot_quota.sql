-- B08: A map refresh can fan out to Google Place Details requests. Keep the
-- counter private and expose it only to the trusted Edge Function.

create table private.my_map_refresh_rate_windows (
  user_id uuid primary key references auth.users (id) on delete cascade,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  constraint my_map_refresh_rate_windows_request_count_check check (request_count >= 0)
);

alter table private.my_map_refresh_rate_windows enable row level security;
revoke all on table private.my_map_refresh_rate_windows from anon, authenticated;

create or replace function public.consume_my_map_refresh_quota(refresh_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_request_count integer;
begin
  if refresh_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid map refresh request';
  end if;

  insert into private.my_map_refresh_rate_windows as rate_window (
    user_id,
    request_count,
    window_started_at
  )
  values (refresh_user_id, 1, now())
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

  if next_request_count > 8 then
    raise exception using
      errcode = 'P0001',
      message = 'Map refresh rate limit reached';
  end if;
end;
$$;

revoke all on function public.consume_my_map_refresh_quota(uuid) from public;
grant execute on function public.consume_my_map_refresh_quota(uuid) to service_role;
