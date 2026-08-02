# Rolebolt Job Copilot — Browser Extension

Save jobs from **LinkedIn**, **Indeed**, **Greenhouse**, **Lever**, **Workday**, and company career pages. Get instant AI match scores via the Live Copilot panel.

## Features

- **Live AI panel** on job pages — match score, strengths, missing skills, quick actions
- **One-click save** to your Rolebolt Job Workspace (with deduplication)
- **Site-specific extractors** for major job boards + JSON-LD fallback
- **Popup** for manual analyze/save from any tab
- **Session sync** from rolebolt.tech (no OAuth required for MVP)

## Install (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Connect your account

1. Sign in at [rolebolt.tech/seeker](https://www.rolebolt.tech/seeker)
2. Visit [rolebolt.tech/seeker/extension](https://www.rolebolt.tech/seeker/extension) — your session syncs automatically
3. Browse any job posting — the Rolebolt floating button appears bottom-right

**Manual token (fallback):** Open extension popup → Manual token setup → paste token from DevTools → Application → Local Storage → `rb_auth_token`

## Build for Chrome Web Store

```bash
cd extension
npm run pack
```

Produces `dist/rolebolt-extension.zip` ready for upload.

See also:
- [PRIVACY.md](./PRIVACY.md) — required for store listing
- [STORE_LISTING.md](./STORE_LISTING.md) — copy for the Chrome Web Store

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /recruit/seeker/workspace/extension-analyze` | Live AI match (no save) |
| `POST /recruit/seeker/workspace/extension-save` | Save/update job in workspace + analyze |

## Supported sites

LinkedIn Jobs, Indeed, Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Glassdoor, plus generic career pages via schema.org JobPosting.

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save auth token locally |
| `activeTab` | Read current tab for popup actions |
| `host_permissions` (rolebolt.tech) | API calls to Rolebolt backend |
| Content scripts (`<all_urls>`) | Extract job data from career pages |

No Gmail/Outlook access. Email Intelligence remains copy-paste in the web app.

## OAuth

Extension OAuth is **not** included in MVP. Connection uses your Rolebolt web session via the auth bridge on rolebolt.tech pages.
