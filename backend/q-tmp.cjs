const { Client } = require('pg'); const fs = require('fs');
const url = fs.readFileSync('.env','utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1].replace(/\?.*/,'');
const S = 'studio_a5711f00_0000_4000_8000_000000000001';
(async () => {
  const c = new Client({ connectionString: url }); await c.connect();
  for (const t of ['class_sessions','class_bookings','class_waitlist','class_attendance']) {
    try {
      const r = await c.query(`SELECT count(*)::int n FROM ${S}.${t}`);
      console.log(t.padEnd(20), r.rows[0].n);
    } catch (e) { console.log(t.padEnd(20), 'ERR', e.message.slice(0,60)); }
  }
  const today = await c.query(
    `SELECT id, name, start_time, capacity, enrolled_count FROM ${S}.class_sessions
      WHERE start_time::date = CURRENT_DATE ORDER BY start_time LIMIT 5`);
  console.log("\ntoday's sessions:"); console.table(today.rows);
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
