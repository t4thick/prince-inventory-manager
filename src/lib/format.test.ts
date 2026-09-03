import { describe, expect, it } from 'vitest'
import { money } from './format'

describe('Ghanaian cedi display', () => {
  it('uses cedis and two decimal places', () => {
    expect(money(1234.5)).toContain('GH₵')
    expect(money(1234.5)).toContain('1,234.50')
    expect(money(0)).toContain('0.00')
    expect(money(-25)).toContain('25.00')
  })
})
