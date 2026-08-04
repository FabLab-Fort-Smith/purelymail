import { useState, type ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { NewUserForm } from '../../mutations.js';
import { TextField } from './TextField.js';

/** Props for {@link CreateUserForm}. */
export interface CreateUserFormProps {
  /** Pre-fill the domain (e.g. from the selected account). */
  readonly domainHint?: string;
  /** Called with the collected form once all fields are entered. */
  readonly onSubmit: (form: NewUserForm) => void;
  /** Called when the user aborts (Esc). */
  readonly onCancel: () => void;
}

type Step = 'localPart' | 'domain' | 'password';

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
 * (masked), then handing back a {@link NewUserForm}. Enter advances, Esc
 * cancels. Welcome email is off by default (safe for test accounts).
 *
 * @param props - Domain hint + submit/cancel callbacks.
 * @returns The form tree.
 */
export function CreateUserForm({
  domainHint,
  onSubmit,
  onCancel,
}: CreateUserFormProps): ReactElement {
  const [step, setStep] = useState<Step>('localPart');
  const [localPart, setLocalPart] = useState('');
  const [domain, setDomain] = useState(domainHint ?? '');

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
            setStep('password');
          }}
        />
      ) : null}

      {step === 'password' ? (
        <TextField
          label="password"
          mask
          onCancel={onCancel}
          onSubmit={(value) => {
            onSubmit({ localPart, domain, password: value, sendWelcomeEmail: false });
          }}
        />
      ) : null}

      <Text dimColor>[enter] next [esc] cancel</Text>
    </Box>
  );
}
