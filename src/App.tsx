import { useState } from 'react'
import { ClipboardList, Package, Wrench } from 'lucide-react'
import { SalesView } from './components/SalesView'
import { SellView } from './components/SellView'
import { StockView } from './components/StockView'
import { ShopProvider } from './store'

type Tab = 'sell' | 'stock' | 'sales'

const tabs: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'sell', label: 'Checkout', icon: Wrench },
  { id: 'stock', label: 'Parts', icon: Package },
  { id: 'sales', label: 'Jobs', icon: ClipboardList },
]

function Shell() {
  const [tab, setTab] = useState<Tab>('sell')

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden />
      <header className="brand-bar">
        <div className="brand-mark">
          <span className="brand-word">Prince</span>
          <span className="brand-sub">Auto</span>
        </div>
        <p className="brand-tag">Parts, labor & payments</p>
      </header>

      <main className="main-stage" key={tab}>
        {tab === 'sell' && <SellView />}
        {tab === 'stock' && <StockView />}
        {tab === 'sales' && <SalesView />}
      </main>

      <nav className="tab-bar" aria-label="Main">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}
