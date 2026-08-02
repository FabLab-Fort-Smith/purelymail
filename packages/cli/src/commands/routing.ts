/**
 * `purelymail routing …` commands.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { CliContext } from '../context.js';
import { CliError, confirm } from '../output.js';
import { aggregate, emitAggregate, report } from './shared.js';

/** Commander collector for repeatable options. */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Register the `routing` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerRouting(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  const group = program.command('routing').description('Manage mail routing rules');

  group
    .command('list')
    .description('List routing rules across the selected account(s)')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const result = await aggregate(
        ctx,
        async (client) => (await client.routing.list()).rules,
        (rule) => ({
          id: rule.id,
          domainName: rule.domainName,
          matchUser: rule.matchUser,
          prefix: rule.prefix,
          catchall: rule.catchall,
          targets: rule.targetAddresses.join(','),
        }),
      );
      emitAggregate(
        ctx.io,
        ctx.json,
        ['profile', 'org', 'id', 'domainName', 'matchUser', 'prefix', 'catchall', 'targets'],
        result,
      );
    });

  group
    .command('create')
    .description('Create a routing rule')
    .requiredOption('--domain <domain>', 'domain the rule applies to')
    .option('--match-user <local>', 'local part to match (empty for catchall)', '')
    .option('--target <email>', 'target address (repeatable)', collect, [])
    .option('--prefix', 'treat match-user as a prefix', false)
    .option('--catchall', 'only fire when the address is not a real user', false)
    .action(
      async (
        opts: {
          domain: string;
          matchUser: string;
          target: string[];
          prefix: boolean;
          catchall: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        if (opts.target.length === 0) {
          throw new CliError('At least one --target address is required.', 2);
        }
        await ctx.singleClient().routing.create({
          domainName: opts.domain,
          matchUser: opts.matchUser,
          targetAddresses: opts.target,
          prefix: opts.prefix,
          catchall: opts.catchall,
        });
        report(ctx, `Created routing rule for ${opts.domain}`);
      },
    );

  group
    .command('delete <id>')
    .description('Delete a routing rule by id (see routing list)')
    .action(async (id: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const routingRuleId = Number(id);
      if (!Number.isInteger(routingRuleId)) {
        throw new CliError(`Invalid routing rule id: ${id}`, 2);
      }
      if (!(await confirm(`Delete routing rule ${id}?`, ctx.yes))) {
        ctx.io.err('aborted');
        return;
      }
      await ctx.singleClient().routing.delete({ routingRuleId });
      report(ctx, `Deleted routing rule ${id}`);
    });
}
