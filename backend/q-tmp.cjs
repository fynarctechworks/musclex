const { Client } = require('pg'); const fs = require('fs');
const url = fs.readFileSync('.env','utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1].replace(/\?.*/,'');
(async()=>{const c=new Client({connectionString:url});await c.connect();
const cols=await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' ORDER BY ordinal_position`);
console.log('user_roles columns:', cols.rows.map(r=>r.column_name).join(', '));
const r=await c.query(`SELECT ur.user_id, ur.studio_id, ur.role_name, s.name FROM public.user_roles ur JOIN public.studios s ON s.id=ur.studio_id WHERE s.name ILIKE '%test gym%'`);
console.table(r.rows);
await c.end();})().catch(e=>console.error(e.message));
