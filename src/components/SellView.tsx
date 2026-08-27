import { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Minus, Plus, Search, Smartphone, Trash2 } from 'lucide-react'
import { money } from '../lib/format'
import { isOnline } from '../lib/offline'
import { useShop } from '../store'
import type { CartLine, PaymentMethod, Sale } from '../types'
import { ReceiptModal } from './ReceiptModal'

const methods: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: Smartphone },
]

export function SellView() {
  const { products, checkout, offlinePending } = useShop()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [paying, setPaying] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...products].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return list
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
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

  const total = detailed.reduce((sum, line) => sum + line.product.price * line.qty, 0)
  const itemCount = detailed.reduce((sum, line) => sum + line.qty, 0)

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 3200)
    return () => window.clearTimeout(t)
  }, [flash])

  function addToCart(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const isLabor = product.sku.startsWith('SVC-')
    if (!isLabor && product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        if (!isLabor && existing.qty >= product.stock) return prev
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + 1 } : l,
        )
      }
      return [...prev, { productId, qty: 1 }]
    })
  }

  function setQty(productId: string, qty: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const isLabor = product.sku.startsWith('SVC-')
    const max = isLabor ? 99 : product.stock
    const next = Math.max(0, Math.min(qty, max))
    setCart((prev) => {
      if (next === 0) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) => (l.productId === productId ? { ...l, qty: next } : l))
    })
  }

  async function takePayment() {
    if (detailed.length === 0 || paying) return
    setPaying(true)
    const sale = await checkout(cart, method, { customerName, vehicleInfo })
    setPaying(false)
    if (!sale) return

    setCart([])
    setCustomerName('')
    setVehicleInfo('')
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
        <section className="catalog panel" aria-label="Parts and labor">
          <div className="search-row">
            <Search size={18} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts, labor, or part #"
              aria-label="Search parts and labor"
            />
          </div>

          <div className="product-grid">
            {filtered.map((product) => {
              const inCart = cart.find((l) => l.productId === product.id)?.qty ?? 0
              const isLabor = product.sku.startsWith('SVC-')
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
                    {inCart > 0 ? ` · ${inCart} on ticket` : ''}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="empty-note">No parts or services match that search.</p>
            )}
          </div>
        </section>

        <aside className="cart panel" aria-label="Job ticket">
          <div className="cart-head">
            <h2>Job ticket</h2>
            <span>{itemCount} line items</span>
          </div>

          <div className="job-fields">
            <label>
              Customer
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name (optional)"
              />
            </label>
            <label>
              Vehicle
              <input
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
                placeholder="Year / make / plate (optional)"
              />
            </label>
          </div>

          <ul className="cart-lines">
            {detailed.map((line) => (
              <li key={line.productId}>
                <div className="line-main">
                  <strong>{line.product.name}</strong>
                  <span>{money(line.product.price * line.qty)}</span>
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
                      !line.product.sku.startsWith('SVC-') && line.qty >= line.product.stock
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
              <li className="cart-empty">Tap parts or labor to build a job.</li>
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

          <div className="cart-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>

          <button
            type="button"
            className="primary-btn take-pay"
            disabled={detailed.length === 0 || paying}
            onClick={takePayment}
          >
            {paying ? 'Processing…' : 'Take payment'}
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
