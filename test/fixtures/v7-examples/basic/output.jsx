import React from 'react'
import { columnVisibilityFeature, flexRender, tableFeatures, useTable } from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  columnVisibilityFeature
});

const Styles = ({ children }) => <div>{children}</div>

function Table({ columns, data }) {
  // Use the state and functions returned from useTable to build your UI
  const table = useTable({
    features,
    columns,
    data
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  // Render the UI for your table
  return (
    <table>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} colSpan={header.colSpan}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row, i) => {
          return (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => {
                return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
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

  const data = React.useMemo(() => makeData(20), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
