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
