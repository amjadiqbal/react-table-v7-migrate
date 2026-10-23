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

// A simple way to support a renderRowSubComponent is to make a render prop
// This is NOT part of the React Table API, it's merely a rendering
// option we are creating for ourselves in our table renderer
function Table({ columns: userColumns, data, renderRowSubComponent }) {
  const table = useTable({
    features,
    columns: userColumns,
    data,
    getSubRows: row => row.subRows,
    getRowCanExpand: () => true
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const expanded = table.state.expanded;

  return (
    <>
      <pre>
        <code>{JSON.stringify({ expanded: expanded }, null, 2)}</code>
      </pre>
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
              // Use a React.Fragment here so the table markup is still valid
              <React.Fragment key={row.id}>
                <tr>
                  {row.getVisibleCells().map(cell => {
                    return (<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>);
                  })}
                </tr>
                {/*
                    If the row is in an expanded state, render a row with a
                    column that fills the entire length of the table.
                  */}
                {row.getIsExpanded() ? (
                  <tr>
                    <td colSpan={visibleColumns.length}>
                      {/*
                          Inside it, call our renderRowSubComponent function. In reality,
                          you could pass whatever you want as props to
                          a component like this, including the entire
                          table instance. But for this example, we'll just
                          pass the row
                        */}
                      {renderRowSubComponent({ row })}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
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
        // Make an expander cell
        header: () => null, // No header
        id: 'expander', // It needs an ID
        cell: ({ row }) => (
          // Use Cell to render an expander for each row.
          // We can use the getToggleRowExpandedProps prop-getter
          // to build the expander.
          <span
            onClick={row.getToggleExpandedHandler()}
            title='Toggle Row Expanded'
            style={{
              cursor: 'pointer'
            }}>
            {row.getIsExpanded() ? '👇' : '👉'}
          </span>
        ),
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

  const data = React.useMemo(() => makeData(10), [])

  // Create a function that will render our row sub components
  const renderRowSubComponent = React.useCallback(
    ({ row }) => (
      <pre
        style={{
          fontSize: '10px',
        }}
      >
        <code>{JSON.stringify({ values: Object.fromEntries(row.getAllCells().map(c => [c.column.id, c.getValue()])) }, null, 2)}</code>
      </pre>
    ),
    []
  )

  return (
    <Styles>
      <Table
        columns={columns}
        data={data}
        // We added this as a prop for our table component
        // Remember, this is not part of the React Table API,
        // it's merely a rendering option we created for
        // ourselves
        renderRowSubComponent={renderRowSubComponent}
      />
    </Styles>
  )
}

export default App
