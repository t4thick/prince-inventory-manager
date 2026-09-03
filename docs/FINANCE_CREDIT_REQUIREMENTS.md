# Prince Auto — Tax, Profit, and Customer Credit Requirements

> Implementation-ready product specification for the existing React, TypeScript, Supabase, and PWA application.
>
> Primary goal: make every sale financially accurate, make unpaid customer balances easy to find and collect, and give the owner trustworthy daily, weekly, and monthly profit reporting.

## Product direction

Prince Auto should feel like serious shop software: fast at the counter, clear on a phone, and trustworthy enough to use for end-of-day decisions.

The system must answer these questions without manual calculation:

- What did this item cost the shop?
- What price are we charging before tax?
- Is this item taxable?
- How much tax was collected?
- How much gross sales revenue did we make?
- What was the gross profit on each line, each sale, today, this week, and this month?
- Who still owes the shop money?
- How much did each customer originally owe, how much have they paid, and what remains?

This feature must not include shipping, delivery, carrier, route, or package-tracking functionality.

## Financial definitions

Use these definitions consistently in the database, UI, receipt, CSV exports, and reports.

- **Cost price:** the shop's unit acquisition cost for an item.
- **Selling price:** the shop's unit price before tax.
- **Tax rate:** 20% by default when tax is enabled for a line.
- **Subtotal:** sum of quantity × unit selling price, before tax.
- **Tax:** taxable line subtotal × tax rate.
- **Total:** subtotal + tax.
- **Cost of goods sold (COGS):** quantity × the unit cost captured when the sale is recorded.
- **Gross profit:** pre-tax line revenue − COGS.
- **Gross margin:** gross profit ÷ pre-tax line revenue × 100.
- **Amount paid:** money actually collected against the sale.
- **Balance due:** total − amount paid.
- **Gross sales:** sales before voids/refunds, clearly labeled and never confused with profit.
- **Net sales:** active sales after voids/refunds, including tax only when explicitly labeled “including tax.”

Tax collected is a liability, not shop profit. Profit calculations must exclude tax.

Example:

```text
Cost price:             $50.00
Selling price:          $80.00
Taxable:                Yes
Tax rate:               20%
Tax:                    $16.00
Customer total:         $96.00
Gross profit:           $30.00
Gross margin:           37.50%
```

Changing a product's cost, selling price, or tax setting later must never change historical sales. Every sale line must store immutable snapshots of the values used at checkout.

## Product pricing

Each product or labor item needs:

- Cost price
- Selling price before tax
- Taxable on/off
- Default tax rate, initially 20% when taxable
- Optional barcode
- Existing name, SKU, stock, and low-stock level

Only the owner can change cost price, selling price, or default tax settings. Workers can see the selling price but should not see cost or profit unless the owner grants that permission.

The product form must preview:

- Price before tax
- Tax amount
- Customer price after tax
- Profit per unit
- Margin percentage

Validation:

- Cost and selling prices must be zero or greater.
- Tax rate must be between 0% and 100%.
- SKU must be unique.
- Selling below cost is allowed only after a visible warning and owner confirmation.
- Money must be rounded consistently to currency precision.

## Checkout and selective 20% tax

Tax is selected per checkout line.

- A product's taxable setting supplies the default.
- The cashier can toggle tax on or off for an individual line before completing the sale.
- The cashier can change the selling price for the current line when necessary.
- A price override affects only that sale and does not silently update the product catalog.
- Price overrides and tax overrides must be recorded for audit.
- Optionally require an override reason.
- The checkout summary must show subtotal, tax, total, amount paid, and balance due separately.

Do not apply one blanket 20% tax to all items. Only selected lines receive tax.

The server must calculate totals from authoritative product data plus permitted line overrides. It must not trust a total or profit sent by the browser.

## Profit visibility

Owner-only financial information should appear in these places:

### Product list and product editor

- Cost
- Selling price
- Tax-inclusive customer price
- Profit per unit
- Margin percentage
- Inventory value based on cost, not selling price

### Checkout

- Optional owner-only line profit preview
- Sale-level projected gross profit
- Profit warning when a line is sold below cost

### Completed sale

