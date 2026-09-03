import { useMemo, useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { formatDateTime, money, todayKey } from '../lib/format'
import { useAuth } from '../auth'
import { useShop } from '../store'
import type { Sale } from '../types'
import { ReceiptModal } from './ReceiptModal'

const methodLabel = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
  credit: 'Credit',
} as const

export function SalesView() {
  const { sales } = useShop()
  const [receipt, setReceipt] = useState<Sale | null>(null)

  const grouped = useMemo(() => {
    const today = todayKey()
    const active = sales.filter((s) => !s.voidedAt)
    const todays = active.filter((s) => todayKey(new Date(s.createdAt)) === today)
    const earlier = active.filter((s) => todayKey(new Date(s.createdAt)) !== today)
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
          <SaleList sales={grouped.todays} onReceipt={setReceipt} />
        </section>
      )}

      {grouped.earlier.length > 0 && (
        <section className="sales-section">
          <h2>Earlier</h2>
          <SaleList sales={grouped.earlier} onReceipt={setReceipt} />
        </section>
      )}

      {grouped.voided.length > 0 && (
        <section className="sales-section">
          <h2>Voided</h2>
          <SaleList sales={grouped.voided} voided onReceipt={setReceipt} />
        </section>
      )}
      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

function SaleList({
  sales,
  voided = false,
  onReceipt,
}: {
  sales: Sale[]
  voided?: boolean
  onReceipt: (sale: Sale) => void
}) {
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
              {!sale.voidedAt && sale.paymentStatus !== 'paid' && (
                <span className={`status-badge ${sale.paymentStatus}`}>
                  {sale.paymentStatus === 'partial' ? 'Partially paid' : 'Payment due'}
                </span>
              )}
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
                <span>
                  {money(item.lineTotal)}
                  {isOwner && (
                    <small className="line-profit">Profit {money(item.grossProfit)}</small>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="sale-summary">
            <span>Subtotal {money(sale.subtotal)}</span>
            <span>Tax {money(sale.taxTotal)}</span>
            {sale.balanceDue > 0 && <strong>Balance {money(sale.balanceDue)}</strong>}
            {isOwner && <strong>Profit {money(sale.grossProfit)}</strong>}
          </div>

          <div className="sale-actions">
            <button type="button" className="ghost-btn" onClick={() => onReceipt(sale)}>
              <Printer size={16} aria-hidden />
              Receipt
            </button>
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
          </div>
        </li>
      ))}
    </ul>
  )
}
