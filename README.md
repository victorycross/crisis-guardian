# Crisis Guardian 🚨

A professional incident management and crisis response system built with serverless architecture for zero infrastructure costs.

## Features

- **Real-time Incident Dashboard** - Live overview of all incidents with status tracking
- **Incident Management** - Create, update, and track incidents through their lifecycle
- **Admin Portal** - Secure admin access with API key authentication
- **Audit Logging** - Complete audit trail of all actions and changes
- **Mobile Responsive** - Works seamlessly on desktop and mobile devices
- **Bot Protection** - Optional Cloudflare Turnstile integration for public submissions

## Architecture

- **Frontend**: Static site hosted on GitHub Pages
- **API**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite-based)
- **Domain**: brightpathtechnology.io
- **Cost**: $0/month (free tier hosting)

## Live Demo

- **Frontend**: https://brightpathtechnology.io
- **API**: https://api.brightpathtechnology.io

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- GitHub account
- Domain configured in Cloudflare

### Deployment

See the complete [Deployment Guide](docs/DEPLOYMENT.md) for detailed setup instructions.

```bash
# 1. Clone repository
git clone https://github.com/victorycross/crisis-guardian.git
cd crisis-guardian

# 2. Set up Cloudflare Workers
cd api
npm install
wrangler login
wrangler d1 create crisis_guardian
# Update database_id in wrangler.toml
wrangler d1 execute crisis_guardian --file=schema.sql
npm run deploy

# 3. Configure environment variables in Cloudflare Dashboard
# - ALLOWED_ORIGIN: https://brightpathtechnology.io
# - ADMIN_API_KEY: your-secure-api-key

# 4. Set up DNS records for api.brightpathtechnology.io

# 5. Enable GitHub Pages for brightpathtechnology.io
```

## API Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Health check | Public |
| GET | `/incidents` | List all incidents | Public |
| GET | `/incidents/{id}` | Get incident details | Public |
| POST | `/incidents` | Create new incident | Admin/Turnstile |
| PUT | `/incidents/{id}` | Update incident | Admin |
| POST | `/incidents/{id}/notes` | Add note to incident | Admin |

## Database Schema

### Incidents Table
```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  created_by TEXT
);
```

### Incident Notes Table
```sql
CREATE TABLE incident_notes (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);
```

### Audit Log Table
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT,
  target TEXT,
  created_at INTEGER NOT NULL,
  detail TEXT
);
```

## Usage

### Public Access
- View incident dashboard
- See real-time statistics
- Browse incident history

### Admin Access
1. Click "Admin Mode" on the frontend
2. Enter your admin API key
3. Access admin features:
   - Create incidents
   - Update status
   - Add notes
   - View detailed audit logs

## Security

- **CORS Protection**: API restricted to frontend domain
- **Bearer Authentication**: Admin endpoints require API key
- **Audit Logging**: All actions are logged with timestamps
- **Rate Limiting**: Cloudflare provides DDoS protection
- **Bot Protection**: Optional Turnstile verification

## Monitoring

### Free Tier Limits
- **GitHub Pages**: 100 GB bandwidth/month
- **Cloudflare Workers**: 100,000 requests/day
- **D1 Database**: 500 MB storage

### Monitoring Tools
- Cloudflare Dashboard for API metrics
- GitHub Pages build status
- Real-time logs: `wrangler tail`

## Development

### Local Development

```bash
# Start API locally
cd api
npm run dev
# API available at http://localhost:8787

# Serve frontend locally
cd web
python -m http.server 8080
# Frontend available at http://localhost:8080
```

### Testing

```bash
# Test API health
curl https://api.brightpathtechnology.io/

# List incidents
curl https://api.brightpathtechnology.io/incidents

# Create incident (admin)
curl -X POST https://api.brightpathtechnology.io/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"title":"Test","description":"Test incident"}'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally and in staging
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For deployment issues, see the [Deployment Guide](docs/DEPLOYMENT.md).

For feature requests or bugs, please open an issue on GitHub.

---

Built with ❤️ for crisis management and incident response teams.