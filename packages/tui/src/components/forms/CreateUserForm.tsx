import { useState, type ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { NewUserForm } from '../../mutations.js';
import { TextField } from './TextField.js';
import { CreateUserOptions, type CreateUserOptionsValue } from './CreateUserOptions.js';

/** Props for {@link CreateUserForm}. */
export interface CreateUserFormProps {
  /** Pre-fill the domain (e.g. from the selected account). */
  readonly domainHint?: string;
  /** Whether a `[notify]` SMTP section is configured (enables the email option). */
  readonly notifyConfigured?: boolean;
  /** Called with the collected form once all fields are entered. */
  readonly onSubmit: (form: NewUserForm) => void;
  /** Called when the user aborts (Esc). */
  readonly onCancel: () => void;
}

type Step = 'localPart' | 'domain' | 'options' | 'password';

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
 * A stepped form collecting a new user's local part and domain, then a checkbox
 * options panel (auto-generate password, email account details) with a
 * required, validated recovery address when emailing is on. A typed password is
 * only requested when auto-generation is off. The recovery address is both the
 * email destination and stored on the new account.
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
  const [options, setOptions] = useState<CreateUserOptionsValue | null>(null);
  const [pwError, setPwError] = useState(false);

  /** Emit the final form from the collected options + a resolved password. */
  const submit = (opts: CreateUserOptionsValue, password: string): void => {
    onSubmit({
      localPart,
      domain,
      password,
      sendWelcomeEmail: false,
      generate: opts.generate,
      notify: opts.email,
      recoveryEmail: opts.recovery,
    });
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
            setStep('options');
          }}
        />
      ) : null}

      {step === 'options' ? (
        <CreateUserOptions
          notifyConfigured={notifyConfigured}
          onCancel={onCancel}
          onSubmit={(value) => {
            setOptions(value);
            if (value.generate) {
              submit(value, ''); // password resolved (generated) downstream
            } else {
              setStep('password');
            }
          }}
        />
      ) : null}

      {step === 'password' && options !== null ? (
        <Box flexDirection="column">
          <TextField
            label="password"
            mask
            onCancel={onCancel}
            onSubmit={(value) => {
              if (value === '') {
                setPwError(true);
                return; // stay on the step; a password is required
              }
              setPwError(false);
              submit(options, value);
            }}
          />
          {pwError ? <Text color="red">password is required</Text> : null}
        </Box>
      ) : null}

      <Text dimColor>[esc] cancel</Text>
    </Box>
  );
}
