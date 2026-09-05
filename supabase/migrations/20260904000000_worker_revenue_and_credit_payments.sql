-- Workers can see their own revenue and service shared Pay Later accounts.
begin;

alter policy "sales read" on public.sales using (
  public.is_owner() or worker_id = auth.uid() or payment_method = 'credit'
);
alter policy "customers members read" on public.customers using (
  public.is_authenticated_member()
);
alter policy "payments members read" on public.payments using (
  public.is_authenticated_member()
);

create or replace function public.record_customer_payment(
  p_sale_id text,
  p_amount numeric,
  p_payment_method text,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.sales%rowtype;
  new_paid numeric(12,2);
  new_balance numeric(12,2);
  new_status text;
begin
  if not public.is_authenticated_member() then raise exception 'Not signed in'; end if;
  if p_payment_method not in ('cash', 'mobile_money') then
    raise exception 'Invalid payment method';
  end if;
  if p_amount is null or round(p_amount, 2) <= 0 then
    raise exception 'Payment must be greater than zero';
  end if;

  select * into sale_row from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.voided_at is not null then raise exception 'Sale is voided'; end if;
  if sale_row.balance_due <= 0 then raise exception 'Sale is already paid'; end if;
  if round(p_amount, 2) > sale_row.balance_due then
    raise exception 'Payment cannot exceed balance due';
  end if;

  new_paid := sale_row.amount_paid + round(p_amount, 2);
  new_balance := sale_row.total - new_paid;
  new_status := case when new_balance = 0 then 'paid' else 'partial' end;

  insert into public.payments (
    sale_id, customer_id, amount, payment_method, notes, recorded_by
  ) values (
    sale_row.id, sale_row.customer_id, round(p_amount, 2),
    p_payment_method, trim(coalesce(p_notes, '')), auth.uid()
  );

  update public.sales
  set amount_paid = new_paid, balance_due = new_balance, payment_status = new_status
  where id = sale_row.id;

  return jsonb_build_object(
    'ok', true, 'amountPaid', new_paid,
    'balanceDue', new_balance, 'paymentStatus', new_status
  );
end;
$$;

revoke all on function public.record_customer_payment(text, numeric, text, text) from public, anon;
grant execute on function public.record_customer_payment(text, numeric, text, text) to authenticated;

commit;
