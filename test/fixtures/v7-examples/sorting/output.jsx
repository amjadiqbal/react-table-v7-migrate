import React from 'react'

import {
  columnVisibilityFeature,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumericCaseSensitive,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),

  sortFns: {
    alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive
  }
});

// react-table v7's defaults on every column: its case-sensitive alphanumeric sort
const v7DefaultColumn = {
  sortFn: 'alphanumericCaseSensitive'
};

const Styles = ({ children }) => <div>{children}</div>

function Table({ columns, data }) {
  const table = useTable({
    features,
    columns,
    data,
    sortDescFirst: false,
    defaultColumn: v7DefaultColumn
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  // We don't want to render all 2000 rows for this example, so cap
  // it at 20 for this use case
  const firstPageRows = rows.slice(0, 20)

  return (
    <>
      <table>
        <thead>
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                // Add the sorting props to control sorting. For this example
                // we can add them into the header props
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: header.column.getCanSort() ? 'pointer' : undefined
                  }}
                  title={header.column.getCanSort() ? 'Toggle SortBy' : undefined}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Add a sort direction indicator */}
                  <span>
                    {!!header.column.getIsSorted()
                      ? header.column.getIsSorted() === 'desc'
                        ? ' 🔽'
                        : ' 🔼'
                      : ''}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {firstPageRows.map(
            (row, i) => {
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => {
                    return (<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>);
                  })}
                </tr>
              );
            }
          )}
        </tbody>
      </table>
      <br />
      <div>Showing the first 20 results of {rows.length} rows</div>
    </>
  );
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        header: 'Name',
        columns: [
          {
            header: 'First Name',
            accessorKey: 'firstName',
          },
          {
            header: 'Last Name',
            accessorKey: 'lastName',
          },
        ],
      },
      {
        header: 'Info',
        columns: [
          {
            header: 'Age',
            accessorKey: 'age',
          },
          {
            header: 'Visits',
            accessorKey: 'visits',
          },
          {
            header: 'Status',
            accessorKey: 'status',
          },
          {
            header: 'Profile Progress',
            accessorKey: 'progress',
          },
        ],
      },
    ],
    []
  )

  const data = React.useMemo(() => makeData(300), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
