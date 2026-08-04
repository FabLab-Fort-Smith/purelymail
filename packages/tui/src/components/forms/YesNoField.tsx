import type { ReactElement } from 'react';
import { Text, useInput } from 'ink';

/** Props for {@link YesNoField}. */
export interface YesNoFieldProps {
  /** The prompt label. */
  readonly label: string;
  /** Called with the boolean answer. */
  readonly onSubmit: (value: boolean) => void;
  /** Called on Esc. */
  readonly onCancel?: () => void;
}

/**
 * A boolean field: `y`/`n` answers and advances. Esc cancels. Deterministic
 * (`useInput`-based), matching the other form fields.
 *
 * @param props - Label + submit/cancel callbacks.
 * @returns The prompt line.
 */
export function YesNoField({ label, onSubmit, onCancel }: YesNoFieldProps): ReactElement {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onSubmit(true);
    } else if (input === 'n' || input === 'N') {
      onSubmit(false);
    } else if (key.escape) {
      onCancel?.();
    }
  });
  return (
    <Text>
      <Text dimColor>{label} </Text>
      <Text dimColor>(y/n)</Text>
    </Text>
  );
}
