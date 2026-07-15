interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * OONI MCP — internet censorship & website reachability measurements from the
 * Open Observatory of Network Interference (api.ooni.io, keyless).
 *
 * Millions of volunteer-run probes worldwide test whether sites and apps are
 * reachable; OONI aggregates anomaly/confirmed-blocking counts per country.
 * "confirmed" = a known blocking fingerprint (e.g. a censor's blockpage);
 * "anomaly" = the measurement deviated from control (possible blocking, DNS
 * tampering, throttling) but wasn't fingerprint-confirmed.
 */


const BASE = 'https://api.ooni.io/api/v1';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const APPS: Record<string, string> = {
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  signal: 'signal',
  facebook_messenger: 'facebook_messenger',
  tor: 'tor',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'ooni_site_reachability',
    description:
      'Check whether a website is blocked or censored in a specific country, using OONI network measurements from volunteer probes. Returns counts of OK, anomalous, confirmed-blocked, and failed measurements over the window plus a blocking assessment — e.g. is bbc.com blocked in China, is twitter.com blocked in Iran. Great-Firewall / national-censorship / internet-freedom research.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Website domain, e.g. "www.bbc.com" or "twitter.com". A full URL is accepted (the host is extracted).' },
        country: { type: 'string', description: '2-letter country code, e.g. "CN", "IR", "RU".' },
        days: { type: ['number', 'string'], description: 'Lookback window in days (default 30, max 365).' },
      },
      required: ['domain', 'country'],
    },
  },
  {
    name: 'ooni_blocking_trend',
    description:
      'Daily time series of OONI censorship measurements for a website in a country — shows when blocking started, stopped, or intensified (e.g. Twitter in Iran day by day). Returns per-day OK / anomaly / confirmed-blocked counts.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Website domain, e.g. "twitter.com".' },
        country: { type: 'string', description: '2-letter country code, e.g. "IR".' },
        days: { type: ['number', 'string'], description: 'Lookback window in days (default 30, max 365).' },
      },
      required: ['domain', 'country'],
    },
  },
  {
    name: 'ooni_app_blocking',
    description:
      'Check whether a messaging or circumvention app is blocked in a country using OONI app-specific tests: WhatsApp, Telegram, Signal, Facebook Messenger, or Tor. Returns measurement counts and a blocking assessment, e.g. "is Telegram blocked in Iran", "is Tor reachable from Russia".',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: `One of: ${Object.keys(APPS).join(' | ')}.` },
        country: { type: 'string', description: '2-letter country code, e.g. "IR", "RU", "CN".' },
        days: { type: ['number', 'string'], description: 'Lookback window in days (default 30, max 365).' },
      },
      required: ['app', 'country'],
    },
  },
  {
    name: 'ooni_measurements',
    description:
      'List recent raw OONI measurements for a domain and/or country — individual probe results with timestamp, network (ASN), anomaly/confirmed flags, and a link to the full measurement on OONI Explorer. Use after ooni_site_reachability to inspect specific blocking evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Website domain, e.g. "twitter.com".' },
        country: { type: 'string', description: '2-letter country code filter, e.g. "IR".' },
        confirmed_only: { type: 'boolean', description: 'Only measurements with confirmed blocking fingerprints.' },
        limit: { type: ['number', 'string'], description: 'Max results (1-50, default 10).' },
      },
    },
  },
];

function cleanDomain(raw: unknown): string {
  let d = typeof raw === 'string' ? raw.trim() : '';
  d = d.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return d;
}

function cleanCountry(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

function window_(args: Record<string, unknown>): { since: string; until: string; days: number } {
  const days = Math.min(Math.max(Number(args.days) || 30, 1), 365);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { since: iso(since), until: iso(until), days };
}

async function ooniGet(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${BASE}/${path}?${qs}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`upstream_down: OONI API ${res.status} ${(await res.text()).slice(0, 150)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

interface AggCounts {
  ok_count?: number;
  anomaly_count?: number;
  confirmed_count?: number;
  failure_count?: number;
  measurement_count?: number;
}

function assess(c: AggCounts): { assessment: string; blocked_share: number | null } {
  const total = c.measurement_count ?? 0;
  if (total === 0) return { assessment: 'no_data — no OONI measurements in this window (try a longer window or a more common domain spelling)', blocked_share: null };
  const bad = (c.anomaly_count ?? 0) + (c.confirmed_count ?? 0);
  const share = bad / total;
  let assessment: string;
  if ((c.confirmed_count ?? 0) > 0 && share > 0.5) assessment = 'blocked — confirmed blocking fingerprints and a majority of measurements anomalous';
  else if (share > 0.7) assessment = 'likely_blocked — most measurements anomalous (no/few confirmed fingerprints; could also be heavy interference or throttling)';
  else if (share > 0.3) assessment = 'partially_blocked_or_unstable — significant share of anomalous measurements (may vary by ISP/region)';
  else assessment = 'mostly_reachable — anomalies within normal noise levels';
  return { assessment, blocked_share: Math.round(share * 1000) / 1000 };
}

function shapeCounts(c: AggCounts) {
  return {
    measurements: c.measurement_count ?? 0,
    ok: c.ok_count ?? 0,
    anomalies: c.anomaly_count ?? 0,
    confirmed_blocked: c.confirmed_count ?? 0,
    failures: c.failure_count ?? 0,
  };
}

async function siteReachability(args: Record<string, unknown>): Promise<unknown> {
  const domain = cleanDomain(args.domain);
  const country = cleanCountry(args.country);
  if (!domain || !/^[A-Z]{2}$/.test(country)) {
    return { error: 'user_error', message: 'Pass domain (e.g. "www.bbc.com") and a 2-letter country code (e.g. "CN").' };
  }
  const { since, until, days } = window_(args);
  const data = await ooniGet('aggregation', {
    probe_cc: country, test_name: 'web_connectivity', domain, since, until,
  });
  const counts = (data.result ?? {}) as AggCounts;
  const verdict = assess(counts);
  return {
    domain, country, window_days: days, since, until,
    ...shapeCounts(counts),
    ...verdict,
    note: 'Source: OONI volunteer probes. "confirmed" = known censor blockpage fingerprint; "anomaly" = deviated from control (possible blocking/DNS tampering).',
    explorer_url: `https://explorer.ooni.org/search?until=${until}&domain=${encodeURIComponent(domain)}&probe_cc=${country}`,
  };
}

