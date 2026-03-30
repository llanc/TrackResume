# TrackResume

[简体中文](./README.zh-CN.md)

TrackResume is a privacy-aware resume sharing and tracking portal built on Cloudflare Workers.
It helps candidates send recruiter-specific resume links that open a PDF immediately, while keeping access scoped, observable, and easy to revoke.

## Overview

TrackResume is built for a common hiring workflow problem: many recruiting platforms either require the recruiter to reply first or only expose limited in-app profile fields. In practice, that means a carefully prepared PDF resume is often never opened.

TrackResume addresses that problem by providing:

- A dedicated resume link for each recruiter or company
- Direct in-browser PDF viewing
- Private access through unlisted, hard-to-guess links
- Visit tracking for page open, PDF load, and download events
- A lightweight admin panel for upload, link creation, and revocation

## Features

- Recruiter-specific share links
- Cloudflare Worker-based server-side rendering
- Resume PDF storage with Cloudflare R2
- Visit and event logging with Cloudflare D1
- Admin authentication with secure cookies
- Link expiration and manual revocation
- Privacy-oriented defaults such as `noindex`, `noarchive`, and hashed IP logging
- GitHub-to-Cloudflare deployment workflow
- Automatic D1 migration during deployment

## Demo Flow

1. Upload the current resume PDF in the admin panel.
2. Create a unique share link for a recruiter, company, or role.
3. Send that link in the first contact message.
4. The recruiter opens the link and sees the PDF immediately.
5. TrackResume records page open, PDF load, and download activity.
6. Revoke the link at any time if needed.

## Architecture

- Cloudflare Workers
  Handles routing, server-rendered pages, admin actions, authentication, and public share pages.
- Cloudflare R2
  Stores the active resume PDF.
- Cloudflare D1
  Stores share links, settings, and access events.
- GitHub + Workers Builds
  Builds and deploys the project from the repository.

## Repository Structure

```text
.
├─ src/
│  ├─ index.ts        # Worker entry and request routing
│  ├─ html.ts         # Server-rendered page templates
│  ├─ db.ts           # D1 access and event persistence
│  ├─ utils.ts        # Shared helpers
│  └─ types.ts        # Shared types and constants
├─ migrations/
│  └─ 0001_init.sql   # Initial D1 schema
├─ wrangler.jsonc     # Worker project configuration
├─ package.json
└─ README.md
```

## Deployment

Recommended workflow:

GitHub -> Cloudflare Workers Builds

1. Push this repository to GitHub.
2. Import the repository in Cloudflare Workers.
3. Set the deploy command to `npm run deploy`.
4. Configure the required secrets in Cloudflare Dashboard.
5. Ensure D1 and R2 bindings are correctly attached.
TrackResume is configured for a single deployment flow.

## Automatic Database Migration

Deployment runs D1 migrations automatically before deploying the Worker:

```bash
npm run deploy
```

This executes:

```bash
wrangler d1 migrations apply DB --remote
wrangler deploy
```

Applied migrations are tracked by D1, so only pending migrations are executed.

## Required Configuration

### Cloudflare Secrets

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

### Worker Variables

- `SITE_OWNER_NAME`
- `SITE_OWNER_TITLE`
- `SITE_INTRO`
- `ALLOW_DOWNLOAD_BUTTON`
- `LINK_EXPIRE_DAYS`

### Resource Bindings

- `DB` for the D1 database
- `RESUME_BUCKET` for the R2 bucket

## Security and Privacy Notes

- Share links are private but not cryptographically private once forwarded.
- Recruiters can still save or forward the PDF after opening it.
- The system stores hashed IP values instead of plain IP addresses.
- Secrets must never be committed to the repository.
- Resource identifiers such as D1 database IDs and bucket names are not secrets, but they are still metadata that should be handled deliberately.

## Project Status

TrackResume is functional and deployable.
The current version focuses on a minimal MVP for secure resume delivery and recruiter access tracking.

## Roadmap

- Custom branding and visual themes
- Multi-file resume support
- Better event analytics and export
- Optional per-link access controls
- Admin audit trail

## Development

```bash
npm install
npm run check
```

If you want to run local development with Wrangler, you still can, but local Wrangler usage is not required for the standard GitHub-to-Cloudflare deployment flow.

## License

This project is licensed under the MIT License.
See [LICENSE](./LICENSE) for details.
