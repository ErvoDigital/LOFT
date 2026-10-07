# LOFT marketing website

The public SaaS marketing site for LOFT. This is separate from the authenticated React app in `client/` and does not require an API server or an AI key.

## Run locally

From the repository root:

```powershell
npm --prefix website install
npm run dev:website
```

Open http://localhost:3000. To link to a local LOFT app, copy `website/.env.example` to `website/.env.local`, set `VITE_LOFT_APP_URL=http://localhost:5173`, and run the client separately with `npm run dev:client`.

## Verify and build

```powershell
npm run check:website
npm run build:website
```

Deploy the generated `website/dist/` directory to your static hosting provider. The site uses hash routes (`#/features`, `#/pricing`, and `#/about`) so navigation, refresh, and browser history work without server rewrite rules.

## App links

Every “Try for free” and “Log in” link opens `/login` on the origin configured by `VITE_LOFT_APP_URL`. The default is `https://app.loft-client.site/login`. For the production `loft-website` deployment, set `VITE_LOFT_APP_URL=https://app.loft-client.site` or leave it unset to use the default. This is a build-time setting; rebuild after changing it.

## Product content

Shared feature descriptions, frequently asked questions, and page metadata live in `src/data/product.ts`. The product preview is illustrative and uses sample data; it never reads or writes real workspace data. Copy describes implemented LOFT features. Assistant and speech features are described as conditional on deployment configuration. The pricing page describes current free access, since billing and paid-tier limits have not been implemented.
