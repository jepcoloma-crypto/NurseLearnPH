# NurseLearn PH — Deployment Guide

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.x |
| PostgreSQL | ≥ 14 |
| npm | ≥ 9 |
| (optional) pm2 | `npm i -g pm2` |
| (optional) nginx | for reverse proxy + HTTPS |

---

## 1. Clone & Install

```bash
git clone <repo-url> nurselearn-ph
cd nurselearn-ph
npm install          # root (workspace)
cd server && npm install && cd ..
cd client && npm install && cd ..
```

---

## 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` — **minimum production values:**

```ini
DATABASE_URL=postgresql://nurselearn:STRONG_PASSWORD@localhost:5432/nurselearn_ph
NODE_ENV=production
PORT=3002
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=https://your-domain.com
LOG_LEVEL=info
AI_PROVIDER=none          # or "gemini" + set GEMINI_API_KEY

# Self-signup activation (see §9 for email setup)
SIGNUP_MODE=approval      # approval (default) | auto | off
RESEND_API_KEY=           # optional — email delivery via Resend (§9)
RESEND_FROM=NurseLearn PH <noreply@your-domain.com>
```

`SIGNUP_MODE` controls the public signup flow (`/signup`):

| Value | Behavior |
|---|---|
| `approval` (default) | Email verification first; the account stays **inactive** until an admin approves it from **Users → Pending approvals**. |
| `auto` | The account activates as soon as the email is verified. |
| `off` | No public signup — the endpoint rejects registration and the login page hides the "Create one" link. Admin-created accounts are unaffected. |

> **Never commit `.env` to git.** The `.env.example` is safe to commit.

---

## 3. Database Setup

### Option A — Fresh database (recommended)

```bash
createdb -U postgres nurselearn_ph

# Pin the database timezone to UTC (idempotent). Postgres stores naive
# timestamps, node-postgres reads them back as UTC, and the UI localizes
# in the browser — any other session timezone (Windows installs often
# inherit the system zone) shifts every displayed timestamp by the offset.
psql -U postgres -d nurselearn_ph -c "ALTER DATABASE nurselearn_ph SET timezone TO 'UTC';"

cd server

# 1. Apply all migrations (0000 → 0007)
npm run db:migrate

# 2. Load the full NLE question bank (516 questions, 14 categories)
#    MUST run BEFORE db:seed so the seeded practice exam references the
#    deterministic category IDs (a1000000-…)
psql -U postgres -d nurselearn_ph -f scripts/load-nle-bank.sql

# 3. Seed demo data (7 users, BSN program, NUR101, exams, virtual patients, 31 research projects)
npm run db:seed

# 4. Load the 37 NANDA-I nursing diagnoses
#    MUST run AFTER db:seed (replaces the 5 diagnoses from the seed)
psql -U postgres -d nurselearn_ph -f scripts/seed-nanda-diagnoses.sql
```

> ⚠️ **Option A requires an empty database.** A database created with
> `drizzle-kit push` (e.g. a copied dev database) has no migration history —
> `db:migrate` fails at `0000`. Deploy a fresh database instead.
>
> ⚠️ **Never run the test suites against the production database.** They write
> fixture data and, on teardown, delete the audit rows created during the run
> — harmless on a dev database, destructive on a live one.

### Option B — Clean existing database

```bash
# Run the pre-deploy cleanup script (from the repo root)
psql -d nurselearn_ph -U postgres -f server/scripts/cleanup-for-deploy.sql

# Then re-seed to restore demo data
cd server
npm run db:seed
psql -d nurselearn_ph -U postgres -f scripts/seed-nanda-diagnoses.sql
```

---

## 4. Build

### Server (TypeScript → Node.js)

```bash
cd server
npm run build        # tsc + scripts/build.js → dist/
```

Output: `server/dist/` (ESM, runs with `node dist/index.js`).

### Client (React → static files)

```bash
cd client
npm run build        # tsc --noEmit + vite build → dist/
```

Output: `client/dist/` (static HTML/JS/CSS — serve with nginx or any static server).

---

## 5. Run

### Development

```bash
cd server && npm run dev     # tsx watch — hot reload on :3002
cd client && npm run dev     # vite dev — hot reload on :5173
```

