/**
 * New-account welcome-email template.
 *
 * Builds the plain-text message sent to a new user's **recovery** address with
 * their mailbox credentials and connection settings. Plain text only (no HTML)
 * to avoid any template/HTML-injection surface. The caller is responsible for
 * sending it to the recovery address, never the new mailbox.
 *
 * @packageDocumentation
 */
import { z } from 'zod';
import type { EmailMessage } from './mailer.js';

const emailSchema = z.email();

/**
 * Whether a string is a syntactically valid email address.
 *
 * @param value - The candidate address.
 * @returns `true` if it parses as an email address.
 */
export function isEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

/** Inputs for {@link buildWelcomeEmail}. */
export interface WelcomeDetails {
  /** The new mailbox address (`user@domain`). */
  readonly email: string;
  /** The mailbox password (temporary — the user should change it). */
  readonly password: string;
  /** Where to send this (the user's recovery address). */
  readonly recoveryEmail: string;
  /** Webmail/login URL. Defaults to `https://purelymail.com`. */
  readonly loginUrl?: string;
  /** IMAP host. Defaults to `imap.purelymail.com`. */
  readonly imapHost?: string;
  /** SMTP host. Defaults to `smtp.purelymail.com`. */
  readonly smtpHost?: string;
}

/**
 * Build the welcome message for a newly created mailbox.
 *
 * @param details - Mailbox address, password, recovery address, and optional
 *   host/URL overrides.
 * @returns The message, addressed to the recovery email.
 */
export function buildWelcomeEmail(details: WelcomeDetails): EmailMessage {
  // Fail closed: never ship a plaintext credential to a malformed recipient.
  const recoveryEmail = emailSchema.parse(details.recoveryEmail);
  const login = details.loginUrl ?? 'https://purelymail.com';
  const imap = details.imapHost ?? 'imap.purelymail.com';
  const smtp = details.smtpHost ?? 'smtp.purelymail.com';

  const text = [
    `A new email mailbox has been created for you: ${details.email}`,
    '',
    `Temporary password: ${details.password}`,
    'Please sign in and change this password as soon as possible.',
    '',
    'Connection settings:',
    `  Login / webmail: ${login}`,
    `  Username:        ${details.email}`,
    `  IMAP (incoming): ${imap}, port 993, SSL/TLS`,
    `  SMTP (outgoing): ${smtp}, port 465, SSL/TLS`,
    '',
    "If you weren't expecting this, contact your administrator.",
    '',
  ].join('\n');

  return {
    to: recoveryEmail,
    subject: `Your new email account: ${details.email}`,
    text,
  };
}
