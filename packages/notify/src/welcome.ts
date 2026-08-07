/**
 * New-account welcome-email template.
 *
 * Builds the message sent to a new user's **recovery** address with their
 * mailbox credentials and connection settings, as a styled HTML body plus a
 * plain-text fallback (multipart/alternative). Every interpolated value is
 * HTML-escaped so the HTML body carries no injection surface. The caller is
 * responsible for sending it to the recovery address, never the new mailbox.
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

/** Escape a value for safe interpolation into HTML text/attributes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
 * @returns The message (HTML + plain-text), addressed to the recovery email.
 */
export function buildWelcomeEmail(details: WelcomeDetails): EmailMessage {
  // Fail closed: never ship a plaintext credential to a malformed recipient.
  const recoveryEmail = emailSchema.parse(details.recoveryEmail);
  const login = details.loginUrl ?? 'https://purelymail.com';
  // Fail closed on the login link scheme: only http(s), so a stray/hostile
  // loginUrl (javascript:/data:) can never become a live href in the HTML body.
  if (!/^https?:\/\//i.test(login)) {
    throw new Error('loginUrl must be an http(s) URL.');
  }
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

  // Every interpolated value is escaped (escapeHtml) — no injection surface.
  const eEmail = escapeHtml(details.email);
  const ePassword = escapeHtml(details.password);
  const eLogin = escapeHtml(login);
  const eImap = escapeHtml(imap);
  const eSmtp = escapeHtml(smtp);
  const label =
    'color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px;';
  const cell = 'padding:6px 0;font-size:14px;';

  const html = [
    `<div style="background:#f4f5f7;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">`,
    `<tr><td style="background:#111827;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:600;border-radius:8px 8px 0 0;">Your new email account</td></tr>`,
    `<tr><td style="padding:28px;color:#111827;font-size:15px;line-height:1.55;">`,
    `<p style="margin:0 0 6px;">A mailbox has been created for you:</p>`,
    `<p style="margin:0 0 22px;font-size:18px;font-weight:600;">${eEmail}</p>`,
    `<p style="${label}">Temporary password</p>`,
    `<p style="margin:0 0 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;word-break:break-all;">${ePassword}</p>`,
    `<p style="margin:0 0 24px;color:#b45309;font-size:14px;">&#9888; Please sign in and change this password as soon as possible.</p>`,
    `<p style="${label}">Connection settings</p>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">`,
    `<tr><td style="${cell}color:#6b7280;width:96px;">Webmail</td><td style="${cell}"><a href="${eLogin}" style="color:#2563eb;">${eLogin}</a></td></tr>`,
    `<tr><td style="${cell}color:#6b7280;">Username</td><td style="${cell}">${eEmail}</td></tr>`,
    `<tr><td style="${cell}color:#6b7280;">IMAP</td><td style="${cell}">${eImap} &#183; port 993 &#183; SSL/TLS</td></tr>`,
    `<tr><td style="${cell}color:#6b7280;">SMTP</td><td style="${cell}">${eSmtp} &#183; port 465 &#183; SSL/TLS</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `<tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;border-radius:0 0 8px 8px;">If you weren't expecting this, contact your administrator.</td></tr>`,
    `</table></div>`,
  ].join('');

  return {
    to: recoveryEmail,
    subject: `Your new email account: ${details.email}`,
    text,
    html,
  };
}
