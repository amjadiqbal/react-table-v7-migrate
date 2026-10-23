import React from 'react'

import {
  columnVisibilityFeature,
  createExpandedRowModel,
  flexRender,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  rowExpandingFeature,
  columnVisibilityFeature,
  expandedRowModel: createExpandedRowModel()
});

const Styles = ({ children }) => <div>{children}</div>

function Table({ columns: userColumns, data }) {
  const table = useTable({
    features,
    columns: userColumns,
    data,
    getSubRows: row => row.subRows,
    getRowCanExpand: () => true
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const expanded = table.state.expanded;

  return (
    <>
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
      <br />
      <div>Showing the first 20 results of {rows.length} rows</div>
      <pre>
        <code>{JSON.stringify({ expanded: expanded }, null, 2)}</code>
      </pre>
    </>
  );
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        // Build our expander column
        id: 'expander', // Make sure it has an ID
        header: (
          {
            table
          }
        ) => {
          const getToggleAllRowsExpandedProps = props => ({
            onClick: table.getToggleAllRowsExpandedHandler(),
            title: 'Toggle All Rows Expanded',

            style: {
              cursor: 'pointer'
            },

            ...props
          });

          const isAllRowsExpanded = table.getIsAllRowsExpanded();

          return (
            <span {...getToggleAllRowsExpandedProps()}>
              {isAllRowsExpanded ? '👇' : '👉'}
            </span>
          );
        },
        cell: ({ row }) =>
          // Use the row.canExpand and row.getToggleRowExpandedProps prop getter
          // to build the toggle for expanding a row
          !!row.subRows?.length ? (
            <span
              onClick={row.getToggleExpandedHandler()}
              title='Toggle Row Expanded'
              style={{
                cursor: 'pointer',

                // We can even use the row.depth property
                // and paddingLeft to indicate the depth
                // of the row
                paddingLeft: `${row.depth * 2}rem`
              }}>
              {row.getIsExpanded() ? '👇' : '👉'}
            </span>
          ) : null,
      },
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

  const data = React.useMemo(() => makeData(5, 5, 5), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
