# Kingshot MERN — Vercel full-stack (free)

Frontend + API both on **Vercel Hobby (free)**. No Railway/Render required.

## Local development

```bash
# Terminal 1 — API
cd server
cp .env.example .env   # set MONGODB_URI, JWT_SECRET
npm install
npm run seed
npm run dev            # :5000

# Terminal 2 — UI
cd client
# leave VITE_API_URL empty (Vite proxies /api → :5000)
npm install
npm run dev            # :3000
```

## Deploy everything on Vercel (free)

1. Push this repo to **GitHub**.
2. [vercel.com](https://vercel.com) → **Add New Project** → import repo.
3. **Root Directory**: leave **empty** (project root, not `client`).
4. Vercel will use root `vercel.json` (builds `client`, serves `api/`).
5. **Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | long random string (32+ chars) |
| `NODE_ENV` | `production` |
| `JWT_DAYS` | `7d` |
| `CORS_ORIGINS` | `https://your-project.vercel.app` (add after first deploy if needed) |
| `ALLOW_VERCEL_PREVIEWS` | `true` |

6. **Do not set** `VITE_API_URL` (browser calls same-origin `/api`).
7. Deploy.
8. Seed database once (local against Atlas is fine):

```bash
cd server
# .env with same MONGODB_URI as Vercel
npm run seed
```

9. Open `https://your-project.vercel.app`.

### Custom domain later

Add domain in Vercel → update `CORS_ORIGINS` to include it.

### Images

Put files in `client/public/assets/` before deploy.

## Security

See `SECURITY.md`. Rate limits and Helmet still apply on the serverless function.
