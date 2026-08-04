import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { Table } from '../src/components/Table.js';
import type { TableModel } from '../src/data.js';

describe('Table', () => {
  it('renders an empty-state when there are no rows', () => {
    const model: TableModel = { columns: ['name'], rows: [], failures: [] };
    expect(render(<Table model={model} />).lastFrame()).toContain('(no rows)');
  });

  it('renders aligned columns and rows', () => {
    const model: TableModel = {
      columns: ['name', 'ok'],
      rows: [
        { name: 'alpha', ok: '✓' },
        { name: 'b', ok: '✗' },
      ],
      failures: [],
    };
    const frame = render(<Table model={model} />).lastFrame() ?? '';
    expect(frame).toContain('name');
    expect(frame).toContain('alpha');
    expect(frame).toContain('✓');
  });

  it('tolerates a missing cell (undefined -> blank)', () => {
    const model: TableModel = { columns: ['a', 'b'], rows: [{ a: 'x' }], failures: [] };
    expect(render(<Table model={model} />).lastFrame()).toContain('x');
  });
});
