# Midwest Legal Docs — MCP Server

MCP (Model Context Protocol) server wrapping the [Midwest Legal Docs](https://midwestlegaldocs.com) agent API. Lets AI agents browse the legal-form catalog, create Stripe checkout sessions, and look up orders — all through standard MCP tools.

**Document preparation only. Midwest Legal Docs is not a law firm and does not provide legal advice.**

## Tools

| Tool | Description |
|------|-------------|
| `get_catalog` | List all form products with id, title, price |
| `search_catalog` | Search by keyword, state, category |
| `create_checkout_session` | Create a Stripe checkout (requires API key) |
| `get_order` | Look up order / checkout session status |

## Run locally

```bash
npm install
npm run build
MLD_AGENT_API_KEY=your-key PORT=3000 npm start
```

Health check: `GET /health` · MCP endpoint: `POST /mcp`

## Deploy

Designed for Render / Railway / any Node host. Set `MLD_AGENT_API_KEY` and `ALLOWED_HOSTS` env vars.
