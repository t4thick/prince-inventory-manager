-- Profit follows the final customer price, including configured tax.
begin;

update public.sale_items item
set gross_profit = case
  when sale.voided_at is null then item.line_total - item.line_cost
  else 0
end
from public.sales sale
where sale.id = item.sale_id;

update public.sale_financials financial
set gross_profit = case
  when sale.voided_at is null then sale.total - financial.cost_total
  else 0
end
from public.sales sale
where sale.id = financial.sale_id;

do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.record_sale_v2(text,jsonb,text,numeric,text,uuid,text,text,text,date,text,text,timestamptz)'::regprocedure
  ) into definition;
  if strpos(definition, 'line_subtotal - line_cost') = 0 or strpos(definition, 'subtotal_value - cost_value') = 0 then
    raise exception 'Expected profit calculations were not found';
  end if;
  definition := replace(definition, 'line_subtotal - line_cost', 'line_total - line_cost');
  definition := replace(definition, 'subtotal_value - cost_value', 'total_value - cost_value');
  execute definition;
end;
$migration$;

commit;
