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
  if (owner?.role !== 'owner') return reply({ error: 'Only the owner can remove worker accounts.' }, 403)

  let body
  try { body = await request.json() } catch { return reply({ error: 'Invalid worker account.' }, 400) }
  const workerId = typeof body?.workerId === 'string' ? body.workerId : ''
  if (!workerId || workerId === user.id) return reply({ error: 'The owner account cannot be removed.' }, 400)
  const { data: worker } = await admin.from('profiles').select('role').eq('id', workerId).maybeSingle()
  if (!worker) return reply({ error: 'Worker account not found.' }, 404)
  if (worker.role !== 'worker') return reply({ error: 'Only worker accounts can be removed.' }, 400)

  const { error } = await admin.auth.admin.deleteUser(workerId)
  if (error) {
    console.error('Worker deletion failed', { code: error.code, status: error.status })
    return reply({ error: 'Unable to remove this worker. Please try again.' }, 500)
  }
  return reply({ success: true })
})
