-- Add claim fields to shift_posts so therapists can volunteer for posted shifts.
-- claimed_by: the therapist who is taking the shift (pickup) or offering a trade (swap)
-- swap_shift_id: for swaps, the shift the claimer is offering in exchange

alter table public.shift_posts
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists swap_shift_id uuid references public.shifts(id) on delete set null;

create index if not exists shift_posts_claimed_by_idx
  on public.shift_posts (claimed_by)
  where claimed_by is not null;
