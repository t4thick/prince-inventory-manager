create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric not null,
  stock integer not null default 0,
  low_stock_at integer not null default 0,
  sku text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id text primary key,
  items jsonb not null,
  total numeric not null,
  payment_method text not null,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.sales enable row level security;

drop policy if exists "shop products all" on public.products;
create policy "shop products all"
  on public.products for all
  using (true)
  with check (true);

drop policy if exists "shop sales all" on public.sales;
create policy "shop sales all"
  on public.sales for all
  using (true)
  with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.products;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sales;
  exception
    when duplicate_object then null;
  end;
end $$;

create or replace function public.record_sale(
  p_id text,
  p_items jsonb,
  p_total numeric,
  p_payment_method text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  line jsonb;
  pid text;
  qty int;
  available int;
begin
  for line in select * from jsonb_array_elements(p_items)
  loop
    pid := line->>'productId';
    qty := (line->>'qty')::int;
    select stock into available from public.products where id = pid for update;
    if not found then
      raise exception 'Product not found';
    end if;
    if available < qty then
      raise exception 'Not enough stock for %', pid;
    end if;
    update public.products
      set stock = stock - qty, updated_at = now()
      where id = pid;
  end loop;

  insert into public.sales (id, items, total, payment_method, created_at)
  values (p_id, p_items, p_total, p_payment_method, p_created_at);

  return jsonb_build_object('ok', true);
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.sales to anon, authenticated;
grant execute on function public.record_sale(text, jsonb, numeric, text, timestamptz) to anon, authenticated;
