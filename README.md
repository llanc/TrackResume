# TrackResume

[简体中文](./README.zh-CN.md)

TrackResume is a privacy-aware resume delivery and tracking portal built on Cloudflare Workers. It helps candidates share recruiter-specific resume links that open a PDF immediately while keeping access unlisted, observable, and easy to revoke.

## Features

- Recruiter-specific share links
- Direct in-browser PDF viewing
- Access event tracking for page opens, PDF loads, and downloads
- Admin dashboard for resume upload, link creation, and revocation
- Cloudflare-native architecture with Workers, D1, and R2
- Privacy-oriented defaults such as `noindex`, `noarchive`, and hashed IP logging

## Typical Workflow

1. Upload the current resume PDF in the admin dashboard.
2. Create a unique link for a recruiter, company, or role.
3. Send the generated link in an outreach message.
4. The recipient opens the link and views the PDF directly in the browser.
5. TrackResume records key access events.
6. Revoke the link at any time.

## Architecture

- Cloudflare Workers: request routing, server-rendered pages, admin actions, authentication, and public resume pages
- Cloudflare D1: share links, runtime settings, and access events
- Cloudflare R2: active resume PDF storage
- TypeScript: application logic and HTML templates

## Deployment

TrackResume is designed for deployment through Cloudflare Workers with a Git-backed workflow.

1. Push the repository to GitHub.
2. Create a Worker project from the repository in Cloudflare Dashboard.
3. Set the deploy command to `npm run deploy`.
4. Add the required secrets in Cloudflare Dashboard.
5. Review `wrangler.jsonc` for bindings and public-facing variables.
6. Deploy.

## Configuration

### Secrets

- `ADMIN_PASSWORD`: Password used to sign in to `/admin`
- `SESSION_SECRET`: Secret used to sign admin session cookies and salt hashed visitor IP values

### Worker Variables

- `SITE_OWNER_NAME`: Name shown on the landing page and public resume page
- `SITE_OWNER_TITLE`: Subtitle shown on the public resume page
- `SITE_INTRO`: Short introduction shown on the landing page and resume viewer
- `ALLOW_DOWNLOAD_BUTTON`: Set to `true` to show the public download button
- `LINK_EXPIRE_DAYS`: Default expiration window, in days, for newly created share links

### Resource Bindings

- `DB`: D1 database for share links, settings, and access events
- `RESUME_BUCKET`: R2 bucket that stores the active resume PDF

## Repository Structure

```text
.
├─ src/
│  ├─ index.ts
│  ├─ html.ts
│  ├─ db.ts
│  ├─ utils.ts
│  └─ types.ts
├─ migrations/
│  └─ 0001_init.sql
├─ wrangler.jsonc
├─ package.json
└─ README.md
```

## Development

```bash
npm install
npm run check
npm run dev
```

## Security Notes

- Share links are unlisted, but they are not private once forwarded.
- Recipients can still save or forward the PDF after opening it.
- The system stores hashed IP values instead of raw IP addresses.
- Secrets should be managed in Cloudflare Dashboard and never committed to the repository.

## License

MIT. See [LICENSE](./LICENSE).
