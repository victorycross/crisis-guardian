# CLAUDE.md - Crisis Guardian

## Project Overview
Crisis response coordination and incident management platform. Zero-cost deployment using GitHub Pages (frontend) and Cloudflare Workers (API). Deployed at brightpathtechnology.io.

## Tech Stack
- **Frontend**: Vanilla JS + HTML (in `/web`)
- **API**: Cloudflare Workers (in `/api`)
- **Hosting**: GitHub Pages
- **Domain**: brightpathtechnology.io (via CNAME)

## Project Structure
```
├── api/             # Cloudflare Workers API code
├── docs/            # Documentation
├── web/             # Frontend (GitHub Pages)
│   ├── index.html
│   └── app.js
├── CNAME            # Custom domain config
└── README.md
```

## Deployment
- Frontend auto-deploys via GitHub Pages on push to main
- API deploys via Cloudflare Workers (manual or wrangler CLI)

## Domain Context
- **Incident**: An event requiring coordinated response
- **Escalation**: Notification chain based on severity
- **Status**: Active → Contained → Resolved → Post-mortem
- **Stakeholders**: Incident commander, responders, communications lead

## When Working on This Project
- Maintain zero-cost stack (no paid services)
- Frontend must work offline/degraded (local storage fallback)
- API responses should be fast (<100ms target)
- Consider accessibility for high-stress situations
- Keep deployment simple (no build step for frontend)
