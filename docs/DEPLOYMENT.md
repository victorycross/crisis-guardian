# Crisis Guardian Deployment Guide

## Architecture Overview

Crisis Guardian uses a serverless architecture with zero infrastructure costs:
- **Frontend**: GitHub Pages hosting at `brightpathtechnology.io`
- **API**: Cloudflare Workers at `api.brightpathtechnology.io`
- **Database**: Cloudflare D1 (SQLite-based)
- **Security**: CORS, Bearer auth, optional Turnstile bot protection

## Prerequisites

- **Node.js** 18+ and npm installed
- **Cloudflare account** (free tier sufficient)
- **Domain** `brightpathtechnology.io` added to Cloudflare DNS
- **GitHub account** with repository access

## Step 1: Cloudflare Setup

### 1.1 Install Wrangler CLI

```bash
npm install -g wrangler@latest
```

### 1.2 Login to Cloudflare

```bash
wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### 1.3 Create D1 Database

```bash
cd api
wrangler d1 create crisis_guardian
```

**Important**: Copy the `database_id` from the output and update `api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "crisis_guardian"
database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"  # Replace this line
```

### 1.4 Apply Database Schema

```bash
cd api
wrangler d1 execute crisis_guardian --file=schema.sql
```

This creates the tables: `incidents`, `incident_notes`, and `audit_log`.

### 1.5 Install API Dependencies

```bash
cd api
npm install
```

### 1.6 Deploy the Worker

```bash
cd api
npm run deploy
```

The API will be available at:
- Custom domain: `https://api.brightpathtechnology.io` (after DNS setup)
- Workers subdomain: `https://crisis-guardian-api.YOUR_ACCOUNT.workers.dev`

## Step 2: Configure Environment Variables

### 2.1 Set API Environment Variables

Go to **Cloudflare Dashboard** > **Workers & Pages** > **crisis-guardian-api** > **Settings** > **Variables**

Add these environment variables:

| Name | Value | Type |
|------|-------|------|
| `ALLOWED_ORIGIN` | `https://brightpathtechnology.io` | Environment variable |
| `ADMIN_API_KEY` | Generate secure key (see below) | Environment variable |
| `TURNSTILE_SECRET` | Your Turnstile secret (optional) | Environment variable |

#### Generate Admin API Key

```bash
# Generate a secure 32-character key
openssl rand -hex 32
```

**⚠️ Important**: Store this key securely - you'll need it for admin access in the frontend.

### 2.2 Optional: Turnstile Setup

For bot protection on public form submissions:

1. Go to **Cloudflare Dashboard** > **Turnstile**
2. Create a new site widget
3. Add the site key to `web/index.html` (replace `YOUR_TURNSTILE_SITE_KEY`)
4. Add the secret key to environment variables as `TURNSTILE_SECRET`

## Step 3: DNS Configuration

### 3.1 API Subdomain (api.brightpathtechnology.io)

In **Cloudflare Dashboard** > **DNS Records**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | api | crisis-guardian-api.YOUR_ACCOUNT.workers.dev | ✅ Proxied |

### 3.2 Frontend Domain (brightpathtechnology.io)

Add these GitHub Pages DNS records:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | @ | 185.199.108.153 | ❌ DNS only |
| A | @ | 185.199.109.153 | ❌ DNS only |
| A | @ | 185.199.110.153 | ❌ DNS only |
| A | @ | 185.199.111.153 | ❌ DNS only |
| CNAME | www | victorycross.github.io | ❌ DNS only |

## Step 4: GitHub Pages Setup

### 4.1 Enable GitHub Pages

1. Go to: `https://github.com/victorycross/crisis-guardian/settings/pages`
2. **Source**: Deploy from a branch
3. **Branch**: `main`
4. **Folder**: `/` (root)

### 4.2 Configure Custom Domain

1. In **Pages settings**, add custom domain: `brightpathtechnology.io`
2. The `CNAME` file is already included in the repository
3. Wait for domain verification (can take up to 24 hours)

### 4.3 Verify SSL Certificate

GitHub will automatically provision a Let's Encrypt SSL certificate for your custom domain.

## Step 5: Testing

### 5.1 Test API Locally

```bash
cd api
npm run dev
```

API available at: `http://localhost:8787`

Test endpoints:
```bash
# Health check
curl http://localhost:8787/

# List incidents (public)
curl http://localhost:8787/incidents

# Create incident (requires auth)
curl -X POST http://localhost:8787/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{"title":"Test Incident","description":"Testing the API"}'
```

### 5.2 Test Production API

```bash
# Health check
curl https://api.brightpathtechnology.io/

# List incidents
curl https://api.brightpathtechnology.io/incidents

# Create incident (admin)
curl -X POST https://api.brightpathtechnology.io/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{"title":"Production Test","description":"Testing production API"}'
```

### 5.3 Test CORS from Frontend

Open browser console at `https://brightpathtechnology.io`:

```javascript
// Test CORS and API connectivity
fetch('https://api.brightpathtechnology.io/incidents')
  .then(response => response.json())
  .then(data => console.log('Incidents:', data))
  .catch(error => console.error('Error:', error));
```

