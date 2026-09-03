-- Product organization for a retail parts store.
alter table public.products add column if not exists category text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists unit text not null default 'Each';
alter table public.products add column if not exists shelf_location text;

create index if not exists products_category_idx on public.products (lower(category));
create index if not exists products_brand_idx on public.products (lower(brand));

grant update (category, brand, unit, shelf_location) on public.products to authenticated;
