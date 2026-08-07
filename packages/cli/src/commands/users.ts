/**
 * `purelymail users …` commands.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { generatePassword } from '@fablabfortsmith/purelymail-core';
import { buildWelcomeEmail, isEmail } from '@fablabfortsmith/purelymail-notify';
import type { CliContext } from '../context.js';
import { CliError, confirm, printJson, printRecord } from '../output.js';
import { triState } from './domains.js';
import { aggregate, emitAggregate, report, resolveSecret } from './shared.js';

/**
 * Register the `users` command group.
 *
 * @param program - The root program.
 * @param ctxFrom - Builds a context from a command's global options.
 */
export function registerUsers(program: Command, ctxFrom: (cmd: Command) => CliContext): void {
  const group = program.command('users').description('Manage users/mailboxes');

  group
    .command('list')
    .description('List usernames across the selected account(s)')
    .action(async (_opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const result = await aggregate(
        ctx,
        async (client) => (await client.users.list()).users,
        (userName) => ({ userName }),
      );
      emitAggregate(ctx.io, ctx.json, ['profile', 'org', 'userName'], result);
    });

  group
    .command('get <user>')
    .description('Show a user (full user@domain)')
    .action(async (user: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      const res = await ctx.singleClient().users.get({ userName: user });
      if (ctx.json) {
        printJson(ctx.io, res);
      } else {
        printRecord(ctx.io, res);
      }
    });

  group
    .command('create <localPart> <domain>')
    .description(
      'Create a user/mailbox (password via --password-stdin, --password-env, or --generate-password)',
    )
    .option('--password-stdin', 'read the password from stdin')
    .option('--password-env <var>', 'read the password from an env var')
    .option('--generate-password', 'generate a strong password and print it once')
    .option('--password-length <n>', 'length for --generate-password (default 20, min 12)')
    .option('--recovery-email <email>', 'recovery email address')
    .option('--recovery-email-description <text>', 'recovery email description')
    .option('--recovery-phone <phone>', 'recovery phone number')
    .option('--recovery-phone-description <text>', 'recovery phone description')
    .option('--no-welcome-email', 'do not send a welcome email')
    .option(
      '--notify',
      'email the account details (incl. the password) to --recovery-email via the [notify] SMTP config',
    )
    .option('--no-search-indexing', 'disable search indexing')
    .option('--no-password-reset', 'disable password reset')
    .action(
      async (
        localPart: string,
        domain: string,
        opts: {
          passwordStdin?: boolean;
          passwordEnv?: string;
          generatePassword?: boolean;
          passwordLength?: string;
          recoveryEmail?: string;
          recoveryEmailDescription?: string;
          recoveryPhone?: string;
          recoveryPhoneDescription?: string;
          notify?: boolean;
          welcomeEmail: boolean;
          searchIndexing: boolean;
          passwordReset: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        let password: string;
        let generated: string | undefined;
        if (opts.generatePassword) {
          const length =
            opts.passwordLength !== undefined
              ? Number.parseInt(opts.passwordLength, 10)
              : undefined;
          if (length !== undefined && (!Number.isInteger(length) || length < 12)) {
            throw new CliError('--password-length must be an integer >= 12', 2);
          }
          password = generatePassword(length !== undefined ? { length } : {});
          generated = password;
        } else {
          password = await resolveSecret('password', opts.passwordStdin, opts.passwordEnv);
        }
        // Validate --notify prerequisites before creating anything (fail fast).
        if (opts.notify === true) {
          if (opts.recoveryEmail === undefined) {
            throw new CliError('--notify requires --recovery-email <email>', 2);
          }
          if (!isEmail(opts.recoveryEmail)) {
            throw new CliError('--recovery-email must be a valid email address', 2);
          }
          if (ctx.notify() === undefined) {
            throw new CliError('--notify requires a [notify] SMTP section in your config file', 2);
          }
          // Resolve confirm capability up front: refuse before creating anything
          // rather than creating the user and then failing the outward-send
          // confirmation in a non-interactive shell.
          if (!ctx.yes && !ctx.isInteractive()) {
            throw new CliError(
              '--notify in a non-interactive shell requires --yes (to confirm emailing the credential)',
              2,
            );
          }
        }
        await ctx.singleClient().users.create({
          userName: localPart,
          domainName: domain,
          password,
          enablePasswordReset: opts.passwordReset,
          enableSearchIndexing: opts.searchIndexing,
          sendWelcomeEmail: opts.welcomeEmail,
          ...(opts.recoveryEmail !== undefined ? { recoveryEmail: opts.recoveryEmail } : {}),
          ...(opts.recoveryEmailDescription !== undefined
            ? { recoveryEmailDescription: opts.recoveryEmailDescription }
            : {}),
          ...(opts.recoveryPhone !== undefined ? { recoveryPhone: opts.recoveryPhone } : {}),
          ...(opts.recoveryPhoneDescription !== undefined
            ? { recoveryPhoneDescription: opts.recoveryPhoneDescription }
            : {}),
        });
        report(ctx, `Created user ${localPart}@${domain}`);
        if (generated !== undefined) {
          ctx.io.out(`Generated password (shown once, store it securely): ${generated}`);
        }
        // Outward-facing: email the account details to the recovery address.
        if (opts.notify === true && opts.recoveryEmail !== undefined) {
          const recovery = opts.recoveryEmail;
          const n = ctx.notify();
          if (
            n !== undefined &&
            // Resolve interactivity from the same source as the pre-create guard
            // (ctx.isInteractive()), so injected prompt I/O is honored uniformly.
            (await confirm(`Send account details to ${recovery}?`, ctx.yes, ctx.promptIo()))
          ) {
            const smtpPassword = await n.passwordProvider.getToken();
            const mailer = ctx.mailerFor({
              host: n.host,
              port: n.port,
              user: n.user,
              password: smtpPassword,
              ...(n.secure !== undefined ? { secure: n.secure } : {}),
              ...(n.from !== undefined ? { from: n.from } : {}),
            });
            const message = buildWelcomeEmail({
              email: `${localPart}@${domain}`,
              password,
              recoveryEmail: recovery,
            });
            try {
              await mailer.send(message);
              report(ctx, `Sent account details to ${recovery}`);
            } catch (cause) {
              ctx.io.err(
                `warning: user created but the welcome email failed to send: ${
                  cause instanceof Error ? cause.message : String(cause)
                }`,
              );
            }
          }
        }
      },
    );

  group
    .command('modify <user>')
    .description('Modify a user (rename, reset password, toggle settings)')
    .option('--new-name <user>', 'new full username')
    .option('--password-stdin', 'read a new password from stdin')
    .option('--password-env <var>', 'read a new password from an env var')
    .option('--enable-search-indexing', 'enable search indexing')
    .option('--disable-search-indexing', 'disable search indexing')
    .option('--enable-password-reset', 'enable password reset')
    .option('--disable-password-reset', 'disable password reset')
    .option('--require-2fa', 'require two-factor authentication')
    .option('--disable-2fa', 'do not require two-factor authentication')
    .action(
      async (
        user: string,
        opts: {
          newName?: string;
          passwordStdin?: boolean;
          passwordEnv?: string;
          enableSearchIndexing?: boolean;
          disableSearchIndexing?: boolean;
          enablePasswordReset?: boolean;
          disablePasswordReset?: boolean;
          require2fa?: boolean;
          disable2fa?: boolean;
        },
        cmd: Command,
      ) => {
        const ctx = ctxFrom(cmd);
        const searchIndexing = triState(
          opts.enableSearchIndexing,
          opts.disableSearchIndexing,
          'search-indexing',
        );
        const passwordReset = triState(
          opts.enablePasswordReset,
          opts.disablePasswordReset,
          'password-reset',
        );
        const require2fa = triState(opts.require2fa, opts.disable2fa, '2fa');
        const newPassword =
          opts.passwordStdin || opts.passwordEnv !== undefined
            ? await resolveSecret('password', opts.passwordStdin, opts.passwordEnv)
            : undefined;
        await ctx.singleClient().users.modify({
          userName: user,
          ...(opts.newName !== undefined ? { newUserName: opts.newName } : {}),
          ...(newPassword !== undefined ? { newPassword } : {}),
          ...(searchIndexing !== undefined ? { enableSearchIndexing: searchIndexing } : {}),
          ...(passwordReset !== undefined ? { enablePasswordReset: passwordReset } : {}),
          ...(require2fa !== undefined ? { requireTwoFactorAuthentication: require2fa } : {}),
        });
        report(ctx, `Modified user ${user}`);
      },
    );

  group
    .command('delete <user>')
    .description('Delete a user/mailbox')
    .action(async (user: string, _opts: unknown, cmd: Command) => {
      const ctx = ctxFrom(cmd);
      if (!(await confirm(`Delete user ${user}? This cannot be undone.`, ctx.yes))) {
        ctx.io.err('aborted');
        return;
      }
      await ctx.singleClient().users.delete({ userName: user });
      report(ctx, `Deleted user ${user}`);
    });
}
