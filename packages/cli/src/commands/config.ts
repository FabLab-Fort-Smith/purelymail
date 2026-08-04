/**
 * `purelymail init` and `purelymail profiles …` commands — interactive profile
 * configuration (the wrapper around the config file).
 *
 * Writes only non-secret metadata to the TOML config. For the env-var token
 * source it prints an `export` line and never stores the secret; for the
 * keychain source it stores the token in the OS keychain (workflow-secrets).
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { ProfileEntry } from '@fablabfortsmith/purelymail-config';
import type { CliContext } from '../context.js';
import {
  addProfileEntry,
  readConfigData,
  removeProfileEntry,
  setDefaultProfile,
  upsertProfileEntry,
  writeConfigData,
} from '../config-store.js';
import { CliError, confirm, printJson, printTable } from '../output.js';
import { createPrompter, type Prompter } from '../prompt.js';
import { KEYCHAIN_SERVICE, setKeychainSecret } from '@fablabfortsmith/purelymail-config';
import { report } from './shared.js';

/** Derive a conventional env-var name from a profile name. */
function defaultEnvName(name: string): string {
  return `PURELYMAIL_TOKEN_${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`;
}

/** Prompt the profile fields, storing a keychain secret if that source is chosen. */
async function buildProfile(
  ctx: CliContext,
  prompter: Prompter,
  name: string,
  existing?: ProfileEntry,
): Promise<{ entry: ProfileEntry; exportHint?: string }> {
  const org = await prompter.ask('Organization (optional)', {
    ...(existing?.org !== undefined ? { default: existing.org } : {}),
  });
  const baseUrl = await prompter.ask('Base URL override (optional, https)', {
    ...(existing?.baseUrl !== undefined ? { default: existing.baseUrl } : {}),
  });
  if (baseUrl !== '' && !baseUrl.startsWith('https://')) {
    throw new CliError('Base URL must start with https://', 2);
  }
  const label = await prompter.ask('Label (optional)', {
    ...(existing?.label !== undefined ? { default: existing.label } : {}),
  });

  const defaultSource = existing?.keychain ? 'keychain' : 'env';
  const source = await prompter.askChoice<'env' | 'keychain'>(
    'Where should the API token come from?',
    [
      { label: 'Environment variable (you export it; not stored on disk)', value: 'env' },
      { label: 'OS keychain (store the token now)', value: 'keychain' },
    ],
    defaultSource,
  );

  const base: ProfileEntry = {
    name,
    ...(org !== '' ? { org } : {}),
    ...(baseUrl !== '' ? { baseUrl } : {}),
    ...(label !== '' ? { label } : {}),
  };

  if (source === 'env') {
    const tokenEnv = await prompter.ask('Env var holding the token', {
      default: existing?.tokenEnv ?? defaultEnvName(name),
      required: true,
    });
    return { entry: { ...base, tokenEnv }, exportHint: tokenEnv };
  }

  const keychainAccount = await prompter.ask('Keychain account', {
    default: existing?.keychainAccount ?? name,
    required: true,
  });
  const secret = await prompter.askSecret('Paste the PurelyMail API token');
  if (secret === '') {
    throw new CliError('Empty token; aborting.', 2);
  }
  await setKeychainSecret(KEYCHAIN_SERVICE, keychainAccount, secret, ctx.keyringLoader());
  return { entry: { ...base, keychain: true, keychainAccount } };
}

