import { useMemo } from 'react'
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  DollarSign,
  Package,
  Smartphone,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { formatDateTime, money, todayKey } from '../lib/format'
import { useShop } from '../store'
import type { Sale } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

function dayLabel(offset: number): string {
  const d = new Date(Date.now() - offset * DAY_MS)
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

type Props = {
  onNavigate: (tab: 'sell' | 'stock' | 'sales' | 'credit') => void
}

export function DashboardView({ onNavigate }: Props) {
  const { products, sales, offlinePending, isOwner } = useShop()

  const data = useMemo(() => {
    const today = todayKey()
    const active = sales.filter((s) => !s.voidedAt)
    const todays = active.filter((s) => todayKey(new Date(s.createdAt)) === today)

    const revenueToday = todays.reduce((sum, s) => sum + s.total, 0)
    const taxToday = todays.reduce((sum, s) => sum + s.taxTotal, 0)
    const profitToday = todays.reduce((sum, s) => sum + s.grossProfit, 0)
    const itemsToday = todays.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0)

    // 7-day revenue series (oldest first)
    const series = Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i
      const key = todayKey(new Date(Date.now() - offset * DAY_MS))
      const total = active
        .filter((s) => todayKey(new Date(s.createdAt)) === key)
        .reduce((sum, s) => sum + s.total, 0)
      return { label: offset === 0 ? 'Today' : dayLabel(offset), total }
    })
    const seriesMax = Math.max(...series.map((p) => p.total), 1)
    const weekRevenue = series.reduce((sum, p) => sum + p.total, 0)

    // Payment split today
    const byMethod = { cash: 0, card: 0, transfer: 0, credit: 0 }
    for (const s of todays) byMethod[s.paymentMethod] += s.amountPaid
    const methodMax = Math.max(byMethod.cash, byMethod.card, byMethod.transfer, byMethod.credit, 1)
    const outstanding = active.reduce((sum, sale) => sum + sale.balanceDue, 0)
    const balanceCustomers = new Set(active.filter((sale) => sale.balanceDue > 0).map((sale) => sale.customerId ?? `${sale.customerName}:${sale.customerPhone}`)).size

    // Inventory summary (parts only, labor excluded)
    const parts = products.filter((p) => !p.isLabor)
    const unitsOnHand = parts.reduce((sum, p) => sum + p.stock, 0)
    const stockValue = parts.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
    const lowParts = parts
      .filter((p) => p.stock <= p.lowStockAt)
      .sort((a, b) => a.stock - b.stock)
    const outCount = parts.filter((p) => p.stock <= 0).length
    const categoryCount = new Set(parts.map((p) => p.category).filter(Boolean)).size

    // Top sellers, last 7 days
    const weekAgo = Date.now() - 7 * DAY_MS
    const soldMap = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const s of active) {
      if (new Date(s.createdAt).getTime() < weekAgo) continue
      for (const item of s.items) {
        const cur = soldMap.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 }
        cur.qty += item.qty
        cur.revenue += item.qty * item.price
        soldMap.set(item.productId, cur)
      }
    }
    const topSellers = [...soldMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)

    const recent = active.slice(0, 5)

    return {
      revenueToday,
      taxToday,
      profitToday,
      outstanding,
      balanceCustomers,
      salesToday: todays.length,
      itemsToday,
      series,
      seriesMax,
      weekRevenue,
      byMethod,
      methodMax,
      partsCount: parts.length,
      unitsOnHand,
      stockValue,
      lowParts,
      outCount,
      categoryCount,
      topSellers,
      recent,
    }
  }, [products, sales])

  return (
    <div className="view dashboard-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
      </header>

      <div className="kpi-grid">
        <button type="button" className="kpi-card" onClick={() => onNavigate('sales')}>
          <span className="kpi-icon is-green">
            <DollarSign size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Revenue today</span>
            <strong className="kpi-value">{money(data.revenueToday)}</strong>
          </div>
        </button>
        {isOwner && (
          <button type="button" className="kpi-card" onClick={() => onNavigate('sales')}>
            <span className="kpi-icon is-green">
              <TrendingUp size={20} aria-hidden />
            </span>
            <div className="kpi-body">
              <span className="kpi-label">Gross profit today</span>
              <strong className="kpi-value">{money(data.profitToday)}</strong>
            </div>
          </button>
        )}
        <button type="button" className="kpi-card" onClick={() => onNavigate('sales')}>
          <span className="kpi-icon is-blue">
            <Banknote size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Tax today</span>
            <strong className="kpi-value">{money(data.taxToday)}</strong>
          </div>
        </button>
        <button
          type="button"
          className={`kpi-card ${data.outstanding > 0 ? 'kpi-alert' : ''}`}
          onClick={() => onNavigate('credit')}
        >
          <span className="kpi-icon is-orange">
            <WalletCards size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Customer balances · {data.balanceCustomers} account{data.balanceCustomers === 1 ? '' : 's'}</span>
            <strong className="kpi-value">{money(data.outstanding)}</strong>
          </div>
        </button>
        <button type="button" className="kpi-card" onClick={() => onNavigate('sales')}>
          <span className="kpi-icon is-blue">
              <ShoppingCart size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Sales today</span>
            <strong className="kpi-value">{data.salesToday}</strong>
          </div>
        </button>
        <button type="button" className="kpi-card" onClick={() => onNavigate('sell')}>
          <span className="kpi-icon is-teal">
              <ShoppingCart size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Items sold today</span>
            <strong className="kpi-value">{data.itemsToday}</strong>
          </div>
        </button>
        <button
          type="button"
          className={`kpi-card ${data.lowParts.length > 0 ? 'kpi-alert' : ''}`}
          onClick={() => onNavigate('stock')}
        >
          <span className={`kpi-icon ${data.lowParts.length > 0 ? 'is-red' : 'is-gray'}`}>
            <AlertTriangle size={20} aria-hidden />
          </span>
          <div className="kpi-body">
            <span className="kpi-label">Parts low / out</span>
            <strong className="kpi-value">
              {data.lowParts.length}
              {data.outCount > 0 ? ` · ${data.outCount} out` : ''}
            </strong>
          </div>
        </button>
      </div>

      {offlinePending > 0 && (
        <p className="offline-banner" role="status">
          {offlinePending} sale{offlinePending === 1 ? '' : 's'} saved offline — will sync automatically.
        </p>
      )}

      <div className="dash-grid">
        <section className="card chart-card" aria-label="Revenue, last 7 days">
          <div className="card-head">
            <h2>
              <TrendingUp size={16} aria-hidden /> Last 7 days
            </h2>
            <span className="card-meta">{money(data.weekRevenue)} total</span>
          </div>
          <div className="bar-chart" role="img" aria-label="Daily revenue bar chart">
            {data.series.map((point) => (
              <div key={point.label} className="bar-col">
                <span className="bar-value">{point.total > 0 ? money(point.total) : ''}</span>
                <div
                  className={`bar ${point.label === 'Today' ? 'is-today' : ''}`}
                  style={{ height: `${Math.max(4, (point.total / data.seriesMax) * 100)}%` }}
                />
                <span className="bar-label">{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-label="Payments today">
          <div className="card-head">
            <h2>Payments today</h2>
          </div>
          <ul className="method-bars">
            <li>
              <span className="method-label">
                <Banknote size={15} aria-hidden /> Cash
              </span>
              <div className="method-track">
                <div
                  className="method-fill is-green"
                  style={{ width: `${(data.byMethod.cash / data.methodMax) * 100}%` }}
                />
              </div>
              <span className="method-amt">{money(data.byMethod.cash)}</span>
            </li>
            <li>
              <span className="method-label">
                <CreditCard size={15} aria-hidden /> Card
              </span>
              <div className="method-track">
                <div
                  className="method-fill is-blue"
                  style={{ width: `${(data.byMethod.card / data.methodMax) * 100}%` }}
                />
              </div>
              <span className="method-amt">{money(data.byMethod.card)}</span>
            </li>
            <li>
              <span className="method-label">
                <Smartphone size={15} aria-hidden /> Transfer
              </span>
              <div className="method-track">
                <div
                  className="method-fill is-orange"
                  style={{ width: `${(data.byMethod.transfer / data.methodMax) * 100}%` }}
                />
              </div>
              <span className="method-amt">{money(data.byMethod.transfer)}</span>
            </li>
            <li>
              <span className="method-label">
                <WalletCards size={15} aria-hidden /> Credit paid
              </span>
              <div className="method-track">
                <div
                  className="method-fill is-orange"
                  style={{ width: `${(data.byMethod.credit / data.methodMax) * 100}%` }}
                />
              </div>
              <span className="method-amt">{money(data.byMethod.credit)}</span>
            </li>
          </ul>
        </section>

        <section className="card" aria-label="Inventory summary">
          <div className="card-head">
            <h2>
              <Package size={16} aria-hidden /> Inventory
            </h2>
            <button type="button" className="link-btn" onClick={() => onNavigate('stock')}>
              View parts
            </button>
          </div>
          <div className="inv-summary">
            {isOwner && (
              <div className="inv-stat">
                <span>Inventory cost value</span>
                <strong>{money(data.stockValue)}</strong>
              </div>
            )}
            <div className="inv-stat">
              <span>Units on hand</span>
              <strong>{data.unitsOnHand}</strong>
            </div>
            <div className="inv-stat">
              <span>Part SKUs</span>
              <strong>{data.partsCount}</strong>
            </div>
            <div className="inv-stat">
              <span>Categories</span>
              <strong>{data.categoryCount}</strong>
            </div>
          </div>
          {data.lowParts.length > 0 && (
            <>
              <h3 className="card-subhead">Restock soon</h3>
              <ul className="low-list">
                {data.lowParts.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <span className="low-name">{p.name}</span>
                    <span className={`low-count ${p.stock <= 0 ? 'is-out' : ''}`}>
                      {p.stock <= 0 ? 'Out' : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card" aria-label="Top sellers this week">
          <div className="card-head">
            <h2>Top sellers · 7 days</h2>
          </div>
          {data.topSellers.length === 0 ? (
            <p className="card-empty">No sales yet this week.</p>
          ) : (
            <ul className="top-list">
              {data.topSellers.map((item, i) => (
                <li key={item.name}>
                  <span className="top-rank">{i + 1}</span>
                  <span className="top-name">{item.name}</span>
                  <span className="top-qty">{item.qty} sold</span>
                  <span className="top-rev">{money(item.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card recent-card" aria-label="Recent sales">
          <div className="card-head">
            <h2>Recent sales</h2>
            <button type="button" className="link-btn" onClick={() => onNavigate('sales')}>
              View all
            </button>
          </div>
          {data.recent.length === 0 ? (
            <p className="card-empty">No sales yet. Ring up the first one on Checkout.</p>
          ) : (
            <ul className="recent-list">
              {data.recent.map((sale: Sale) => (
                <li key={sale.id}>
                  <div className="recent-main">
                    <strong>{money(sale.total)}</strong>
                    <span className="recent-meta">
                      {sale.workerName}
                      {sale.customerName ? ` · ${sale.customerName}` : ''}
                    </span>
                  </div>
                  <span className="recent-time">{formatDateTime(sale.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
