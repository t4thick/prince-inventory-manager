-- Workers service the same customer accounts when creating Pay Later sales.
begin;
do $migration$
declare
  definition text;
  old_guard text := E'  if p_customer_id is not null and not public.is_owner() then\n    raise exception ''Only the owner can access customer accounts'';\n  end if;\n\n';
begin
  select pg_get_functiondef(
    'public.record_sale_v2(text,jsonb,text,numeric,text,uuid,text,text,text,date,text,text,timestamptz)'::regprocedure
  ) into definition;
  if strpos(definition, old_guard) = 0 then
    raise exception 'Expected customer access guard was not found';
  end if;
  execute replace(definition, old_guard, '');
end;
$migration$;
commit;
