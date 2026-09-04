-- Auth admin.createUser writes app_metadata after inserting the auth user,
-- within the same transaction. Check the final row at transaction commit.
begin;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account auth.users%rowtype;
begin
  select * into account from auth.users where id = new.id;
  if not found then return new; end if;
  if not exists (
    select 1 from public.profiles
    where role = 'owner'
      and id::text = (account.raw_app_meta_data ->> 'provisioned_by_owner')
  ) then
    raise exception 'Accounts must be created by the shop owner';
  end if;
  insert into public.profiles (id, display_name, role)
  values (
    account.id,
    coalesce(nullif(trim(account.raw_user_meta_data ->> 'display_name'), ''), split_part(account.email, '@', 1)),
    'worker'
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create constraint trigger on_auth_user_created
  after insert on auth.users
  deferrable initially deferred
  for each row execute function public.handle_new_user();
commit;
