-- Regression for Auth's insert-then-update sequence. Everything rolls back.
begin;
do $$
declare
  owner_id uuid;
  worker_id uuid := gen_random_uuid();
  denied_id uuid := gen_random_uuid();
begin
  select id into owner_id from public.profiles where role = 'owner' limit 1;
  if owner_id is null then raise exception 'Test needs an existing owner'; end if;
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
  values (worker_id, worker_id::text || '@staff-test.invalid', '{"display_name":"Staff regression"}', '{"provider":"email"}');
  update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('provisioned_by_owner', owner_id)
  where id = worker_id;
  set constraints auth.on_auth_user_created immediate;
  if not exists (select 1 from public.profiles where id=worker_id and role='worker' and display_name='Staff regression') then
    raise exception 'Approved account did not receive worker profile';
  end if;
  set constraints auth.on_auth_user_created deferred;
  -- Public metadata cannot pretend to be an owner approval.
  begin
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values (denied_id, denied_id::text || '@staff-test.invalid', jsonb_build_object('provisioned_by_owner',owner_id), '{}');
    set constraints auth.on_auth_user_created immediate;
    raise exception 'SECURITY FAILURE: public signup accepted';
  exception when raise_exception then
    if sqlerrm <> 'Accounts must be created by the shop owner' then raise; end if;
  end;
  -- A worker cannot approve another account either.
  set constraints auth.on_auth_user_created deferred;
  begin
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
    values (denied_id, denied_id::text || '@staff-test.invalid', '{}', jsonb_build_object('provisioned_by_owner',worker_id));
    set constraints auth.on_auth_user_created immediate;
    raise exception 'SECURITY FAILURE: worker approval accepted';
  exception when raise_exception then
    if sqlerrm <> 'Accounts must be created by the shop owner' then raise; end if;
  end;
end;
$$;
rollback;
