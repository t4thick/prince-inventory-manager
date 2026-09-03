-- Absolute stock correction with a concurrency check and audit record.
create or replace function public.set_product_stock(p_id text, p_stock integer, p_expected_stock integer)
returns void language plpgsql security definer set search_path = public as $$
declare old_stock integer;
begin
  if not public.is_owner() then raise exception 'Only the owner can set stock'; end if;
  if p_stock is null or p_stock < 0 then raise exception 'Stock must be a non-negative whole number'; end if;
  select stock into old_stock from public.products where id = p_id for update;
  if not found then raise exception 'Product not found'; end if;
  if old_stock is distinct from p_expected_stock then
    raise exception 'Stock changed while you were editing. Close and reopen the product to use the latest count.';
  end if;
  if old_stock = p_stock then return; end if;
  update public.products set stock = p_stock, updated_at = now() where id = p_id;
  insert into public.inventory_transactions(product_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, performed_by)
  values(p_id, 'adjustment', p_stock-old_stock, old_stock, p_stock, 'On-hand count corrected in product editor', auth.uid());
end;
$$;
revoke all on function public.set_product_stock(text, integer, integer) from public, anon;
grant execute on function public.set_product_stock(text, integer, integer) to authenticated;
