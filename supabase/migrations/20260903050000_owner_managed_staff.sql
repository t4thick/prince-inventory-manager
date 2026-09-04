-- Preserve existing users and roles. Only owner-provisioned accounts may be added.
begin;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- app_metadata is set by the trusted admin API, not public sign-up metadata.
  if not exists (
    select 1 from public.profiles
    where role = 'owner'
      and id::text = new.raw_app_meta_data ->> 'provisioned_by_owner'
  ) then
    raise exception 'Accounts must be created by the shop owner';
  end if;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    'worker'
  );
  return new;
end;
$$;
commit;
