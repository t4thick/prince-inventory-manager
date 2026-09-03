import { BarChart3, ChevronRight, LogOut, WalletCards } from 'lucide-react'
import { useAuth } from '../auth'

type Props = {
  onNavigate: (tab: 'credit' | 'reports') => void
}

export function MoreView({ onNavigate }: Props) {
  const { profile, signOut } = useAuth()

  return (
    <div className="view more-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Prince Auto</p>
          <h1>More</h1>
        </div>
      </header>

      {profile && (
        <section className="mobile-account card">
          <div className="user-avatar" aria-hidden>
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{profile.displayName}</strong>
            <span className={`role-pill ${profile.role}`}>{profile.role}</span>
          </div>
        </section>
      )}

      <nav className="more-menu" aria-label="More features">
        <button type="button" className="more-link" onClick={() => onNavigate('credit')}>
          <span className="more-link-icon is-orange"><WalletCards size={21} aria-hidden /></span>
          <span>
            <strong>Customer balances</strong>
            <small>Credit sales and payments</small>
          </span>
          <ChevronRight size={19} aria-hidden />
        </button>
        <button type="button" className="more-link" onClick={() => onNavigate('reports')}>
          <span className="more-link-icon is-blue"><BarChart3 size={21} aria-hidden /></span>
          <span>
            <strong>Reports</strong>
            <small>Sales, tax, costs, and profit</small>
          </span>
          <ChevronRight size={19} aria-hidden />
        </button>
      </nav>

      <button type="button" className="more-signout ghost-btn danger" onClick={() => void signOut()}>
        <LogOut size={18} aria-hidden />
        Sign out
      </button>
    </div>
  )
}
