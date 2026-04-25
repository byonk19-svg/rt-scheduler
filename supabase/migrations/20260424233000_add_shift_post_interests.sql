create table if not exists public.shift_post_interests (
  id uuid primary key default gen_random_uuid(),
  shift_post_id uuid not null references public.shift_posts(id) on delete cascade,
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'withdrawn', 'selected', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists shift_post_interests_active_unique_idx
  on public.shift_post_interests (shift_post_id, therapist_id)
  where status in ('pending', 'selected');

create index if not exists shift_post_interests_post_status_idx
  on public.shift_post_interests (shift_post_id, status, created_at asc);

alter table public.shift_post_interests enable row level security;

drop policy if exists "Managers can read shift post interests" on public.shift_post_interests;
create policy "Managers can read shift post interests"
  on public.shift_post_interests
  for select
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
    )
  );

drop policy if exists "Post participants can read shift post interests" on public.shift_post_interests;
create policy "Post participants can read shift post interests"
  on public.shift_post_interests
  for select
  using (
    therapist_id = auth.uid()
    or exists (
      select 1
      from public.shift_posts post
      where post.id = shift_post_interests.shift_post_id
        and post.posted_by = auth.uid()
    )
  );

drop policy if exists "Therapists can create their own shift post interest" on public.shift_post_interests;
create policy "Therapists can create their own shift post interest"
  on public.shift_post_interests
  for insert
  with check (
    therapist_id = auth.uid()
    and exists (
      select 1
      from public.shift_posts post
      where post.id = shift_post_interests.shift_post_id
        and coalesce(post.visibility, 'team') = 'team'
        and post.status = 'pending'
        and post.posted_by is distinct from auth.uid()
    )
  );

drop policy if exists "Therapists can update their own shift post interest" on public.shift_post_interests;
create policy "Therapists can update their own shift post interest"
  on public.shift_post_interests
  for update
  using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());

drop policy if exists "Managers can update shift post interests" on public.shift_post_interests;
create policy "Managers can update shift post interests"
  on public.shift_post_interests
  for update
  using (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.role = 'manager'
        and actor.is_active = true
        and actor.archived_at is null
    )
  );
