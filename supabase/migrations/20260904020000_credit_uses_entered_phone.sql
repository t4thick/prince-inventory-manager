-- A cashier-entered phone satisfies Pay Later even when the saved customer has no phone yet.
begin;
do $migration$
declare
  definition text;
  old_check text := E'    if trim(resolved_customer.phone) = '''' and trim(coalesce(p_vehicle_info, resolved_customer.vehicle_info)) = '''' then';
  new_check text := E'    if trim(coalesce(nullif(p_customer_phone, ''''), resolved_customer.phone, '''')) = '''' and trim(coalesce(nullif(p_vehicle_info, ''''), resolved_customer.vehicle_info, '''')) = '''' then';
begin
  select pg_get_functiondef(
    'public.record_sale_v2(text,jsonb,text,numeric,text,uuid,text,text,text,date,text,text,timestamptz)'::regprocedure
  ) into definition;
  if strpos(definition, old_check) = 0 then
    raise exception 'Expected Pay Later contact check was not found';
  end if;
  execute replace(definition, old_check, new_check);
end;
$migration$;
commit;
