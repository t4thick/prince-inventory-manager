-- Reject demo catalog inserts from older app versions after handover.
-- Existing rows are retained until the separately backed-up, operator-run reset.
create or replace function public.reject_legacy_demo_seed()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id in ('p_oil','p_filter_oil','p_brake','p_spark','p_air','p_coolant','p_svc_oil','p_svc_brake') then
    raise exception 'Demo inventory is disabled. Refresh the app and add your own products.';
  end if;
  return new;
end;
$$;
create trigger reject_legacy_demo_seed before insert on public.products
for each row execute function public.reject_legacy_demo_seed();