- Subtotal
- Tax
- Total
- COGS
- Gross profit
- Gross margin
- Payment status
- Amount paid
- Balance due
- Profit for every line

### Dashboard

- Net sales today
- Tax collected today
- COGS today
- Gross profit today
- Gross margin today
- Collected today
- Outstanding credit balance
- Number of overdue customer accounts

### Reports

Support Today, Yesterday, 7 days, 30 days, This Week, This Month, This Year, and custom date range.

Summaries must include:

- Gross sales
- Voids/refunds
- Net sales before tax
- Tax collected
- Total collected
- COGS
- Gross profit
- Gross margin
- Outstanding credit
- Payments collected on old credit
- Sales by worker
- Profit by worker
- Sales and profit by product
- Sales and profit by day
- Sales and profit by payment method

Daily reports must group by the shop's configured timezone, not by a UTC string prefix.

CSV export must include the same financial fields and clearly distinguish sale date from payment date.

## Customer credit / “save for later”

Credit means the customer takes parts or receives service now and pays later.

Add a clearly labeled **Credit / Pay Later** option at checkout. This is a payment status, not a fake cash payment.

Before saving credit, require:

- Customer name
- At least one reliable lookup field: phone number, vehicle plate, or customer account number
- Optional vehicle details
- Optional due date
- Notes
- Amount paid now, allowing zero or a partial payment

On completion:

- Record the sale normally.
- Reduce inventory normally.
- Store the original total.
- Store any payment received now.
- Set the remaining balance.
- Mark status as Unpaid, Partially Paid, or Paid.
- Add the balance to accounts receivable.
- Never delete or overwrite the original sale when payment arrives.

### Credit accounts panel

Put a prominent **Customer Balances** card near the top of the dashboard. It should show:

- Total amount outstanding
- Number of customers owing money
- Overdue count
- Oldest overdue account
- A **View balances** action

The balances screen must support search by:

- Customer name
- Phone number
- Vehicle plate
- Vehicle description
- Sale or receipt number

Each row should show customer, phone/vehicle, original amount, amount paid, balance due, sale date, due date, age, and status.

Suggested statuses:

- Due
- Partially paid
- Paid
- Overdue
- Voided

### Recording later payments

When a customer returns:

1. Search and open the customer or balance.
2. Select the outstanding sale.
3. Tap **Record payment**.
4. Enter amount and payment method.
5. Confirm the resulting balance.
6. Save an immutable payment record with employee and timestamp.

Support partial payments and multiple payment methods over time.

When balance reaches zero, automatically mark the sale Paid but retain the complete credit and payment history.

Prevent overpayment unless the owner explicitly records it as customer credit or change due.

Voiding a credit sale must reverse inventory and close the receivable safely. A paid or partially paid sale must require an explicit refund/payment-reversal workflow; it must not simply erase money history.

## Customer records

Create reusable customer records instead of relying only on free-text names.

Recommended fields:

- Customer ID
- Full name
- Phone
- Email, optional
- Vehicle plate
- Vehicle description
- Notes
- Created date
- Current balance, derived rather than manually edited

Warn when a likely duplicate customer is entered. Keep historical sale snapshots even if customer details change later.

## Recommended database design

### Products

Add:

- `cost_price numeric(12,2) not null default 0`
- `selling_price numeric(12,2) not null default 0`
- `taxable boolean not null default false`
- `tax_rate numeric(5,4) not null default 0.20`
- `barcode text`

Replace ambiguous uses of the existing `price` field through a controlled migration. Do not drop it until application code and historical data have been migrated.

### Sales

Add:

- Human-friendly receipt number
- Customer reference
- Subtotal
- Tax total
- Total
- Cost total
- Gross profit
- Amount paid
- Balance due
- Payment status
- Due date
- Sale status
- Notes
- Created-by snapshot and timestamps

### Sale items

Move financial line details out of unstructured JSON into a `sale_items` table. Each row should snapshot:

- Product reference
- Product name and SKU
- Quantity
- Unit cost
- Unit selling price
- Taxable
- Tax rate
- Tax amount
- Line subtotal
- Line total
- Line COGS
- Line gross profit
- Price/tax override flags and reason

### Customers

