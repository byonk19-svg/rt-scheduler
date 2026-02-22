# Next Steps (Simple Checklist)

If you are new to coding, do these in order.

## 1) Finish local setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. In Supabase dashboard, copy:
   - Project URL
   - anon public key

3. Paste them into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 2) Make sure a profile row exists for every new user

The dashboard reads from `profiles`. The best long-term fix is a DB trigger.

Run this SQL in Supabase SQL Editor:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, shift_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'therapist'),
    coalesce(new.raw_user_meta_data->>'shift_type', 'day')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
```

## 3) Verify RLS policy for `profiles`

You should allow each user to read their own row.

Example policy:

```sql
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);
```

## 4) Test signup flow

1. Run app:

```bash
npm run dev
```

2. Create a new account at `/signup`.
3. Open `/dashboard`.
4. Check that name + role + shift type are visible.

## 5) Build next feature (Step 4)

After auth works, next build `availability_requests`:
- form to submit blackout dates
- list “my requests”
- manager review page
