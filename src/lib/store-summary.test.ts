import { describe, expect, it } from 'vitest'
import { summarizeStore } from './store-summary'
import type { Payment, Sale } from '../types'

const now = new Date(2026, 8, 3, 12)
const earlier = new Date(2026, 8, 2, 12).toISOString()
describe('store summary', () => {
  it('shows a genuinely empty store, with no demo revenue or stock', () => {
    const result = summarizeStore([], [], [], now)
    expect(result.salesToday).toBe(0)
    expect(result.balance).toBe(0)
    expect(result.low).toEqual([])
    expect(result.top).toEqual([])
    expect(result.series).toHaveLength(7)
    expect(result.series.every((day) => day.total === 0)).toBe(true)
  })
  it('counts payments by collection date, including old credit sales, excluding reversals', () => {
    const payment = { id:'one', saleId:'old', customerId:null, amount:50, paymentMethod:'cash', notes:'', recordedBy:'user', createdAt:now.toISOString(), reversedAt:null } satisfies Payment
    const result = summarizeStore([], [], [payment, {...payment, id:'reversed', amount:100, reversedAt:now.toISOString()}, {...payment, id:'yesterday', createdAt:earlier}], now)
    expect(result.collected).toBe(50)
    expect(result.byMethod.cash).toBe(50)
    expect(result.salesToday).toBe(0)
  })
  it('excludes voids from totals and does not mix previous sales into today', () => {
    const sale: Sale = { id:'one', receiptNumber:'PA-1', total:120, subtotal:100, taxTotal:20, costTotal:80, grossProfit:20, balanceDue:40, amountPaid:80, paymentStatus:'partial', paymentMethod:'credit', workerId:'user', workerName:'Owner', customerId:null, customerName:'Buyer', customerPhone:'', vehicleInfo:'', dueDate:null, notes:'', voidedBy:null, items:[], createdAt:now.toISOString(), voidedAt:null }
    const result = summarizeStore([], [sale, {...sale, id:'void', voidedAt:now.toISOString()}, {...sale, id:'yesterday', createdAt:earlier}], [], now)
    expect(result.salesToday).toBe(120)
    expect(result.profitToday).toBe(20)
    expect(result.countToday).toBe(1)
    expect(result.balance).toBe(80)
  })
})
