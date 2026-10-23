import React from 'react'
import { columnVisibilityFeature, flexRender, tableFeatures, useTable } from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  columnVisibilityFeature
});

const Styles = ({ children }) => <div>{children}</div>
const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef()
    const resolvedRef = ref || defaultRef

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate
    }, [resolvedRef, indeterminate])

    return <input type="checkbox" ref={resolvedRef} {...rest} />
  }
)

function Table({ columns, data }) {
  // Use the state and functions returned from useTable to build your UI
  const table = useTable({
    features,
    columns,
    data
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const allColumns = table.getAllLeafColumns();

  const getToggleHideAllColumnsProps = props => ({
    onChange: table.getToggleAllColumnsVisibilityHandler(),
    checked: table.getIsAllColumnsVisible(),
    indeterminate: !table.getIsAllColumnsVisible() && table.getIsSomeColumnsVisible(),
    title: 'Toggle All Columns Hidden',

    style: {
      cursor: 'pointer'
    },

    ...props
  });

  // Render the UI for your table
  return (
    <>
      <div>
        <div>
          <IndeterminateCheckbox {...getToggleHideAllColumnsProps()} /> Toggle
          All
        </div>
        {allColumns.map(column => (
          <div key={column.id}>
            <label>
              <input
                type="checkbox"
                onChange={column.getToggleVisibilityHandler()}
                checked={column.getIsVisible()}
                title='Toggle Column Visible'
                style={{
                  cursor: 'pointer'
                }} />{' '}
              {column.id}
            </label>
          </div>
        ))}
        <br />
      </div>
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
      <pre>{JSON.stringify(table.state, null, 2)}</pre>
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

  const data = React.useMemo(() => makeData(20), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
