# MuscleX — VPS production deploy (srv1488215 / 187.127.129.90)

Isolated stack under `/opt/musclex`. Backends bind to `127.0.0.1` only; nginx + Let's
Encrypt front them. Connects to the **existing production Supabase**. No DB migrations
are run from here (schema is a hard-stop; SCC is hand-SQL only).

## Layout on the VPS
```
/opt/musclex/
  repo/      <- fresh shallow clone of master (created by deploy.sh)
  deploy/    <- this folder (compose, Dockerfiles, env, nginx, deploy.sh)
```

## Ports (host, localhost-only)
| Service | Host bind | Container |
|---|---|---|
| musclex_api (core) | 127.0.0.1:4100 | 4000 |
| musclex_scc_api | 127.0.0.1:4101 | 4001 |
| musclex_redis | (internal only) | 6379 |

## Public domains
| Host | -> |
|---|---|
| api.musclex.infynarc.com | 127.0.0.1:4100 (nginx + TLS) |
| scc-api.musclex.infynarc.com | 127.0.0.1:4101 (nginx + TLS) |
| app.musclex.infynarc.com | Vercel (gym admin) |
| admin.musclex.infynarc.com | Vercel (SCC frontend) |

## First deploy
1. Fill secrets in `deploy/.env.api` and `deploy/.env.scc` (every `__FILL__`).
2. `bash /opt/musclex/deploy/deploy.sh`
3. Health: `curl -s http://127.0.0.1:4100/health` and
   `curl -s http://127.0.0.1:4101/api/v1/health`
4. Install nginx vhosts (see below) + run certbot.

## nginx + TLS
```
# upgrade map (only if not already present elsewhere)
grep -rq 'connection_upgrade' /etc/nginx/ || cp deploy/nginx/musclex-maps.conf /etc/nginx/conf.d/
cp deploy/nginx/api.musclex.infynarc.com.conf     /etc/nginx/sites-available/
cp deploy/nginx/scc-api.musclex.infynarc.com.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/api.musclex.infynarc.com.conf     /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/scc-api.musclex.infynarc.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.musclex.infynarc.com -d scc-api.musclex.infynarc.com --non-interactive --agree-tos -m admin@infynarc.com --redirect
```

## Redeploy (after code change on master)
```
bash /opt/musclex/deploy/deploy.sh
```

## Rollback
```
cd /opt/musclex/deploy && docker compose down
# redeploy a previous commit:
BRANCH=<prev-sha-or-tag> bash /opt/musclex/deploy/deploy.sh
```