### Production — Process Manager (pm2)

```bash
cd server

# Start
NODE_ENV=production pm2 start dist/index.js --name nurselearn-api

# Save process list (auto-restart on reboot)
pm2 save
pm2 startup
```

### Production — systemd (alternative)

```ini
# /etc/systemd/system/nurselearn.service
[Unit]
Description=NurseLearn PH API
After=network.target postgresql.service

[Service]
Type=simple
User=nurselearn
WorkingDirectory=/opt/nurselearn-ph/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/opt/nurselearn-ph/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable nurselearn
sudo systemctl start nurselearn
```

---

## 6. Reverse Proxy (nginx)

Serve the client build as static files and proxy API requests:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Client static files
    root /opt/nurselearn-ph/client/dist;
    index index.html;

    # SPA fallback — all non-file routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 50m;   # file uploads
    }

    # Storage proxy (uploaded files)
    location /storage/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
    }

    # Cache static assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Same-host requirement:** the API honors `X-Forwarded-For` only from a
> loopback peer (`app.set("trust proxy", "loopback")` in `server/src/app.ts`),
> which matches the config above (nginx → `127.0.0.1:3002`). If you move nginx
> to a **separate host**, change that setting to the proxy's IP — otherwise all
> users share one rate-limit bucket and audit logs record the proxy's IP.

---

## 7. Post-Deploy Verification

```bash
# Health check
curl -s https://your-domain.com/api/health | jq .

# Expected:
# { "status": "ok", "environment": "production", "version": "0.1.0" }

# Login test
curl -s -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .success
# Expected: true
```

**Smoke checklist (browser):**
- [ ] Login page loads
- [ ] Admin login works
- [ ] Dashboard renders
- [ ] Courses list loads (pagination = 15)
- [ ] Users list loads (admin-only password edit)
- [ ] Announcements page loads
- [ ] Audit Log → newest LOGIN timestamp matches the current time

---

## 8. Default Accounts

| Username | Password | Role |
|---|---|---|
| admin | admin123 | ADMIN |
| coordinator | coordinator123 | PROGRAM_COORDINATOR |
| instructor | instructor123 | INSTRUCTOR |
| instructor1 | instructor123 | INSTRUCTOR |
| clinical | clinical123 | CLINICAL_INSTRUCTOR |
| student | newpass123 | STUDENT |
| student2 | student123 | STUDENT |

> **Change all passwords before public access.**

---

## 9. Optional Services

### Gemini AI (optional)

Set in `.env`:
```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Without it, AI features fall back to built-in mock responses.

### Email (optional — Resend > SMTP > dry-run)

Email is used for **signup verification links** (and approval/rejection
notices). The sender is picked automatically:

1. **Resend** (recommended) — when `RESEND_API_KEY` is set:
   ```ini
   RESEND_API_KEY=re_...
   RESEND_FROM=NurseLearn PH <noreply@your-domain.com>
   ```
   > ⚠️ **Resend requires a verified sending domain.** Add and verify your
   > domain at <https://resend.com/domains> (e.g. `mail.your-domain.com`),
   > then set `RESEND_FROM` to an address on that domain. Until the domain is
   > verified, every send fails with *"The resend.com domain is not
   > verified"* — signups still succeed, but no email is delivered.
2. **SMTP** (fallback) — when `SMTP_HOST` is set:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM="NurseLearn PH <noreply@your-domain.com>"
   ```
3. **Dry-run** — when neither is configured: emails are logged to the
   console and the verification link is returned in the register/resend
   API response (convenient for local development; never happens in `test`).

`CLIENT_URL` is the base address used in verification links
(`{CLIENT_URL}/verify-email?token=…`), so set it to the URL users actually
browse (e.g. `https://your-domain.com`).

---

## 10. File Structure After Build

