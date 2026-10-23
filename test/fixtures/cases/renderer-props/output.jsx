import { columnVisibilityFeature, flexRender, tableFeatures, useTable } from '@tanstack/react-table';
import { ExternalCell } from './external-cell'

const features = tableFeatures({
  columnVisibilityFeature
});

function NameCell(props) {
  return <b title={props.row.original.id}>{props.getValue()} ({props.table.getRowModel().rows.length})</b>;
}

const EditableCell = ({ getValue, row: { index }, column: { id }, table }) => {
  const initialValue = getValue() ?? '';
  const updateMyData = table.options.meta?.updateMyData;
  return <input defaultValue={initialValue} onBlur={(e) => updateMyData(index, id, e.target.value)} />
}

const columns = [
  { header: (props) => <i>{props.column.id}</i>, accessorKey: 'name', cell: NameCell },
  { header: 'Edit', accessorKey: 'note', cell: EditableCell },
  { header: 'Ext', accessorKey: 'ext', cell: ExternalCell },
  { header: (
    {
      table
    }
  ) => {
    const rows = table.getRowModel().rows;
    return `${rows.length} / ${table.state.pagination.pageIndex}`;
  }, accessorKey: 'count', cell: ({ cell }) => cell.getValue() * 2 },
]

export function Table({ data, updateMyData }) {
  const table = useTable({
    features,
    columns,
    data,

    meta: {
      updateMyData
    }
  })
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  return (
    <table>
      <thead>{headerGroups.map((hg) => <tr key={hg.id}>{hg.headers.map((c) => <th key={c.id} colSpan={c.colSpan}>{c.isPlaceholder ? null : flexRender(c.column.columnDef.header, c.getContext())}</th>)}</tr>)}</thead>
      <tbody>{rows.map((row) => {
        return <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>;
      })}</tbody>
    </table>
  );
}
