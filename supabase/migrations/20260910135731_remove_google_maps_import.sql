-- Google Maps saved-list and link import are no longer product features.
-- Existing private saved places stay intact; only transient import machinery
-- and unfinished import batches are removed.

drop function if exists public.create_saved_from_google_link_ticket(
  uuid,
  text,
  text,
  jsonb,
  uuid,
  public.visit_status
);

drop function if exists public.issue_google_link_place_search_ticket(
  uuid,
  uuid,
  text,
  timestamptz,
  text
);

alter table private.place_search_tickets
drop column if exists source_input_hash;

drop function if exists public.begin_takeout_import_batch(uuid, text, text);
drop function if exists public.list_takeout_import_rows(uuid);
drop function if exists public.commit_takeout_import_row(uuid, text, uuid, text, text, text, jsonb, uuid);
drop function if exists public.skip_takeout_import_row(uuid, text, jsonb);
drop function if exists public.cancel_takeout_import_batch(uuid);
drop function if exists private.assert_active_import_owner(uuid);

drop table if exists private.import_rows;
drop table if exists private.import_batches;

drop type if exists public.import_row_state;
drop type if exists public.import_batch_state;
