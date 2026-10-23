import React from 'react'
import { useTable } from 'react-table'

import makeData from '../makeData.js'

const Styles = ({ children }) => <div>{children}</div>

function Table({ columns, data }) {
  // Use the state and functions returned from useTable to build your UI
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    footerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns,
    data,
  })

  // Render the UI for your table
  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(group => (
          <tr {...group.getHeaderGroupProps()}>
            {group.headers.map(column => (
              <th {...column.getHeaderProps()}>{column.render('Header')}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, i) => {
          prepareRow(row)
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => {
                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              })}
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        {footerGroups.map(group => (
          <tr {...group.getFooterGroupProps()}>
            {group.headers.map(column => (
              <td {...column.getFooterProps()}>{column.render('Footer')}</td>
            ))}
          </tr>
        ))}
      </tfoot>
    </table>
  )
}

function App() {
  const columns = React.useMemo(
    () => [
      {
        Header: 'Name',
        Footer: 'Name',
        columns: [
          {
            Header: 'First Name',
            accessor: 'firstName',
            Footer: 'First Name',
          },
          {
            Header: 'Last Name',
            accessor: 'lastName',
            Footer: 'Last Name',
          },
        ],
      },
      {
        Header: 'Info',
        Footer: 'Info',
        columns: [
          {
            Header: 'Age',
            accessor: 'age',
            Footer: 'Age',
          },
          {
            Header: 'Visits',
            accessor: 'visits',
            Footer: info => {
              // Only calculate total visits if rows change
              const total = React.useMemo(
                () =>
                  info.rows.reduce((sum, row) => row.values.visits + sum, 0),
                [info.rows]
              )

              return <>Total: {total}</>
            },
          },
          {
            Header: 'Status',
            accessor: 'status',
            Footer: 'Status',
          },
          {
            Header: 'Profile Progress',
            accessor: 'progress',
            Footer: 'Profile Progress',
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
