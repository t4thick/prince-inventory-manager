import { describe, expect, it } from 'vitest'
import { calculateLine, calculateSaleTotals } from './finance'

describe('financial calculations', () => {
  it('applies 20 percent tax only to selected lines', () => {
    const taxable = calculateLine({
      unitPrice: 80,
      unitCost: 50,
      quantity: 1,
      applyTax: true,
      taxRate: 0.2,
    })
    const exempt = calculateLine({
      unitPrice: 40,
      unitCost: 10,
      quantity: 1,
      applyTax: false,
      taxRate: 0.2,
    })

    expect(taxable).toEqual({
      subtotal: 80,
      tax: 16,
      total: 96,
      cost: 50,
      grossProfit: 46,
    })
    expect(exempt.tax).toBe(0)
    expect(calculateSaleTotals([taxable, exempt])).toEqual({
      subtotal: 120,
      tax: 16,
      total: 136,
      cost: 60,
      grossProfit: 76,
    })
  })

  it('calculates profit from the final customer price including tax', () => {
    const result = calculateLine({
      unitPrice: 12.5,
      unitCost: 7,
      quantity: 2,
      applyTax: true,
      taxRate: 0.2,
    })

    expect(result.tax).toBe(5)
    expect(result.total).toBe(30)
    expect(result.grossProfit).toBe(16)
  })

  it('rounds currency at the line level', () => {
    const result = calculateLine({
      unitPrice: 8.99,
      unitCost: 5.5,
      quantity: 3,
      applyTax: true,
      taxRate: 0.2,
    })

    expect(result.subtotal).toBe(26.97)
    expect(result.tax).toBe(5.39)
    expect(result.total).toBe(32.36)
  })
})
