import { nanoid } from 'nanoid'

export interface Env {
  DB: D1Database
  ALLOWED_ORIGIN: string
  ADMIN_API_KEY: string
  TURNSTILE_SECRET?: string
}

interface Incident {
  id: string
  title: string
  description: string
  status: string
  created_at: number
  created_by?: string
}

interface IncidentNote {
  id: string
  incident_id: string
  note: string
  created_at: number
  created_by?: string
}

interface CreateIncidentRequest {
  title: string
  description: string
  cf_turnstile_response?: string
}

interface AddNoteRequest {
  note: string
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

async function jsonResponse(data: unknown, origin: string, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(origin)
    }
  })
}

async function readBody<T>(request: Request): Promise<T> {
  const text = await request.text()
  return text ? JSON.parse(text) as T : {} as T
}

function isAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${env.ADMIN_API_KEY}` && env.ADMIN_API_KEY !== 'to-be-set-in-dashboard'
}

async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET || !token) {
    return false
  }

  const formData = new FormData()
  formData.append('secret', env.TURNSTILE_SECRET)
  formData.append('response', token)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    })
    const result = await response.json() as { success: boolean }
    return result.success
  } catch {
    return false
  }
}

async function logAudit(env: Env, action: string, actor: string, target: string, detail?: string) {
  await env.DB
    .prepare('insert into audit_log (id, action, actor, target, created_at, detail) values (?, ?, ?, ?, ?, ?)')
    .bind(nanoid(), action, actor, target, Date.now(), detail || '')
    .run()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) })
    }

    try {
      // Health check endpoint
      if (url.pathname === '/' || url.pathname === '/health') {
        return jsonResponse({ 
          ok: true, 
          service: 'crisis-guardian-api',
          version: '1.0.0',
          timestamp: Date.now()
        }, origin)
      }

      // POST /incidents - Create new incident
      if (url.pathname === '/incidents' && request.method === 'POST') {
        const body = await readBody<CreateIncidentRequest>(request)
        
        if (!body.title || !body.description) {
          return jsonResponse({ error: 'Missing required fields: title, description' }, origin, 400)
        }

        // Check admin auth or turnstile for public submissions
        const isAdminUser = isAdmin(request, env)
        if (!isAdminUser && env.TURNSTILE_SECRET) {
          if (!body.cf_turnstile_response) {
            return jsonResponse({ error: 'Turnstile verification required' }, origin, 400)
          }
          const isValidTurnstile = await verifyTurnstile(body.cf_turnstile_response, env)
          if (!isValidTurnstile) {
            return jsonResponse({ error: 'Turnstile verification failed' }, origin, 403)
          }
        } else if (!isAdminUser && !env.TURNSTILE_SECRET) {
          return jsonResponse({ error: 'Unauthorized' }, origin, 401)
        }

        const id = nanoid()
        const now = Date.now()
        const createdBy = isAdminUser ? 'admin' : 'public'

        await env.DB
          .prepare('insert into incidents (id, title, description, status, created_at, created_by) values (?, ?, ?, ?, ?, ?)')
          .bind(id, body.title, body.description, 'open', now, createdBy)
          .run()

        await logAudit(env, 'create_incident', createdBy, id, body.title)

        return jsonResponse({ id, status: 'created' }, origin, 201)
      }

      // GET /incidents - List incidents
      if (url.pathname === '/incidents' && request.method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100)
        const status = url.searchParams.get('status')
        
        let query = 'select id, title, status, created_at, created_by from incidents'
        let params: unknown[] = []
        
        if (status) {
          query += ' where status = ?'
          params.push(status)
        }
        
        query += ' order by created_at desc limit ?'
        params.push(limit)

        const { results } = await env.DB
          .prepare(query)
          .bind(...params)
          .all()

        return jsonResponse(results, origin)
      }

      // GET /incidents/{id} - Get specific incident with notes
      const incidentMatch = url.pathname.match(/^\/incidents\/([a-zA-Z0-9_-]+)$/)
      if (incidentMatch && request.method === 'GET') {
        const id = incidentMatch[1]
        
        const incident = await env.DB
          .prepare('select id, title, description, status, created_at, created_by from incidents where id = ?')
          .bind(id)
          .first()

        if (!incident) {
          return jsonResponse({ error: 'Incident not found' }, origin, 404)
        }

        const notes = await env.DB
          .prepare('select id, note, created_at, created_by from incident_notes where incident_id = ? order by created_at asc')
          .bind(id)
          .all()

        return jsonResponse({ 
          ...incident, 
          notes: notes.results 
        }, origin)
      }

      // PUT /incidents/{id} - Update incident status (admin only)
      if (incidentMatch && request.method === 'PUT') {
        if (!isAdmin(request, env)) {
          return jsonResponse({ error: 'Unauthorized' }, origin, 401)
        }

        const id = incidentMatch[1]
        const body = await readBody<{ status?: string, title?: string, description?: string }>(request)
        
        const incident = await env.DB
          .prepare('select id, title, status from incidents where id = ?')
          .bind(id)
          .first()

        if (!incident) {
          return jsonResponse({ error: 'Incident not found' }, origin, 404)
        }

        // Build dynamic update query
        const updates: string[] = []
        const params: unknown[] = []
        
        if (body.status) {
          updates.push('status = ?')
          params.push(body.status)
        }
        if (body.title) {
          updates.push('title = ?')
          params.push(body.title)
        }
        if (body.description) {
          updates.push('description = ?')
          params.push(body.description)
        }

        if (updates.length === 0) {
          return jsonResponse({ error: 'No valid fields to update' }, origin, 400)
        }

        params.push(id)
        
        await env.DB
          .prepare(`update incidents set ${updates.join(', ')} where id = ?`)
          .bind(...params)
          .run()

        await logAudit(env, 'update_incident', 'admin', id, JSON.stringify(body))

        return jsonResponse({ success: true }, origin)
      }

      // POST /incidents/{id}/notes - Add note to incident
      const noteMatch = url.pathname.match(/^\/incidents\/([a-zA-Z0-9_-]+)\/notes$/)
      if (noteMatch && request.method === 'POST') {
        if (!isAdmin(request, env)) {
          return jsonResponse({ error: 'Unauthorized' }, origin, 401)
        }

        const incidentId = noteMatch[1]
        const body = await readBody<AddNoteRequest>(request)
        
        if (!body.note) {
          return jsonResponse({ error: 'Missing note content' }, origin, 400)
        }

        // Verify incident exists
        const incident = await env.DB
          .prepare('select id from incidents where id = ?')
          .bind(incidentId)
          .first()

        if (!incident) {
          return jsonResponse({ error: 'Incident not found' }, origin, 404)
        }

        const noteId = nanoid()
        const now = Date.now()

        await env.DB
          .prepare('insert into incident_notes (id, incident_id, note, created_at, created_by) values (?, ?, ?, ?, ?)')
          .bind(noteId, incidentId, body.note, now, 'admin')
          .run()

        await logAudit(env, 'add_note', 'admin', incidentId, body.note.substring(0, 100))

        return jsonResponse({ id: noteId, status: 'created' }, origin, 201)
      }

      // Turnstile verification endpoint
      if (url.pathname === '/verify-turnstile' && request.method === 'POST') {
        const body = await readBody<{ token: string }>(request)
        
        if (!body.token) {
          return jsonResponse({ error: 'Missing token' }, origin, 400)
        }

        const isValid = await verifyTurnstile(body.token, env)
        return jsonResponse({ valid: isValid }, origin)
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, origin, 404)

    } catch (error) {
      console.error('Worker error:', error)
      return jsonResponse({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, origin, 500)
    }
  }
}