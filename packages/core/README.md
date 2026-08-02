# @fablabfortsmith/purelymail-core

Unofficial, framework-free TypeScript client for the [PurelyMail](https://purelymail.com)
API, plus multi-account/organization aggregation. Runtime dependency: `zod`.
Uses the platform `fetch`. Works in Node ≥ 20.11, and any runtime with `fetch`.

> Not affiliated with or endorsed by PurelyMail.

```bash
npm i @fablabfortsmith/purelymail-core
```

## Usage

```ts
import { PurelymailClient } from '@fablabfortsmith/purelymail-core';

// Token resolution: options.tokenProvider > options.token > PURELYMAIL_API_TOKEN
const client = new PurelymailClient({ token: process.env.PURELYMAIL_API_TOKEN });

await client.domains.add({ domainName: 'example.com' });
const { users } = await client.users.list();
await client.routing.create({
  domainName: 'example.com',
  prefix: false,
  matchUser: 'sales',
  targetAddresses: ['admin@example.com'],
});
const { credit } = await client.account.credit();
```

Service namespaces: `domains`, `users`, `routing`, `passwordResets`,
`appPasswords`, `account` — covering the full v0 API surface.

## Extensibility (ports)

Inject your own transport, token source, or logger:

```ts
import {
  PurelymailClient,
  EnvTokenProvider,
  type HttpTransport,
} from '@fablabfortsmith/purelymail-core';

const client = new PurelymailClient({
  tokenProvider: new EnvTokenProvider({ varName: 'PURELYMAIL_TOKEN_ACME' }),
  transport: myTracingTransport, // implements HttpTransport
  timeoutMs: 15_000,
});
```

Call new/undocumented endpoints via the low-level escape hatch:

```ts
await client.request({ path: 'someNewOp', requestSchema, resultSchema, safe: true }, input);
```

## Multiple accounts / organizations

```ts
import {
  ProfileRegistry,
  PurelymailWorkspace,
  StaticTokenProvider,
} from '@fablabfortsmith/purelymail-core';

const registry = new ProfileRegistry([
  { name: 'acme', org: 'Acme', tokenProvider: new StaticTokenProvider(a) },
  { name: 'clientb', org: 'Client B', tokenProvider: new StaticTokenProvider(b) },
]);

const ws = new PurelymailWorkspace();
const { items, failures } = await ws.listDomains(registry.select({ all: true }));
// items are tagged with { profile, org }; failures are captured, not thrown.
```

## Errors

Typed and secret-free: `PurelymailConfigError`, `PurelymailValidationError`,
`PurelymailTransportError`, `PurelymailApiError` (with `code`/`httpStatus`), and
`PurelymailAuthError`. The token is redacted from all messages.

## Behavior

- HTTPS enforced; requests time out (default 30s, abortable).
- Safe reads retry with exponential backoff + jitter, honoring `Retry-After`;
  mutating calls are not auto-retried unless you opt in per call.
- Requests and responses are validated with zod; unknown response shapes fail
  closed. Responses allow unknown extra fields (forward-compatible).

MIT licensed.
