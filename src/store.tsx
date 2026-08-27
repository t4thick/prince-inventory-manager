import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { uid } from './lib/format'
import { drainOfflineQueue, enqueueOfflineSale, isOnline, pendingOfflineCount } from './lib/offline'
import { supabase } from './lib/supabase'
import type { CartLine, CheckoutDetails, PaymentMethod, Product, Sale } from './types'

const seedProducts: Product[] = [
  { id: 'p_oil', name: 'Engine Oil 5W-30 (qt)', price: 8.99, stock: 32, lowStockAt: 8, sku: 'OIL-5W30', createdAt: '', updatedAt: '' },
  { id: 'p_filter_oil', name: 'Oil Filter', price: 12.5, stock: 18, lowStockAt: 4, sku: 'FILT-OIL', createdAt: '', updatedAt: '' },
  { id: 'p_brake', name: 'Brake Pads (set)', price: 45, stock: 8, lowStockAt: 2, sku: 'BRK-PAD', createdAt: '', updatedAt: '' },
  { id: 'p_spark', name: 'Spark Plug', price: 6, stock: 24, lowStockAt: 6, sku: 'SPK-PLG', createdAt: '', updatedAt: '' },
  { id: 'p_air', name: 'Air Filter', price: 18, stock: 5, lowStockAt: 3, sku: 'FILT-AIR', createdAt: '', updatedAt: '' },
  { id: 'p_coolant', name: 'Coolant 1 gal', price: 22, stock: 10, lowStockAt: 3, sku: 'CLNT-1G', createdAt: '', updatedAt: '' },
  { id: 'p_svc_oil', name: 'Labor — Oil Change', price: 49.99, stock: 999, lowStockAt: 0, sku: 'SVC-OIL', createdAt: '', updatedAt: '' },
  { id: 'p_svc_brake', name: 'Labor — Brake Service', price: 120, stock: 999, lowStockAt: 0, sku: 'SVC-BRK', createdAt: '', updatedAt: '' },
]

type ProductRow = {
  id: string
  name: string
  price: number | string
  stock: number
  low_stock_at: number
  sku: string
  created_at: string
  updated_at: string
}

type SaleRow = {
  id: string
  items: Sale['items']
  total: number | string
  payment_method: PaymentMethod
  created_at: string
  worker_id: string | null
  worker_name: string
  customer_name: string
  vehicle_info: string
  voided_at: string | null
  voided_by: string | null
}

function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    lowStockAt: row.low_stock_at,
    sku: row.sku,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function productToRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    low_stock_at: product.lowStockAt,
    sku: product.sku,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  }
}

function saleFromRow(row: SaleRow): Sale {
  return {
    id: row.id,
    items: row.items,
    total: Number(row.total),
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    workerId: row.worker_id,
    workerName: row.worker_name ?? '',
    customerName: row.customer_name ?? '',
    vehicleInfo: row.vehicle_info ?? '',
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
  }
}

