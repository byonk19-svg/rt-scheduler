create table public.cycle_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  shift_data jsonb not null
);

alter table public.cycle_templates enable row level security;

create policy "Managers can manage templates" on public.cycle_templates
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'manager'
    )
  )
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'manager'
    )
  );
