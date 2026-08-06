/**
 * The mailer port — the transport-agnostic interface the toolkit sends through.
 *
 * @packageDocumentation
 */

/** A plain email message. */
export interface EmailMessage {
  /** Recipient address. */
  readonly to: string;
  /** Subject line. */
  readonly subject: string;
  /** Plain-text body. */
  readonly text: string;
  /** Optional HTML body. */
  readonly html?: string;
}

/** Sends {@link EmailMessage}s. Implemented by e.g. {@link SmtpMailer}. */
export interface Mailer {
  /**
   * Send a message.
   *
   * @param message - The message to send.
   * @returns Resolves when accepted by the transport; rejects on failure.
   */
  send(message: EmailMessage): Promise<void>;
}
