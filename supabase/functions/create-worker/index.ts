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
  // Validate the signed-in user on the server; never trust a role sent by the browser.
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return reply({ error: 'Sign in to continue.' }, 401)
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profileError || profile?.role !== 'owner') return reply({ error: 'Only the owner can create staff accounts.' }, 403)
  let body
  try { body = await request.json() } catch { return reply({ error: 'Invalid account details.' }, 400) }
  const { name, password } = body ?? {}
  const firstName = typeof name === 'string' ? name.trim() : ''
  if (!/^[A-Za-z][A-Za-z'-]{1,39}$/.test(firstName) ||
      typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return reply({ error: 'Enter one first name and a password of 12–128 characters.' }, 400)
  }
  const loginName = firstName.toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9'-]/g, '')
  const email = `${loginName}@staff.princeamofahautos.com`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: firstName, staff_login: loginName },
    app_metadata: { provisioned_by_owner: user.id },
  })
  if (error) {
    // Record the provider error code, never account details or passwords.
    console.error('Worker creation failed', { code: error.code, status: error.status })
    if (['email_exists', 'email_conflict', 'user_already_exists'].includes(error.code ?? '')) {
      return reply({ error: 'That first name is already in use. Use a distinct first name or nickname.' }, 409)
    }
    if (error.code === 'weak_password') return reply({ error: 'Choose a stronger password with upper- and lowercase letters, numbers and symbols.' }, 400)
    return reply({ error: 'The account service could not save this worker. Please try again. If it continues, contact the shop administrator.' }, 500)
  }
  return reply({ member: { id: data.user.id, display_name: firstName, role: 'worker' } })
})
