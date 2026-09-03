export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export type FinancialLineInput = {
  unitPrice: number
  unitCost: number
  quantity: number
  applyTax: boolean
  taxRate: number
}

export type FinancialLineResult = {
  subtotal: number
  tax: number
  total: number
  cost: number
  grossProfit: number
}

export function calculateLine(input: FinancialLineInput): FinancialLineResult {
  const quantity = Math.max(0, Math.floor(input.quantity))
  const unitPrice = Math.max(0, input.unitPrice)
  const unitCost = Math.max(0, input.unitCost)
  const taxRate = input.applyTax ? Math.max(0, input.taxRate) : 0
  const subtotal = roundMoney(unitPrice * quantity)
  const tax = roundMoney(subtotal * taxRate)
  const cost = roundMoney(unitCost * quantity)

  return {
    subtotal,
    tax,
    total: roundMoney(subtotal + tax),
    cost,
    grossProfit: roundMoney(subtotal - cost),
  }
}

export function calculateSaleTotals(lines: FinancialLineResult[]) {
  return lines.reduce(
    (totals, line) => ({
      subtotal: roundMoney(totals.subtotal + line.subtotal),
      tax: roundMoney(totals.tax + line.tax),
      total: roundMoney(totals.total + line.total),
      cost: roundMoney(totals.cost + line.cost),
      grossProfit: roundMoney(totals.grossProfit + line.grossProfit),
    }),
    { subtotal: 0, tax: 0, total: 0, cost: 0, grossProfit: 0 },
  )
}
