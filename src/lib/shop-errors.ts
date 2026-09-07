type ShopError = {
  code?: string | null
  message?: string | null
}

export function isJwtClockSkewError(error: ShopError | string | null | undefined): boolean {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  const normalized = message.toLowerCase()
  return normalized.includes('jwt') && normalized.includes('future')
}

export function friendlyShopError(error: ShopError | string | null | undefined): string {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  const normalized = message.toLowerCase()

  if (isJwtClockSkewError(error)) {
    return 'Your secure session was briefly out of sync. Try again. If this keeps happening, set your phone Date & time to Automatic.'
  }

  if ((error && typeof error !== 'string' && error.code === '23505') || normalized.includes('duplicate key')) {
    if (normalized.includes('barcode')) {
      return 'That barcode is already used by another product.'
    }
    if (normalized.includes('sku')) {
      return 'That Part # is already used. Enter a different Part # or leave it blank.'
    }
    return 'That record already exists. Check the Part # and barcode, then try again.'
  }

  return message || 'Something went wrong. Please try again.'
}
