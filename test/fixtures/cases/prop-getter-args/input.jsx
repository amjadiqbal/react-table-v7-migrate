import { useTable, useSortBy } from 'react-table'

const getStyles = (props) => [props, { style: { color: 'red' } }]

export function Table({ columns, data }) {
  const { getTableProps, headerGroups, rows, prepareRow } = useTable({ columns, data }, useSortBy)
  return (
    <table {...getTableProps({ className: 'grid' })}>
      <thead>
        {headerGroups.map((hg) => (
          <tr {...hg.getHeaderGroupProps({ className: 'head' })}>
            {hg.headers.map((column) => (
              <th
                className="cell"
                {...column.getHeaderProps([{ className: column.className, style: { width: 100 } }, column.getSortByToggleProps({ title: 'Sort' })])}
              >
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => {
          prepareRow(row)
          const rowProps = row.getRowProps()
          return (
            <tr {...rowProps} key={row.id}>
              {row.cells.map((cell) => (
                <td {...cell.getCellProps(getStyles)}>{cell.render('Cell')}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
