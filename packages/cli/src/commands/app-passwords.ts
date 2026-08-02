/**
 * `purelymail app-password …` commands.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { CliContext } from '../context.js';
import { confirm, printJson } from '../output.js';
import { report, resolveSecret } from './shared.js';

/**
 * Register the `app-password` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerAppPasswords(
  program: Command,
  ctxFrom: (cmd: Command) => CliContext,
): void {
  const group = program.command('app-password').description('Manage per-user app passwords');

  group
    .command('create <user>')
    .description('Create an app password (shown once)')
    .option('--name <text>', 'description for the app password', '')
    .action(async (user: string, opts: { name: string }, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const res = await ctx.singleClient().appPasswords.create({
        userHandle: user,
        name: opts.name,
      });
      // The app password is a secret shown only once — emit it on stdout so it
      // can be piped, and warn on stderr.
      ctx.io.err('This app password is shown once. Store it securely now.');
      if (ctx.json) {
        printJson(ctx.io, res);
      } else {
        ctx.io.out(res.appPassword);
      }
    });

  group
    .command('delete <user>')
    .description('Revoke an app password (value via --app-password-stdin / --app-password-env)')
    .option('--app-password-stdin', 'read the app password from stdin')
    .option('--app-password-env <var>', 'read the app password from an env var')
    .action(
      async (
        user: string,
        opts: { appPasswordStdin?: boolean; appPasswordEnv?: string },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        const appPassword = await resolveSecret(
          'app-password',
          opts.appPasswordStdin,
          opts.appPasswordEnv,
        );
        if (!(await confirm(`Revoke an app password for ${user}?`, ctx.yes))) {
          ctx.io.err('aborted');
          return;
        }
        await ctx.singleClient().appPasswords.delete({ userName: user, appPassword });
        report(ctx, `Revoked app password for ${user}`);
      },
    );
}
