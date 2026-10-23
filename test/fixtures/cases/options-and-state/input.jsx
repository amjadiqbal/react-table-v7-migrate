import { useTable, useSortBy, useFilters, useGlobalFilter, usePagination, useRowSelect, useExpanded } from 'react-table'

export function Table({ columns, data, pageCount, skipReset }) {
  const {
    rows,
    state: { pageIndex, pageSize, sortBy, filters, globalFilter, selectedRowIds, expanded, hiddenColumns },
    setGlobalFilter,
    gotoPage,
    setPageSize,
    setSortBy,
    setAllFilters,
    setFilter,
    toggleAllRowsSelected,
    isAllRowsSelected,
    toggleHideColumn,
    allColumns,
  } = useTable(
    {
      columns,
      data,
      manualPagination: true,
      manualSortBy: true,
      pageCount,
      autoResetPage: !skipReset,
      autoResetSortBy: false,
      autoResetSelectedRows: false,
      disableMultiSort: true,
      disableSortRemove: true,
      getRowId: (row) => row.uuid,
      initialState: {
        pageIndex: 2,
        sortBy: [{ id: 'age', desc: true }],
        filters: [{ id: 'status', value: 'single' }],
        globalFilter: 'an',
        selectedRowIds: { a1: true },
        expanded: { a1: true },
        hiddenColumns: ['secret', 'internal'],
      },
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    useExpanded,
    usePagination,
    useRowSelect,
  )
  return (
    <div>
      <pre>{JSON.stringify({ pageIndex, pageSize, sortBy, filters, globalFilter, selectedRowIds, expanded, hiddenColumns })}</pre>
      <button onClick={() => gotoPage(0)}>first</button>
      <button onClick={() => setPageSize(50)}>50</button>
      <button onClick={() => setSortBy([])}>unsort</button>
      <button onClick={() => setAllFilters([])}>clear</button>
      <button onClick={() => setFilter('status', 'single')}>single</button>
      <button onClick={() => setGlobalFilter(undefined)}>clear search</button>
      <button onClick={() => toggleAllRowsSelected(!isAllRowsSelected)}>all</button>
      <button onClick={() => toggleHideColumn('age', true)}>hide age</button>
      <span>{rows.length} rows, {allColumns.length} columns</span>
    </div>
  )
}
