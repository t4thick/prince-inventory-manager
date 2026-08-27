import { useMemo, useState, type FormEvent } from 'react'
import { Minus, PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { money } from '../lib/format'
import { useShop } from '../store'
import type { Product } from '../types'

type Draft = {
  name: string
  price: string
  stock: string
  lowStockAt: string
  sku: string
}

const emptyDraft: Draft = {
  name: '',
  price: '',
  stock: '',
  lowStockAt: '5',
  sku: '',
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    price: String(product.price),
    stock: String(product.stock),
    lowStockAt: String(product.lowStockAt),
    sku: product.sku,
  }
}

export function StockView() {
  const { products, addProduct, updateProduct, adjustStock, deleteProduct, isOwner } = useShop()
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...products].sort((a, b) => {
      const aLow = a.stock <= a.lowStockAt ? 0 : 1
      const bLow = b.stock <= b.lowStockAt ? 0 : 1
      if (aLow !== bLow) return aLow - bLow
      return a.name.localeCompare(b.name)
    })
    if (!q) return list
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, query])

  function openCreate() {
    if (!isOwner) return
    setEditingId(null)
    setDraft(emptyDraft)
    setOpen(true)
  }

  function openEdit(product: Product) {
    if (!isOwner) return
    setEditingId(product.id)
    setDraft(toDraft(product))
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditingId(null)
    setDraft(emptyDraft)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    const price = Number(draft.price)
    const stock = Math.max(0, Math.floor(Number(draft.stock) || 0))
    const lowStockAt = Math.max(0, Math.floor(Number(draft.lowStockAt) || 0))
    const sku = draft.sku.trim().toUpperCase() || 'SKU'

    if (!name || Number.isNaN(price) || price < 0) return

    if (editingId) {
      updateProduct(editingId, { name, price, stock, lowStockAt, sku })
    } else {
      addProduct({ name, price, stock, lowStockAt, sku })
    }
    closeForm()
  }

  return (
    <div className="view stock-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Parts shelf</p>
          <h1>Parts</h1>
        </div>
        {isOwner && (
          <button type="button" className="primary-btn" onClick={openCreate}>
            <PackagePlus size={18} aria-hidden />
            Add part / labor
          </button>
        )}
      </header>

      {!isOwner && (
        <p className="role-note panel">Workers can adjust stock counts. Only the owner can add, edit, or remove parts.</p>
      )}

      <div className="search-row panel-search">
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find by name or part #"
          aria-label="Search parts"
        />
      </div>

      <ul className="stock-list">
        {filtered.map((product) => {
          const isLabor = product.sku.startsWith('SVC-')
          const low = !isLabor && product.stock <= product.lowStockAt
          const out = !isLabor && product.stock <= 0
          return (
            <li key={product.id} className={`stock-row ${low ? 'is-low' : ''}`}>
              <div className="stock-info">
                <strong>{product.name}</strong>
                <span className="meta">
                  {product.sku} · {money(product.price)}
                  {isLabor ? ' · labor rate' : ''}
                </span>
              </div>
              <div className="stock-qty" aria-live="polite">
                {isLabor ? (
                  <span className="qty-pill labor">Labor</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove one ${product.name}`}
                      onClick={() => adjustStock(product.id, -1)}
                      disabled={product.stock <= 0}
                    >
                      <Minus size={16} />
                    </button>
                    <span className={`qty-pill ${out ? 'out' : low ? 'low' : ''}`}>
                      {product.stock}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Add one ${product.name}`}
                      onClick={() => adjustStock(product.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </div>
              {isOwner && (
                <div className="stock-actions">
                  <button type="button" className="ghost-btn" onClick={() => openEdit(product)}>
                    <Pencil size={16} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    onClick={() => {
                      if (confirm(`Remove ${product.name} from inventory?`)) {
                        deleteProduct(product.id)
                      }
                    }}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="empty-note panel">No parts yet. Add what Prince keeps on the shelf.</li>
        )}
      </ul>

      {open && isOwner && (
        <div className="modal-backdrop" role="presentation" onClick={closeForm}>
          <form
            className="modal panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
            aria-labelledby="product-form-title"
          >
            <div className="modal-head">
              <h2 id="product-form-title">{editingId ? 'Edit item' : 'New part or labor'}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <label>
              Name
              <input
                required
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Brake Pads (set)"
                autoFocus
              />
            </label>
            <div className="form-row">
              <label>
                Price
                <input
                  required
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label>
                On hand
                <input
                  required
                  inputMode="numeric"
                  value={draft.stock}
                  onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Low stock at
                <input
                  inputMode="numeric"
                  value={draft.lowStockAt}
                  onChange={(e) => setDraft((d) => ({ ...d, lowStockAt: e.target.value }))}
                />
              </label>
              <label>
                Part #
                <input
                  value={draft.sku}
                  onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                {editingId ? 'Save changes' : 'Add to shelf'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
