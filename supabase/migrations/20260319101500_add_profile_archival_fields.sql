alter table public.profiles
add column if not exists archived_at timestamptz,
add column if not exists archived_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_archived_at_idx on public.profiles (archived_at);
