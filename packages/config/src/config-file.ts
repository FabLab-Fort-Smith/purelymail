/**
 * Profile configuration file loader.
 *
 * Reads a TOML file holding **non-secret** account/organization metadata and
 * builds a core {@link ProfileRegistry}. Tokens are never stored here — each
 * profile names an env var (`tokenEnv`) or opts into the OS keychain
 * (workflow-secrets, master §5). With no config file, a single implicit
 * `default` profile backed by `PURELYMAIL_API_TOKEN` is used.
 *
 * @packageDocumentation
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  EnvTokenProvider,
  ProfileRegistry,
  PurelymailConfigError,
  type Profile,
  type TokenProvider,
} from '@fablabfortsmith/purelymail-core';
import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';
import { KEYCHAIN_SERVICE, KeychainTokenProvider } from './token-resolvers.js';

/** Schema for one `[[profile]]` entry in the config file. */
export const profileEntrySchema = z
  .object({
    name: z.string().trim().min(1),
    org: z.string().trim().min(1).optional(),
    tokenEnv: z.string().trim().min(1).optional(),
    keychain: z.boolean().optional(),
    keychainAccount: z.string().trim().min(1).optional(),
    baseUrl: z.string().url().optional(),
    label: z.string().optional(),
  })
  .strict();

/**
 * Schema for the `[notify]` section — SMTP settings for sending new-account
 * welcome emails. The SMTP **password is never stored here**: it is sourced
 * from an env var (`passwordEnv`, default `PURELYMAIL_SMTP_PASSWORD`) or the OS
 * keychain (`keychain = true`), same as profile tokens (workflow-secrets, §5).
 */
export const notifyConfigSchema = z
  .object({
    host: z.string().trim().min(1),
    port: z.number().int().positive(),
    secure: z.boolean().optional(),
    user: z.string().trim().min(1),
    from: z.string().trim().min(1).optional(),
    passwordEnv: z.string().trim().min(1).optional(),
    keychain: z.boolean().optional(),
    keychainAccount: z.string().trim().min(1).optional(),
  })
  .strict();

/** Schema for the whole config file. */
export const configSchema = z
  .object({
    defaultProfile: z.string().trim().min(1).optional(),
    profile: z.array(profileEntrySchema).optional(),
    notify: notifyConfigSchema.optional(),
  })
  .strict();

/** A validated `[[profile]]` entry. */
export type ProfileEntry = z.infer<typeof profileEntrySchema>;

/** A validated `[notify]` section. */
export type NotifyConfigEntry = z.infer<typeof notifyConfigSchema>;

/** Default env var holding the SMTP password when none is named. */
export const DEFAULT_SMTP_PASSWORD_ENV = 'PURELYMAIL_SMTP_PASSWORD';

/**
 * Resolved SMTP notify settings. The `passwordProvider` resolves the secret at
 * send time (from env/keychain) — the password is never held in the config.
 */
export interface ResolvedNotify {
  /** SMTP host. */
  readonly host: string;
  /** SMTP port. */
  readonly port: number;
  /** Implicit-TLS flag, if set (defaults to port===465 downstream). */
  readonly secure: boolean | undefined;
  /** Auth username / sender mailbox. */
  readonly user: string;
  /** From address override, if any. */
  readonly from: string | undefined;
  /** Resolves the SMTP password from env/keychain at send time. */
  readonly passwordProvider: TokenProvider;
}

/** Validated config-file contents. */
export type ConfigData = z.infer<typeof configSchema>;

/** Result of loading the profile configuration. */
export interface LoadedProfiles {
  /** The built registry. */
  readonly registry: ProfileRegistry;
  /** The configured default profile name, if any. */
  readonly defaultProfile: string | undefined;
  /** Where the config came from (a path, or "defaults"). */
  readonly source: string;
  /** Non-fatal warnings to surface (e.g. loose file permissions). */
  readonly warnings: readonly string[];
  /** Resolved `[notify]` SMTP settings, if the config declared them. */
  readonly notify: ResolvedNotify | undefined;
}

/**
 * Determine the config file path from an explicit override, env, or XDG/home.
 *
 * @param explicit - A `--config` path, if given.
 * @param env - Environment map (defaults to `process.env`).
 * @returns The resolved config file path (always a path).
 */
export function resolveConfigPath(
  explicit?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (explicit !== undefined && explicit.trim() !== '') {
    return explicit;
  }
  const fromEnv = env['PURELYMAIL_CONFIG_FILE'];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv;
  }
  const base = env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');
  return join(base, 'purelymail', 'config.toml');
}

