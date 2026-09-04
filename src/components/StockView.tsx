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
  category: string
  brand: string
  unit: string
  shelfLocation: string
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
  category: '',
  brand: '',
  unit: 'Each',
  shelfLocation: '',
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
    category: product.category,
    brand: product.brand,
    unit: product.unit,
    shelfLocation: product.shelfLocation,
    stock: String(product.stock),
    lowStockAt: String(product.lowStockAt),
    sku: product.sku,
  }
}

export function StockView() {
  const { products, addProduct, updateProduct, adjustStock, setStock, deleteProduct, isOwner } = useShop()
  const [originalStock, setOriginalStock] = useState(0)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = products.filter((p) => stockFilter === 'all' || (stockFilter === 'low' ? !p.isLabor && p.stock > 0 && p.stock <= p.lowStockAt : !p.isLabor && p.stock === 0)).sort((a, b) => {
      const aLow = a.stock <= a.lowStockAt ? 0 : 1
      const bLow = b.stock <= b.lowStockAt ? 0 : 1
      if (aLow !== bLow) return aLow - bLow
      return a.name.localeCompare(b.name)
    })
    if (!q) return list
    return list.filter(
      (p) => [p.name, p.sku, p.category, p.brand, p.shelfLocation]
        .some((value) => value.toLowerCase().includes(q)),
    )
  }, [products, query, stockFilter])

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
    setOriginalStock(product.stock)
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditingId(null)
    setDraft(emptyDraft)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const name = draft.name.trim()
    const costPrice = Number(draft.costPrice)
    const price = Number(draft.price)
    const taxRate = Number(draft.taxRate) / 100
    const stock = Math.max(0, Math.floor(Number(draft.stock) || 0))
    const lowStockAt = Math.max(0, Math.floor(Number(draft.lowStockAt) || 0))
    const sku = draft.sku.trim().toUpperCase() || 'SKU'

    if (
      !name ||
      (!Number.isFinite(costPrice)) ||
      costPrice < 0 ||
      (!Number.isFinite(price)) ||
      price < 0 ||
      (!Number.isFinite(taxRate)) ||
      taxRate < 0 ||
      taxRate > 1
    ) return

    if (!Number.isSafeInteger(Number(draft.stock)) || Number(draft.stock) < 0) return
    if (editingId && stock !== originalStock) {
      setSaving(true)
      try {
        if (!await setStock(editingId, stock, originalStock)) return
      } finally { setSaving(false) }
    }
    if (editingId) {
      updateProduct(editingId, {
        name,
        costPrice,
        price,
        taxable: draft.taxable,
        taxRate,
        isLabor: draft.isLabor,
        barcode: draft.barcode.trim(),
        category: draft.category.trim(),
        brand: draft.brand.trim(),
        unit: draft.unit.trim() || 'Each',
        shelfLocation: draft.shelfLocation.trim(),
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
        category: draft.category.trim(),
        brand: draft.brand.trim(),
        unit: draft.unit.trim() || 'Each',
        shelfLocation: draft.shelfLocation.trim(),
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
          <p className="eyebrow">Inventory</p>
          <h1>Products</h1>
          <p className="page-description">Your catalog, prices, and stock levels.</p>
        </div>
        {isOwner && (
          <button type="button" className="primary-btn" onClick={openCreate}>
            <PackagePlus size={18} aria-hidden />
            Add product
          </button>
        )}
      </header>

      {!isOwner && (
        <p className="role-note panel">Workers can adjust stock counts. Only the owner can add, edit, or remove parts.</p>
      )}

      <div className="inventory-toolbar">
      <div className="search-row panel-search">
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find by name, part #, category, brand, or shelf"
          aria-label="Search products"
        />
      </div>
      <div className="inventory-filters" aria-label="Filter inventory">
        {(['all', 'low', 'out'] as const).map((filter) => <button key={filter} type="button" aria-pressed={stockFilter === filter} onClick={() => setStockFilter(filter)}>
          {filter === 'all' ? `All products (${products.length})` : filter === 'low' ? 'Low stock' : 'Out of stock'}
        </button>)}
      </div>
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
                <div className="product-price-line"><strong>{money(product.price)}</strong><span>per {product.unit.toLowerCase()} · {product.sku}</span></div>
                <div className="product-tags">
                  {product.category && <span>{product.category}</span>}
                  {product.brand && <span>{product.brand}</span>}
                  {product.shelfLocation && <span>Shelf {product.shelfLocation}</span>}
                  {low && <span className="stock-warning">{out ? 'Out of stock' : 'Low stock'}</span>}
                </div>
                <span className="meta product-financials">
                  {isOwner && <>Cost {money(product.costPrice)} · Profit {money(product.price - product.costPrice)} · </>}
                  {product.taxable ? `${percent(product.taxRate)} tax` : 'No tax'}
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
          <li className="retail-empty panel"><PackagePlus size={36} aria-hidden /><h2>{products.length ? 'No matching products' : 'Your shelves start here'}</h2><p>{products.length ? 'Try another search or stock filter.' : 'Add your first product with its price and starting quantity.'}</p>{isOwner && !products.length && <button type="button" className="primary-btn" onClick={openCreate}>Add your first product</button>}</li>
        )}
      </ul>

      {open && isOwner && (
        <ModalPortal onClose={closeForm}>
          <form
            className="modal panel product-modal"
            onSubmit={onSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="modal-head">
              <h2 id="product-form-title">{editingId ? 'Edit item' : 'New product'}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <h3 className="form-section-title">Product details</h3>
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
                  Category
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    placeholder="e.g. Filters"
                  />
                </label>
                <label>
                  Brand
                  <input
                    value={draft.brand}
                    onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                    placeholder="e.g. Bosch"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Unit
                  <select value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}>
                    <option>Each</option>
                    <option>Box</option>
                    <option>Pack</option>
                    <option>Set</option>
                    <option>Bottle</option>
                    <option>Case</option>
                    <option>Pair</option>
                  </select>
                </label>
                <label>
                  Shelf location
                  <input
                    value={draft.shelfLocation}
                    onChange={(e) => setDraft((d) => ({ ...d, shelfLocation: e.target.value }))}
                    placeholder="e.g. A3"
                  />
                </label>
              </div>
              <h3 className="form-section-title">Pricing &amp; quantity</h3>
              <div className="form-row">
                <label>
                  Cost price (GH₵)
                  <input
                    required
                    inputMode="decimal"
                    value={draft.costPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, costPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Base selling price (GH₵)
                  <input
                    required
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  {editingId ? 'On hand' : 'Initial on hand'}
                  <input
                    required
                    inputMode="numeric"
                    type="number"
                    min="0"
                    step="1"
                    value={draft.stock}
                    onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>
              <section className="owner-tax-settings" aria-label="Owner tax settings">
                <label className="owner-tax-switch">
                  <input type="checkbox" checked={draft.taxable} onChange={(e) => setDraft((d) => ({ ...d, taxable: e.target.checked }))} />
                  Include tax in customer price
                </label>
                <label>
                  Your tax rate (%)
                  <input type="number" min="0" max="100" step="any" inputMode="decimal" value={draft.taxRate} disabled={!draft.taxable} onChange={(e) => setDraft((d) => ({ ...d, taxRate: e.target.value }))} />
                </label>
                <p className="field-help">Set your own rate, or switch it off. Only you see the breakdown. Customers see one final price.</p>
              </section>
              <div className="pricing-preview">
                <span>Profit per unit</span>
                <strong>{money(Math.max(0, Number(draft.price) || 0) - Math.max(0, Number(draft.costPrice) || 0))}</strong>
                <span>Final customer price</span>
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
              <h3 className="form-section-title">Stock alerts &amp; codes</h3>
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

              </div>

            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to shelf'}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}
    </div>
  )
}
