import { useState } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { shouldShowInstallPrompt } from './lib/pwa'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  WalletCards,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { AuthProvider, useAuth } from './auth'
import { DashboardView } from './components/DashboardView'
import { CreditView } from './components/CreditView'
import { LoginView } from './components/LoginView'
import { MoreView } from './components/MoreView'
import { ReportsView } from './components/ReportsView'
import { SalesView } from './components/SalesView'
import { SellView } from './components/SellView'
import { StockView } from './components/StockView'
import { ShopProvider, useShop } from './store'

type Tab = 'dashboard' | 'sell' | 'stock' | 'sales' | 'credit' | 'reports' | 'more'

const desktopNavItems: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sell', label: 'Checkout', icon: Wrench },
  { id: 'stock', label: 'Parts', icon: Package },
  { id: 'sales', label: 'Jobs', icon: ClipboardList },
  { id: 'credit', label: 'Balances', icon: WalletCards },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

const mobileNavItems: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'sell', label: 'Checkout', icon: Wrench },
  { id: 'stock', label: 'Parts', icon: Package },
  { id: 'sales', label: 'Jobs', icon: ClipboardList },
  { id: 'more', label: 'More', icon: Menu },
]

function Shell() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const mobileTab = tab === 'credit' || tab === 'reports' ? 'more' : tab
  const [showInstall, setShowInstall] = useState(shouldShowInstallPrompt)
  const { profile, signOut } = useAuth()
  const { loading, error, offlinePending, clearError } = useShop()

  return (
    <div className="app-frame">
      {showInstall && <InstallPrompt onClose={() => setShowInstall(false)} />}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-word">Prince</span>
          <span className="brand-sub">Auto</span>
        </div>

        <nav className="side-nav">
          {desktopNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`side-link ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={19} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {profile && (
            <div className="side-user">
              <span className="side-user-name">{profile.displayName}</span>
              <span className={`role-pill ${profile.role}`}>{profile.role}</span>
            </div>
          )}
          <button type="button" className="side-signout" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="brand-word">Prince</span>
            <span className="brand-sub">Auto</span>
          </div>
          <div className="topbar-title">
            {[...desktopNavItems, ...mobileNavItems].find((item) => item.id === tab)?.label}
          </div>
          <div className="topbar-right">
            {offlinePending > 0 && (
              <span className="sync-chip" title="Sales waiting to sync">
                <WifiOff size={14} aria-hidden />
                {offlinePending}
              </span>
            )}
            {profile && (
              <div className="user-chip">
                <span className="user-avatar" aria-hidden>
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="user-name">{profile.displayName}</span>
                <span className={`role-pill ${profile.role}`}>{profile.role}</span>
              </div>
            )}
            <button
              type="button"
              className="ghost-btn sign-out"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </header>

        {error && (
          <p className="sync-banner" role="alert">
            {error}
            <button type="button" className="banner-dismiss" onClick={clearError}>
              Dismiss
            </button>
          </p>
        )}

        <main className="main-stage" key={tab}>
          {loading ? (
            <div className="loading-state">
              <div className="spinner" aria-hidden />
              <p>Loading shop data…</p>
            </div>
          ) : (
            <>
              {tab === 'dashboard' && <DashboardView onNavigate={setTab} />}
              {tab === 'sell' && <SellView />}
              {tab === 'stock' && <StockView />}
              {tab === 'sales' && <SalesView />}
              {tab === 'credit' && <CreditView />}
              {tab === 'reports' && <ReportsView />}
              {tab === 'more' && <MoreView onNavigate={setTab} />}
            </>
          )}
        </main>

        <nav className="tab-bar" aria-label="Main">
          {mobileNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`tab ${mobileTab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={mobileTab === id ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

function AppGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-screen">
        <div className="loading-state">
          <div className="spinner" aria-hidden />
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginView />
  }

  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  )
}
