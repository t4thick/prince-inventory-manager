import { useState, type FormEvent } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../auth'
import { StoreContact } from './StoreContact'

type Mode = 'signin' | 'signup'

export function LoginView() {
  const { signIn, signUp, error, clearError } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    setNotice(null)
    setBusy(true)

    if (mode === 'signin') {
      await signIn(email.trim(), password)
    } else {
      const err = await signUp(email.trim(), password, displayName.trim())
      if (!err) {
        setNotice('Account created. Check your email if confirmation is required, then sign in.')
        setMode('signin')
      }
    }

    setBusy(false)
  }

  return (
    <div className="login-screen">
      <aside className="login-identity">
        <div className="identity-wordmark">PRINCE AUTO<span>KUMASI · GHANA</span></div>
        <div><p className="identity-kicker">Your store, in order.</p><h1>Every product.<br />Every sale.<br /><span>All in one place.</span></h1></div>
        <StoreContact />
      </aside>
      <div className="login-card panel">
        <div className="brand-mark login-brand">
          <span className="brand-word">Prince</span>
          <span className="brand-sub">Auto</span>
        </div>
        <h2 className="login-heading">Welcome back.</h2>
        <p className="login-lead">Sign in to your store workspace.</p>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === 'signin' ? 'active' : ''}
            aria-selected={mode === 'signin'}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'signup' ? 'active' : ''}
            aria-selected={mode === 'signup'}
            onClick={() => setMode('signup')}
          >
            Join shop
          </button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          {mode === 'signup' && (
            <label>
              Your name
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mike"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@shop.com"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="login-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="primary-btn login-submit" disabled={busy}>
            {mode === 'signin' ? (
              <>
                <LogIn size={18} aria-hidden />
                Sign in
              </>
            ) : (
              <>
                <UserPlus size={18} aria-hidden />
                Create account
              </>
            )}
          </button>
        </form>

        <p className="login-foot">
          First account becomes <strong>owner</strong>. Later accounts are <strong>workers</strong>.
        </p>
      </div>
    </div>
  )
}