```
nurselearn-ph/
├── .env                          # production secrets (git-ignored)
├── .env.example                  # safe to commit
├── DEPLOY.md                     # this file
├── client/
│   ├── dist/                     # ← static build output (serve with nginx)
│   └── src/
├── server/
│   ├── dist/                     # ← compiled JS (run with node)
│   ├── drizzle.config.ts
│   ├── scripts/
│   │   ├── build.js
│   │   ├── cleanup-for-deploy.sql
│   │   └── purge-testreg.sql
│   └── src/
├── database/
│   └── migrations/               # 0000 → 0007 (complete chain)
└── storage/                      # uploaded files (backup this directory)
    ├── documents/
    ├── images/
    ├── question-media/
    ├── student-portfolios/
    └── videos/
```

**Backups:** dump the database daily (e.g. cron) and archive `storage/`:

```bash
pg_dump -U postgres nurselearn_ph > nurselearn-$(date +%F).sql
```

---

## 11. Live Deployment — Vercel + Local PC + Cloudflare Tunnel (current production)

The deployed stack is split across three places:

| Piece | Where | Notes |
|---|---|---|
| Frontend | https://nurselearn-ph.vercel.app (Vercel project `awmc/nurselearn-ph`) | static build of `client/`; deploy with `vercel deploy --prod` from `client/` |
| Backend | This PC — pm2 app **`nurselearn-api`**, port **3003** | `pm2 start ecosystem.config.js --only nurselearn-api` |
| Public API address | Cloudflare quick tunnel (`*.trycloudflare.com`) | pm2 app **`nurselearn-tunnel`**; **random URL on every restart** |
| Database | Postgres **`nurselearn_ph_prod`** (fresh Option A install) | dev DB `nurselearn_ph` stays separate; tests run only against dev |
| Production config | `.env.production` (repo root, **gitignored**) | fresh JWT secrets, prod DB URL, `CLIENT_URL=https://nurselearn-ph.vercel.app` |

**Request flow:**

```
Browser (Vercel SPA)
   │  absolute API URL baked at build (VITE_API_URL)
   ▼
Cloudflare quick tunnel ──▶ localhost:3003 (pm2, node dist/index.js) ──▶ nurselearn_ph_prod
   ▲
Vercel /storage/* rewrite ──┘        (uploaded files proxy through the same tunnel)
```

**Starting after a reboot:**

```powershell
pm2 resurrect                      # restores nurselearn-api + nurselearn-tunnel
# (pm2-windows-startup module on this PC is errored — use pm2 resurrect via
#  Task Scheduler, or start manually: pm2 start ecosystem.config.js)
```

**When the tunnel restarts (NEW random URL) — one command:**

```powershell
powershell -ExecutionPolicy Bypass -File .\update-tunnel-url.ps1
```

It reads the newest URL from the pm2 log, health-checks it, rewrites the
`/storage` proxy in `client/vercel.json`, swaps the `VITE_API_URL` project env
var, and redeploys Vercel. **Until this runs, the frontend still calls the old
(dead) URL.**

**Quick-tunnel vs `config.yml`:** this machine has a named-tunnel
`config.yml` (`mapi`/`monitor.primeclc.com` → `localhost:3001`, ending in a
`http_status:404` catch-all). Quick tunnels must NOT load it — the pm2 tunnel
app passes `--config cloudflared-quick.yml` (rules-free) to avoid the 404
hijack. For a permanent URL, add a `nurselearn.primeclc.com` ingress rule to
`config.yml` and run `cloudflared tunnel route dns <tunnel-id> nurselearn.primeclc.com`
per Cloudflare's docs, then switch the pm2 args to `tunnel run <tunnel-id>`.

> ⚠️ **Never run the test suites against `nurselearn_ph_prod`** (see §3).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET must be at least 32 characters` | Generate new secret: `openssl rand -base64 48` |
| `Invalid environment variables` | Check `.env` exists at project root and all required vars are set |
| Server won't start in production | Ensure `npm run build` succeeded and `dist/index.js` exists |
| 502 Bad Gateway | Check pm2 status (`pm2 list`) or systemd (`systemctl status nurselearn`) |
| File uploads fail | Check `storage/` directory exists and is writable; increase `client_max_body_size` in nginx |
| Emails not sending | Check SMTP config; without it, emails log to console (dry-run) |
| AI features return mock data | Set `GEMINI_API_KEY` and `AI_PROVIDER=gemini` in `.env` |
