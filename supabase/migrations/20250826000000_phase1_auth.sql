-- Phase 1: auth, roles, job details, void sales, secure RLS
-- Run in Supabase SQL Editor after the initial migration.

-- Profiles (shop members)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'worker' check (role in ('owner', 'worker')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Sales job fields
alter table public.sales add column if not exists worker_id uuid references auth.users (id);
alter table public.sales add column if not exists worker_name text not null default '';
alter table public.sales add column if not exists customer_name text not null default '';
alter table public.sales add column if not exists vehicle_info text not null default '';
alter table public.sales add column if not exists voided_at timestamptz;
alter table public.sales add column if not exists voided_by uuid references auth.users (id);

create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists sales_voided_at_idx on public.sales (voided_at);

-- Helpers
create or replace function public.is_authenticated_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- First signup becomes owner; rest are workers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count int;
  assigned_role text;
begin
  select count(*) into member_count from public.profiles;
  assigned_role := case when member_count = 0 then 'owner' else 'worker' end;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    assigned_role
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop open policies
drop policy if exists "shop products all" on public.products;
drop policy if exists "shop sales all" on public.sales;

-- Profiles policies
drop policy if exists "profiles read members" on public.profiles;
create policy "profiles read members"
  on public.profiles for select
  to authenticated
  using (public.is_authenticated_member());

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles owner manage roles" on public.profiles;
create policy "profiles owner manage roles"
  on public.profiles for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Products policies
drop policy if exists "products read" on public.products;
create policy "products read"
  on public.products for select
  to authenticated
  using (public.is_authenticated_member());

drop policy if exists "products owner write" on public.products;
create policy "products owner insert"
  on public.products for insert
  to authenticated
  with check (public.is_owner());

drop policy if exists "products owner update" on public.products;
create policy "products owner update"
  on public.products for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "products owner delete" on public.products;
create policy "products owner delete"
  on public.products for delete
  to authenticated
  using (public.is_owner());

-- Sales policies
drop policy if exists "sales read" on public.sales;
create policy "sales read"
  on public.sales for select
  to authenticated
  using (public.is_authenticated_member());

drop policy if exists "sales insert" on public.sales;
create policy "sales insert"
  on public.sales for insert
  to authenticated
  with check (public.is_authenticated_member());

drop policy if exists "sales owner update" on public.sales;
create policy "sales owner update"
  on public.sales for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Stock adjust (workers + owners)
create or replace function public.adjust_product_stock(p_id text, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stock int;
begin
  if not public.is_authenticated_member() then
    raise exception 'Not signed in';
  end if;

  update public.products
    set stock = greatest(0, stock + p_delta), updated_at = now()
    where id = p_id
    returning stock into new_stock;

  if not found then
    raise exception 'Product not found';
  end if;

  return jsonb_build_object('id', p_id, 'stock', new_stock);
end;
$$;

-- Record sale with worker + customer info
drop function if exists public.record_sale(text, jsonb, numeric, text, timestamptz);

create or replace function public.record_sale(
  p_id text,
  p_items jsonb,
  p_total numeric,
  p_payment_method text,
  p_created_at timestamptz,
  p_worker_id uuid,
  p_worker_name text,
  p_customer_name text default '',
  p_vehicle_info text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  pid text;
  qty int;
  available int;
  sku text;
begin
  if not public.is_authenticated_member() then
    raise exception 'Not signed in';
  end if;

  if p_worker_id is distinct from auth.uid() then
    raise exception 'Worker mismatch';
  end if;

  for line in select * from jsonb_array_elements(p_items)
  loop
    pid := line->>'productId';
    qty := (line->>'qty')::int;
    select stock, products.sku into available, sku
      from public.products where id = pid for update;

    if not found then
      raise exception 'Product not found';
    end if;

    if sku not like 'SVC-%' and available < qty then
      raise exception 'Not enough stock for %', pid;
    end if;

    if sku not like 'SVC-%' then
      update public.products
        set stock = stock - qty, updated_at = now()
        where id = pid;
    end if;
  end loop;

  insert into public.sales (
    id, items, total, payment_method, created_at,
    worker_id, worker_name, customer_name, vehicle_info
  )
  values (
    p_id, p_items, p_total, p_payment_method, p_created_at,
    p_worker_id, p_worker_name, coalesce(p_customer_name, ''), coalesce(p_vehicle_info, '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- Void sale (owner any; worker own sale)
create or replace function public.void_sale(p_sale_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.sales%rowtype;
  line jsonb;
  pid text;
  qty int;
  sku text;
begin
  if not public.is_authenticated_member() then
    raise exception 'Not signed in';
  end if;

  select * into sale_row from public.sales where id = p_sale_id for update;

  if not found then
    raise exception 'Sale not found';
  end if;

  if sale_row.voided_at is not null then
    raise exception 'Sale already voided';
  end if;

  if not public.is_owner() and sale_row.worker_id is distinct from auth.uid() then
    raise exception 'Not allowed to void this sale';
  end if;

  for line in select * from jsonb_array_elements(sale_row.items)
  loop
    pid := line->>'productId';
    qty := (line->>'qty')::int;
    select sku into sku from public.products where id = pid;
    if found and sku not like 'SVC-%' then
      update public.products
        set stock = stock + qty, updated_at = now()
        where id = pid;
    end if;
  end loop;

  update public.sales
    set voided_at = now(), voided_by = auth.uid()
    where id = p_sale_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on public.products from anon;
revoke all on public.sales from anon;
revoke all on public.profiles from anon;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update on public.sales to authenticated;
grant select, update on public.profiles to authenticated;

grant execute on function public.adjust_product_stock(text, int) to authenticated;
grant execute on function public.record_sale(text, jsonb, numeric, text, timestamptz, uuid, text, text, text) to authenticated;
grant execute on function public.void_sale(text) to authenticated;
grant execute on function public.is_authenticated_member() to authenticated;
grant execute on function public.is_owner() to authenticated;
