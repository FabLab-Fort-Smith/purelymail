/**
 * CLI execution context.
 *
 * Resolves global options + the profile configuration into a selected set of
 * accounts and ready-to-use core clients / workspace. All external inputs
 * (registry, client factory, env, IO) are injectable so commands are unit
 * testable without disk or network (dependency-injection).
 *
 * @packageDocumentation
 */

import {
  PurelymailClient,
  PurelymailWorkspace,
  type Profile,
  type ProfileRegistry,
} from '@fablabfortsmith/purelymail-core';
import {
  loadProfiles,
  resolveConfigPath,
  type ResolvedNotify,
} from '@fablabfortsmith/purelymail-config';
import { SmtpMailer, type Mailer, type SmtpConfig } from '@fablabfortsmith/purelymail-notify';
import { CliError, stdio, type IO } from './output.js';
import type { PromptIO } from './prompt.js';
import type { KeyringLoader } from '@fablabfortsmith/purelymail-config';

/** Parsed global CLI options. */
export interface GlobalOptions {
  /** Target a single named profile. */
  readonly profile?: string;
  /** Target all profiles in an organization. */
  readonly org?: string;
  /** Target every profile. */
  readonly all?: boolean;
  /** Emit JSON instead of tables. */
  readonly json?: boolean;
  /** Skip destructive-action confirmation. */
  readonly yes?: boolean;
  /** Config file path override. */
  readonly config?: string;
  /** Per-request timeout (ms). */
  readonly timeoutMs?: number;
  /** Base URL override (must be https). */
  readonly baseUrl?: string;
}

/** Injectable dependencies (tests provide fakes). */
export interface ContextDeps {
  /** Pre-built registry (skips disk loading). */
  readonly registry?: ProfileRegistry;
  /** Default profile name to use when no selector is given. */
  readonly defaultProfile?: string;
  /** Custom client builder (e.g. with a fake transport). */
  readonly clientFactory?: (profile: Profile) => PurelymailClient;
  /** Environment map. */
  readonly env?: Record<string, string | undefined>;
  /** Output sink (line-based results). */
  readonly io?: IO;
  /** Raw input stream for interactive prompts (defaults to `process.stdin`). */
  readonly input?: NodeJS.ReadableStream;
  /** Raw output stream for interactive prompts (defaults to `process.stdout`). */
  readonly output?: NodeJS.WritableStream;
  /** Whether prompts run against an interactive TTY. */
  readonly isTty?: boolean;
  /** Keyring loader for storing secrets (defaults to the native dep). */
  readonly keyringLoader?: KeyringLoader;
  /** Pre-resolved notify settings (skips disk loading; tests inject fakes). */
  readonly notify?: ResolvedNotify;
  /** Custom mailer builder (e.g. a capturing fake in tests). */
  readonly mailerFactory?: (config: SmtpConfig) => Mailer;
}

/** Resolved, selectable CLI context. */
export class CliContext {
  /** Output sink. */
  public readonly io: IO;
  /** Whether JSON output was requested. */
  public readonly json: boolean;
  /** Whether destructive confirmations are pre-approved. */
  public readonly yes: boolean;

  readonly #opts: GlobalOptions;
  readonly #deps: ContextDeps;
  readonly #clientFactory: (profile: Profile) => PurelymailClient;
  readonly #env: Record<string, string | undefined>;
  readonly #input: NodeJS.ReadableStream;
  readonly #output: NodeJS.WritableStream;
  readonly #isTty: boolean;
  readonly #keyringLoader: KeyringLoader | undefined;
  readonly #mailerFactory: (config: SmtpConfig) => Mailer;
  #registry: ProfileRegistry | undefined;
  #defaultProfile: string | undefined;
  #notify: ResolvedNotify | undefined;
  #loaded = false;

  /**
   * @param opts - Global CLI options.
   * @param deps - Injectable dependencies.
   */
  public constructor(opts: GlobalOptions, deps: ContextDeps = {}) {
    this.#opts = opts;
    this.#deps = deps;
    this.io = deps.io ?? stdio;
    this.json = opts.json ?? false;
    this.yes = opts.yes ?? false;
    this.#env = deps.env ?? process.env;
    this.#input = deps.input ?? process.stdin;
    this.#output = deps.output ?? process.stdout;
    this.#isTty = deps.isTty ?? Boolean(process.stdin.isTTY);
    this.#keyringLoader = deps.keyringLoader;
    this.#mailerFactory = deps.mailerFactory ?? ((config) => new SmtpMailer(config));
    this.#clientFactory = deps.clientFactory ?? ((profile) => this.#buildClient(profile));
  }

