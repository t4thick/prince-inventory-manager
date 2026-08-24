export type PaymentMethod = 'cash' | 'card' | 'transfer'

export type Product = {
  id: string
  name: string
  price: number
  stock: number
  lowStockAt: number
  sku: string
  createdAt: string
  updatedAt: string
}

export type SaleLine = {
  productId: string
  name: string
  price: number
  qty: number
}

export type Sale = {
  id: string
  items: SaleLine[]
  total: number
  paymentMethod: PaymentMethod
  createdAt: string
}

export type ShopState = {
  products: Product[]
  sales: Sale[]
}

export type CartLine = {
  productId: string
  qty: number
}
