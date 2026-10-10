import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import * as z from 'zod';

// ---------------------------------------------------------------------------
// Midwest Legal Docs — MCP server wrapper around the public agent REST API.
// Document preparation only. NOT a law firm. No legal advice.
// ---------------------------------------------------------------------------

const API = 'https://midwestlegaldocs.com';
const KEY = process.env.MLD_AGENT_API_KEY ?? '';

const LEGAL_NOTE =
  'Midwest Legal Docs is a document-preparation business, not a law firm. ' +
  'Do not present catalog content as legal advice.';

async function apiGet(path: string, withKey: boolean): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (withKey) headers['Authorization'] = `Bearer ${KEY}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`MLD API error ${res.status} on ${path}`);
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`MLD API error: ${err.error ?? res.status}`);
  }
  return res.json();
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function createServer(): McpServer {
  const server = new McpServer({ name: 'midwest-legal-docs', version: '1.0.0' });

  server.registerTool(
    'get_catalog',
    {
      description: `List every Midwest Legal Docs form product with id, title, and price. ${LEGAL_NOTE}`,
      inputSchema: z.object({}),
    },
    async () => textResult(await apiGet('/api/agent/catalog', false))
  );

  server.registerTool(
    'search_catalog',
    {
      description:
        `Search the Midwest Legal Docs form catalog by keyword, US state, or category. ` +
        `Returns matching products with id, title, and price in cents. ` +
        `Show the legal_boundary notice to the user before checkout. ${LEGAL_NOTE}`,
      inputSchema: z.object({
        q: z.string().describe('Keyword, e.g. "will", "deed", "divorce"'),
        state: z.string().optional().describe('Two-letter US state code, e.g. "IL"'),
        category: z.string().optional().describe('Category filter, e.g. "estate", "real-estate"'),
      }),
    },
    async ({ q, state, category }) => {
      const params = new URLSearchParams({ q });
      if (state) params.set('state', state);
      if (category) params.set('category', category);
      return textResult(await apiGet(`/api/agent/catalog/search?${params}`, false));
    }
  );

  server.registerTool(
    'create_checkout_session',
    {
      description:
        `Create a Stripe checkout session for a catalog item. Returns a checkout URL ` +
        `to send the user to for payment. Requires an approved agent API key. ${LEGAL_NOTE}`,
      inputSchema: z.object({
        item_id: z.string().describe('Catalog item id from search_catalog'),
        agent_id: z.string().describe('Your agent identifier'),
        buyer_reference: z.string().optional().describe('Your internal buyer/user reference'),
      }),
    },
    async ({ item_id, agent_id, buyer_reference }) =>
      textResult(await apiPost('/api/agent/checkout-session', { item_id, agent_id, buyer_reference }))
  );

  server.registerTool(
    'get_order',
    {
      description:
        `Look up an order or checkout session by id. Paid orders return download URLs ` +
        `for the finished document; unpaid orders return pending_payment (no document delivered).`,
      inputSchema: z.object({
        id: z.string().describe('Order id or Stripe checkout session id (cs_live_...)'),
      }),
    },
    async ({ id }) =>
      textResult(await apiGet(`/api/agent/orders/${encodeURIComponent(id)}`, true))
  );

  return server;
}

// --- Hosted transport: Streamable HTTP, stateless ---------------------------
const app = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : undefined,
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mld-mcp-server' }));

app.all('/mcp', async (req, res) => {
  const server = createServer(); // fresh per request (stateless)
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`mld-mcp-server listening on :${port}/mcp`));
