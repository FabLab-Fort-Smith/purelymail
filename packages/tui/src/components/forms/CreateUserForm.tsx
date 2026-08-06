import { useState, type ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { NewUserForm } from '../../mutations.js';
import { TextField } from './TextField.js';
import { YesNoField } from './YesNoField.js';

/** Props for {@link CreateUserForm}. */
export interface CreateUserFormProps {
  /** Pre-fill the domain (e.g. from the selected account). */
  readonly domainHint?: string;
  /** Whether a `[notify]` SMTP section is configured (enables the email step). */
  readonly notifyConfigured?: boolean;
  /** Called with the collected form once all fields are entered. */
  readonly onSubmit: (form: NewUserForm) => void;
  /** Called when the user aborts (Esc). */
  readonly onCancel: () => void;
}

type Step = 'localPart' | 'domain' | 'generate' | 'password' | 'notify' | 'recovery';

/** A completed-field summary line. */
function Done({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <Text>
      <Text dimColor>{label}: </Text>
      {value}
    </Text>
  );
}

/**
 * A stepped form collecting a new user's local part, domain, and password
 * (typed or auto-generated), then optionally emailing the account details to a
 * recovery address. Enter advances, Esc cancels. Welcome email (PurelyMail's
 * own) stays off; the recovery email is our `[notify]` message.
 *
 * @param props - Domain hint, notify availability, submit/cancel callbacks.
 * @returns The form tree.
 */
export function CreateUserForm({
  domainHint,
  notifyConfigured = false,
  onSubmit,
  onCancel,
}: CreateUserFormProps): ReactElement {
  const [step, setStep] = useState<Step>('localPart');
  const [localPart, setLocalPart] = useState('');
  const [domain, setDomain] = useState(domainHint ?? '');
  const [generate, setGenerate] = useState(false);
  const [password, setPassword] = useState('');
  const [notify, setNotify] = useState(false);

  /** Emit the final form, taking explicit values to avoid stale state. */
  const submit = (fields: {
    generate: boolean;
    password: string;
    notify: boolean;
    recoveryEmail: string;
  }): void => {
    onSubmit({
      localPart,
      domain,
      password: fields.password,
      sendWelcomeEmail: false,
      generate: fields.generate,
      notify: fields.notify,
      recoveryEmail: fields.recoveryEmail,
    });
  };

  /** After the password is settled, either ask about notify or submit. */
  const afterPassword = (gen: boolean, pw: string): void => {
    if (notifyConfigured) {
      setStep('notify');
    } else {
      submit({ generate: gen, password: pw, notify: false, recoveryEmail: '' });
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        New user
      </Text>
      {step !== 'localPart' ? <Done label="local part" value={localPart} /> : null}
      {step !== 'localPart' && step !== 'domain' ? <Done label="domain" value={domain} /> : null}

      {step === 'localPart' ? (
        <TextField
          label="local part"
          onCancel={onCancel}
          onSubmit={(value) => {
            setLocalPart(value.trim());
            setStep('domain');
          }}
        />
      ) : null}

      {step === 'domain' ? (
        <TextField
          label="domain"
          initial={domain}
          onCancel={onCancel}
          onSubmit={(value) => {
            setDomain(value.trim());
            setStep('generate');
          }}
        />
      ) : null}

      {step === 'generate' ? (
        <YesNoField
          label="generate a strong password?"
          onCancel={onCancel}
          onSubmit={(value) => {
            setGenerate(value);
            if (value) {
              afterPassword(true, '');
            } else {
              setStep('password');
            }
          }}
        />
      ) : null}

      {step === 'password' ? (
        <TextField
          label="password"
          mask
          onCancel={onCancel}
          onSubmit={(value) => {
            setPassword(value);
            afterPassword(false, value);
          }}
        />
      ) : null}

      {step === 'notify' ? (
        <YesNoField
          label="email account details to a recovery address?"
          onCancel={onCancel}
          onSubmit={(value) => {
            setNotify(value);
            if (value) {
              setStep('recovery');
            } else {
              submit({ generate, password, notify: false, recoveryEmail: '' });
            }
          }}
        />
      ) : null}

      {step === 'recovery' ? (
        <TextField
          label="recovery email"
          onCancel={onCancel}
          onSubmit={(value) => {
            submit({ generate, password, notify, recoveryEmail: value.trim() });
          }}
        />
      ) : null}

      <Text dimColor>[enter] next [y/n] toggle [esc] cancel</Text>
    </Box>
  );
}
