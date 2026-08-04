import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { Profile, PurelymailWorkspace } from '@fablabfortsmith/purelymail-core';
import { App } from '../src/app.js';

const emptyWs = {
  listDomains: () => Promise.resolve({ items: [], failures: [] }),
  listUsers: () => Promise.resolve({ items: [], failures: [] }),
  listRoutingRules: () => Promise.resolve({ items: [], failures: [] }),
  checkCredit: () => Promise.resolve({ items: [], failures: [] }),
} as unknown as PurelymailWorkspace;

describe('App', () => {
  it('shows a hint when no accounts are configured', () => {
    const frame = render(<App workspace={emptyWs} profiles={[]} />).lastFrame() ?? '';
    expect(frame).toContain('No accounts configured');
  });

  it('renders the dashboard when accounts exist', async () => {
    const profiles = [{ name: 'a' } as unknown as Profile];
    const { lastFrame } = render(<App workspace={emptyWs} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('account(s)'));
  });
});
