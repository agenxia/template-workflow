import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, statSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const AGENT_NAME = process.env.AGENT_NAME || 'agent';
const AGENT_ID = process.env.AGENT_ID || '';
const PLATFORM_URL = process.env.PLATFORM_URL || '';

// ---------------------------------------------------------------------------
// Vercel-compat adapter (same pattern as platform server.js)
// ---------------------------------------------------------------------------
function createVercelReq(request) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    query: { ...Object.fromEntries(url.searchParams), ...(request.params || {}) },
    body: request.body ?? null,
    raw: request.raw,
  };
}

function createVercelRes(reply) {
  const res = {
    _sent: false,
    setHeader(key, value) { reply.header(key, value); return res; },
    status(code) { reply.status(code); return res; },
    json(data) {
      if (res._sent) return res;
      res._sent = true;
      reply.type('application/json').send(data);
      return res;
    },
    send(data) {
      if (res._sent) return res;
      res._sent = true;
      reply.send(data);
      return res;
    },
    end(data) {
      if (res._sent) return res;
      res._sent = true;
      reply.send(data || '');
      return res;
    },
    write(chunk) { reply.raw.write(chunk); return res; },
    get raw() { return reply.raw; },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Route discovery: scan /api directory
// ---------------------------------------------------------------------------
const API_DIR = join(__dirname, 'api');

function filePathToRoute(filePath) {
  return filePath
    .replace(API_DIR, '/api')
    .replace(/\.js$/, '')
    .replace(/\/index$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

function findHandlerFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'lib' || entry === 'node_modules') continue;
        files.push(...findHandlerFiles(fullPath));
      } else if (entry.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch { /* api dir may not exist */ }
  return files;
}

async function registerApiRoutes(app) {
  const handlerFiles = findHandlerFiles(API_DIR);

  for (const filePath of handlerFiles) {
    const route = filePathToRoute(filePath);
    const mod = await import(filePath);
    const handler = mod.default;

    if (typeof handler !== 'function') continue;

    app.all(route, async (request, reply) => {
      const req = createVercelReq(request);
      const res = createVercelRes(reply);

      // SSE streaming support
      if (request.headers.accept === 'text/event-stream' || request.url.includes('/chat') || request.url.includes('/stream')) {
        res.end = (data) => { reply.raw.end(data || ''); return res; };
      }

      try {
        await handler(req, res);
      } catch (err) {
        if (!res._sent) {
          reply.status(500).send({ error: 'Internal server error', details: err.message });
        }
      }
    });

    console.log(`[agent] Registered ${route}`);
  }
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------
function loadAgentCard() {
  try {
    const raw = readFileSync(join(__dirname, 'agenxia.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { name: AGENT_NAME, status: 'running' };
  }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------
function startHeartbeat() {
  if (!PLATFORM_URL || !AGENT_ID) return;

  const agentUrl = process.env.AGENT_URL || `http://localhost:${PORT}`;
  const payload = { agentId: AGENT_ID, url: agentUrl, status: 'online', metadata: { version: '2.0' } };

  const send = () => {
    fetch(`${PLATFORM_URL}/api/registry/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  send();
  setInterval(send, 10_000);
}

// ---------------------------------------------------------------------------
// Fastify instance
// ---------------------------------------------------------------------------
const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

// CORS
app.addHook('onRequest', (request, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-ID, X-Max-Depth, X-Request-ID');
  if (request.method === 'OPTIONS') { reply.status(204).send(''); return; }
  done();
});

// Standard endpoints
app.get('/health', async () => ({
  status: 'ok',
  agent: AGENT_NAME,
  timestamp: new Date().toISOString(),
}));

app.get('/.well-known/agent-card.json', async () => loadAgentCard());

// API routes
await registerApiRoutes(app);

// Start
try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`[agent] ${AGENT_NAME} running on http://${HOST}:${PORT}`);
  startHeartbeat();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
