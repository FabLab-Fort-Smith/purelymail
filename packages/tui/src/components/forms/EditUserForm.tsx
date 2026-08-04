import { useState, type ReactElement } from 'react';
import { Box, Text } from 'ink';
import { TextField } from './TextField.js';

/** Values collected by {@link EditUserForm} (blank = leave unchanged). */
export interface EditUserFormValues {
  readonly newLocalPart: string;
  readonly newPassword: string;
}

/** Props for {@link EditUserForm}. */
export interface EditUserFormProps {
  /** The full `user@domain` being edited (shown, not editable here). */
  readonly userName: string;
  /** Called with the (possibly blank) changes. */
  readonly onSubmit: (values: EditUserFormValues) => void;
  /** Called on Esc. */
  readonly onCancel: () => void;
}

type Step = 'name' | 'password';

/** A completed-field summary line. */
function Done({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <Text>
      <Text dimColor>{label}: </Text>
      {value === '' ? <Text dimColor>(unchanged)</Text> : value}
    </Text>
  );
}

/**
 * A stepped form to modify a user: an optional rename (new local part) and an
 * optional password reset (masked). Leaving a field blank leaves it unchanged.
 * Enter advances, Esc cancels.
 *
 * @param props - The target username + submit/cancel callbacks.
 * @returns The form tree.
 */
export function EditUserForm({ userName, onSubmit, onCancel }: EditUserFormProps): ReactElement {
  const [step, setStep] = useState<Step>('name');
  const [newLocalPart, setNewLocalPart] = useState('');

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        Edit {userName}
      </Text>
      <Text dimColor>(blank = leave unchanged)</Text>
      {step !== 'name' ? <Done label="new local part" value={newLocalPart} /> : null}

      {step === 'name' ? (
        <TextField
          label="new local part"
          onCancel={onCancel}
          onSubmit={(value) => {
            setNewLocalPart(value.trim());
            setStep('password');
          }}
        />
      ) : null}

      {step === 'password' ? (
        <TextField
          label="new password"
          mask
          onCancel={onCancel}
          onSubmit={(value) => {
            onSubmit({ newLocalPart, newPassword: value });
          }}
        />
      ) : null}

      <Text dimColor>[enter] next [esc] cancel</Text>
    </Box>
  );
}
