import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { TableModel } from '../data.js';

/** Pad a cell to a fixed width. */
function pad(value: string, width: number): string {
  return value.padEnd(width);
}

/**
 * Render a {@link TableModel} as a fixed-width, aligned text table.
 *
 * @param props - The table model to render.
 * @returns The rendered table (or a dimmed empty-state line).
 */
export function Table({ model }: { readonly model: TableModel }): ReactElement {
  if (model.rows.length === 0) {
    return <Text dimColor>(no rows)</Text>;
  }
  const widths = model.columns.map((col) =>
    Math.max(col.length, ...model.rows.map((row) => (row[col] ?? '').length)),
  );
  return (
    <Box flexDirection="column">
      <Text bold>{model.columns.map((col, i) => pad(col, widths[i] ?? 0)).join('  ')}</Text>
      {model.rows.map((row, ri) => (
        <Text key={ri}>
          {model.columns.map((col, i) => pad(row[col] ?? '', widths[i] ?? 0)).join('  ')}
        </Text>
      ))}
    </Box>
  );
}
