-- Restore the existing credit-sale path; collected payments remain Cash/Mobile Money.
begin;
create or replace function public.record_sale_v2(
  p_id text,
  p_items jsonb,
  p_payment_method text,
  p_amount_paid numeric default 0,
  p_initial_payment_method text default 'cash',
  p_customer_id uuid default null,
  p_customer_name text default '',
  p_customer_phone text default '',
  p_vehicle_info text default '',
  p_due_date date default null,
  p_notes text default '',
  p_worker_name text default '',
  p_device_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  product_row public.products%rowtype;
  resolved_customer public.customers%rowtype;
  line_no integer := 0;
  requested_qty integer;
  requested_tax boolean;
  requested_price numeric;
  effective_price numeric(12,2);
  effective_cost numeric(12,2);
  effective_tax_rate numeric(5,4);
  line_subtotal numeric(12,2);
  line_tax numeric(12,2);
  line_total numeric(12,2);
  line_cost numeric(12,2);
  subtotal_value numeric(12,2) := 0;
  tax_value numeric(12,2) := 0;
  total_value numeric(12,2) := 0;
  cost_value numeric(12,2) := 0;
  paid_value numeric(12,2);
  balance_value numeric(12,2);
  status_value text;
  receipt_value text;
  public_items jsonb := '[]'::jsonb;
  before_stock integer;
begin
  if not public.is_authenticated_member() then
    raise exception 'Not signed in';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'mobile_money', 'credit') then
    raise exception 'Invalid payment method';
  end if;

  if p_initial_payment_method is null or p_initial_payment_method not in ('cash', 'mobile_money') then
    raise exception 'Invalid initial payment method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must contain at least one item';
  end if;

  -- Idempotent retry for offline/network uncertainty.
  if exists (select 1 from public.sales where id = p_id) then
    if not exists (
      select 1 from public.sales where id = p_id and worker_id = auth.uid()
    ) then
      raise exception 'Sale ID already exists';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', p_id);
  end if;

  if p_customer_id is not null then
    select * into resolved_customer from public.customers where id = p_customer_id;
    if not found then raise exception 'Customer not found'; end if;
  elsif trim(coalesce(p_customer_name, '')) <> '' then
    insert into public.customers (name, phone, vehicle_info)
    values (trim(p_customer_name), trim(coalesce(p_customer_phone, '')), trim(coalesce(p_vehicle_info, '')))
    returning * into resolved_customer;
  end if;

  if p_payment_method = 'credit' then
    if resolved_customer.id is null then
      raise exception 'Customer is required for credit';
    end if;
    if trim(coalesce(nullif(p_customer_phone, ''), resolved_customer.phone, '')) = '' and trim(coalesce(nullif(p_vehicle_info, ''), resolved_customer.vehicle_info, '')) = '' then
      raise exception 'Phone or vehicle is required for credit';
    end if;
  end if;

  receipt_value := 'PA-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(md5(p_id), 1, 6));

  -- Insert the locked sale shell first so normalized lines and stock history can reference it.
  -- The same transaction updates authoritative totals after all lines validate.
  insert into public.sales (
    id, receipt_number, items, subtotal, tax_total, total,
    payment_method, amount_paid, balance_due, payment_status,
    customer_id, customer_name, customer_phone, vehicle_info,
    due_date, notes, worker_id, worker_name, created_at
  ) values (
    p_id, receipt_value, '[]'::jsonb, 0, 0, 0,
    p_payment_method, 0, 0, 'unpaid',
    resolved_customer.id,
    coalesce(nullif(trim(p_customer_name), ''), resolved_customer.name, ''),
    coalesce(nullif(trim(p_customer_phone), ''), resolved_customer.phone, ''),
    coalesce(nullif(trim(p_vehicle_info), ''), resolved_customer.vehicle_info, ''),
    p_due_date, trim(coalesce(p_notes, '')), auth.uid(),
    coalesce(nullif(trim(p_worker_name), ''), 'Team member'), now()
  );

  -- Calculate and lock every item before inserting the sale.
  for line in select * from jsonb_array_elements(p_items)
  loop
    line_no := line_no + 1;
    requested_qty := coalesce((line->>'qty')::integer, 0);
    if requested_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;

    select * into product_row
    from public.products
    where id = line->>'productId'
    for update;
    if not found then raise exception 'Product not found'; end if;

    if not product_row.is_labor and product_row.stock < requested_qty then
      raise exception 'Not enough stock for %. Available: %', product_row.name, product_row.stock;
    end if;

    requested_tax := coalesce((line->>'applyTax')::boolean, product_row.taxable);
    if not public.is_owner() and requested_tax is distinct from product_row.taxable then
      raise exception 'Only the owner can override tax';
    end if;
    requested_price := nullif(line->>'unitPrice', '')::numeric;
    if requested_price is not null and not public.is_owner() and requested_price <> product_row.price then
      raise exception 'Only the owner can override prices';
    end if;

    effective_price := round(coalesce(requested_price, product_row.price)::numeric, 2);
    if effective_price < 0 then raise exception 'Price cannot be negative'; end if;

    select cost_price into effective_cost
    from public.product_costs where product_id = product_row.id;
    effective_cost := coalesce(effective_cost, 0);
    effective_tax_rate := case when requested_tax then product_row.tax_rate else 0 end;
    line_subtotal := round(effective_price * requested_qty, 2);
    line_tax := round(line_subtotal * effective_tax_rate, 2);
    line_total := line_subtotal + line_tax;
    line_cost := round(effective_cost * requested_qty, 2);

    subtotal_value := subtotal_value + line_subtotal;
    tax_value := tax_value + line_tax;
    total_value := total_value + line_total;
    cost_value := cost_value + line_cost;

    public_items := public_items || jsonb_build_array(jsonb_build_object(
      'productId', product_row.id,
      'name', product_row.name,
      'sku', product_row.sku,
      'price', effective_price,
      'qty', requested_qty,
      'taxable', requested_tax,
      'taxRate', effective_tax_rate,
      'taxAmount', line_tax,
      'lineSubtotal', line_subtotal,
      'lineTotal', line_total
    ));

    if not product_row.is_labor then
      before_stock := product_row.stock;
      update public.products
      set stock = stock - requested_qty, updated_at = now()
      where id = product_row.id;

      insert into public.inventory_transactions (
        product_id, transaction_type, quantity_change, quantity_before,
        quantity_after, sale_id, reason, performed_by
      ) values (
        product_row.id, 'sale', -requested_qty, before_stock,
        before_stock - requested_qty, p_id, 'Checkout', auth.uid()
      );
    end if;

    insert into public.sale_items (
      sale_id, product_id, line_number, product_name, sku, quantity,
      unit_price, unit_cost, taxable, tax_rate, line_subtotal, tax_amount,
      line_total, line_cost, gross_profit, price_overridden, tax_overridden,
      override_reason, is_labor
    ) values (
      p_id, product_row.id, line_no, product_row.name, product_row.sku, requested_qty,
      effective_price, effective_cost, requested_tax, effective_tax_rate, line_subtotal,
      line_tax, line_total, line_cost, line_total - line_cost,
      requested_price is not null and requested_price <> product_row.price,
      requested_tax <> product_row.taxable,
      trim(coalesce(line->>'overrideReason', '')), product_row.is_labor
    );
  end loop;

  total_value := round(subtotal_value + tax_value, 2);
  if p_payment_method = 'credit' then
    paid_value := round(greatest(0, coalesce(p_amount_paid, 0)), 2);
  else
    paid_value := total_value;
  end if;
  if paid_value > total_value then raise exception 'Payment cannot exceed total'; end if;

  balance_value := total_value - paid_value;
  status_value := case
    when balance_value = 0 then 'paid'
    when paid_value > 0 then 'partial'
    else 'unpaid'
  end;
  update public.sales
  set
    items = public_items,
    subtotal = subtotal_value,
    tax_total = tax_value,
    total = total_value,
    amount_paid = paid_value,
    balance_due = balance_value,
    payment_status = status_value
  where id = p_id;

  insert into public.sale_financials (sale_id, cost_total, gross_profit)
  values (p_id, cost_value, total_value - cost_value);

  if paid_value > 0 then
    insert into public.payments (
      sale_id, customer_id, amount, payment_method, notes, recorded_by
    ) values (
      p_id, resolved_customer.id, paid_value,
      case when p_payment_method = 'credit' then p_initial_payment_method else p_payment_method end,
      case when p_payment_method = 'credit' then 'Initial payment' else 'Payment at checkout' end,
      auth.uid()
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'id', p_id, 'receiptNumber', receipt_value,
    'subtotal', subtotal_value, 'taxTotal', tax_value, 'total', total_value,
    'amountPaid', paid_value, 'balanceDue', balance_value, 'paymentStatus', status_value
  );
end;
$$;
commit;
