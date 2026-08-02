/**
 * `purelymail password-reset …` commands (account recovery methods).
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { CliContext } from '../context.js';
import { CliError, confirm, printJson, printTable } from '../output.js';
import { report } from './shared.js';

/**
 * Register the `password-reset` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerPasswordReset(
  program: Command,
  ctxFrom: (cmd: Command) => CliContext,
): void {
  const group = program
    .command('password-reset')
    .description("Manage a user's password-reset (recovery) methods");

  group
    .command('list <user>')
    .description("List a user's reset methods")
    .action(async (user: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const res = await ctx.singleClient().passwordResets.list({ userName: user });
      if (ctx.json) {
        printJson(ctx.io, res);
      } else {
        printTable(ctx.io, res.users, ['type', 'target', 'description', 'allowMfaReset']);
      }
    });

  group
    .command('upsert <user>')
    .description('Create or update a reset method')
    .requiredOption('--type <type>', 'reset type: email or phone')
    .requiredOption('--target <value>', 'email address or phone number')
    .option('--existing-target <value>', 'update the method with this target instead of creating')
    .option('--description <text>', 'human-readable description')
    .option('--no-mfa-reset', 'do not allow MFA reset via this method')
    .action(
      async (
        user: string,
        opts: {
          type: string;
          target: string;
          existingTarget?: string;
          description?: string;
          mfaReset: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        if (opts.type !== 'email' && opts.type !== 'phone') {
          throw new CliError("--type must be 'email' or 'phone'.", 2);
        }
        await ctx.singleClient().passwordResets.upsert({
          userName: user,
          type: opts.type,
          target: opts.target,
          allowMfaReset: opts.mfaReset,
          ...(opts.existingTarget !== undefined ? { existingTarget: opts.existingTarget } : {}),
          ...(opts.description !== undefined ? { description: opts.description } : {}),
        });
        report(ctx, `Saved ${opts.type} reset method for ${user}`);
      },
    );

  group
    .command('delete <user>')
    .description('Delete a reset method')
    .option('--target <value>', 'target of the method to delete')
    .action(async (user: string, opts: { target?: string }, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      if (!(await confirm(`Delete reset method for ${user}?`, ctx.yes))) {
        ctx.io.err('aborted');
        return;
      }
      await ctx.singleClient().passwordResets.delete({
        userName: user,
        ...(opts.target !== undefined ? { target: opts.target } : {}),
      });
      report(ctx, `Deleted reset method for ${user}`);
    });
}
