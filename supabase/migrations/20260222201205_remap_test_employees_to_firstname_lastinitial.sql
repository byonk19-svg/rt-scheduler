update public.profiles
set full_name = case email
  when 'employee01@teamwise.test' then 'Jannie B.'
  when 'employee02@teamwise.test' then 'Julie C.'
  when 'employee03@teamwise.test' then 'Barbara C.'
  when 'employee04@teamwise.test' then 'Nicole G.'
  when 'employee05@teamwise.test' then 'Ruth G.'
  when 'employee06@teamwise.test' then 'Roy H.'
  when 'employee07@teamwise.test' then 'Denise H.'
  when 'employee08@teamwise.test' then 'Mark J.'
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
