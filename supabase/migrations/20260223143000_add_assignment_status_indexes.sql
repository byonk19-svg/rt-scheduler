create index if not exists idx_shift_assignments_assignment_status
  on public.shifts (assignment_status);

create index if not exists idx_shift_assignments_status_updated_at
  on public.shifts (status_updated_at);
