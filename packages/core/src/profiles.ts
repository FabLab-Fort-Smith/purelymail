/**
 * Account profiles and organization grouping.
 *
 * PurelyMail has no server-side "organization" concept — one token authenticates
 * one account. This module provides the *client-side* construct the multi-org
 * requirement needs: named account profiles, each carrying its own
 * {@link TokenProvider} and an optional `org` tag, queryable individually or by
 * organization. Secret sourcing stays in the injected provider (workflow-secrets).
 *
 * @packageDocumentation
 */

import type { TokenProvider } from './auth/token-provider.js';
import { PurelymailConfigError } from './errors.js';

/** A named PurelyMail account, optionally tagged with an organization. */
export interface Profile {
  /** Unique profile name (selection key). */
  readonly name: string;
  /** Optional organization this account belongs to (grouping key). */
  readonly org?: string;
  /** How this profile's API token is resolved. */
  readonly tokenProvider: TokenProvider;
  /** Optional per-profile base URL override (must be https). */
  readonly baseUrl?: string;
  /** Optional human-readable label. */
  readonly label?: string;
}

/** A selection of accounts to act on. */
export interface ProfileSelection {
  /** Select every profile. */
  readonly all?: boolean;
  /** Select every profile tagged with this organization. */
  readonly org?: string;
  /** Select these named profiles. */
  readonly names?: readonly string[];
}

/**
 * An in-memory registry of {@link Profile}s with lookup by name and by org.
 *
 * Framework-free and immutable after construction, so it is equally usable from
 * a CLI, a long-lived service, or a web backend.
 */
export class ProfileRegistry {
  readonly #byName: Map<string, Profile>;

  /**
   * @param profiles - The profiles to register. Names must be unique/non-empty.
   * @throws {@link PurelymailConfigError} on empty or duplicate names.
   */
  public constructor(profiles: readonly Profile[]) {
    this.#byName = new Map();
    for (const profile of profiles) {
      if (typeof profile.name !== 'string' || profile.name.trim() === '') {
        throw new PurelymailConfigError('Profile name must be a non-empty string.');
      }
      if (this.#byName.has(profile.name)) {
        throw new PurelymailConfigError(`Duplicate profile name: ${profile.name}`);
      }
      this.#byName.set(profile.name, profile);
    }
  }

  /**
   * All registered profiles, in insertion order.
   *
   * @returns The profiles.
   */
  public list(): readonly Profile[] {
    return [...this.#byName.values()];
  }

  /**
   * Look up a profile by name.
   *
   * @param name - The profile name.
   * @returns The profile, or `undefined` if absent.
   */
  public get(name: string): Profile | undefined {
    return this.#byName.get(name);
  }

  /**
   * Look up a profile by name, throwing if absent.
   *
   * @param name - The profile name.
   * @returns The profile.
   * @throws {@link PurelymailConfigError} if not found.
   */
  public require(name: string): Profile {
    const profile = this.#byName.get(name);
    if (!profile) {
      throw new PurelymailConfigError(`Unknown profile: ${name}`);
    }
    return profile;
  }

  /**
   * All profiles tagged with a given organization.
   *
   * @param org - The organization name.
   * @returns The matching profiles (possibly empty).
   */
  public byOrg(org: string): readonly Profile[] {
    return this.list().filter((p) => p.org === org);
  }

  /**
   * The distinct organization names present, sorted.
   *
   * @returns The organizations.
   */
  public orgs(): readonly string[] {
    const set = new Set<string>();
    for (const p of this.#byName.values()) {
      if (p.org !== undefined) {
        set.add(p.org);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Resolve a {@link ProfileSelection} into concrete profiles.
   *
   * @param selection - The selection (all / org / names).
   * @returns The selected profiles.
   * @throws {@link PurelymailConfigError} if nothing matches or none specified.
   */
  public select(selection: ProfileSelection): readonly Profile[] {
    if (selection.all) {
      return this.list();
    }
    if (selection.org !== undefined) {
      const matches = this.byOrg(selection.org);
      if (matches.length === 0) {
        throw new PurelymailConfigError(`No profiles found for organization: ${selection.org}`);
      }
      return matches;
    }
    if (selection.names && selection.names.length > 0) {
      return selection.names.map((n) => this.require(n));
    }
    throw new PurelymailConfigError(
      'No account selected: specify a profile name, an organization, or all.',
    );
  }
}
