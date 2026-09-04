import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth'
import { Brand } from './Brand'
import { StoreContact } from './StoreContact'

export function LoginView() {
  const { signIn, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    setFailure('')
    setBusy(true)
    try { await signIn(name.trim(), password) }
    catch { setFailure('Unable to sign in. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  return <div className="signin-page">
    <header className="signin-header"><Brand /><span className="private-label"><LockKeyhole size={14} /> Staff access</span></header>
    <main className="signin-main">
      <section className="signin-intro">
        <p className="eyebrow">THE SHOP WORKSPACE</p>
        <h1>A good day.<br />A shop in order.</h1>
        <p>Sales, stock and customer accounts.<br />Everything you need for the day ahead.</p>
        <div className="signin-index"><span>01 <strong>Serve customers</strong></span><span>02 <strong>Keep stock in check</strong></span><span>03 <strong>Know your numbers</strong></span></div>
      </section>
      <section className="signin-form-panel" aria-labelledby="signin-title">
        <span className="signin-symbol"><LockKeyhole size={22} /></span>
        <h2 id="signin-title">Sign in to the shop</h2>
        <p>Use the account provided by your owner.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label>First name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="username" placeholder="First name (owner: email)" /></label>
          <label>Password<span className="password-field"><input required type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {(error || failure) && <p className="login-error" role="alert">{error || failure}</p>}
          <button type="submit" className="primary-btn login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={18} /></button>
        </form>
        <p className="signin-help">Need an account or help signing in?<br /><strong>Speak to the shop owner.</strong></p>
      </section>
    </main>
    <footer className="signin-footer"><StoreContact /><span>PRINCE AMOFAH AUTOS</span></footer>
  </div>
}
