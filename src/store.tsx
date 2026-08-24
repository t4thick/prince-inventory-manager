import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { uid } from './lib/format'
import type { CartLine, PaymentMethod, Product, Sale, ShopState } from './types'

const STORAGE_KEY = 'prince-mechanic-v1'

const seedProducts: Product[] = [
  {
    id: 'p_oil',
    name: 'Engine Oil 5W-30 (qt)',
    price: 8.99,
    stock: 32,
    lowStockAt: 8,
    sku: 'OIL-5W30',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_filter_oil',
    name: 'Oil Filter',
    price: 12.5,
    stock: 18,
    lowStockAt: 4,
    sku: 'FILT-OIL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_brake',
    name: 'Brake Pads (set)',
    price: 45,
    stock: 8,
    lowStockAt: 2,
    sku: 'BRK-PAD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_spark',
    name: 'Spark Plug',
    price: 6,
    stock: 24,
    lowStockAt: 6,
    sku: 'SPK-PLG',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_air',
    name: 'Air Filter',
    price: 18,
    stock: 5,
    lowStockAt: 3,
    sku: 'FILT-AIR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_coolant',
    name: 'Coolant 1 gal',
    price: 22,
    stock: 10,
    lowStockAt: 3,
    sku: 'CLNT-1G',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_svc_oil',
    name: 'Labor — Oil Change',
    price: 49.99,
    stock: 999,
    lowStockAt: 0,
    sku: 'SVC-OIL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_svc_brake',
    name: 'Labor — Brake Service',
    price: 120,
    stock: 999,
    lowStockAt: 0,
    sku: 'SVC-BRK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function loadState(): ShopState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ShopState
      if (Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
        return parsed
      }
    }
  } catch {
    // fall through to seed
  }
  return { products: seedProducts, sales: [] }
}

type Action =
  | { type: 'add_product'; product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'update_product'; id: string; patch: Partial<Omit<Product, 'id' | 'createdAt'>> }
  | { type: 'adjust_stock'; id: string; delta: number }
  | { type: 'delete_product'; id: string }
  | { type: 'record_sale'; sale: Sale }

function buildSale(
  products: Product[],
  items: CartLine[],
  paymentMethod: PaymentMethod,
): Sale | null {
  const now = new Date().toISOString()
  const lines = items
    .map((line) => {
      const product = products.find((p) => p.id === line.productId)
      if (!product || line.qty <= 0) return null
      const qty = Math.min(line.qty, product.stock)
      if (qty <= 0) return null
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        qty,
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  if (lines.length === 0) return null

  return {
    id: uid('sale'),
    items: lines,
    total: lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    paymentMethod,
    createdAt: now,
  }
}

function reducer(state: ShopState, action: Action): ShopState {
  const now = new Date().toISOString()

  switch (action.type) {
    case 'add_product': {
      const product: Product = {
        ...action.product,
        id: uid('p'),
        createdAt: now,
        updatedAt: now,
      }
      return { ...state, products: [product, ...state.products] }
    }
    case 'update_product': {
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.id ? { ...p, ...action.patch, updatedAt: now } : p,
        ),
      }
    }
    case 'adjust_stock': {
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.id
            ? { ...p, stock: Math.max(0, p.stock + action.delta), updatedAt: now }
            : p,
        ),
      }
    }
    case 'delete_product': {
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.id),
      }
    }
    case 'record_sale': {
      const stockMap = new Map(action.sale.items.map((l) => [l.productId, l.qty]))
      const products = state.products.map((p) => {
        const sold = stockMap.get(p.id)
        if (!sold) return p
        return { ...p, stock: Math.max(0, p.stock - sold), updatedAt: now }
      })
      return {
        products,
        sales: [action.sale, ...state.sales],
      }
    }
    default:
      return state
  }
}

type ShopContextValue = {
  products: Product[]
  sales: Sale[]
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => void
  adjustStock: (id: string, delta: number) => void
  deleteProduct: (id: string) => void
  checkout: (items: CartLine[], paymentMethod: PaymentMethod) => Sale | null
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo<ShopContextValue>(
    () => ({
      products: state.products,
      sales: state.sales,
      addProduct: (product) => dispatch({ type: 'add_product', product }),
      updateProduct: (id, patch) => dispatch({ type: 'update_product', id, patch }),
      adjustStock: (id, delta) => dispatch({ type: 'adjust_stock', id, delta }),
      deleteProduct: (id) => dispatch({ type: 'delete_product', id }),
      checkout: (items, paymentMethod) => {
        const sale = buildSale(state.products, items, paymentMethod)
        if (!sale) return null
        dispatch({ type: 'record_sale', sale })
        return sale
      },
    }),
    [state],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used inside ShopProvider')
  return ctx
}
