# Security notes

## What is protected

- **NoSQL injection**: `express-mongo-sanitize` + recursive operator key rejection
- **SQL injection**: not applicable (MongoDB only); operators sanitized anyway
- **Brute force**: strict rate limit on `/api/auth/login` and `/register` (default 20 / 15 min)
- **API abuse**: global + write rate limits
- **Passwords**: bcrypt (12 rounds default), min 8 chars with letter+number
- **JWT**: signed with `JWT_SECRET`, issuer/audience checks, shorter default expiry (7d)
- **Headers**: Helmet CSP, HSTS (prod), frame deny, nosniff, referrer policy
- **CORS**: allow-list via `CORS_ORIGINS`
- **HPP**: HTTP parameter pollution blocked
- **Probe paths**: `/wp-admin`, `/.env`, etc. return 404
- **Errors**: no stack traces in production
- **Vercel**: security headers in `vercel.json`

## Deploy checklist

1. Set strong `JWT_SECRET` (32+ random bytes)
2. Set `MONGODB_URI` (Atlas with IP allowlist / VPC)
3. Set `CORS_ORIGINS` to your exact Vercel domain(s)
4. Set `NODE_ENV=production`
5. Host API separately if needed (Railway/Render/Fly) — Vercel serverless may need adapter
6. Never commit `.env`

## Not a guarantee

No app is "fully impenetrable". Keep dependencies updated, monitor logs, rotate secrets.
