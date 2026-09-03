import { useMemo, useState, type FormEvent } from 'react'
import { Banknote, Search, WalletCards, X } from 'lucide-react'
import { formatDateTime, money } from '../lib/format'
import { useShop } from '../store'
import type { CollectedPaymentMethod, Sale } from '../types'
import { ModalPortal } from './ModalPortal'

export function CreditView() {
  const { sales, recordPayment } = useShop()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<CollectedPaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const balances = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sales
      .filter((sale) => !sale.voidedAt && sale.balanceDue > 0)
      .filter((sale) => {
        if (!needle) return true
        return [
          sale.customerName,
          sale.customerPhone,
          sale.vehicleInfo,
          sale.receiptNumber,
        ].some((value) => value.toLowerCase().includes(needle))
      })
      .sort((a, b) => {
        const aOverdue = a.dueDate && new Date(`${a.dueDate}T23:59:59`) < new Date() ? 0 : 1
        const bOverdue = b.dueDate && new Date(`${b.dueDate}T23:59:59`) < new Date() ? 0 : 1
        return aOverdue - bOverdue || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  }, [sales, query])

  const totalOutstanding = balances.reduce((sum, sale) => sum + sale.balanceDue, 0)
  const overdue = balances.filter(
    (sale) => sale.dueDate && new Date(`${sale.dueDate}T23:59:59`) < new Date(),
  ).length

  function openPayment(sale: Sale) {
    setSelected(sale)
    setAmount(sale.balanceDue.toFixed(2))
    setMethod('cash')
    setNotes('')
  }

  function closePayment() {
    setSelected(null)
    setAmount('')
    setNotes('')
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > selected.balanceDue) return
    setSaving(true)
    const ok = await recordPayment(selected.id, value, method, notes)
    setSaving(false)
    if (ok) closePayment()
  }

  return (
    <div className="view credit-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Accounts receivable</p>
          <h1>Customer balances</h1>
        </div>
      </header>

      <div className="kpi-grid balance-kpis">
        <div className="kpi-card">
          <span className="kpi-icon is-orange"><WalletCards size={20} aria-hidden /></span>
          <div className="kpi-body">
            <span className="kpi-label">Outstanding</span>
            <strong className="kpi-value">{money(totalOutstanding)}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon is-blue"><Banknote size={20} aria-hidden /></span>
          <div className="kpi-body">
            <span className="kpi-label">Open sales</span>
            <strong className="kpi-value">{balances.length}</strong>
          </div>
        </div>
        <div className={`kpi-card ${overdue > 0 ? 'kpi-alert' : ''}`}>
          <div className="kpi-body">
            <span className="kpi-label">Overdue</span>
            <strong className="kpi-value">{overdue}</strong>
          </div>
        </div>
      </div>

      <div className="search-row panel-search">
        <Search size={18} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, phone, vehicle, or receipt"
          aria-label="Search customer balances"
        />
      </div>

      {balances.length === 0 ? (
        <div className="empty-note panel">
          {query ? 'No balances match that search.' : 'No outstanding customer balances.'}
        </div>
      ) : (
        <ul className="balance-list">
          {balances.map((sale) => {
            const isOverdue =
              sale.dueDate && new Date(`${sale.dueDate}T23:59:59`) < new Date()
            return (
              <li key={sale.id} className={`balance-card ${isOverdue ? 'is-overdue' : ''}`}>
                <div className="balance-main">
                  <div>
                    <strong>{sale.customerName || 'Unnamed customer'}</strong>
                    <span>{sale.customerPhone || sale.vehicleInfo || sale.receiptNumber}</span>
                  </div>
                  <strong className="balance-amount">{money(sale.balanceDue)}</strong>
                </div>
                <div className="balance-meta">
                  <span>{sale.receiptNumber}</span>
                  <span>{formatDateTime(sale.createdAt)}</span>
                  {sale.dueDate && <span className={isOverdue ? 'overdue-text' : ''}>Due {sale.dueDate}</span>}
                </div>
                <div className="balance-progress">
                  <span>Total {money(sale.total)}</span>
                  <span>Paid {money(sale.amountPaid)}</span>
                  <span className={`status-badge ${isOverdue ? 'overdue' : sale.paymentStatus}`}>
                    {isOverdue ? 'Overdue' : sale.paymentStatus === 'partial' ? 'Partially paid' : 'Due'}
                  </span>
                </div>
                <button type="button" className="primary-btn" onClick={() => openPayment(sale)}>
                  Record payment
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <ModalPortal onClose={closePayment}>
          <form
            className="modal panel"
            onSubmit={submitPayment}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
          >
            <div className="modal-head">
              <div>
                <h2 id="payment-title">Record payment</h2>
                <p>{selected.customerName} · Balance {money(selected.balanceDue)}</p>
              </div>
              <button type="button" className="icon-btn" onClick={closePayment} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <label>
                Amount
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label>
                Payment method
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as CollectedPaymentMethod)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label>
                Note
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={closePayment}>Cancel</button>
              <button
                type="submit"
                className="primary-btn"
                disabled={
                  saving ||
                  !Number.isFinite(Number(amount)) ||
                  Number(amount) <= 0 ||
                  Number(amount) > selected.balanceDue
                }
              >
                {saving ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </form>
        </ModalPortal>
      )}
    </div>
  )
}