## Step 6: Usage Guide

### 6.1 Public Access

- Visit `https://brightpathtechnology.io`
- View all incidents (read-only)
- Real-time stats dashboard

### 6.2 Admin Access

1. Click **"Admin Mode"** button
2. Enter your `ADMIN_API_KEY`
3. Access admin features:
   - Create new incidents
   - Update incident status
   - View detailed incident information
   - Add notes to incidents

### 6.3 API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | Health check |
| GET | `/incidents` | Public | List incidents |
| GET | `/incidents/{id}` | Public | Get incident details |
| POST | `/incidents` | Admin/Turnstile | Create incident |
| PUT | `/incidents/{id}` | Admin | Update incident |
| POST | `/incidents/{id}/notes` | Admin | Add note |
| POST | `/verify-turnstile` | Public | Verify turnstile token |

## Resource Limits & Monitoring

### Free Tier Limits

**GitHub Pages:**
- 1 GB repository size
- 100 GB bandwidth/month
- 10 builds/hour (soft limit)

**Cloudflare Workers:**
- 100,000 requests/day
- 1,000 requests/minute burst
- 30 seconds CPU time/day

**Cloudflare D1:**
- 500 MB database size
- Daily query limits (enforced from 2025-02-10)
- 25 GB read/day, 50,000 writes/day

### Monitoring

1. **Cloudflare Dashboard**: Monitor requests, errors, CPU usage
2. **Real-time logs**: `wrangler tail crisis-guardian-api`
3. **GitHub Pages**: Check build status in repository Actions tab

### Scaling Considerations

If you exceed free tier limits:
- **Workers**: Upgrade to $5/month for 10M requests
- **D1**: Upgrade for additional storage and query limits
- **GitHub Pages**: Consider upgrading for higher bandwidth

## Security Best Practices

### 6.1 API Key Management

- **Never commit** API keys to version control
- **Rotate keys** regularly
- **Use environment variables** for all secrets
- **Monitor** API usage for unusual patterns

### 6.2 CORS Configuration

- **Restrict** `ALLOWED_ORIGIN` to exact domain
- **No wildcards** in production
- **Verify** preflight requests work correctly

### 6.3 Rate Limiting

Consider adding rate limiting for production:

```typescript
// Add to worker.ts
const RATE_LIMIT = 100; // requests per IP per hour
// Implement using Cloudflare KV for tracking
```

## Troubleshooting

### DNS Issues

**Problem**: Domain not resolving
- **Wait**: DNS propagation can take 48 hours
- **Check**: Cloudflare DNS settings are correct
- **Verify**: Domain is active in Cloudflare

### CORS Errors

**Problem**: CORS blocked in browser
- **Check**: `ALLOWED_ORIGIN` exactly matches `https://brightpathtechnology.io`
- **No trailing slash** in origin
- **Verify**: OPTIONS requests return correct headers

### 401 Unauthorized

**Problem**: Admin requests fail
- **Check**: API key is set correctly in environment
- **Verify**: Bearer token format: `Bearer YOUR_KEY`
- **Ensure**: No extra spaces or characters

### GitHub Pages Not Loading

**Problem**: Custom domain shows 404
- **Verify**: CNAME file exists in repository root
- **Check**: DNS A records point to GitHub IPs
- **Review**: Pages build logs for errors

### Database Connection Issues

**Problem**: D1 database not accessible
- **Verify**: Database ID in `wrangler.toml` is correct
- **Check**: Database binding name matches code (`DB`)
- **Test**: Local development with `--local --persist`

## Backup & Recovery

### Database Backup

```bash
# Export all data
wrangler d1 execute crisis_guardian --command="SELECT * FROM incidents;" --output=incidents_backup.json

# Full schema backup
wrangler d1 execute crisis_guardian --command=".schema" --output=schema_backup.sql
```

### Recovery

```bash
# Restore schema
wrangler d1 execute crisis_guardian --file=schema_backup.sql

# Import data (requires custom script for JSON)
```

## Deployment Checklist

- [ ] **D1 database** created and schema applied
- [ ] **Worker deployed** to Cloudflare
- [ ] **Environment variables** set (ALLOWED_ORIGIN, ADMIN_API_KEY)
- [ ] **DNS records** configured for both API and frontend
- [ ] **GitHub Pages** enabled with custom domain
- [ ] **Domain verification** completed
- [ ] **CORS tested** from frontend domain
- [ ] **API endpoints** tested with curl
- [ ] **Admin access** verified with API key
- [ ] **SSL certificates** active on both domains

## Support

For issues:
1. Check this deployment guide
2. Review Cloudflare Worker logs: `wrangler tail`
3. Verify GitHub Pages build status
4. Test API endpoints individually
5. Check browser console for CORS/JS errors

## Cost Monitoring

Monitor usage to stay within free tiers:
- Cloudflare Dashboard: Workers analytics
- GitHub: Repository insights for Pages bandwidth
- Set up alerts for approaching limits

---

**Total estimated monthly cost: $0** (within free tier limits for typical usage)