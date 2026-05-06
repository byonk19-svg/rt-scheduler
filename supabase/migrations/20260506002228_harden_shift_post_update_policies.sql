-- Shift-post lifecycle transitions are enforced by service-role RPCs:
-- - app_create_shift_post_request
-- - app_respond_direct_shift_post
-- - app_withdraw_shift_post
-- - app_withdraw_shift_post_interest
-- - app_review_shift_post
-- - app_deny_pickup_claimant
--
-- Do not leave broad manager UPDATE policies on the REST-exposed tables. A
-- manager session can still review/deny/withdraw through the application API,
-- but raw PostgREST UPDATE calls must not be able to set arbitrary lifecycle
-- states or selected pickup interests.

begin;

drop policy if exists "Managers can update shift posts" on public.shift_posts;
drop policy if exists "Managers can update shift post interests" on public.shift_post_interests;

comment on table public.shift_posts is
  'Lifecycle writes are intentionally routed through service-role RPCs and trusted server routes; authenticated clients must not update shift_posts directly.';

comment on table public.shift_post_interests is
  'Pickup-interest writes are intentionally constrained to therapist withdrawal or service-role RPC review flows; managers must not update interests directly through PostgREST.';

commit;
