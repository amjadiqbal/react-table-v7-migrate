import { useTable } from 'react-table'
import { ExternalCell } from './external-cell'

function NameCell(props) {
  return <b title={props.row.original.id}>{props.value} ({props.rows.length})</b>
}

const EditableCell = ({ value: initialValue = '', row: { index }, column: { id }, updateMyData }) => {
  return <input defaultValue={initialValue} onBlur={(e) => updateMyData(index, id, e.target.value)} />
}

const columns = [
  { Header: (props) => <i>{props.column.id}</i>, accessor: 'name', Cell: NameCell },
  { Header: 'Edit', accessor: 'note', Cell: EditableCell },
  { Header: 'Ext', accessor: 'ext', Cell: ExternalCell },
  { Header: ({ rows, state }) => `${rows.length} / ${state.pageIndex}`, accessor: 'count', Cell: ({ cell }) => cell.value * 2 },
]

export function Table({ data, updateMyData }) {
  const { headerGroups, rows, prepareRow } = useTable({ columns, data, updateMyData })
  return (
    <table>
      <thead>{headerGroups.map((hg) => <tr {...hg.getHeaderGroupProps()}>{hg.headers.map((c) => <th {...c.getHeaderProps()}>{c.render('Header')}</th>)}</tr>)}</thead>
      <tbody>{rows.map((row) => { prepareRow(row); return <tr {...row.getRowProps()}>{row.cells.map((cell) => <td {...cell.getCellProps()}>{cell.render('Cell')}</td>)}</tr> })}</tbody>
    </table>
  )
}
