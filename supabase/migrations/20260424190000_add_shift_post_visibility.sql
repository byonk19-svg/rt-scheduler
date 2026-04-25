alter table public.shift_posts
  add column if not exists visibility text not null default 'team'
  check (visibility in ('team', 'direct'));

comment on column public.shift_posts.visibility is
  'team = visible on the shared board, direct = private between requester, recipient, and managers.';
