import React from 'react'

import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';

import makeData from '../makeData.js'

const features = tableFeatures({
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  paginatedRowModel: createPaginatedRowModel()
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
        const getToggleAllPageRowsSelectedProps = props => ({
          onChange: table.getToggleAllPageRowsSelectedHandler(),
          checked: table.getIsAllPageRowsSelected(),
          indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
          title: 'Toggle All Current Page Rows Selected',

          style: {
            cursor: 'pointer'
          },

          ...props
        });

        return (
          <div>
            <IndeterminateCheckbox {...getToggleAllPageRowsSelectedProps()} />
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
  const page = table.getRowModel().rows;
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();
  const pageOptions = table.getPageOptions();
  const pageCount = table.getPageCount();
  const gotoPage = table.setPageIndex;
  const nextPage = table.nextPage;
  const previousPage = table.previousPage;
  const setPageSize = table.setPageSize;
  const selectedFlatRows = table.getPrePaginatedRowModel().rows.filter(row => row.getIsSelected());
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const selectedRowIds = table.state.rowSelection;

  // Render the UI for your table
  return (
    <>
      <pre>
        <code>
          {JSON.stringify(
            {
              pageIndex,
              pageSize,
              pageCount,
              canNextPage,
              canPreviousPage,
            },
            null,
            2
          )}
        </code>
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
          {page.map((row, i) => {
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
      {/* 
        Pagination can be built however you'd like. 
        This is just a very basic UI implementation:
      */}
      <div className="pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {'<<'}
        </button>{' '}
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
          {'<'}
        </button>{' '}
        <button onClick={() => nextPage()} disabled={!canNextPage}>
          {'>'}
        </button>{' '}
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {'>>'}
        </button>{' '}
        <span>
          Page{' '}
          <strong>
            {pageIndex + 1} of {pageOptions.length}
          </strong>{' '}
        </span>
        <span>
          | Go to page:{' '}
          <input
            type="number"
            defaultValue={pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              gotoPage(page)
            }}
            style={{ width: '100px' }}
          />
        </span>{' '}
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value))
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
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
      </div>
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
