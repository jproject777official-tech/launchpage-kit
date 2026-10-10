# RuangWeb platform setup (MVP)

This repository now contains the static catalog plus an initial multi-tenant dashboard/API implementation using Cloudflare Pages Functions and D1. It is **not production-ready until deployed, configured, and security-tested**.

## Architecture

- Static catalog: existing HTML/CSS/JS served by Cloudflare Pages.
- API: `functions/api/[[path]].js` Pages Function.
- Public published pages: `functions/p/[[slug]].js` at `/p/<slug>`, and custom-host lookup for hostnames marked active in D1.
- Database: D1 schema in `migrations/0001_init.sql`.
- Authentication: PBKDF2-HMAC-SHA-256 password hashes, random opaque session tokens stored as SHA-256 hashes, HttpOnly/Secure/SameSite=Lax cookie, server-side role/tenant checks.
- Domain model: the customer is the registrant/owner. RuangWeb records DNS/SSL/status/expiry notes and assists according to contract; it does not store registrar passwords.

## Before deploying

1. Create a D1 database named `ruangweb-db` in the Cloudflare dashboard.
2. Copy the real database ID into `wrangler.toml` instead of `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`.
3. Apply the migration to the correct D1 database, first in development/staging, then production. With Wrangler installed and authenticated:
   - `npx wrangler d1 migrations apply ruangweb-db --remote`
4. Set a random `BOOTSTRAP_SECRET` with at least 32 characters as a secret in the Pages project's settings. Do not put it in GitHub, HTML, or a committed config file.
5. Ensure Pages Functions are enabled and the project binds D1 as `DB`. Verify bindings match the deployed environment.
6. Deploy a staging version and test all routes before allowing customers to use it.

## Create the first admin

1. Open `/setup/` on the deployed staging site.
2. Enter the `BOOTSTRAP_SECRET`, name, admin email, and a unique password of at least 12 characters.
3. The API permits setup only while no admin account exists. After the first admin is created, the endpoint returns a conflict.
4. Remove or protect the setup page after bootstrap. Rotate/remove `BOOTSTRAP_SECRET` after the first admin is created.
5. Login at `/login/`. Never use shared credentials across accounts.

## Routes in this MVP

- `POST /api/setup` — one-time initial admin bootstrap.
- `POST /api/login`, `POST /api/logout`, `GET /api/session`.
- `POST /api/change-password` — password change; new password must be at least 12 characters.
- `GET /api/dashboard` — admin overview or client-only data.
- `GET/POST /api/clients` — admin creates customer and temporary password.
- `GET/POST /api/sites` — list sites and admin creates a draft.
- `GET/PATCH /api/sites/:id` — read/edit content; server checks ownership.
- `POST /api/sites/:id/publish` — admin publishes/drafts/suspends a site.
- `GET/POST /api/domains`, `PATCH /api/domains/:id` — record and manage domain status.
- `GET /p/:slug` — render a published site by slug. Active custom-host mappings are also looked up by request hostname if that hostname is already routed to this Pages project.

## Domain lifecycle (customer owns the domain)

1. Customer registers a domain with a registrar in the customer's own name and keeps control of the registrar account.
2. Customer adds the hostname in their dashboard, or asks RuangWeb to record it.
3. Admin checks registrant/ownership and confirms customer consent.
4. Admin gives the customer the required DNS records. The customer can enter them, or authorize RuangWeb to assist. Do not request registrar passwords.
5. Configure the hostname on the Cloudflare Pages project (or the applicable Cloudflare routing setup), verify DNS, and wait for TLS/SSL to become active.
6. Only then set the domain status to `active` in RuangWeb. The database status itself does not configure DNS or SSL.
7. Track renewal date and send reminders through an agreed workflow. Domain renewal is paid to the registrar by the customer unless the contract explicitly states otherwise.

## Security and production checklist

- Restrict repository write access; do not store secrets in a public repository.
- The bootstrap secret is a bearer secret: use a long random value, rotate it after use, and protect/remove `/setup/`.
- Use HTTPS only; this code sets Secure cookies. Do not test authentication over plain HTTP.
- Test tenant isolation: client A must never read/update client B's sites or domains.
- Add rate limiting / abuse controls for login and setup before public launch. Consider Cloudflare Turnstile.
- Add password reset and email verification before onboarding real customers.
- Review CSRF behavior, headers, dependency/security scans, session revocation, and error logging.
- Review privacy notice and customer agreements. Avoid storing unnecessary personal data.
- Public pages are deliberately basic and use escaped text. Extend content schema with care; never render customer-provided HTML as trusted markup.
- Review the SQL migration and test it against a staging D1 before production.

## Important limitations

- This is an initial MVP scaffold, not a complete commercial CMS.
- Domain registration, DNS edits, Pages custom-domain attachment, and SSL checks are manual; no registrar or Cloudflare DNS automation is wired into the dashboard.
- Client content editing is intentionally limited to predefined text/contact/color fields. Media upload, articles, advanced sections, payments, invoices, analytics, backups, and custom template publishing are not implemented yet.
- The first version does not email temporary passwords. Admin must transfer the one-time password to the customer through a secure channel, and the customer must change it on first login.
- The admin dashboard can mark a site published, but the site must be configured and the deployment must work before customer-facing use.
