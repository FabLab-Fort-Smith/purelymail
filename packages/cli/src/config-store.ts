/**
 * Profile config **writer** — the counterpart to `config-file.ts` (the reader).
 *
 * Reads the raw config data, applies immutable mutations (add / upsert / remove
 * profiles, set the default), and writes it back as TOML at `0600`. Holds only
 * non-secret metadata; tokens are never written here (workflow-secrets).
 *
 * @packageDocumentation
 */

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PurelymailConfigError } from '@fablabfortsmith/purelymail-core';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import {
  configSchema,
  profileEntrySchema,
  type ConfigData,
  type ProfileEntry,
} from '@fablabfortsmith/purelymail-config';

/** Read the raw config data at `path`, or an empty config if absent. */
export function readConfigData(path: string): ConfigData {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { profile: [] };
  }
  let parsed: unknown;
  try {
    parsed = parseToml(raw);
  } catch (cause) {
    throw new PurelymailConfigError(`Failed to parse TOML config at ${path}`, { cause });
  }
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      /* v8 ignore next -- "(root)" fallback is unreachable here: TOML always parses to a table so issue paths are non-empty */
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new PurelymailConfigError(`Invalid config at ${path}: ${issues.join('; ')}`);
  }
  return { defaultProfile: result.data.defaultProfile, profile: result.data.profile ?? [] };
}

/** The list of entries in a config (never undefined). */
function entries(data: ConfigData): ProfileEntry[] {
  return data.profile ?? [];
}

/** Serialize `data` to TOML and write it at `path` with `0600` permissions. */
export function writeConfigData(path: string, data: ConfigData): void {
  const clean: Record<string, unknown> = { profile: entries(data) };
  if (data.defaultProfile !== undefined) {
    clean['defaultProfile'] = data.defaultProfile;
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, stringifyToml(clean), { encoding: 'utf8', mode: 0o600 });
  // `writeFileSync` only applies `mode` when creating the file; enforce 0600 on
  // overwrite too so a pre-existing looser-permission file is tightened.
  chmodSync(path, 0o600);
}

/** Add a new profile; rejects a duplicate name. */
export function addProfileEntry(data: ConfigData, entry: ProfileEntry): ConfigData {
  const validated = profileEntrySchema.parse(entry);
  if (entries(data).some((p) => p.name === validated.name)) {
    throw new PurelymailConfigError(`Profile "${validated.name}" already exists.`);
  }
  return { ...data, profile: [...entries(data), validated] };
}

/** Add or replace a profile by name (for edit). */
export function upsertProfileEntry(data: ConfigData, entry: ProfileEntry): ConfigData {
  const validated = profileEntrySchema.parse(entry);
  const rest = entries(data).filter((p) => p.name !== validated.name);
  return { ...data, profile: [...rest, validated] };
}

/** Remove a profile by name; rejects if absent. Clears a stale default. */
export function removeProfileEntry(data: ConfigData, name: string): ConfigData {
  if (!entries(data).some((p) => p.name === name)) {
    throw new PurelymailConfigError(`Unknown profile: ${name}`);
  }
  const profile = entries(data).filter((p) => p.name !== name);
  const next: ConfigData = { ...data, profile };
  if (next.defaultProfile === name) {
    delete next.defaultProfile;
  }
  return next;
}

/** Set the default profile; the name must exist. */
export function setDefaultProfile(data: ConfigData, name: string): ConfigData {
  if (!entries(data).some((p) => p.name === name)) {
    throw new PurelymailConfigError(`Unknown profile: ${name}`);
  }
  return { ...data, defaultProfile: name };
}
