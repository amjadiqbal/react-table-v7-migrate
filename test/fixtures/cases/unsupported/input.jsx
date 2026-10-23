import { useTable, useGroupBy, useResizeColumns, useBlockLayout, useExpanded, makePropGetter } from 'react-table'

export function Table({ columns, data }) {
  const { headerGroups, rows, prepareRow } = useTable(
    {
      columns,
      data,
      stateReducer: (state) => state,
      useControlledState: (state) => state,
    },
    useGroupBy,
    useBlockLayout,
    useResizeColumns,
    useExpanded,
    (hooks) => {
      hooks.useInstance.push((instance) => instance)
    },
  )
  return (
    <div>
      {headerGroups.map((hg) => (
        <div {...hg.getHeaderGroupProps()}>
          {hg.headers.map((column) => (
            <div {...column.getHeaderProps()}>
              {column.canGroupBy ? <span {...column.getGroupByToggleProps()}>group</span> : null}
              {column.render('Header')}
              <div {...column.getResizerProps()} />
            </div>
          ))}
        </div>
      ))}
      {rows.map((row) => {
        prepareRow(row)
        return (
          <div {...row.getRowProps()}>
            {row.cells.map((cell) => (
              <div {...cell.getCellProps()}>
                {cell.isGrouped ? cell.render('Cell') : cell.isAggregated ? cell.render('Aggregated') : cell.render('Cell')}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export const getter = makePropGetter
