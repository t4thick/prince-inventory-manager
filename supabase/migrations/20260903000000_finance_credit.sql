-- Tax, profit snapshots, customer credit, payment ledger, and checkout hardening.
-- Apply after 20250826000000_phase1_auth.sql.

create extension if not exists pgcrypto;

-- Catalog pricing. Sensitive costs live separately so worker queries cannot expose them.
alter table public.products add column if not exists taxable boolean not null default false;
alter table public.products add column if not exists tax_rate numeric(5,4) not null default 0.2000;
alter table public.products add column if not exists is_labor boolean not null default false;
alter table public.products add column if not exists barcode text;

update public.products
set is_labor = true
where sku like 'SVC-%';

with ranked as (
  select
    id,
    sku,
    row_number() over (partition by lower(sku) order by created_at, id) as duplicate_number
  from public.products
  where nullif(trim(sku), '') is not null
)
update public.products p
set sku = p.sku || '-' || upper(substr(md5(p.id), 1, 6))
from ranked r
where p.id = r.id and r.duplicate_number > 1;

create unique index if not exists products_sku_unique_idx
  on public.products (lower(sku))
  where nullif(trim(sku), '') is not null;

create unique index if not exists products_barcode_unique_idx
  on public.products (barcode)
  where barcode is not null and trim(barcode) <> '';

create table if not exists public.product_costs (
  product_id text primary key references public.products (id) on delete cascade,
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  updated_at timestamptz not null default now()
);

insert into public.product_costs (product_id, cost_price)
select id, 0 from public.products
on conflict (product_id) do nothing;

-- Reusable customers for credit and history lookup.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  phone text not null default '',
  email text not null default '',
  vehicle_info text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_name_search_idx on public.customers (lower(name));
create index if not exists customers_phone_search_idx on public.customers (phone);

-- Sale headers retain public/customer-facing amounts.
alter table public.sales add column if not exists receipt_number text;
alter table public.sales add column if not exists customer_id uuid references public.customers (id);
alter table public.sales add column if not exists customer_phone text not null default '';
alter table public.sales add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.sales add column if not exists tax_total numeric(12,2) not null default 0;
alter table public.sales add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.sales add column if not exists balance_due numeric(12,2) not null default 0;
alter table public.sales add column if not exists payment_status text not null default 'paid';
alter table public.sales add column if not exists due_date date;
alter table public.sales add column if not exists notes text not null default '';

update public.sales
set
  receipt_number = coalesce(receipt_number, 'PA-' || upper(substr(md5(id), 1, 10))),
  subtotal = case when subtotal = 0 then round(total::numeric, 2) else subtotal end,
  amount_paid = case when amount_paid = 0 then round(total::numeric, 2) else amount_paid end,
  balance_due = greatest(0, round(total::numeric, 2) - amount_paid),
  payment_status = case
    when voided_at is not null then 'voided'
    when greatest(0, round(total::numeric, 2) - amount_paid) = 0 then 'paid'
    when amount_paid > 0 then 'partial'
    else 'unpaid'
  end;

alter table public.sales alter column receipt_number set not null;
create unique index if not exists sales_receipt_number_unique_idx on public.sales (receipt_number);
create index if not exists sales_customer_id_idx on public.sales (customer_id);
create index if not exists sales_payment_status_idx on public.sales (payment_status);
create index if not exists sales_due_date_idx on public.sales (due_date);

-- Sensitive sale financials are owner-only.
create table if not exists public.sale_financials (
  sale_id text primary key references public.sales (id) on delete cascade,
  cost_total numeric(12,2) not null default 0 check (cost_total >= 0),
  gross_profit numeric(12,2) not null default 0
);

