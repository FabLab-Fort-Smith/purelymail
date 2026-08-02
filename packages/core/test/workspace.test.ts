import { describe, expect, it } from 'vitest';
import { PurelymailClient } from '../src/client.js';
import { ProfileRegistry, type Profile } from '../src/profiles.js';
import { StaticTokenProvider } from '../src/auth/token-provider.js';
import { PurelymailWorkspace } from '../src/workspace.js';
import { FakeTransport, jsonResponse, success } from './helpers.js';

const tp = new StaticTokenProvider('t-123456');
function profile(name: string, org?: string): Profile {
  return org === undefined ? { name, tokenProvider: tp } : { name, org, tokenProvider: tp };
}

function domain(name: string): unknown {
  return {
    name,
    allowAccountReset: false,
    symbolicSubaddressing: false,
    isShared: false,
    dnsSummary: { passesMx: true, passesSpf: true, passesDkim: true, passesDmarc: true },
  };
}

/** Build a client whose domains.list reflects the profile (or fails for "bad"). */
function factory(profile: Profile): PurelymailClient {
  const transport = new FakeTransport(() =>
    profile.name === 'bad'
      ? jsonResponse(500, { message: 'down' })
      : success(200, { domains: [domain(`${profile.name}.com`)] }),
  );
  return new PurelymailClient({ token: 't-123456', transport });
}

function routingRule(name: string): unknown {
  return {
    id: 1,
    domainName: `${name}.com`,
    prefix: false,
    matchUser: 'info',
    targetAddresses: [`box@${name}.com`],
    catchall: false,
  };
}

/** A client that routes by operation, reflecting the profile (or failing for "bad"). */
function multiFactory(profile: Profile): PurelymailClient {
  const transport = new FakeTransport((req) => {
    if (profile.name === 'bad') {
      return jsonResponse(500, { message: 'down' });
    }
    if (req.url.endsWith('/listUser')) {
      return success(200, { users: [`user@${profile.name}.com`] });
    }
    if (req.url.endsWith('/listRoutingRules')) {
      return success(200, { rules: [routingRule(profile.name)] });
    }
    if (req.url.endsWith('/checkAccountCredit')) {
      return success(200, { credit: `${profile.name}-5.00` });
    }
    return success(200, { domains: [domain(`${profile.name}.com`)] });
  });
  return new PurelymailClient({ token: 't-123456', transport });
}

describe('PurelymailWorkspace', () => {
  const registry = new ProfileRegistry([
    profile('a', 'acme'),
    profile('b', 'acme'),
    profile('bad', 'beta'),
  ]);

  it('runs across accounts and captures per-account failures', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: factory });
    const outcomes = await ws.run(registry.select({ all: true }), (c) => c.domains.list());
    expect(outcomes).toHaveLength(3);
    const failures = outcomes.filter((o) => !o.ok);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.profile).toBe('bad');
  });

  it('wraps non-Purelymail errors thrown by the operation', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: factory });
    const [outcome] = await ws.run([profile('a', 'acme')], () => {
      throw new Error('boom');
    });
    expect(outcome!.ok).toBe(false);
    expect((outcome as { error: Error }).error.name).toBe('PurelymailError');
  });

  it('aggregates domains tagged with profile/org and surfaces failures', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: factory });
    const agg = await ws.listDomains(registry.select({ all: true }), { includeShared: true });
    expect(agg.items).toHaveLength(2);
    expect(agg.items.map((d) => d.profile).sort()).toEqual(['a', 'b']);
    expect(agg.items.every((d) => d.org === 'acme')).toBe(true);
    expect(agg.failures).toHaveLength(1);
    expect(agg.failures[0]!.org).toBe('beta');
  });

  it('aggregates usernames tagged with profile/org and surfaces failures', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: multiFactory });
    const agg = await ws.listUsers(registry.select({ all: true }));
    expect(agg.items.map((u) => u.username).sort()).toEqual(['user@a.com', 'user@b.com']);
    expect(agg.items.every((u) => u.org === 'acme')).toBe(true);
    expect(agg.failures).toHaveLength(1);
    expect(agg.failures[0]!.profile).toBe('bad');
  });

  it('aggregates routing rules tagged with profile/org', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: multiFactory });
    const agg = await ws.listRoutingRules(registry.select({ org: 'acme' }));
    expect(agg.items).toHaveLength(2);
    expect(agg.items.map((r) => r.domainName).sort()).toEqual(['a.com', 'b.com']);
    expect(agg.items.every((r) => r.matchUser === 'info')).toBe(true);
    expect(agg.failures).toHaveLength(0);
  });

  it('reports one credit entry per account and surfaces failures', async () => {
    const ws = new PurelymailWorkspace({ clientFactory: multiFactory });
    const agg = await ws.checkCredit(registry.select({ all: true }));
    expect(agg.items).toHaveLength(2);
    expect(agg.items.map((c) => c.credit).sort()).toEqual(['a-5.00', 'b-5.00']);
    expect(agg.failures.map((f) => f.profile)).toEqual(['bad']);
  });

  it('threads signal and timeout through the new aggregators', async () => {
    const ac = new AbortController();
    const ws = new PurelymailWorkspace({ clientFactory: multiFactory });
    const call = { signal: ac.signal, timeoutMs: 1234 };
    expect((await ws.listUsers([profile('a', 'acme')], call)).items).toHaveLength(1);
    expect((await ws.listRoutingRules([profile('a', 'acme')], call)).items).toHaveLength(1);
    expect((await ws.checkCredit([profile('a', 'acme')], call)).items).toHaveLength(1);
  });

  it('caches the client per profile', async () => {
    let built = 0;
    const ws = new PurelymailWorkspace({
      clientFactory: (p) => {
        built += 1;
        return factory(p);
      },
    });
    const p = profile('a', 'acme');
    const first = ws.client(p);
    const second = ws.client(p);
    expect(first).toBe(second);
    expect(built).toBe(1);
  });

  it('builds a default client when no factory is given', async () => {
    const ws = new PurelymailWorkspace({ clientOptions: { timeoutMs: 5000 } });
    const c = ws.client(profile('solo'));
    expect(c).toBeInstanceOf(PurelymailClient);
  });

  it('honours a per-profile base URL override', () => {
    const ws = new PurelymailWorkspace();
    const withBase: Profile = {
      name: 'mock',
      tokenProvider: tp,
      baseUrl: 'https://mock.example.com',
    };
    expect(ws.client(withBase)).toBeInstanceOf(PurelymailClient);
  });

  it('threads signal and timeout through aggregated listDomains', async () => {
    const ac = new AbortController();
    const ws = new PurelymailWorkspace({ clientFactory: factory });
    const agg = await ws.listDomains([profile('a', 'acme')], {
      signal: ac.signal,
      timeoutMs: 1234,
    });
    expect(agg.items).toHaveLength(1);
  });
});
