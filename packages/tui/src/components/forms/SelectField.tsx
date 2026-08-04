import { useState, type ReactElement } from 'react';
import { Box, Text, useInput } from 'ink';

/** One selectable option. */
export interface SelectOption {
  readonly label: string;
  readonly value: string;
}

/** Props for {@link SelectField}. */
export interface SelectFieldProps {
  /** Heading shown above the list. */
  readonly title: string;
  /** The options to choose from. */
  readonly options: readonly SelectOption[];
  /** Called with the chosen option's value on Enter. */
  readonly onSelect: (value: string) => void;
  /** Called on Esc. */
  readonly onCancel?: () => void;
}

/**
 * A minimal single-choice list: ↑/↓ move, Enter selects, Esc cancels.
 * `useInput`-based (deterministic, focus-independent) like the other fields.
 *
 * @param props - Title, options, and select/cancel callbacks.
 * @returns The list tree.
 */
export function SelectField({
  title,
  options,
  onSelect,
  onCancel,
}: SelectFieldProps): ReactElement {
  const [index, setIndex] = useState(0);
  const idx = options.length === 0 ? 0 : Math.min(index, options.length - 1);

  useInput((_input, key) => {
    if (key.upArrow) {
      setIndex((v) => Math.max(0, v - 1));
    } else if (key.downArrow) {
      setIndex((v) => (options.length === 0 ? 0 : Math.min(options.length - 1, v + 1)));
    } else if (key.return) {
      const opt = options[idx];
      if (opt) {
        onSelect(opt.value);
      }
    } else if (key.escape) {
      onCancel?.();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {title}
      </Text>
      {options.map((o, k) => (
        <Text key={o.value} inverse={k === idx}>
          {(k === idx ? '› ' : '  ') + o.label}
        </Text>
      ))}
      <Text dimColor>[↑↓] select [enter] confirm [esc] cancel</Text>
    </Box>
  );
}
