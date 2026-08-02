/**
 * {@link PurelymailWorkspace} — organization-level view across many accounts.
 *
 * Runs an operation across a selection of {@link Profile}s concurrently and
 * returns a per-account outcome (success or captured error), so one bad account
 * never breaks the whole view (graceful degradation — topic-reliability). Ships
 * convenience aggregators that tag each item with its `profile`/`org`, which is
 * exactly what an organization-level dashboard or `--all` CLI view needs.
 *
 * @packageDocumentation
 */

import { PurelymailClient } from './client.js';
import type { PurelymailClientOptions } from './config.js';
import { PurelymailError } from './errors.js';
import type { Profile } from './profiles.js';
import type { DomainInfo, RoutingRule } from './types.js';
import type { CallOptions } from './internal.js';

/** A successful per-account outcome. */
export interface AccountSuccess<T> {
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
  /** Discriminator. */
  readonly ok: true;
  /** The value produced for this account. */
  readonly value: T;
}

/** A failed per-account outcome (error captured, not thrown). */
export interface AccountFailure {
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
  /** Discriminator. */
  readonly ok: false;
  /** The captured error. */
  readonly error: PurelymailError;
}

/** Either a success or failure for one account. */
export type AccountOutcome<T> = AccountSuccess<T> | AccountFailure;

/** A domain annotated with the account/org it came from. */
export interface AggregatedDomain extends DomainInfo {
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
}

/** A username annotated with the account/org it came from. */
export interface AggregatedUser {
  /** The username (email local part / full address, per the API). */
  readonly username: string;
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
}

/** A routing rule annotated with the account/org it came from. */
export interface AggregatedRoutingRule extends RoutingRule {
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
}

/** One account's remaining credit, annotated with the account/org. */
export interface AggregatedCredit {
  /** Remaining account credit (currency string, as returned by the API). */
  readonly credit: string;
  /** Source profile name. */
  readonly profile: string;
  /** Source organization, if any. */
  readonly org: string | undefined;
}

/** Aggregated results plus any per-account failures. */
export interface Aggregated<T> {
  /** Flattened, annotated items across all successful accounts. */
  readonly items: readonly T[];
  /** Accounts that failed (surface these; don't hide partial failure). */
  readonly failures: readonly AccountFailure[];
}

/** Options for a {@link PurelymailWorkspace}. */
export interface WorkspaceOptions {
  /**
   * Base client options applied to every account (transport, logger, timeout,
   * retry). Per-account token and base URL come from the {@link Profile}.
   */
  readonly clientOptions?: Omit<PurelymailClientOptions, 'tokenProvider' | 'token' | 'baseUrl'>;
  /** Override client construction (e.g. to inject a fake in tests). */
  readonly clientFactory?: (profile: Profile) => PurelymailClient;
}

/**
 * Executes operations across multiple PurelyMail accounts.
 */
export class PurelymailWorkspace {
  readonly #options: WorkspaceOptions;
  readonly #clients = new Map<string, PurelymailClient>();

  /**
   * @param options - Shared client options / factory.
   */
  public constructor(options: WorkspaceOptions = {}) {
    this.#options = options;
  }

  /**
   * Get (or lazily build and cache) the client for a profile.
   *
   * @param profile - The account profile.
   * @returns A {@link PurelymailClient} bound to that account.
   */
  public client(profile: Profile): PurelymailClient {
    const cached = this.#clients.get(profile.name);
    if (cached) {
      return cached;
    }
    const built = this.#options.clientFactory
      ? this.#options.clientFactory(profile)
      : new PurelymailClient({
          ...this.#options.clientOptions,
          tokenProvider: profile.tokenProvider,
          ...(profile.baseUrl !== undefined ? { baseUrl: profile.baseUrl } : {}),
        });
    this.#clients.set(profile.name, built);
    return built;
  }

  /**
   * Run an operation across the given profiles concurrently, capturing errors
   * per account rather than failing the whole batch.
   *
   * @typeParam T - The value each account produces.
   * @param profiles - The accounts to run against.
   * @param fn - Operation given the account's client and profile.
   * @returns One {@link AccountOutcome} per profile, in input order.
   */
  public async run<T>(
    profiles: readonly Profile[],
    fn: (client: PurelymailClient, profile: Profile) => Promise<T>,
  ): Promise<AccountOutcome<T>[]> {
    const settled = await Promise.all(
      profiles.map(async (profile): Promise<AccountOutcome<T>> => {
        try {
          const value = await fn(this.client(profile), profile);
          return { profile: profile.name, org: profile.org, ok: true, value };
        } catch (error) {
          return {
            profile: profile.name,
            org: profile.org,
            ok: false,
            error:
              error instanceof PurelymailError
                ? error
                : new PurelymailError('Unexpected error', { cause: error }),
          };
        }
      }),
    );
    return settled;
  }

