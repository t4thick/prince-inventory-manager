import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { formatDateTime, money, todayKey } from '../lib/format'
import { useAuth } from '../auth'
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
    const active = sales.filter((s) => !s.voidedAt)
    const todays = active.filter((s) => s.createdAt.startsWith(today))
    const earlier = active.filter((s) => !s.createdAt.startsWith(today))
    const voided = sales.filter((s) => s.voidedAt)
    return { todays, earlier, voided }
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

      {grouped.voided.length > 0 && (
        <section className="sales-section">
          <h2>Voided</h2>
          <SaleList sales={grouped.voided} voided />
        </section>
      )}
    </div>
  )
}

function SaleList({ sales, voided = false }: { sales: Sale[]; voided?: boolean }) {
  const { voidSale, isOwner } = useShop()
  const { session } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function onVoid(sale: Sale) {
    if (!confirm('Void this job and put parts back on the shelf?')) return
    setBusyId(sale.id)
    await voidSale(sale.id)
    setBusyId(null)
  }

  const canVoid = (sale: Sale) => {
    if (sale.voidedAt) return false
    if (isOwner) return true
    return sale.workerId === session?.user.id
  }

  return (
    <ul className="sales-list">
      {sales.map((sale) => (
        <li key={sale.id} className={`sale-row ${sale.voidedAt || voided ? 'is-void' : ''}`}>
          <div className="sale-top">
            <div>
              <strong>{money(sale.total)}</strong>
              {sale.voidedAt && <span className="void-badge">Voided</span>}
            </div>
            <span className="sale-meta">
              {methodLabel[sale.paymentMethod]} · {formatDateTime(sale.createdAt)}
            </span>
          </div>

          {(sale.customerName || sale.vehicleInfo) && (
            <p className="sale-customer">
              {sale.customerName}
              {sale.customerName && sale.vehicleInfo ? ' · ' : ''}
              {sale.vehicleInfo}
            </p>
          )}

          <p className="sale-worker">Sold by {sale.workerName}</p>

          <ul className="sale-items">
            {sale.items.map((item) => (
              <li key={`${sale.id}-${item.productId}`}>
                {item.qty}× {item.name}
                <span>{money(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>

          {canVoid(sale) && (
            <button
              type="button"
              className="ghost-btn danger void-btn"
              disabled={busyId === sale.id}
              onClick={() => onVoid(sale)}
            >
              <RotateCcw size={16} aria-hidden />
              {busyId === sale.id ? 'Voiding…' : 'Void job'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
