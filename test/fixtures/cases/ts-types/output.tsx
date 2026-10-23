import React from 'react'

import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
  type ColumnDef,
  type CellContext,
  type Row,
  type Table,
  type HeaderGroup,
} from '@tanstack/react-table';

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),

  sortFns: {
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

const v7DefaultColumn = {
  sortFn: 'alphanumericCaseSensitive'
} as const;

type User = { id: string; name: string; age: number; address: { city: string } }

const columns: ColumnDef<typeof features, User, any>[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Age', accessorKey: 'age', cell: ({ getValue }: CellContext<typeof features, User, number>) => {
    const value = getValue();
    return <b>{value}</b>;
  } },
  {
    id: 'address.city',
    header: 'City',
    accessorKey: 'address.city'
  },
]

function rowLabel(row: Row<typeof features, User>): string {
  return row.original.name
}

function Pager({ instance }: { instance: Table<typeof features, User> }) {
  return <span>{instance.getPageCount()}</span>
}

export function Users({ data }: { data: User[] }) {
  const table = useTable({
    features,
    columns,
    data,

    initialState: { pagination: {
      pageIndex: 0,
      pageSize: 2
    } },

    sortDescFirst: false,
    defaultColumn: v7DefaultColumn
  })
  const headerGroups = table.getHeaderGroups();
  const page = table.getRowModel().rows;
  const canNextPage = table.getCanNextPage();
  const nextPage = table.nextPage;
  const groups: HeaderGroup<typeof features, User>[] = headerGroups
  return (
    <table>
      <thead>
        {groups.map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                onClick={header.column.getToggleSortingHandler()}
                style={{
                  cursor: header.column.getCanSort() ? 'pointer' : undefined
                }}
                title={header.column.getCanSort() ? 'Toggle SortBy' : undefined}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                {!!header.column.getIsSorted() ? (header.column.getIsSorted() === 'desc' ? ' v' : ' ^') : ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {page.map((row) => {
          return (
            <tr key={row.id} title={rowLabel(row)}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>
            <button disabled={!canNextPage} onClick={() => nextPage()}>Next</button>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export { Pager }
