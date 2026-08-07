import { describe, expect, it } from 'vitest';
import { buildWelcomeEmail, isEmail } from '../src/welcome.js';

describe('isEmail', () => {
  it('accepts valid and rejects malformed addresses', () => {
    expect(isEmail('rec@x.com')).toBe(true);
    expect(isEmail('not-an-email')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});

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
    // HTML alternative present, styled, carries the same content.
    expect(m.html).toBeDefined();
    expect(m.html).toContain('Your new email account');
    expect(m.html).toContain('new@d.com');
    expect(m.html).toContain('PW123secret');
    expect(m.html).toContain('imap.purelymail.com');
    expect(m.html).toContain('href="https://purelymail.com"');
  });

  it('honours host/url overrides in both text and html', () => {
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
    expect(m.html).toContain('href="https://mail.example"');
    expect(m.html).toContain('imap.example');
    expect(m.html).toContain('smtp.example');
  });

  it('HTML-escapes interpolated values (no injection surface)', () => {
    const m = buildWelcomeEmail({
      email: 'a@b.com',
      password: `<script>alert('x')&"`,
      recoveryEmail: 'r@c.com',
    });
    // The raw markup/entities never appear unescaped in the HTML body…
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).toContain('&amp;');
    expect(m.html).toContain('&quot;');
    expect(m.html).toContain('&#39;');
    // …but the plain-text fallback keeps the literal password.
    expect(m.text).toContain(`<script>alert('x')&"`);
  });

  it('throws on a malformed recovery address (fail closed)', () => {
    expect(() =>
      buildWelcomeEmail({ email: 'a@b.com', password: 'x', recoveryEmail: 'nope' }),
    ).toThrow();
  });

  it('rejects a non-http(s) loginUrl (fail closed)', () => {
    expect(() =>
      buildWelcomeEmail({
        email: 'a@b.com',
        password: 'x',
        recoveryEmail: 'r@c.com',
        loginUrl: 'javascript:alert(1)',
      }),
    ).toThrow(/http\(s\)/i);
  });
});
