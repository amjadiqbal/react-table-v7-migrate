// Patterns from real apps: the instance kept in a variable, then destructured, then its state.
import { useTable, useSortBy, useGlobalFilter, usePagination } from 'react-table'

export function Table({ columns, data }) {
  const tableInstance = useTable({ columns, data, initialState: { pageSize: 25 } }, useGlobalFilter, useSortBy, usePagination)
  const { headerGroups, page, prepareRow, state, setGlobalFilter } = tableInstance
  const { globalFilter, pageIndex, pageSize = 10, sortBy } = state
  const { pageIndex: current } = tableInstance.state
  return (
    <div>
      <input value={globalFilter || ''} onChange={(e) => setGlobalFilter(e.target.value)} />
      <span>{pageIndex}/{current}/{pageSize}/{sortBy.length}</span>
      {headerGroups.map((hg) => <div {...hg.getHeaderGroupProps()}>{hg.headers.map((c) => <b {...c.getHeaderProps()}>{c.render('Header')}</b>)}</div>)}
      {page.map((row) => {
        prepareRow(row)
        return <p {...row.getRowProps()}>{row.cells.map((cell) => <i {...cell.getCellProps()}>{cell.render('Cell')}</i>)}</p>
      })}
    </div>
  )
}
