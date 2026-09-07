import { Printer, X } from 'lucide-react'
import { money } from '../lib/format'
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
            <img className="receipt-logo" src="/brand/maa-thess-receipt.jpeg" alt="MAA THESS Memorial Enterprise" width="1280" height="562" />
            <StoreContact />
            <span className="document-label">Sales receipt · GHS</span>
          </header>
          <dl className="receipt-details">
            <div><dt>Receipt no.</dt><dd>{sale.receiptNumber}</dd></div>
            <div><dt>Date</dt><dd>{new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div><dt>Customer</dt><dd>{sale.customerName || 'Walk-in customer'}</dd></div>
            <div><dt>Sold by</dt><dd>{sale.workerName || 'Shop staff'}</dd></div>
            <div><dt>Payment</dt><dd>{methodLabel[sale.paymentMethod]}</dd></div>
          </dl>
          {sale.voidedAt && <p className="receipt-voided">VOIDED RECEIPT</p>}
          <div className="receipt-column-head"><span>Item / Qty × unit price</span><span>Amount</span></div>

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
            <span>Total (GHS)</span>
            <strong>{money(sale.total)}</strong>
          </div>
          {sale.paymentMethod === 'credit' && (
            <div className="receipt-breakdown">
              <p><span>Paid</span><span>{money(sale.amountPaid)}</span></p>
              <p className="receipt-balance"><span>Balance due</span><strong>{money(sale.balanceDue)}</strong></p>
              {sale.dueDate && <p><span>Due date</span><span>{sale.dueDate}</span></p>}
            </div>
          )}

          <footer className="receipt-footer">
            <p className="receipt-thanks">Thank you for shopping with us.</p>
            <p>MAA THESS Memorial Enterprise</p>
            <p>Please keep this receipt for your records.</p>
          </footer>
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
