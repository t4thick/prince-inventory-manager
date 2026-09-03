import { useMemo, useState, type FormEvent } from 'react'
import { Minus, PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { money, percent } from '../lib/format'
import { useShop } from '../store'
import type { Product } from '../types'
import { ModalPortal } from './ModalPortal'

type Draft = {
  name: string
  costPrice: string
  price: string
  taxable: boolean
  taxRate: string
  isLabor: boolean
  barcode: string
  stock: string
  lowStockAt: string
  sku: string
}

const emptyDraft: Draft = {
  name: '',
  costPrice: '',
  price: '',
  taxable: false,
  taxRate: '20',
  isLabor: false,
  barcode: '',
  stock: '',
  lowStockAt: '5',
  sku: '',
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    costPrice: String(product.costPrice),
    price: String(product.price),
    taxable: product.taxable,
    taxRate: String(product.taxRate * 100),
    isLabor: product.isLabor,
    barcode: product.barcode,
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
    const costPrice = Number(draft.costPrice)
    const price = Number(draft.price)
    const taxRate = Number(draft.taxRate) / 100
    const stock = Math.max(0, Math.floor(Number(draft.stock) || 0))
    const lowStockAt = Math.max(0, Math.floor(Number(draft.lowStockAt) || 0))
    const sku = draft.sku.trim().toUpperCase() || 'SKU'

    if (
      !name ||
      Number.isNaN(costPrice) ||
      costPrice < 0 ||
      Number.isNaN(price) ||
      price < 0 ||
      Number.isNaN(taxRate) ||
      taxRate < 0 ||
      taxRate > 1
    ) return

    if (editingId) {
      updateProduct(editingId, {
        name,
        costPrice,
        price,
        taxable: draft.taxable,
        taxRate,
        isLabor: draft.isLabor,
        barcode: draft.barcode.trim(),
        lowStockAt,
        sku,
      })
    } else {
      addProduct({
        name,
        costPrice,
        price,
        taxable: draft.taxable,
        taxRate,
        isLabor: draft.isLabor,
        barcode: draft.barcode.trim(),
        stock: draft.isLabor ? 0 : stock,
        lowStockAt,
        sku,
      })
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
          const isLabor = product.isLabor
          const low = !isLabor && product.stock <= product.lowStockAt
          const out = !isLabor && product.stock <= 0
          return (
            <li key={product.id} className={`stock-row ${low ? 'is-low' : ''}`}>
              <div className="stock-info">
                <strong>{product.name}</strong>
                <span className="meta">
                  {product.sku} · {money(product.price)}
                  {isOwner ? ` · Cost ${money(product.costPrice)} · Profit ${money(product.price - product.costPrice)}` : ''}
                  {product.taxable ? ` · ${percent(product.taxRate)} tax` : ' · no tax'}
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
        <ModalPortal onClose={closeForm}>
          <form
            className="modal panel"
            onSubmit={onSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="modal-head">
              <h2 id="product-form-title">{editingId ? 'Edit item' : 'New part or labor'}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <label>
                Name
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Brake Pads (set)"
                />
              </label>
              <div className="form-row">
                <label>
                  Cost price
                  <input
                    required
                    inputMode="decimal"
                    value={draft.costPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, costPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Selling price
                  <input
                    required
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  {editingId ? 'On hand (adjust in list)' : 'Initial on hand'}
                  <input
                    required
                    inputMode="numeric"
                    disabled={Boolean(editingId)}
                    value={draft.stock}
                    onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="pricing-preview">
                <span>Profit per unit</span>
                <strong>{money(Math.max(0, Number(draft.price) || 0) - Math.max(0, Number(draft.costPrice) || 0))}</strong>
                <span>Customer price with tax</span>
                <strong>
                  {money(
                    (Number(draft.price) || 0) *
                      (draft.taxable ? 1 + (Number(draft.taxRate) || 0) / 100 : 1),
                  )}
                </strong>
              </div>
              {Number(draft.price) < Number(draft.costPrice) && (
                <p className="field-warning">Warning: selling price is below cost.</p>
              )}
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
              <div className="form-row">
                <label>
                  Barcode
                  <input
                    value={draft.barcode}
                    onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Tax rate %
                  <input
                    inputMode="decimal"
                    value={draft.taxRate}
                    disabled={!draft.taxable}
                    onChange={(e) => setDraft((d) => ({ ...d, taxRate: e.target.value }))}
                  />
                </label>
              </div>
              <div className="check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.taxable}
                    onChange={(e) => setDraft((d) => ({ ...d, taxable: e.target.checked }))}
                  />
                  Taxable by default
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.isLabor}
                    onChange={(e) => setDraft((d) => ({ ...d, isLabor: e.target.checked }))}
                  />
                  Labor / service
                </label>
              </div>
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
        </ModalPortal>
      )}
    </div>
  )
}
