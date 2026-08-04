/**
 * Pure data layer for the dashboard (functional core).
 *
 * Turns {@link PurelymailWorkspace} cross-account aggregations into flat,
 * render-ready table models. No Ink / React here — this is unit-testable with a
 * fake workspace, keeping the I/O + rendering in the imperative shell.
 *
 * @packageDocumentation
 */
import type {
  AccountFailure,
  Profile,
  PurelymailWorkspace,
} from '@fablabfortsmith/purelymail-core';

/** The dashboard's selectable views. */
export type Tab = 'domains' | 'users' | 'routing' | 'credit';

/** Tabs in display order. */
export const TABS: readonly Tab[] = ['domains', 'users', 'routing', 'credit'];

/** A per-account failure flattened for display. */
export interface FailureRow {
  readonly profile: string;
  readonly org: string;
  readonly error: string;
}

/** A render-ready table: column keys, string rows, and any per-account failures. */
export interface TableModel {
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
  readonly failures: readonly FailureRow[];
}

/** Render a boolean as a check/cross glyph. */
function yn(value: boolean): string {
  return value ? '✓' : '✗';
}

/** Flatten core account failures into display rows. */
function toFailures(failures: readonly AccountFailure[]): FailureRow[] {
  return failures.map((f) => ({ profile: f.profile, org: f.org ?? '', error: f.error.message }));
}

/**
 * Fetch one tab's data across the given accounts and shape it for display.
 *
 * @param workspace - The multi-account workspace.
 * @param profiles - The accounts to include.
 * @param tab - Which view to load.
 * @returns A render-ready {@link TableModel} (partial failures included, not thrown).
 */
export async function fetchTab(
  workspace: PurelymailWorkspace,
  profiles: readonly Profile[],
  tab: Tab,
): Promise<TableModel> {
  switch (tab) {
    case 'domains': {
      const agg = await workspace.listDomains(profiles);
      return {
        columns: ['profile', 'org', 'domain', 'shared', 'mx', 'spf', 'dkim', 'dmarc'],
        rows: agg.items.map((d) => ({
          profile: d.profile,
          org: d.org ?? '',
          domain: d.name,
          shared: yn(d.isShared),
          mx: yn(d.dnsSummary.passesMx),
          spf: yn(d.dnsSummary.passesSpf),
          dkim: yn(d.dnsSummary.passesDkim),
          dmarc: yn(d.dnsSummary.passesDmarc),
        })),
        failures: toFailures(agg.failures),
      };
    }
    case 'users': {
      const agg = await workspace.listUsers(profiles);
      return {
        columns: ['profile', 'org', 'username'],
        rows: agg.items.map((u) => ({
          profile: u.profile,
          org: u.org ?? '',
          username: u.username,
        })),
        failures: toFailures(agg.failures),
      };
    }
    case 'routing': {
      const agg = await workspace.listRoutingRules(profiles);
      return {
        columns: ['profile', 'org', 'id', 'domain', 'match', 'targets'],
        rows: agg.items.map((r) => ({
          profile: r.profile,
          org: r.org ?? '',
          id: String(r.id),
          domain: r.domainName,
          match: r.matchUser,
          targets: r.targetAddresses.join(','),
        })),
        failures: toFailures(agg.failures),
      };
    }
    case 'credit': {
      const agg = await workspace.checkCredit(profiles);
      return {
        columns: ['profile', 'org', 'credit'],
        rows: agg.items.map((c) => ({ profile: c.profile, org: c.org ?? '', credit: c.credit })),
        failures: toFailures(agg.failures),
      };
    }
  }
}
