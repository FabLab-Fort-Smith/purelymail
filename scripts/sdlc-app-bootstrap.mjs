#!/usr/bin/env node
/**
 * Bootstrap the `a2-sdlc-reviewer` GitHub App via the App-manifest flow.
 *
 * GitHub has no headless "create App" API — creation must go through the
 * browser manifest flow. This script automates everything around the one
 * unavoidable click: it serves a pre-filled manifest, catches the redirect
 * `code`, exchanges it for the App's id + private key, and writes them to
 * ~/.secrets (key `chmod 600`, App ID appended to the env file). You still
 * click **Create** once, and later **Install** the App on the repo.
 *
 * Usage:
 *   node scripts/sdlc-app-bootstrap.mjs [--org <org>] [--name <name>]
 *        [--host <addr>] [--port <n>] [--key-out <path>] [--env-out <path>]
 *
 * Defaults: org FabLab-Fort-Smith, name a2-sdlc-reviewer, host auto (tailnet IP
 * or 127.0.0.1), port 8765, key ~/.secrets/sdlc-reviewer.pem,
 * env ~/.secrets/purelymail.env.
 *
 * Only the App id + private key are persisted; the client/webhook secrets from
 * the conversion response are discarded (unused). Fails closed on any error.
 */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { writeFileSync, appendFileSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Parse `--flag value` pairs into an object. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (k?.startsWith('--')) out[k.slice(2)] = argv[i + 1];
  }
  return out;
}

/**
 * Best-effort private-mesh IPv4 the browser device can reach (per
 * topic-tailnet-dev-access): Tailscale first, then a ZeroTier `zt*` interface,
 * else loopback. Never binds a public interface.
 */
function detectHost() {
  try {
    const ip = execFileSync('tailscale', ['ip', '-4'], { encoding: 'utf8' }).trim().split('\n')[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {
    /* tailscale absent — try ZeroTier next */
  }
  try {
    const out = execFileSync('ip', ['-4', '-o', 'addr', 'show'], { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      const m = line.match(/\bzt\S*\s+inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (m) return m[1];
    }
  } catch {
    /* `ip` unavailable — fall back to loopback */
  }
  return '127.0.0.1';
}

/** HTML-escape a value for safe interpolation into an attribute/text node. */
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Whether an address is loopback or a private/mesh range — the manifest server
 * carries the App private-key `code`, so it must never bind a public interface.
 */
function isPrivateHost(h) {
  return (
    h === 'localhost' ||
    /^127\./.test(h) || // loopback
    /^10\./.test(h) || // RFC1918 (incl. this ZeroTier /24)
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) // 100.64/10 CGNAT (Tailscale)
  );
}

const args = parseArgs(process.argv.slice(2));
const ORG = args.org ?? 'FabLab-Fort-Smith';
const NAME = args.name ?? 'a2-sdlc-reviewer';
const HOST = args.host ?? detectHost();
const PORT = Number(args.port ?? 8765);
const KEY_OUT = args['key-out'] ?? join(homedir(), '.secrets', 'sdlc-reviewer.pem');
const ENV_OUT = args['env-out'] ?? join(homedir(), '.secrets', 'purelymail.env');
const REPO_URL = 'https://github.com/FabLab-Fort-Smith/purelymail';

// Fail closed on an unsafe bind: never a public interface, always a valid port.
if (!isPrivateHost(HOST)) {
  process.stderr.write(
    `Refusing to bind non-private host "${HOST}" (loopback/RFC1918/CGNAT only).\n`,
  );
  process.exit(1);
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  process.stderr.write(`Invalid --port "${args.port}" (want 1-65535).\n`);
  process.exit(1);
}

const state = randomUUID();
const redirectUrl = `http://${HOST}:${PORT}/cb`;
const manifest = {
  name: NAME,
  url: REPO_URL,
  redirect_url: redirectUrl,
  public: false,
  default_permissions: { pull_requests: 'write', contents: 'read' },
  default_events: [],
  hook_attributes: { active: false },
};
const newAppUrl = ORG
  ? `https://github.com/organizations/${ORG}/settings/apps/new`
  : 'https://github.com/settings/apps/new';

/** Exchange the manifest `code` for the App's id + private key. */
async function convert(code) {
  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': NAME },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`conversion failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/') {
    // Auto-submitting form that POSTs the manifest to GitHub's new-App page.
    const body = `<!doctype html><meta charset="utf-8"><title>Create ${esc(NAME)}</title>
<body style="font-family:system-ui;max-width:40rem;margin:3rem auto;">
<h2>Creating GitHub App: ${esc(NAME)}</h2>
<p>Submitting the manifest to GitHub — click <b>Create GitHub App</b> on the next page.</p>
<form id="f" method="post" action="${esc(newAppUrl)}?state=${esc(state)}">
<input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}">
<noscript><button type="submit">Continue to GitHub</button></noscript>
</form><script>document.getElementById('f').submit()</script></body>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(body);
    return;
  }
  if (url.pathname === '/cb') {
    const code = url.searchParams.get('code');
    const gotState = url.searchParams.get('state');
    if (!code || gotState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad or missing code/state. Re-run the bootstrap.');
      return;
    }
    convert(code)
      .then((app) => {
        writeFileSync(KEY_OUT, app.pem, { mode: 0o600 });
        chmodSync(KEY_OUT, 0o600);
        appendFileSync(
          ENV_OUT,
          `\n# a2-sdlc-reviewer GitHub App (PR-approval identity)\nexport SDLC_APP_ID='${app.id}'\nexport SDLC_APP_KEY_FILE=${JSON.stringify(KEY_OUT)}\n`,
        );
        const installUrl = `${app.html_url}/installations/new`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;">
<h2>✅ App created: ${esc(app.slug ?? NAME)} (id ${esc(String(app.id))})</h2>
<p>App ID + private key written to <code>~/.secrets</code>. One step left:</p>
<p><a href="${esc(installUrl)}"><b>Install the App on the repo →</b></a> (choose “Only select repositories” → purelymail).</p>
<p>Then return to the terminal.</p></body>`);
        process.stdout.write(
          `\n✅ App id ${app.id} created.\n   key  -> ${KEY_OUT}\n   env  -> ${ENV_OUT} (SDLC_APP_ID, SDLC_APP_KEY_FILE)\n\nNow INSTALL it on the repo:\n   ${installUrl}\n   (Only select repositories -> FabLab-Fort-Smith/purelymail)\n\nThen: source ${ENV_OUT}\n`,
        );
        setTimeout(() => server.close(() => process.exit(0)), 500);
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Conversion failed: ${err.message}`);
        process.stderr.write(`bootstrap failed: ${err.message}\n`);
        setTimeout(() => server.close(() => process.exit(1)), 500);
      });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `sdlc-app-bootstrap listening on http://${HOST}:${PORT}\n\n` +
      `Open this URL in a browser (this host, or a tailnet device):\n\n   http://${HOST}:${PORT}/\n\n` +
      `You'll click "Create GitHub App" once; the App id + key are then saved automatically.\n` +
      `(org: ${ORG}, name: ${NAME}). Ctrl-C to abort.\n`,
  );
});
