alter table public.cycle_templates
  add column if not exists site_id text not null default 'default';

update public.cycle_templates template
set site_id = profile.site_id
from public.profiles profile
where template.created_by = profile.id
  and template.site_id = 'default'
  and profile.site_id is not null;

create index if not exists cycle_templates_site_created_at_idx
  on public.cycle_templates (site_id, created_at desc);

drop policy if exists "Managers can manage templates" on public.cycle_templates;
create policy "Managers can manage site templates"
on public.cycle_templates
for all
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and coalesce(actor.is_active, true)
      and actor.archived_at is null
      and actor.site_id = cycle_templates.site_id
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role = 'manager'
      and coalesce(actor.is_active, true)
      and actor.archived_at is null
      and actor.site_id = cycle_templates.site_id
  )
);
