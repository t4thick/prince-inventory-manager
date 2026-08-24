import { useMemo } from 'react'
import { money, todayKey } from '../lib/format'
import { useShop } from '../store'

export function TodayStrip() {
  const { sales, products } = useShop()

  const stats = useMemo(() => {
    const key = todayKey()
    const todaySales = sales.filter((s) => s.createdAt.startsWith(key))
    const revenue = todaySales.reduce((sum, s) => sum + s.total, 0)
    const itemsSold = todaySales.reduce(
      (sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0),
      0,
    )
    const low = products.filter((p) => p.stock <= p.lowStockAt).length
    return { revenue, count: todaySales.length, itemsSold, low }
  }, [sales, products])

  return (
    <div className="today-strip" aria-label="Today at a glance">
      <div className="stat">
        <span className="stat-label">Today</span>
        <strong className="stat-value">{money(stats.revenue)}</strong>
      </div>
      <div className="stat">
        <span className="stat-label">Jobs today</span>
        <strong className="stat-value">{stats.count}</strong>
      </div>
      <div className="stat">
        <span className="stat-label">Line items</span>
        <strong className="stat-value">{stats.itemsSold}</strong>
      </div>
      <div className={`stat ${stats.low ? 'stat-warn' : ''}`}>
        <span className="stat-label">Parts low</span>
        <strong className="stat-value">{stats.low}</strong>
      </div>
    </div>
  )
}
