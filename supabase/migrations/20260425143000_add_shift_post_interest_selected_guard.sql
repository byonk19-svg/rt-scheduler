-- Migration: add_shift_post_interest_selected_guard
-- Created: 2026-04-25
-- Description: Enforce a single selected pickup claimant per shift post and stabilize queue ordering reads.

BEGIN;

with ranked_selected_interests as (
  select
    interest.id,
    post.status as post_status,
    row_number() over (
      partition by interest.shift_post_id
      order by interest.created_at asc, interest.id asc
    ) as selected_rank
  from public.shift_post_interests interest
  join public.shift_posts post on post.id = interest.shift_post_id
  where interest.status = 'selected'
)
update public.shift_post_interests interest
set
  status = case
    when ranked.post_status = 'pending' then 'pending'
    else 'declined'
  end,
  responded_at = case
    when ranked.post_status = 'pending' then null
    else coalesce(interest.responded_at, now())
  end
from ranked_selected_interests ranked
where ranked.id = interest.id
  and ranked.selected_rank > 1;

create unique index if not exists shift_post_interests_one_selected_per_post_idx
  on public.shift_post_interests (shift_post_id)
  where status = 'selected';

create index if not exists shift_post_interests_queue_order_idx
  on public.shift_post_interests (shift_post_id, status, created_at asc, id asc)
  where status in ('pending', 'selected');

COMMIT;
