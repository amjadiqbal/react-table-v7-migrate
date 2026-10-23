import {
  columnVisibilityFeature,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),

  sortFns: {
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

const v7DefaultColumn = {
  sortFn: 'alphanumericCaseSensitive'
};

const getStyles = (props) => [props, { style: { color: 'red' } }]

export function Table({ columns, data }) {
  const table = useTable({
    features,
    columns,
    data,
    sortDescFirst: false,
    defaultColumn: v7DefaultColumn
  })
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  return (
    <table className='grid'>
      <thead>
        {headerGroups.map((hg) => (
          <tr key={hg.id} className='head'>
            {hg.headers.map((header) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                className={header.column.columnDef.meta?.className || "cell"}
                style={{
                  width: 100,
                  cursor: header.column.getCanSort() ? 'pointer' : undefined
                }}
                onClick={header.column.getToggleSortingHandler()}
                title='Sort'>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => {
          const rowProps = {
            key: row.id
          }
          return (
            <tr {...rowProps} key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
