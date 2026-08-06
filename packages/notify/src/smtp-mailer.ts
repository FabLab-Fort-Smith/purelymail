/**
 * SMTP {@link Mailer} backed by nodemailer.
 *
 * @packageDocumentation
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailMessage, Mailer } from './mailer.js';

/** SMTP connection settings. The password is a secret (env/keychain, never config). */
export interface SmtpConfig {
  /** SMTP host, e.g. `smtp.purelymail.com`. */
  readonly host: string;
  /** SMTP port, e.g. `465`. */
  readonly port: number;
  /** Use implicit TLS. Defaults to `true` when the port is 465. */
  readonly secure?: boolean;
  /** Auth username (usually the sender mailbox). */
  readonly user: string;
  /** Auth password (app password / mailbox password). */
  readonly password: string;
  /** From address. Defaults to `user`. */
  readonly from?: string;
}

/** The subset of a nodemailer transporter this mailer uses (injectable for tests). */
export type SendTransport = Pick<Transporter, 'sendMail'>;

/**
 * A {@link Mailer} that sends over SMTP via nodemailer.
 */
export class SmtpMailer implements Mailer {
  readonly #transport: SendTransport;
  readonly #from: string;

  /**
   * @param config - SMTP connection settings.
   * @param transport - Optional pre-built transport (inject a fake in tests);
   *   defaults to a nodemailer SMTP transport from `config`.
   */
  public constructor(config: SmtpConfig, transport?: SendTransport) {
    this.#from = config.from ?? config.user;
    this.#transport =
      transport ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure ?? config.port === 465,
        auth: { user: config.user, pass: config.password },
      });
  }

  /** @inheritDoc */
  public async send(message: EmailMessage): Promise<void> {
    await this.#transport.sendMail({
      from: this.#from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html !== undefined ? { html: message.html } : {}),
    });
  }
}
