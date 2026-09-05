-- User-authorized blank-slate reset. Preserve owner and worker accounts.
begin;

truncate table
  public.payments,
  public.inventory_transactions,
  public.sale_items,
  public.sale_financials,
  public.sales,
  public.product_costs,
  public.products,
  public.customers;

commit;
