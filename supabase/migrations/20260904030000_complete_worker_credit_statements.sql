-- Workers need complete Pay Later history to produce accurate customer statements.
begin;
alter policy "sales read" on public.sales using (
  public.is_owner() or worker_id = auth.uid() or payment_method = 'credit'
);
commit;
