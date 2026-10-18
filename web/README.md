# Retain web

Next.js (App Router, Tailwind v4, Motion) front end for the Retain API. See the
[root README](../README.md) for the full picture.

```bash
npm ci
npm run dev          # http://localhost:3000, expects the API on http://localhost:8010
npm test             # Vitest unit tests
npx playwright test  # end-to-end; starts the API and dev server if needed
NEXT_PUBLIC_API_URL=https://your-api.example npm run build
```
