/**
 * `purelymail domains …` commands.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import type { CliContext } from '../context.js';
import { CliError, confirm, printJson } from '../output.js';
import { aggregate, emitAggregate, report } from './shared.js';

/**
 * Register the `domains` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerDomains(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  const group = program.command('domains').description('Manage domains');

  group
    .command('list')
    .description('List domains across the selected account(s)')
    .option('--shared', 'include PurelyMail shared domains', false)
    .action(async (opts: { shared: boolean }, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const result = await aggregate(
        ctx,
        async (client) => (await client.domains.list({ includeShared: opts.shared })).domains,
        (d) => ({
          name: d.name,
          shared: d.isShared,
          mx: d.dnsSummary.passesMx,
          spf: d.dnsSummary.passesSpf,
          dkim: d.dnsSummary.passesDkim,
          dmarc: d.dnsSummary.passesDmarc,
        }),
      );
      emitAggregate(
        ctx.io,
        ctx.json,
        ['profile', 'org', 'name', 'shared', 'mx', 'spf', 'dkim', 'dmarc'],
        result,
      );
    });

  group
    .command('add <domain>')
    .description('Add a domain (must pass DNS checks)')
    .action(async (domain: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      await ctx.singleClient().domains.add({ domainName: domain });
      report(ctx, `Added domain ${domain}`);
    });

  group
    .command('ownership')
    .description('Show the DNS ownership verification code')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const res = await ctx.singleClient().domains.getOwnershipCode();
      if (ctx.json) {
        printJson(ctx.io, res);
      } else {
        ctx.io.out(res.code);
      }
    });

  group
    .command('update <domain>')
    .description('Update domain settings')
    .option('--allow-account-reset', 'enable account reset via this domain')
    .option('--deny-account-reset', 'disable account reset via this domain')
    .option('--enable-subaddressing', 'enable symbolic subaddressing')
    .option('--disable-subaddressing', 'disable symbolic subaddressing')
    .option('--recheck-dns', 're-run DNS checks', false)
    .action(
      async (
        domain: string,
        opts: {
          allowAccountReset?: boolean;
          denyAccountReset?: boolean;
          enableSubaddressing?: boolean;
          disableSubaddressing?: boolean;
          recheckDns: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        const accountReset = triState(
          opts.allowAccountReset,
          opts.denyAccountReset,
          'account-reset',
        );
        const subaddressing = triState(
          opts.enableSubaddressing,
          opts.disableSubaddressing,
          'subaddressing',
        );
        await ctx.singleClient().domains.updateSettings({
          name: domain,
          recheckDns: opts.recheckDns,
          ...(accountReset !== undefined ? { allowAccountReset: accountReset } : {}),
          ...(subaddressing !== undefined ? { symbolicSubaddressing: subaddressing } : {}),
        });
        report(ctx, `Updated settings for ${domain}`);
      },
    );

  group
    .command('delete <domain>')
    .description('Delete a domain')
    .action(async (domain: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      if (!(await confirm(`Delete domain ${domain}? This cannot be undone.`, ctx.yes))) {
        ctx.io.err('aborted');
        return;
      }
      await ctx.singleClient().domains.delete({ name: domain });
      report(ctx, `Deleted domain ${domain}`);
    });
}

/**
 * Resolve a pair of enable/disable flags into a tri-state boolean.
 *
 * @param enable - The enable flag.
 * @param disable - The disable flag.
 * @param label - Name for the error message.
 * @returns `true`, `false`, or `undefined` when neither is set.
 */
export function triState(
  enable: boolean | undefined,
  disable: boolean | undefined,
  label: string,
): boolean | undefined {
  if (enable && disable) {
    throw new CliError(`Conflicting flags for ${label}: choose one.`, 2);
  }
  if (enable) {
    return true;
  }
  if (disable) {
    return false;
  }
  return undefined;
}