/** Shared add/edit flow. */
async function runUpsert(
  ctx: CliContext,
  opts: { editName?: string; intro?: string },
): Promise<void> {
  if (!ctx.promptIo().isTty) {
    throw new CliError(
      'This command is interactive; run it in a terminal, or edit the config file ' +
        'directly (see examples/purelymail.config.toml).',
      2,
    );
  }
  const prompter = createPrompter(ctx.promptIo());
  const out = ctx.promptIo().output;
  try {
    if (opts.intro) {
      out.write(`${opts.intro}\n`);
    }
    const path = ctx.configFilePath();
    let data = readConfigData(path);
    const list = data.profile ?? [];

    let name: string;
    let existing: ProfileEntry | undefined;
    if (opts.editName !== undefined) {
      existing = list.find((p) => p.name === opts.editName);
      if (!existing) {
        throw new CliError(`Unknown profile: ${opts.editName}`, 2);
      }
      name = opts.editName;
    } else {
      name = await prompter.ask('Profile name', { required: true });
    }

    const { entry, exportHint } = await buildProfile(ctx, prompter, name, existing);
    data =
      opts.editName !== undefined ? upsertProfileEntry(data, entry) : addProfileEntry(data, entry);

    const isDefault = data.defaultProfile === name;
    const prompt = data.defaultProfile
      ? `Make "${name}" the default profile? (current: ${data.defaultProfile})`
      : `Make "${name}" the default profile?`;
    if (!isDefault && (await prompter.askYesNo(prompt, !data.defaultProfile))) {
      data = setDefaultProfile(data, name);
    }

    writeConfigData(path, data);
    report(ctx, `Saved profile "${name}" to ${path}`, { ok: true, name, path });
    if (exportHint !== undefined) {
      ctx.io.err('Set the token in your shell/CI (it is NOT stored on disk):');
      ctx.io.err(`  export ${exportHint}=<your PurelyMail API token>`);
    }
  } finally {
    prompter.close();
  }
}

/**
 * Register the top-level `init` command.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerInit(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  program
    .command('init')
    .description('Interactively create your first profile / config')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const existing = readConfigData(ctx.configFilePath()).profile ?? [];
      const intro =
        existing.length > 0
          ? `Config already has ${existing.length} profile(s); adding another.`
          : 'Welcome — let’s set up a PurelyMail profile.';
      await runUpsert(ctx, { intro });
    });
}

/**
 * Register the `profiles` command group (inspect + manage the local config).
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerProfiles(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  const group = program.command('profiles').description('Inspect and manage account profiles');

  group
    .command('list')
    .description('List configured profiles and their token source')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const rows = ctx
        .registry()
        .list()
        .map((p) => ({
          name: p.name,
          org: p.org ?? '',
          label: p.label ?? '',
          token: p.tokenProvider.describe(),
        }));
      if (ctx.json) {
        printJson(ctx.io, rows);
      } else {
        printTable(ctx.io, rows, ['name', 'org', 'label', 'token']);
      }
      await Promise.resolve();
    });

  group
    .command('orgs')
    .description('List distinct organizations')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const orgs = ctx.registry().orgs();
      if (ctx.json) {
        printJson(ctx.io, orgs);
      } else {
        for (const org of orgs) {
          ctx.io.out(org);
        }
      }
      await Promise.resolve();
    });

  group
    .command('add')
    .description('Interactively add a profile')
    .action(async (_opts: unknown, cmd: Command) => {
      await runUpsert(ctxFrom(cmd), {});
    });

  group
    .command('edit <name>')
    .description('Interactively edit an existing profile')
    .action(async (name: string, _opts: unknown, cmd: Command) => {
      await runUpsert(ctxFrom(cmd), { editName: name });
    });

  group
    .command('remove <name>')
    .description('Remove a profile from the config')
    .action(async (name: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      if (!(await confirm(`Remove profile "${name}" from the config?`, ctx.yes))) {
        ctx.io.err('aborted');
        return;
      }
      const path = ctx.configFilePath();
      writeConfigData(path, removeProfileEntry(readConfigData(path), name));
      report(ctx, `Removed profile "${name}"`);
    });

  group
    .command('set-default <name>')
    .description('Set the default profile')
    .action((name: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const path = ctx.configFilePath();
      writeConfigData(path, setDefaultProfile(readConfigData(path), name));
      report(ctx, `Default profile set to "${name}"`);
    });
}
