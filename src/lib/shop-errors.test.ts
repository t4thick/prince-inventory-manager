import { describe, expect, it } from 'vitest'
import { friendlyShopError, isJwtClockSkewError } from './shop-errors'

describe('friendlyShopError', () => {
  it('explains duplicate part numbers without database jargon', () => {
    expect(friendlyShopError({ code: '23505', message: 'duplicate key value violates unique constraint "products_sku_unique_idx"' }))
      .toBe('That Part # is already used. Enter a different Part # or leave it blank.')
  })

  it('recognizes a JWT issued in the future', () => {
    const error = 'JWT issued at future'
    expect(isJwtClockSkewError(error)).toBe(true)
    expect(friendlyShopError(error)).toContain('Date & time to Automatic')
  })
})