Create a `customers` table with searchable name, normalized phone, and vehicle fields.

### Payments

Create a `payments` table:

- Payment ID
- Sale ID
- Customer ID
- Amount
- Method: cash, card, transfer, or another configured method
- Payment date
- Recorded by
- Notes
- Reversal reference/status

The balance should be derived from valid payments and the sale total or maintained only through a locked server transaction.

### Audit and inventory transactions

Record:

- Price and tax overrides
- Credit sale creation
- Every payment and payment reversal
- Sale void/refund
- Inventory deduction/restoration
- Manual stock changes with reason

## Security and accounting integrity

- Only authenticated shop members may read shop data.
- Owner-only fields and reports must be enforced by database policy or protected RPCs, not only hidden in React.
- Cost and profit data must not be returned to workers who lack permission.
- Checkout, stock reduction, sale items, totals, and initial payment must commit in one database transaction.
- Later payments and balance updates must commit in one database transaction.
- Use constrained `numeric` money columns or integer minor units; do not rely on JavaScript floating-point totals as the source of truth.
- Validate quantity, product existence, current price, stock, tax rate, and overrides on the server.
- Use idempotency keys so retries and offline sync cannot create duplicate sales or payments.
- Keep sale timestamps server-controlled while preserving an optional device/offline timestamp for audit.
- Add business/shop IDs before supporting multiple businesses.

## Professional UI direction

- Keep the dark navigation, light workspace, restrained red accent, consistent spacing, and native-feeling mobile controls.
- Avoid oversized gradients, decorative charts, excessive pills, fake testimonials, placeholder metrics, and generic AI-style copy.
- Use dense, readable financial cards and tables.
- Put the most actionable items first: unpaid balances, overdue accounts, low stock, today's collected amount, and today's profit.
- Hide sensitive cost/profit numbers from workers by default.
- Use plain labels: Cost, Price, Tax, Profit, Paid, Balance due.
- Make destructive and financial corrections require explicit confirmation.
- Provide loading, empty, error, offline, and retry states.
- Receipts should show tax but should not expose internal cost or profit to customers.

## Required tests

Automate at least:

- Taxable and non-taxable items in one sale
- Correct 20% line tax and rounding
- Price override does not alter catalog price
- Profit excludes tax
- Historical profit remains unchanged after product cost changes
- Server rejects manipulated totals, costs, tax, and profit
- Paid, unpaid, and partially paid checkout
- Multiple later payments
- Balance reaches zero and status becomes Paid
- Overpayment rejection
- Credit search by name, phone, plate, and receipt
- Void unpaid credit sale
- Refund/reversal behavior for partially paid sale
- Duplicate offline-sale retry is idempotent
- Day/week/month grouping in shop timezone
- Worker cannot read cost/profit or perform owner-only overrides

## Current-code audit

The current application is a useful Phase 1 checkout and stock tracker, but it does not yet implement these financial requirements.

Existing strengths:

- Supabase authentication and owner/worker roles
- Atomic stock deduction through a sale RPC
- Sale history, voiding, receipts, dashboard, and basic reports
- Customer name and vehicle text on a sale
- Offline sale queue
- PWA installation on iPhone

Current gaps and risks:

1. A product has only one ambiguous `price`; there is no cost price, tax setting, or profit.
2. A sale line snapshots only name, price, and quantity.
3. Checkout has no subtotal/tax breakdown and all sales are treated as immediately paid.
4. Payment methods are only cash, card, and transfer; there is no credit, partial payment, balance, customer ledger, or payment history.
5. Reports calculate revenue only; there is no COGS, profit, margin, tax, collected-versus-owed split, or custom date range.
6. The dashboard labels stock × selling price as “Stock value”; true inventory value must use cost.
7. The database RPC trusts client-supplied item prices and total. A modified client could submit incorrect totals. The server must calculate authoritative amounts.
8. Sales store line items in JSON, which makes reliable financial querying, indexing, and row-level reporting difficult.
9. Day grouping uses string matching against client dates and may be wrong around timezone boundaries.
10. The first registered account becoming owner is acceptable only during controlled setup; public signup could assign ownership incorrectly on a fresh database.
11. The current schema is a single shared shop. It has no `business_id` isolation.
12. Stock adjustments are not recorded with a reason or history.
13. Product IDs and sale IDs are text rather than database UUIDs; SKU uniqueness is not enforced.
14. No automated test suite currently protects checkout, permissions, tax, profit, credit, or reporting.
15. Existing offline checkout stores the sale only in one device's local storage until sync. Credit balances should not be considered safely recorded until server confirmation.
16. Current RLS grants authenticated users direct sale insertion, allowing a worker or modified client to bypass the checkout RPC and avoid stock deduction.
17. Current RLS lets the owner update sales directly, allowing a void flag to be changed without restoring stock. Sale mutations must go through protected RPCs.
18. The product editor updates stock directly instead of creating an auditable inventory adjustment.
19. The sale RPC does not reject non-positive quantities or invalid payment-method strings and accepts a client-provided sale timestamp.
20. Open self-signup allows anyone with the URL to become a worker unless Supabase signup is restricted or an invitation flow is added.
21. The first-account-becomes-owner trigger has a concurrency race and should not be the long-term ownership provisioning mechanism.
22. Voiding a sale after its product was deleted silently skips restoring that stock.
23. The Supabase API row limit can truncate history after 1,000 sales because the client fetches and aggregates all sales without pagination.
24. Offline checkout does not decrement the visible local stock, so another offline sale can oversell the same item before synchronization.
25. Supabase configuration references a seed file that is not present, which can break or warn during local database reset.
26. Checkout silently reduces a requested quantity to available stock in one code path instead of stopping and showing the cashier what changed.
27. Completed receipts cannot be reopened or reprinted from sale history.
28. The current app calculates gross profit only after this feature is added; true net profit would require tracking operating expenses and is outside this first financial release.

## Tomorrow-first delivery plan

### P0 — protect money and data

1. Confirm both existing Supabase migrations are applied to the production project and test owner/worker access.
2. Back up the production database before changing financial schema.
3. Immediately revoke direct sale insert/update access and require protected RPCs for checkout, voids, and payments.
4. Restrict public signup or replace it with an owner-controlled invitation flow.
5. Add cost, selling price, item-level tax defaults, customers, normalized sale items, payments, and payment statuses through a new additive migration.
6. Replace client-authoritative totals with one server-authoritative checkout RPC that validates positive quantities, payment methods, stock, prices, tax, and timestamps.
7. Add idempotency and audit records.
8. Fix shop-timezone day boundaries before relying on daily totals.

### P1 — minimum client-ready workflow

1. Update the product editor for cost, selling price, taxable, and 20% rate.
2. Add per-line tax and price controls to checkout.
3. Show subtotal, tax, total, amount paid, and balance.
4. Add Credit / Pay Later with required customer lookup details.
5. Add Customer Balances to the top of the dashboard.
6. Add balance search and Record Payment.
7. Show owner-only profit on products, sales, dashboard, and Today report.
8. Update receipts and CSV exports, and allow receipt reprint from sale history.
9. Show a clear stock-conflict error instead of silently changing the sale quantity.

### P2 — hardening before broader use

1. Add automated database and UI tests.
2. Add refund/payment reversal rather than relying only on void.
3. Add shop timezone and configurable tax defaults.
4. Add stock transaction history with reasons.
5. Add role/permission controls for viewing cost and profit.
6. Add monitoring, database backups, and a tested restore procedure.

## Acceptance checklist

- A mixed cart can contain taxable and non-taxable lines.
- The owner can see and edit cost and selling price separately.
- Checkout calculates 20% tax only on selected lines.
- Receipts show subtotal, tax, payments, and balance without showing profit.
- Every sale stores historical unit cost, unit price, tax, and profit snapshots.
- The owner can see profit by line, sale, day, week, month, product, and worker.
- The dashboard shows today's sales, tax, COGS, profit, collected cash, and outstanding credit.
- A customer can take goods on credit with a searchable account.
- Returning customers can make partial or full payments without changing sale history.
- Paid credit disappears from the open-balance list but remains searchable in history.
- Workers cannot access restricted cost/profit data.
- Manipulating browser totals cannot change server-calculated financial results.
- Voids, refunds, and payment reversals leave a complete audit trail.

