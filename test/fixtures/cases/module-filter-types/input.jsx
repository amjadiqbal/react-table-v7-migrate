import { useTable, useFilters } from 'react-table'

function startsWith(rows, ids, value) {
  return rows.filter((row) => ids.some((id) => String(row.values[id]).startsWith(value)))
}

const filterTypes = { startsWith }

export function Table({ columns, data }) {
  const { rows } = useTable({ columns, data, filterTypes }, useFilters)
  return <span>{rows.length}</span>
}

export const columns = [{ Header: 'Name', accessor: 'name', filter: 'startsWith' }]