  /**
   * Aggregate all domains across the selected accounts, each tagged with its
   * source `profile`/`org`. Partial failures are returned, not thrown.
   *
   * @param profiles - The accounts to include.
   * @param options - Per-call overrides (and `includeShared`).
   * @returns Flattened annotated domains plus any per-account failures.
   */
  public async listDomains(
    profiles: readonly Profile[],
    options?: CallOptions & { includeShared?: boolean },
  ): Promise<Aggregated<AggregatedDomain>> {
    const includeShared = options?.includeShared ?? false;
    const call: CallOptions = {
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    };
    const outcomes = await this.run(profiles, async (client) => {
      const res = await client.domains.list({ includeShared }, call);
      return res.domains;
    });
    return this.#aggregate(outcomes, (domain, outcome) => ({
      ...domain,
      profile: outcome.profile,
      org: outcome.org,
    }));
  }

  /**
   * Aggregate all usernames across the selected accounts, each tagged with its
   * source `profile`/`org`. Partial failures are returned, not thrown.
   *
   * @param profiles - The accounts to include.
   * @param options - Per-call overrides.
   * @returns Flattened annotated usernames plus any per-account failures.
   */
  public async listUsers(
    profiles: readonly Profile[],
    options?: CallOptions,
  ): Promise<Aggregated<AggregatedUser>> {
    const call = this.#toCallOptions(options);
    const outcomes = await this.run(
      profiles,
      async (client) => (await client.users.list(call)).users,
    );
    return this.#aggregate(outcomes, (username, outcome) => ({
      username,
      profile: outcome.profile,
      org: outcome.org,
    }));
  }

  /**
   * Aggregate all routing rules across the selected accounts, each tagged with
   * its source `profile`/`org`. Partial failures are returned, not thrown.
   *
   * @param profiles - The accounts to include.
   * @param options - Per-call overrides.
   * @returns Flattened annotated routing rules plus any per-account failures.
   */
  public async listRoutingRules(
    profiles: readonly Profile[],
    options?: CallOptions,
  ): Promise<Aggregated<AggregatedRoutingRule>> {
    const call = this.#toCallOptions(options);
    const outcomes = await this.run(
      profiles,
      async (client) => (await client.routing.list(call)).rules,
    );
    return this.#aggregate(outcomes, (rule, outcome) => ({
      ...rule,
      profile: outcome.profile,
      org: outcome.org,
    }));
  }

  /**
   * Report remaining credit for each selected account, tagged with its source
   * `profile`/`org`. Unlike the list aggregators this yields exactly one item
   * per successful account. Partial failures are returned, not thrown.
   *
   * @param profiles - The accounts to include.
   * @param options - Per-call overrides.
   * @returns One annotated credit entry per account plus any failures.
   */
  public async checkCredit(
    profiles: readonly Profile[],
    options?: CallOptions,
  ): Promise<Aggregated<AggregatedCredit>> {
    const call = this.#toCallOptions(options);
    // Credit is a single value per account; wrap it so `#aggregate` annotates it.
    const outcomes = await this.run(profiles, async (client) => [
      await client.account.credit(call),
    ]);
    return this.#aggregate(outcomes, (result, outcome) => ({
      credit: result.credit,
      profile: outcome.profile,
      org: outcome.org,
    }));
  }

  /** Build a {@link CallOptions} carrying only the defined per-call overrides. */
  #toCallOptions(options?: CallOptions): CallOptions {
    return {
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    };
  }

  #aggregate<TIn, TOut>(
    outcomes: readonly AccountOutcome<readonly TIn[]>[],
    map: (item: TIn, outcome: AccountSuccess<readonly TIn[]>) => TOut,
  ): Aggregated<TOut> {
    const items: TOut[] = [];
    const failures: AccountFailure[] = [];
    for (const outcome of outcomes) {
      if (outcome.ok) {
        for (const item of outcome.value) {
          items.push(map(item, outcome));
        }
      } else {
        failures.push(outcome);
      }
    }
    return { items, failures };
  }
}
