import type { Payment, Product, Sale } from '../types'
import { todayKey } from './format'

export function summarizeStore(products: Product[], sales: Sale[], payments: Payment[], now = new Date()) {
  const today = todayKey(now)
  const active = sales.filter((sale) => !sale.voidedAt)
  const todays = active.filter((sale) => todayKey(new Date(sale.createdAt)) === today)
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now); day.setDate(day.getDate() - (6 - i))
    const key = todayKey(day)
    return { key, label: i === 6 ? 'Today' : day.toLocaleDateString('en-GH', { weekday: 'short' }), total: active.filter((s) => todayKey(new Date(s.createdAt)) === key).reduce((sum, s) => sum + s.total, 0) }
  })
  const sold = new Map<string, { id: string; name: string; qty: number; total: number }>()
  for (const sale of active.filter((s) => todayKey(new Date(s.createdAt)) >= series[0].key && todayKey(new Date(s.createdAt)) <= today)) {
    for (const line of sale.items) {
      const item = sold.get(line.productId) ?? { id: line.productId, name: line.name, qty: 0, total: 0 }
      item.qty += line.qty; item.total += line.lineTotal; sold.set(line.productId, item)
    }
  }
  const byMethod = { cash: 0, mobile_money: 0, card: 0, transfer: 0 }
  for (const payment of payments) {
    if (!payment.reversedAt && todayKey(new Date(payment.createdAt)) === today) byMethod[payment.paymentMethod] += payment.amount
  }
  return {
    salesToday: todays.reduce((sum, sale) => sum + sale.total, 0), countToday: todays.length,
    profitToday: todays.reduce((sum, sale) => sum + sale.grossProfit, 0),
    balance: active.reduce((sum, sale) => sum + sale.balanceDue, 0),
    collected: Object.values(byMethod).reduce((sum, amount) => sum + amount, 0), byMethod,
    low: products.filter((p) => !p.isLabor && p.stock <= p.lowStockAt).sort((a, b) => a.stock - b.stock),
    series, top: [...sold.values()].sort((a,b) => b.qty - a.qty).slice(0,5),
    recent: [...active].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5),
  }
}