/** Build the token provider for a validated profile entry. */
function buildTokenProvider(
  entry: z.infer<typeof profileEntrySchema>,
  env: Record<string, string | undefined>,
): TokenProvider {
  if (entry.keychain === true) {
    return new KeychainTokenProvider(KEYCHAIN_SERVICE, entry.keychainAccount ?? entry.name);
  }
  if (entry.tokenEnv !== undefined) {
    return new EnvTokenProvider({ varName: entry.tokenEnv, env });
  }
  return new EnvTokenProvider({ env });
}

/** Build the SMTP-password provider for a validated `[notify]` section. */
function buildPasswordProvider(
  entry: NotifyConfigEntry,
  env: Record<string, string | undefined>,
): TokenProvider {
  if (entry.keychain === true) {
    return new KeychainTokenProvider(
      KEYCHAIN_SERVICE,
      entry.keychainAccount ?? `notify:${entry.user}`,
    );
  }
  return new EnvTokenProvider({ varName: entry.passwordEnv ?? DEFAULT_SMTP_PASSWORD_ENV, env });
}

/** Resolve a validated `[notify]` section into runtime SMTP settings. */
function resolveNotify(
  entry: NotifyConfigEntry,
  env: Record<string, string | undefined>,
): ResolvedNotify {
  return {
    host: entry.host,
    port: entry.port,
    secure: entry.secure,
    user: entry.user,
    from: entry.from,
    passwordProvider: buildPasswordProvider(entry, env),
  };
}

/** Convert a validated entry into a core {@link Profile}. */
function toProfile(
  entry: z.infer<typeof profileEntrySchema>,
  env: Record<string, string | undefined>,
): Profile {
  return {
    name: entry.name,
    tokenProvider: buildTokenProvider(entry, env),
    ...(entry.org !== undefined ? { org: entry.org } : {}),
    ...(entry.baseUrl !== undefined ? { baseUrl: entry.baseUrl } : {}),
    ...(entry.label !== undefined ? { label: entry.label } : {}),
  };
}

/** The implicit single-account registry used when no config file is present. */
function defaultRegistry(env: Record<string, string | undefined>): ProfileRegistry {
  return new ProfileRegistry([{ name: 'default', tokenProvider: new EnvTokenProvider({ env }) }]);
}

/**
 * Load profiles from disk (or fall back to a single default profile).
 *
 * @param options - Optional explicit `configPath`, `env` map, and a flag to
 *   read the file even if it is not the resolved default path.
 * @returns The registry, default profile, source, and any warnings.
 * @throws {@link PurelymailConfigError} on an unreadable or invalid config.
 */
export function loadProfiles(options?: {
  configPath?: string;
  env?: Record<string, string | undefined>;
}): LoadedProfiles {
  const env = options?.env ?? process.env;
  const explicit = options?.configPath;
  const path = resolveConfigPath(explicit, env);
  const warnings: string[] = [];

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // No file: only an error if the user explicitly pointed at one.
    if (explicit !== undefined || env['PURELYMAIL_CONFIG_FILE'] !== undefined) {
      throw new PurelymailConfigError(`Config file not found or unreadable: ${path}`);
    }
    return {
      registry: defaultRegistry(env),
      defaultProfile: 'default',
      source: 'defaults',
      warnings,
      notify: undefined,
    };
  }

  // Warn on group/other-readable permissions (secrets aren't stored here, but
  // config hygiene still matters). Best-effort; ignored on platforms without mode.
  try {
    const mode = statSync(path).mode & 0o777;
    if ((mode & 0o077) !== 0) {
      warnings.push(
        `Config file ${path} is readable by group/other (mode ${mode.toString(8)}); ` +
          'consider chmod 600.',
      );
    }
    /* v8 ignore start -- defensive: statSync of a just-read file does not fail in practice */
  } catch {
    /* ignore stat failures (e.g. platforms without a POSIX mode) */
  }
  /* v8 ignore stop */

  let parsed: unknown;
  try {
    parsed = parseToml(raw);
  } catch (cause) {
    throw new PurelymailConfigError(`Failed to parse TOML config at ${path}`, { cause });
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new PurelymailConfigError(`Invalid config at ${path}: ${issues.join('; ')}`);
  }

  const notify =
    result.data.notify !== undefined ? resolveNotify(result.data.notify, env) : undefined;

  const entries = result.data.profile ?? [];
  if (entries.length === 0) {
    return {
      registry: defaultRegistry(env),
      defaultProfile: result.data.defaultProfile ?? 'default',
      source: path,
      warnings,
      notify,
    };
  }

  const registry = new ProfileRegistry(entries.map((e) => toProfile(e, env)));
  return {
    registry,
    defaultProfile: result.data.defaultProfile,
    source: path,
    warnings,
    notify,
  };
}
