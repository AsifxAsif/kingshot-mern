# Kingshot MERN Event Calculator

MERN port of the Kingshot Strongest Governor calculator.

## Fixes in this build (2026-08-12)

- Navbar page scores use the same keys as `setPageScore` (no more stuck at 0)
- Cross-page **remaining vault**: Active upgrades on one page reduce resources on others
- Widgets: Active points only when page inventory covers needed widgets
- Preset schema includes `heroFlowers` so Heroes flower state saves to MongoDB
- Global score = sum of page scores only (matches original site)
- Sample `.env` has no real credentials

## Local setup

```bash
# 1) Server
cd server
cp .env.example .env   # or edit .env — set MONGODB_URI + JWT_SECRET
npm install
npm run seed
npm run dev            # http://localhost:5000

# 2) Client (another terminal)
cd client
npm install
npm run dev            # http://localhost:3000
```

## Assets

Place game images in:

```
client/public/assets/
```

Copy from the original HTML site `assets/` folder (webp icons for resources, buildings, heroes, pets, widgets).

## Vercel

Root = repo root. Env vars:

- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGINS` (your production domain)
- `NODE_ENV=production`

## Presets

- **default** (guest): localStorage only
- **Named presets**: require login; saved to MongoDB including vault, all page state, heroFlowers, pageScores, lockedUpgrades
