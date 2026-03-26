# site-shots (Playwright website screenshots)

## Install

```bash
npm i -D playwright
npx playwright install
```

## Save login session (one-time, interactive)

```bash
node scripts/site-shots.mjs --start https://your-site.com --save-auth true --login-url https://your-site.com/login --auth-file .auth/state.json --headful true
```

This opens a real browser. Log in, then press Enter in the terminal to save auth state.

## Screenshot everything from sitemap (logged in)

```bash
node scripts/site-shots.mjs --start https://your-site.com --mode sitemap --auth-file .auth/state.json --out shots
```

## Notes

- Sitemap defaults to `https://<origin>/sitemap.xml` based on `--start`.
- Supports sitemap indexes (`<sitemapindex>`) and `.xml.gz` sitemap files.
- Writes screenshots plus `summary.json` to the output folder (default `shots/`).
