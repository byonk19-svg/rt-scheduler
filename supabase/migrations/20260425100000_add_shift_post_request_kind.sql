alter table public.shift_posts
  add column if not exists request_kind text not null default 'standard'
  check (request_kind in ('standard', 'call_in'));

create unique index if not exists shift_posts_one_pending_call_in_per_shift_idx
  on public.shift_posts (shift_id)
  where request_kind = 'call_in' and status = 'pending';

comment on column public.shift_posts.request_kind is
  'standard = regular swap/pickup request, call_in = lead/manager-triggered help alert for a called-in shift.';
