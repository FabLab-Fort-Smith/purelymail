import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { TableModel } from '../data.js';

/** Pad a cell to a fixed width. */
function pad(value: string, width: number): string {
  return value.padEnd(width);
}

/** Props for {@link Table}. */
export interface TableProps {
  readonly model: TableModel;
  /** Row index to highlight (for selection); omit for a non-interactive table. */
  readonly selectedIndex?: number;
}

/**
 * Render a {@link TableModel} as a fixed-width, aligned text table, optionally
 * highlighting a selected row.
 *
 * @param props - The table model and optional selected row.
 * @returns The rendered table (or a dimmed empty-state line).
 */
export function Table({ model, selectedIndex }: TableProps): ReactElement {
  if (model.rows.length === 0) {
    return <Text dimColor>(no rows)</Text>;
  }
  const widths = model.columns.map((col) =>
    Math.max(col.length, ...model.rows.map((row) => (row[col] ?? '').length)),
  );
  return (
    <Box flexDirection="column">
      <Text bold>{'  ' + model.columns.map((col, i) => pad(col, widths[i] ?? 0)).join('  ')}</Text>
      {model.rows.map((row, ri) => {
        const cells = model.columns.map((col, i) => pad(row[col] ?? '', widths[i] ?? 0)).join('  ');
        const active = ri === selectedIndex;
        return (
          <Text key={ri} inverse={active}>
            {(active ? '› ' : '  ') + cells}
          </Text>
        );
      })}
    </Box>
  );
}
