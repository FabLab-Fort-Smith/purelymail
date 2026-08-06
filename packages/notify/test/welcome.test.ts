import { describe, expect, it } from 'vitest';
import { buildWelcomeEmail } from '../src/welcome.js';

describe('buildWelcomeEmail', () => {
  it('addresses the recovery email and includes credentials + defaults', () => {
    const m = buildWelcomeEmail({
      email: 'new@d.com',
      password: 'PW123secret',
      recoveryEmail: 'rec@x.com',
    });
    expect(m.to).toBe('rec@x.com');
    expect(m.subject).toContain('new@d.com');
    expect(m.text).toContain('new@d.com');
    expect(m.text).toContain('PW123secret');
    expect(m.text).toContain('change this password');
    expect(m.text).toContain('imap.purelymail.com');
    expect(m.text).toContain('smtp.purelymail.com');
    expect(m.text).toContain('https://purelymail.com');
    expect(m.html).toBeUndefined();
  });

  it('honours host/url overrides', () => {
    const m = buildWelcomeEmail({
      email: 'a@b.com',
      password: 'x',
      recoveryEmail: 'r@c.com',
      loginUrl: 'https://mail.example',
      imapHost: 'imap.example',
      smtpHost: 'smtp.example',
    });
    expect(m.text).toContain('https://mail.example');
    expect(m.text).toContain('imap.example');
    expect(m.text).toContain('smtp.example');
  });
});
