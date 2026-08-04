# mcp-ooni

OONI MCP — internet censorship & website reachability measurements from the

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Ooni data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
