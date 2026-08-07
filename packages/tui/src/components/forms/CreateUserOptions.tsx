import { useState, type ReactElement } from 'react';
import { Box, Text, useInput } from 'ink';
import { isEmail } from '@fablabfortsmith/purelymail-notify';

/** The choices collected by {@link CreateUserOptions}. */
export interface CreateUserOptionsValue {
  /** Auto-generate a strong password instead of typing one. */
  readonly generate: boolean;
  /** Email the account details to the recovery address. */
  readonly email: boolean;
  /** Recovery address — stored on the account and (if `email`) the destination. */
  readonly recovery: string;
}

/** Props for {@link CreateUserOptions}. */
export interface CreateUserOptionsProps {
  /** Whether a `[notify]` SMTP section is configured (enables the email option). */
  readonly notifyConfigured: boolean;
  /** Called with the choices when the panel is confirmed. */
  readonly onSubmit: (value: CreateUserOptionsValue) => void;
  /** Called on Esc. */
  readonly onCancel: () => void;
}

type Row = 'generate' | 'email' | 'recovery';

/**
 * A checkbox options panel for user creation: toggle password auto-generation
 * and "email the account details", with a required, validated recovery-address
 * field that appears when emailing is enabled. That address is also stored on
 * the new account as its recovery address.
 *
 * Deterministic `useInput` (arrow keys move focus, Space toggles a checkbox,
 * typing edits the recovery field, Enter confirms, Esc cancels) — consistent
 * with the other form fields and reliable in tests. Enter is refused until a
 * valid recovery address is present when emailing is on (fail closed).
 *
 * @param props - Notify availability + submit/cancel callbacks.
 * @returns The panel tree.
 */
export function CreateUserOptions({
  notifyConfigured,
  onSubmit,
  onCancel,
}: CreateUserOptionsProps): ReactElement {
  const [generate, setGenerate] = useState(true);
  const [email, setEmail] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState('');

  const rows: Row[] = ['generate'];
  if (notifyConfigured) {
    rows.push('email');
  }
  if (email) {
    rows.push('recovery');
  }
  const current: Row = rows[Math.min(focus, rows.length - 1)] ?? 'generate';

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    } else if (key.upArrow) {
      setFocus((f) => Math.max(0, f - 1));
    } else if (key.downArrow) {
      setFocus((f) => Math.min(rows.length - 1, f + 1));
    } else if (key.return) {
      if (email && !isEmail(recovery.trim())) {
        setError('a valid recovery email is required to email account details');
        setFocus(rows.indexOf('recovery'));
        return;
      }
      // Only carry a recovery address when emailing is on, so a value typed and
      // then disabled is never stored on the account.
      onSubmit({ generate, email, recovery: email ? recovery.trim() : '' });
    } else if (current === 'generate' && input === ' ') {
      setGenerate((g) => !g);
    } else if (current === 'email' && input === ' ') {
      setEmail((e) => {
        const next = !e;
        if (!next) {
          setRecovery(''); // clear so a re-enable starts blank
        }
        return next;
      });
      setError('');
    } else if (current === 'recovery') {
      if (key.backspace || key.delete) {
        setRecovery((r) => r.slice(0, -1));
      } else if (input.length > 0 && input !== ' ' && !key.ctrl && !key.meta) {
        setRecovery((r) => r + input);
      }
    }
  });

  const box = (on: boolean): string => (on ? '[x]' : '[ ]');
  const marker = (row: Row): string => (current === row ? '>' : ' ');

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        New user — options
      </Text>
      <Text>
        {marker('generate')} {box(generate)} generate a strong password
      </Text>
      {notifyConfigured ? (
        <Text>
          {marker('email')} {box(email)} email account details to a recovery address
        </Text>
      ) : null}
      {email ? (
        <Text>
          {marker('recovery')} recovery email: {recovery}
          <Text inverse> </Text>
          <Text dimColor> (required — stored on the account)</Text>
        </Text>
      ) : null}
      {error !== '' ? <Text color="red">{error}</Text> : null}
      <Text dimColor>[↑/↓] move [space] toggle [type] recovery [enter] confirm [esc] cancel</Text>
    </Box>
  );
}