async function blockingTrend(args: Record<string, unknown>): Promise<unknown> {
  const domain = cleanDomain(args.domain);
  const country = cleanCountry(args.country);
  if (!domain || !/^[A-Z]{2}$/.test(country)) {
    return { error: 'user_error', message: 'Pass domain (e.g. "twitter.com") and a 2-letter country code (e.g. "IR").' };
  }
  const { since, until, days } = window_(args);
  const data = await ooniGet('aggregation', {
    probe_cc: country, test_name: 'web_connectivity', domain, since, until,
    axis_x: 'measurement_start_day',
  });
  const rows = Array.isArray(data.result) ? (data.result as Array<AggCounts & { measurement_start_day?: string }>) : [];
  // Short windows come back as sub-day buckets sharing a day label (7-day
  // query → 168 rows) — roll them up to one row per date.
  const byDate = new Map<string, ReturnType<typeof shapeCounts>>();
  for (const r of rows) {
    const date = (r.measurement_start_day ?? '').slice(0, 10);
    const c = shapeCounts(r);
    const acc = byDate.get(date);
    if (!acc) byDate.set(date, c);
    else {
      acc.measurements += c.measurements;
      acc.ok += c.ok;
      acc.anomalies += c.anomalies;
      acc.confirmed_blocked += c.confirmed_blocked;
      acc.failures += c.failures;
    }
  }
  const series = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => ({ date, ...c }));
  return {
    domain, country, window_days: days, since, until,
    days_with_data: series.length,
    series,
  };
}

async function appBlocking(args: Record<string, unknown>): Promise<unknown> {
  const app = typeof args.app === 'string' ? args.app.trim().toLowerCase().replace(/\s+/g, '_') : '';
  const country = cleanCountry(args.country);
  const testName = APPS[app];
  if (!testName || !/^[A-Z]{2}$/.test(country)) {
    return { error: 'user_error', message: `Pass app (one of: ${Object.keys(APPS).join(', ')}) and a 2-letter country code.` };
  }
  const { since, until, days } = window_(args);
  const data = await ooniGet('aggregation', { probe_cc: country, test_name: testName, since, until });
  const counts = (data.result ?? {}) as AggCounts;
  const verdict = assess(counts);
  return {
    app, country, window_days: days, since, until,
    ...shapeCounts(counts),
    ...verdict,
    note: `OONI ${testName} test: anomalies indicate interference with the app's endpoints/registration from probes in ${country}.`,
  };
}

async function measurements(args: Record<string, unknown>): Promise<unknown> {
  const domain = cleanDomain(args.domain);
  const country = cleanCountry(args.country);
  if (!domain && !country) {
    return { error: 'user_error', message: 'Pass at least one of domain or country.' };
  }
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
  const params: Record<string, string> = { limit: String(limit) };
  if (domain) params.domain = domain;
  if (/^[A-Z]{2}$/.test(country)) params.probe_cc = country;
  if (args.confirmed_only === true) params.confirmed = 'true';
  const data = await ooniGet('measurements', params);
  const rows = Array.isArray(data.results) ? (data.results as Array<Record<string, unknown>>) : [];
  return {
    domain: domain || null,
    country: country || null,
    count: rows.length,
    measurements: rows.map((r) => ({
      measured_at: r.measurement_start_time ?? null,
      input: r.input ?? null,
      country: r.probe_cc ?? null,
      network_asn: r.probe_asn ?? null,
      test: r.test_name ?? null,
      anomaly: r.anomaly ?? null,
      confirmed_blocked: r.confirmed ?? null,
      failure: r.failure ?? null,
      explorer_url: r.report_id
        ? `https://explorer.ooni.org/measurement/${r.report_id}${r.input ? `?input=${encodeURIComponent(String(r.input))}` : ''}`
        : null,
    })),
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'ooni_site_reachability':
        return await siteReachability(args);
      case 'ooni_blocking_trend':
        return await blockingTrend(args);
      case 'ooni_app_blocking':
        return await appBlocking(args);
      case 'ooni_measurements':
        return await measurements(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
