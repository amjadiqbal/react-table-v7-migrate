import React from 'react'

import {
  columnVisibilityFeature,
  flexRender,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  rowSelectionFeature,
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

    return (
      <>
        <input type="checkbox" ref={resolvedRef} {...rest} />
      </>
    )
  }
)

function Table({ columns, data }) {
  const columnsWithHooks = React.useMemo(() => (columns => [
    // Let's make a column for selection
    {
      id: 'selection',
      // The header can use the table's getToggleAllRowsSelectedProps method
      // to render a checkbox
      header: ({ table }) => {
        const getToggleAllRowsSelectedProps = props => ({
          onChange: table.getToggleAllRowsSelectedHandler(),
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected(),
          title: 'Toggle All Rows Selected',

          style: {
            cursor: 'pointer'
          },

          ...props
        });

        return (
          <div>
            <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
          </div>
        );
      },
      // The cell can use the individual row's getToggleRowSelectedProps method
      // to the render a checkbox
      cell: ({ row }) => (
        <div>
          <IndeterminateCheckbox
            onChange={row.getToggleSelectedHandler()}
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            title='Toggle Row Selected'
            style={{
              cursor: 'pointer'
            }} />
        </div>
      ),
    },
    ...columns,
  ])(columns), [columns]);

  // Use the state and functions returned from useTable to build your UI
  const table = useTable({
    features,
    columns: columnsWithHooks,
    data,
    getSubRows: row => row.subRows,
    enableRowRangeSelection: false
  })

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const selectedFlatRows = table.getRowModel().rows.filter(row => row.getIsSelected());
  const selectedRowIds = table.state.rowSelection;

  // Render the UI for your table
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
          {rows.slice(0, 10).map((row, i) => {
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
      <p>Selected Rows: {Object.keys(selectedRowIds).length}</p>
      <pre>
        <code>
          {JSON.stringify(
            {
              selectedRowIds: selectedRowIds,
              'selectedFlatRows[].original': selectedFlatRows.map(
                d => d.original
              ),
            },
            null,
            2
          )}
        </code>
      </pre>
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

  const data = React.useMemo(() => makeData(10, 3), [])

  return (
    <Styles>
      <Table columns={columns} data={data} />
    </Styles>
  )
}

export default App
