import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'

type Member = { id: string; display_name: string; role: string }

export function TeamView() {
  const { isOwner } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isOwner || !supabase) return
    let active = true
    void supabase.from('profiles').select('id,display_name,role').order('created_at').then(({ data, error }) => {
      if (!active) return
      if (error) setError('Unable to load staff. Please try again.')
      else setMembers(data ?? [])
    })
    return () => { active = false }
  }, [isOwner])

  if (!isOwner) return null

  async function createWorker(event: FormEvent) {
    event.preventDefault()
    if (!isOwner || !supabase || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('create-worker', {
        body: { name: name.trim(), password },
      })
      if (error) {
        const response = 'context' in error ? error.context : null
        const details = response instanceof Response ? await response.json().catch(() => null) : null
        throw new Error(details?.error || 'Unable to create account. Check the details and try again.')
      }
      if (!data?.member) throw new Error('Account response was incomplete. Refresh staff before retrying.')
      setMembers(previous => [...previous, data.member])
      setNotice(`Account created for ${name.trim()}. Give the worker their first name and password privately. They can sign in at prince-inventory-manager.vercel.app.`)
      setName(''); setPassword('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create account.') }
    finally { setBusy(false) }
  }

  return <div className="view">
    <header className="view-header"><div><p className="eyebrow">OWNER CONTROLS</p><h1>Staff access</h1><p className="page-description">The right access for the people behind your counter.</p></div></header>
    <div className="team-layout">
      <section className="card"><div className="card-head"><h2>Your team</h2><ShieldCheck size={19} color="var(--accent)" /></div>
        <ul className="team-list">{members.map(member => <li key={member.id}><span className="user-avatar" aria-hidden>{member.display_name.slice(0,1).toUpperCase()}</span><div className="team-person"><strong>{member.display_name}</strong><small>{member.role === 'owner' ? 'Full shop access' : 'Checkout, own daily revenue and customer balances'}</small></div><span className={`role-pill ${member.role}`}>{member.role}</span></li>)}</ul>
        <p className="team-note">Workers can sell, use Pay Later, record customer payments, print receipts and see their own daily revenue. Products, profit reports and staff settings stay with the owner.</p>
      </section>
      <section className="card"><div className="card-head"><h2>Create worker account</h2><UserPlus size={19} /></div>
        <form className="login-form" onSubmit={createWorker}>
          <label>First name<input required minLength={2} maxLength={40} pattern="[A-Za-z][A-Za-z'-]*" autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="For example, Kofi" /><small className="team-note">This becomes the worker’s sign-in name. Each first name must be unique.</small></label>
          <label>Password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /><small className="team-note">Use at least 12 characters. Share it privately with this worker.</small></label>
          {error && <p role="alert" className="login-error">{error}</p>}
          {notice && <p role="status" className="flash-ok">{notice}</p>}
          <button className="primary-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create worker account'}</button>
        </form>
      </section>
    </div>
  </div>
}
