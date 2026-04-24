alter table public.shift_posts
  add column if not exists recipient_response text null
  check (recipient_response in ('pending', 'accepted', 'declined'));

alter table public.shift_posts
  add column if not exists recipient_responded_at timestamptz null;

comment on column public.shift_posts.recipient_response is
  'For direct requests, tracks whether the targeted therapist has accepted or declined before manager approval.';

comment on column public.shift_posts.recipient_responded_at is
  'Timestamp when the targeted therapist last accepted or declined a direct request.';