-- Normalized immutable line snapshots. The sales.items JSON remains for worker-facing history.
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null references public.sales (id) on delete restrict,
  product_id text references public.products (id) on delete set null,
  line_number integer not null check (line_number > 0),
  product_name text not null,
  sku text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  taxable boolean not null default false,
  tax_rate numeric(5,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  line_cost numeric(12,2) not null default 0 check (line_cost >= 0),
  gross_profit numeric(12,2) not null default 0,
  price_overridden boolean not null default false,
  tax_overridden boolean not null default false,
  override_reason text not null default '',
  is_labor boolean not null default false,
  unique (sale_id, line_number)
);

create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_id_idx on public.sale_items (product_id);

-- Immutable payment ledger. Reversals mark, rather than delete, the original payment.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null references public.sales (id) on delete restrict,
  customer_id uuid references public.customers (id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer')),
  notes text not null default '',
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id)
);

create index if not exists payments_sale_id_idx on public.payments (sale_id);
create index if not exists payments_customer_id_idx on public.payments (customer_id);
create index if not exists payments_created_at_idx on public.payments (created_at desc);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products (id) on delete set null,
  transaction_type text not null check (transaction_type in ('sale', 'void', 'adjustment')),
  quantity_change integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  sale_id text references public.sales (id),
  reason text not null default '',
  performed_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_transactions_product_idx
  on public.inventory_transactions (product_id, created_at desc);

-- RLS: members can see operational/customer data; only owners can see cost/profit snapshots.
alter table public.product_costs enable row level security;
alter table public.customers enable row level security;
alter table public.sale_financials enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "product costs owner read" on public.product_costs;
create policy "product costs owner read"
  on public.product_costs for select to authenticated
  using (public.is_owner());

drop policy if exists "product costs owner write" on public.product_costs;
create policy "product costs owner write"
  on public.product_costs for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "customers members read" on public.customers;
create policy "customers members read"
  on public.customers for select to authenticated
  using (public.is_authenticated_member());

drop policy if exists "sale financials owner read" on public.sale_financials;
create policy "sale financials owner read"
  on public.sale_financials for select to authenticated
  using (public.is_owner());

drop policy if exists "sale items owner read" on public.sale_items;
create policy "sale items owner read"
  on public.sale_items for select to authenticated
  using (public.is_owner());

drop policy if exists "payments members read" on public.payments;
create policy "payments members read"
  on public.payments for select to authenticated
  using (public.is_authenticated_member());

drop policy if exists "inventory transactions members read" on public.inventory_transactions;
create policy "inventory transactions members read"
  on public.inventory_transactions for select to authenticated
  using (public.is_authenticated_member());

-- Remove direct sales mutation paths. All writes must use the protected RPCs below.
drop policy if exists "sales insert" on public.sales;
drop policy if exists "sales owner update" on public.sales;
revoke insert, update, delete on public.sales from authenticated;
revoke all on function public.record_sale(
  text, jsonb, numeric, text, timestamptz, uuid, text, text, text
) from public, anon, authenticated;

-- Owners may edit catalog metadata but stock changes should use adjust_product_stock.
revoke update on public.products from authenticated;
grant update (name, price, low_stock_at, sku, updated_at, taxable, tax_rate, is_labor, barcode)
  on public.products to authenticated;

grant select, insert, delete on public.products to authenticated;
grant select on public.sales, public.customers, public.payments, public.inventory_transactions to authenticated;
grant select, insert, update on public.product_costs to authenticated;
grant select on public.sale_financials, public.sale_items to authenticated;

-- Server-authoritative checkout.
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

  if p_payment_method not in ('cash', 'card', 'transfer', 'credit') then
    raise exception 'Invalid payment method';
  end if;

  if p_initial_payment_method not in ('cash', 'card', 'transfer') then
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
    if trim(resolved_customer.phone) = '' and trim(coalesce(p_vehicle_info, resolved_customer.vehicle_info)) = '' then
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
      line_tax, line_total, line_cost, line_subtotal - line_cost,
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
  values (p_id, cost_value, subtotal_value - cost_value);

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

-- Record a partial or final payment against a credit sale.
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
  if p_payment_method not in ('cash', 'card', 'transfer') then
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

