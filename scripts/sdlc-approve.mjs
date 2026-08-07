#!/usr/bin/env node
/**
 * Post an APPROVE pull-request review as the `a2-sdlc-reviewer` GitHub App.
 *
 * Used by the SSDLC flow: once the (independent, read-only) `sdlc-reviewer`
 * agent returns an "approve" verdict, this mints a short-lived App installation
 * token from the App's private key and submits an approving review, satisfying
 * the branch-protection required-review rule. The MERGE stays a human action
 * (`workflow-gated-actions`) — this script never merges.
 *
 * Requires (from the environment, e.g. sourced from ~/.secrets):
 *   SDLC_APP_ID        — the GitHub App's numeric App ID
 *   SDLC_APP_KEY_FILE  — path to the App's PEM private key
 * Optional:
 *   GH_REPO            — "owner/name" (defaults to FabLab-Fort-Smith/purelymail)
 *
 * Usage: node scripts/sdlc-approve.mjs <pr-number> [--body "text"]
 * Exits non-zero on any failure (fail closed — no approval on error).
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const API = 'https://api.github.com';
const REPO = process.env.GH_REPO ?? 'FabLab-Fort-Smith/purelymail';

/** Base64url-encode a string or Buffer. */
function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Build a short-lived (10 min) RS256 App JWT signed with the private key. */
function appJwt(appId, pem) {
  // `iat` backdated 60s to tolerate minor clock skew (GitHub guidance).
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(pem);
  return `${signingInput}.${b64url(signature)}`;
}

/** Fetch JSON from the GitHub API, failing closed on a non-2xx response. */
async function gh(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'a2-sdlc-reviewer',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub ${init.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const prNumber = process.argv[2];
  const bodyFlag = process.argv.indexOf('--body');
  const body =
    bodyFlag !== -1 ? (process.argv[bodyFlag + 1] ?? '') : 'Approved by sdlc-reviewer (automated).';
  if (!prNumber || !/^\d+$/.test(prNumber)) {
    throw new Error('Usage: node scripts/sdlc-approve.mjs <pr-number> [--body "text"]');
  }
  const appId = process.env.SDLC_APP_ID;
  const keyFile = process.env.SDLC_APP_KEY_FILE;
  if (!appId || !keyFile) {
    throw new Error('SDLC_APP_ID and SDLC_APP_KEY_FILE must be set (source ~/.secrets/...).');
  }
  const pem = readFileSync(keyFile, 'utf8');

  const jwt = appJwt(appId, pem);
  // Resolve the installation on this repo, then mint an installation token.
  const installation = await gh(`/repos/${REPO}/installation`, jwt);
  const tokenResp = await gh(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: 'POST',
  });
  const instToken = tokenResp.token;

  await gh(`/repos/${REPO}/pulls/${prNumber}/reviews`, instToken, {
    method: 'POST',
    body: JSON.stringify({ event: 'APPROVE', body }),
  });
  process.stdout.write(`Approved PR #${prNumber} on ${REPO} as the sdlc-reviewer App.\n`);
}

main().catch((err) => {
  process.stderr.write(
    `sdlc-approve failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