  /**
   * The underlying profile registry (loaded lazily on first use, so wizard
   * commands that write config never trigger a read of a not-yet-existing file).
   *
   * @returns The registry.
   */
  public registry(): ProfileRegistry {
    if (!this.#loaded) {
      this.#loaded = true;
      if (this.#deps.registry) {
        this.#registry = this.#deps.registry;
        this.#defaultProfile = this.#deps.defaultProfile;
        this.#notify = this.#deps.notify;
      } else {
        const loaded = loadProfiles({
          ...(this.#opts.config !== undefined ? { configPath: this.#opts.config } : {}),
          ...(this.#deps.env ? { env: this.#deps.env } : {}),
        });
        this.#registry = loaded.registry;
        this.#defaultProfile = loaded.defaultProfile;
        this.#notify = loaded.notify;
        for (const warning of loaded.warnings) {
          this.io.err(`warning: ${warning}`);
        }
      }
    }
    return this.#registry as ProfileRegistry;
  }

  /**
   * Resolve the selected profiles from `--all` / `--org` / `--profile` / default.
   *
   * @returns The selected profiles (at least one).
   * @throws {@link CliError} when nothing is selected.
   */
  public selectedProfiles(): readonly Profile[] {
    const registry = this.registry();
    if (this.#opts.all) {
      return registry.select({ all: true });
    }
    if (this.#opts.org !== undefined) {
      return registry.select({ org: this.#opts.org });
    }
    if (this.#opts.profile !== undefined) {
      return registry.select({ names: [this.#opts.profile] });
    }
    if (this.#defaultProfile !== undefined) {
      return registry.select({ names: [this.#defaultProfile] });
    }
    throw new CliError(
      'No account selected. Use --profile <name>, --org <name>, or --all, ' +
        'or set defaultProfile in your config.',
      5,
    );
  }

  /**
   * Resolve exactly one profile for account-specific (mutating) commands.
   *
   * @returns The single selected profile.
   * @throws {@link CliError} when the selection is not exactly one account.
   */
  public singleProfile(): Profile {
    const profiles = this.selectedProfiles();
    if (profiles.length !== 1) {
      throw new CliError(
        `This command operates on a single account, but ${profiles.length} were selected. ` +
          'Narrow with --profile <name>.',
        2,
      );
    }
    return profiles[0]!;
  }

  /**
   * Build (or inject) the client for a profile.
   *
   * @param profile - The account profile.
   * @returns A client bound to that account.
   */
  public clientFor(profile: Profile): PurelymailClient {
    return this.#clientFactory(profile);
  }

  /**
   * The client for the single selected account.
   *
   * @returns A client for exactly one account.
   */
  public singleClient(): PurelymailClient {
    return this.clientFor(this.singleProfile());
  }

  /**
   * A workspace over the selected accounts, using this context's client factory.
   *
   * @returns The workspace.
   */
  public workspace(): PurelymailWorkspace {
    return new PurelymailWorkspace({ clientFactory: (p) => this.clientFor(p) });
  }

  /**
   * The environment map (for reading token env vars).
   *
   * @returns The environment.
   */
  public env(): Record<string, string | undefined> {
    return this.#env;
  }

  /**
   * The resolved `[notify]` SMTP settings, if the config declared them (loaded
   * lazily with the registry).
   *
   * @returns The notify settings, or `undefined` when not configured.
   */
  public notify(): ResolvedNotify | undefined {
    this.registry();
    return this.#notify;
  }

  /**
   * Build a mailer for the given SMTP config (fake-injectable for tests).
   *
   * @param config - SMTP connection settings including the resolved password.
   * @returns A ready mailer.
   */
  public mailerFor(config: SmtpConfig): Mailer {
    return this.#mailerFactory(config);
  }

  /**
   * The resolved config file path (for reading/writing profile config).
   *
   * @returns The absolute config file path.
   */
  public configFilePath(): string {
    return resolveConfigPath(this.#opts.config, this.#env);
  }

  /**
   * The keyring loader, if one was injected (else the default native loader is
   * used by the token resolvers).
   *
   * @returns The keyring loader or `undefined`.
   */
  public keyringLoader(): KeyringLoader | undefined {
    return this.#keyringLoader;
  }

  /**
   * Prompt I/O derived from the injected input/output/TTY settings.
   *
   * @returns The {@link PromptIO}.
   */
  public promptIo(): PromptIO {
    return { input: this.#input, output: this.#output, isTty: this.#isTty };
  }

  /**
   * Whether prompts can be answered interactively (a TTY is attached).
   *
   * @returns `true` when the session can prompt for confirmation.
   */
  public isInteractive(): boolean {
    return this.#isTty;
  }

  #buildClient(profile: Profile): PurelymailClient {
    const baseUrl = this.#opts.baseUrl ?? profile.baseUrl;
    return new PurelymailClient({
      tokenProvider: profile.tokenProvider,
      ...(baseUrl !== undefined ? { baseUrl } : {}),
      ...(this.#opts.timeoutMs !== undefined ? { timeoutMs: this.#opts.timeoutMs } : {}),
    });
  }
}
