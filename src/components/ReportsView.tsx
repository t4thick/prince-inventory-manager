import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { money, todayKey } from '../lib/format'
import { useShop } from '../store'

const DAY_MS = 24 * 60 * 60 * 1000

type Range = 'today' | '7d' | '30d' | 'all'

const ranges: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
]

const methodLabel = { cash: 'Cash', card: 'Card', transfer: 'Transfer' } as const

export function ReportsView() {
  const { sales, isOwner } = useShop()
  const [range, setRange] = useState<Range>('7d')

  const report = useMemo(() => {
    const active = sales.filter((s) => !s.voidedAt)
    const now = Date.now()

    const inRange = active.filter((s) => {
      if (range === 'all') return true
      if (range === 'today') return s.createdAt.startsWith(todayKey())
      const days = range === '7d' ? 7 : 30
      return new Date(s.createdAt).getTime() >= now - days * DAY_MS
    })

    const revenue = inRange.reduce((sum, s) => sum + s.total, 0)
    const items = inRange.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0)
    const avgTicket = inRange.length > 0 ? revenue / inRange.length : 0

    const byMethod = new Map<string, { jobs: number; revenue: number }>()
    for (const s of inRange) {
      const cur = byMethod.get(s.paymentMethod) ?? { jobs: 0, revenue: 0 }
      cur.jobs += 1
      cur.revenue += s.total
      byMethod.set(s.paymentMethod, cur)
    }

    const byWorker = new Map<string, { jobs: number; revenue: number }>()
    for (const s of inRange) {
      const name = s.workerName || 'Unknown'
      const cur = byWorker.get(name) ?? { jobs: 0, revenue: 0 }
      cur.jobs += 1
      cur.revenue += s.total
      byWorker.set(name, cur)
    }

    const byItem = new Map<string, { qty: number; revenue: number }>()
    for (const s of inRange) {
      for (const item of s.items) {
        const cur = byItem.get(item.name) ?? { qty: 0, revenue: 0 }
        cur.qty += item.qty
        cur.revenue += item.qty * item.price
        byItem.set(item.name, cur)
      }
    }

    return {
      inRange,
      revenue,
      items,
      avgTicket,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      byWorker: [...byWorker.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      byItem: [...byItem.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 12),
    }
  }, [sales, range])

  function exportCsv() {
    const rows: string[][] = [
      ['Sale ID', 'Date', 'Worker', 'Customer', 'Vehicle', 'Payment', 'Item', 'Qty', 'Unit price', 'Line total'],
    ]
    for (const s of report.inRange) {
      for (const item of s.items) {
        rows.push([
          s.id,
          s.createdAt,
          s.workerName,
          s.customerName,
          s.vehicleInfo,
          s.paymentMethod,
          item.name,
          String(item.qty),
          item.price.toFixed(2),
          (item.qty * item.price).toFixed(2),
        ])
      }
    }
    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prince-auto-sales-${range}-${todayKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view reports-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Numbers</p>
          <h1>Reports</h1>
        </div>
        {isOwner && report.inRange.length > 0 && (
          <button type="button" className="primary-btn" onClick={exportCsv}>
            <Download size={17} aria-hidden />
            Export CSV
          </button>
        )}
      </header>

      <div className="range-tabs" role="tablist" aria-label="Report range">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={range === r.id ? 'active' : ''}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Revenue</span>
            <strong className="kpi-value">{money(report.revenue)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Jobs</span>
            <strong className="kpi-value">{report.inRange.length}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Items sold</span>
            <strong className="kpi-value">{report.items}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-body">
            <span className="kpi-label">Avg ticket</span>
            <strong className="kpi-value">{money(report.avgTicket)}</strong>
          </div>
        </div>
      </div>

      {report.inRange.length === 0 ? (
        <p className="empty-note card">No jobs in this range yet.</p>
      ) : (
        <div className="report-grid">
          <section className="card" aria-label="Revenue by payment method">
            <div className="card-head">
              <h2>By payment</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Jobs</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.byMethod.map(([method, row]) => (
                  <tr key={method}>
                    <td>{methodLabel[method as keyof typeof methodLabel] ?? method}</td>
                    <td className="num">{row.jobs}</td>
                    <td className="num">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card" aria-label="Revenue by worker">
            <div className="card-head">
              <h2>By worker</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="num">Jobs</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.byWorker.map(([name, row]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{row.jobs}</td>
                    <td className="num">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card report-items" aria-label="Top items">
            <div className="card-head">
              <h2>Top items</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.byItem.map(([name, row]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{row.qty}</td>
                    <td className="num">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
