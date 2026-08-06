import { describe, expect, it } from 'vitest';
import { SmtpMailer, type SendTransport } from '../src/smtp-mailer.js';

/** A fake transport that records sent mail. */
function fakeTransport(sink: unknown[]): SendTransport {
  return {
    sendMail: (options: unknown) => {
      sink.push(options);
      return Promise.resolve({});
    },
  };
}

describe('SmtpMailer', () => {
  it('sends via the injected transport, from defaults to user', async () => {
    const sent: unknown[] = [];
    const mailer = new SmtpMailer(
      { host: 'h', port: 465, user: 'admin@d.com', password: 'p' },
      fakeTransport(sent),
    );
    await mailer.send({ to: 'x@y.com', subject: 'S', text: 'body' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: 'admin@d.com',
      to: 'x@y.com',
      subject: 'S',
      text: 'body',
    });
  });

  it('uses a custom from and passes html when present', async () => {
    const sent: unknown[] = [];
    const mailer = new SmtpMailer(
      { host: 'h', port: 587, secure: false, user: 'u', password: 'p', from: 'noreply@d.com' },
      fakeTransport(sent),
    );
    await mailer.send({ to: 't@t.com', subject: 'S', text: 'b', html: '<b>h</b>' });
    expect(sent[0]).toMatchObject({ from: 'noreply@d.com', html: '<b>h</b>' });
  });

  it('builds a default nodemailer transport when none is injected', () => {
    // Covers the createTransport branch (no send -> no connection attempt).
    const mailer = new SmtpMailer({ host: 'smtp.x', port: 465, user: 'u', password: 'p' });
    expect(mailer).toBeInstanceOf(SmtpMailer);
  });
});
