import { useTable, usePagination } from 'react-table'

function Pager({ instance }) {
  return <button onClick={() => instance.nextPage()}>next</button>
}

export function Grid({ columns, data }) {
  const instance = useTable({ columns, data }, usePagination)
  const { getTableBodyProps, prepareRow, page } = instance
  return (
    <>
      <p>Page {instance.state.pageIndex + 1} of {instance.pageCount}</p>
      <table {...instance.getTableProps()}>
        <tbody {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row)
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map((cell) => <td {...cell.getCellProps()}>{cell.render('Cell')}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
      <Pager instance={instance} />
    </>
  )
}
