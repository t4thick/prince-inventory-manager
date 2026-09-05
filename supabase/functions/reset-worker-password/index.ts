import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply({ error: 'Sign in to continue.' }, 401)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return reply({ error: 'Sign in to continue.' }, 401)
  const { data: owner } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (owner?.role !== 'owner') return reply({ error: 'Only the owner can reset worker passwords.' }, 403)

  let body
  try { body = await request.json() } catch { return reply({ error: 'Invalid password details.' }, 400) }
  const workerId = typeof body?.workerId === 'string' ? body.workerId : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!workerId || password.length < 12 || password.length > 128) return reply({ error: 'Use a password of 12–128 characters.' }, 400)
  const { data: worker } = await admin.from('profiles').select('role').eq('id', workerId).maybeSingle()
  if (worker?.role !== 'worker') return reply({ error: 'Worker account not found.' }, 404)
  const { error } = await admin.auth.admin.updateUserById(workerId, { password })
  if (error) return reply({ error: error.code === 'weak_password' ? 'Choose a stronger password.' : 'Unable to reset this password. Please try again.' }, 400)
  return reply({ success: true })
})
