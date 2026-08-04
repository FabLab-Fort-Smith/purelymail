import type { ReactElement } from 'react';
import { Text, useInput } from 'ink';

/** Props for {@link ConfirmPrompt}. */
export interface ConfirmPromptProps {
  /** The question to show (destructive actions should be explicit). */
  readonly message: string;
  /** Called on `y`. */
  readonly onConfirm: () => void;
  /** Called on `n`/Esc (the safe default). */
  readonly onCancel: () => void;
}

/**
 * A yes/no confirmation for destructive actions. Defaults to *no* — only `y`
 * confirms; `n` or Esc cancels.
 *
 * @param props - Message + confirm/cancel callbacks.
 * @returns The prompt line.
 */
export function ConfirmPrompt({ message, onConfirm, onCancel }: ConfirmPromptProps): ReactElement {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N' || key.escape) {
      onCancel();
    }
  });
  return (
    <Text color="red">
      {message} <Text dimColor>[y/N]</Text>
    </Text>
  );
}
