/**
 * `purelymail account …` commands.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { CliContext } from '../context.js';
import { aggregate, emitAggregate } from './shared.js';

/**
 * Register the `account` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerAccount(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  const group = program.command('account').description('Account-level queries');

  group
    .command('credit')
    .description('Show remaining credit across the selected account(s)')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const result = await aggregate(
        ctx,
        async (client) => [await client.account.credit()],
        (r) => ({ credit: r.credit }),
      );
      emitAggregate(ctx.io, ctx.json, ['profile', 'org', 'credit'], result);
    });
}
