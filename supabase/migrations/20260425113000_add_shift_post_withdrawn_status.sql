alter table public.shift_posts
  drop constraint if exists shift_posts_status_check;

alter table public.shift_posts
  add constraint shift_posts_status_check
  check (status = any (array['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text, 'withdrawn'::text]));
