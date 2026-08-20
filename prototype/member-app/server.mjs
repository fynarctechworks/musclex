/**
 * Dev host for the member-app prototype.
 *
 * Serves index.html and proxies /member/v1/* to the real Member BFF, so the
 * prototype runs same-origin and needs no CORS entry on the backend. It mints
 * a member session on boot and injects the Authorization header, so the
 * prototype is "already signed in" — auth is not what this prototype is for.
 *
 * Zero dependencies. node:http only.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = process.env.BFF_URL || 'http://localhost:4002';
const PORT = Number(process.env.PORT || 5199);
const PHONE = process.env.MEMBER_PHONE || '9877000111';
const TENANT = process.env.TENANT_ID || '73747564-696f-4a30-aa6d-7573636c6578';

let token = null;

async function signIn() {
  const res = await fetch(`${API}/member/v1/auth/dev/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, code: '000000', tenantId: TENANT }),
  });
  if (!res.ok) throw new Error(`dev session failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  token = body?.tokens?.accessToken;
  if (!token) throw new Error('no accessToken in dev session response');
  console.log(`signed in as ${PHONE} @ ${TENANT}`);
}

createServer(async (req, res) => {
  try {
    if (req.url === '/' || req.url === '/index.html') {
      const html = await readFile(join(HERE, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    if (req.url.startsWith('/member/v1/')) {
      // Buffer the body so it can be forwarded verbatim.
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);

      const headers = { authorization: `Bearer ${token}` };
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
      if (req.headers['idempotency-key']) headers['idempotency-key'] = req.headers['idempotency-key'];

      const upstream = await fetch(API + req.url, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });

      // The dev token is short-lived; re-mint once on 401 and retry.
      let final = upstream;
      if (upstream.status === 401) {
        await signIn();
        final = await fetch(API + req.url, {
          method: req.method,
          headers: { ...headers, authorization: `Bearer ${token}` },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        });
      }

      const text = await final.text();
      res.writeHead(final.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(text);
    }

    res.writeHead(404).end('not found');
  } catch (err) {
    console.error(err);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: String(err) } }));
  }
}).listen(PORT, async () => {
  await signIn();
  console.log(`member-app prototype → http://localhost:${PORT}`);
});
