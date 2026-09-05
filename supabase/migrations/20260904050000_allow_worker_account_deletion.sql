-- Keep historical sales and payments when an owner removes a worker login.
begin;

alter table public.sales drop constraint if exists sales_worker_id_fkey;
alter table public.sales
  add constraint sales_worker_id_fkey foreign key (worker_id) references auth.users (id) on delete set null;

alter table public.payments alter column recorded_by drop not null;
alter table public.payments drop constraint if exists payments_recorded_by_fkey;
alter table public.payments
  add constraint payments_recorded_by_fkey foreign key (recorded_by) references auth.users (id) on delete set null;

commit;
