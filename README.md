# Quests Marketing Site

Next.js + Tailwind static site for the Quests mobile app. The project exports to static HTML in `out/` and is deployed automatically to GitHub Pages via Actions.

## Local development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:3000`. Key files:
- `app/page.tsx` – landing page content
- `app/contact/page.tsx` – contact details
- `app/privacy/page.tsx` and `app/terms/page.tsx` – legal pages
- `components/` – shared layout elements
- `public/logo.png` – primary Quests logo used for navigation and favicons

## Build & static export

```bash
npm run build
```

With `next.config.ts` set to `output: 'export'`, the build step writes static assets to `out/`. Preview the static export locally by serving that folder with any static file server, e.g. `npx serve out`.

## Deployment workflow

- Push to `main` triggers `.github/workflows/deploy.yml`.
- The workflow installs dependencies, runs `npm run build`, and uploads `out/` as the GitHub Pages artifact.
- GitHub automatically publishes the artifact to the repository’s Pages site.

If you need to redeploy manually, open the “Deploy GitHub Pages” workflow in the Actions tab and click “Run workflow”.

## Custom domain (`thequestsapp.com`)

1. In the repository Settings → Pages, set the custom domain to `thequestsapp.com`. GitHub will reuse the value from `public/CNAME`.
2. In GoDaddy DNS for `thequestsapp.com`, add/confirm these records:
   - `A` @ → `185.199.108.153`
   - `A` @ → `185.199.109.153`
   - `A` @ → `185.199.110.153`
   - `A` @ → `185.199.111.153`
   - (Optional) `CNAME` `www` → `thequestsapp.com` if you want the `www` subdomain to redirect.
3. Allow DNS to propagate (can take up to 24 hours). Use `dig thequestsapp.com` to verify the A records point to GitHub.

Once DNS resolves to GitHub, the Pages build will serve `https://thequestsapp.com/` with HTTPS automatically (GitHub issues the certificate).

## Updating the site

1. Edit content locally (add images under `public/` as needed).
2. Run `npm run build` to confirm the static export succeeds.
3. Commit changes and push to `main`.
4. Wait for the “Deploy GitHub Pages” workflow to finish; changes go live immediately after.
