// One-time operator tool. Defaults to backup-only; never runs on deployment.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const project = 'fbxbcbgfxgswvalxvvxv'
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project) throw new Error('Unexpected linked project')
const tables = ['products','product_costs','customers','sales','sale_financials','sale_items','payments','inventory_transactions']
const snapshot = `jsonb_build_object(${tables.map((table) => `'${table}', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) from public.${table} t)`).join(',')})`
function query(sql) {
  const output = execFileSync('npx', ['supabase','db','query','--linked','--output','json', sql], { encoding:'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] })
  const start = output.indexOf('{'); const end = output.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON query result')
  return JSON.parse(output.slice(start, end+1)).rows
}
const result = query(`select ${snapshot} as data, md5((${snapshot})::text) as fingerprint, (select count(*) from public.profiles) as profile_count, (select count(*) from auth.users) as auth_count`)[0]
if (!result?.data || !/^[a-f0-9]{32}$/.test(result.fingerprint)) throw new Error('Invalid backup')
for (const table of tables) if (!Array.isArray(result.data[table])) throw new Error('Incomplete backup')
const folder = resolve('.private-backups.local', new Date().toISOString().replaceAll(':','-'))
mkdirSync(folder, { recursive: true, mode: 0o700 })
const backup = { project, savedAt: new Date().toISOString(), ...result }
const file = resolve(folder, 'shop-data.json')
writeFileSync(file, JSON.stringify(backup, null, 2), { mode: 0o600, flag: 'wx' })
const saved = JSON.parse(readFileSync(file,'utf8'))
if (JSON.stringify(saved.data) !== JSON.stringify(result.data)) throw new Error('Backup verification failed')
// Recover only into a deliberately emptied database. No destructive statements here.
const restore = 'begin;\nalter table public.products disable trigger reject_legacy_demo_seed;\n' + tables.map((table) => `insert into public.${table} select * from jsonb_populate_recordset(null::public.${table}, '${JSON.stringify(result.data[table]).replaceAll("'", "''")}'::jsonb);`).join('\n') + '\nalter table public.products enable trigger reject_legacy_demo_seed;\ncommit;\n'
writeFileSync(resolve(folder, 'restore.sql'), restore, { mode:0o600, flag:'wx' })
console.log(JSON.stringify({backup:file, counts:Object.fromEntries(tables.map(t=>[t,result.data[t].length])), profilesPreserved:result.profile_count, authUsersPreserved:result.auth_count}, null, 2))
if (!process.argv.includes('--clear-confirmed')) process.exit(0)
// Lock, compare to the verified backup, then clear exact targets without CASCADE.
const clear = `begin;
lock table ${tables.map(t=>'public.'+t).join(',')} in access exclusive mode;
do $$ begin
  if md5((${snapshot})::text) <> '${result.fingerprint}' then raise exception 'Data changed after backup; no records cleared'; end if;
end $$;
truncate table ${tables.map(t=>'public.'+t).join(',')};
commit;`
query(clear)
const counts = query(`select ${tables.map(t=>`(select count(*) from public.${t}) as ${t}`).join(',')}, (select count(*) from public.profiles) as profiles, (select count(*) from auth.users) as auth_users`)[0]
console.log(JSON.stringify({after:counts}, null,2))
if (tables.some(t=>Number(counts[t]) !== 0) || Number(counts.profiles) !== Number(result.profile_count) || Number(counts.auth_users) !== Number(result.auth_count)) throw new Error('Reset verification requires attention')
