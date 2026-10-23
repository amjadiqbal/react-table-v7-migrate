import React from 'react'
import { useTable, useSortBy, usePagination, Column, Row, CellProps, TableInstance, HeaderGroup } from 'react-table'

type User = { id: string; name: string; age: number; address: { city: string } }

const columns: Column<User>[] = [
  { Header: 'Name', accessor: 'name' },
  { Header: 'Age', accessor: 'age', Cell: ({ value }: CellProps<User, number>) => <b>{value}</b> },
  { Header: 'City', accessor: 'address.city' },
]

function rowLabel(row: Row<User>): string {
  return row.original.name
}

function Pager({ instance }: { instance: TableInstance<User> }) {
  return <span>{instance.getPageCount()}</span>
}

export function Users({ data }: { data: User[] }) {
  const { getTableProps, headerGroups, page, prepareRow, canNextPage, nextPage } = useTable<User>(
    { columns, data, initialState: { pageSize: 2 } },
    useSortBy,
    usePagination,
  )
  const groups: HeaderGroup<User>[] = headerGroups
  return (
    <table {...getTableProps()}>
      <thead>
        {groups.map((group) => (
          <tr {...group.getHeaderGroupProps()}>
            {group.headers.map((column) => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {column.isSorted ? (column.isSortedDesc ? ' v' : ' ^') : ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {page.map((row) => {
          prepareRow(row)
          return (
            <tr {...row.getRowProps()} title={rowLabel(row)}>
              {row.cells.map((cell) => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          )
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
  )
}

export { Pager }