-- Audited stock adjustments. Replaces the earlier no-reason version.
drop function if exists public.adjust_product_stock(text, integer);

create or replace function public.adjust_product_stock(
  p_id text,
  p_delta integer,
  p_reason text default 'Manual adjustment'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_stock integer;
  after_stock integer;
begin
  if not public.is_authenticated_member() then raise exception 'Not signed in'; end if;
  if p_delta = 0 then raise exception 'Adjustment cannot be zero'; end if;

  select stock into before_stock from public.products where id = p_id for update;
  if not found then raise exception 'Product not found'; end if;
  after_stock := greatest(0, before_stock + p_delta);

  update public.products set stock = after_stock, updated_at = now() where id = p_id;
  insert into public.inventory_transactions (
    product_id, transaction_type, quantity_change, quantity_before,
    quantity_after, reason, performed_by
  ) values (
    p_id, 'adjustment', after_stock - before_stock, before_stock,
    after_stock, trim(coalesce(p_reason, 'Manual adjustment')), auth.uid()
  );

  return jsonb_build_object('id', p_id, 'stock', after_stock);
end;
$$;

-- Extend voids to reverse payment state and use immutable line snapshots.
create or replace function public.void_sale(p_sale_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.sales%rowtype;
  item_row public.sale_items%rowtype;
  line jsonb;
  before_stock integer;
  pid text;
  qty integer;
  sku_value text;
begin
  if not public.is_authenticated_member() then raise exception 'Not signed in'; end if;

  select * into sale_row from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.voided_at is not null then raise exception 'Sale already voided'; end if;
  if not public.is_owner() and sale_row.worker_id is distinct from auth.uid() then
    raise exception 'Not allowed to void this sale';
  end if;

  if exists (select 1 from public.sale_items where sale_id = p_sale_id) then
    for item_row in select * from public.sale_items where sale_id = p_sale_id
    loop
      if not item_row.is_labor and item_row.product_id is not null then
        select stock into before_stock from public.products
        where id = item_row.product_id for update;
        if found then
          update public.products
          set stock = stock + item_row.quantity, updated_at = now()
          where id = item_row.product_id;
          insert into public.inventory_transactions (
            product_id, transaction_type, quantity_change, quantity_before,
            quantity_after, sale_id, reason, performed_by
          ) values (
            item_row.product_id, 'void', item_row.quantity, before_stock,
            before_stock + item_row.quantity, p_sale_id, 'Sale voided', auth.uid()
          );
        end if;
      end if;
    end loop;
  else
    -- Backward compatibility for pre-migration sales.
    for line in select * from jsonb_array_elements(sale_row.items)
    loop
      pid := line->>'productId';
      qty := (line->>'qty')::integer;
      select stock, sku into before_stock, sku_value
      from public.products where id = pid for update;
      if found and sku_value not like 'SVC-%' then
        update public.products set stock = stock + qty, updated_at = now() where id = pid;
      end if;
    end loop;
  end if;

  update public.payments
  set reversed_at = now(), reversed_by = auth.uid()
  where sale_id = p_sale_id and reversed_at is null;

  update public.sales
  set
    voided_at = now(),
    voided_by = auth.uid(),
    payment_status = 'voided',
    amount_paid = 0,
    balance_due = 0
  where id = p_sale_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.record_sale_v2(
  text, jsonb, text, numeric, text, uuid, text, text, text, date, text, text, timestamptz
) from public, anon;
revoke all on function public.record_customer_payment(text, numeric, text, text) from public, anon;
revoke all on function public.adjust_product_stock(text, integer, text) from public, anon;
revoke all on function public.void_sale(text) from public, anon;

grant execute on function public.record_sale_v2(
  text, jsonb, text, numeric, text, uuid, text, text, text, date, text, text, timestamptz
) to authenticated;
grant execute on function public.record_customer_payment(text, numeric, text, text) to authenticated;
grant execute on function public.adjust_product_stock(text, integer, text) to authenticated;
grant execute on function public.void_sale(text) to authenticated;

