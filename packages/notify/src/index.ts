/**
 * `@fablabfortsmith/purelymail-notify` — email notifications for the PurelyMail
 * toolkit: an SMTP mailer and a new-account welcome template.
 *
 * @packageDocumentation
 */
export type { EmailMessage, Mailer } from './mailer.js';
export { SmtpMailer, type SmtpConfig, type SendTransport } from './smtp-mailer.js';
export { buildWelcomeEmail, type WelcomeDetails } from './welcome.js';
