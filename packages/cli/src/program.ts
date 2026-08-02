/**
 * Commander program assembly and top-level runner.
 *
 * Builds the `purelymail` command tree, wires global options into a
 * {@link CliContext}, and runs it with stable exit codes. All dependencies are
 * injectable ({@link ContextDeps}) so the whole CLI is testable in-process.
 *
 * @packageDocumentation
 */

import { Command, CommanderError } from 'commander';
import { CliContext, type ContextDeps, type GlobalOptions } from './context.js';
import { registerAccount } from './commands/account.js';
import { registerInit, registerProfiles } from './commands/config.js';
import { registerAppPasswords } from './commands/app-passwords.js';
import { registerDomains } from './commands/domains.js';
import { registerPasswordReset } from './commands/password-reset.js';
import { registerRouting } from './commands/routing.js';
import { registerUsers } from './commands/users.js';
import { exitCodeFor, messageFor, stdio, type IO } from './output.js';

/** CLI version (keep in sync with package.json). */
export const CLI_VERSION = '0.1.0';

/** Raw shape of parsed global options (before normalization). */
interface RawGlobalOptions {
  profile?: string;
  org?: string;
  all?: boolean;
  json?: boolean;
  yes?: boolean;
  config?: string;
  baseUrl?: string;
  timeout?: string;
}

/** Drop undefined-valued keys so exact-optional context options stay clean. */
function pick(obj: Record<string, unknown>): GlobalOptions {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as GlobalOptions;
}

/**
 * Build the `purelymail` command tree.
 *
 * @param deps - Injectable dependencies (registry, client factory, IO, env).
 * @returns The configured commander program.
 */
export function buildProgram(deps: ContextDeps = {}): Command {
  const program = new Command();
  program
    .name('purelymail')
    .description(
      'Unofficial CLI to manage PurelyMail: domains, users, routing, password resets, ' +
        'app passwords and account credit — across one or many accounts/organizations.',
    )
    .version(CLI_VERSION)
    .option('-p, --profile <name>', 'act on a single named account profile')
    .option('-o, --org <name>', 'act on all profiles in an organization')
    .option('-a, --all', 'act on all profiles')
    .option('--json', 'output JSON instead of tables')
    .option('-y, --yes', 'skip confirmation for destructive actions')
    .option('-c, --config <path>', 'path to the profile config file')
    .option('--timeout <ms>', 'per-request timeout in milliseconds')
    .option('--base-url <url>', 'override the API base URL (must be https)')
    .showHelpAfterError();

  const ctxFrom = (cmd: Command): CliContext => {
    const g = cmd.optsWithGlobals() as unknown as RawGlobalOptions;
    const opts = pick({
      profile: g.profile,
      org: g.org,
      all: g.all,
      json: g.json,
      yes: g.yes,
      config: g.config,
      baseUrl: g.baseUrl,
      timeoutMs: g.timeout !== undefined ? Number(g.timeout) : undefined,
    });
    return new CliContext(opts, deps);
  };

  registerInit(program, ctxFrom);
  registerDomains(program, ctxFrom);
  registerUsers(program, ctxFrom);
  registerRouting(program, ctxFrom);
  registerPasswordReset(program, ctxFrom);
  registerAppPasswords(program, ctxFrom);
  registerAccount(program, ctxFrom);
  registerProfiles(program, ctxFrom);
  return program;
}

/**
 * Run the CLI and resolve to a process exit code (never throws).
 *
 * @param argv - Arguments after the node binary + script (i.e. user args).
 * @param deps - Injectable dependencies.
 * @returns The exit code (0 on success).
 */
export async function run(argv: readonly string[], deps: ContextDeps = {}): Promise<number> {
  const io: IO = deps.io ?? stdio;
  const program = buildProgram(deps);
  program.exitOverride();
  try {
    await program.parseAsync([...argv], { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      // commander already wrote help/usage; propagate its own exit code.
      return error.exitCode;
    }
    io.err(messageFor(error));
    return exitCodeFor(error);
  }
}
