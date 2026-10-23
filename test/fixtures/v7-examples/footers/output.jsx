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
  const footerGroups = table.getFooterGroups();
  const rows = table.getRowModel().rows;

  // Render the UI for your table
  return (
    <table>
      <thead>
        {headerGroups.map(group => (
          <tr key={group.id}>
            {group.headers.map(header => (
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
      <tfoot>
        {footerGroups.map(group => (
          <tr key={group.id}>
            {group.headers.map(header => (
              <td key={header.id} colSpan={header.colSpan}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}</td>
            ))}
          </tr>
        ))}
      </tfoot>
    </table>
  );
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        header: 'Name',
        footer: 'Name',
        columns: [
          {
            header: 'First Name',
            accessorKey: 'firstName',
            footer: 'First Name',
          },
          {
            header: 'Last Name',
            accessorKey: 'lastName',
            footer: 'Last Name',
          },
        ],
      },
      {
        header: 'Info',
        footer: 'Info',
        columns: [
          {
            header: 'Age',
            accessorKey: 'age',
            footer: 'Age',
          },
          {
            header: 'Visits',
            accessorKey: 'visits',
            footer: info => {
              // Only calculate total visits if rows change
              const total = React.useMemo(
                () =>
                  info.table.getRowModel().rows.reduce((sum, row) => row.getValue('visits') + sum, 0),
                [info.table.getRowModel().rows]
              )

              return <>Total: {total}</>
            },
          },
          {
            header: 'Status',
            accessorKey: 'status',
            footer: 'Status',
          },
          {
            header: 'Profile Progress',
            accessorKey: 'progress',
            footer: 'Profile Progress',
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
