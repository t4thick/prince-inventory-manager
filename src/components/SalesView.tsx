import { useMemo } from 'react'
import { formatDateTime, money, todayKey } from '../lib/format'
import { useShop } from '../store'
import type { Sale } from '../types'

const methodLabel = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
} as const

export function SalesView() {
  const { sales } = useShop()

  const grouped = useMemo(() => {
    const today = todayKey()
    const todays = sales.filter((s) => s.createdAt.startsWith(today))
    const earlier = sales.filter((s) => !s.createdAt.startsWith(today))
    return { todays, earlier }
  }, [sales])

  return (
    <div className="view sales-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Work log</p>
          <h1>Jobs</h1>
        </div>
      </header>

      {sales.length === 0 && (
        <p className="empty-note panel">No jobs closed yet. Check out a customer on the Checkout tab.</p>
      )}

      {grouped.todays.length > 0 && (
        <section className="sales-section">
          <h2>Today</h2>
          <SaleList sales={grouped.todays} />
        </section>
      )}

      {grouped.earlier.length > 0 && (
        <section className="sales-section">
          <h2>Earlier</h2>
          <SaleList sales={grouped.earlier} />
        </section>
      )}
    </div>
  )
}

function SaleList({ sales }: { sales: Sale[] }) {
  return (
    <ul className="sales-list">
      {sales.map((sale) => (
        <li key={sale.id} className="sale-row">
          <div className="sale-top">
            <strong>{money(sale.total)}</strong>
            <span className="sale-meta">
              {methodLabel[sale.paymentMethod]} · {formatDateTime(sale.createdAt)}
            </span>
          </div>
          <ul className="sale-items">
            {sale.items.map((item) => (
              <li key={`${sale.id}-${item.productId}`}>
                {item.qty}× {item.name}
                <span>{money(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
