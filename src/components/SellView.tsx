import { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Minus, Plus, Search, Smartphone, Trash2, WalletCards } from 'lucide-react'
import { calculateLine, calculateSaleTotals } from '../lib/finance'
import { money } from '../lib/format'
import { isOnline } from '../lib/offline'
import { useShop } from '../store'
import type { CartLine, PaymentMethod, Sale } from '../types'
import { ReceiptModal } from './ReceiptModal'

const methods: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: Smartphone },
  { id: 'credit', label: 'Pay later', icon: WalletCards },
]

export function SellView() {
  const { products, customers, checkout, offlinePending, isOwner } = useShop()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [initialMethod, setInitialMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [flash, setFlash] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [paying, setPaying] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...products].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return list
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q),
    )
  }, [products, query])

  const detailed = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((p) => p.id === line.productId)
          if (!product) return null
          return { ...line, product }
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [cart, products],
  )

  const calculatedLines = detailed.map((line) =>
    calculateLine({
      unitPrice: line.unitPrice,
      unitCost: line.product.costPrice,
      quantity: line.qty,
      applyTax: line.applyTax,
      taxRate: line.product.taxRate,
    }),
  )
  const totals = calculateSaleTotals(calculatedLines)
  const { subtotal, tax: taxTotal, total, grossProfit: projectedProfit } = totals
  const itemCount = detailed.reduce((sum, line) => sum + line.qty, 0)

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 3200)
    return () => window.clearTimeout(t)
  }, [flash])

  function addToCart(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (!product.isLabor && product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        if (!product.isLabor && existing.qty >= product.stock) return prev
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId,
          qty: 1,
          applyTax: product.taxable,
          unitPrice: product.price,
          overrideReason: '',
        },
      ]
    })
  }

  function setQty(productId: string, qty: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const max = product.isLabor ? 99 : product.stock
    const next = Math.max(0, Math.min(qty, max))
    setCart((prev) => {
      if (next === 0) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) => (l.productId === productId ? { ...l, qty: next } : l))
    })
  }

  function updateCartLine(productId: string, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)),
    )
  }

  function chooseCustomer(name: string) {
    setCustomerName(name)
    const match = customers.find((customer) => customer.name.toLowerCase() === name.trim().toLowerCase())
    setCustomerId(match?.id ?? null)
    if (match) {
      setCustomerPhone(match.phone)
    }
  }

  async function takePayment() {
    if (detailed.length === 0 || paying) return
    if (method === 'credit') {
      if (!customerName.trim() || !customerPhone.trim()) {
        setFlash('Credit requires a customer name and phone number.')
        return
      }
      if (!isOnline()) {
        setFlash('Connect to the internet before saving a credit sale.')
        return
      }
      const paid = Number(amountPaid)
      if (Number.isNaN(paid) || paid < 0 || paid > total) {
        setFlash('Enter a valid amount paid, no more than the total.')
        return
      }
    }
    setPaying(true)
    const sale = await checkout(cart, method, {
      customerId,
      customerName,
      customerPhone,
      vehicleInfo: '',
      dueDate: dueDate || null,
      notes,
      amountPaid: method === 'credit' ? Number(amountPaid) : total,
      initialPaymentMethod: initialMethod,
    })
    setPaying(false)
    if (!sale) return

    setCart([])
    setCustomerId(null)
    setCustomerName('')
    setCustomerPhone('')
    setDueDate('')
    setNotes('')
    setAmountPaid('0')
    setReceipt(sale)

    if (!isOnline()) {
      setFlash(`Saved offline (${offlinePending + 1} pending) · will sync when back online`)
    } else {
      setFlash(`Paid ${money(sale.total)} · parts updated`)
    }
  }

  return (
    <div className="view sell-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Front desk</p>
          <h1>Checkout</h1>
        </div>
      </header>

      {!isOnline() && (
        <p className="offline-banner" role="status">
          Offline mode — sales queue locally and sync when connection returns.
        </p>
      )}

      <div className="sell-grid">
        <section className="catalog panel" aria-label="Products">
          <div className="search-row">
            <Search size={18} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or SKU"
              aria-label="Search products"
            />
          </div>

          <div className="product-grid">
            {filtered.map((product) => {
              const inCart = cart.find((l) => l.productId === product.id)?.qty ?? 0
              const isLabor = product.isLabor
              const out = !isLabor && product.stock <= 0
              const low = !isLabor && product.stock <= product.lowStockAt
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`product-tile ${out ? 'is-out' : ''} ${inCart ? 'in-cart' : ''}`}
                  onClick={() => addToCart(product.id)}
                  disabled={out}
                >
                  <span className="tile-name">{product.name}</span>
                  <span className="tile-price">{money(product.price)}</span>
                  <span className={`tile-stock ${low ? 'is-low' : ''}`}>
                    {isLabor ? 'Labor' : out ? 'Out' : `${product.stock} in stock`}
                    {inCart > 0 ? ` · ${inCart} in cart` : ''}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="empty-note">No parts or services match that search.</p>
            )}
          </div>
        </section>

        <aside className="cart panel" aria-label="Cart">
          <div className="cart-head">
            <h2>Cart</h2>
            <span>{itemCount} line items</span>
          </div>

          <div className="job-fields">
            <label>
              Customer
              <input
                list="customer-list"
                value={customerName}
                onChange={(e) => chooseCustomer(e.target.value)}
                placeholder="Name (optional)"
              />
              <datalist id="customer-list">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.phone}
                  </option>
                ))}
              </datalist>
            </label>
            <label>
              Phone
              <input
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Required for credit"
              />
            </label>
          </div>

          <ul className="cart-lines">
            {detailed.map((line) => (
              <li key={line.productId}>
                <div className="line-main">
                  <strong>{line.product.name}</strong>
                  <span>
                    {money(
                      calculateLine({
                        unitPrice: line.unitPrice,
                        unitCost: line.product.costPrice,
                        quantity: line.qty,
                        applyTax: line.applyTax,
                        taxRate: line.product.taxRate,
                      }).total,
                    )}
                  </span>
                </div>
                <div className="line-pricing">
                  {isOwner ? (
                    <label>
                      Unit price
                      <input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateCartLine(line.productId, {
                            unitPrice: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        aria-label={`Unit price for ${line.product.name}`}
                      />
                    </label>
                  ) : (
                    <span>{money(line.unitPrice)} each</span>
                  )}
                  <label className="tax-toggle">
                    <input
                      type="checkbox"
                      checked={line.applyTax}
                      onChange={(event) =>
                        updateCartLine(line.productId, { applyTax: event.target.checked })
                      }
                    />
                    Tax {Math.round(line.product.taxRate * 100)}%
                  </label>
                </div>
                <div className="line-controls">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Decrease"
                    onClick={() => setQty(line.productId, line.qty - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="qty">{line.qty}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Increase"
                    onClick={() => setQty(line.productId, line.qty + 1)}
                    disabled={
                      !line.product.isLabor && line.qty >= line.product.stock
                    }
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Remove"
                    onClick={() => setQty(line.productId, 0)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
            {detailed.length === 0 && (
              <li className="cart-empty">Tap products to build a sale.</li>
            )}
          </ul>

          <div className="pay-methods" role="group" aria-label="Payment method">
            {methods.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`method ${method === id ? 'active' : ''}`}
                onClick={() => setMethod(id)}
              >
                <Icon size={18} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {method === 'credit' && (
            <div className="credit-fields">
              <div className="credit-callout">
                <WalletCards size={18} aria-hidden />
                <span>Save the balance to this customer and collect it later.</span>
              </div>
              <div className="form-row">
                <label>
                  Paid now
                  <input
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={(event) => setAmountPaid(event.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Paid by
                  <select
                    value={initialMethod}
                    disabled={Number(amountPaid) <= 0}
                    onChange={(event) =>
                      setInitialMethod(event.target.value as 'cash' | 'card' | 'transfer')
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
                <label>
                  Credit note
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Agreement or reminder"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="cart-totals">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Tax</span><strong>{money(taxTotal)}</strong></div>
            {isOwner && (
              <div className="profit-row"><span>Projected gross profit</span><strong>{money(projectedProfit)}</strong></div>
            )}
            <div className="grand-total"><span>Total</span><strong>{money(total)}</strong></div>
            {method === 'credit' && (
              <div className="balance-row">
                <span>Balance due</span>
                <strong>{money(Math.max(0, total - (Number(amountPaid) || 0)))}</strong>
              </div>
            )}
          </div>

          <button
            type="button"
            className="primary-btn take-pay"
            disabled={detailed.length === 0 || paying}
            onClick={takePayment}
          >
            {paying ? 'Processing…' : method === 'credit' ? 'Save credit sale' : 'Take payment'}
          </button>

          {flash && (
            <p className="flash-ok" role="status">
              {flash}
            </p>
          )}
        </aside>
      </div>

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
