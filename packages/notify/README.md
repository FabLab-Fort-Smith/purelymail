# @fablabfortsmith/purelymail-notify

> **Unofficial.** Not affiliated with or endorsed by PurelyMail.

Email notifications for the PurelyMail toolkit — an SMTP mailer (nodemailer) and
a new-account **welcome** template. Shared by the [CLI](../cli) and [TUI](../tui)
so both send onboarding email the same way.

```ts
import { SmtpMailer, buildWelcomeEmail } from '@fablabfortsmith/purelymail-notify';

const mailer = new SmtpMailer({ host, port, user, password }); // password from env/keychain
await mailer.send(buildWelcomeEmail({ email, password, recoveryEmail }));
```

Security: the welcome message carries the new mailbox's password, so send it to
the user's **recovery** address (not the new mailbox), over TLS, and never log
it. The message includes a "change your password on first sign-in" nudge.
