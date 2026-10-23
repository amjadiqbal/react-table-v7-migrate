import {
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_inNumberRange,
  filterFn_includesString,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import { filterFn_v7Includes, fromV7FilterType, fromV7SortType, sortFn_v7Number } from '@amjadiqbal/react-table-v7-migrate/compat';

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),

  filterFns: {
    equalsString: filterFn_equalsString,
    v7Includes: filterFn_v7Includes,
    inNumberRange: filterFn_inNumberRange,
    includesString: filterFn_includesString
  },

  sortFns: {
    text: sortFn_text,
    v7Number: sortFn_v7Number,
    datetime: sortFn_datetime,
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

const v7DefaultColumn = {
  filterFn: 'includesString',
  sortFn: 'alphanumericCaseSensitive'
};

function byLength(rowA, rowB, columnId) {
  return rowA.values[columnId].length - rowB.values[columnId].length
}

function startsWithA(rows, ids, filterValue) {
  return rows.filter((row) => ids.some((id) => String(row.getValue(id)).startsWith(filterValue)));
}
startsWithA.autoRemove = (v) => !v

export const columns = [
  { header: 'Name', accessorKey: 'name', sortFn: fromV7SortType(byLength), filterFn: fromV7FilterType(startsWithA), meta: {
    align: 'left'
  } },
  {
    id: 'address.city',
    header: 'City',
    accessorKey: 'address.city',
    filterFn: 'equalsString',
    sortFn: 'text'
  },
  { header: 'Tags', accessorKey: 'tags', filterFn: 'v7Includes', enableSorting: false },
  { header: 'Score', accessorKey: 'score', filterFn: 'inNumberRange', sortFn: 'v7Number', invertSorting: true },
  { header: 'Born', accessorFn: (row) => row.born, id: 'born', sortFn: 'datetime', enableColumnFilter: !someFlag(), size: 120, minSize: 80 },
  { header: 'Upper', id: 'upper', accessorFn: (row) => row.name.toUpperCase(), footer: (info) => `${info.table.getRowModel().rows.length} rows` },
]

function someFlag() {
  return false
}

export function Table({ data }) {
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
    <table>
      <thead>
        {headerGroups.map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                style={{ textAlign: header.column.columnDef.meta?.align }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => {
          return <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>;
        })}
      </tbody>
    </table>
  );
}
