import { useState, type ReactElement } from 'react';
import { Text, useInput } from 'ink';

/** Props for {@link TextField}. */
export interface TextFieldProps {
  /** Field label shown before the value. */
  readonly label: string;
  /** Initial value (e.g. a prefill). */
  readonly initial?: string;
  /** Mask the value (for passwords). */
  readonly mask?: boolean;
  /** Called with the value on Enter. */
  readonly onSubmit: (value: string) => void;
  /** Called on Esc (abort). */
  readonly onCancel?: () => void;
}

/**
 * A minimal single-line text input built on ink's `useInput` — deterministic
 * and focus-independent (unlike focus-managed widget libraries), so it works
 * reliably alongside the dashboard's own key handling and in tests. Supports
 * typing, backspace, Enter (submit), and Esc (cancel); optionally masked.
 *
 * @param props - Label, initial value, mask flag, and submit/cancel callbacks.
 * @returns The rendered field with a cursor block.
 */
export function TextField({
  label,
  initial = '',
  mask = false,
  onSubmit,
  onCancel,
}: TextFieldProps): ReactElement {
  const [value, setValue] = useState(initial);

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
    } else if (key.escape) {
      onCancel?.();
    } else if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
    } else if (input.length > 0 && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  const shown = mask ? '*'.repeat(value.length) : value;
  return (
    <Text>
      <Text dimColor>{label}: </Text>
      {shown}
      <Text inverse> </Text>
    </Text>
  );
}
