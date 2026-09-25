# mcp-ooni

OONI MCP — internet censorship & website reachability measurements from the

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1679+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `ooni_site_reachability` | Check whether a website is blocked or censored in a specific country, using OONI network measurements from volunteer probes. Returns counts of OK, anomalous, confirmed-blocked, and failed measurements over the window plus a blocking assessment — e.g. is bbc.com blocked in China, is twitter.com blocked in Iran. Great-Firewall / national-censorship / internet-freedom research. |
| `ooni_blocking_trend` | Daily time series of OONI censorship measurements for a website in a country — shows when blocking started, stopped, or intensified (e.g. Twitter in Iran day by day). Returns per-day OK / anomaly / confirmed-blocked counts. |
| `ooni_app_blocking` | Check whether a messaging or circumvention app is blocked in a country using OONI app-specific tests: WhatsApp, Telegram, Signal, Facebook Messenger, or Tor. Returns measurement counts and a blocking assessment, e.g. "is Telegram blocked in Iran", "is Tor reachable from Russia". |
| `ooni_measurements` | List recent raw OONI measurements for a domain and/or country — individual probe results with timestamp, network (ASN), anomaly/confirmed flags, and a link to the full measurement on OONI Explorer. Use after ooni_site_reachability to inspect specific blocking evidence. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ooni": {
      "url": "https://gateway.pipeworx.io/ooni/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/ooni/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1679+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/ooni_site_reachability \
  -H 'Content-Type: application/json' \
  -d '{"domain":"twitter.com","country":"IR"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/ooni_site_reachability`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "ooni": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-ooni"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-ooni
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Ooni data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
