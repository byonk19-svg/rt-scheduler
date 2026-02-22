update public.profiles
set full_name = case email
  when 'employee01@teamwise.test' then 'Ava Patel'
  when 'employee02@teamwise.test' then 'Marcus Reed'
  when 'employee03@teamwise.test' then 'Nina Lopez'
  when 'employee04@teamwise.test' then 'Ethan Brooks'
  when 'employee05@teamwise.test' then 'Maya Chen'
  when 'employee06@teamwise.test' then 'Isaac Turner'
  when 'employee07@teamwise.test' then 'Leah Morgan'
  when 'employee08@teamwise.test' then 'Noah Rivera'
  else full_name
end
where email in (
  'employee01@teamwise.test',
  'employee02@teamwise.test',
  'employee03@teamwise.test',
  'employee04@teamwise.test',
  'employee05@teamwise.test',
  'employee06@teamwise.test',
  'employee07@teamwise.test',
  'employee08@teamwise.test'
);
