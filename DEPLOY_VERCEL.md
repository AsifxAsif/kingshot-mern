# Deploy Kingshot on Vercel (one project, free)

## Before Vercel

### 1. MongoDB Atlas
1. https://cloud.mongodb.com → your cluster
2. Network Access → Add IP → Allow Access from Anywhere (0.0.0.0/0)
3. Database Access → user + password
4. Connect → Drivers → copy URI, replace password, database name `kingshot`:
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/kingshot?retryWrites=true&w=majority

### 2. Seed data (once, from your PC)
```bash
cd server
# Edit server/.env → paste your real MONGODB_URI and a JWT_SECRET
npm install
npm run seed
```

### 3. Push to GitHub
Upload the whole kingshot-mern folder to a GitHub repo.

---

## Vercel project (ONE project only)

1. https://vercel.com → Log in with GitHub
2. Add New… → Project → Import your repo
3. Configure:
   - Framework Preset: Other (vercel.json controls build)
   - Root Directory: leave EMPTY (do not select client or server)
   - Build settings: leave as detected from vercel.json
4. Environment Variables → Add each of these for Production AND Preview:

| Name | Value |
|------|--------|
| MONGODB_URI | your full Atlas URI |
| JWT_SECRET | any long random string 32+ characters |
| NODE_ENV | production |
| JWT_DAYS | 7d |
| BCRYPT_ROUNDS | 12 |
| ALLOW_VERCEL_PREVIEWS | true |
| RATE_LIMIT_API | 400 |
| RATE_LIMIT_AUTH | 20 |
| RATE_LIMIT_WRITE | 120 |
| JSON_LIMIT | 1mb |

Do NOT add VITE_API_URL.

5. Deploy
6. After deploy, copy your URL e.g. https://kingshot-xxx.vercel.app
7. Settings → Environment Variables → Add or edit:
   CORS_ORIGINS = https://kingshot-xxx.vercel.app
   (exact URL, https, no trailing slash)
8. Redeploy (Deployments → … → Redeploy)

### Optional images
Put files in client/public/assets/ and push again.

---

## Test
- Open https://your-app.vercel.app
- https://your-app.vercel.app/api → should show JSON status
- Register / login / change a level / refresh

## Local after unzip
```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```
Edit server/.env with your real MONGODB_URI before seed.