function buildSale(
  products: Product[],
  items: CartLine[],
  paymentMethod: PaymentMethod,
  workerId: string,
  workerName: string,
  details: CheckoutDetails,
): Sale | null {
  const now = new Date().toISOString()
  const lines = items
    .map((line) => {
      const product = products.find((p) => p.id === line.productId)
      if (!product || line.qty <= 0) return null
      const isLabor = product.sku.startsWith('SVC-')
      const qty = isLabor ? line.qty : Math.min(line.qty, product.stock)
      if (qty <= 0) return null
      return { productId: product.id, name: product.name, price: product.price, qty }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  if (lines.length === 0) return null

  return {
    id: uid('sale'),
    items: lines,
    total: lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    paymentMethod,
    createdAt: now,
    workerId,
    workerName,
    customerName: details.customerName.trim(),
    vehicleInfo: details.vehicleInfo.trim(),
    voidedAt: null,
    voidedBy: null,
  }
}

type ShopContextValue = {
  products: Product[]
  sales: Sale[]
  loading: boolean
  error: string | null
  offlinePending: number
  isOwner: boolean
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => void
  adjustStock: (id: string, delta: number) => void
  deleteProduct: (id: string) => void
  checkout: (items: CartLine[], paymentMethod: PaymentMethod, details: CheckoutDetails) => Promise<Sale | null>
  voidSale: (saleId: string) => Promise<boolean>
  clearError: () => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const { session, profile, isOwner } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offlinePending, setOfflinePending] = useState(0)

  const refresh = useCallback(async () => {
    if (!supabase || !session) return

    const [productRes, saleRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
    ])

    if (productRes.error) {
      setError(productRes.error.message)
      setLoading(false)
      return
    }
    if (saleRes.error) {
      setError(saleRes.error.message)
      setLoading(false)
      return
    }

    let nextProducts = (productRes.data as ProductRow[]).map(productFromRow)
    if (nextProducts.length === 0 && isOwner) {
      const now = new Date().toISOString()
      const seeded = seedProducts.map((p) => ({ ...p, createdAt: now, updatedAt: now }))
      await supabase.from('products').upsert(seeded.map(productToRow), {
        onConflict: 'id',
        ignoreDuplicates: true,
      })
      const again = await supabase.from('products').select('*').order('name')
      if (!again.error && again.data) {
        nextProducts = (again.data as ProductRow[]).map(productFromRow)
      }
    }

    setProducts(nextProducts)
    setSales((saleRes.data as SaleRow[]).map(saleFromRow))
    setError(null)
    setLoading(false)
  }, [session, isOwner])

  const submitSale = useCallback(
    async (sale: Sale) => {
      if (!supabase || !session?.user) return false

      const payload = {
        p_id: sale.id,
        p_items: sale.items,
        p_total: sale.total,
        p_payment_method: sale.paymentMethod,
        p_created_at: sale.createdAt,
        p_worker_id: session.user.id,
        p_worker_name: sale.workerName,
        p_customer_name: sale.customerName,
        p_vehicle_info: sale.vehicleInfo,
      }

      if (!isOnline()) {
        enqueueOfflineSale(payload)
        setOfflinePending((n) => n + 1)
        return true
      }

      const { error: err } = await supabase.rpc('record_sale', payload)
      if (err) {
        setError(err.message)
        return false
      }
      return true
    },
    [session],
  )

  const syncOffline = useCallback(async () => {
    const client = supabase
    if (!client || !session || !isOnline()) return
    const { synced, remaining } = await drainOfflineQueue(async (payload) => {
      const { error: err } = await client.rpc('record_sale', payload)
      return !err
    })
    setOfflinePending(remaining)
    if (synced > 0) await refresh()
  }, [session, refresh])

  useEffect(() => {
    if (!session) {
      setProducts([])
      setSales([])
      setLoading(false)
      return
    }

    setLoading(true)
    setOfflinePending(pendingOfflineCount())
    void refresh()
    void syncOffline()

    const client = supabase!
    const channel = client
      .channel('shop-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void refresh()
      })
      .subscribe()

    const onOnline = () => void syncOffline()
    window.addEventListener('online', onOnline)

    return () => {
      void client.removeChannel(channel)
      window.removeEventListener('online', onOnline)
    }
  }, [session, refresh, syncOffline])

  const value = useMemo<ShopContextValue>(
    () => ({
      products,
      sales,
      loading,
      error,
      offlinePending,
      isOwner,
      clearError: () => setError(null),
      addProduct: (input) => {
        if (!isOwner) {
          setError('Only the owner can add parts.')
          return
        }
        const now = new Date().toISOString()
        const product: Product = { ...input, id: uid('p'), createdAt: now, updatedAt: now }
        setProducts((prev) => [product, ...prev])
        void supabase?.from('products').insert(productToRow(product)).then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void refresh()
          }
        })
      },
      updateProduct: (id, patch) => {
        if (!isOwner) {
          setError('Only the owner can edit parts.')
          return
        }
        const now = new Date().toISOString()
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)))
        const row: Record<string, unknown> = { updated_at: now }
        if (patch.name !== undefined) row.name = patch.name
        if (patch.price !== undefined) row.price = patch.price
        if (patch.stock !== undefined) row.stock = patch.stock
        if (patch.lowStockAt !== undefined) row.low_stock_at = patch.lowStockAt
        if (patch.sku !== undefined) row.sku = patch.sku
        void supabase?.from('products').update(row).eq('id', id).then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void refresh()
          }
        })
      },
      adjustStock: (id, delta) => {
        void supabase?.rpc('adjust_product_stock', { p_id: id, p_delta: delta }).then(({ error: err }) => {
          if (err) {
            setError(err.message)
          } else {
            void refresh()
          }
        })
      },
      deleteProduct: (id) => {
        if (!isOwner) {
          setError('Only the owner can remove parts.')
          return
        }
        setProducts((prev) => prev.filter((p) => p.id !== id))
        void supabase?.from('products').delete().eq('id', id).then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void refresh()
          }
        })
      },
      checkout: async (items, paymentMethod, details) => {
        if (!session?.user || !profile) return null
        const sale = buildSale(products, items, paymentMethod, session.user.id, profile.displayName, details)
        if (!sale) return null

        const ok = await submitSale(sale)
        if (!ok) {
          await refresh()
          return null
        }

        if (isOnline()) await refresh()
        return sale
      },
      voidSale: async (saleId) => {
        if (!supabase) return false
        const { error: err } = await supabase.rpc('void_sale', { p_sale_id: saleId })
        if (err) {
          setError(err.message)
          return false
        }
        await refresh()
        return true
      },
    }),
    [products, sales, loading, error, offlinePending, isOwner, session, profile, refresh, submitSale],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside ShopProvider')
  return ctx
}
