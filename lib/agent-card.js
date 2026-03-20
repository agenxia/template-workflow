/**
 * Generate an enriched agent-card from agenxia.json + route scan.
 *
 * Used by templates/agents at runtime:
 *   GET /.well-known/agent-card.json → generateAgentCard()
 *
 * This file is pushed to every template-*, connector-*, agent-* repo.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

/**
 * Scan api/ directory for route files and derive HTTP endpoints.
 * Fastify file-based routing: api/chat.js → POST /api/chat
 */
function scanRoutes(rootDir) {
  const apiDir = join(rootDir, 'api');
  const routes = [];

  try {
    const entries = readdirSync(apiDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = join(apiDir, entry);
      if (statSync(fullPath).isDirectory()) continue;
      if (extname(entry) !== '.js') continue;

      const name = basename(entry, '.js');
      const relDir = entry.replace(/[/\\][^/\\]+$/, '');
      const dirPrefix = relDir === entry ? '' : `/${relDir.replace(/\\/g, '/')}`;
      const routePath = `/api${dirPrefix}/${name}`;

      // Infer method from common naming conventions
      let method = 'POST';
      if (['health', 'status', 'docs', 'info'].includes(name)) method = 'GET';
      if (name === 'a2a') method = 'POST';

      routes.push({ method, path: routePath, file: `api/${entry}` });
    }
  } catch {
    // api/ directory may not exist
  }

  return routes;
}

/**
 * Generate the full agent-card object.
 * @param {object} options
 * @param {string} options.rootDir - Root directory of the agent project (default: process.cwd())
 * @param {string} [options.deployUrl] - Public URL if deployed
 * @returns {object} Agent card JSON
 */
export function generateAgentCard({ rootDir = process.cwd(), deployUrl } = {}) {
  // Read agenxia.json
  let manifest;
  try {
    const raw = readFileSync(join(rootDir, 'agenxia.json'), 'utf-8');
    manifest = JSON.parse(raw);
  } catch {
    manifest = { name: 'unknown', description: '', type: 'agent' };
  }

  const scannedRoutes = scanRoutes(rootDir);

  // Build endpoints map from scanned routes + well-known paths
  const endpoints = {
    agent_card: '/.well-known/agent-card.json',
    docs: '/docs',
    health: '/health',
  };

  // Detect A2A endpoints
  const hasA2a = scannedRoutes.some((r) => r.path.includes('/a2a'));
  if (hasA2a) {
    endpoints.a2a = '/api/a2a';
    const hasStream = scannedRoutes.some((r) => r.path.includes('/a2a/stream'));
    if (hasStream) endpoints.stream = '/api/a2a/stream';
  }

  // Build api array: well-known + scanned
  const api = [
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/.well-known/agent-card.json', description: 'Agent discovery card' },
    { method: 'GET', path: '/docs', description: 'API documentation (HTML)' },
  ];

  for (const route of scannedRoutes) {
    const alreadyListed = api.some((a) => a.path === route.path);
    if (!alreadyListed) {
      api.push({
        method: route.method,
        path: route.path,
        description: `Handler: ${route.file}`,
      });
    }
  }

  // Build methods from manifest or defaults
  const methods = manifest.methods || [];

  // Build card
  const card = {
    name: manifest.name || 'unknown',
    description: manifest.description || '',
    version: manifest.version || '1.0.0',
    protocol: 'a2a-1.0',
    capabilities: manifest.capabilities || manifest.features || [],
    config: manifest.config || {},
    env_vars: manifest.env_vars || [],
    endpoints,
    methods,
    api,
    metadata: {
      author: 'agenxia',
      source_template: manifest.source_template || null,
      type: manifest.type || 'agent',
      ...(deployUrl && { deploy_url: deployUrl }),
    },
  };

  return card;
}
