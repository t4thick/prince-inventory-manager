import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import { staffEmailForName } from './lib/staff-login'
import type { Profile, UserRole } from './types'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  isOwner: boolean
  signIn: (nameOrEmail: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type ProfileRow = {
  id: string
  display_name: string
  role: UserRole
  created_at: string
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  }
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return profileFromRow(data as ProfileRow)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const next = await fetchProfile(userId)
    setProfile(next)
    if (!next) {
      setError('Profile not found. Run the Phase 1 SQL migration in Supabase.')
    }
    return next
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      setError('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
      return
    }

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => {
          if (active) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      error,
      isOwner: profile?.role === 'owner',
      clearError: () => setError(null),
      signIn: async (nameOrEmail, password) => {
        if (!supabase) return 'Supabase is not configured.'
        setError(null)
        const email = staffEmailForName(nameOrEmail)
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          setError(err.message)
          return err.message
        }
        return null
      },
      signOut: async () => {
        if (!supabase) return
        await supabase.auth.signOut()
        setProfile(null)
        setSession(null)
      },
    }),
    [session, profile, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
