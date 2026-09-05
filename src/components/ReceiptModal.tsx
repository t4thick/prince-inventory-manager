import { Printer, X } from 'lucide-react'
import { formatDateTime, money } from '../lib/format'
import type { Sale } from '../types'
import { ModalPortal } from './ModalPortal'
import { StoreContact } from './StoreContact'

const methodLabel = {
  cash: 'Cash', mobile_money: 'Mobile Money',
  card: 'Card',
  transfer: 'Transfer',
  credit: 'Credit / Pay later',
} as const

type Props = {
  sale: Sale
  onClose: () => void
}

export function ReceiptModal({ sale, onClose }: Props) {
  function printReceipt() {
    window.print()
  }

  return (
    <ModalPortal onClose={onClose} className="receipt-backdrop">
      <div
        className="modal panel receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="modal-head no-print">
          <h2 id="receipt-title">Sales receipt</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="receipt-body" id="print-receipt">
          <header className="receipt-header">
            <img className="receipt-logo" src="/brand/prince-amofah-autos-receipt.png" alt="Prince Amofah Autos" />
            <StoreContact />
            <span className="document-label">Sales receipt · GHS</span>
            <span className="receipt-meta">{formatDateTime(sale.createdAt)}</span>
            <span className="receipt-meta">{sale.receiptNumber}</span>
          </header>

          {sale.customerName && (
            <div className="receipt-customer">
              {sale.customerName && <p>Customer: {sale.customerName}</p>}
            </div>
          )}

          <p className="receipt-worker">Sold by: {sale.workerName}</p>

          <ul className="receipt-lines">
            {sale.items.map((item) => (
              <li key={item.productId}>
                <span className="receipt-item-name">
                  <strong>{item.name}</strong>
                  <small>{item.qty} × {money(item.qty > 0 ? item.lineTotal / item.qty : item.price)}</small>
                </span>
                <span>{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="receipt-total">
            <span>Total · {methodLabel[sale.paymentMethod]}</span>
            <strong>{money(sale.total)}</strong>
          </div>
          {sale.paymentMethod === 'credit' && (
            <div className="receipt-breakdown">
              <p><span>Paid</span><span>{money(sale.amountPaid)}</span></p>
              <p className="receipt-balance"><span>Balance due</span><strong>{money(sale.balanceDue)}</strong></p>
              {sale.dueDate && <p><span>Due date</span><span>{sale.dueDate}</span></p>}
            </div>
          )}

          <p className="receipt-thanks">Thank you for choosing PRINCE AMOFAH AUTOS.</p>
        </div>

        <div className="modal-actions no-print">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Done
          </button>
          <button type="button" className="primary-btn" onClick={printReceipt}>
            <Printer size={18} aria-hidden />
            Print
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
