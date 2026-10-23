import { useTable, useSortBy, useFilters } from 'react-table'

function byLength(rowA, rowB, columnId) {
  return rowA.values[columnId].length - rowB.values[columnId].length
}

function startsWithA(rows, ids, filterValue) {
  return rows.filter((row) => ids.some((id) => String(row.values[id]).startsWith(filterValue)))
}
startsWithA.autoRemove = (v) => !v

export const columns = [
  { Header: 'Name', accessor: 'name', sortType: byLength, filter: startsWithA, align: 'left' },
  { Header: 'City', accessor: 'address.city', filter: 'exactText', sortType: 'string' },
  { Header: 'Tags', accessor: 'tags', filter: 'includes', disableSortBy: true },
  { Header: 'Score', accessor: 'score', filter: 'between', sortType: 'number', sortInverted: true },
  { Header: 'Born', accessor: (row) => row.born, id: 'born', sortType: 'datetime', disableFilters: someFlag(), width: 120, minWidth: 80 },
  { Header: 'Upper', id: 'upper', accessor: (row) => row.name.toUpperCase(), Footer: (info) => `${info.rows.length} rows` },
]

function someFlag() {
  return false
}

export function Table({ data }) {
  const { headerGroups, rows, prepareRow } = useTable({ columns, data }, useFilters, useSortBy)
  return (
    <table>
      <thead>
        {headerGroups.map((hg) => (
          <tr {...hg.getHeaderGroupProps()}>
            {hg.headers.map((column) => (
              <th {...column.getHeaderProps()} style={{ textAlign: column.align }}>
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => {
          prepareRow(row)
          return <tr {...row.getRowProps()}>{row.cells.map((cell) => <td {...cell.getCellProps()}>{cell.render('Cell')}</td>)}</tr>
        })}
      </tbody>
    </table>
  )
}
