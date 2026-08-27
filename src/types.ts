export type PaymentMethod = 'cash' | 'card' | 'transfer'

export type UserRole = 'owner' | 'worker'

export type Profile = {
  id: string
  displayName: string
  role: UserRole
  createdAt: string
}

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
  workerId: string | null
  workerName: string
  customerName: string
  vehicleInfo: string
  voidedAt: string | null
  voidedBy: string | null
}

export type CheckoutDetails = {
  customerName: string
  vehicleInfo: string
}

export type CartLine = {
  productId: string
  qty: number
}
